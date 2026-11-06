import React, { useState } from 'react';
import { Building2, Package, CheckCircle2, Wrench, Plus, Users, MapPin } from 'lucide-react';
import { useEvents } from '../contexts/EventContext';

export const FacilityListPage: React.FC = () => {
  const { facilities, equipment } = useEvents();
  const [activeTab, setActiveTab] = useState<'facilities' | 'equipment'>('facilities');

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Danh mục Cơ sở vật chất và Thiết bị</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý hội trường, phòng học, trang thiết bị âm thanh ánh sáng dùng chung toàn trường
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('facilities')}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'facilities' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hội trường và Phòng ({facilities.length})
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'equipment' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trang thiết bị ({equipment.length})
          </button>
        </div>
      </div>

      {/* Facilities Tab Content */}
      {activeTab === 'facilities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {facilities.map((f) => (
            <div
              key={f.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {f.code}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Sẵn sàng sử dụng
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{f.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{f.location}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-700">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Sức chứa tiêu chuẩn: {f.capacity} chỗ ngồi</span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">{f.description}</p>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Trang bị sẵn có:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.amenities.map((a, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Equipment Tab Content */}
      {activeTab === 'equipment' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="py-3 px-4">Mã TB</th>
                  <th className="py-3 px-4">Tên thiết bị</th>
                  <th className="py-3 px-4">Phân loại</th>
                  <th className="py-3 px-4 text-center">Tổng số</th>
                  <th className="py-3 px-4 text-center">Khả dụng</th>
                  <th className="py-3 px-4">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipment.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">{eq.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{eq.name}</td>
                    <td className="py-3 px-4 text-slate-500">{eq.type}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono text-slate-700">{eq.totalQuantity}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono text-emerald-600">
                      {eq.availableQuantity}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {eq.condition === 'GOOD' ? 'Tốt' : eq.condition}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
