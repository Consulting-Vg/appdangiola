import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import {
  BarChart3, TrendingUp, Users, MapPin, Upload,
  ChevronLeft, RefreshCw, Download, Search, X, ChevronDown, ChevronUp,
  Info, User, Trash2, Globe
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: d });

// Coordenadas de la sede de Carpas D'Angiola (Burzaco)
const DANGIOLA_HQ = {
  lat: -34.83473863535278,
  lng: -58.42446638785623,
  label: "Carpas D'Angiola — HQ Burzaco",
  address: 'Juan XXIII 2980, Parque Industrial, Burzaco'
};

// Fórmula de Haversine: distancia en km entre dos coordenadas
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const SemaforoIcon = ({ dias }) => {
  if (dias === null || dias === undefined) return <span className="text-slate-400">─</span>;
  if (dias > 180) return <span title={`${dias} días`} className="text-xl">🔴</span>;
  if (dias > 90) return <span title={`${dias} días`} className="text-xl">🟡</span>;
  return <span title={`${dias} días`} className="text-xl">🟢</span>;
};

// ─── Gráfico de Líneas SVG ────────────────────────────────────────────────────
const LineChart = ({ data, xKey = 'mes', yKey = 'cierres', color = '#2563eb', label = 'Cierres' }) => {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Sin datos disponibles</div>
  );
  const W = 560, H = 180, PAD = 40;
  const vals = data.map(d => d[yKey]);
  const maxV = Math.max(...vals, 1);
  const pts = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((d[yKey] / maxV) * (H - PAD * 2));
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 180 }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
        const y = H - PAD - ((d[yKey] / maxV) * (H - PAD * 2));
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={4} fill={color} />
            <text x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="#94a3b8">{d[xKey]?.substring(5)}</text>
            <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="#1e40af" fontWeight="700">{d[yKey]}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Gráfico de Barras Horizontal SVG ────────────────────────────────────────
const BarChart = ({ data, nameKey = 'nombre', valueKey = 'cantidad', color = '#1d4ed8' }) => {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-20 text-slate-400 text-sm">Sin datos disponibles</div>
  );
  const maxV = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 w-36 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap" title={d[nameKey]}>
            {d[nameKey]}
          </span>
          <div className="flex-1 bg-slate-100 rounded-full h-4 relative">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d[valueKey] / maxV) * 100}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
          </div>
          <span className="text-[11px] text-slate-700 font-bold w-6 text-right shrink-0">{d[valueKey]}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card (igual al de RoleDashboard) ────────────────────────────────────
