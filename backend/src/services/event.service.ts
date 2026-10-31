import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { UserRole, EventStatus } from '../types';
import { generateEventCode } from '../utils/generateCode';
import { createNotification } from './notification.service';

export const eventInclude = {
      createdBy: {
        select: { id: true, fullName: true, email: true, role: true, department: true },
      },
      budgetItems: { orderBy: { createdAt: 'asc' } },
      scheduleItems: { orderBy: { sortOrder: 'asc' } },
      approvalDecisions: {
        include: {
          decidedBy: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      workflowHistory: { orderBy: { createdAt: 'desc' } },
      attachments: {
        include: {
          uploadedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      resourceBookings: {
        include: {
          facility: true,
          bookingItems: { include: { equipment: true } },
        },
      },
      handoverRecords: {
        include: {
          handoverBy: { select: { id: true, fullName: true } },
          receivedBy: { select: { id: true, fullName: true } },
        },
      },
      returnInspections: {
        include: {
          inspectedBy: { select: { id: true, fullName: true } },
        },
      },
      incidentReports: {
        include: {
          reportedBy: { select: { id: true, fullName: true } },
        },
      },
      settlements: {
        include: {
          items: true,
          documents: true,
          submittedBy: { select: { id: true, fullName: true } },
          reviewedBy: { select: { id: true, fullName: true } },
        },
      },
      eventReport: true,
      versions: { orderBy: { version: 'desc' } },
    } satisfies Prisma.EventInclude;

export async function createEvent(data: {
  title: string;
  description?: string;
  objectives?: string;
  targetAudience?: string;
  expectedAttendees?: number;
  organizingUnit: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  startDate?: string;
  endDate?: string;
  setupTime?: string;
  teardownTime?: string;
  preferredVenue?: string;
  planContent?: string;
  safetyPlan?: string;
  communicationPlan?: string;
  budgetItems?: Array<{
    category: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }>;
  scheduleItems?: Array<{
    timeSlot: string;
    activity: string;
    responsible?: string;
    notes?: string;
    sortOrder?: number;
  }>;
  booking?: { facilityId: string; startTime: string; endTime: string; equipmentItems?: Array<{ equipmentId: string; quantity: number }> };
}, userId: string, legacy?: { key: string; snapshot: string }) {
  const eventCode = await generateEventCode();

  const event = await prisma.$transaction(async (tx) => {
    if (legacy) {
      const existing = await tx.systemSetting.findUnique({ where: { key: legacy.key } });
      if (existing) return { id: JSON.parse(existing.value).eventId };
    }
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const now = new Date(Date.now() - 5 * 60 * 1000); // 5 phút dung sai
      if (start < now) {
        throw new Error('Thời gian bắt đầu không được ở trong quá khứ');
      }
      if (end < now) {
        throw new Error('Thời gian kết thúc không được ở trong quá khứ');
      }
      if (start.getTime() === end.getTime()) {
        throw new Error('Giờ kết thúc không được trùng với giờ bắt đầu');
      }
      if (start > end) {
        throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu');
      }
    }
    if (data.booking) {
      const b = data.booking;
      const start = new Date(b.startTime), end = new Date(b.endTime);
      if (start.getTime() === end.getTime()) {
        throw new Error('Giờ kết thúc không được trùng với giờ bắt đầu');
      }
      if (!(start < end)) throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu');
      const facility = await tx.facility.findUnique({ where: { id: b.facilityId } });
      if (!facility?.isActive) throw new Error('Địa điểm được chọn không tồn tại hoặc tạm ngưng hoạt động');
      if (facility.capacity && (data.expectedAttendees || 0) > facility.capacity) {
        throw new Error(`Số người tham dự (${data.expectedAttendees}) vượt quá sức chứa tối đa của ${facility.name} (${facility.capacity} chỗ)`);
      }
      const overlap = { status: { in: ['PENDING', 'CONFIRMED', 'TENTATIVE'] }, startTime: { lt: end }, endTime: { gt: start } };
      if (await tx.resourceBooking.count({ where: { facilityId: b.facilityId, ...overlap } })) {
        throw new Error('Địa điểm đã có sự kiện đăng ký trong khung giờ này. Vui lòng chọn khung giờ khác.');
      }
      for (const item of b.equipmentItems || []) {
        const equipment = await tx.equipment.findUnique({ where: { id: item.equipmentId } });
        const used = await tx.resourceBookingItem.aggregate({ where: { equipmentId: item.equipmentId, booking: overlap }, _sum: { quantity: true } });
        if (!equipment?.isActive || (used._sum.quantity || 0) + item.quantity > equipment.totalQuantity) throw new Error('Thiết bị không đủ số lượng');
      }
    }
    const created = await tx.event.create({
      data: {
        eventCode,
        title: data.title,
        description: data.description,
        objectives: data.objectives,
        targetAudience: data.targetAudience,
        expectedAttendees: data.expectedAttendees,
        organizingUnit: data.organizingUnit,
        contactPerson: data.contactPerson,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        setupTime: data.setupTime ? new Date(data.setupTime) : undefined,
        teardownTime: data.teardownTime ? new Date(data.teardownTime) : undefined,
        preferredVenue: data.preferredVenue,
        planContent: data.planContent,
        safetyPlan: data.safetyPlan,
        communicationPlan: data.communicationPlan,
        status: EventStatus.DRAFT,
        createdById: userId,
      },
    });

    if (data.budgetItems?.length) {
      await tx.budgetItem.createMany({
        data: data.budgetItems.map((item) => ({
          eventId: created.id,
          category: item.category,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          notes: item.notes,
        })),
      });
    }

    if (data.scheduleItems?.length) {
      await tx.eventScheduleItem.createMany({
        data: data.scheduleItems.map((item, index) => ({
          eventId: created.id,
          timeSlot: item.timeSlot,
          activity: item.activity,
          responsible: item.responsible,
          notes: item.notes,
          sortOrder: item.sortOrder ?? index,
        })),
      });
    }

    if (data.booking) {
      const b = data.booking;
      await tx.resourceBooking.create({ data: {
        eventId: created.id, facilityId: b.facilityId,
        startTime: new Date(b.startTime), endTime: new Date(b.endTime),
        bookingItems: { create: (b.equipmentItems || []).map(i => ({ equipmentId: i.equipmentId, quantity: i.quantity })) },
      } });
    }
    if (legacy) await tx.systemSetting.create({ data: {
      key: legacy.key, category: 'LEGACY_BACKUP', value: JSON.stringify({ eventId: created.id, snapshot: legacy.snapshot }),
    } });
    // Create initial version
    await tx.eventVersion.create({
      data: {
        eventId: created.id,
        version: 1,
        title: created.title,
        description: created.description,
        objectives: created.objectives,
        planContent: created.planContent,
        changedBy: userId,
        changeNote: 'Khởi tạo hồ sơ',
      },
    });

    // Create workflow history
    await tx.workflowHistory.create({
      data: {
        eventId: created.id,
        fromStatus: '',
        toStatus: EventStatus.DRAFT,
        action: 'CREATE',
        actorId: userId,
        actorName: (await tx.user.findUnique({ where: { id: userId } }))?.fullName,
        actorRole: (await tx.user.findUnique({ where: { id: userId } }))?.role,
        comments: 'Tạo hồ sơ sự kiện mới',
      },
    });

    return created;
  });

  return getEventById(event.id);
}

export async function getEvents(filters: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}, userId: string, role: string) {
  const { status, search, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { deletedAt: null };

  // Synchronized view across all roles
  // All roles can see events to track workflow progress

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { eventCode: { contains: search } },
      { organizingUnit: { contains: search } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: eventInclude,
  });

  return event;
}

export async function updateEvent(id: string, data: Record<string, unknown>, userId: string, userRole?: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.deletedAt) throw new Error('Không tìm thấy hồ sơ');

  const editableStatuses = [
    EventStatus.DRAFT,
    EventStatus.FACULTY_REVISION_REQUESTED,
    EventStatus.UNIVERSITY_REVISION_REQUESTED,
    EventStatus.BUDGET_REVISION_REQUESTED,
    EventStatus.FACILITY_CONFLICT,
    EventStatus.FACILITY_REVISION_REQUESTED,
  ];

  if (!editableStatuses.includes(event.status as EventStatus)) {
    throw new Error('Không thể chỉnh sửa hồ sơ ở trạng thái hiện tại');
  }

  if (event.createdById !== userId && userRole !== 'ADMIN') {
    throw new Error('Không có quyền chỉnh sửa hồ sơ này');
  }

  const startVal = data.startDate !== undefined ? data.startDate : event.startDate;
  const endVal = data.endDate !== undefined ? data.endDate : event.endDate;
  if (startVal && endVal) {
    const start = new Date(startVal as string | Date);
    const end = new Date(endVal as string | Date);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (start.getTime() === end.getTime()) {
        throw new Error('Giờ kết thúc không được trùng với giờ bắt đầu');
      }
      if (start > end) {
        throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu');
      }
    }
  }

  const fields = ['title', 'description', 'objectives', 'targetAudience', 'expectedAttendees', 'organizingUnit', 'contactPerson', 'contactEmail', 'contactPhone', 'preferredVenue', 'safetyPlan', 'planContent', 'communicationPlan'];
  const patch: Record<string, any> = {};
  for (const key of fields) if (data[key] !== undefined) patch[key] = data[key];
  for (const key of ['startDate', 'endDate', 'setupTime', 'teardownTime']) {
    if (data[key] !== undefined) patch[key] = data[key] ? new Date(data[key] as string) : null;
  }
  await prisma.$transaction(async tx => {
    const changed = await tx.event.updateMany({ where: { id, currentVersion: Number(data.expectedVersion ?? event.currentVersion), status: event.status }, data: { ...patch, currentVersion: { increment: 1 } } });
    if (!changed.count) throw new Error('Hồ sơ đã được máy khác cập nhật. Tải lại trang trước khi sửa tiếp.');
    if (Array.isArray(data.budgetItems)) {
      await tx.budgetItem.deleteMany({ where: { eventId: id } });
      await tx.budgetItem.createMany({ data: data.budgetItems.map((i: any) => ({ eventId: id, category: i.category, itemName: i.itemName, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.quantity * i.unitPrice, notes: i.notes })) });
    }
    if (Array.isArray(data.scheduleItems)) {
      await tx.eventScheduleItem.deleteMany({ where: { eventId: id } });
      await tx.eventScheduleItem.createMany({ data: data.scheduleItems.map((i: any, index: number) => ({ eventId: id, timeSlot: i.timeSlot, activity: i.activity, responsible: i.responsible, notes: i.notes, sortOrder: index })) });
    }
    const user = await tx.user.findUnique({ where: { id: userId } });
    await tx.workflowHistory.create({ data: { eventId: id, fromStatus: event.status, toStatus: event.status, action: 'UPDATE', actorId: userId, actorName: user?.fullName, actorRole: user?.role, comments: String(data.changeNote || 'Cập nhật hồ sơ') } });
  });
  return getEventById(id);
}

