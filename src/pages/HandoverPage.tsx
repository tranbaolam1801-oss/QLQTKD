import React, { useState } from 'react';
import { ClipboardCheck, CheckCircle2, AlertTriangle, Building, Clock, FileText, Send } from 'lucide-react';
import { useEvents } from '../contexts/EventContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime } from '../utils/helpers';

export const HandoverPage: React.FC = () => {
  const { events, addHandoverRecord } = useEvents();
  const { currentUser } = useAuth();

  // Find events in handover or return pending stages
  const pendingEvents = events.filter((e) =>
    ['READY_FOR_EVENT', 'FACILITY_HANDED_OVER', 'FACILITY_RETURN_PENDING', 'FACILITY_INSPECTION'].includes(e.status)
  );

  const [selectedEventId, setSelectedEventId] = useState<string>(pendingEvents[0]?.id || '');
  const [recordType, setRecordType] = useState<'PRE_EVENT' | 'POST_EVENT'>('PRE_EVENT');
  const [facilityCondition, setFacilityCondition] = useState('Phòng sạch sẽ, bàn ghế ngăn nắp, âm thanh máy chiếu hoạt động tốt.');
  const [equipmentNotes, setEquipmentNotes] = useState('Đủ số lượng micro và dây cáp kết nối HDMI.');
  const [hasIncident, setHasIncident] = useState(false);
  const [incidentDetails, setIncidentDetails] = useState('');

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    addHandoverRecord(selectedEventId, {
      type: recordType,
      handoverByName: currentUser.fullName,
      receivedByName: selectedEvent?.contactPerson || 'Đại diện BTC',
      facilityCondition,
      equipmentNotes,
      hasIncident,
      incidentDetails: hasIncident ? incidentDetails : undefined,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bàn giao và Nghiệm thu Cơ sở vật chất</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quy trình lập biên bản bàn giao phòng/thiết bị trước sự kiện và nghiệm thu hoàn trả sau sự kiện
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Create Handover Record */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-blue-600" />
            <span>Lập biên bản bàn giao / Nghiệm thu mới</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chọn sự kiện thực hiện:</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.eventCode} — {ev.title} ({ev.organizingUnit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loại biên bản:</label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as any)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold"
              >
                <option value="PRE_EVENT">1. Bàn giao trước sự kiện</option>
                <option value="POST_EVENT">2. Nghiệm thu hoàn trả sau sự kiện</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cán bộ CSVC phụ trách:</label>
              <input
                type="text"
                disabled
                value={currentUser.fullName}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tình trạng thực tế hội trường / phòng:</label>
            <textarea
              rows={2}
              value={facilityCondition}
              onChange={(e) => setFacilityCondition(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kiểm tra số lượng thiết bị:</label>
            <textarea
              rows={2}
              value={equipmentNotes}
              onChange={(e) => setEquipmentNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>

          {/* Incident reporting toggle */}
          {recordType === 'POST_EVENT' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                <input
                  type="checkbox"
                  checked={hasIncident}
                  onChange={(e) => setHasIncident(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Có phát sinh sự cố / hư hỏng thiết bị hoặc mất mát tài sản?</span>
              </label>

              {hasIncident && (
                <div>
                  <textarea
                    rows={2}
                    value={incidentDetails}
                    onChange={(e) => setIncidentDetails(e.target.value)}
                    placeholder="Mô tả cụ thể thiết bị hư hỏng, mức độ và phương án xử lý bồi hoàn..."
                    className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white"
                  />
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#005FAF] hover:bg-[#004A8A] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer min-h-[40px] transition-all"
            >
              <Send className="w-3.5 h-3.5" /> Xác nhận ký biên bản điện tử
            </button>
          </div>
        </form>

        {/* Right Info: Selected Event Overview */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin sự kiện được chọn</h3>

          {selectedEvent ? (
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">{selectedEvent.eventCode}</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedEvent.title}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-slate-600">
                <div>Địa điểm: <span className="font-semibold text-slate-800">{selectedEvent.preferredVenue}</span></div>
                <div>Đơn vị: <span className="font-semibold text-slate-800">{selectedEvent.organizingUnit}</span></div>
                <div>Đại diện nhận: <span className="font-semibold text-slate-800">{selectedEvent.contactPerson}</span></div>
                <div>Điện thoại: <span className="font-semibold text-slate-800">{selectedEvent.contactPhone}</span></div>
              </div>

              {selectedEvent.handover && selectedEvent.handover.length > 0 && (
                <div>
                  <div className="font-bold text-slate-700 mb-2">Các biên bản đã ký:</div>
                  <div className="space-y-2">
                    {selectedEvent.handover.map((h) => (
                      <div key={h.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px]">
                        <div className="font-bold text-slate-800">
                          {h.type === 'PRE_EVENT' ? 'Bàn giao trước sự kiện' : 'Nghiệm thu hoàn trả'}
                        </div>
                        <div className="text-slate-400 mt-0.5">{formatDateTime(h.confirmedAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400">Chưa chọn sự kiện</div>
          )}
        </div>
      </div>
    </div>
  );
};
