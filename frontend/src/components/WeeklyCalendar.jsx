import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, MapPin, 
  Layers, Clock, AlertTriangle, Truck, Warehouse, ArrowRight, LayoutDashboard, CalendarDays,
  Moon, Sun, Filter, Lock, Save, Printer
} from 'lucide-react';
import PlanificadorOperativo from './PlanificadorOperativo';

export default function WeeklyCalendar({ ots = [], userRole, userName, onSelectOT, onRefreshData }) {
  const [calendarViewMode, setCalendarViewMode] = useState('mensual'); // 'diaria' | 'semanal' | 'mensual'
  const [isNightMode, setIsNightMode] = useState(() => {
    try {
      return localStorage.getItem('dangiola_night_mode') === 'true';
    } catch {
      return false;
    }
  });

  const toggleNightMode = () => {
    setIsNightMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('dangiola_night_mode', String(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [selectedDayForDailyView, setSelectedDayForDailyView] = useState(() => new Date().toISOString().split('T')[0]);
  const [desarmeRecords, setDesarmeRecords] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('todos');
  const [focusedEventId, setFocusedEventId] = useState(null);

  // Month navigation helpers
  const nextMonth = () => {
    const d = new Date(currentMonthDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonthDate(d);
  };

  const prevMonth = () => {
    const d = new Date(currentMonthDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonthDate(d);
  };

  // Compute full month grid matrix (6 weeks x 7 days)
  const getMonthMatrix = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Day of week of 1st day (0 = Sun, 1 = Mon...) -> Convert to Mon = 0, Sun = 6
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    // Start date of the matrix grid
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    const matrix = [];
    let curDate = new Date(startDate);

    for (let row = 0; row < 6; row++) {
      const week = [];
      for (let col = 0; col < 7; col++) {
        week.push(new Date(curDate));
        curDate.setDate(curDate.getDate() + 1);
      }
      matrix.push(week);
    }
    return matrix;
  };

  const monthMatrix = getMonthMatrix(currentMonthDate);
  const monthNameYear = currentMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

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
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
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

  // Helper to open daily view from a specific event or day click
  const handleOpenDayView = (dateStr, eventId = null) => {
    setSelectedDayForDailyView(dateStr);
    if (eventId) {
      setFocusedEventId(eventId);
    }
    setCalendarViewMode('diaria');
  };

  // Event color palettes for tags in monthly view
  const EVENT_TAG_PALETTES = [
    'bg-sky-100 text-sky-950 border-sky-300 hover:bg-sky-200',
    'bg-indigo-100 text-indigo-950 border-indigo-300 hover:bg-indigo-200',
    'bg-purple-100 text-purple-950 border-purple-300 hover:bg-purple-200',
    'bg-teal-100 text-teal-950 border-teal-300 hover:bg-teal-200',
    'bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200',
    'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200',
    'bg-rose-100 text-rose-950 border-rose-300 hover:bg-rose-200'
  ];

  const getEventTagColor = (otId) => {
    const idx = (otId || 0) % EVENT_TAG_PALETTES.length;
    return EVENT_TAG_PALETTES[idx];
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
          label: 'Salida de Planta',
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
        colorClass: 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200',
        priority: 10
      });
    }

    // 7. Desarmado
    if (otEnd && isSameDay(otEnd, target)) {
      events.push({
        type: 'desarmado',
        label: 'Desarmado',
        colorClass: 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200',
        priority: 11
      });
    }

    // 7b. Replicated Armado / Desarmado Tasks
    const replicatedTasks = otAdicionales.replicated_tasks || [];
    replicatedTasks.forEach((rep, repIdx) => {
      const repDate = parseDate(rep.date);
      if (repDate && isSameDay(repDate, target) && !rep.completed) {
        events.push({
          type: rep.type,
          label: `${rep.type === 'armado' ? 'Armado' : 'Desarmado'} (Replicado)`,
          colorClass: rep.type === 'armado'
            ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200'
            : 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200',
          priority: rep.type === 'armado' ? 10 : 11,
          isReplicated: true,
          replicatedIndex: repIdx
        });
      }
    });

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

  const handleEventClick = async (evt, ot, dayDate) => {
    if (evt.type !== 'armado' && evt.type !== 'desarmado') {
      onSelectOT(ot);
      return;
    }

    const ad = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
    let isFinished = false;
    
    if (evt.type === 'armado') {
      isFinished = ad.armado_completed || ['Completada', 'Desarmando', 'Desarmada', 'Retornada'].includes(ot.estado);
    } else if (evt.type === 'desarmado') {
      isFinished = ad.desarmado_completed || ['Desarmada', 'Retornada'].includes(ot.estado);
    }

    if (isFinished) {
      onSelectOT(ot);
      return;
    }

    const typeLabel = evt.type === 'armado' ? 'Armado' : 'Desarmado';
    const completed = window.confirm(
      `¿Se completó la tarea de ${typeLabel} para la OT-${ot.ot_numero} (${ot.cliente_nombre})?\n\n` +
      `• Aceptar (OK): Marcar como completada.\n` +
      `• Cancelar: No se completó (se replicará al día siguiente).`
    );

    if (completed) {
      const updatedAd = { ...ad };
      if (evt.isReplicated && evt.replicatedIndex !== undefined) {
        const reps = [...(updatedAd.replicated_tasks || [])];
        if (reps[evt.replicatedIndex]) {
          reps[evt.replicatedIndex].completed = true;
        }
        updatedAd.replicated_tasks = reps;
      } else {
        if (evt.type === 'armado') {
          updatedAd.armado_completed = true;
        } else {
          updatedAd.desarmado_completed = true;
        }
      }

      try {
        const res = await fetch(`/api/ots/${ot.id}/adicionales`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adicionales: updatedAd,
            usuario: userName,
            rol: userRole
          })
        });
        if (res.ok) {
          if (onRefreshData) onRefreshData();
          alert(`Tarea de ${typeLabel} marcada como completada.`);
        }
      } catch (err) {
        console.error("Error al completar tarea:", err);
      }
    } else {
      const nextDay = new Date(dayDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().substring(0, 10);

      const updatedAd = { ...ad };
      const reps = [...(updatedAd.replicated_tasks || [])];
      
      const alreadyExists = reps.some(r => r.date === nextDayStr && r.type === evt.type);
      if (!alreadyExists) {
        reps.push({
          date: nextDayStr,
          type: evt.type,
          completed: false
        });
      }
      updatedAd.replicated_tasks = reps;

      try {
        const res = await fetch(`/api/ots/${ot.id}/adicionales`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adicionales: updatedAd,
            usuario: userName,
            rol: userRole
          })
        });
        if (res.ok) {
          if (onRefreshData) onRefreshData();
          alert(`Tarea de ${typeLabel} no completada. Replicada para el día ${nextDay.toLocaleDateString('es-ES')}.`);
        }
      } catch (err) {
        console.error("Error al replicar tarea:", err);
      }
    }
  };

  return (
    <div className={`flex flex-col gap-4 transition-colors duration-300 ${isNightMode ? 'text-white' : ''}`}>
      {/* Top View Mode Switcher Bar */}
      <div className={`flex flex-wrap items-center justify-between p-3 rounded-3xl shadow-xs gap-3 transition-colors ${
        isNightMode ? 'bg-[#196fa9] border border-[#2e88cb]' : 'bg-white border border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          
          {/* Selector de 3 Vistas: Día, Semana, Mes */}
          <div className={`flex items-center p-1 rounded-2xl border ${
            isNightMode ? 'bg-[#145d8f] border-[#297bb9]' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setCalendarViewMode('diaria')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                calendarViewMode === 'diaria'
                  ? isNightMode ? 'bg-sky-400 text-sky-950 shadow-md font-black' : 'bg-blue-900 text-white shadow-xs'
                  : isNightMode ? 'text-sky-200 hover:text-white hover:bg-sky-900/50' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Día</span>
            </button>

            <button
              onClick={() => setCalendarViewMode('semanal')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                calendarViewMode === 'semanal'
                  ? isNightMode ? 'bg-sky-400 text-sky-950 shadow-md font-black' : 'bg-blue-900 text-white shadow-xs'
                  : isNightMode ? 'text-sky-200 hover:text-white hover:bg-sky-900/50' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Semana</span>
            </button>

            <button
              onClick={() => setCalendarViewMode('mensual')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                calendarViewMode === 'mensual'
                  ? isNightMode ? 'bg-sky-400 text-sky-950 shadow-md font-black' : 'bg-blue-900 text-white shadow-xs'
                  : isNightMode ? 'text-sky-200 hover:text-white hover:bg-sky-900/50' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Mes</span>
            </button>
          </div>

          {/* Botón Modo Noche */}
          <button
            type="button"
            onClick={toggleNightMode}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs ${
              isNightMode
                ? 'bg-sky-950 text-sky-200 border-2 border-sky-400/70 hover:bg-sky-900 shadow-sky-950/60 ring-2 ring-sky-400/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
            }`}
            title={isNightMode ? 'Desactivar Modo Noche' : 'Activar Modo Noche (Colores Suaves Oceánicos)'}
          >
            {isNightMode ? (
              <>
                <Moon className="w-4 h-4 text-sky-300 fill-sky-300" />
                <span>Modo Noche Activo</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Modo Noche</span>
              </>
            )}
          </button>
        </div>

        <div className={`text-[11px] font-bold hidden sm:block pr-3 ${
          isNightMode ? 'text-sky-200' : 'text-slate-500'
        }`}>
          {calendarViewMode === 'diaria' && '⚡ Vista Diaria: Asignación interactiva por drag & drop'}
          {calendarViewMode === 'semanal' && '📅 Vista Semanal: Cronograma cronológico de 7 días'}
          {calendarViewMode === 'mensual' && '📆 Vista Mensual: Resumen de eventos en tags compactos por día'}
        </div>
      </div>

      {/* ── 1. VISTA DIARIA (PLANIFICADOR OPERATIVO DRAG & DROP) ── */}
      {calendarViewMode === 'diaria' && (
        <PlanificadorOperativo
          ots={ots}
          userRole={userRole}
          userName={userName}
          onRefreshData={onRefreshData}
          onOpenOTDetail={onSelectOT}
          initialDate={selectedDayForDailyView}
          focusedEventId={focusedEventId}
          viewMode={calendarViewMode}
          onChangeViewMode={setCalendarViewMode}
          isNightMode={isNightMode}
          toggleNightMode={toggleNightMode}
        />
      )}

      {/* ── 2. VISTA MENSUAL (GRID DE 30/31 DÍAS CON PALETA OCEÁNICA MODO NOCHE) ── */}
      {calendarViewMode === 'mensual' && (
        <div className={`rounded-3xl p-5 md:p-6 shadow-md space-y-4 border transition-colors ${
          isNightMode ? 'bg-[#1e7ec8] border-[#3894db] text-white shadow-sky-950/40' : 'bg-white border-slate-200 shadow-xs text-slate-800'
        }`}>
          
          {/* Month Header Navigation (Matching user screenshot) */}
          <div className={`flex flex-col sm:flex-row justify-between items-center gap-3 pb-3 border-b ${
            isNightMode ? 'border-sky-400/30' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className={`p-2 rounded-xl transition cursor-pointer shadow-xs ${
                  isNightMode ? 'bg-sky-900/60 hover:bg-sky-800 text-white border border-sky-400/40' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
                title="Mes Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <h2 className={`text-lg md:text-xl font-black uppercase tracking-wider Poppins px-2 ${
                isNightMode ? 'text-white drop-shadow-xs' : 'text-blue-900'
              }`}>
                {monthNameYear}
              </h2>

              <button
                onClick={nextMonth}
                className={`p-2 rounded-xl transition cursor-pointer shadow-xs ${
                  isNightMode ? 'bg-sky-900/60 hover:bg-sky-800 text-white border border-sky-400/40' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
                title="Mes Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Controls: Filtro + Editor + Guardar y Publicar + Imprimir */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro Dropdown / Buttons */}
              <div className={`flex items-center gap-1 p-1 rounded-2xl border ${
                isNightMode ? 'bg-sky-900/60 border-sky-400/40' : 'bg-slate-100 border-slate-200'
              }`}>
                {['todos', 'armado', 'desarmado', 'logistica'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFilter(f)}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                      selectedFilter === f
                        ? isNightMode ? 'bg-sky-400 text-sky-950 font-black shadow-xs' : 'bg-blue-900 text-white shadow-xs'
                        : isNightMode ? 'text-sky-100 hover:text-white hover:bg-sky-800/60' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {f === 'todos' ? 'Todos' : f === 'armado' ? 'Armado' : f === 'desarmado' ? 'Desarme' : 'Logística'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentMonthDate(new Date())}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  isNightMode ? 'bg-sky-900/60 hover:bg-sky-800 text-white border-sky-400/40' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                Este Mes
              </button>

              <button
                onClick={() => window.print()}
                className={`p-2 rounded-xl transition cursor-pointer border ${
                  isNightMode ? 'bg-sky-900/60 hover:bg-sky-800 text-white border-sky-400/40' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Imprimir Calendario"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Month Table Grid (7 Columns: LUN, MAR, MIÉ, JUE, VIE, SÁB, DOM) */}
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              
              {/* Day of week header row */}
              <div className={`grid grid-cols-7 gap-2 mb-2 text-center text-xs font-black uppercase tracking-widest font-mono ${
                isNightMode ? 'text-sky-100' : 'text-slate-400'
              }`}>
                <div>LUN</div>
                <div>MAR</div>
                <div>MIÉ</div>
                <div>JUE</div>
                <div>VIE</div>
                <div>SÁB</div>
                <div>DOM</div>
              </div>

              {/* Weeks Matrix */}
              <div className="space-y-2">
                {monthMatrix.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-cols-7 gap-2">
                    {week.map((dayDate, dIdx) => {
                      const isCurrentMonth = dayDate.getMonth() === currentMonthDate.getMonth();
                      const isToday = isSameDay(dayDate, new Date());
                      const dayDateStr = dayDate.toISOString().split('T')[0];

                      // Active OTs on this day
                      const dayOts = ots.filter(ot => {
                        const isAprobada = ot.estado === 'Aprobada por Gerencia' || ot.estado === 'Aprobada' || ot.estado === 'En Curso' || !ot.estado;
                        if (!isAprobada || !ot.fecha_inicio) return false;
                        const start = ot.fecha_inicio.substring(0, 10);
                        const end = (ot.fecha_fin || ot.fecha_inicio).substring(0, 10);
                        return dayDateStr >= start && dayDateStr <= end;
                      });

                      // Total estimated crew on this day
                      const totalOperarios = dayOts.reduce((sum, ot) => {
                        return sum + Math.max(2, Math.ceil((ot.superficie || 100) / 75));
                      }, 0);

                      // Night mode styles
                      const cellBg = isNightMode
                        ? isToday
                          ? 'bg-[#2084c8] border-2 border-white ring-2 ring-sky-300/60 shadow-lg'
                          : isCurrentMonth
                            ? 'bg-[#1e7ec8] border-[#3894db] hover:bg-[#2587d4]'
                            : 'bg-[#186ba8] border-[#297bb9] opacity-60'
                        : isToday
                          ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-300/40 shadow-xs'
                          : isCurrentMonth
                            ? 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'
                            : 'bg-slate-50/50 border-slate-150 opacity-40 hover:opacity-80';

                      return (
                        <div
                          key={dIdx}
                          onClick={() => handleOpenDayView(dayDateStr)}
                          className={`flex flex-col justify-between p-2 rounded-2xl border transition-all min-h-[115px] cursor-pointer group ${cellBg}`}
                        >
                          {/* Day Header: Number + Total Crew count */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
                              isToday 
                                ? isNightMode ? 'bg-white text-blue-900 font-black shadow-xs' : 'bg-blue-900 text-white' 
                                : isNightMode ? 'text-white' : 'text-slate-700'
                            }`}>
                              {dayDate.getDate()}
                            </span>

                            {totalOperarios > 0 && (
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 transition ${
                                isNightMode 
                                  ? 'text-sky-100 bg-sky-950/60 border border-sky-400/30' 
                                  : 'text-slate-500 bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-900'
                              }`}>
                                <span>👤 {totalOperarios} →</span>
                              </span>
                            )}
                          </div>

                          {/* Event Tags List (Translucent Frosted Rows with [A], [D], [T] badges) */}
                          <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] pr-0.5">
                            {dayOts.map((ot) => {
                              const eventName = ot.cliente_nombre || ot.nombre_evento || `OT-${ot.ot_numero || ot.id}`;
                              const etapa = (ot.etapa || 'Armado').toUpperCase();
                              const etapaLetter = etapa.startsWith('D') ? 'D' : etapa.startsWith('T') ? 'T' : 'A';
                              const etapaColor = etapaLetter === 'D' 
                                ? 'bg-amber-500 text-amber-950' 
                                : etapaLetter === 'T' 
                                  ? 'bg-sky-400 text-sky-950' 
                                  : 'bg-emerald-500 text-emerald-950';

                              // Night mode palette for tags
                              const tagColor = isNightMode
                                ? ((ot.id || 0) % 5 === 0 ? 'bg-sky-950/70 border-sky-400/40 text-white hover:bg-sky-900' :
                                   (ot.id || 0) % 5 === 1 ? 'bg-indigo-950/70 border-indigo-400/40 text-white hover:bg-indigo-900' :
                                   (ot.id || 0) % 5 === 2 ? 'bg-teal-950/70 border-teal-400/40 text-white hover:bg-teal-900' :
                                   (ot.id || 0) % 5 === 3 ? 'bg-amber-950/70 border-amber-400/40 text-white hover:bg-amber-900' :
                                   'bg-rose-950/70 border-rose-400/40 text-white hover:bg-rose-900')
                                : getEventTagColor(ot.id);

                              return (
                                <button
                                  key={ot.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDayView(dayDateStr, ot.id);
                                  }}
                                  className={`w-full text-left px-2 py-1 rounded-xl border text-[10.5px] font-black flex items-center justify-between gap-1 shadow-2xs transition hover:scale-[1.02] cursor-pointer truncate ${tagColor}`}
                                  title={`${eventName} (${etapa}) — Clic para abrir vista interactiva`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-[8px] shrink-0 text-sky-300">●</span>
                                    <span className="truncate">{eventName}</span>
                                  </div>
                                  <span className={`px-1 py-0.2 rounded text-[9px] font-black shrink-0 ${etapaColor}`}>
                                    {etapaLetter}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Footer of cell */}
                          {dayOts.length === 0 && (
                            <div className={`text-[9px] font-semibold text-center py-1 ${
                              isNightMode ? 'text-sky-300/40' : 'text-slate-300'
                            }`}>
                              Sin eventos
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ── 3. VISTA SEMANAL CLÁSICA ── */}
      {calendarViewMode === 'semanal' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          
          {/* Header controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="bg-blue-900 text-white p-2.5 rounded-2xl shadow-xs">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase text-blue-900 tracking-wider Poppins">Calendario Semanal</h2>
                <p className="text-xs text-slate-500 font-semibold">
                  Semana del {formatDateLabel(startOfWeek)} al {formatDateLabel(endOfWeek)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Type Filters */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                {['todos', 'armado', 'desarmado', 'logistica'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                      selectedFilter === f
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    {f === 'todos' ? 'Todos' : f === 'armado' ? 'Armado' : f === 'desarmado' ? 'Desarmado' : 'Logística'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
                  className="p-2 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-blue-900 transition cursor-pointer shadow-2xs"
                  title="Semana Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentWeekOffset(0)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
                  className="p-2 bg-white hover:bg-slate-50 rounded-xl text-slate-600 hover:text-blue-900 transition cursor-pointer shadow-2xs"
                  title="Semana Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Week Grid (7 columns) */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDates.map((dayDate, index) => {
              const dayDateStr = dayDate.toISOString().split('T')[0];

              // Active OTs on this day
              const dayOts = ots.filter(ot => {
                const isAprobada = ot.estado === 'Aprobada por Gerencia' || ot.estado === 'Aprobada' || ot.estado === 'En Curso' || !ot.estado;
                if (!isAprobada || !ot.fecha_inicio) return false;
                
                if (userRole === 'Comercial') {
                  const isOwner = ot.creado_por === userName || 
                                  (ot.creado_por && ot.creado_por.toLowerCase() === userName.toLowerCase()) ||
                                  ot.creado_por === 'comercial' || 
                                  ot.creado_por === 'mariana' ||
                                  (userName === 'Mariana D´Angiola' && ot.creado_por === 'comercial');
                  if (!isOwner) return false;
                }

                const start = ot.fecha_inicio.substring(0, 10);
                const end = (ot.fecha_fin || ot.fecha_inicio).substring(0, 10);
                const matchesDate = dayDateStr >= start && dayDateStr <= end;
                if (!matchesDate) return false;

                // Filter by selected type if applicable
                if (selectedFilter === 'armado') {
                  return start === dayDateStr;
                } else if (selectedFilter === 'desarmado') {
                  return end === dayDateStr;
                }
                return true;
              });

              const isToday = new Date().toDateString() === dayDate.toDateString();

              return (
                <div
                  key={index}
                  onClick={() => handleOpenDayView(dayDateStr)}
                  className={`flex flex-col border rounded-3xl p-3.5 transition-all min-h-[360px] cursor-pointer ${
                    isToday 
                      ? 'bg-blue-50/70 border-blue-300 shadow-xs ring-1 ring-blue-300/40' 
                      : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-baseline justify-between mb-3 border-b border-slate-100 pb-2">
                    <span className="text-xs font-black tracking-widest text-slate-400 font-mono">
                      {formatDayName(dayDate)}
                    </span>
                    <span className={`text-sm font-black w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-800'
                    }`}>
                      {dayDate.getDate()}
                    </span>
                  </div>

                  {/* Day Events as Clean Tags */}
                  <div className="flex-1 space-y-2 overflow-y-auto pr-0.5 max-h-[300px]">
                    {dayOts.length > 0 ? (
                      dayOts.map((ot) => {
                        const tagColor = getEventTagColor(ot.id);
                        const eventName = ot.cliente_nombre || ot.nombre_evento || `OT-${ot.ot_numero || ot.id}`;

                        return (
                          <button
                            key={ot.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDayView(dayDateStr, ot.id);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-2xl border text-xs font-black flex items-center gap-2 shadow-2xs transition hover:scale-[1.02] cursor-pointer truncate ${tagColor}`}
                            title={`${eventName} — Clic para abrir vista interactiva`}
                          >
                            <span className="text-[9px] shrink-0">●</span>
                            <span className="truncate">{eventName}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-40">
                        <Clock className="w-5 h-5 text-slate-400 mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin tareas</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

