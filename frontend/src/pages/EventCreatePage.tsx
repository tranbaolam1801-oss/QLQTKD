import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Building,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
  Send,
  Save,
  DollarSign,
  Clock,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useEvents } from '../contexts/EventContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/helpers';
import { BudgetItem, ScheduleItem, ResourceBookingItem } from '../types';

// Hàm lấy ngày mai làm mốc mặc định an toàn trong tương lai
function getDefaultDateTimeRange() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(17, 0, 0, 0);

  const pad = (n: number) => String(n).padStart(2, '0');
  const toInputVal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const now = new Date();
  const minVal = toInputVal(now);

  return {
    defaultStart: toInputVal(tomorrow),
    defaultEnd: toInputVal(tomorrowEnd),
    minDateTime: minVal,
  };
}

function isValidDateTimeString(val?: string): boolean {
  if (!val || typeof val !== 'string' || !val.trim()) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

export const EventCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { createEvent, transitionEvent, saving, facilities, equipment, checkFacilityAvailability } = useEvents();
  const { currentUser } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [dateDefaults] = useState(getDefaultDateTimeRange);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    objectives: '',
    targetAudience: 'Sinh viên toàn trường',
    expectedAttendees: 150,
    organizingUnit: currentUser.department || 'CLB Sinh viên',
    contactPerson: currentUser.fullName,
    contactEmail: currentUser.email,
    contactPhone: currentUser.phone || '',
    startDate: dateDefaults.defaultStart,
    endDate: dateDefaults.defaultEnd,
    preferredVenue: facilities[0]?.name || '',
    facilityId: facilities[0]?.id || '',
  });

  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([
    { id: '1', timeSlot: '08:00 - 08:30', activity: 'Đón tiếp đại biểu và sinh viên', responsible: 'Ban Lễ tân' },
    { id: '2', timeSlot: '08:30 - 11:30', activity: 'Nội dung chính của chương trình', responsible: 'Ban Tổ chức' },
  ]);

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([
    { id: '1', category: 'In ấn', itemName: 'Backdrop sân khấu và Standee', quantity: 1, unitPrice: 2000000, totalPrice: 2000000 },
    { id: '2', category: 'Nước uống', itemName: 'Nước suối và trà bánh đại biểu', quantity: 1, unitPrice: 1200000, totalPrice: 1200000 },
  ]);

  const [selectedEquipment, setSelectedEquipment] = useState<{ equipmentId: string; quantity: number }[]>([
    { equipmentId: equipment[0]?.id || '', quantity: 2 },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic calculations - an toàn không bao giờ NaN
  const totalBudget = (budgetItems || []).reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);

  // Facility availability check - bọc an toàn tuyệt đối, xóa ô thời gian không bị trắng màn hình
  const availabilityCheck = React.useMemo(() => {
    if (!formData.facilityId || !isValidDateTimeString(formData.startDate) || !isValidDateTimeString(formData.endDate)) {
      return { isAvailable: true, conflictEvent: undefined };
    }
    try {
      return checkFacilityAvailability(
        formData.facilityId,
        new Date(formData.startDate).toISOString(),
        new Date(formData.endDate).toISOString()
      );
    } catch {
      return { isAvailable: true, conflictEvent: undefined };
    }
  }, [formData.facilityId, formData.startDate, formData.endDate, checkFacilityAvailability]);

  const validateStep1 = () => {
    const err: Record<string, string> = {};

    if (!formData.title.trim()) {
      err.title = 'Vui lòng nhập tên sự kiện';
    } else if (formData.title.trim().length < 5) {
      err.title = 'Tên sự kiện cần có ít nhất 5 ký tự';
    }

    if (!formData.objectives.trim()) {
      err.objectives = 'Vui lòng nhập mục tiêu sự kiện';
    } else if (formData.objectives.trim().length < 10) {
      err.objectives = 'Mục tiêu cần cụ thể hơn (tối thiểu 10 ký tự)';
    }

    if (!formData.organizingUnit.trim()) {
      err.organizingUnit = 'Vui lòng nhập đơn vị tổ chức';
    }

    const attendees = Number(formData.expectedAttendees);
    if (!attendees || attendees <= 0) {
      err.expectedAttendees = 'Vui lòng nhập số người tham dự (lớn hơn 0)';
    }

    if (formData.contactEmail && !/^[^s@]+@[^s@]+\.[^s@]+$/.test(formData.contactEmail.trim())) {
      err.contactEmail = 'Email liên hệ không hợp lệ';
    }

    if (formData.contactPhone && !/^[0-9+\s-]{9,15}$/.test(formData.contactPhone.trim())) {
      err.contactPhone = 'Số điện thoại không hợp lệ (cần từ 9 đến 15 chữ số)';
    }

    const now = new Date();
    // Giảm 2 phút để trừ hao độ trễ nhập liệu
    now.setMinutes(now.getMinutes() - 2);

    if (!formData.startDate || !isValidDateTimeString(formData.startDate)) {
      err.startDate = 'Vui lòng chọn thời gian bắt đầu';
    } else if (new Date(formData.startDate) < now) {
      err.startDate = 'Thời gian bắt đầu không được ở trong quá khứ';
    }

    if (!formData.endDate || !isValidDateTimeString(formData.endDate)) {
      err.endDate = 'Vui lòng chọn thời gian kết thúc';
    } else if (new Date(formData.endDate) < now) {
      err.endDate = 'Thời gian kết thúc không được ở trong quá khứ';
    } else if (formData.startDate && isValidDateTimeString(formData.startDate)) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start.getTime() === end.getTime()) {
        err.endDate = 'Giờ kết thúc không được trùng với giờ bắt đầu';
      } else if (end < start) {
        err.endDate = 'Thời gian kết thúc phải sau thời gian bắt đầu';
      }
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const validateStep2 = () => {
    const err: Record<string, string> = {};
    if (!scheduleItems || scheduleItems.length === 0) {
      err.schedule = 'Vui lòng thêm ít nhất một tiết mục hoặc nội dung trong kịch bản';
    } else {
      const hasEmpty = scheduleItems.some((s) => !s.timeSlot.trim() || !s.activity.trim());
      if (hasEmpty) {
        err.schedule = 'Vui lòng điền đầy đủ khung giờ và nội dung cho tất cả các tiết mục';
      }
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const validateStep3 = () => {
    const err: Record<string, string> = {};
    if (budgetItems && budgetItems.length > 0) {
      const invalidItem = budgetItems.some(
        (b) => !b.itemName.trim() || isNaN(Number(b.quantity)) || Number(b.quantity) <= 0 || isNaN(Number(b.unitPrice)) || Number(b.unitPrice) < 0
      );
      if (invalidItem) {
        err.budget = 'Các khoản chi cần có tên rõ ràng, số lượng lớn hơn 0 và đơn giá là số không âm (VNĐ)';
      }
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const validateStep4 = () => {
    const err: Record<string, string> = {};
    const selectedFacility = facilities.find((f) => f.id === formData.facilityId);
    const attendees = Number(formData.expectedAttendees) || 0;

    if (selectedFacility && selectedFacility.capacity && attendees > selectedFacility.capacity) {
      err.facility = `Số người dự kiến (${attendees}) vượt quá sức chứa của ${selectedFacility.name} (${selectedFacility.capacity} chỗ)`;
    }

    for (const se of selectedEquipment) {
      const eq = equipment.find((e) => e.id === se.equipmentId);
      if (eq) {
        if (se.quantity <= 0) {
          err.equipment = `Số lượng thiết bị "${eq.name}" phải lớn hơn 0`;
          break;
        }
        if (se.quantity > eq.availableQuantity) {
          err.equipment = `Thiết bị "${eq.name}" chỉ còn khả dụng ${eq.availableQuantity} cái`;
          break;
        }
      }
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    if (step === 4 && !validateStep4()) return;
    setErrors({});
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  // Schedule row actions
  const addScheduleRow = () => {
    setScheduleItems([
      ...scheduleItems,
      { id: Date.now().toString(), timeSlot: '', activity: '', responsible: '' },
    ]);
  };
  const removeScheduleRow = (index: number) => {
    setScheduleItems(scheduleItems.filter((_, i) => i !== index));
  };
  const updateScheduleRow = (index: number, field: keyof ScheduleItem, val: string) => {
    const copy = [...scheduleItems];
    copy[index] = { ...copy[index], [field]: val };
    setScheduleItems(copy);
  };

  // Budget row actions
  const addBudgetRow = () => {
    setBudgetItems([
      ...budgetItems,
      { id: Date.now().toString(), category: 'Chi phí khác', itemName: '', quantity: 1, unitPrice: 0, totalPrice: 0 },
    ]);
  };
  const removeBudgetRow = (index: number) => {
    setBudgetItems(budgetItems.filter((_, i) => i !== index));
  };
  const updateBudgetRow = (index: number, field: keyof BudgetItem, val: any) => {
    const copy = [...budgetItems];
    const item = { ...copy[index], [field]: val };
    const qty = field === 'quantity' ? (Number(val) || 0) : (Number(item.quantity) || 0);
    const price = field === 'unitPrice' ? (Number(val) || 0) : (Number(item.unitPrice) || 0);
    item.totalPrice = Math.max(0, qty) * Math.max(0, price);
    copy[index] = item;
    setBudgetItems(copy);
  };

  // Submit / Save
  const handleSave = async (isSubmit: boolean) => {
    if (saving) return;
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!validateStep3()) {
      setStep(3);
      return;
    }
    if (!validateStep4()) {
      setStep(4);
      return;
    }

    const bookingEquipment: ResourceBookingItem[] = selectedEquipment.map((se) => {
      const eq = equipment.find((e) => e.id === se.equipmentId);
      return {
        equipmentId: se.equipmentId,
        equipmentName: eq ? eq.name : 'Thiết bị',
        quantity: Math.max(1, Number(se.quantity) || 1),
      };
    });

    const facility = facilities.find((f) => f.id === formData.facilityId);

    const newEv = await createEvent({
      title: formData.title.trim(),
      description: formData.description.trim(),
      objectives: formData.objectives.trim(),
      targetAudience: formData.targetAudience.trim(),
      expectedAttendees: Math.max(1, Number(formData.expectedAttendees) || 1),
      organizingUnit: formData.organizingUnit.trim(),
      contactPerson: formData.contactPerson.trim(),
      contactEmail: formData.contactEmail.trim(),
      contactPhone: formData.contactPhone.trim(),
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      preferredVenue: facility?.name || formData.preferredVenue,
      scheduleItems,
      budgetItems,
      booking: {
        id: `bk-${Date.now()}`,
        facilityId: formData.facilityId,
        facilityName: facility?.name || formData.preferredVenue,
        startTime: new Date(formData.startDate).toISOString(),
        endTime: new Date(formData.endDate).toISOString(),
        status: availabilityCheck.isAvailable ? 'PENDING' : 'CONFLICT',
        conflictDetails: !availabilityCheck.isAvailable
          ? `Trùng lịch với hồ sơ ${availabilityCheck.conflictEvent?.eventCode}`
          : undefined,
        equipmentItems: bookingEquipment,
      },
    });

    if (!newEv) return;
    if (isSubmit) await transitionEvent(newEv.id, 'Nộp hồ sơ', 'FACULTY_REVIEW');
    navigate(`/events/${newEv.id}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tạo hồ sơ sự kiện mới</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quy trình chuẩn hóa 5 bước lập kế hoạch, dự toán ngân sách và mượn cơ sở vật chất
        </p>
      </div>

      {/* Steps Indicator */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto">
        <div className="flex items-center justify-between text-xs font-semibold">
          {[
            { id: 1, label: 'Thông tin chung', icon: FileText },
            { id: 2, label: 'Kịch bản', icon: Clock },
            { id: 3, label: 'Dự trù kinh phí', icon: DollarSign },
            { id: 4, label: 'Cơ sở vật chất', icon: Building },
            { id: 5, label: 'Xác nhận và Nộp', icon: Check },
          ].map((s) => {
            const Icon = s.icon;
            const isCurrent = step === s.id;
            const isPast = step > s.id;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 ${
                  isCurrent
                    ? 'text-blue-600 font-bold'
                    : isPast
                    ? 'text-emerald-600'
                    : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border ${
                    isCurrent
                      ? 'bg-blue-50 border-blue-600 text-blue-600'
                      : isPast
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Contents */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-4 sm:space-y-5">
        {/* Step 1: General Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">Bước 1: Thông tin cơ bản về sự kiện</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên sự kiện <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Ngày hội Sinh viên Khởi nghiệp DUE Startup Day"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
              />
              {errors.title && <p className="text-[11px] text-rose-500 mt-1">{errors.title}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Đơn vị tổ chức <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.organizingUnit}
                  onChange={(e) => setFormData({ ...formData, organizingUnit: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
                {errors.organizingUnit && <p className="text-[11px] text-rose-500 mt-1">{errors.organizingUnit}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số lượng người tham dự dự kiến <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.expectedAttendees || ''}
                  onChange={(e) => setFormData({ ...formData, expectedAttendees: Math.max(0, Number(e.target.value)) })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
                {errors.expectedAttendees && <p className="text-[11px] text-rose-500 mt-1">{errors.expectedAttendees}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mục tiêu sự kiện <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Nêu rõ mục tiêu chính trị, học thuật, văn hóa phong trào hoặc giá trị mang lại cho sinh viên..."
                value={formData.objectives}
                onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
              />
              {errors.objectives && <p className="text-[11px] text-rose-500 mt-1">{errors.objectives}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thời gian bắt đầu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  min={dateDefaults.minDateTime}
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
                {errors.startDate && <p className="text-[11px] text-rose-500 mt-1">{errors.startDate}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thời gian kết thúc <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  min={formData.startDate || dateDefaults.minDateTime}
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
                {errors.endDate && <p className="text-[11px] text-rose-500 mt-1">{errors.endDate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email liên hệ</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
                {errors.contactEmail && <p className="text-[11px] text-rose-500 mt-1">{errors.contactEmail}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại liên hệ</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
                {errors.contactPhone && <p className="text-[11px] text-rose-500 mt-1">{errors.contactPhone}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Schedule Agenda */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-sm font-bold text-slate-800">Bước 2: Kịch bản chương trình theo khung giờ</h2>
              <button
                type="button"
                onClick={addScheduleRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm tiết mục
              </button>
            </div>

            {errors.schedule && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errors.schedule}
              </div>
            )}

            {scheduleItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                Chưa có tiết mục nào. Bấm "Thêm tiết mục" để lập kịch bản.
              </div>
            ) : (
              <div className="space-y-3">
                {scheduleItems.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}</span>
                    <input
                      type="text"
                      placeholder="Khung giờ (VD: 08:00 - 08:30)"
                      value={s.timeSlot}
                      onChange={(e) => updateScheduleRow(idx, 'timeSlot', e.target.value)}
                      className="w-48 text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Nội dung hoạt động"
                      value={s.activity}
                      onChange={(e) => updateScheduleRow(idx, 'activity', e.target.value)}
                      className="flex-1 text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Phụ trách"
                      value={s.responsible || ''}
                      onChange={(e) => updateScheduleRow(idx, 'responsible', e.target.value)}
                      className="w-36 text-xs p-2 rounded-lg border border-slate-200 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeScheduleRow(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg cursor-pointer"
                      title="Xóa dòng"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Budget Table */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Bước 3: Dự trù kinh phí chi tiết</h2>
                <p className="text-xs text-slate-500">Tự động tính thành tiền và kiểm tra định mức</p>
              </div>
              <button
                type="button"
                onClick={addBudgetRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm khoản chi
              </button>
            </div>

            {errors.budget && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errors.budget}
              </div>
            )}

            {budgetItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                Sự kiện chưa có khoản chi nào. Bấm "Thêm khoản chi" nếu có phát sinh chi phí.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Danh mục</th>
                      <th className="py-2.5 px-3">Khoản mục chi</th>
                      <th className="py-2.5 px-3 w-20 text-center">SL</th>
                      <th className="py-2.5 px-3 w-32 text-right">Đơn giá (VNĐ)</th>
                      <th className="py-2.5 px-3 w-32 text-right">Thành tiền</th>
                      <th className="py-2.5 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {budgetItems.map((b, idx) => (
                      <tr key={b.id}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={b.category}
                            onChange={(e) => updateBudgetRow(idx, 'category', e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded-md"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={b.itemName}
                            placeholder="Tên khoản chi..."
                            onChange={(e) => updateBudgetRow(idx, 'itemName', e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded-md"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="1"
                            value={b.quantity || ''}
                            onKeyDown={(e) => {
                              const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter'];
                              if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
                              if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                            }}
                            onPaste={(e) => {
                              const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
                              e.preventDefault();
                              updateBudgetRow(idx, 'quantity', pasted ? Math.max(1, parseInt(pasted, 10)) : 1);
                            }}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              updateBudgetRow(idx, 'quantity', digits === '' ? 0 : Math.max(0, parseInt(digits, 10)));
                            }}
                            className="w-full p-1.5 border border-slate-200 rounded-md text-center font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            value={b.unitPrice || ''}
                            onKeyDown={(e) => {
                              const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter'];
                              if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
                              // Chặn tuyệt đối mọi ký tự không phải số (bao gồm e, E, +, -, ., ký tự chữ cái)
                              if (!/^[0-9]$/.test(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            onPaste={(e) => {
                              const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
                              e.preventDefault();
                              updateBudgetRow(idx, 'unitPrice', pasted ? Math.max(0, parseInt(pasted, 10)) : 0);
                            }}
                            onChange={(e) => {
                              // Ràng buộc nghiêm ngặt: chỉ cho phép chuỗi số, loại bỏ mọi ký tự khác
                              const digits = e.target.value.replace(/\D/g, '');
                              const num = digits === '' ? 0 : Math.max(0, parseInt(digits, 10));
                              updateBudgetRow(idx, 'unitPrice', num);
                            }}
                            className="w-full p-1.5 border border-slate-200 rounded-md text-right font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(b.totalPrice || 0)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeBudgetRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Xóa khoản chi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 text-sm">
              <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-slate-800">
                Tổng dự toán: <span className="font-bold text-blue-600 text-base ml-1">{formatCurrency(totalBudget)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Facility và Equipment Booking */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">Bước 4: Mượn Địa điểm và Thiết bị</h2>

            {errors.facility && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errors.facility}
              </div>
            )}
            {errors.equipment && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errors.equipment}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lựa chọn Hội trường / Phòng mượn:
              </label>
              <select
                value={formData.facilityId}
                onChange={(e) => {
                  const fac = facilities.find((f) => f.id === e.target.value);
                  setFormData({
                    ...formData,
                    facilityId: e.target.value,
                    preferredVenue: fac ? fac.name : '',
                  });
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (Sức chứa: {f.capacity} chỗ) — {f.location}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Availability Banner */}
            {!availabilityCheck.isAvailable ? (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Địa điểm đã có sự kiện đăng ký trong khung giờ này:</div>
                  <div>
                    Trùng lịch với hồ sơ: <span className="font-bold">{availabilityCheck.conflictEvent?.eventCode}</span> (
                    {availabilityCheck.conflictEvent?.title}).
                  </div>
                  <div className="mt-1 text-[11px] text-rose-600">
                    Bạn vui lòng đổi khung giờ hoặc chọn phòng khác để hồ sơ được duyệt nhanh chóng.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Địa điểm hiện đang trống trong khung giờ bạn chọn. Sẵn sàng giữ chỗ.</span>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Đăng ký thiết bị di động kèm theo:</h3>
              <div className="space-y-2">
                {equipment.slice(0, 5).map((eq) => {
                  const currentSelected = selectedEquipment.find((se) => se.equipmentId === eq.id);
                  const isChecked = !!currentSelected;
                  return (
                    <div
                      key={eq.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                    >
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEquipment([...selectedEquipment, { equipmentId: eq.id, quantity: 1 }]);
                            } else {
                              setSelectedEquipment(selectedEquipment.filter((se) => se.equipmentId !== eq.id));
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        <span>{eq.name} (Khả dụng: {eq.availableQuantity}/{eq.totalQuantity})</span>
                      </label>

                      {isChecked && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">Số lượng:</span>
                          <input
                            type="number"
                            min="1"
                            max={eq.availableQuantity}
                            value={currentSelected.quantity || ''}
                            onChange={(e) => {
                              const qty = Math.max(1, Math.min(eq.availableQuantity, Number(e.target.value) || 1));
                              setSelectedEquipment(
                                selectedEquipment.map((se) => (se.equipmentId === eq.id ? { ...se, quantity: qty } : se))
                              );
                            }}
                            className="w-16 p-1 text-center font-bold border border-slate-300 rounded-md bg-white text-xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Summary và Submit */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">Bước 5: Kiểm tra lại và Nộp hồ sơ</h2>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Tên sự kiện:</span>
                  <div className="font-bold text-slate-900">{formData.title}</div>
                </div>
                <div>
                  <span className="text-slate-400">Đơn vị tổ chức:</span>
                  <div className="font-semibold text-slate-800">{formData.organizingUnit}</div>
                </div>
                <div>
                  <span className="text-slate-400">Thời gian:</span>
                  <div className="font-semibold text-slate-800">{formData.startDate} → {formData.endDate}</div>
                </div>
                <div>
                  <span className="text-slate-400">Địa điểm đăng ký:</span>
                  <div className="font-semibold text-blue-700">{formData.preferredVenue}</div>
                </div>
                <div>
                  <span className="text-slate-400">Quy mô:</span>
                  <div className="font-semibold text-slate-800">{formData.expectedAttendees} sinh viên</div>
                </div>
                <div>
                  <span className="text-slate-400">Tổng dự toán:</span>
                  <div className="font-bold text-emerald-600">{formatCurrency(totalBudget)}</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Sau khi gửi hồ sơ, hệ thống sẽ tự động chuyển đến Ban Chủ nhiệm Khoa để xét duyệt nội dung bước 1.
              </span>
            </div>
          </div>
        )}

        {/* Form Bottom Controls */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={step === 1 ? () => navigate('/events') : handleBack}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> {step === 1 ? 'Hủy bỏ' : 'Quay lại'}
          </button>

          <div className="flex items-center gap-2">
            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#005FAF] hover:bg-[#004A8A] text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs min-h-[40px]"
              >
                Tiếp tục <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(false)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Lưu bản nháp
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(true)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#009444] hover:bg-[#007A38] text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs min-h-[40px]"
                >
                  <Send className="w-4 h-4" /> Nộp hồ sơ chính thức
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
