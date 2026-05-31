import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, MapPin, Layers, Clock, AlertTriangle } from 'lucide-react';

export default function WeeklyCalendar({ ots, userRole, userName, onSelectOT }) {
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Compute dates of the selected week (Mon - Sun)
  const getWeekDates = (offset) => {
    const today = new Date();
    // Get Monday of current week
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));
    monday.setDate(monday.getDate() + offset * 7);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentWeekOffset);
  const startOfWeek = weekDates[0];
  const endOfWeek = weekDates[6];

  const formatDateLabel = (d) => {
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const formatDayName = (d) => {
    return d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
  };

  // Check if an OT overlaps with a specific day
  const isOTOnDay = (ot, dayDate, role) => {
    const start = new Date(ot.fecha_inicio + 'T00:00:00');
    const target = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    const otStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const end = new Date(ot.fecha_fin + 'T00:00:00');
    const otEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    const isOpOrWarehouseRole = [
      'Operaciones', 'Pañol', 'Telas', 'Pisos', 'Planta', 'Chofer', 'Lonas'
    ].includes(role);

    if (isOpOrWarehouseRole) {
      return target.getTime() === otStart.getTime() || target.getTime() === otEnd.getTime();
    }

    return target >= otStart && target <= otEnd;
  };

  const getDayActionState = (ot, dayDate) => {
    const start = new Date(ot.fecha_inicio + 'T00:00:00');
    const end = new Date(ot.fecha_fin + 'T00:00:00');
    const target = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    const otStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const otEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (target.getTime() === otStart.getTime()) {
      return {
        colorClass: 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200',
        label: 'Armado',
        priority: 1
      };
    } else if (target.getTime() === otEnd.getTime()) {
      return {
        colorClass: 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200',
        label: 'Desarmado',
        priority: 2
      };
    } else {
      return {
        colorClass: 'bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200',
        label: 'En Cliente',
        priority: 3
      };
    }
  };

  return (
    <div className="bg-white/40 backdrop-blur-md border border-slate-200 rounded-[2rem] p-6 shadow-sm">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900 text-white p-2.5 rounded-2xl">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase text-blue-900 tracking-wider Poppins">Calendario Semanal</h2>
            <p className="text-xs text-slate-500 font-semibold">
              Semana del {formatDateLabel(startOfWeek)} al {formatDateLabel(endOfWeek)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all-300 bg-white cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => setCurrentWeekOffset(0)}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all-300 bg-white cursor-pointer"
          >
            Hoy
          </button>
          <button
            onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all-300 bg-white cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map((dayDate, index) => {
          const rawOts = ots.filter(ot => {
            if (userRole === 'Comercial') {
              const isOwner = ot.creado_por === userName || 
                              (ot.creado_por && ot.creado_por.toLowerCase() === userName.toLowerCase()) ||
                              ot.creado_por === 'comercial' || 
                              ot.creado_por === 'mariana' ||
                              (userName === 'Mariana D´Angiola' && ot.creado_por === 'comercial');
              return isOwner;
            }
            return true;
          });

          const otsOnDay = rawOts.filter(ot => isOTOnDay(ot, dayDate, userRole));

          otsOnDay.sort((a, b) => {
            const stateA = getDayActionState(a, dayDate);
            const stateB = getDayActionState(b, dayDate);
            return stateA.priority - stateB.priority;
          });

          const isToday = new Date().toDateString() === dayDate.toDateString();

          return (
            <div
              key={index}
              className={`flex flex-col min-h-[300px] border rounded-2xl p-3 transition-all-300 ${
                isToday 
                  ? 'bg-blue-50/50 border-blue-300 shadow-sm ring-1 ring-blue-300/30' 
                  : 'bg-white/80 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-baseline justify-between mb-3 border-b border-slate-100 pb-2">
                <span className="text-xs font-black tracking-widest text-slate-400 font-mono">
                  {formatDayName(dayDate)}
                </span>
                <span className={`text-sm font-black w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-800'
                }`}>
                  {dayDate.getDate()}
                </span>
              </div>

              {/* Day Events */}
              <div className="flex-1 space-y-2 overflow-y-auto max-h-[250px] pr-1">
                {otsOnDay.length > 0 ? (
                  otsOnDay.map((ot) => {
                    const actionState = getDayActionState(ot, dayDate);
                    const colorClass = actionState.colorClass;
                    const labelState = actionState.label;

                    return (
                      <button
                        key={ot.id}
                        onClick={() => onSelectOT(ot)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold shadow-xs transition-all-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer block ${colorClass}`}
                      >
                        <div className="flex justify-between items-center gap-1 mb-1.5">
                          <span className="font-extrabold text-[10px] tracking-wider text-slate-400 uppercase font-mono">
                            {ot.ot_numero}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-tighter scale-95 origin-right">
                            {labelState}
                          </span>
                        </div>
                        
                        <div className="font-black text-slate-850 mb-1 line-clamp-1 flex items-center gap-1 uppercase">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{ot.cliente_nombre}</span>
                        </div>

                        <div className="text-[10px] text-slate-500 font-semibold mb-1 flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{ot.modelo_estructura} ({ot.frente}x{ot.largo}m)</span>
                        </div>

                        <div className="text-[9px] text-slate-400 font-medium flex items-center gap-0.5 line-clamp-1">
                          <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span>{ot.georef?.direccion?.split(',')[0]}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-40">
                    <Clock className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sin montajes</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
