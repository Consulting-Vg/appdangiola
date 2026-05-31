import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

// ─── Mini Helpers ─────────────────────────────────────────────────────────────
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: d });

const SemaforoIcon = ({ dias }) => {
  if (dias === null || dias === undefined) return <span style={{ color: '#64748b' }}>─</span>;
  if (dias > 180) return <span title={`${dias} días`} style={{ color: '#ef4444', fontSize: 18 }}>🔴</span>;
  if (dias > 90)  return <span title={`${dias} días`} style={{ color: '#f59e0b', fontSize: 18 }}>🟡</span>;
  return                 <span title={`${dias} días`} style={{ color: '#22c55e', fontSize: 18 }}>🟢</span>;
};

// ─── Gráfico de Líneas (SVG nativo) ──────────────────────────────────────────
const LineChart = ({ data, xKey = 'mes', yKey = 'cierres', color = '#06b6d4', label = 'Cierres' }) => {
  if (!data || data.length === 0) return <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Sin datos</div>;
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
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
        const y = H - PAD - ((d[yKey] / maxV) * (H - PAD * 2));
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={4} fill={color} />
            <text x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="#94a3b8">{d[xKey]?.substring(5)}</text>
            <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="#e2e8f0">{d[yKey]}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Gráfico de Barras Horizontal (SVG nativo) ────────────────────────────────
const BarChart = ({ data, nameKey = 'nombre', valueKey = 'cantidad', color = '#f59e0b' }) => {
  if (!data || data.length === 0) return <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Sin datos</div>;
  const maxV = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}
                title={d[nameKey]}>{d[nameKey]}</span>
          <div style={{ flex: 1, background: '#1e293b', borderRadius: 4, height: 18, position: 'relative' }}>
            <div style={{
              width: `${(d[valueKey] / maxV) * 100}%`, background: `linear-gradient(90deg, ${color}99, ${color})`,
              height: '100%', borderRadius: 4, transition: 'width 0.6s ease'
            }} />
          </div>
          <span style={{ fontSize: 11, color: '#e2e8f0', width: 28, textAlign: 'right', flexShrink: 0 }}>{d[valueKey]}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPICard = ({ icon, label, value, sub, color = '#06b6d4' }) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}30`,
    borderRadius: 16, padding: '20px 22px', flex: 1, minWidth: 160,
    boxShadow: `0 0 20px ${color}15`
  }}>
    <div style={{ fontSize: 26, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: color, marginTop: 4 }}>{sub}</div>}
  </div>
);

// ─── Tablero 1: Performance Comercial ─────────────────────────────────────────
const TabPerformanceComercial = ({ kpis, evolucion, topModelos, vendedores, filters, setFilters }) => {
  const [auditoriaVendedor, setAuditoriaVendedor] = useState(null);
  const [showAuditoria, setShowAuditoria] = useState(false);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);
  const [allVentas, setAllVentas] = useState([]);

  useEffect(() => {
    // Cargar ventas para el mapa
    const params = new URLSearchParams();
    if (filters.fecha_desde) params.set('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) params.set('fecha_hasta', filters.fecha_hasta);
    if (filters.vendedor) params.set('vendedor', filters.vendedor);
    if (filters.cliente) params.set('cliente', filters.cliente);
    fetch(`/api/gerencia/ventas-historicas?${params}`)
      .then(r => r.json()).then(setAllVentas).catch(() => {});
  }, [filters]);

  const abrirAuditoria = async () => {
    if (!filters.vendedor) return alert('Seleccioná un vendedor para abrir la Auditoría IA.');
    setLoadingAuditoria(true);
    try {
      const res = await fetch(`/api/gerencia/auditoria-vendedor/${encodeURIComponent(filters.vendedor)}`);
      const data = await res.json();
      setAuditoriaVendedor(data);
      setShowAuditoria(true);
    } catch (e) { console.error(e); }
    setLoadingAuditoria(false);
  };

  // Agrupar por localidad para el mapa
  const geoMap = {};
  allVentas.forEach(v => {
    if (v.latitud && v.longitud) {
      const k = `${Number(v.latitud).toFixed(3)},${Number(v.longitud).toFixed(3)}`;
      if (!geoMap[k]) geoMap[k] = { lat: parseFloat(v.latitud), lng: parseFloat(v.longitud), count: 0, localidad: v.localidad || '' };
      geoMap[k].count++;
    }
  });
  const geoPoints = Object.values(geoMap);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filtros */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>DESDE</label>
            <input type="date" value={filters.fecha_desde} onChange={e => setFilters(f => ({ ...f, fecha_desde: e.target.value }))}
              style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>HASTA</label>
            <input type="date" value={filters.fecha_hasta} onChange={e => setFilters(f => ({ ...f, fecha_hasta: e.target.value }))}
              style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>VENDEDOR</label>
            <select value={filters.vendedor} onChange={e => setFilters(f => ({ ...f, vendedor: e.target.value }))}
              style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 13 }}>
              <option value="">Todos</option>
              {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>CLIENTE</label>
            <input type="text" value={filters.cliente} onChange={e => setFilters(f => ({ ...f, cliente: e.target.value }))}
              placeholder="Buscar cliente..." style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, width: 180 }} />
          </div>
          <button onClick={abrirAuditoria} disabled={loadingAuditoria}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: 8, padding: '8px 16px',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            🧠 {loadingAuditoria ? 'Cargando...' : 'Auditoría IA'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KPICard icon="📐" label="m² Traccionados" value={`${fmt(kpis.totalM2)} m²`} color="#06b6d4" />
        <KPICard icon="📋" label="Total Eventos" value={fmt(kpis.totalEventos)} color="#f59e0b" />
        <KPICard icon="📊" label="Ticket Medio" value={`${fmt(kpis.ticketMedio, 1)} m²`} color="#a78bfa" />
        <KPICard icon="📍" label="Eventos c/ Geo" value={fmt(geoPoints.reduce((s, g) => s + g.count, 0))} sub="con geolocalización" color="#22c55e" />
      </div>

      {/* Gráficos + Tops */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>📈 Evolución Mensual</h3>
          <LineChart data={evolucion} xKey="mes" yKey="cierres" color="#06b6d4" />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>🏆 Top 10 Modelos</h3>
          <BarChart data={topModelos} nameKey="nombre" valueKey="cantidad" color="#f59e0b" />
        </div>
      </div>

      {/* Top 3 Clientes + Estructuras */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>🥇 Top 3 Clientes</h3>
          {(kpis.top3Clientes || []).map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
              <span style={{ color: '#e2e8f0', fontSize: 13 }}>{['🥇','🥈','🥉'][i]} {c.nombre}</span>
              <span style={{ color: '#f59e0b', fontWeight: 700 }}>{c.cantidad} eventos</span>
            </div>
          ))}
          {(!kpis.top3Clientes || kpis.top3Clientes.length === 0) && <div style={{ color: '#475569', fontSize: 13 }}>Sin datos</div>}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>🏗️ Top 3 Estructuras</h3>
          {(kpis.top3Estructuras || []).map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
              <span style={{ color: '#e2e8f0', fontSize: 13 }}>{['🥇','🥈','🥉'][i]} {c.nombre}</span>
              <span style={{ color: '#06b6d4', fontWeight: 700 }}>{c.cantidad} eventos</span>
            </div>
          ))}
          {(!kpis.top3Estructuras || kpis.top3Estructuras.length === 0) && <div style={{ color: '#475569', fontSize: 13 }}>Sin datos</div>}
        </div>
      </div>

      {/* Mapa */}
      {geoPoints.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b' }}>
            <h3 style={{ color: '#94a3b8', fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>🗺️ Densidad Geográfica de Eventos</h3>
          </div>
          <MapContainer center={[-34.6, -58.4]} zoom={8} style={{ height: 320, width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
            {geoPoints.map((p, i) => (
              <CircleMarker key={i} center={[p.lat, p.lng]} radius={Math.max(5, Math.min(20, p.count * 2))}
                pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.5 }}>
                <Popup>{p.localidad || 'Sin localidad'}<br />{p.count} evento(s)</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Modal Auditoría IA */}
      {showAuditoria && auditoriaVendedor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0d1526', border: '1px solid #334155', borderRadius: 20, width: '90%', maxWidth: 800, maxHeight: '85vh', overflow: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ color: '#f1f5f9', margin: 0 }}>🧠 Auditoría IA — {auditoriaVendedor.vendedor}</h2>
              <button onClick={() => setShowAuditoria(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            {!auditoriaVendedor.encontrado ? (
              <p style={{ color: '#ef4444' }}>No se encontraron datos para este vendedor.</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
                  <KPICard icon="📦" label="Total Eventos" value={auditoriaVendedor.total_eventos} color="#06b6d4" />
                  <KPICard icon="📐" label="Ticket Medio m²" value={`${auditoriaVendedor.ticket_medio_m2} m²`} color="#f59e0b" />
                  <KPICard icon="🏗️" label="Estructura Estrella" value={auditoriaVendedor.estructura_principal || '─'} color="#a78bfa" />
                </div>
                <h3 style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>📊 Matriz de Periodicidad de Clientes</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155' }}>
                        {['Estado', 'Cliente', 'Última Compra', 'Días Inactivo', 'Total Compras'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(auditoriaVendedor.matriz_periodicidad || []).map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '9px 12px' }}><SemaforoIcon dias={c.dias_inactividad} /></td>
                          <td style={{ padding: '9px 12px', color: '#e2e8f0' }}>{c.cliente}</td>
                          <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{c.ultima_compra ? String(c.ultima_compra).substring(0, 10) : '─'}</td>
                          <td style={{ padding: '9px 12px', color: c.semaforo === 'rojo' ? '#ef4444' : c.semaforo === 'amarillo' ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                            {c.dias_inactividad !== null ? `${c.dias_inactividad} días` : '─'}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#a78bfa', fontWeight: 600 }}>{c.total_compras}</td>
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

// ─── Tablero 2: BI Predictivo de Cliente ──────────────────────────────────────
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

  // Datos para gráfico de frecuencia mensual
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Buscador */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
        <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>🔍 Buscar Cliente</label>
        <input type="text" value={busqueda} onChange={e => handleBusqueda(e.target.value)}
          placeholder="Escribí el nombre del cliente (mínimo 3 caracteres)..."
          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        {loading && <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Buscando...</div>}
      </div>

      {perfil && perfil.encontrado && (
        <>
          {/* Header Cliente */}
          <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(99,102,241,0.1))', border: '1px solid #06b6d430', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ color: '#f1f5f9', margin: '0 0 8px', fontSize: 22 }}>{perfil.cliente_nombre}</h2>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>💼 {perfil.condicion_fiscal || 'Cond. Fiscal no registrada'}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>💳 {perfil.condicion_pago || 'Cond. Pago no registrada'}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>👤 {perfil.vendedor_principal || 'Sin vendedor asignado'}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>🏗️ {perfil.estructura_principal || 'Sin estructura predominante'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <SemaforoIcon dias={perfil.dias_inactividad} />
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{perfil.dias_inactividad} días inactivo</div>
              </div>
            </div>
          </div>

          {/* KPIs del cliente */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <KPICard icon="📋" label="Total Eventos" value={perfil.total_eventos} color="#06b6d4" />
            <KPICard icon="🔄" label="Ciclo Promedio" value={perfil.ciclo_promedio_dias ? `${perfil.ciclo_promedio_dias}d` : '─'} sub="días entre compras" color="#f59e0b" />
            <KPICard icon="⭐" label="Adicional Preferido" value={perfil.adicional_preferido ? perfil.adicional_preferido.charAt(0).toUpperCase() + perfil.adicional_preferido.slice(1) : '─'} color="#a78bfa" />
            <KPICard icon="📅" label="Último Evento" value={perfil.ultima_compra ? String(perfil.ultima_compra).substring(0, 10) : '─'} color="#22c55e" />
          </div>

          {/* Frecuencia mensual + Auditoría IA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
              <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>📆 Frecuencia Mensual</h3>
              <LineChart data={frecuenciaMensual} xKey="mes" yKey="cierres" color="#a78bfa" />
            </div>
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))', border: '1px solid #6366f130', borderRadius: 14, padding: 20 }}>
              <h3 style={{ color: '#a78bfa', fontSize: 12, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 1 }}>🤖 Auditoría IA Predictiva</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>📅 PRÓXIMA VENTA ESTIMADA</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa' }}>{perfil.proxima_venta_estimada || '─'}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Basado en ciclo de {perfil.ciclo_promedio_dias || '?'} días</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>🔧 INICIO DE ARMADO SUGERIDO</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{perfil.inicio_armado_sugerido || '─'}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Lead Time histórico: {perfil.lead_time_promedio_dias || '?'} días</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>📊 CONFIANZA DEL MODELO</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: perfil.total_eventos >= 5 ? '#22c55e' : perfil.total_eventos >= 2 ? '#f59e0b' : '#ef4444' }}>
                    {perfil.total_eventos >= 5 ? '🟢 Alta' : perfil.total_eventos >= 2 ? '🟡 Media' : '🔴 Baja'}
                    <span style={{ fontSize: 11, color: '#475569', fontWeight: 400, marginLeft: 8 }}>({perfil.total_eventos} eventos históricos)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historial de eventos */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
            <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>📜 Historial de Eventos</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    {['Armado', 'Desarme', 'Carpa', 'Sup. m²', 'Vendedor', 'Adicionales'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(perfil.rows || []).slice().reverse().map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{String(r.fecha_armado || '').substring(0, 10)}</td>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{String(r.fecha_desarme || '').substring(0, 10)}</td>
                      <td style={{ padding: '8px 12px', color: '#e2e8f0', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.carpa_raw || '─'}</td>
                      <td style={{ padding: '8px 12px', color: '#f59e0b' }}>{r.superficie_m2 || '─'}</td>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{r.vendedor || '─'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].filter(a => r[a]).map(a => (
                          <span key={a} style={{ fontSize: 10, background: '#1e40af30', color: '#60a5fa', borderRadius: 4, padding: '2px 6px', marginRight: 3 }}>{a}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {busqueda.length >= 3 && !loading && (!perfil || !perfil.encontrado) && (
        <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <div style={{ marginTop: 12 }}>No se encontraron datos para "{busqueda}"</div>
        </div>
      )}
    </div>
  );
};

// ─── Tablero 3: Desglose Operativo ────────────────────────────────────────────
const TabDesglosOperativo = () => {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [busquedaCli, setBusquedaCli] = useState('');

  useEffect(() => {
    fetch('/api/gerencia/ventas-historicas').then(r => r.json()).then(data => {
      setVentas(data);
      const uniqueClientes = [...new Set(data.map(d => d.cliente_nombre))].sort();
      setClientes(uniqueClientes);
    }).catch(() => {});
  }, []);

  const clienteFiltrado = busquedaCli ? clientes.filter(c => c.toLowerCase().includes(busquedaCli.toLowerCase())) : clientes;
  const ventasCliente = clienteSeleccionado ? ventas.filter(v => v.cliente_nombre === clienteSeleccionado) : [];

  // Split algorítmico por |
  const allCarpas = ventasCliente.flatMap(v => (v.carpa_raw || '').split('|').map(s => s.trim()).filter(Boolean));
  const totalModulosIndependientes = allCarpas.length;

  // Adicional preferido
  const adCounts = {};
  ['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].forEach(a => {
    adCounts[a] = ventasCliente.filter(v => v[a]).length;
  });
  const adPreferido = Object.entries(adCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Selector de cliente */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 16, maxHeight: 400, overflow: 'auto' }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>🗂️ Clientes</h3>
          <input type="text" value={busquedaCli} onChange={e => setBusquedaCli(e.target.value)}
            placeholder="Filtrar..." style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
          {clienteFiltrado.map(c => (
            <div key={c} onClick={() => setClienteSeleccionado(c)}
              style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: clienteSeleccionado === c ? 'rgba(6,182,212,0.15)' : 'transparent',
                color: clienteSeleccionado === c ? '#06b6d4' : '#94a3b8',
                border: clienteSeleccionado === c ? '1px solid #06b6d430' : '1px solid transparent',
                fontSize: 12, fontWeight: clienteSeleccionado === c ? 600 : 400 }}>
              {c}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {clienteSeleccionado ? (
            <>
              {/* KPIs del cliente operativo */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <KPICard icon="📋" label="Total Contratos" value={ventasCliente.length} color="#06b6d4" />
                <KPICard icon="🏗️" label="Módulos Independientes" value={totalModulosIndependientes} sub="post-split por |" color="#f59e0b" />
                <KPICard icon="⭐" label="Adicional Preferido" value={adPreferido && adPreferido[1] > 0 ? adPreferido[0].charAt(0).toUpperCase() + adPreferido[0].slice(1) : '─'} color="#a78bfa" />
              </div>

              {/* Matriz de Adicionales */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
                <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>📊 Matriz de Adicionales</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b' }}>Contrato / Fecha</th>
                        {['Piso', 'Tarima', 'Alfombra', 'Cortina', 'Tribuna', 'Sillas'].map(h => (
                          <th key={h} style={{ textAlign: 'center', padding: '8px 8px', color: '#64748b', width: 60 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ventasCliente.slice().reverse().map((v, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>
                            <div style={{ fontSize: 13 }}>{v.carpa_raw?.substring(0, 30)}{v.carpa_raw?.length > 30 ? '…' : ''}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{String(v.fecha_armado || '').substring(0, 10)}</div>
                          </td>
                          {['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].map(a => (
                            <td key={a} style={{ textAlign: 'center', padding: '8px 8px' }}>
                              {v[a] ? <span style={{ color: '#22c55e', fontSize: 16 }}>✓</span> : <span style={{ color: '#1e293b', fontSize: 14 }}>✗</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* Footer totales */}
                      <tr style={{ borderTop: '2px solid #334155', background: 'rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 600 }}>TOTAL / FRECUENCIA</td>
                        {['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].map(a => (
                          <td key={a} style={{ textAlign: 'center', padding: '8px 8px', color: '#f59e0b', fontWeight: 700 }}>
                            {ventasCliente.length > 0 ? `${Math.round((adCounts[a] / ventasCliente.length) * 100)}%` : '─'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              <div style={{ fontSize: 48 }}>👆</div>
              <div style={{ marginTop: 12 }}>Seleccioná un cliente de la lista</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tablero 4: Demanda Predictiva IA ─────────────────────────────────────────
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

  const etiquetaHorizonte = { semana: 'Próxima Semana', mes: 'Próximo Mes', trimestre: 'Próximo Trimestre' };
  const adLabels = { piso: '🏠 Piso', tarima: '🎭 Tarima', alfombra: '🟫 Alfombra', cortina: '🪟 Cortina', tribuna: '🪑 Tribuna', sillas: '💺 Sillas' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Selector de Horizonte */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
        <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>🔮 Horizonte de Planificación</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          {['semana', 'mes', 'trimestre'].map(h => (
            <button key={h} onClick={() => setHorizonte(h)}
              style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid',
                borderColor: horizonte === h ? '#a78bfa' : '#334155',
                background: horizonte === h ? 'rgba(167,139,250,0.15)' : 'transparent',
                color: horizonte === h ? '#a78bfa' : '#64748b',
                fontWeight: horizonte === h ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>
              {etiquetaHorizonte[h]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
          <div style={{ fontSize: 36, animation: 'spin 1s linear infinite' }}>⏳</div>
          <div style={{ marginTop: 12 }}>Calculando predicciones...</div>
        </div>
      ) : data ? (
        <>
          {/* KPI resumen */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <KPICard icon="🎯" label="Clientes en Rango" value={data.total_clientes_en_rango} sub={etiquetaHorizonte[horizonte]} color="#a78bfa" />
            <KPICard icon="🏗️" label="Modelos Necesarios" value={data.demanda_carpas?.length || 0} sub="modelos diferentes" color="#06b6d4" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Demanda consolidada de carpas */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
              <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>🏗️ Demanda de Estructuras</h3>
              {(data.demanda_carpas || []).length === 0 ? (
                <div style={{ color: '#475569', textAlign: 'center', padding: 24 }}>Sin predicciones para este horizonte</div>
              ) : (
                data.demanda_carpas.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
                    <span style={{ color: '#e2e8f0', fontSize: 13 }}>{c.modelo}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{c.clientes.length} cliente(s)</span>
                      <span style={{ background: '#a78bfa20', color: '#a78bfa', borderRadius: 20, padding: '3px 12px', fontWeight: 700, fontSize: 14 }}>{c.cantidad}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Probabilidad de adicionales */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
              <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>📦 Prob. de Adicionales</h3>
              {Object.entries(data.adicionales_consolidado || {}).map(([a, prob]) => (
                <div key={a} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{adLabels[a] || a}</span>
                    <span style={{ color: prob > 66 ? '#22c55e' : prob > 33 ? '#f59e0b' : '#ef4444', fontWeight: 700, fontSize: 12 }}>{prob}%</span>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${prob}%`, background: prob > 66 ? '#22c55e' : prob > 33 ? '#f59e0b' : '#ef4444', height: '100%', borderRadius: 4, transition: 'width 0.6s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel de Justificación */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20 }}>
            <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 1 }}>📋 Panel de Justificación</h3>
            {(data.predicciones || []).length === 0 ? (
              <div style={{ color: '#475569', textAlign: 'center', padding: 24 }}>Sin predicciones para este horizonte temporal</div>
            ) : (
              data.predicciones.map((p, i) => (
                <div key={i} style={{ border: '1px solid #1e293b', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                  <div onClick={() => setExpandido(expandido === i ? null : i)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: expandido === i ? 'rgba(167,139,250,0.08)' : 'transparent' }}>
                    <div>
                      <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{p.cliente}</span>
                      <span style={{ color: '#64748b', fontSize: 11, marginLeft: 12 }}>→ {p.carpa_esperada || 'Sin modelo predefinido'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600 }}>📅 {p.proxima_fecha}</span>
                      <span style={{ color: p.confianza === 'alta' ? '#22c55e' : p.confianza === 'media' ? '#f59e0b' : '#ef4444', fontSize: 11 }}>
                        {p.confianza === 'alta' ? '🟢' : p.confianza === 'media' ? '🟡' : '🔴'} {p.confianza}
                      </span>
                      <span style={{ color: '#475569', fontSize: 14 }}>{expandido === i ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expandido === i && (
                    <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid #1e293b', fontSize: 12, color: '#94a3b8' }}>
                      <span style={{ marginRight: 16 }}>🔄 Ciclo promedio: <strong style={{ color: '#e2e8f0' }}>{p.ciclo_dias} días</strong></span>
                      <span style={{ marginRight: 16 }}>📅 Última compra: <strong style={{ color: '#e2e8f0' }}>{String(p.ultima_compra || '').substring(0, 10)}</strong></span>
                      <span style={{ marginRight: 16 }}>📊 Historial: <strong style={{ color: '#e2e8f0' }}>{p.total_eventos_historicos} eventos</strong></span>
                      <div style={{ marginTop: 8 }}>
                        Adicionales prob.: {Object.entries(p.adicionales_prob).filter(([, v]) => v > 0).map(([a, v]) => (
                          <span key={a} style={{ marginRight: 8, color: v > 66 ? '#22c55e' : v > 33 ? '#f59e0b' : '#94a3b8' }}>{a}: {v}%</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

// ─── Componente Principal: Dashboard de Gerencia ──────────────────────────────
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
    { id: 'performance', icon: '📊', label: 'Performance Comercial' },
    { id: 'bicliente', icon: '🧠', label: 'BI Predictivo Cliente' },
    { id: 'desglose', icon: '⚙️', label: 'Desglose Operativo' },
    { id: 'demanda', icon: '🔮', label: 'Demanda Predictiva IA' },
    { id: 'upload', icon: '📤', label: 'Cargar Histórico' }
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#080d1a', zIndex: 900,
      display: 'flex', flexDirection: 'column', fontFamily: "'Inter', 'Segoe UI', sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1526, #111827)',
        borderBottom: '1px solid #1e293b', padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🏢</div>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16 }}>Inteligencia Comercial</div>
            <div style={{ color: '#475569', fontSize: 11 }}>Carpas D'Angiola — Dashboard de Gerencia</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>👤 {currentUser?.nombre}</div>
          <button onClick={onClose}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef444430', borderRadius: 8, padding: '7px 16px', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            ✕ Cerrar Dashboard
          </button>
        </div>
      </div>

      {/* Body: Sidebar + Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 220, background: '#0d1526', borderRight: '1px solid #1e293b',
          padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: activeTab === t.id ? 'rgba(6,182,212,0.12)' : 'transparent',
                color: activeTab === t.id ? '#06b6d4' : '#64748b',
                borderLeft: activeTab === t.id ? '3px solid #06b6d4' : '3px solid transparent',
                fontWeight: activeTab === t.id ? 600 : 400, fontSize: 13, width: '100%', transition: 'all 0.15s'
              }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {loadingKpis && activeTab === 'performance' && (
            <div style={{ position: 'absolute', top: 80, right: 24, color: '#64748b', fontSize: 12 }}>
              ⏳ Actualizando datos...
            </div>
          )}
          {activeTab === 'performance' && (
            <TabPerformanceComercial kpis={kpis} evolucion={evolucion} topModelos={topModelos} vendedores={vendedores} filters={filters} setFilters={setFilters} />
          )}
          {activeTab === 'bicliente' && <TabBICliente />}
          {activeTab === 'desglose' && <TabDesglosOperativo />}
          {activeTab === 'demanda' && <TabDemandaPredictiva />}
          {activeTab === 'upload' && <UploadHistoricoInline />}
        </div>
      </div>
    </div>
  );
}

// ─── Cargador de Histórico (inline dentro del dashboard) ──────────────────────
function UploadHistoricoInline() {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const parseCsv = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
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

  const handleImport = async () => {
    const records = parseCsv(csvText);
    if (records.length === 0) return alert('El CSV no tiene registros válidos.');
    setLoading(true);
    try {
      const res = await fetch('/api/gerencia/upload-historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
      });
      const data = await res.json();
      setResultado(data);
    } catch (e) { alert('Error al importar: ' + e.message); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
      <div>
        <h2 style={{ color: '#f1f5f9', margin: '0 0 8px' }}>📤 Cargar Datos Históricos</h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          Importá el historial de ventas del sistema anterior. El archivo CSV debe tener las columnas: 
          <code style={{ color: '#06b6d4', marginLeft: 4 }}>Armado, Desarme, Cliente, Vendedor, Carpa, Superficie, Localidad, Adicionales</code>
        </p>
      </div>
      <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        style={{ border: '2px dashed #334155', borderRadius: 14, padding: 40, textAlign: 'center', cursor: 'pointer',
          background: 'rgba(255,255,255,0.02)', transition: 'border-color 0.2s' }}
        onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
        <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Arrastrá tu archivo CSV o <span style={{ color: '#06b6d4', textDecoration: 'underline' }}>hacé click para seleccionar</span></div>
        <div style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>Formatos soportados: .csv (separado por comas, codificación UTF-8)</div>
      </div>
      {preview.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b', borderRadius: 14, padding: 20, overflowX: 'auto' }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>
            👁️ Preview — Primeras 5 filas ({parseCsv(csvText).length} registros totales)
          </h3>
          <table style={{ fontSize: 11, borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr>{Object.keys(preview[0]).map(h => <th key={h} style={{ padding: '6px 10px', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #334155' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>{Object.values(row).map((v, j) => <td key={j} style={{ padding: '5px 10px', color: '#e2e8f0', borderBottom: '1px solid #1e293b' }}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {preview.length > 0 && !resultado && (
        <button onClick={handleImport} disabled={loading}
          style={{ background: 'linear-gradient(135deg, #0891b2, #0e7490)', border: 'none', borderRadius: 10, padding: '13px 28px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? '⏳ Importando...' : `🚀 Importar ${parseCsv(csvText).length} Registros`}
        </button>
      )}
      {resultado && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e30', borderRadius: 12, padding: 20 }}>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>✅ Importación Completada</div>
          <div style={{ color: '#86efac', fontSize: 13 }}>
            {resultado.insertados} registros insertados de {resultado.total_enviados} enviados.
          </div>
          <button onClick={() => { setResultado(null); setCsvText(''); setPreview([]); }}
            style={{ marginTop: 12, background: 'none', border: '1px solid #334155', borderRadius: 8, padding: '8px 16px', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
            Cargar otro archivo
          </button>
        </div>
      )}
    </div>
  );
}
