import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Truck, Layers, Plus, Edit, Trash2, Upload, Download, Search,
  FileText, X, Check, AlertCircle, RefreshCw, User, HelpCircle, CheckSquare, Square
} from 'lucide-react';

export default function MaestroDatos({ currentUser }) {
  const [activeTab, setActiveTab] = useState('personal');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const tabs = [
    { id: 'personal', label: 'Personal', icon: Users, desc: 'Gestión de operarios, choferes y personal de la empresa' },
    { id: 'recursos', label: 'Vehículos/Maquinaria', icon: Truck, desc: 'Flota de camiones, elevadores y herramientas pesadas' },
    { id: 'estructuras', label: 'Estructuras', icon: Layers, desc: 'Modelos de carpas principales y dimensiones' },
    { id: 'arcos', label: 'Arcos', icon: FileText, desc: 'Componentes de base arco/pórtico por modelo' },
    { id: 'modulos', label: 'Módulos', icon: FileText, desc: 'Componentes de modulación de extensión' },
    { id: 'fijos', label: 'Fijos', icon: FileText, desc: 'Componentes fijos por modelo de carpa' },
    { id: 'clientes', label: 'Clientes', icon: Users, desc: 'Cartera de clientes y georreferenciación' },
    { id: 'pisos', label: 'Pisos', icon: Layers, desc: 'Stock de placas fenólicas y tarimas' },
    { id: 'lonas', label: 'Lonas', icon: Layers, desc: 'Catálogo de lonas, colores y medidas' },
    { id: 'telas', label: 'Telas', icon: Layers, desc: 'Cortinados laterales, telas decorativas y stock' },
    { id: 'alfombras', label: 'Alfombras', icon: Layers, desc: 'Rollos de alfombras, colores y metros disponibles' },
    { id: 'vendedores', label: 'Vendedores', icon: User, desc: 'Fuerza comercial registrada en el sistema' }
  ];

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setImportResult(null);
    try {
      const res = await fetch(`/api/maestro/${activeTab}`);
      if (!res.ok) throw new Error('Error al cargar datos del servidor');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setSearchQuery('');
  }, [activeTab]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de forma permanente?')) return;
    try {
      const res = await fetch(`/api/maestro/${activeTab}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar');
      }
      alert('Registro eliminado con éxito.');
      fetchData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    // Initialize default values based on activeTab
    const defaults = {};
    if (activeTab === 'personal') {
      defaults.rol_funcion = 'Operario';
      defaults.activo = true;
    } else if (activeTab === 'recursos') {
      defaults.tipo = 'Maquinaria';
      defaults.activo = true;
    } else if (activeTab === 'estructuras') {
      defaults.estructura_tipo = 'Aluminio';
      defaults.arcos_totales = 0;
      defaults.frente = 0;
      defaults.largo_maximo = 0;
      defaults.arcos_disponibles = 0;
    } else if (activeTab === 'arcos' || activeTab === 'modulos' || activeTab === 'fijos') {
      defaults.sector = 'Planta';
      defaults.qty_fija_arco = 0;
      defaults.stock_inicial = 0;
      defaults.modulacion = 5;
      defaults.qty_fija_carpa = 0;
    } else if (['lonas', 'telas', 'pisos', 'alfombras'].includes(activeTab)) {
      defaults.stock_total = 0;
      defaults.estado = activeTab === 'alfombras' ? 'Nueva' : 'Regular';
    } else if (activeTab === 'vendedores') {
      defaults.activo = true;
    }
    setFormData(defaults);
    setShowFormModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/maestro/${activeTab}/${editingItem.id}` : `/api/maestro/${activeTab}`;
    
    // Clean up number formats
    const payload = { ...formData };
    ['arcos_totales', 'frente', 'largo_maximo', 'arcos_disponibles', 'qty_fija_arco', 'qty_fija_carpa', 'stock_inicial', 'modulacion', 'stock_total', 'latitud', 'longitud'].forEach(key => {
      if (payload[key] !== undefined && payload[key] !== '') {
        payload[key] = parseFloat(payload[key]);
      }
    });

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar el registro');
      }
      alert(editingItem ? 'Registro actualizado con éxito.' : 'Registro creado con éxito.');
      setShowFormModal(false);
      fetchData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target.result;
          const res = await fetch(`/api/maestro/import/${activeTab}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: buffer
          });
          
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al procesar el archivo');
          }
          
          const result = await res.json();
          setImportResult(result);
          alert(`¡Carga masiva completada! Se insertaron ${result.insertados} registros.`);
          fetchData();
        } catch (err) {
          setError(err.message);
        } finally {
          setImporting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError(err.message);
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    let headers = [];
    let rows = [];
    
    if (activeTab === 'personal') {
      headers = ['Nombre', 'CUIT', 'Teléfono', 'Rol', 'Activo'];
      rows = [
        ['Juan Pérez', '20-30456789-2', '11-1234-5678', 'Operario', 'sí'],
        ['Carlos López', '20-25896321-4', '11-9876-5432', 'Chofer', 'sí']
      ];
    } else if (activeTab === 'recursos') {
      headers = ['Nombre', 'Tipo', 'Patente', 'Descripción', 'Activo'];
      rows = [
        ['Elevador Clark 2.5T', 'Maquinaria', '', 'Autoelevador a gas', 'sí'],
        ['Camión Iveco Daily', 'Vehículo / Camión', 'AF234EE', 'Furgón de traslado', 'sí']
      ];
    } else if (activeTab === 'estructuras') {
      headers = ['Modelo_Estructura', 'Arcos totales', 'Estructura', 'Frente', 'Largo_Maximo', 'Arcos_Disponibles_Seleccion'];
      rows = [
        ['C10-L1', '10', 'Aluminio', '10.0', '50.0', '10'],
        ['C20-L2', '15', 'Acero', '20.0', '75.0', '15']
      ];
    } else if (activeTab === 'arcos') {
      headers = ['Producto', 'Arco', 'Modelo_Estructura', 'Sector', 'Qty_fija_arco'];
      rows = [
        ['Columna 10m', 'A1', 'C10-L1', 'Planta', '2'],
        ['Cumbrera 10m', 'A1', 'C10-L1', 'Pañol', '1']
      ];
    } else if (activeTab === 'modulos') {
      headers = ['Producto', 'Modulo', 'Sector', 'Modulacion', 'Qty_fija_modulo'];
      rows = [
        ['Lona Techo 5m', 'C10-L1_M1', 'Planta', '5', '1'],
        ['Correa Extensión', 'C10-L1_M2', 'Planta', '2', '4']
      ];
    } else if (activeTab === 'fijos') {
      headers = ['Producto', 'Fijos', 'Sector', 'Qty_fija_carpa'];
      rows = [
        ['Tensor Cruz Acero', 'C10-L1_F', 'Planta', '4'],
        ['Estaca de Anclaje', 'C10-L1_F', 'Pañol', '20']
      ];
    } else if (activeTab === 'clientes') {
      headers = ['Cuenta', 'Nombre', 'CUIT', 'Actividad', 'Estado', 'Observación', 'Domicilio', 'Localidad', 'Provincia', 'País', 'Teléfono', 'Email_1', 'Vendedores', 'Responsables', 'Latitud', 'Longitud'];
      rows = [
        ['CL-EXAMPLE', 'Empresa Ejemplo S.A.', '30-71234567-8', 'Corporativo', 'ACTIVO', 'Cliente Preferencial', 'Dean Funes 794', 'C.A.B.A.', 'Buenos Aires', 'ARGENTINA', '011-4321-1234', 'info@ejemplo.com', 'Mariana D´Angiola', 'Juan Pérez', '-34.6037', '-58.3816']
      ];
    } else if (activeTab === 'pisos') {
      headers = ['Estructura', 'Medida', 'Estado', 'Cantidad'];
      rows = [
        ['Placa Fenólico Fen01', '1.0x1.0', 'Regular', '300'],
        ['Módulo Tarima Escenario', '2.0x1.0', 'Nueva', '40']
      ];
    } else if (activeTab === 'lonas') {
      headers = ['Color', 'Tipo', 'Medida', 'Cantidad'];
      rows = [
        ['Blanco', 'Techo', '10x5', '25'],
        ['Transparente', 'Lateral con Ventana', '5x3', '12']
      ];
    } else if (activeTab === 'telas') {
      headers = ['Color', 'Cortina', 'Tipo', 'Stock'];
      rows = [
        ['Negro', 'Cortina Lateral', 'Nuevo', '50'],
        ['Blanco', 'Cielo Raso', 'Usado', '30']
      ];
    } else if (activeTab === 'alfombras') {
      headers = ['Colores', 'Estado', 'Metros'];
      rows = [
        ['Rojo Imperial', 'Nueva', '250'],
        ['Gris Ceniza', 'Usada', '180']
      ];
    } else if (activeTab === 'vendedores') {
      headers = ['Nombre', 'Activo'];
      rows = [
        ['Mariana D´Angiola', 'sí'],
        ['Pedro Salesman', 'sí']
      ];
    }

    const csvContent = "\uFEFF" + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `plantilla_${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFilteredData = () => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(item => {
      return Object.values(item).some(val => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      });
    });
  };

  const activeTabConfig = tabs.find(t => t.id === activeTab);
  const IconComponent = activeTabConfig?.icon || FileText;
  const filteredData = getFilteredData();

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase text-blue-900 tracking-wider Poppins">
                Administrador de Maestro de Datos
              </h1>
              <p className="text-xs text-slate-500 font-semibold">{activeTabConfig?.desc}</p>
            </div>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-3 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Manual</span>
          </button>
        </div>

        {/* Horizontal Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-6 border-t border-slate-100 pt-6">
          {tabs.map(t => {
            const TIcon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all-300 border cursor-pointer ${
                  isActive
                    ? 'bg-blue-900 border-blue-900 text-white shadow'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-900'
                }`}
              >
                <TIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left Side: Table List */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[400px] flex flex-col">
          {/* Filters and search */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-6">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Buscar en ${activeTabConfig?.label.toLowerCase()}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all-300"
              />
            </div>
            <div className="text-xs text-slate-400 font-bold shrink-0">
              {filteredData.length} registros encontrados
            </div>
          </div>

          {/* Loader or Error */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-900" />
              <span className="text-xs font-bold">Cargando catálogo...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
              <FileText className="w-12 h-12 text-slate-200 mb-3" />
              <div className="text-sm font-bold">No hay registros</div>
              <div className="text-xs mt-1">Crea un registro manual o sube un archivo CSV/Excel para empezar.</div>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                    <th className="p-3 font-mono">ID</th>
                    {/* Dynamic Headers based on Tab */}
                    {activeTab === 'personal' && (
                      <>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">CUIT</th>
                        <th className="p-3">Teléfono</th>
                        <th className="p-3">Rol / Función</th>
                        <th className="p-3">Estado</th>
                      </>
                    )}
                    {activeTab === 'recursos' && (
                      <>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Patente / Identif.</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3">Estado</th>
                      </>
                    )}
                    {activeTab === 'estructuras' && (
                      <>
                        <th className="p-3">Modelo</th>
                        <th className="p-3">Arcos Totales</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Frente (m)</th>
                        <th className="p-3">Largo Máx (m)</th>
                        <th className="p-3">Arcos Disp.</th>
                      </>
                    )}
                    {activeTab === 'arcos' && (
                      <>
                        <th className="p-3">Componente</th>
                        <th className="p-3">Arco</th>
                        <th className="p-3">Modelo Estructura</th>
                        <th className="p-3">Sector</th>
                        <th className="p-3">Cant. Fija</th>
                      </>
                    )}
                    {activeTab === 'modulos' && (
                      <>
                        <th className="p-3">Componente</th>
                        <th className="p-3">Módulo Val</th>
                        <th className="p-3">Modelo Estructura</th>
                        <th className="p-3">Sector</th>
                        <th className="p-3">Modulación</th>
                        <th className="p-3">Stock Inicial</th>
                      </>
                    )}
                    {activeTab === 'fijos' && (
                      <>
                        <th className="p-3">Componente</th>
                        <th className="p-3">Modelo Estructura</th>
                        <th className="p-3">Sector</th>
                        <th className="p-3">Cant. Fija</th>
                      </>
                    )}
                    {activeTab === 'clientes' && (
                      <>
                        <th className="p-3">Cuenta</th>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">CUIT</th>
                        <th className="p-3">Domicilio</th>
                        <th className="p-3">Localidad</th>
                        <th className="p-3">Vendedores</th>
                      </>
                    )}
                    {activeTab === 'vendedores' && (
                      <>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Estado</th>
                      </>
                    )}
                    {['lonas', 'telas', 'pisos', 'alfombras'].includes(activeTab) && (
                      <>
                        <th className="p-3">Nombre</th>
                        {activeTab === 'lonas' && <th className="p-3">Tipo</th>}
                        {activeTab === 'telas' && <th className="p-3">Tipo Cortina</th>}
                        {['lonas', 'telas', 'alfombras'].includes(activeTab) && <th className="p-3">Color</th>}
                        {['lonas', 'pisos'].includes(activeTab) && <th className="p-3">Medida</th>}
                        <th className="p-3">Estado</th>
                        <th className="p-3">Stock</th>
                      </>
                    )}
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredData.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-all-200">
                      <td className="p-3 text-slate-400 font-mono font-bold">{item.id}</td>
                      {/* Dynamic Cell Rendering */}
                      {activeTab === 'personal' && (
                        <>
                          <td className="p-3 font-bold text-slate-800 uppercase">{item.nombre}</td>
                          <td className="p-3 font-mono">{item.cuit || '─'}</td>
                          <td className="p-3">{item.telefono || '─'}</td>
                          <td className="p-3 font-bold text-blue-900">{item.rol_funcion}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${item.activo ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </>
                      )}
                      {activeTab === 'recursos' && (
                        <>
                          <td className="p-3 font-bold text-slate-800 uppercase">{item.nombre}</td>
                          <td className="p-3 text-blue-900 font-black text-[10px] uppercase">{item.tipo}</td>
                          <td className="p-3 font-mono">{item.patente_identificador || '─'}</td>
                          <td className="p-3 text-slate-400 truncate max-w-44" title={item.descripcion}>{item.descripcion || '─'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${item.activo ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </>
                      )}
                      {activeTab === 'estructuras' && (
                        <>
                          <td className="p-3 font-bold text-slate-800 uppercase">{item.modelo_estructura}</td>
                          <td className="p-3 text-center">{item.arcos_totales}</td>
                          <td className="p-3 text-blue-800 font-bold">{item.estructura_tipo}</td>
                          <td className="p-3">{item.frente} m</td>
                          <td className="p-3">{item.largo_maximo} m</td>
                          <td className="p-3 text-amber-600 font-black">{item.arcos_disponibles}</td>
                        </>
                      )}
                      {activeTab === 'arcos' && (
                        <>
                          <td className="p-3 font-bold text-slate-800 uppercase">{item.producto}</td>
                          <td className="p-3 font-mono font-bold text-blue-900">{item.arco}</td>
                          <td className="p-3 font-bold text-slate-500">{item.modelo_estructura}</td>
                          <td className="p-3 uppercase text-[10px]">{item.sector}</td>
                          <td className="p-3 font-black text-center">{item.qty_fija_arco}</td>
                        </>
                      )}
                      {activeTab === 'modulos' && (
                        <>
                          <td className="p-3 font-bold text-slate-800 uppercase">{item.producto}</td>
                          <td className="p-3 font-mono font-bold text-blue-900">{item.modulo_val}</td>
                          <td className="p-3 font-bold text-slate-500">{item.modelo_estructura}</td>
                          <td className="p-3 uppercase text-[10px]">{item.sector}</td>
                          <td className="p-3 text-center">{item.modulacion}m</td>
                          <td className="p-3 font-black text-center text-indigo-600">{item.stock_inicial}</td>
                        </>
                      )}
                      {activeTab === 'fijos' && (
                        <>
                          <td className="p-3 font-bold text-slate-800 uppercase">{item.producto}</td>
                          <td className="p-3 font-bold text-slate-500">{item.modelo_estructura}</td>
                          <td className="p-3 uppercase text-[10px]">{item.sector}</td>
                          <td className="p-3 font-black text-center">{item.qty_fija_carpa}</td>
                        </>
                      )}
                      {activeTab === 'clientes' && (
                        <>
                          <td className="p-3 font-mono font-bold text-blue-900">{item.cuenta}</td>
                          <td className="p-3 font-bold text-slate-850 uppercase max-w-44 truncate">{item.nombre}</td>
                          <td className="p-3 font-mono">{item.cuit || '─'}</td>
                          <td className="p-3 truncate max-w-40">{item.domicilio || '─'}</td>
                          <td className="p-3">{item.localidad || '─'}</td>
                          <td className="p-3 text-slate-400 max-w-32 truncate">{item.vendedores || '─'}</td>
                        </>
                      )}
                      {activeTab === 'vendedores' && (
                        <>
                          <td className="p-3 font-bold text-slate-800 uppercase">{item.nombre}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${item.activo ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </>
                      )}
                      {['lonas', 'telas', 'pisos', 'alfombras'].includes(activeTab) && (
                        <>
                          <td className="p-3 font-bold text-slate-800 uppercase max-w-44 truncate">{item.nombre}</td>
                          {activeTab === 'lonas' && <td className="p-3 text-slate-550">{item.tipo || '─'}</td>}
                          {activeTab === 'telas' && <td className="p-3 text-slate-550">{item.tipo || '─'}</td>}
                          {['lonas', 'telas', 'alfombras'].includes(activeTab) && <td className="p-3 font-bold text-blue-800">{item.color || '─'}</td>}
                          {['lonas', 'pisos'].includes(activeTab) && <td className="p-3 font-mono font-bold">{item.medida || '─'}</td>}
                          <td className="p-3">{item.estado}</td>
                          <td className="p-3 font-black text-amber-600">{item.stock_total}</td>
                        </>
                      )}
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 rounded-lg p-1.5 cursor-pointer transition-all-200"
                            title="Editar registro"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 rounded-lg p-1.5 cursor-pointer transition-all-200"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: CSV/Excel Upload Area */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-5 text-white shadow-md space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-300" />
              <h3 className="text-sm font-black uppercase tracking-wider">Carga Masiva</h3>
            </div>
            
            <p className="text-[11px] text-indigo-200 leading-relaxed font-medium">
              Sube una planilla Excel (`.xlsx`) o archivo separado por comas (`.csv`) para reemplazar por completo la tabla de <strong>{activeTabConfig?.label}</strong>.
            </p>

            <div 
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleImportFile(file);
              }}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-indigo-400 hover:border-white hover:bg-white/5 rounded-2xl p-6 text-center cursor-pointer transition-all-300 space-y-2 bg-black/15"
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv,.xlsx" 
                className="hidden" 
                onChange={(e) => e.target.files[0] && handleImportFile(e.target.files[0])} 
              />
              <FileText className="w-8 h-8 mx-auto text-indigo-300" />
              <div className="text-[11px] font-bold">Arrastra el archivo o haz click para seleccionar</div>
              <div className="text-[9px] text-indigo-300 font-medium">Formatos: .csv / .xlsx</div>
            </div>

            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Plantilla</span>
            </button>
          </div>

          {/* Tips box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] text-slate-500 space-y-2 font-medium">
            <div className="font-bold text-slate-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-blue-900" /> Nota de consistencia:
            </div>
            <p className="leading-relaxed">
              La carga de archivos vaciará la tabla activa antes de insertar las nuevas filas. Asegúrate de incluir todos los campos obligatorios.
            </p>
          </div>
        </div>
      </div>

      {/* -------------------- CREATE/EDIT MODAL -------------------- */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-xl p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button 
              onClick={() => setShowFormModal(false)} 
              className="absolute right-6 top-6 p-1 rounded-full hover:bg-slate-100 transition-all-300 border-0 cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>

            <h2 className="text-base font-black uppercase text-blue-900 tracking-wider Poppins mb-6">
              {editingItem ? `Editar en ${activeTabConfig?.label}` : `Nuevo Registro en ${activeTabConfig?.label}`}
            </h2>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-semibold text-slate-600">
              {/* Personal Form */}
              {activeTab === 'personal' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Nombre Completo *</label>
                      <input type="text" required value={formData.nombre || ''} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">CUIT *</label>
                      <input type="text" required placeholder="20-30456789-2" value={formData.cuit || ''} onChange={e => setFormData({ ...formData, cuit: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Teléfono</label>
                      <input type="text" value={formData.telefono || ''} onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Rol / Función *</label>
                      <select value={formData.rol_funcion || 'Operario'} onChange={e => setFormData({ ...formData, rol_funcion: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900">
                        <option value="Operario">Operario</option>
                        <option value="Chofer">Chofer</option>
                        <option value="Administrador">Administrador</option>
                        <option value="Supervisor">Supervisor</option>
                      </select>
                    </div>
                    <div className="flex items-center pt-5">
                      <button type="button" onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                        className="flex items-center gap-2 focus:outline-none border-0 bg-transparent cursor-pointer">
                        {formData.activo ? <CheckSquare className="w-5 h-5 text-blue-900" /> : <Square className="w-5 h-5 text-slate-300" />}
                        <span className="text-slate-700">Personal Activo</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Recursos Form */}
              {activeTab === 'recursos' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Nombre / Identificación *</label>
                      <input type="text" required value={formData.nombre || ''} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Tipo de Recurso *</label>
                      <select value={formData.tipo || 'Maquinaria'} onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900">
                        <option value="Vehículo / Camión">Vehículo / Camión</option>
                        <option value="Maquinaria">Maquinaria</option>
                        <option value="Herramienta">Herramienta</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Patente / Registro</label>
                      <input type="text" value={formData.patente_identificador || ''} onChange={e => setFormData({ ...formData, patente_identificador: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Descripción</label>
                      <textarea value={formData.descripcion || ''} onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900 h-20 resize-none" />
                    </div>
                    <div className="flex items-center col-span-2">
                      <button type="button" onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                        className="flex items-center gap-2 focus:outline-none border-0 bg-transparent cursor-pointer">
                        {formData.activo ? <CheckSquare className="w-5 h-5 text-blue-900" /> : <Square className="w-5 h-5 text-slate-300" />}
                        <span className="text-slate-700">Recurso Activo</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Estructuras Form */}
              {activeTab === 'estructuras' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Modelo de Estructura *</label>
                      <input type="text" required placeholder="ej. C10-L1" value={formData.modelo_estructura || ''} onChange={e => setFormData({ ...formData, modelo_estructura: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Tipo de Estructura *</label>
                      <select value={formData.estructura_tipo || 'Aluminio'} onChange={e => setFormData({ ...formData, estructura_tipo: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900">
                        <option value="Aluminio">Aluminio</option>
                        <option value="Acero">Acero</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Arcos Totales *</label>
                      <input type="number" required value={formData.arcos_totales || 0} onChange={e => setFormData({ ...formData, arcos_totales: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Ancho Frente (m) *</label>
                      <input type="number" step="0.1" required value={formData.frente || 0} onChange={e => setFormData({ ...formData, frente: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Largo Máximo (m) *</label>
                      <input type="number" step="0.1" required value={formData.largo_maximo || 0} onChange={e => setFormData({ ...formData, largo_maximo: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Arcos Disponibles *</label>
                      <input type="number" required value={formData.arcos_disponibles || 0} onChange={e => setFormData({ ...formData, arcos_disponibles: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                  </div>
                </>
              )}

              {/* Componentes Arcos / Modulos / Fijos Form */}
              {['arcos', 'modulos', 'fijos'].includes(activeTab) && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Producto / Componente *</label>
                      <input type="text" required value={formData.producto || ''} onChange={e => setFormData({ ...formData, producto: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Modelo de Estructura Asignado *</label>
                      <input type="text" required placeholder="ej. C10-L1" value={formData.modelo_estructura || ''} onChange={e => setFormData({ ...formData, modelo_estructura: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    {activeTab === 'arcos' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Código de Arco *</label>
                        <input type="text" required placeholder="ej. A1" value={formData.arco || ''} onChange={e => setFormData({ ...formData, arco: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    {activeTab === 'modulos' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Identificador de Módulo *</label>
                        <input type="text" required placeholder="ej. C10-L1_M1" value={formData.modulo_val || ''} onChange={e => setFormData({ ...formData, modulo_val: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    {activeTab === 'modulos' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Medida Modulación (m) *</label>
                        <input type="number" required value={formData.modulacion || 5} onChange={e => setFormData({ ...formData, modulacion: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Sector *</label>
                      <select value={formData.sector || 'Planta'} onChange={e => setFormData({ ...formData, sector: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900">
                        <option value="Planta">Planta</option>
                        <option value="Pañol">Pañol</option>
                      </select>
                    </div>
                    {activeTab === 'arcos' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Cantidad por Arco *</label>
                        <input type="number" required value={formData.qty_fija_arco || 0} onChange={e => setFormData({ ...formData, qty_fija_arco: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    {activeTab === 'modulos' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Stock Inicial *</label>
                        <input type="number" required value={formData.stock_inicial || 0} onChange={e => setFormData({ ...formData, stock_inicial: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    {activeTab === 'fijos' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Cantidad Fija por Carpa *</label>
                        <input type="number" required value={formData.qty_fija_carpa || 0} onChange={e => setFormData({ ...formData, qty_fija_carpa: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Clientes Form */}
              {activeTab === 'clientes' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Cuenta Única *</label>
                      <input type="text" required placeholder="ej. CL-COVELIA" value={formData.cuenta || ''} onChange={e => setFormData({ ...formData, cuenta: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Nombre o Razón Social *</label>
                      <input type="text" required value={formData.nombre || ''} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">CUIT</label>
                      <input type="text" value={formData.cuit || ''} onChange={e => setFormData({ ...formData, cuit: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Actividad</label>
                      <input type="text" value={formData.actividad || ''} onChange={e => setFormData({ ...formData, actividad: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Estado</label>
                      <input type="text" placeholder="ACTIVO" value={formData.estado || ''} onChange={e => setFormData({ ...formData, estado: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Teléfono</label>
                      <input type="text" value={formData.telefono || ''} onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Email</label>
                      <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Domicilio</label>
                      <input type="text" value={formData.domicilio || ''} onChange={e => setFormData({ ...formData, domicilio: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Localidad</label>
                      <input type="text" value={formData.localidad || ''} onChange={e => setFormData({ ...formData, localidad: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Provincia</label>
                      <input type="text" value={formData.provincia || ''} onChange={e => setFormData({ ...formData, provincia: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Vendedores Asignados</label>
                      <input type="text" placeholder="Separados por comas" value={formData.vendedores || ''} onChange={e => setFormData({ ...formData, vendedores: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Responsables</label>
                      <input type="text" placeholder="Separados por comas" value={formData.responsables || ''} onChange={e => setFormData({ ...formData, responsables: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Latitud</label>
                      <input type="number" step="any" placeholder="-34.6037" value={formData.latitud || ''} onChange={e => setFormData({ ...formData, latitud: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Longitud</label>
                      <input type="number" step="any" placeholder="-58.3816" value={formData.longitud || ''} onChange={e => setFormData({ ...formData, longitud: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Observación</label>
                      <textarea value={formData.observacion || ''} onChange={e => setFormData({ ...formData, observacion: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900 h-16 resize-none" />
                    </div>
                  </div>
                </>
              )}

              {/* Accesorios (Lonas, Telas, Pisos, Alfombras) Form */}
              {['lonas', 'telas', 'pisos', 'alfombras'].includes(activeTab) && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Nombre Completo del Producto *</label>
                      <input type="text" required value={formData.nombre || ''} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    {activeTab === 'lonas' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Tipo de Lona *</label>
                        <input type="text" placeholder="Techo / Lateral" value={formData.tipo || ''} onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    {activeTab === 'telas' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Tipo de Cortina *</label>
                        <input type="text" placeholder="Cielo Raso / Cortinado" value={formData.tipo || ''} onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    {['lonas', 'telas', 'alfombras'].includes(activeTab) && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Color</label>
                        <input type="text" value={formData.color || ''} onChange={e => setFormData({ ...formData, color: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    {['lonas', 'pisos'].includes(activeTab) && (
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Medida</label>
                        <input type="text" placeholder="ej. 10x5" value={formData.medida || ''} onChange={e => setFormData({ ...formData, medida: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Estado de Conservación</label>
                      <select value={formData.estado || 'Regular'} onChange={e => setFormData({ ...formData, estado: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900">
                        <option value="Nueva">Nueva</option>
                        <option value="Regular">Regular</option>
                        <option value="Usada">Usada</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                        {activeTab === 'alfombras' ? 'Metros de Stock *' : 'Stock Total *'}
                      </label>
                      <input type="number" required value={formData.stock_total || 0} onChange={e => setFormData({ ...formData, stock_total: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                  </div>
                </>
              )}

              {/* Vendedores Form */}
              {activeTab === 'vendedores' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Nombre Completo *</label>
                      <input type="text" required value={formData.nombre || ''} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-900" />
                    </div>
                    <div className="flex items-center col-span-2 pt-2">
                      <button type="button" onClick={() => setFormData({ ...formData, activo: !formData.activo })}
                        className="flex items-center gap-2 focus:outline-none border-0 bg-transparent cursor-pointer">
                        {formData.activo ? <CheckSquare className="w-5 h-5 text-blue-900" /> : <Square className="w-5 h-5 text-slate-300" />}
                        <span className="text-slate-700">Vendedor Activo</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-6 mt-6">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase transition-all-300 border-0 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-black uppercase tracking-wider transition-all-300 shadow border-0 cursor-pointer"
                >
                  {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
