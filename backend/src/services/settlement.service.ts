import prisma from '../config/database';

export async function createSettlement(data: {
  eventId: string;
  items: Array<{
    itemName: string;
    category?: string;
    budgetedAmount: number;
    actualAmount: number;
    notes?: string;
  }>;
}, userId: string) {
  const existing = await prisma.settlement.findFirst({ where: { eventId: data.eventId } });
  if (existing) {
    throw new Error('Hồ sơ quyết toán cho sự kiện này đã được tạo');
  }

  const totalBudgeted = data.items.reduce((s, i) => s + (i.budgetedAmount || 0), 0);
  const totalActual = data.items.reduce((s, i) => s + (i.actualAmount || 0), 0);
  const difference = totalActual - totalBudgeted;

  return prisma.settlement.create({
    data: {
      eventId: data.eventId,
      totalBudgeted,
      totalActual,
      difference,
      status: 'DRAFT',
      submittedById: userId,
      items: {
        create: data.items.map((item) => ({
          itemName: item.itemName,
          category: item.category,
          budgetedAmount: item.budgetedAmount,
          actualAmount: item.actualAmount,
          difference: item.actualAmount - item.budgetedAmount,
          notes: item.notes,
        })),
      },
    },
    include: { items: true, documents: true },
  });
}

export async function updateSettlement(id: string, data: {
  items?: Array<{
    itemName: string;
    category?: string;
    budgetedAmount: number;
    actualAmount: number;
    notes?: string;
  }>;
}) {
  const settlement = await prisma.settlement.findUnique({ where: { id }, include: { items: true } });
  if (!settlement) throw new Error('Không tìm thấy bản ghi quyết toán');
  if (settlement.status !== 'DRAFT' && settlement.status !== 'REVISION_REQUESTED') {
    throw new Error('Chỉ có thể chỉnh sửa hồ sơ quyết toán ở trạng thái Bản nháp hoặc Yêu cầu chỉnh sửa');
  }

  return prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.settlementItem.deleteMany({ where: { settlementId: id } });
      await tx.settlementItem.createMany({
        data: data.items.map((item) => ({
          settlementId: id,
          itemName: item.itemName,
          category: item.category,
          budgetedAmount: item.budgetedAmount,
          actualAmount: item.actualAmount,
          difference: item.actualAmount - item.budgetedAmount,
          notes: item.notes,
        })),
      });

      const totalBudgeted = data.items.reduce((s, i) => s + (i.budgetedAmount || 0), 0);
      const totalActual = data.items.reduce((s, i) => s + (i.actualAmount || 0), 0);
      const difference = totalActual - totalBudgeted;

      return tx.settlement.update({
        where: { id },
        data: { totalBudgeted, totalActual, difference },
        include: { items: true, documents: true },
      });
    }

    return tx.settlement.findUnique({ where: { id }, include: { items: true, documents: true } });
  });
}

export async function submitSettlement(id: string, userId: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: { items: true, documents: true, event: true },
  });
  if (!settlement) throw new Error('Không tìm thấy quyết toán');
  if (settlement.items.length === 0) throw new Error('Cần ít nhất một khoản mục chi');
  if (settlement.documents.length === 0) throw new Error('Cần đính kèm ít nhất một chứng từ tài chính');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlement.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedById: userId,
      },
    });

    await tx.event.update({
      where: { id: settlement.eventId },
      data: {
        status: 'FINANCE_REVIEW',
        settlementStatus: 'SUBMITTED',
      },
    });

    await tx.workflowHistory.create({
      data: {
        eventId: settlement.eventId,
        fromStatus: settlement.event.status,
        toStatus: 'FINANCE_REVIEW',
        action: 'SUBMIT_DOCUMENTS',
        actorId: userId,
        actorRole: 'BTC',
        comments: 'Nộp bộ chứng từ và quyết toán tài chính',
      },
    });

    return updated;
  });
}

export async function reviewSettlement(id: string, decision: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED', notes: string, userId: string) {
  const settlement = await prisma.settlement.findUnique({ where: { id }, include: { event: true } });
  if (!settlement) throw new Error('Không tìm thấy quyết toán');

  const newStatus = decision === 'APPROVED' ? 'APPROVED' : decision === 'REVISION_REQUESTED' ? 'REVISION_REQUESTED' : 'REJECTED';
  const newEventStatus = decision === 'APPROVED' ? 'FINANCE_APPROVAL_PENDING' : decision === 'REVISION_REQUESTED' ? 'FINANCE_REVISION_REQUESTED' : 'PAYMENT_REJECTED';

  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlement.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    await tx.event.update({
      where: { id: settlement.eventId },
      data: {
        status: newEventStatus,
        settlementStatus: newStatus,
      },
    });

    await tx.workflowHistory.create({
      data: {
        eventId: settlement.eventId,
        fromStatus: settlement.event.status,
        toStatus: newEventStatus,
        action: `FINANCE_${decision}`,
        actorId: userId,
        actorRole: 'KHTC',
        comments: notes,
      },
    });

    return updated;
  });
}

export async function addFinancialDocument(settlementId: string, data: {
  documentType: string;
  documentNumber?: string;
  amount?: number;
  description?: string;
  fileName?: string;
  filePath?: string;
}) {
  return prisma.financialDocument.create({
    data: {
      settlementId,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      amount: data.amount,
      description: data.description,
      fileName: data.fileName,
      filePath: data.filePath,
      isVerified: false,
    },
  });
}

export async function verifyFinancialDocument(documentId: string, isVerified: boolean) {
  return prisma.financialDocument.update({
    where: { id: documentId },
    data: {
      isVerified,
      verifiedAt: isVerified ? new Date() : null,
    },
  });
}