export async function submitEvent(id: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { budgetItems: true },
  });

  if (!event || event.deletedAt) throw new Error('Không tìm thấy hồ sơ');
  // BTC or ADMIN can submit

  const submittableStatuses = [
    EventStatus.DRAFT,
    EventStatus.FACULTY_REVISION_REQUESTED,
    EventStatus.UNIVERSITY_REVISION_REQUESTED,
    EventStatus.BUDGET_REVISION_REQUESTED,
  ];

  if (!submittableStatuses.includes(event.status as EventStatus)) {
    throw new Error('Không thể nộp hồ sơ ở trạng thái hiện tại');
  }

  // Validate required fields
  const errors: string[] = [];
  if (!event.title) errors.push('Tên sự kiện là bắt buộc');
  if (!event.organizingUnit) errors.push('Đơn vị tổ chức là bắt buộc');
  if (!event.startDate) errors.push('Ngày bắt đầu là bắt buộc');
  if (!event.endDate) errors.push('Ngày kết thúc là bắt buộc');
  if (!event.expectedAttendees) errors.push('Số lượng người tham dự là bắt buộc');
  if (!event.objectives) errors.push('Mục tiêu sự kiện là bắt buộc');

  if (errors.length > 0) {
    throw new Error(`Hồ sơ chưa đầy đủ: ${errors.join(', ')}`);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.event.updateMany({ where: { id, status: event.status, currentVersion: event.currentVersion }, data: { status: EventStatus.FACULTY_REVIEW, currentVersion: { increment: 1 } } });
    if (!changed.count) throw new Error('Hồ sơ đã thay đổi trên máy khác');
    const updated = await tx.event.findUniqueOrThrow({ where: { id } });

    await tx.workflowHistory.create({
      data: {
        eventId: id,
        fromStatus: event.status,
        toStatus: EventStatus.FACULTY_REVIEW,
        action: 'SUBMIT',
        actorId: userId,
        actorName: user?.fullName,
        actorRole: user?.role,
        comments: 'Nộp hồ sơ xét duyệt',
      },
    });

    // Notify BCN_KHOA users
    const bcnUsers = await tx.user.findMany({
      where: { role: UserRole.BCN_KHOA, isActive: true },
    });
    for (const u of bcnUsers) {
      await tx.notification.create({
        data: {
          userId: u.id,
          eventId: id,
          title: 'Hồ sơ mới cần xét duyệt',
          content: `Hồ sơ "${event.title}" (${event.eventCode}) đã được nộp và cần xét duyệt.`,
          type: 'ACTION_REQUIRED',
          category: 'APPROVAL',
          linkUrl: `/events/${id}`,
        },
      });
    }

    // Notify BTC
    await tx.notification.create({
      data: {
        userId: userId,
        eventId: id,
        title: 'Hồ sơ đã được nộp',
        content: `Hồ sơ "${event.title}" (${event.eventCode}) đã được nộp thành công.`,
        type: 'SUCCESS',
        category: 'APPROVAL',
        linkUrl: `/events/${id}`,
      },
    });

    return updated;
  });

  return result;
}

export async function getEventHistory(id: string) {
  return prisma.workflowHistory.findMany({
    where: { eventId: id },
    orderBy: { createdAt: 'desc' },
  });
}