const KPICard = ({ icon: Icon, emoji, label, value, sub, colorClass = 'blue' }) => {
  const colorMap = {
    blue: { border: 'border-blue-200', bg: 'bg-blue-100', icon: 'text-blue-600', label: 'text-blue-600', val: 'text-blue-800', sub: 'text-blue-500' },
    indigo: { border: 'border-indigo-200', bg: 'bg-indigo-100', icon: 'text-indigo-600', label: 'text-indigo-600', val: 'text-indigo-800', sub: 'text-indigo-500' },
    amber: { border: 'border-amber-200', bg: 'bg-amber-100', icon: 'text-amber-600', label: 'text-amber-600', val: 'text-amber-800', sub: 'text-amber-500' },
    violet: { border: 'border-violet-200', bg: 'bg-violet-100', icon: 'text-violet-600', label: 'text-violet-600', val: 'text-violet-800', sub: 'text-violet-500' },
    emerald: { border: 'border-emerald-200', bg: 'bg-emerald-100', icon: 'text-emerald-600', label: 'text-emerald-600', val: 'text-emerald-800', sub: 'text-emerald-500' },
    cyan: { border: 'border-cyan-200', bg: 'bg-cyan-100', icon: 'text-cyan-600', label: 'text-cyan-600', val: 'text-cyan-800', sub: 'text-cyan-500' },
  };
  const c = colorMap[colorClass] || colorMap.blue;
  return (
    <div className={`bg-white ${c.border} border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all-300 flex-1 min-w-40`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[9px] font-black uppercase tracking-widest ${c.label}`}>{label}</span>
        <div className={`w-8 h-8 ${c.bg} rounded-xl flex items-center justify-center`}>
          {Icon ? <Icon className={`w-4 h-4 ${c.icon}`} /> : <span className="text-base">{emoji}</span>}
        </div>
      </div>
      <div className={`text-3xl font-black ${c.val}`}>{value}</div>
      {sub && <div className={`text-[10px] ${c.sub} font-semibold mt-1`}>{sub}</div>}
    </div>
  );
};

// ─── Panel Card (igual que los paneles de RoleDashboard) ─────────────────────
const Panel = ({ title, emoji, children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-sm ${className}`}>
    {title && (
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
        {emoji && <span>{emoji}</span>}{title}
      </h3>
    )}
    {children}
  </div>
);

// ─── Filtros comunes ─────────────────────────────────────────────────────────
const FiltrosPanel = ({ filters, setFilters, vendedores }) => (
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
    <div className="flex gap-3 flex-wrap items-end">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-1.5">Desde</label>
        <input type="date" value={filters.fecha_desde}
          onChange={e => setFilters(f => ({ ...f, fecha_desde: e.target.value }))}
          className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 transition-all-300 shadow-sm" />
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-1.5">Hasta</label>
        <input type="date" value={filters.fecha_hasta}
          onChange={e => setFilters(f => ({ ...f, fecha_hasta: e.target.value }))}
          className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 transition-all-300 shadow-sm" />
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-1.5">Vendedor</label>
        <select value={filters.vendedor}
          onChange={e => setFilters(f => ({ ...f, vendedor: e.target.value }))}
          className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 transition-all-300 shadow-sm">
          <option value="">Todos</option>
          {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-1.5">Cliente</label>
        <input type="text" value={filters.cliente}
          onChange={e => setFilters(f => ({ ...f, cliente: e.target.value }))}
          placeholder="Buscar cliente..."
          className="bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 transition-all-300 shadow-sm w-48" />
      </div>
      <button
        onClick={() => setFilters({ fecha_desde: '', fecha_hasta: '', vendedor: '', cliente: '' })}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-all-300 shadow-sm cursor-pointer">
        <X className="w-3 h-3" /> Limpiar
      </button>
    </div>
  </div>
);

// ─── Tablero 1: Performance Comercial ────────────────────────────────────────
const TabPerformanceComercial = ({ kpis, evolucion, topModelos, vendedores, filters, setFilters }) => {
  const [auditoriaVendedor, setAuditoriaVendedor] = useState(null);
  const [showAuditoria, setShowAuditoria] = useState(false);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);
  const [allVentas, setAllVentas] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.fecha_desde) params.set('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) params.set('fecha_hasta', filters.fecha_hasta);
    if (filters.vendedor) params.set('vendedor', filters.vendedor);
    if (filters.cliente) params.set('cliente', filters.cliente);
    fetch(`/api/gerencia/ventas-historicas?${params}`)
      .then(r => r.json()).then(setAllVentas).catch(() => { });
  }, [filters]);

  const abrirAuditoria = async () => {
    if (!filters.vendedor) return alert('Seleccioná un vendedor para abrir la Auditoría IA.');
    setLoadingAuditoria(true);
    try {
      const res = await fetch(`/api/gerencia/auditoria-vendedor/${encodeURIComponent(filters.vendedor)}`);
      setAuditoriaVendedor(await res.json());
      setShowAuditoria(true);
    } catch (e) { console.error(e); }
    setLoadingAuditoria(false);
  };

  const geoMap = {};
  allVentas.forEach(v => {
    if (v.latitud && v.longitud) {
      const k = `${Number(v.latitud).toFixed(3)},${Number(v.longitud).toFixed(3)}`;
      if (!geoMap[k]) {
        geoMap[k] = { 
          lat: parseFloat(v.latitud), 
          lng: parseFloat(v.longitud), 
          count: 0, 
          localidad: v.localidad || '',
          eventos: []
        };
      }
      geoMap[k].count++;
      geoMap[k].eventos.push({
        cliente: v.cliente_nombre || 'Cliente Desconocido',
        fecha: v.fecha_armado ? String(v.fecha_armado).substring(0, 10) : 'Sin fecha'
      });
    }
  });
  const geoPoints = Object.values(geoMap);

  return (
    <div className="space-y-5">
      <FiltrosPanel filters={filters} setFilters={setFilters} vendedores={vendedores} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={BarChart3} label="m² Traccionados" value={`${fmt(kpis.totalM2)} m²`} colorClass="cyan" />
        <KPICard icon={TrendingUp} label="Total Eventos" value={fmt(kpis.totalEventos)} colorClass="blue" />
        <KPICard icon={BarChart3} label="Ticket Medio" value={`${fmt(kpis.ticketMedio, 1)} m²`} colorClass="violet" />
        <KPICard icon={MapPin} label="Eventos c/ Geo" value={fmt(geoPoints.reduce((s, g) => s + g.count, 0))} sub="con geolocalización" colorClass="emerald" />
      </div>

      {/* Auditoría IA */}
      {filters.vendedor && (
        <div className="flex justify-end">
          <button onClick={abrirAuditoria} disabled={loadingAuditoria}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer disabled:opacity-60">
            <TrendingUp className="w-4 h-4" />
            {loadingAuditoria ? 'Cargando...' : 'Auditoría IA'}
          </button>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Evolución Mensual de Cierres">
          <LineChart data={evolucion} xKey="mes" yKey="cierres" color="#2563eb" />
        </Panel>
        <Panel title="Top 10 Modelos de Estructura">
          <BarChart data={topModelos} nameKey="nombre" valueKey="cantidad" color="#1d4ed8" />
        </Panel>
      </div>

      {/* Top 3 Clientes y Estructuras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top 3 Clientes">
          {(kpis.top3Clientes || []).map((c, i) => (
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-700 font-semibold">{i + 1}. {c.nombre}</span>
              <span className="text-xs font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{c.cantidad} eventos</span>
            </div>
          ))}
          {(!kpis.top3Clientes || kpis.top3Clientes.length === 0) && (
            <div className="text-center text-slate-400 text-sm py-4">Sin datos</div>
          )}
        </Panel>
        <Panel title="Top 3 Estructuras">
          {(kpis.top3Estructuras || []).map((c, i) => (
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-700 font-semibold">{i + 1}. {c.nombre}</span>
              <span className="text-xs font-black text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{c.cantidad} eventos</span>
            </div>
          ))}
          {(!kpis.top3Estructuras || kpis.top3Estructuras.length === 0) && (
            <div className="text-center text-slate-400 text-sm py-4">Sin datos</div>
          )}
        </Panel>
      </div>

      {/* Mapa Leaflet */}
      {geoPoints.length > 0 && (
        <Panel title="Densidad Geográfica de Eventos">
          <MapContainer center={[-34.6, -58.4]} zoom={8} style={{ height: 320, width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
            />
            {geoPoints.map((p, i) => (
              <CircleMarker key={i} center={[p.lat, p.lng]} radius={Math.max(5, Math.min(20, p.count * 2))}
                pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.5 }}>
                <Popup>
                  <div className="font-sans text-[11px] text-slate-600 max-w-[200px]">
                    <div className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-1.5 flex justify-between items-center">
                      <span>{p.localidad || 'Sin localidad'}</span>
                      <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-black text-[9px] ml-2">
                        {p.count} {p.count === 1 ? 'evento' : 'eventos'}
                      </span>
                    </div>
                    <div className="max-h-[120px] overflow-y-auto space-y-1 pr-1">
                      {p.eventos.map((ev, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 flex flex-col">
                          <span className="font-bold text-slate-700 truncate">{ev.cliente}</span>
                          <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                            📅 {ev.fecha}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </Panel>
      )}

      {/* Modal Auditoría IA */}
      {showAuditoria && auditoriaVendedor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black uppercase text-indigo-900 tracking-wider flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-600" />
                Auditoría IA — {auditoriaVendedor.vendedor}
              </h2>
              <button onClick={() => setShowAuditoria(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 rounded-xl transition-all-300 cursor-pointer border-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!auditoriaVendedor.encontrado ? (
              <p className="text-red-500 text-sm">No se encontraron datos para este vendedor.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <KPICard label="Total Eventos" value={auditoriaVendedor.total_eventos} colorClass="blue" />
                  <KPICard label="Ticket Medio m²" value={`${auditoriaVendedor.ticket_medio_m2} m²`} colorClass="amber" />
                  <KPICard label="Estructura Estrella" value={auditoriaVendedor.estructura_principal || '─'} colorClass="violet" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Matriz de Periodicidad de Clientes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {['Estado', 'Cliente', 'Última Compra', 'Días Inactivo', 'Total Compras'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(auditoriaVendedor.matriz_periodicidad || []).map((c, i) => (
                        <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                          <td className="px-3 py-2"><SemaforoIcon dias={c.dias_inactividad} /></td>
                          <td className="px-3 py-2 text-slate-700 font-semibold">{c.cliente}</td>
                          <td className="px-3 py-2 text-slate-500">{c.ultima_compra ? String(c.ultima_compra).substring(0, 10) : '─'}</td>
                          <td className={`px-3 py-2 font-bold ${c.semaforo === 'rojo' ? 'text-red-500' : c.semaforo === 'amarillo' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {c.dias_inactividad !== null ? `${c.dias_inactividad} días` : '─'}
                          </td>
                          <td className="px-3 py-2 text-violet-600 font-bold">{c.total_compras}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tablero 2: BI Predictivo de Cliente ─────────────────────────────────────
const TabBICliente = () => {
  const [busqueda, setBusqueda] = useState('');
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const buscarCliente = async (q) => {
    if (!q || q.length < 3) { setPerfil(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/gerencia/cliente-perfil/${encodeURIComponent(q)}`);
      const data = await res.json();
      setPerfil(data.encontrado ? data : null);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleBusqueda = (val) => {
    setBusqueda(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarCliente(val), 500);
  };

  const frecuenciaMensual = perfil?.rows ? (() => {
    const byMonth = {};
    perfil.rows.forEach(r => {
      const m = r.fecha_armado ? String(r.fecha_armado).substring(0, 7) : null;
      if (m) byMonth[m] = (byMonth[m] || 0) + 1;
    });
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, cierres]) => ({ mes, cierres }));
  })() : [];

  return (
    <div className="space-y-5">
      {/* Buscador */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
        <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 block mb-2 flex items-center gap-1.5">
          <Search className="w-3 h-3" /> Buscar Cliente
        </label>
        <input type="text" value={busqueda} onChange={e => handleBusqueda(e.target.value)}
          placeholder="Escribí el nombre del cliente (mínimo 3 caracteres)..."
          className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 transition-all-300 shadow-sm" />
        {loading && <div className="text-slate-400 text-xs mt-2 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Buscando...</div>}
      </div>

      {perfil && perfil.encontrado && (
        <>
          {/* Header Cliente */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100 rounded-2xl p-5">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-black text-indigo-900 mb-2">{perfil.cliente_nombre}</h2>
                <div className="flex gap-4 flex-wrap">
                  <span className="text-xs text-slate-500 font-semibold">{perfil.condicion_fiscal || 'Cond. Fiscal no registrada'}</span>
                  <span className="text-xs text-slate-500 font-semibold">{perfil.condicion_pago || 'Cond. Pago no registrada'}</span>
                  <span className="text-xs text-slate-500 font-semibold">{perfil.vendedor_principal || 'Sin vendedor asignado'}</span>
                  <span className="text-xs text-slate-500 font-semibold">{perfil.estructura_principal || 'Sin estructura predominante'}</span>
                </div>
              </div>
              <div className="text-center">
                <SemaforoIcon dias={perfil.dias_inactividad} />
                <div className="text-[10px] text-slate-400 mt-1">{perfil.dias_inactividad} días inactivo</div>
              </div>
            </div>
          </div>

          {/* KPIs del cliente */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Eventos" value={perfil.total_eventos} colorClass="blue" />
            <KPICard label="Ciclo Promedio" value={perfil.ciclo_promedio_dias ? `${perfil.ciclo_promedio_dias}d` : '─'} sub="días entre compras" colorClass="amber" />
            <KPICard label="Adicional Preferido" value={perfil.adicional_preferido ? perfil.adicional_preferido.charAt(0).toUpperCase() + perfil.adicional_preferido.slice(1) : '─'} colorClass="violet" />
            <KPICard label="Último Evento" value={perfil.ultima_compra ? String(perfil.ultima_compra).substring(0, 10) : '─'} colorClass="emerald" />
          </div>

          {/* Gráfico + Predicción IA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Frecuencia Mensual">
              <LineChart data={frecuenciaMensual} xKey="mes" yKey="cierres" color="#7c3aed" />
            </Panel>
            <Panel title="Auditoría IA Predictiva">
              <div className="space-y-3">
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-violet-500 mb-1">Próxima Venta Estimada</div>
                  <div className="text-2xl font-black text-violet-700">{perfil.proxima_venta_estimada || '─'}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Basado en ciclo de {perfil.ciclo_promedio_dias || '?'} días</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Inicio de Armado Sugerido</div>
                  <div className="text-2xl font-black text-amber-700">{perfil.inicio_armado_sugerido || '─'}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Lead Time histórico: {perfil.lead_time_promedio_dias || '?'} días</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Confianza del Modelo</div>
                  <div className={`text-sm font-bold ${perfil.total_eventos >= 5 ? 'text-emerald-600' : perfil.total_eventos >= 2 ? 'text-amber-600' : 'text-red-500'}`}>
                    {perfil.total_eventos >= 5 ? 'Alta' : perfil.total_eventos >= 2 ? 'Media' : 'Baja'}
                    <span className="text-xs text-slate-400 font-normal ml-2">({perfil.total_eventos} eventos históricos)</span>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          {/* Historial de eventos */}
          <Panel title="Historial de Eventos">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    {['Armado', 'Desarme', 'Carpa', 'Sup. m²', 'Vendedor', 'Adicionales'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(perfil.rows || []).slice().reverse().map((r, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="px-3 py-2 text-slate-700 font-semibold">{String(r.fecha_armado || '').substring(0, 10)}</td>
                      <td className="px-3 py-2 text-slate-500">{String(r.fecha_desarme || '').substring(0, 10)}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-44 overflow-hidden text-ellipsis whitespace-nowrap">{r.carpa_raw || '─'}</td>
                      <td className="px-3 py-2 text-amber-600 font-bold">{r.superficie_m2 || '─'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.vendedor || '─'}</td>
                      <td className="px-3 py-2">
                        {['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].filter(a => r[a]).map(a => (
                          <span key={a} className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 mr-1 font-semibold">{a}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
      {busqueda.length >= 3 && !loading && (!perfil || !perfil.encontrado) && (
        <div className="text-center py-12 text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <div className="text-sm">No se encontraron datos para "{busqueda}"</div>
        </div>
      )}
    </div>
  );
};

// ─── Tablero 3: Desglose Operativo ───────────────────────────────────────────
const TabDesglosOperativo = () => {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [busquedaCli, setBusquedaCli] = useState('');

  useEffect(() => {
    fetch('/api/gerencia/ventas-historicas').then(r => r.json()).then(data => {
      setVentas(data);
    }).catch(() => {});
    fetch('/api/gerencia/clientes-csv').then(r => r.json()).then(data => {
      setClientes(data.map(c => c.nombre).sort());
    }).catch(() => {});
  }, []);

  const clienteFiltrado = busquedaCli ? clientes.filter(c => c.toLowerCase().includes(busquedaCli.toLowerCase())) : clientes;
  const ventasCliente = clienteSeleccionado ? ventas.filter(v => v.cliente_nombre === clienteSeleccionado) : [];
  const allCarpas = ventasCliente.flatMap(v => (v.carpa_raw || '').split('|').map(s => s.trim()).filter(Boolean));
  const adCounts = {};
  ['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].forEach(a => {
    adCounts[a] = ventasCliente.filter(v => v[a]).length;
  });
  const adPreferido = Object.entries(adCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
      {/* Lista de clientes */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm max-h-[600px] overflow-auto">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
          <Users className="w-3 h-3" /> Clientes
        </h3>
        <input type="text" value={busquedaCli} onChange={e => setBusquedaCli(e.target.value)}
          placeholder="Filtrar..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 mb-3 transition-all-300" />
        {clienteFiltrado.map(c => (
          <div key={c} onClick={() => setClienteSeleccionado(c)}
            className={`px-3 py-2 rounded-xl cursor-pointer mb-1 text-xs font-semibold transition-all-300 ${clienteSeleccionado === c
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'text-slate-500 hover:bg-slate-50 border border-transparent'
              }`}>
            {c}
          </div>
        ))}
      </div>

      {/* Detalle del cliente */}
      <div className="space-y-4">
        {clienteSeleccionado ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard label="Total Contratos" value={ventasCliente.length} colorClass="blue" />
              <KPICard label="Módulos Independientes" value={allCarpas.length} sub="post-split por |" colorClass="amber" />
              <KPICard label="Adicional Preferido" value={adPreferido && adPreferido[1] > 0 ? adPreferido[0].charAt(0).toUpperCase() + adPreferido[0].slice(1) : '─'} colorClass="violet" />
            </div>
            <Panel title="Matriz de Adicionales">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Contrato / Fecha</th>
                      {['Piso', 'Tarima', 'Alfombra', 'Cortina', 'Tribuna', 'Sillas'].map(h => (
                        <th key={h} className="text-center px-2 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 w-14">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ventasCliente.slice().reverse().map((v, i) => (
                      <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        <td className="px-3 py-2">
                          <div className="text-slate-700 font-semibold">{v.carpa_raw?.substring(0, 30)}{v.carpa_raw?.length > 30 ? '…' : ''}</div>
                          <div className="text-[10px] text-slate-400">{String(v.fecha_armado || '').substring(0, 10)}</div>
                        </td>
                        {['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].map(a => (
                          <td key={a} className="text-center px-2 py-2">
                            {v[a] ? <span className="text-emerald-500 font-black text-base">✓</span> : <span className="text-slate-200 text-sm">✗</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="px-3 py-2 text-slate-500 font-black text-[10px] uppercase tracking-wider">Total / Frecuencia</td>
                      {['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].map(a => (
                        <td key={a} className="text-center px-2 py-2 text-amber-600 font-black text-xs">
                          {ventasCliente.length > 0 ? `${Math.round((adCounts[a] / ventasCliente.length) * 100)}%` : '─'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        ) : (
          <div className="text-center py-20 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <div className="text-sm">Seleccioná un cliente de la lista</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tablero 4: Demanda Predictiva IA ────────────────────────────────────────
const TabDemandaPredictiva = () => {
  const [horizonte, setHorizonte] = useState('mes');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState(null);

  const cargarDemanda = async (h) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gerencia/demanda-predictiva?horizonte=${h}`);
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargarDemanda(horizonte); }, [horizonte]);

  const etiquetaHorizonte = {
    semana: 'Próxima Semana',
    mes: 'Próximo Mes',
    trimestre: 'Próximo Trimestre',
    marzo: 'Mes de Marzo',
    diciembre: 'Mes de Diciembre'
  };
  const adLabels = { piso: 'Piso', tarima: 'Tarima', alfombra: 'Alfombra', cortina: 'Cortina', tribuna: 'Tribuna', sillas: 'Sillas' };

  return (
    <div className="space-y-5">
      {/* Selector de horizonte */}
      <Panel title="Horizonte de Planificación">
        <div className="flex gap-2 flex-wrap">
          {['semana', 'mes', 'trimestre', 'marzo', 'diciembre'].map(h => (
            <button key={h} onClick={() => setHorizonte(h)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all-300 cursor-pointer ${horizonte === h
                ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600'
                }`}>
              {etiquetaHorizonte[h]}
            </button>
          ))}
        </div>
      </Panel>

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-violet-400" />
          <div className="text-sm">Calculando predicciones...</div>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <KPICard label="Clientes en Rango" value={data.total_clientes_en_rango} sub={etiquetaHorizonte[horizonte]} colorClass="violet" />
            <KPICard label="Modelos Necesarios" value={data.demanda_carpas?.length || 0} sub="modelos diferentes" colorClass="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Demanda de estructuras */}
            <Panel title="Demanda de Estructuras">
              {(data.demanda_carpas || []).length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-6">Sin predicciones para este horizonte</div>
              ) : data.demanda_carpas.map((c, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700 font-semibold">{c.modelo}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{c.clientes.length} cliente(s)</span>
                    <span className="bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-3 py-0.5 font-black text-sm">{c.cantidad}</span>
                  </div>
                </div>
              ))}
            </Panel>

            {/* Probabilidad de adicionales */}
            <Panel title="Probabilidad de Adicionales">
              {Object.entries(data.adicionales_consolidado || {}).map(([a, prob]) => (
                <div key={a} className="mb-3 last:mb-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-500 font-semibold">{adLabels[a] || a}</span>
                    <span className={`text-xs font-black ${prob > 66 ? 'text-emerald-600' : prob > 33 ? 'text-amber-600' : 'text-red-500'}`}>{prob}%</span>
                  </div>
                  <div className="bg-slate-100 rounded-full h-2">
                    <div className={`h-full rounded-full transition-all duration-500 ${prob > 66 ? 'bg-emerald-400' : prob > 33 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${prob}%` }} />
                  </div>
                </div>
              ))}
            </Panel>
          </div>

          {/* Panel de justificación */}
          <Panel title="Panel de Justificación por Cliente">
            {(data.predicciones || []).length === 0 ? (
              <div className="text-center text-slate-400 text-sm py-6">Sin predicciones para este horizonte temporal</div>
            ) : data.predicciones.map((p, i) => (
              <div key={i} className={`border border-slate-200 rounded-xl mb-2 overflow-hidden transition-all-300 ${expandido === i ? 'shadow-sm' : ''}`}>
                <div onClick={() => setExpandido(expandido === i ? null : i)}
                  className={`flex justify-between items-center px-4 py-3 cursor-pointer transition-all-300 ${expandido === i ? 'bg-violet-50 border-b border-violet-100' : 'hover:bg-slate-50'}`}>
                  <div>
                    <span className="text-sm font-black text-slate-700">{p.cliente}</span>
                    <span className="text-xs text-slate-400 ml-3">→ {p.carpa_esperada || 'Sin modelo predefinido'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-violet-600 font-bold">{p.proxima_fecha}</span>
                    <span className={`text-xs font-black ${p.confianza === 'alta' ? 'text-emerald-500' : p.confianza === 'media' ? 'text-amber-500' : 'text-red-400'}`}>
                      {p.confianza}
                    </span>
                    {expandido === i ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
                {expandido === i && (
                  <div className="px-4 py-3 text-xs text-slate-500 bg-slate-50/50 flex flex-wrap gap-4">
                    <span>Ciclo: <strong className="text-slate-700">{p.ciclo_dias} días</strong></span>
                    <span>Última compra: <strong className="text-slate-700">{String(p.ultima_compra || '').substring(0, 10)}</strong></span>
                    <span>Historial: <strong className="text-slate-700">{p.total_eventos_historicos} eventos</strong></span>
                    <div className="w-full flex flex-wrap gap-2 mt-1">
                      {Object.entries(p.adicionales_prob).filter(([, v]) => v > 0).map(([a, v]) => (
                        <span key={a} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${v > 66 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : v > 33 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {a}: {v}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Panel>
        </>
      ) : null}
    </div>
  );
};

// ─── Tablero: Mapa de Clientes ───────────────────────────────────────────────
const TabMapaClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    fetch('/api/gerencia/clientes-csv')
      .then(r => r.json())
      .then(data => {
        // Filtrar solo los que tienen coordenadas válidas
        const conCoords = data.filter(c => {
          const lat = parseFloat(c.latitud);
          const lng = parseFloat(c.longitud);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        });
        // Ordenar por distancia ascendente
        conCoords.sort((a, b) => {
          const da = haversineKm(DANGIOLA_HQ.lat, DANGIOLA_HQ.lng, parseFloat(a.latitud), parseFloat(a.longitud));
          const db = haversineKm(DANGIOLA_HQ.lat, DANGIOLA_HQ.lng, parseFloat(b.latitud), parseFloat(b.longitud));
          return da - db;
        });
        setClientes(conCoords);
      })
      .catch(() => {});
  }, []);

  const clientesFiltrados = busqueda
    ? clientes.filter(c =>
        (c.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (c.localidad || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : clientes;

  const distancia = seleccionado
    ? haversineKm(DANGIOLA_HQ.lat, DANGIOLA_HQ.lng, parseFloat(seleccionado.latitud), parseFloat(seleccionado.longitud))
    : null;

  return (
    <div className="space-y-4">
      {/* KPI del cliente seleccionado */}
      {seleccionado && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Cliente" value={seleccionado.nombre || '─'} colorClass="indigo" />
          <KPICard label="Distancia desde HQ" value={distancia !== null ? `${distancia.toFixed(1)} km` : '─'} sub="Carpas D'Angiola · Burzaco" colorClass="violet" />
          <KPICard label="Localidad" value={seleccionado.localidad || '─'} colorClass="blue" />
          <KPICard label="Provincia" value={(seleccionado.provincia || '─').replace(/^\d+-/, '')} colorClass="emerald" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-4 items-start">

        {/* ── Sidebar de clientes ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> {clientes.length} clientes geocodificados
          </h3>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente o localidad..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all-300"
            />
          </div>
          <div className="max-h-[420px] overflow-y-auto space-y-0.5 pr-1">
            {clientesFiltrados.map((c, i) => {
              const dist = haversineKm(DANGIOLA_HQ.lat, DANGIOLA_HQ.lng, parseFloat(c.latitud), parseFloat(c.longitud));
              const isSelected = seleccionado?.nombre === c.nombre && seleccionado?.latitud === c.latitud;
              return (
                <div
                  key={i}
                  onClick={() => setSeleccionado(isSelected ? null : c)}
                  className={`px-3 py-2 rounded-xl cursor-pointer transition-all-300 border ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-bold truncate max-w-[170px]">{c.nombre}</span>
                    <span className={`text-[10px] font-black shrink-0 ${
                      dist < 30 ? 'text-emerald-500' : dist < 100 ? 'text-amber-500' : 'text-rose-500'
                    }`}>{dist.toFixed(0)} km</span>
                  </div>
                  {c.localidad && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {c.localidad.replace(/^\d+-/, '')}
                    </div>
                  )}
                </div>
              );
            })}
            {clientesFiltrados.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">Sin resultados</div>
            )}
          </div>
        </div>

        {/* ── Mapa ── */}
        <Panel title="Mapa de Clientes — Radio desde Carpas D'Angiola HQ">
          <MapContainer
            center={[DANGIOLA_HQ.lat, DANGIOLA_HQ.lng]}
            zoom={7}
            style={{ height: 520, width: '100%', borderRadius: 12 }}
            ref={mapRef}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
            />

            {/* HQ Marker — Carpas D'Angiola con logo */}
            <Marker
              center={[DANGIOLA_HQ.lat, DANGIOLA_HQ.lng]}
              position={[DANGIOLA_HQ.lat, DANGIOLA_HQ.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="
                  width:44px;height:44px;
                  background:#fff;
                  border:3px solid #1d4ed8;
                  border-radius:50%;
                  display:flex;align-items:center;justify-content:center;
                  box-shadow:0 2px 8px rgba(0,0,0,0.25);
                  overflow:hidden;
                "><img src="/log.png" style="width:32px;height:32px;object-fit:contain;" /></div>`,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
                popupAnchor: [0, -24]
              })}
            >
              <Popup>
                <div style={{ textAlign: 'center', minWidth: 160 }}>
                  <img src="/log.png" alt="Carpas D'Angiola" style={{ height: 36, margin: '0 auto 6px', display: 'block' }} />
                  <strong style={{ fontSize: 12 }}>Carpas D'Angiola — HQ</strong><br />
                  <span style={{ fontSize: 11, color: '#64748b' }}>Juan XXIII 2980, Burzaco</span>
                </div>
              </Popup>
            </Marker>

            {/* Clientes */}
            {clientesFiltrados.map((c, i) => {
              const lat = parseFloat(c.latitud);
              const lng = parseFloat(c.longitud);
              const isSelected = seleccionado?.nombre === c.nombre && seleccionado?.latitud === c.latitud;
              const dist = haversineKm(DANGIOLA_HQ.lat, DANGIOLA_HQ.lng, lat, lng);
              return (
                <CircleMarker
                  key={i}
                  center={[lat, lng]}
                  radius={isSelected ? 9 : 5}
                  pathOptions={{
                    color: isSelected ? '#7c3aed' : dist < 30 ? '#059669' : dist < 100 ? '#d97706' : '#dc2626',
                    fillColor: isSelected ? '#8b5cf6' : dist < 30 ? '#10b981' : dist < 100 ? '#f59e0b' : '#ef4444',
                    fillOpacity: isSelected ? 1 : 0.75,
                    weight: isSelected ? 3 : 1.5
                  }}
                  eventHandlers={{ click: () => setSeleccionado(isSelected ? null : c) }}
                >
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong style={{ fontSize: 12 }}>{c.nombre}</strong><br />
                      {c.domicilio && <><span style={{ fontSize: 11 }}>{c.domicilio}</span><br /></>}
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {(c.localidad || '').replace(/^\d+-/, '')} {c.provincia ? `— ${c.provincia.replace(/^\d+-/, '')}` : ''}
                      </span><br />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>
                        Distancia: {dist.toFixed(1)} km
                      </span>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Línea al cliente seleccionado */}
            {seleccionado && (
              <Polyline
                positions={[
                  [DANGIOLA_HQ.lat, DANGIOLA_HQ.lng],
                  [parseFloat(seleccionado.latitud), parseFloat(seleccionado.longitud)]
                ]}
                pathOptions={{ color: '#7c3aed', weight: 2, dashArray: '6 10', opacity: 0.8 }}
              />
            )}
          </MapContainer>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-4 mt-3 text-[10px] font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#3b82f6' }}></span>
              HQ Carpas D'Angiola
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#10b981' }}></span>
              0 – 30 km
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#f59e0b' }}></span>
              30 – 100 km
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#ef4444' }}></span>
              Más de 100 km
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#8b5cf6' }}></span>
              Cliente seleccionado
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

// ─── Cargador de Histórico ────────────────────────────────----------------────
function UploadHistoricoInline({ currentUser }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const parseCsv = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const firstLine = lines[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const sep = semicolons > commas ? ';' : ',';

    const headers = firstLine.split(sep).map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(sep).map(v => v.trim().replace(/"/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  };

  const downloadTemplate = () => {
    const headers = ['Armado', 'Desarme', 'Cliente', 'Vendedor', 'Carpa', 'Superficie', 'Localidad', 'Adicionales'];
    const examples = [
      ['2024-03-15', '2024-03-18', 'Empresa Ejemplo SA', 'Juan Pérez', 'Carpa 10x15 Aluminio', '150', 'Buenos Aires', 'Pisos: sí / Alfombra: gris'],
      ['2024-04-01', '2024-04-03', 'Eventos del Sur SRL', 'María García', 'Carpa 8x12 PVC', '96', 'La Plata', ''],
      ['2024-05-20', '2024-05-22', 'Club Atlético Norte', 'Carlos López', 'Carpa 6x10 Aluminio', '60', 'Quilmes', 'Lonas: blanco / Pisos: placa fenólico'],
    ];
    const csvContent = [headers, ...examples].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_ventas_historicas.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setCsvText(text);
      setPreview(parseCsv(text).slice(0, 5));
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleClearHistory = async () => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar TODOS los datos históricos? Esta acción es completamente irreversible.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/gerencia/delete-historico', {
        method: 'DELETE',
        headers: {
          'x-user-role': currentUser?.rol || ''
        }
      });
      if (!res.ok) {
        let errMsg = 'Error al vaciar el historial.';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      alert(`Éxito: ${data.mensaje} (Se eliminaron ${data.eliminados} registros)`);
      setCsvText('');
      setPreview([]);
      setResultado(null);
    } catch (e) {
      alert('Error al vaciar el historial: ' + e.message);
    }
    setLoading(false);
  };

  const handleImport = async () => {
    if (!csvText) return;
    setLoading(true);
    try {
      const rows = parseCsv(csvText);
      const res = await fetch('/api/gerencia/upload-historico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.rol || ''
        },
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        let errMsg = 'Error al importar.';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch (_) {
          errMsg = `Error del servidor (status ${res.status}): ${res.statusText || 'Error inesperado'}`;
        }
        throw new Error(errMsg);
      }
      setResultado(await res.json());
    } catch (e) { alert('Error al importar: ' + e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-black uppercase text-indigo-900 tracking-wider flex items-center gap-2 mb-1">
            <Upload className="w-5 h-5" /> Cargar Datos Históricos
          </h2>
          <p className="text-xs text-slate-500">
            El CSV debe tener las columnas:{' '}
            <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono text-[11px]">
              Armado, Desarme, Cliente, Vendedor, Carpa, Superficie, Localidad, Adicionales
            </code>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleClearHistory} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer">
            <Trash2 className="w-4 h-4" />
            Vaciar Historial
          </button>
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:opacity-90 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer">
            <Download className="w-4 h-4" />
            Descargar Plantilla CSV
          </button>
        </div>
      </div>

      {/* Info tip */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
        <div>
          <strong>¿Primera vez?</strong> Descargá la plantilla, completá tus datos históricos respetando el formato de las columnas y las fechas (
          <code className="bg-blue-100 text-blue-700 px-1 rounded font-mono">AAAA-MM-DD</code>
          ), y luego subí el archivo.
        </div>
      </div>

      {/* Drop zone */}
      <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl p-10 text-center cursor-pointer transition-all-300 bg-slate-50/50 hover:bg-blue-50/30">
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
        <Upload className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <div className="text-sm text-slate-500">Arrastrá tu archivo CSV o <span className="text-blue-600 underline font-semibold">hacé click para seleccionar</span></div>
        <div className="text-xs text-slate-400 mt-1.5">Formatos soportados: .csv (separado por comas, codificación UTF-8)</div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <Panel title={`Preview — Primeras 5 filas (${parseCsv(csvText).length} registros totales)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200">
                  {Object.keys(preview[0]).map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-3 py-2 text-slate-700">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Botón importar */}
      {preview.length > 0 && !resultado && (
        <button onClick={handleImport} disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 disabled:opacity-60 text-white rounded-xl text-sm font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer">
          <Upload className="w-4 h-4" />
          {loading ? 'Importando...' : `Importar ${parseCsv(csvText).length} Registros`}
        </button>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="text-emerald-700 font-black text-base mb-1">Importación Completada</div>
          <div className="text-emerald-600 text-sm">{resultado.insertados} registros insertados de {resultado.total_enviados} enviados.</div>
          <button onClick={() => { setResultado(null); setCsvText(''); setPreview([]); }}
            className="mt-3 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold transition-all-300 cursor-pointer">
            Cargar otro archivo
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal: VigIA Dashboard ────────────────--------------------
export default function GerenciaDashboard({ currentUser, onClose }) {
  const [activeTab, setActiveTab] = useState('performance');
  const [kpis, setKpis] = useState({ totalM2: 0, totalEventos: 0, ticketMedio: 0, top3Clientes: [], top3Estructuras: [] });
  const [evolucion, setEvolucion] = useState([]);
  const [topModelos, setTopModelos] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [filters, setFilters] = useState({ fecha_desde: '', fecha_hasta: '', vendedor: '', cliente: '' });
  const [loadingKpis, setLoadingKpis] = useState(false);

  const fetchKpis = async () => {
    setLoadingKpis(true);
    const params = new URLSearchParams();
    if (filters.fecha_desde) params.set('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) params.set('fecha_hasta', filters.fecha_hasta);
    if (filters.vendedor) params.set('vendedor', filters.vendedor);
    if (filters.cliente) params.set('cliente', filters.cliente);
    try {
      const [kpisRes, evRes, modelosRes, vendRes] = await Promise.all([
        fetch(`/api/gerencia/kpis?${params}`).then(r => r.json()),
        fetch(`/api/gerencia/evolucion-mensual?${params}`).then(r => r.json()),
        fetch(`/api/gerencia/top-modelos?${params}`).then(r => r.json()),
        fetch('/api/gerencia/vendedores').then(r => r.json())
      ]);
      setKpis(kpisRes);
      setEvolucion(evRes);
      setTopModelos(modelosRes);
      setVendedores(vendRes);
    } catch (e) { console.error(e); }
    setLoadingKpis(false);
  };

  useEffect(() => { fetchKpis(); }, [filters]);

  const tabs = [
    { id: 'performance', icon: BarChart3, label: 'Performance Comercial' },
    { id: 'bicliente',   icon: Users,      label: 'BI Predictivo Cliente' },
    { id: 'desglose',   icon: TrendingUp,  label: 'Desglose Operativo' },
    { id: 'demanda',    icon: MapPin,      label: 'Demanda Predictiva IA' },
    { id: 'mapa',       icon: Globe,       label: 'Mapa de Clientes' },
    ...(currentUser?.rol === 'SuperAdmin' ? [{ id: 'upload', icon: Upload, label: 'Cargar Histórico' }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header del Dashboard */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase text-indigo-900 tracking-wider Poppins">
                  VigIA — Business Intelligence Console
                </h1>
                <p className="text-xs text-indigo-500 font-semibold">Carpas D'Angiola · Inteligencia Comercial Avanzada</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loadingKpis && (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando...
              </div>
            )}
            <div className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <User className="w-3 h-3" /> {currentUser?.nombre}
            </div>
            <button onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-500 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
          </div>
        </div>

        {/* Tab navigation — igual al estilo de las sub-tabs en RoleDashboard */}
        <div className="flex gap-1 border-b border-slate-200 mt-5 pb-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest border-b-2 whitespace-nowrap transition-all-300 cursor-pointer ${activeTab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                }`}>
              <t.icon className="w-3 h-3" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenido del tab activo */}
      <div>
        {activeTab === 'performance' && (
          <TabPerformanceComercial kpis={kpis} evolucion={evolucion} topModelos={topModelos} vendedores={vendedores} filters={filters} setFilters={setFilters} />
        )}
        {activeTab === 'bicliente' && <TabBICliente />}
        {activeTab === 'desglose' && <TabDesglosOperativo />}
        {activeTab === 'demanda' && <TabDemandaPredictiva />}
        {activeTab === 'mapa' && <TabMapaClientes />}
        {activeTab === 'upload' && <UploadHistoricoInline currentUser={currentUser} />}
      </div>
    </div>
  );
}
