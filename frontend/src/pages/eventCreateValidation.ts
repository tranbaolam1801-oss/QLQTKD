export interface EventFormBasics {
  title: string;
  objectives: string;
  organizingUnit: string;
  expectedAttendees: number;
  contactEmail: string;
  contactPhone: string;
  startDate: string;
  endDate: string;
}

interface ScheduleRow {
  timeSlot: string;
  activity: string;
}

interface BudgetRow {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

interface FacilityOption {
  id: string;
  name: string;
  capacity?: number | null;
}

interface EquipmentOption {
  id: string;
  name: string;
  availableQuantity: number;
}

interface SelectedEquipment {
  equipmentId: string;
  quantity: number;
}

export interface EventBookingPayload {
  facilityId: string;
  facilityName: string;
  startTime: string;
  endTime: string;
  equipmentItems: Array<{ equipmentId: string; equipmentName: string; quantity: number }>;
}

export type EventFormErrors = Record<string, string>;

export function buildEventBookingPayload(
  facilityId: string,
  facilities: FacilityOption[],
  startTime: string | undefined,
  endTime: string | undefined,
  selectedEquipment: SelectedEquipment[],
  equipment: EquipmentOption[]
): EventBookingPayload | null {
  const facility = facilities.find((item) => item.id === facilityId);
  if (!facility || !startTime || !endTime) return null;

  const equipmentItems = selectedEquipment.flatMap((selection) => {
    const item = equipment.find((candidate) => candidate.id === selection.equipmentId);
    if (!item || !selection.equipmentId.trim() || !Number.isInteger(selection.quantity) || selection.quantity <= 0) {
      return [];
    }
    return [{
      equipmentId: item.id,
      equipmentName: item.name,
      quantity: selection.quantity,
    }];
  });

  return {
    facilityId: facility.id,
    facilityName: facility.name,
    startTime,
    endTime,
    equipmentItems,
  };
}

export function validateDraftBasics(form: Pick<EventFormBasics, 'title' | 'organizingUnit'>): EventFormErrors {
  const errors: EventFormErrors = {};
  if (!form.title.trim()) errors.title = 'Vui lòng nhập tên sự kiện để lưu bản nháp';
  if (!form.organizingUnit.trim()) errors.organizingUnit = 'Vui lòng nhập đơn vị tổ chức';
  return errors;
}

export function validateEventBasics(form: EventFormBasics, now = new Date()): EventFormErrors {
  const errors: EventFormErrors = {};

  if (!form.title.trim()) errors.title = 'Vui lòng nhập tên sự kiện';
  else if (form.title.trim().length < 5) errors.title = 'Tên sự kiện cần có ít nhất 5 ký tự';

  if (!form.objectives.trim()) errors.objectives = 'Vui lòng nhập mục tiêu sự kiện';
  else if (form.objectives.trim().length < 10) errors.objectives = 'Mục tiêu cần cụ thể hơn (tối thiểu 10 ký tự)';

  if (!form.organizingUnit.trim()) errors.organizingUnit = 'Vui lòng nhập đơn vị tổ chức';

  const attendees = Number(form.expectedAttendees);
  if (!Number.isInteger(attendees) || attendees <= 0) {
    errors.expectedAttendees = 'Vui lòng nhập số người tham dự (lớn hơn 0)';
  }

  if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
    errors.contactEmail = 'Email liên hệ không hợp lệ';
  }

  if (form.contactPhone && !/^[0-9+\s-]{9,15}$/.test(form.contactPhone.trim())) {
    errors.contactPhone = 'Số điện thoại không hợp lệ (cần từ 9 đến 15 chữ số)';
  }

  const start = parseDate(form.startDate);
  const end = parseDate(form.endDate);
  if (!start) errors.startDate = 'Vui lòng chọn thời gian bắt đầu';
  else if (start < now) errors.startDate = 'Thời gian bắt đầu không được ở trong quá khứ';

  if (!end) errors.endDate = 'Vui lòng chọn thời gian kết thúc';
  else if (end < now) errors.endDate = 'Thời gian kết thúc không được ở trong quá khứ';
  else if (start && end.getTime() === start.getTime()) errors.endDate = 'Giờ kết thúc không được trùng với giờ bắt đầu';
  else if (start && end < start) errors.endDate = 'Thời gian kết thúc phải sau thời gian bắt đầu';

  return errors;
}

export function validateScheduleItems(items: ScheduleRow[]): EventFormErrors {
  if (items.length === 0) {
    return { schedule: 'Vui lòng thêm ít nhất một tiết mục hoặc nội dung trong kịch bản' };
  }
  if (items.some((item) => !item.timeSlot.trim() || !item.activity.trim())) {
    return { schedule: 'Vui lòng điền đầy đủ khung giờ và nội dung cho tất cả các tiết mục' };
  }
  return {};
}

export function validateBudgetItems(items: BudgetRow[]): EventFormErrors {
  const invalid = items.some((item) =>
    !item.itemName.trim() || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 ||
    !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0
  );
  return invalid
    ? { budget: 'Các khoản chi cần có tên rõ ràng, số lượng lớn hơn 0 và đơn giá là số không âm (VNĐ)' }
    : {};
}

export function validateResources(
  facilityId: string,
  facilities: FacilityOption[],
  expectedAttendees: number,
  selectedEquipment: SelectedEquipment[],
  equipment: EquipmentOption[],
  requireFacility: boolean
): EventFormErrors {
  const errors: EventFormErrors = {};
  const selectedFacility = facilities.find((facility) => facility.id === facilityId);
  if (requireFacility && !selectedFacility) {
    errors.facility = 'Vui lòng chọn địa điểm tổ chức';
  } else if (selectedFacility?.capacity && expectedAttendees > selectedFacility.capacity) {
    errors.facility = `Số người dự kiến (${expectedAttendees}) vượt quá sức chứa của ${selectedFacility.name} (${selectedFacility.capacity} chỗ)`;
  }

  for (const selection of selectedEquipment) {
    const item = equipment.find((candidate) => candidate.id === selection.equipmentId);
    if (!item) {
      errors.equipment = 'Thiết bị đã chọn không còn khả dụng. Vui lòng kiểm tra lại danh sách thiết bị.';
      break;
    }
    if (selection.quantity <= 0) {
      errors.equipment = `Số lượng thiết bị "${item.name}" phải lớn hơn 0`;
      break;
    }
    if (selection.quantity > item.availableQuantity) {
      errors.equipment = `Thiết bị "${item.name}" chỉ còn khả dụng ${item.availableQuantity} cái`;
      break;
    }
  }
  return errors;
}

function parseDate(value: string): Date | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
