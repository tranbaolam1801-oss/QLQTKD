/**
 * EventFlow API Client
 * Connects frontend to the Express + Prisma REST API
 */

const BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const API_FIELD_LABELS: Record<string, string> = {
  title: 'Tên sự kiện',
  objectives: 'Mục tiêu sự kiện',
  organizingUnit: 'Đơn vị tổ chức',
  expectedAttendees: 'Số người tham dự',
  startDate: 'Thời gian bắt đầu',
  endDate: 'Thời gian kết thúc',
  scheduleItems: 'Kịch bản chương trình',
  budgetItems: 'Dự trù kinh phí',
  'booking.facilityId': 'Địa điểm tổ chức',
  booking: 'Địa điểm tổ chức',
  'booking.equipmentItems': 'Thiết bị đăng ký',
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('eventflow_token') || sessionStorage.getItem('eventflow_token');
}

export function setAuthToken(token: string, remember = true): void {
  if (remember) {
    localStorage.setItem('eventflow_token', token);
    sessionStorage.removeItem('eventflow_token');
  } else {
    sessionStorage.setItem('eventflow_token', token);
    localStorage.removeItem('eventflow_token');
  }
}

export function removeAuthToken(): void {
  localStorage.removeItem('eventflow_token');
  sessionStorage.removeItem('eventflow_token');
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(15000),
  });

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  }
  const data = await response.json();

  if (!response.ok) {
    const issues = Array.isArray(data.data) ? data.data : [];
    const fieldErrors: Record<string, string> = {};
    for (const issue of issues) {
      if (typeof issue.field !== 'string') continue;
      const field = issue.field;
      const label = API_FIELD_LABELS[field] || API_FIELD_LABELS[field.replace(/\.\d+\./g, '.')] || field;
      const message = typeof issue.message === 'string' && !/^Invalid (input|datetime|enum)/.test(issue.message)
        ? issue.message
        : `Vui lòng kiểm tra ${label.toLowerCase()}`;
      fieldErrors[field] = message;
    }
    const issueMessages = Object.values(fieldErrors);
    throw new ApiRequestError(
      issueMessages.length ? issueMessages.join('; ') : data.error || data.message || 'Yêu cầu API thất bại',
      response.status,
      fieldErrors
    );
  }

  return data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ success: boolean; data: { token: string; user: any } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { fullName: string; email: string; password: string; confirmPassword: string; phone?: string; department?: string }) =>
    request<{ success: boolean; message: string; data: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyOtp: (email: string, otp: string) =>
    request<{ success: boolean; resetSessionToken: string; email: string; message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),
  verifyResetToken: (token: string) =>
    request<{ success: boolean; email: string }>('/auth/verify-reset-token?token=' + encodeURIComponent(token)),
  resetPassword: (data: { token: string; newPassword: string; confirmPassword: string }) =>
    request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  googleAuth: (credential: string) =>
    request<{ success: boolean; data?: any; error?: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
  sendOtp: (phone: string) =>
    request<{ success: boolean; message?: string; error?: string }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  getMe: () => request<{ success: boolean; data: any }>('/auth/me'),

  // Events
  getEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ success: boolean; events: any[]; pagination: { totalPages: number } }>(`/events${qs}`);
  },
  getEventById: (id: string) => request<{ success: boolean; data: any }>(`/events/${id}`),
  createEvent: (data: any, idempotencyKey?: string) =>
    request<{ success: boolean; data: any }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  updateEvent: (id: string, data: any) =>
    request<{ success: boolean; data: any }>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  submitEvent: (id: string) =>
    request<{ success: boolean; data: any; message: string }>(`/events/${id}/submit`, {
      method: 'POST',
    }),
  reviewEvent: (id: string, action: string, comments?: string, reason?: string) =>
    request<{ success: boolean; data: any; message: string }>(`/events/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, comments, reason }),
    }),
  getAvailableActions: (id: string) =>
    request<{ success: boolean; data: string[] }>(`/events/${id}/available-actions`),
  getEventHistory: (id: string) =>
    request<{ success: boolean; data: any[] }>(`/events/${id}/history`),

  // Bookings & Resources
  checkConflict: (facilityId: string, startTime: string, endTime: string, excludeBookingId?: string) =>
    request<{ success: boolean; conflict: boolean; conflictingBookings: any[] }>('/bookings/check-conflict', {
      method: 'POST',
      body: JSON.stringify({ facilityId, startTime, endTime, excludeBookingId }),
    }),
  createBooking: (data: any) =>
    request<{ success: boolean; data: any }>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  confirmBooking: (id: string) =>
    request<{ success: boolean; data: any; message: string }>(`/bookings/${id}/confirm`, {
      method: 'PUT',
    }),
  rejectBooking: (id: string) =>
    request<{ success: boolean; data: any; message: string }>(`/bookings/${id}/reject`, {
      method: 'PUT',
    }),
  getFacilityCalendar: (facilityId: string, startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams({ ...(startDate && { startDate }), ...(endDate && { endDate }) }).toString();
    return request<{ success: boolean; data: any[] }>(`/bookings/facilities/${facilityId}/calendar?${qs}`);
  },

  // AI Assistant
  aiReview: (eventId: string) =>
    request<{ success: boolean; data: any }>('/ai/review', {
      method: 'POST',
      body: JSON.stringify({ eventId }),
    }),
  analyzeEvent: (eventData: any) =>
    request<{ success: boolean; data: any }>('/ai/analyze-event', {
      method: 'POST',
      body: JSON.stringify(eventData),
    }),
  suggestResources: (expectedAttendees: number, eventType: string) =>
    request<{ success: boolean; data: any }>('/ai/suggest-resources', {
      method: 'POST',
      body: JSON.stringify({ expectedAttendees, eventType }),
    }),
  draftReport: (eventId: string, actualAttendees?: number, highlights?: string[]) =>
    request<{ success: boolean; data: any }>('/ai/draft-report', {
      method: 'POST',
      body: JSON.stringify({ eventId, actualAttendees, highlights }),
    }),

  // Handover & Return
  createHandover: (data: any) =>
    request<{ success: boolean; data: any; message: string }>('/handover', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createInspection: (data: any) =>
    request<{ success: boolean; data: any; message: string }>('/handover/inspection', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createIncident: (data: any) =>
    request<{ success: boolean; data: any; message: string }>('/handover/incident', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getHandoverRecords: (eventId: string) =>
    request<{ success: boolean; data: { handovers: any[]; inspections: any[]; incidents: any[] } }>(`/handover/${eventId}`),

  // Settlement & Finance
  getSettlement: (eventId: string) =>
    request<{ success: boolean; data: any }>(`/settlements/${eventId}`),
  createSettlement: (data: any) =>
    request<{ success: boolean; data: any }>('/settlements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitSettlement: (id: string) =>
    request<{ success: boolean; data: any; message: string }>(`/settlements/${id}/submit`, {
      method: 'POST',
    }),
  reviewSettlement: (id: string, decision: 'APPROVED' | 'REJECTED' | 'REQUEST_AMENDMENT', notes?: string) =>
    request<{ success: boolean; data: any; message: string }>(`/settlements/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    }),

  // Analytics
  getDashboardStats: () =>
    request<{ success: boolean; data: any }>('/analytics/dashboard'),
  getWorkflowBottlenecks: () =>
    request<{ success: boolean; data: any }>('/analytics/workflow-bottlenecks'),
  // Attachments
  uploadAttachment: async (eventId: string, file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${BASE_URL}/events/${eventId}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Tải lên tài liệu thất bại');
    }
    return data;
  },
  downloadAttachment: async (eventId: string, attachmentId: string, name: string) => {
    const response = await fetch(`${BASE_URL}/events/${eventId}/attachments/${attachmentId}/download`, {
      headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
    });
    if (!response.ok) throw new Error('Không tải được tệp đính kèm');
    if (response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.json();
      window.location.assign(result.url);
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  getAttachmentDownloadUrl: (eventId: string, attachmentId: string) =>
    `${BASE_URL}/events/${eventId}/attachments/${attachmentId}/download`,

  // Users
  getUsers: () => request<{ success: boolean; data: any[] }>('/users'),
  createUser: (userData: any) => request<{ success: boolean; data: any }>('/users', { method: 'POST', body: JSON.stringify(userData) }),
  updateUser: (id: string, userData: any) => request<{ success: boolean; data: any }>('/users/' + id, { method: 'PUT', body: JSON.stringify(userData) }),
  lockUser: (id: string, reason?: string) =>
    request<{ success: boolean; message: string; data: any }>(`/users/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  unlockUser: (id: string) =>
    request<{ success: boolean; message: string; data: any }>(`/users/${id}/unlock`, {
      method: 'POST',
    }),
};
