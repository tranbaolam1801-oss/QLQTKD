import React, { useState } from 'react';
import { Receipt, CheckCircle2, AlertTriangle, Plus, FileText, Check, DollarSign } from 'lucide-react';
import { useEvents } from '../contexts/EventContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { FinancialDocument } from '../types';

export const SettlementPage: React.FC = () => {
  const { events, saveSettlement, transitionEvent } = useEvents();
  const { currentUser } = useAuth();

  const settlementEvents = events.filter(
    (e) => e.settlement || ['FINANCE_REVIEW', 'FINANCE_DOCUMENTS_PENDING', 'SETTLED', 'COMPLETED'].includes(e.status)
  );

  const [selectedEventId, setSelectedEventId] = useState<string>(settlementEvents[0]?.id || events[0]?.id || '');
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const [docNumber, setDocNumber] = useState('');
  const [docAmount, setDocAmount] = useState<number>(1000000);
  const [docDesc, setDocDesc] = useState('');
  const [docType, setDocType] = useState<'INVOICE' | 'RECEIPT' | 'CONTRACT'>('INVOICE');

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !docNumber.trim()) return;

    const newDoc: FinancialDocument = {
      id: `doc-${Date.now()}`,
      documentType: docType,
      documentNumber: docNumber,
      amount: docAmount,
      description: docDesc || 'Chứng từ thanh toán hóa đơn hợp lệ',
      fileName: `${docNumber.toLowerCase()}.pdf`,
      isVerified: currentUser.role === 'KHTC',
    };

    const currentSettlement = selectedEvent.settlement || {
      id: `stl-${Date.now()}`,
      eventId: selectedEvent.id,
      totalBudgeted: selectedEvent.budgetItems.reduce((s, i) => s + i.totalPrice, 0),
      totalActual: 0,
      difference: 0,
      status: 'SUBMITTED',
      documents: [],
    };

    const updatedDocs = [...currentSettlement.documents, newDoc];
    const totalActual = updatedDocs.reduce((s, d) => s + d.amount, 0);

    const success = await saveSettlement(selectedEvent.id, {
      ...currentSettlement,
      documents: updatedDocs,
      totalActual,
      difference: totalActual - currentSettlement.totalBudgeted,
    });

    if (!success) return;
    setDocNumber('');
    setDocDesc('');
  };

  const handleApproveSettlement = () => {
    if (!selectedEvent) return;
    transitionEvent(
      selectedEvent.id,
      'KHTC phê duyệt thanh quyết toán',
      'SETTLED',
      'Đã đối chiếu đầy đủ chứng từ hóa đơn hợp lệ'
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Quyết toán Tài chính và Chứng từ (KHTC)</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quy trình tiếp nhận, kiểm tra tính đầy đủ của bộ hóa đơn, đối chiếu dự toán và phê duyệt chi
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700">Chọn sự kiện cần xem / quyết toán:</label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800"
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.eventCode} — {ev.title} ({ev.status})
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <div className="space-y-4 sm:space-y-5">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-400 font-semibold uppercase">1. Dự toán ban đầu</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(selectedEvent.budgetItems.reduce((s, i) => s + i.totalPrice, 0))}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Tổng cộng các khoản mục chi</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-400 font-semibold uppercase">2. Thực tế chi có chứng từ</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(selectedEvent.settlement?.totalActual || 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {selectedEvent.settlement?.documents.length || 0} chứng từ / hóa đơn đính kèm
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-400 font-semibold uppercase">3. Chênh lệch ngân sách</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {formatCurrency(selectedEvent.settlement?.difference || 0)}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1">
                {(selectedEvent.settlement?.difference || 0) <= 0 ? 'Trong hạn mức tiết kiệm' : 'Vượt dự toán'}
              </div>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-800">Danh mục hóa đơn chứng từ kèm theo</h3>

              {currentUser.role === 'KHTC' && selectedEvent.status !== 'SETTLED' && (
                <button
                  onClick={handleApproveSettlement}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" /> KHTC duyệt quyết toán
                </button>
              )}
            </div>

            {(!selectedEvent.settlement || selectedEvent.settlement.documents.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Chưa có chứng từ tài chính nào được tải lên cho sự kiện này
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Loại chứng từ</th>
                      <th className="py-2.5 px-3">Số hóa đơn / Biên nhận</th>
                      <th className="py-2.5 px-3">Nội dung chi</th>
                      <th className="py-2.5 px-3 text-right">Số tiền</th>
                      <th className="py-2.5 px-3 text-center">Trạng thái KHTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEvent.settlement.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="py-3 px-3 font-semibold text-slate-700">{doc.documentType}</td>
                        <td className="py-3 px-3 font-mono font-bold text-blue-600">{doc.documentNumber}</td>
                        <td className="py-3 px-3 text-slate-800">{doc.description}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(doc.amount)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {doc.isVerified ? 'Hợp lệ' : 'Đang kiểm tra'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Quick Add Document Form */}
            <form onSubmit={handleAddDocument} className="pt-4 border-t border-slate-100 flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Loại:</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <option value="INVOICE">Hóa đơn VAT</option>
                  <option value="RECEIPT">Biên nhận</option>
                  <option value="CONTRACT">Hợp đồng thuê</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Số chứng từ:</label>
                <input
                  type="text"
                  placeholder="VAT-10294"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 w-32"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Số tiền (VNĐ):</label>
                <input
                  type="number"
                  step="50000"
                  value={docAmount}
                  onChange={(e) => setDocAmount(Number(e.target.value))}
                  className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 w-36 font-mono font-bold"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nội dung chi tiết:</label>
                <input
                  type="text"
                  placeholder="Nội dung hóa đơn..."
                  value={docDesc}
                  onChange={(e) => setDocDesc(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 w-full"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                + Thêm chứng từ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
