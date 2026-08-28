import React, { useState } from 'react';
import {
  Users, Truck, Plus, Trash2, Edit3, CheckCircle, XCircle, Search,
  Briefcase, Tag, Hash, FileText, Phone, UserCheck, ShieldCheck
} from 'lucide-react';

const renderDateBadge = (dateStr) => {
  if (!dateStr) return <span className="text-slate-350 font-mono text-[11px]">-</span>;
  const cleanDateStr = String(dateStr).includes('T') ? String(dateStr).split('T')[0] : String(dateStr).trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(cleanDateStr + 'T00:00:00');
  if (isNaN(target.getTime())) return <span className="text-slate-400 font-mono text-[11px]">{dateStr}</span>;
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-mono">
        🚨 Vencido ({cleanDateStr})
      </span>
    );
  } else if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono animate-pulse">
        ⚠️ Vence en {diffDays === 0 ? 'HOY' : `${diffDays}d`} ({cleanDateStr})
      </span>
    );
  } else if (diffDays <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200 font-mono">
        🕒 {cleanDateStr} ({diffDays}d)
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
        ✅ {cleanDateStr}
      </span>
    );
  }
};

export default function PersonalRecursos({
  personalList = [],
  recursosList = [],
  usuariosList = [],
  onSavePersonal,
  onDeletePersonal,
  onSaveRecurso,
  onDeleteRecurso,
  userRole
}) {
  const [activeSubTab, setActiveSubTab] = useState('personal'); // 'personal' | 'recursos'
  const [personalSearch, setPersonalSearch] = useState('');
  const [recursosSearch, setRecursosSearch] = useState('');

  // Modals / Editor States
  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null); // null means new
  const [personaForm, setPersonaForm] = useState({
    nombre: '',
    cuit: '',
    telefono: '',
    rol_funcion: 'Operario',
    tipo: 'Fijo',
    subtipo_chofer: '',
    roles_secundarios: '',
    examen_medico_vencimiento: '',
    licencia_conducir_vencimiento: '',
    activo: true,
    usuario_id: null
  });

  const [showRecursoModal, setShowRecursoModal] = useState(false);
  const [editingRecurso, setEditingRecurso] = useState(null); // null means new
  const [recursoForm, setRecursoForm] = useState({
    nombre: '',
    tipo: 'Vehículo / Camión',
    subtipo: '',
    patente_identificador: '',
    vtv_vencimiento: '',
    seguro_vencimiento: '',
    descripcion: '',
    activo: true
  });

  const rolFuncionOptions = [
    'Chofer',
    'Ayudante',
    'Supervisor',
    'Operario',
    'Planta',
    'Pañol',
    'Administrativo'
  ];

  const recursoTipoOptions = [
    'Vehículo / Camión',
    'Maquinaria',
    'Herramienta',
    'Otro'
  ];

  // Filters
  const filteredPersonal = personalList.filter(p => {
    const term = personalSearch.toLowerCase();
    return (
      (p.nombre || '').toLowerCase().includes(term) ||
      (p.rol_funcion || '').toLowerCase().includes(term) ||
      (p.cuit || '').toLowerCase().includes(term)
    );
  });

  const filteredRecursos = recursosList.filter(r => {
    const term = recursosSearch.toLowerCase();
    return (
      (r.nombre || '').toLowerCase().includes(term) ||
      (r.tipo || '').toLowerCase().includes(term) ||
      (r.patente_identificador || '').toLowerCase().includes(term) ||
      (r.vtv_vencimiento || '').toLowerCase().includes(term)
    );
  });

  // Handlers - Personal
  const handleOpenPersonalAdd = () => {
    setEditingPersona(null);
    setPersonaForm({
      nombre: '',
      cuit: '',
      telefono: '',
      rol_funcion: 'Operario',
      tipo: 'Fijo',
      subtipo_chofer: '',
      roles_secundarios: '',
      examen_medico_vencimiento: '',
      licencia_conducir_vencimiento: '',
      activo: true,
      usuario_id: null
    });
    setShowPersonalModal(true);
  };

  const handleOpenPersonalEdit = (p) => {
    setEditingPersona(p);
    const rawMed = p.examen_medico_vencimiento || p.examen_medico || p.Examen_Medico_Vencimiento || '';
    const cleanMedico = rawMed ? (String(rawMed).includes('T') ? String(rawMed).split('T')[0] : String(rawMed).trim()) : '';
    const rawLic = p.licencia_conducir_vencimiento || p.licencia_conducir || p.Licencia_Conducir_Vencimiento || '';
    const cleanLicencia = rawLic ? (String(rawLic).includes('T') ? String(rawLic).split('T')[0] : String(rawLic).trim()) : '';
    setPersonaForm({
      nombre: p.nombre || '',
      cuit: p.cuit || '',
      telefono: p.telefono || '',
      rol_funcion: p.rol_funcion || 'Operario',
      tipo: p.tipo || 'Fijo',
      subtipo_chofer: p.subtipo_chofer || '',
      roles_secundarios: p.roles_secundarios || '',
      examen_medico_vencimiento: cleanMedico,
      licencia_conducir_vencimiento: cleanLicencia,
      activo: p.activo !== false,
      usuario_id: p.usuario_id || null
    });
    setShowPersonalModal(true);
  };

  const handleSavePersonaForm = async (e) => {
    e.preventDefault();
    if (!personaForm.nombre || !personaForm.rol_funcion) {
      alert('Nombre y Rol/Función son requeridos');
      return;
    }
    const payload = {
      ...personaForm,
      examen_medico_vencimiento: personaForm.examen_medico_vencimiento ? personaForm.examen_medico_vencimiento.trim() : null,
      licencia_conducir_vencimiento: personaForm.licencia_conducir_vencimiento ? personaForm.licencia_conducir_vencimiento.trim() : null,
      id: editingPersona ? editingPersona.id : undefined
    };
    await onSavePersonal(payload);
    setShowPersonalModal(false);
  };

  // Handlers - Recursos
  const handleOpenRecursoAdd = () => {
    setEditingRecurso(null);
    setRecursoForm({
      nombre: '',
      tipo: 'Vehículo / Camión',
      subtipo: '',
      patente_identificador: '',
      vtv_vencimiento: '',
      seguro_vencimiento: '',
      descripcion: '',
      activo: true
    });
    setShowRecursoModal(true);
  };

  const handleOpenRecursoEdit = (r) => {
    setEditingRecurso(r);
    const rawVtv = r.vtv_vencimiento || r.vtv || r.VTV_Vencimiento || '';
    const cleanVTV = rawVtv ? (String(rawVtv).includes('T') ? String(rawVtv).split('T')[0] : String(rawVtv).trim()) : '';
    const rawSeguro = r.seguro_vencimiento || r.seguro || r.Seguro_Vencimiento || '';
    const cleanSeguro = rawSeguro ? (String(rawSeguro).includes('T') ? String(rawSeguro).split('T')[0] : String(rawSeguro).trim()) : '';
    setRecursoForm({
      nombre: r.nombre || '',
      tipo: r.tipo || 'Vehículo / Camión',
      subtipo: r.subtipo || '',
      patente_identificador: r.patente_identificador || r.patente || '',
      vtv_vencimiento: cleanVTV,
      seguro_vencimiento: cleanSeguro,
      descripcion: r.descripcion || '',
      activo: r.activo !== false
    });
    setShowRecursoModal(true);
  };

  const handleSaveRecursoForm = async (e) => {
    e.preventDefault();
    if (!recursoForm.nombre || !recursoForm.tipo) {
      alert('Nombre y Tipo de Recurso son requeridos');
      return;
    }
    const payload = {
      ...recursoForm,
      vtv_vencimiento: recursoForm.vtv_vencimiento ? recursoForm.vtv_vencimiento.trim() : null,
      seguro_vencimiento: recursoForm.seguro_vencimiento ? recursoForm.seguro_vencimiento.trim() : null,
      patente_identificador: recursoForm.patente_identificador ? recursoForm.patente_identificador.trim().toUpperCase() : null,
      id: editingRecurso ? editingRecurso.id : undefined
    };
    await onSaveRecurso(payload);
    setShowRecursoModal(false);
  };

  const canEdit = ['Gerencia', 'SuperAdmin', 'Operaciones'].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-6 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-xl font-black uppercase tracking-wider Poppins flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-300" />
            Catálogo de Personal y Recursos Operativos
          </h2>
          <p className="text-xs text-blue-200 font-semibold mt-1">
            Administra el personal de planta, choferes y flota de vehículos o herramientas pesadas.
          </p>
        </div>
        <div className="absolute right-5 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
          <Users className="w-48 h-48" />
        </div>
      </div>

      {/* Sub Tabs Selector */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-fit justify-center sm:justify-start">
        <button
          onClick={() => setActiveSubTab('personal')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'personal' ? 'bg-blue-900 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
          }`}
        >
          <Users className="w-4 h-4" />
          Personal ({personalList.length})
        </button>
        <button
          onClick={() => setActiveSubTab('recursos')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'recursos' ? 'bg-blue-900 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          Recursos / Flota ({recursosList.length})
        </button>
      </div>

      {/* Sub Tab Panel: PERSONAL */}
      {activeSubTab === 'personal' && (
        <div className="glass-panel rounded-[2rem] p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar personal por nombre, rol o CUIT..."
                value={personalSearch}
                onChange={(e) => setPersonalSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
              />
            </div>

            {/* Add Button */}
            {canEdit && (
              <button
                onClick={handleOpenPersonalAdd}
                className="bg-blue-900 hover:bg-blue-955 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all-300 shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 self-start md:self-auto"
              >
                <Plus className="w-4 h-4" />
                Agregar Personal
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest text-[9px] font-black">
                  <th className="p-4 pl-6">Nombre</th>
                  <th className="p-4">Usuario APP</th>
                  <th className="p-4">CUIT</th>
                  <th className="p-4">Teléfono</th>
                  <th className="p-4">Rol / Función</th>
                  <th className="p-4">Examen Médico</th>
                  <th className="p-4">Licencia Conducir</th>
                  <th className="p-4 text-center">Estado</th>
                  {canEdit && <th className="p-4 text-right pr-6">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredPersonal.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 9 : 8} className="p-8 text-center text-xs font-semibold text-slate-400">
                      No se encontraron miembros del personal registrados.
                    </td>
                  </tr>
                ) : (
                  filteredPersonal.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-all-300">
                      <td className="p-4 pl-6 font-bold text-slate-800 text-xs">
                        {p.nombre}
                      </td>
                      <td className="p-4 text-xs font-semibold text-slate-600">
                        {(() => {
                          const matched = usuariosList.find(u => u.id === p.usuario_id);
                          return matched ? (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-150 px-2 py-0.5 rounded-md uppercase text-[9px] font-black tracking-wide">
                              {matched.nombre} (@{matched.username})
                            </span>
                          ) : (
                            <span className="text-slate-400 italic font-medium">No vinculado</span>
                          );
                        })()}
                      </td>
                      <td className="p-4 font-mono text-slate-600 text-xs">
                        {p.cuit || '-'}
                      </td>
                      <td className="p-4 text-slate-600 text-xs font-medium">
                        {p.telefono || '-'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded border ${
                          p.rol_funcion === 'Chofer' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                          p.rol_funcion === 'Supervisor' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          p.rol_funcion === 'Ayudante' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                          p.rol_funcion === 'Planta' || p.rol_funcion === 'Pañol' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                          'bg-slate-50 border-slate-200 text-slate-700'
                        }`}>
                          {p.rol_funcion}
                        </span>
                      </td>
                      <td className="p-4">
                        {renderDateBadge(p.examen_medico_vencimiento || p.examen_medico)}
                      </td>
                      <td className="p-4">
                        {renderDateBadge(p.licencia_conducir_vencimiento || p.licencia_conducir)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          p.activo !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-250' : 'bg-slate-100 text-slate-500 border border-slate-250'
                        }`}>
                          {p.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="p-4 text-right pr-6">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenPersonalEdit(p)}
                              title="Editar"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-900 hover:bg-slate-100 transition-all-300 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`¿Estás seguro de eliminar a ${p.nombre}?`)) {
                                  onDeletePersonal(p.id);
                                }
                              }}
                              title="Eliminar"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-650 hover:bg-slate-100 transition-all-300 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub Tab Panel: RECURSOS */}
      {activeSubTab === 'recursos' && (
        <div className="glass-panel rounded-[2rem] p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar recursos por nombre, tipo o patente..."
                value={recursosSearch}
                onChange={(e) => setRecursosSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
              />
            </div>

            {/* Add Button */}
            {canEdit && (
              <button
                onClick={handleOpenRecursoAdd}
                className="bg-blue-900 hover:bg-blue-955 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all-300 shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 self-start md:self-auto"
              >
                <Plus className="w-4 h-4" />
                Agregar Recurso
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest text-[9px] font-black">
                  <th className="p-4 pl-6">Nombre de Recurso</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Patente / ID</th>
                  <th className="p-4">Vencimiento VTV</th>
                  <th className="p-4">Vencimiento Seguro</th>
                  <th className="p-4">Descripción</th>
                  <th className="p-4 text-center">Estado</th>
                  {canEdit && <th className="p-4 text-right pr-6">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {filteredRecursos.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="p-8 text-center text-xs font-semibold text-slate-400">
                      No se encontraron recursos registrados.
                    </td>
                  </tr>
                ) : (
                  filteredRecursos.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-all-300">
                        <td className="p-4 pl-6 font-bold text-slate-800 text-xs">
                          {r.nombre}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded border ${
                            r.tipo === 'Vehículo / Camión' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                            r.tipo === 'Maquinaria' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            r.tipo === 'Herramienta' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                            'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            {r.tipo}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-650 text-xs font-bold">
                          {r.patente_identificador || '-'}
                        </td>
                        <td className="p-4">
                          {renderDateBadge(r.vtv_vencimiento || r.vtv)}
                        </td>
                        <td className="p-4">
                          {renderDateBadge(r.seguro_vencimiento || r.seguro)}
                        </td>
                        <td className="p-4 text-slate-500 text-xs font-medium max-w-xs truncate" title={r.descripcion}>
                          {r.descripcion || '-'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            r.activo !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-250' : 'bg-slate-100 text-slate-500 border border-slate-250'
                          }`}>
                            {r.activo !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="p-4 text-right pr-6">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenRecursoEdit(r)}
                                title="Editar"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-900 hover:bg-slate-100 transition-all-300 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`¿Estás seguro de eliminar el recurso: ${r.nombre}?`)) {
                                    onDeleteRecurso(r.id);
                                  }
                                }}
                                title="Eliminar"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-650 hover:bg-slate-100 transition-all-300 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------- PERSONAL EDITOR MODAL -------------------- */}
      {showPersonalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-lg p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowPersonalModal(false)}
              className="absolute right-5 top-5 p-1 rounded-full hover:bg-slate-100 transition-all-300"
            >
              <XCircle className="w-5 h-5 text-slate-450 hover:text-slate-600" />
            </button>
            <h3 className="text-sm font-black uppercase text-blue-900 tracking-wider Poppins border-b border-slate-100 pb-3 flex items-center gap-2">
              <Briefcase className="w-4.5 h-4.5 text-blue-700" />
              {editingPersona ? 'Editar Personal' : 'Nuevo Personal'}
            </h3>
            <form onSubmit={handleSavePersonaForm} className="space-y-4">
              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Nombre Completo *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={personaForm.nombre}
                    onChange={(e) => setPersonaForm({ ...personaForm, nombre: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">CUIT / CUIL</label>
                  <input
                    type="text"
                    value={personaForm.cuit}
                    onChange={(e) => setPersonaForm({ ...personaForm, cuit: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 font-mono"
                    placeholder="Ej. 20-30456789-9"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={personaForm.telefono}
                    onChange={(e) => setPersonaForm({ ...personaForm, telefono: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                    placeholder="Ej. 11-5555-5555"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Rol / Función Principal *</label>
                <select
                  value={personaForm.rol_funcion}
                  onChange={(e) => setPersonaForm({ ...personaForm, rol_funcion: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                >
                  {rolFuncionOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Tipo de Personal</label>
                  <select
                    value={personaForm.tipo || 'Fijo'}
                    onChange={(e) => setPersonaForm({ ...personaForm, tipo: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  >
                    <option value="Fijo">Fijo (Planta permanente)</option>
                    <option value="Eventual">Eventual (Por jornada/evento)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Subtipo Chofer / Licencia</label>
                  <select
                    value={personaForm.subtipo_chofer || ''}
                    onChange={(e) => setPersonaForm({ ...personaForm, subtipo_chofer: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  >
                    <option value="">No aplica (No conduce)</option>
                    <option value="Camión Pesado">Camión Pesado (Chasis/Balancín)</option>
                    <option value="Semi / Tractor">Semi / Tractor</option>
                    <option value="Camioneta / Furgón">Camioneta / Furgón</option>
                    <option value="Autoelevador">Autoelevador / Hidroelevador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Roles / Habilidades Secundarias (tags)</label>
                <input
                  type="text"
                  value={personaForm.roles_secundarios || ''}
                  onChange={(e) => setPersonaForm({ ...personaForm, roles_secundarios: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  placeholder="Ej. Encargado, Chofer, Alfombras, Telas"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-blue-900 block mb-1">Vencimiento Examen Médico / Libreta</label>
                  <input
                    type="date"
                    value={personaForm.examen_medico_vencimiento || ''}
                    onChange={(e) => setPersonaForm({ ...personaForm, examen_medico_vencimiento: e.target.value })}
                    className="w-full bg-blue-50/40 border border-blue-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-blue-900 block mb-1">Vencimiento Licencia de Conducir</label>
                  <input
                    type="date"
                    value={personaForm.licencia_conducir_vencimiento || ''}
                    onChange={(e) => setPersonaForm({ ...personaForm, licencia_conducir_vencimiento: e.target.value })}
                    className="w-full bg-blue-50/40 border border-blue-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Usuario de la APP Asociado</label>
                <select
                  value={personaForm.usuario_id || ''}
                  onChange={(e) => setPersonaForm({ ...personaForm, usuario_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                >
                  <option value="">Ninguno (Sin usuario de la APP)</option>
                  {usuariosList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} (@{u.username} - {u.rol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
                <input
                  type="checkbox"
                  id="personaActivo"
                  checked={personaForm.activo}
                  onChange={(e) => setPersonaForm({ ...personaForm, activo: e.target.checked })}
                  className="w-4 h-4 text-blue-900 border-slate-300 rounded focus:ring-blue-600 cursor-pointer"
                />
                <label htmlFor="personaActivo" className="text-xs font-black text-slate-700 cursor-pointer select-none">
                  Personal Activo (Habilitado para asignaciones)
                </label>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPersonalModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-900 hover:bg-blue-955 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all-300 shadow-xs cursor-pointer"
                >
                  {editingPersona ? 'Guardar Cambios' : 'Crear Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- RECURSO EDITOR MODAL -------------------- */}
      {showRecursoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-lg p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowRecursoModal(false)}
              className="absolute right-5 top-5 p-1 rounded-full hover:bg-slate-100 transition-all-300"
            >
              <XCircle className="w-5 h-5 text-slate-450 hover:text-slate-600" />
            </button>
            <h3 className="text-sm font-black uppercase text-blue-900 tracking-wider Poppins border-b border-slate-100 pb-3 flex items-center gap-2">
              <Truck className="w-4.5 h-4.5 text-blue-700" />
              {editingRecurso ? 'Editar Recurso' : 'Nuevo Recurso'}
            </h3>
            <form onSubmit={handleSaveRecursoForm} className="space-y-4">
              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Nombre / Identificador de Recurso *</label>
                <input
                  type="text"
                  required
                  value={recursoForm.nombre}
                  onChange={(e) => setRecursoForm({ ...recursoForm, nombre: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  placeholder="Ej. Iveco Tector 170E22"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Tipo de Recurso *</label>
                  <select
                    value={recursoForm.tipo}
                    onChange={(e) => setRecursoForm({ ...recursoForm, tipo: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  >
                    {recursoTipoOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Subtipo / Porte</label>
                  <select
                    value={recursoForm.subtipo || ''}
                    onChange={(e) => setRecursoForm({ ...recursoForm, subtipo: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  >
                    <option value="">General</option>
                    <option value="Camión Chasis">Camión Chasis</option>
                    <option value="Camión Semi">Camión Semi</option>
                    <option value="Camioneta / Furgón">Camioneta / Furgón</option>
                    <option value="Autoelevador">Autoelevador</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Patente / Identificador</label>
                  <input
                    type="text"
                    value={recursoForm.patente_identificador}
                    onChange={(e) => setRecursoForm({ ...recursoForm, patente_identificador: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 uppercase font-mono"
                    placeholder="Ej. AF 123 CD"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Vencimiento VTV</label>
                  <input
                    type="date"
                    value={recursoForm.vtv_vencimiento || ''}
                    onChange={(e) => setRecursoForm({ ...recursoForm, vtv_vencimiento: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Vencimiento Seguro</label>
                  <input
                    type="date"
                    value={recursoForm.seguro_vencimiento || ''}
                    onChange={(e) => setRecursoForm({ ...recursoForm, seguro_vencimiento: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Descripción / Observaciones</label>
                <textarea
                  value={recursoForm.descripcion}
                  onChange={(e) => setRecursoForm({ ...recursoForm, descripcion: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 min-h-[80px]"
                  placeholder="Ej. Camión mediano con capacidad para arcos estructurales..."
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
                <input
                  type="checkbox"
                  id="recursoActivo"
                  checked={recursoForm.activo}
                  onChange={(e) => setRecursoForm({ ...recursoForm, activo: e.target.checked })}
                  className="w-4 h-4 text-blue-900 border-slate-300 rounded focus:ring-blue-600 cursor-pointer"
                />
                <label htmlFor="recursoActivo" className="text-xs font-black text-slate-700 cursor-pointer select-none">
                  Recurso Activo (Disponible para flota)
                </label>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRecursoModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-900 hover:bg-blue-955 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all-300 shadow-xs cursor-pointer"
                >
                  {editingRecurso ? 'Guardar Cambios' : 'Crear Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
