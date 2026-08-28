import React, { useState, useEffect } from 'react';
import { 
  Brain, Upload, BookOpen, FileText, Sparkles, Trash2, Plus, 
  CheckCircle, AlertCircle, RefreshCw, HelpCircle, FileSignature 
} from 'lucide-react';

export default function AprendizajeIA({ currentUser }) {
  const [documentos, setDocumentos] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // RAG Form states
  const [docTitulo, setDocTitulo] = useState('');
  const [docTipo, setDocTipo] = useState('general');
  const [docContenido, setDocContenido] = useState('');
  const [docFile, setDocFile] = useState(null);

  // Skills Form states
  const [skillNombre, setSkillNombre] = useState('');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillKeywords, setSkillKeywords] = useState('');
  const [skillInstrucciones, setSkillInstrucciones] = useState('');

  const fetchEstado = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/aprendizaje/estado');
      if (res.ok) {
        const data = await res.json();
        setDocumentos(data.documentos || []);
        setSkills(data.skills || []);
      } else {
        throw new Error('Error al cargar datos del módulo de aprendizaje.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstado();
  }, []);

  const handleDocSubmit = async (e) => {
    e.preventDefault();
    if (!docFile && (!docTitulo || !docContenido)) {
      alert('Por favor, carga un archivo PDF o escribe el título y contenido manualmente.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg('');

    try {
      let res;
      if (docFile) {
        const formData = new FormData();
        formData.append('file', docFile);
        formData.append('tipo', docTipo);
        if (docTitulo) formData.append('titulo', docTitulo);

        res = await fetch('/api/aprendizaje/documentos', {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch('/api/aprendizaje/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: docTitulo,
            tipo: docTipo,
            contenido: docContenido
          })
        });
      }

      if (res.ok) {
        setSuccessMsg('Documento/Normativa cargada con éxito a la Base de Conocimiento (RAG).');
        setDocTitulo('');
        setDocContenido('');
        setDocFile(null);
        // Reset file input element
        const fileInput = document.getElementById('doc-file-pdf');
        if (fileInput) fileInput.value = '';
        
        fetchEstado();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar el documento.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkillSubmit = async (e) => {
    e.preventDefault();
    if (!skillNombre || !skillInstrucciones || !skillKeywords) {
      alert('Faltan campos obligatorios para registrar la habilidad.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg('');

    try {
      const res = await fetch('/api/aprendizaje/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: skillNombre,
          descripcion: skillDesc,
          trigger_keywords: skillKeywords,
          instrucciones: skillInstrucciones
        })
      });

      if (res.ok) {
        setSuccessMsg(`Habilidad "${skillNombre}" guardada exitosamente.`);
        setSkillNombre('');
        setSkillDesc('');
        setSkillKeywords('');
        setSkillInstrucciones('');
        fetchEstado();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar la habilidad.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta normativa de la base de conocimiento RAG?')) return;
    try {
      const res = await fetch(`/api/aprendizaje/documentos/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccessMsg('Documento eliminado.');
        fetchEstado();
      } else {
        alert('Error al eliminar documento');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSkill = async (id) => {
    if (!confirm('¿Estás seguro de desactivar esta habilidad del asistente de IA?')) return;
    try {
      const res = await fetch(`/api/aprendizaje/skills/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccessMsg('Habilidad eliminada.');
        fetchEstado();
      } else {
        alert('Error al eliminar habilidad');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getDocTypeBadge = (tipo) => {
    switch (tipo) {
      case 'manual': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'norma_iso': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'procedimiento': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'instructivo': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'ordenanza': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'politica': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="glass-panel rounded-[2.5rem] p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-md">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase text-blue-900 tracking-wider Poppins">
              Módulo de Aprendizaje IA (RAG & Auto-Skills)
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5 leading-relaxed">
              Base de Conocimiento Dinámica y Reglas Especiales de Comportamiento para VigIA.
            </p>
          </div>
        </div>
        <button 
          onClick={fetchEstado} 
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-550 transition-all-300 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refrescar Estado
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-150 rounded-2xl text-xs font-semibold text-red-750">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-150 rounded-2xl text-xs font-semibold text-emerald-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Columna RAG (Base de Conocimiento) */}
        <div className="space-y-6">
          <div className="border border-slate-200/80 rounded-3xl p-6 bg-white/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <BookOpen className="w-5 h-5 text-blue-900" />
              <h2 className="text-sm font-black uppercase text-slate-800 tracking-wide">
                🏫 Enseñar Normativas a la IA (RAG)
              </h2>
            </div>
            
            <form onSubmit={handleDocSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Título de la Normativa</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Manual de Logística v2" 
                    value={docTitulo} 
                    onChange={e => setDocTitulo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Categoría / Tipo</label>
                  <select 
                    value={docTipo} 
                    onChange={e => setDocTipo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white"
                  >
                    <option value="manual">Manual Técnico</option>
                    <option value="norma_iso">Norma ISO</option>
                    <option value="procedimiento">Procedimiento Operativo</option>
                    <option value="instructivo">Instructivo de Trabajo</option>
                    <option value="ordenanza">Ordenanza Municipal</option>
                    <option value="politica">Políticas Internas</option>
                    <option value="general">Información General</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cargar Documento en PDF</label>
                <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-all-300 text-center relative">
                  <input 
                    type="file" 
                    id="doc-file-pdf"
                    accept=".pdf" 
                    onChange={e => {
                      const file = e.target.files[0];
                      setDocFile(file);
                      if (file && !docTitulo) {
                        setDocTitulo(file.name.replace(/\.[^/.]+$/, ""));
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">
                      {docFile ? `📎 ${docFile.name}` : 'Arrastrar PDF o hacer click aquí'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">El texto del PDF será extraído automáticamente</span>
                  </div>
                </div>
              </div>

              {!docFile && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">O escribir Contenido Manualmente</label>
                  <textarea 
                    placeholder="Escriba las normativas, reglas o texto que la IA debe conocer..." 
                    rows={4}
                    value={docContenido}
                    onChange={e => setDocContenido(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white"
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 shadow-md flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Guardar en Base de Conocimiento
              </button>
            </form>
          </div>

          {/* Listado RAG */}
          <div className="border border-slate-200/80 rounded-3xl p-6 bg-white/60 backdrop-blur-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-700 border-b border-slate-100 pb-2">
              📖 Documentos en Base de Conocimiento ({documentos.length})
            </h3>
            
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {documentos.length === 0 ? (
                <p className="text-xs text-slate-500 font-semibold italic text-center py-6">
                  No hay normativas ISO, manuales u ordenanzas cargadas aún.
                </p>
              ) : (
                documentos.map(doc => (
                  <div key={doc.id} className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-all-300">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{doc.titulo}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${getDocTypeBadge(doc.tipo)}`}>
                          {doc.tipo}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold line-clamp-2 leading-relaxed">
                        {doc.contenido}
                      </p>
                      <span className="text-[9px] text-slate-400 font-semibold">
                        Cargado el: {new Date(doc.fecha_carga).toLocaleDateString()}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-2 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-xl transition-all-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Columna Auto-Skills (Habilidades) */}
        <div className="space-y-6">
          <div className="border border-slate-200/80 rounded-3xl p-6 bg-white/60 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sparkles className="w-5 h-5 text-blue-900" />
              <h2 className="text-sm font-black uppercase text-slate-800 tracking-wide">
                ⚙️ Configurar Habilidades / Auto-Skills
              </h2>
            </div>
            
            <form onSubmit={handleSkillSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre de la Habilidad</label>
                <input 
                  type="text" 
                  placeholder="Ej: Instrucción de Calidad - Piso" 
                  value={skillNombre} 
                  onChange={e => setSkillNombre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Palabras Clave (Gatillos)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: iso, piso, lona, calidad" 
                    value={skillKeywords} 
                    onChange={e => setSkillKeywords(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white"
                    required
                  />
                  <span className="text-[9px] text-slate-500 font-semibold block leading-tight">
                    Separadas por comas. El chat IA activará esta regla cuando el usuario mencione una de ellas.
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Regla para responder sobre calidad" 
                    value={skillDesc} 
                    onChange={e => setSkillDesc(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Directivas de Comportamiento / Instrucción</label>
                <textarea 
                  placeholder="Ej: Si el usuario te pregunta por control de calidad de pisos, recuerda indicar que según la Norma ISO 9001 sección 4..." 
                  rows={4}
                  value={skillInstrucciones}
                  onChange={e => setSkillInstrucciones(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-900 bg-white"
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 shadow-md flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Registrar Habilidad
              </button>
            </form>
          </div>

          {/* Listado Habilidades */}
          <div className="border border-slate-200/80 rounded-3xl p-6 bg-white/60 backdrop-blur-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-700 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>🛠️ Habilidades Activas ({skills.length})</span>
              <span className="text-[9px] bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-md font-bold">
                Auto-Aprendizaje Habilitado
              </span>
            </h3>
            
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {skills.length === 0 ? (
                <p className="text-xs text-slate-500 font-semibold italic text-center py-6">
                  No hay habilidades configuradas ni auto-aprendidas aún.
                </p>
              ) : (
                skills.map(sk => (
                  <div key={sk.id} className="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-all-300 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 leading-tight">{sk.nombre}</h4>
                        {sk.descripcion && (
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{sk.descripcion}</p>
                        )}
                      </div>
                      <button 
                        onClick={() => handleDeleteSkill(sk.id)}
                        className="p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-xl transition-all-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Gatillos:</span>
                      <div className="flex flex-wrap gap-1">
                        {sk.trigger_keywords && sk.trigger_keywords.split(',').map((kw, idx) => (
                          <span key={idx} className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-lg text-[9px] font-semibold">
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Directivas:</span>
                      <p className="text-[10px] text-slate-650 font-medium leading-normal whitespace-pre-line">
                        {sk.instrucciones}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
