interface ApprovalQueueItem {
  status: string;
}

export function filterApprovalQueueEvents<T extends ApprovalQueueItem>(
  events: readonly T[],
  role: string
): T[] {
  return events.filter((event) => {
    if (role === 'BCN_KHOA') return event.status === 'FACULTY_REVIEW';
    if (role === 'DOAN_TRUONG') {
      return ['UNIVERSITY_REVIEW', 'BUDGET_REVIEW', 'FACULTY_APPROVED'].includes(event.status);
    }
    if (role === 'CSVC') {
      return ['FACILITY_REVIEW', 'FACILITY_RETURN_PENDING', 'PERMIT_ISSUED'].includes(event.status);
    }
    if (role === 'KHTC') {
      return ['FINANCE_REVIEW', 'FINANCE_APPROVAL_PENDING'].includes(event.status);
    }
    if (role === 'BTC') {
      return event.status.includes('REVISION_REQUESTED') || event.status === 'FACILITY_CONFLICT';
    }
    return true;
  });
}
