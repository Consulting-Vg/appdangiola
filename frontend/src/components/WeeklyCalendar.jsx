import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, MapPin, 
  Layers, Clock, AlertTriangle, Truck, Warehouse, ArrowRight 
} from 'lucide-react';

export default function WeeklyCalendar({ ots, userRole, userName, onSelectOT }) {
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [desarmeRecords, setDesarmeRecords] = useState([]);

  // Fetch disassemblies on load and when ots updates
  useEffect(() => {
    const fetchDesarmes = async () => {
      try {
        const res = await fetch('/api/logistica/desarmes');
        if (res.ok) {
          const data = await res.json();
          setDesarmeRecords(data);
        }
      } catch (err) {
        console.error("Error al cargar registros de desarme en calendario:", err);
      }
    };
    fetchDesarmes();
  }, [ots]);

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

  // Safe date parser that handles YYYY-MM-DD local timezone shift
  const parseDate = (dStr) => {
    if (!dStr) return null;
    let s = dStr;
    if (s.length === 10) {
      s += 'T00:00:00';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Gather all events for an OT on a given dayDate
  const getEventsForOTOnDay = (ot, dayDate, role, desarmeRecs = []) => {
    const events = [];
    const target = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    
    // 0. Pendiente Aprobación (for Gerencia and SuperAdmin on creation date)
    if (ot.fecha_creacion && ['Gerencia', 'SuperAdmin'].includes(role) && ot.estado === 'Pendiente') {
      const createdDate = new Date(ot.fecha_creacion);
      if (isSameDay(createdDate, target)) {
        events.push({
          type: 'pendiente_aprobacion',
          label: 'Aprobar/Desaprobar OT',
          colorClass: 'bg-amber-100 border-amber-500 text-amber-950 hover:bg-amber-200 border-2 font-black shadow-xs animate-pulse',
          priority: -2,
          details: `Pendiente: OT-${ot.ot_numero}`
        });
      }
    }

    const otStart = parseDate(ot.fecha_inicio);
    const otEnd = parseDate(ot.fecha_fin);

    // 1. Alerta Desarme (within 48 hours or overdue)
    if (otEnd) {
      const diffTime = otEnd.getTime() - target.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const isDesarmeAlertDay = ['Operaciones', 'Gerencia', 'SuperAdmin', 'Chofer'].includes(role) && 
                                diffDays >= 1 && diffDays <= 2 && 
                                !['Cancelada', 'Rechazada', 'Pendiente', 'Desarmada', 'Retornada'].includes(ot.estado);
      if (isDesarmeAlertDay) {
        events.push({
          type: 'alerta_desarme',
          label: 'Alerta Desarme',
          colorClass: 'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-800 hover:bg-fuchsia-100 border-2 animate-pulse',
          priority: 0
        });
      }
    }

    // 2. Traslado hacia el cliente (fecha_traslado)
    if (ot.fecha_traslado) {
      const trasladoDate = parseDate(ot.fecha_traslado);
      if (trasladoDate && isSameDay(trasladoDate, target)) {
        const timeStr = trasladoDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        events.push({
          type: 'traslado',
          label: 'Traslado a Cliente',
          colorClass: 'bg-indigo-50 border-indigo-300 text-indigo-800 hover:bg-indigo-100 border-2',
          priority: 1,
          details: `Hacia cliente: ${timeStr} hs`
        });
      }
    }

    // 3. Hacia la devolución / retorno (fecha_retorno) o Transferencia Directa
    const otAdicionales = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
    const hasPlannedTransfer = otAdicionales.transfer_dest_ot_id;
    if (ot.fecha_retorno) {
      const retornoDate = parseDate(ot.fecha_retorno);
      if (retornoDate && isSameDay(retornoDate, target)) {
        const timeStr = retornoDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        if (hasPlannedTransfer) {
          const destOT = ots.find(o => o.id === parseInt(hasPlannedTransfer));
          events.push({
            type: 'transfer_envio',
            label: 'Envío a Cliente (Transferencia)',
            colorClass: 'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-850 hover:bg-fuchsia-200 border-2 font-bold',
            priority: 3,
            details: `Hacia OT-${destOT ? destOT.ot_numero : hasPlannedTransfer} (${destOT ? destOT.cliente_nombre : 'Obra'}): ${timeStr} hs`
          });
        } else {
          events.push({
            type: 'retorno',
            label: 'Retorno a Depósito',
            colorClass: 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 border-2',
            priority: 2,
            details: `Retorno depósito: ${timeStr} hs`
          });
        }
      }
    }

    // 4. Envío de desarmado entre clientes (Transferencia de salida de esta OT a otra - Registro de desarme)
    const selfDesarme = desarmeRecs.find(d => d.ot_origen_id === ot.id);
    if (selfDesarme && selfDesarme.destinos) {
      if (otEnd && isSameDay(otEnd, target)) {
        selfDesarme.destinos.forEach(dest => {
          if (dest.type === 'ot' || dest.ot_id) {
            // Avoid duplicate events if already pushed by planned transfer on same day
            const exists = events.some(e => e.type === 'transfer_envio' && e.details.includes(`OT-${dest.ot_numero || dest.ot_id}`));
            if (!exists) {
              events.push({
                type: 'transfer_envio',
                label: 'Envío a Cliente (Desarme)',
                colorClass: 'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-850 hover:bg-fuchsia-200 border-2 font-bold',
                priority: 3,
                details: `Hacia OT-${dest.ot_numero || dest.ot_id} (${dest.cliente_nombre || 'Obra'})`
              });
            }
          }
        });
      }
    }

    // 5. Recibo de desarmado entre clientes (Esta OT recibe transferencia directa)
    const receivedFromOTIds = new Set();
    desarmeRecs.forEach(rec => {
      if (rec.destinos) {
        rec.destinos.forEach(dest => {
          const isTarget = dest.ot_id === ot.id || dest.ot_numero === ot.ot_numero;
          if (isTarget) {
            receivedFromOTIds.add(rec.ot_origen_id);
            const originOT = ots.find(o => o.id === rec.ot_origen_id);
            const originEnd = originOT ? parseDate(originOT.fecha_fin) : null;
            if (originEnd && isSameDay(originEnd, target)) {
              const originNum = originOT ? originOT.ot_numero : `OT-${rec.ot_origen_id}`;
              events.push({
                type: 'transfer_recibo',
                label: 'Recibo desde Cliente',
                colorClass: 'bg-violet-100 border-violet-400 text-violet-850 hover:bg-violet-200 border-2 font-bold',
                priority: 4,
                details: `Viene de OT-${originNum}`
              });
            }
          }
        });
      }
    });

    // 5b. Recibo planeado (antes de registrar el desarme final)
    ots.forEach(o => {
      const oAd = typeof o.adicionales === 'string' ? JSON.parse(o.adicionales) : o.adicionales || {};
      if (oAd.transfer_dest_ot_id === ot.id && !receivedFromOTIds.has(o.id) && o.fecha_retorno) {
        const originRetornoDate = parseDate(o.fecha_retorno);
        if (originRetornoDate && isSameDay(originRetornoDate, target)) {
          const timeStr = originRetornoDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          events.push({
            type: 'transfer_recibo',
            label: 'Recibo desde Cliente',
            colorClass: 'bg-violet-100 border-violet-400 text-violet-850 hover:bg-violet-200 border-2 font-bold',
            priority: 4,
            details: `Viene de OT-${o.ot_numero} (${timeStr} hs)`
          });
        }
      }
    });

    // 6. Armado
    if (otStart && isSameDay(otStart, target)) {
      events.push({
        type: 'armado',
        label: 'Armado',
        colorClass: 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200',
        priority: 10
      });
    }

    // 7. Desarmado
    if (otEnd && isSameDay(otEnd, target)) {
      events.push({
        type: 'desarmado',
        label: 'Desarmado',
        colorClass: 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200',
        priority: 11
      });
    }

    // 8. En Cliente
    const isOpOrWarehouseRole = [
      'Operaciones', 'Pañol', 'Telas', 'Pisos', 'Planta', 'Chofer', 'Lonas'
    ].includes(role);
    if (!isOpOrWarehouseRole && otStart && otEnd && target > otStart && target < otEnd) {
      events.push({
        type: 'en_cliente',
        label: 'En Cliente',
        colorClass: 'bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200',
        priority: 20
      });
    }

    return events;
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

          // Gather all events for this day
          const dayEvents = [];
          rawOts.forEach(ot => {
            const evts = getEventsForOTOnDay(ot, dayDate, userRole, desarmeRecords);
            evts.forEach(evt => {
              dayEvents.push({
                ...evt,
                ot
              });
            });
          });

          // Sort day events by priority
          dayEvents.sort((a, b) => a.priority - b.priority);

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
                {dayEvents.length > 0 ? (
                  dayEvents.map((evt, evtIdx) => {
                    const ot = evt.ot;
                    const geo = typeof ot.georef === 'string' ? JSON.parse(ot.georef) : ot.georef;

                    return (
                      <button
                        key={`${ot.id}-${evt.type}-${evtIdx}`}
                        onClick={() => onSelectOT(ot)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs font-semibold shadow-xs transition-all-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer block ${evt.colorClass}`}
                      >
                        {evt.type === 'pendiente_aprobacion' ? (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center gap-1 mb-1">
                              <span className="font-mono font-black text-amber-950 uppercase">
                                #{ot.ot_numero}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-tighter bg-amber-200 text-amber-900 px-1 py-0.5 rounded scale-95 origin-right">
                                PENDIENTE
                              </span>
                            </div>
                            <div className="font-black text-amber-900 mb-0.5 line-clamp-1 flex items-center gap-1 uppercase">
                              <User className="w-3 h-3 text-amber-700 shrink-0" />
                              <span>{ot.cliente_nombre}</span>
                            </div>
                            <div className="text-[9px] text-amber-800 font-bold uppercase mt-1 bg-amber-50/60 p-1.5 rounded-lg border border-amber-200/50 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-bounce" />
                              <span>Aprobar / Desaprobar</span>
                            </div>
                          </div>
                        ) : evt.type === 'alerta_desarme' ? (
                          <div className="space-y-1">
                            <div className="font-black text-fuchsia-900 flex items-center gap-1 text-[11px] uppercase tracking-wide leading-tight">
                              <AlertTriangle className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
                              <span>Crear Orden de Desarme para OT #{ot.ot_numero}</span>
                            </div>
                            <div className="text-[9px] text-fuchsia-700 font-bold uppercase mt-1">
                              Desarme: {ot.fecha_fin ? new Date(ot.fecha_fin + 'T00:00:00').toLocaleDateString('es-ES') : ''}
                            </div>
                          </div>
                        ) : ['traslado', 'retorno', 'transfer_envio', 'transfer_recibo'].includes(evt.type) ? (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center gap-1 mb-1">
                              <span className="font-mono font-black text-slate-450 uppercase">
                                #{ot.ot_numero}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-tighter scale-95 origin-right">
                                {evt.label}
                              </span>
                            </div>
                            <div className="font-black text-slate-850 mb-0.5 line-clamp-1 flex items-center gap-1 uppercase">
                              <User className="w-3 h-3 text-slate-450 shrink-0" />
                              <span>{ot.cliente_nombre}</span>
                            </div>
                            {evt.details && (
                              <div className="text-[9px] text-slate-650 font-semibold mt-1 bg-white/60 p-1.5 rounded-lg border border-slate-100 flex items-center gap-1">
                                {evt.type === 'traslado' || evt.type === 'transfer_envio' || evt.type === 'transfer_recibo' ? (
                                  <Truck className="w-3 h-3 text-slate-500 shrink-0" />
                                ) : (
                                  <Warehouse className="w-3 h-3 text-slate-500 shrink-0" />
                                )}
                                <span className="truncate">{evt.details}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center gap-1 mb-1.5">
                              <span className="font-mono font-black text-slate-400 uppercase">
                                {ot.ot_numero}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-tighter scale-95 origin-right">
                                {evt.label}
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
                              <span>{geo?.direccion?.split(',')[0]}</span>
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-40">
                    <Clock className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sin tareas</span>
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
