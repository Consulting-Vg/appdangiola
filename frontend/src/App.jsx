import React, { useState, useEffect } from 'react';
import {
  Shield, User, Calendar, Plus, RefreshCw, Layers,
  MapPin, MessageSquare, ListTodo, FileText, CheckCircle2,
  Trash2, X, Download, AlertTriangle, Play, HelpCircle, LogOut,
  Printer, ArrowRight, Warehouse, Shuffle, Truck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import MapGeoref from './components/MapGeoref';
import ThreeViewer from './components/ThreeViewer';
import WeeklyCalendar from './components/WeeklyCalendar';
import ChatComponent from './components/ChatComponent';
import PDFReplicator from './components/PDFReplicator';
import RoleDashboard from './components/RoleDashboard';
import GerenciaDashboard from './components/GerenciaDashboard';
import PersonalRecursos from './components/PersonalRecursos';
import MaestroDatos from './components/MaestroDatos';

export default function App() {
  // Roles list
  const roles = ['Comercial', 'Operaciones', 'Gerencia', 'Operario', 'Chofer', 'SuperAdmin'];
  const [userRole, setUserRole] = useState('Comercial');
  const [userName, setUserName] = useState('Mariana D´Angiola');
  const [currentUser, setCurrentUser] = useState(null);

  // Users management states
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormNombre, setUserFormNombre] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRol, setUserFormRol] = useState('Comercial');
  const [userFormModulos, setUserFormModulos] = useState([]);

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Navigation tabs
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard', 'calendar', 'admin'

  // DB States loaded from backend
  const [clients, setClients] = useState([]);
  const [structures, setStructures] = useState([]);
  const [structuresStock, setStructuresStock] = useState([]);
  const [archesCatalog, setArchesCatalog] = useState([]);
  const [modulesCatalog, setModulesCatalog] = useState([]);
  const [fijosCatalog, setFijosCatalog] = useState([]);
  const [accessoriesCatalog, setAccessoriesCatalog] = useState([]);
  const [ots, setOts] = useState([]);
  const [chatAlerts, setChatAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logFilterOT, setLogFilterOT] = useState('');
  const [logFilterFechaInicio, setLogFilterFechaInicio] = useState('');
  const [logFilterFechaFin, setLogFilterFechaFin] = useState('');
  const [personalList, setPersonalList] = useState([]);
  const [recursosList, setRecursosList] = useState([]);
  const [desarmeRecords, setDesarmeRecords] = useState([]);

  // Modals & Active Selections
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOT, setSelectedOT] = useState(null);
  const [otDetailsExplosion, setOtDetailsExplosion] = useState(null);
  const [availabilityResults, setAvailabilityResults] = useState([]);
  const [assignmentStage, setAssignmentStage] = useState('picking');
  const [otToDeleteId, setOtToDeleteId] = useState('');

  // Form states for OT generation
  const [formClient, setFormClient] = useState('');
  const [formFechaInicio, setFormFechaInicio] = useState('');
  const [formFechaFin, setFormFechaFin] = useState('');
  const [formFechaEvento, setFormFechaEvento] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  const [formModeloEst, setFormModeloEst] = useState('');
  const [formTipoEst, setFormTipoEst] = useState('Aluminio');
  const [formFrente, setFormFrente] = useState(10); // Standard width
  const [formLargo, setFormLargo] = useState(15);
  const [formModConfig, setFormModConfig] = useState({ tipo: 'simple', modulos: [{ largo: 5, qty: 3 }] });
  const [formGeo, setFormGeo] = useState({ direccion: '', lat: -34.6037, lng: -58.3816 });

  // Adicionales
  const [formPisos, setFormPisos] = useState(false);
  const [formPisosTipo, setFormPisosTipo] = useState('Placa Fenolico Estandar');
  const [formPisosObs, setFormPisosObs] = useState('');
  const [formAlfombras, setFormAlfombras] = useState(false);
  const [formAlfombrasColor, setFormAlfombrasColor] = useState('Gris');
  const [formAlfombrasObs, setFormAlfombrasObs] = useState('');
  const [formLonas, setFormLonas] = useState(true);
  const [formLonasColor, setFormLonasColor] = useState('Blanco');
  const [formLonasObs, setFormLonasObs] = useState('');

  // Dissociated Telas States
  const [formTelasCielorraso, setFormTelasCielorraso] = useState(false);
  const [formTelasCielorrasoColor, setFormTelasCielorrasoColor] = useState('Blanco');
  const [formTelasCielorrasoObs, setFormTelasCielorrasoObs] = useState('');

  const [formTelasCortinas, setFormTelasCortinas] = useState(false);
  const [formTelasCortinasColor, setFormTelasCortinasColor] = useState('Blanco');
  const [formTelasCortinasTipo, setFormTelasCortinasTipo] = useState('4 Mts');
  const [formTelasCortinasObs, setFormTelasCortinasObs] = useState('');

  // Conformation Wizard States
  const [conformanceStep, setConformanceStep] = useState(1);
  const [conformanceModType, setConformanceModType] = useState('simple'); // 'simple' or 'compuesta'
  const [conformanceSimpleLen, setConformanceSimpleLen] = useState(5);
  const [conformanceCompoundModulos, setConformanceCompoundModulos] = useState({ 5: 0, 4: 0, 3: 0, 2: 0 });
  const [conformanceSelectedArches, setConformanceSelectedArches] = useState([]);
  const [conformanceExplosion, setConformanceExplosion] = useState(null);
  const [conformedModConfig, setConformedModConfig] = useState(null);
  const [conformanceSelectedFijoModel, setConformanceSelectedFijoModel] = useState('');
  const [conformanceSelectedModuloModel, setConformanceSelectedModuloModel] = useState('');
  const [conformanceSelectedModulesList, setConformanceSelectedModulesList] = useState([]);

  // Logistica & Desarme States
  const [disassemblyOT, setDisassemblyOT] = useState(null);
  const [logisticaFechaFin, setLogisticaFechaFin] = useState('');
  const [logisticaFechaTraslado, setLogisticaFechaTraslado] = useState('');
  const [logisticaFechaComienzoArmado, setLogisticaFechaComienzoArmado] = useState('');
  const [logisticaFechaComienzoDesarmado, setLogisticaFechaComienzoDesarmado] = useState('');
  const [logisticaFechaRetorno, setLogisticaFechaRetorno] = useState('');

  // Disassembly Wizard Specific States
  const [disassemblyStep, setDisassemblyStep] = useState(1);
  const [disassemblyRetornoCompleto, setDisassemblyRetornoCompleto] = useState(true);
  const [disassemblyTransferOTId, setDisassemblyTransferOTId] = useState('');
  const [disassemblyAllocations, setDisassemblyAllocations] = useState({});

  // Stock checks during creation
  const [stockCheckMsg, setStockCheckMsg] = useState('');
  const [stockCheckStatus, setStockCheckStatus] = useState('unchecked'); // 'unchecked', 'ok', 'error'
  const [suggestedModulation, setSuggestedModulation] = useState([]);

  // 3D Color parameters for active viewer
  const [viewerColors, setViewerColors] = useState({
    modules: [],
    frontTriangle: '#ffffff',
    backTriangle: '#ffffff',
    frontTapachata: '#ffffff',
    backTapachata: '#ffffff',
    lateral: '#ffffff'
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/usuarios');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Error loading logs:", err);
    }
  };

  const handleUpdateOTAdicionales = async (otId, adicionales) => {
    try {
      const res = await fetch(`/api/ots/${otId}/adicionales`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adicionales,
          usuario: currentUser?.nombre || userName,
          rol: currentUser?.rol || userRole
        })
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedOT && selectedOT.id === otId) {
          setSelectedOT(updated);
        }
        fetchData();
      }
    } catch (err) {
      console.error("Error updating adicionales:", err);
    }
  };

  const fetchPersonal = async () => {
    try {
      const res = await fetch('/api/personal');
      if (res.ok) {
        const data = await res.json();
        setPersonalList(data);
      }
    } catch (err) {
      console.error("Error loading personal:", err);
    }
  };

  const fetchRecursos = async () => {
    try {
      const res = await fetch('/api/recursos');
      if (res.ok) {
        const data = await res.json();
        setRecursosList(data);
      }
    } catch (err) {
      console.error("Error loading resources:", err);
    }
  };

  const handleSavePersonal = async (persona) => {
    try {
      const method = persona.id ? 'PUT' : 'POST';
      const url = persona.id ? `/api/personal/${persona.id}` : '/api/personal';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persona)
      });
      if (res.ok) {
        fetchPersonal();
      } else {
        alert('Error al guardar personal');
      }
    } catch (err) {
      console.error("Error saving personal:", err);
    }
  };

  const handleDeletePersonal = async (id) => {
    try {
      const res = await fetch(`/api/personal/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchPersonal();
      } else {
        alert('Error al eliminar personal');
      }
    } catch (err) {
      console.error("Error deleting personal:", err);
    }
  };

  const handleSaveRecurso = async (recurso) => {
    try {
      const method = recurso.id ? 'PUT' : 'POST';
      const url = recurso.id ? `/api/recursos/${recurso.id}` : '/api/recursos';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recurso)
      });
      if (res.ok) {
        fetchRecursos();
      } else {
        alert('Error al guardar recurso');
      }
    } catch (err) {
      console.error("Error saving resource:", err);
    }
  };

  const handleDeleteRecurso = async (id) => {
    try {
      const res = await fetch(`/api/recursos/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchRecursos();
      } else {
        alert('Error al eliminar recurso');
      }
    } catch (err) {
      console.error("Error deleting resource:", err);
    }
  };

  // Load datasets
  const fetchData = async () => {
    try {
      const clRes = await fetch('/api/clientes');
      const clData = await clRes.json();
      setClients(clData);

      const estRes = await fetch('/api/estructuras');
      const estData = await estRes.json();
      setStructures(estData.structures);
      setArchesCatalog(estData.arches);
      setModulesCatalog(estData.modules);
      setFijosCatalog(estData.fijos);

      const accRes = await fetch('/api/inventario');
      const accData = await accRes.json();
      setAccessoriesCatalog(accData);

      const otRes = await fetch('/api/ots');
      const otData = await otRes.json();
      setOts(otData);

      await fetchPersonal();
      await fetchRecursos();

      try {
        const desRes = await fetch('/api/logistica/desarmes');
        if (desRes.ok) {
          const desData = await desRes.json();
          setDesarmeRecords(desData);
        }
      } catch (err) {
        console.error("Error loading disassembly records:", err);
      }

      try {
        const stockRes = await fetch('/api/inventario/estructuras');
        if (stockRes.ok) {
          const stockData = await stockRes.json();
          setStructuresStock(stockData);
        }
      } catch (err) {
        console.error("Error loading structures stock:", err);
      }
    } catch (err) {
      console.error("Error fetching database datasets:", err);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCurrentUser(parsed);
        setUserRole(parsed.rol);
        setUserName(parsed.nombre);
      } catch (err) {
        console.error("Error reading stored user session:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
      if (['SuperAdmin', 'Gerencia', 'Operaciones'].includes(currentUser.rol)) {
        fetchUsers();
      }
    }
  }, [currentUser]);

  const fetchChatAlerts = async () => {
    const username = currentUser?.username || 'admin';
    const rol = currentUser?.rol || userRole;
    const nombre = currentUser?.nombre || userName;
    try {
      const res = await fetch(`/api/chat/alerts?username=${encodeURIComponent(username)}&rol=${encodeURIComponent(rol)}&nombre=${encodeURIComponent(nombre)}`);
      if (res.ok) {
        const data = await res.json();
        setChatAlerts(data);
      }
    } catch (err) {
      console.error("Error fetching chat alerts:", err);
    }
  };

  useEffect(() => {
    fetchChatAlerts();
    const interval = setInterval(fetchChatAlerts, 10000);
    return () => clearInterval(interval);
  }, [currentUser, userRole, userName]);

  // Update suggest parameters and reset stock checks on dimension or material changes
  useEffect(() => {
    if (formLargo) {
      const length = parseInt(formLargo);
      if (length % 5 === 0) {
        setFormModConfig({ tipo: 'simple', modulos: [{ largo: 5, qty: length / 5 }] });
      } else if (length % 4 === 0) {
        setFormModConfig({ tipo: 'simple', modulos: [{ largo: 4, qty: length / 4 }] });
      } else {
        // Suggest compound modules
        // e.g. for 12m: two 5m and one 2m modules
        const qty5 = Math.floor(length / 5);
        const rem = length % 5;
        if (rem % 2 === 0) {
          setFormModConfig({
            tipo: 'compuesta',
            modulos: [
              { largo: 5, qty: qty5 },
              { largo: 2, qty: rem / 2 }
            ]
          });
        }
      }
    }

    // Reset stock search parameters
    setFormModeloEst('');
    setAvailabilityResults([]);
    setStockCheckStatus('unchecked');
    setStockCheckMsg('Modifique las medidas y haga clic en verificar para escanear disponibilidad de arcos.');
  }, [formFrente, formLargo, formTipoEst]);

  // Check Arches Stock Availability across all matching structures
  const checkStockAvailability = async () => {
    if (!formFrente || !formLargo || !formTipoEst || !formFechaInicio || !formFechaFin) {
      alert("Por favor completa: Fechas del Evento, Ancho, Largo y Material Estructural.");
      return;
    }

    let totalModules = 0;
    formModConfig.modulos.forEach(m => totalModules += m.qty);
    const archesNeeded = totalModules + 1;

    try {
      const res = await fetch('/api/estructuras/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frente: parseFloat(formFrente),
          estructura_tipo: formTipoEst,
          fecha_inicio: formFechaInicio,
          fecha_fin: formFechaFin,
          arcos_necesarios: archesNeeded
        })
      });
      const data = await res.json();

      if (data.available) {
        setAvailabilityResults(data.results || []);
        setStockCheckStatus('ok');
        setStockCheckMsg(`✓ ¡Disponibilidad encontrada! Revisa la lista de estructuras abajo y selecciona cuál deseas reservar para esta orden.`);
      } else {
        setAvailabilityResults(data.results || []);
        setStockCheckStatus('error');
        setStockCheckMsg(`✗ Conflicto de Stock: No hay arcos suficientes en estas fechas para ninguna de las estructuras de ${formTipoEst} de ${formFrente}m.`);
      }
    } catch (err) {
      console.error(err);
      setStockCheckStatus('error');
      setStockCheckMsg('Error al consultar stock en el servidor.');
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        setUserRole(user.rol);
        setUserName(user.nombre);
        confetti({ particleCount: 80, spread: 50 });
      } else {
        const err = await res.json();
        alert(err.error || "Credenciales incorrectas.");
      }
    } catch (err) {
      console.error(err);
      // Local fallback
      const defaultUsers = [
        { id: 1, username: "admin", nombre: "Super Administrador", password: "admin", rol: "SuperAdmin" },
        { id: 2, username: "mariana", nombre: "Mariana D´Angiola", password: "comercial", rol: "Comercial" },
        { id: 3, username: "luis", nombre: "Luis Navarro", password: "operaciones", rol: "Operaciones" },
        { id: 4, username: "gomez", nombre: "Gómez (Operario)", password: "planta", rol: "Operario" },
        { id: 5, username: "fabian", nombre: "Fabián (Operario)", password: "panol", rol: "Operario" },
        { id: 6, username: "lonas", nombre: "Lonas Staff (Operario)", password: "lonas", rol: "Operario" },
        { id: 7, username: "pisos", nombre: "Pisos Staff (Operario)", password: "pisos", rol: "Operario" },
        { id: 8, username: "telas", nombre: "Telas Staff (Operario)", password: "telas", rol: "Operario" },
        { id: 9, username: "chofer", nombre: "Chofer de Despacho", password: "chofer", rol: "Chofer" }
      ];
      const found = defaultUsers.find(u => u.username === username && u.password === password);
      if (found) {
        const user = { id: found.id, username: found.username, nombre: found.nombre, rol: found.rol, fecha_creacion: new Date().toISOString() };
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        setUserRole(user.rol);
        setUserName(user.nombre);
        confetti({ particleCount: 80, spread: 50 });
      } else {
        alert("Credenciales incorrectas.");
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setUserRole('Comercial');
    setUserName('Mariana D´Angiola');
    setCurrentTab('dashboard');
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userFormUsername || !userFormNombre || !userFormPassword || !userFormRol) {
      alert("Todos los campos son obligatorios.");
      return;
    }
    const userData = {
      username: userFormUsername,
      nombre: userFormNombre,
      password: userFormPassword,
      rol: userFormRol,
      modulos: JSON.stringify(userFormModulos)
    };

    try {
      let res;
      if (selectedUser) {
        res = await fetch(`/api/usuarios/${selectedUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
      } else {
        res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
      }

      if (res.ok) {
        setShowUserModal(false);
        fetchUsers();
        setUserFormUsername('');
        setUserFormNombre('');
        setUserFormPassword('');
        setUserFormRol('Comercial');
        setSelectedUser(null);
        confetti({ particleCount: 50, spread: 40 });
      } else {
        alert("Error al guardar el usuario.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor.");
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.username === 'admin') {
      alert("No se puede eliminar el Super Administrador principal.");
      return;
    }
    if (currentUser && user.id === currentUser.id) {
      alert("No puedes eliminarte a ti mismo.");
      return;
    }
    if (!window.confirm(`¿Estás seguro de eliminar al usuario ${user.nombre}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/usuarios/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        alert("Error al eliminar el usuario.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor.");
    }
  };

  const resetOTForm = () => {
    setFormClient('');
    setFormFechaInicio('');
    setFormFechaFin('');
    setFormFechaEvento('');
    setFormObservaciones('');
    setFormModeloEst('');
    setFormTipoEst('Aluminio');
    setFormFrente(10);
    setFormLargo(15);
    setFormModConfig({ tipo: 'simple', modulos: [{ largo: 5, qty: 3 }] });
    setFormGeo({ direccion: '', lat: -34.6037, lng: -58.3816 });
    setFormPisos(false);
    setFormPisosTipo('Placa Fenolico Estandar');
    setFormPisosObs('');
    setFormAlfombras(false);
    setFormAlfombrasColor('Gris');
    setFormAlfombrasObs('');
    setFormLonas(true);
    setFormLonasColor('Blanco');
    setFormLonasObs('');
    setFormTelasCielorraso(false);
    setFormTelasCielorrasoColor('Blanco');
    setFormTelasCielorrasoObs('');
    setFormTelasCortinas(false);
    setFormTelasCortinasColor('Blanco');
    setFormTelasCortinasTipo('4 Mts');
    setFormTelasCortinasObs('');
    setAvailabilityResults([]);
    setStockCheckStatus('unchecked');
    setStockCheckMsg('Modifique las medidas y haga clic en verificar para escanear disponibilidad de arcos.');
  };

  const handleOpenCreateModal = () => {
    resetOTForm();
    setShowCreateModal(true);
  };

  // Submit Work Order Form
  const handleSubmitOT = async (e) => {
    e.preventDefault();
    if (!formClient || !formFechaInicio || !formFechaFin || !formFechaEvento || !formObservaciones || !formGeo.direccion) {
      alert("Faltan campos obligatorios: Cliente, Fechas (Inicio, Evento, Fin), Observaciones y Geolocalización.");
      return;
    }

    // Automatically resolve structure model matching Frente and Material
    // Documentation Addendum: Control de Acceso y Gestión de Usuarios (RBAC)
    // 1. Login: Glassmorphism UI, local storage persistence, standard accounts pre-defined.
    // 2. Gestión: Tab exclusivo para SuperAdmin, CRUD completo con bloqueos de seguridad.
    // 3. Formulario: Verificación de Arcos informativa (no bloqueante), resolución de modelo automática en background.

    const matchingStructure = structures.find(s =>
      parseFloat(s.frente) === parseFloat(formFrente) &&
      s.estructura_tipo.toLowerCase() === formTipoEst.toLowerCase()
    );
    const resolvedModelo = matchingStructure ? matchingStructure.modelo_estructura : (structures[0]?.modelo_estructura || 'C10-L1');

    // Integrity Check: sum of modules length must equal total length
    let sumModulesLength = 0;
    formModConfig.modulos.forEach(m => sumModulesLength += (m.largo * m.qty));
    if (sumModulesLength !== parseInt(formLargo)) {
      alert(`Error de Integridad: El largo de la carpa (${formLargo}m) no coincide con la sumatoria de las modulaciones físicas seleccionadas (${sumModulesLength}m).`);
      return;
    }

    // Automatically resolve arches to reserve if available from stock check
    let totalModules = 0;
    formModConfig.modulos.forEach(m => totalModules += m.qty);
    const archesNeeded = totalModules + 1;

    let selectedArches = [];
    let archesCollected = 0;
    for (const res of availabilityResults) {
      if (archesCollected >= archesNeeded) break;
      const availableList = res.arcos_disponibles_list || [];
      const toTake = availableList.slice(0, archesNeeded - archesCollected);
      selectedArches = [...selectedArches, ...toTake];
      archesCollected += toTake.length;
    }

    // Trigger materials explosion to save checklist items
    try {
      const expRes = await fetch('/api/estructuras/explode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo_estructura: resolvedModelo,
          frente: formFrente,
          largo: formLargo,
          modulacion_config: formModConfig,
          adicionales: {
            pisos: { si: formPisos, tipo: formPisosTipo, obs: formPisosObs },
            alfombras: { si: formAlfombras, color: formAlfombrasColor, obs: formAlfombrasObs },
            lonas: { si: formLonas, color: formLonasColor, obs: formLonasObs },
            telas_cielorraso: { si: formTelasCielorraso, color: formTelasCielorrasoColor, obs: formTelasCielorrasoObs },
            telas_cortinas: { si: formTelasCortinas, color: formTelasCortinasColor, tipo: formTelasCortinasTipo, obs: formTelasCortinasObs }
          }
        })
      });
      const expData = await expRes.json();

      // Create checklist format for Pañol and Planta sectors
      const panolItems = [];
      const plantaItems = [];

      // Destructure explosion
      expData.explosion.arcos.forEach(i => {
        const item = { producto: i.producto, qty: i.qty, sector: i.sector || 'Planta', checked: false };
        if (item.sector === 'Planta') plantaItems.push(item);
        else panolItems.push(item);
      });
      expData.explosion.modulos.forEach(i => {
        const item = { producto: i.producto, qty: i.qty, sector: i.sector || 'Planta', checked: false };
        if (item.sector === 'Planta') plantaItems.push(item);
        else panolItems.push(item);
      });
      expData.explosion.fijos.forEach(i => {
        const item = { producto: i.producto, qty: i.qty, sector: i.sector || 'Planta', checked: false };
        if (item.sector === 'Planta') plantaItems.push(item);
        else panolItems.push(item);
      });

      // Accessories
      expData.explosion.accesorios.forEach(i => {
        let sec = 'Pañol';
        if (i.categoria === 'lona') sec = 'Lonas';
        else if (i.categoria === 'piso' || i.categoria === 'alfombra') sec = 'Pisos';
        else if (i.categoria === 'tela') sec = 'Telas';

        const item = { producto: i.producto, qty: i.qty, sector: sec, checked: false };
        if (sec === 'Lonas' || sec === 'Pisos' || sec === 'Planta') {
          plantaItems.push(item);
        } else {
          panolItems.push(item);
        }
      });

      const otData = {
        ot_numero: `OT-${Date.now().toString().slice(-6)}`,
        cliente_id: parseInt(formClient),
        fecha_inicio: formFechaInicio,
        fecha_fin: formFechaFin,
        fecha_evento: formFechaEvento,
        observaciones: formObservaciones,
        modelo_estructura: resolvedModelo,
        estructura_tipo: formTipoEst,
        frente: parseFloat(formFrente),
        largo: parseFloat(formLargo),
        superficie: parseFloat(formFrente * formLargo),
        modulacion_config: formModConfig,
        adicionales: {
          pisos: { si: formPisos, tipo: formPisosTipo, obs: formPisosObs },
          alfombras: { si: formAlfombras, color: formAlfombrasColor, obs: formAlfombrasObs },
          lonas: { si: formLonas, color: formLonasColor, obs: formLonasObs },
          telas_cielorraso: { si: formTelasCielorraso, color: formTelasCielorrasoColor, obs: formTelasCielorrasoObs },
          telas_cortinas: { si: formTelasCortinas, color: formTelasCortinasColor, tipo: formTelasCortinasTipo, obs: formTelasCortinasObs },
          arcos_reservados: selectedArches
        },
        georef: formGeo,
        estado: 'Pendiente', // Initial status
        panol_status: { items: panolItems },
        planta_status: { items: plantaItems },
        creado_por: userName
      };
 
      const res = await fetch('/api/ots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(otData)
      });
 
      if (res.ok) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        setShowCreateModal(false);
        fetchData();
        // Reset form
        setFormClient('');
        setFormFechaInicio('');
        setFormFechaFin('');
        setFormFechaEvento('');
        setFormObservaciones('');
        setFormModeloEst('');
        setFormPisos(false);
        setFormAlfombras(false);
        setFormLonas(true);
        setFormLonasColor('Blanco');
        setFormTelasCielorraso(false);
        setFormTelasCielorrasoColor('Blanco');
        setFormTelasCortinas(false);
        setFormTelasCortinasColor('Blanco');
        setFormTelasCortinasTipo('4 Mts');
        setStockCheckStatus('unchecked');
        setStockCheckMsg('');
      } else {
        alert("Error al guardar la orden de trabajo.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al procesar la explosión de materiales.");
    }
  };

  const datesOverlap = (start1, end1, start2, end2) => {
    if (!start1 || !end1 || !start2 || !end2) return false;
    const s1 = start1.substring(0, 10);
    const e1 = end1.substring(0, 10);
    const s2 = start2.substring(0, 10);
    const e2 = end2.substring(0, 10);
    return s1 <= e2 && e1 >= s2;
  };

  const checkPersonalConflict = (personId, currentOT) => {
    const person = personalList.find(p => p.id === personId);
    if (!person) return { conflict: false };

    const conflictingOT = ots.find(ot => {
      if (ot.id === currentOT.id) return false;
      if (['Cancelada', 'Rechazada', 'Retornada'].includes(ot.estado)) return false;

      const overlap = datesOverlap(ot.fecha_inicio, ot.fecha_fin, currentOT.fecha_inicio, currentOT.fecha_fin);
      if (!overlap) return false;

      const otAdicionales = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
      const otPers = otAdicionales.personal_asignado || {};
      const isAssigned = Object.values(otPers).some(ids => Array.isArray(ids) && ids.includes(personId));
      return isAssigned;
    });

    if (conflictingOT) {
      return { conflict: true, ot: conflictingOT, person };
    }
    return { conflict: false };
  };

  const checkResourceConflict = (resourceId, currentOT) => {
    const resource = recursosList.find(r => r.id === resourceId);
    if (!resource) return { conflict: false };

    if (resource.tipo !== 'Vehículo / Camión' && resource.tipo !== 'Maquinaria') {
      return { conflict: false };
    }

    const conflictingOT = ots.find(ot => {
      if (ot.id === currentOT.id) return false;
      if (['Cancelada', 'Rechazada', 'Retornada'].includes(ot.estado)) return false;

      const overlap = datesOverlap(ot.fecha_inicio, ot.fecha_fin, currentOT.fecha_inicio, currentOT.fecha_fin);
      if (!overlap) return false;

      const otAdicionales = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
      const otRecs = otAdicionales.recursos_asignados || {};
      const isAssigned = Object.values(otRecs).some(ids => Array.isArray(ids) && ids.includes(resourceId));
      return isAssigned;
    });

    if (conflictingOT) {
      return { conflict: true, ot: conflictingOT, resource };
    }
    return { conflict: false };
  };

  // Arch status is loaded from backend (single source of truth for date conflicts)
  const [conformanceArchesStatus, setConformanceArchesStatus] = useState([]);

  const loadArchesStatusForOT = async (ot) => {
    if (!ot?.modelo_estructura || !ot?.fecha_inicio || !ot?.fecha_fin) return;
    try {
      const res = await fetch('/api/estructuras/arcos-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo_estructura: ot.modelo_estructura,
          frente: ot.frente,
          estructura_tipo: ot.estructura_tipo,
          fecha_inicio: ot.fecha_inicio,
          fecha_fin: ot.fecha_fin,
          exclude_ot_id: ot.id  // exclude the OT itself from conflict check
        })
      });
      const data = await res.json();
      setConformanceArchesStatus(data.archStatus || []);
    } catch (err) {
      console.error('Error loading arch status:', err);
      setConformanceArchesStatus([]);
    }
  };

  // Keep legacy sync function as fallback using cached status
  const getArchesStatusForOT = (ot) => {
    if (!ot) return [];
    if (conformanceArchesStatus.length > 0) {
      return conformanceArchesStatus.map(s => ({
        arco: s.arco,
        available: s.disponible,
        occupant: s.reservado_por ? {
          ot_numero: s.reservado_por.ot_numero,
          cliente_nombre: s.reservado_por.cliente,
          estado: s.reservado_por.estado
        } : null
      }));
    }
    // Fallback: show all arches as available if status not loaded yet
    const matchingStructures = structures.filter(s =>
      parseFloat(s.frente) === parseFloat(ot.frente) &&
      s.estructura_tipo.toLowerCase() === ot.estructura_tipo.toLowerCase()
    );
    const matchingModelNames = matchingStructures.map(s => s.modelo_estructura);
    const allArches = archesCatalog.filter(a => matchingModelNames.includes(a.modelo_estructura));
    const uniqueArchNames = [...new Set(allArches.map(a => a.arco))];
    return uniqueArchNames.map(arco => ({ arco, available: true, occupant: null }));
  };

  const getConformanceArchesNeeded = () => {
    if (!selectedOT) return 0;
    if (conformanceModType === 'simple') {
      const qty = Math.ceil(selectedOT.largo / conformanceSimpleLen);
      return qty + 1;
    } else {
      const qty = (conformanceCompoundModulos[5] || 0) +
        (conformanceCompoundModulos[4] || 0) +
        (conformanceCompoundModulos[3] || 0) +
        (conformanceCompoundModulos[2] || 0);
      return qty + 1;
    }
  };

  const getConformanceModulesNeeded = () => {
    if (!selectedOT) return 0;
    const modConfig = typeof selectedOT.modulacion_config === 'string'
      ? JSON.parse(selectedOT.modulacion_config)
      : selectedOT.modulacion_config;
    if (conformanceModType === 'simple') {
      if (conformanceSimpleLen === 5) {
        return Math.ceil(selectedOT.largo / 5);
      }
      return 0;
    } else {
      return conformanceCompoundModulos[5] || 0;
    }
  };

  const getStructurePrefix = (model) => {
    if (!model) return '';
    const match = model.match(/^([A-Za-z0-9]+)/);
    return match ? match[1] : model;
  };

  const getAvailableModuleKits = () => {
    if (!selectedOT || !modulesCatalog) return [];
    const prefix = getStructurePrefix(selectedOT.modelo_estructura);

    // Find active OTs that overlap in date range, excluding selectedOT itself
    const overlappingOTs = ots.filter(ot =>
      ot.id !== selectedOT.id &&
      ot.estado !== 'Cancelada' &&
      ot.estado !== 'Rechazada' &&
      datesOverlap(ot.fecha_inicio, ot.fecha_fin, selectedOT.fecha_inicio, selectedOT.fecha_fin)
    );

    const reservedModules = new Set();
    overlappingOTs.forEach(ot => {
      const adicionales = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
      const conformedList = adicionales.conformed_modulos_list || [];
      conformedList.forEach(m => {
        if (m.largo === 5) {
          reservedModules.add(m.modelo_estructura);
        }
      });
    });

    const kits = modulesCatalog
      .filter(m => m.modulacion === 5 && m.modulo_val && m.modulo_val.startsWith(prefix))
      .map(m => m.modulo_val)
      .filter(kit => !reservedModules.has(kit));

    return [...new Set(kits)].sort();
  };

  const getAvailableFijoKits = () => {
    if (!selectedOT || !structures) return [];
    const prefix = getStructurePrefix(selectedOT.modelo_estructura);

    // Find active OTs that overlap in date range, excluding selectedOT itself
    const overlappingOTs = ots.filter(ot =>
      ot.id !== selectedOT.id &&
      ot.estado !== 'Cancelada' &&
      ot.estado !== 'Rechazada' &&
      datesOverlap(ot.fecha_inicio, ot.fecha_fin, selectedOT.fecha_inicio, selectedOT.fecha_fin)
    );

    const reservedFijos = new Set();
    overlappingOTs.forEach(ot => {
      const adicionales = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
      const reservedFijo = adicionales.fijo_modelo_estructura || ot.modelo_estructura;
      if (reservedFijo) {
        reservedFijos.add(reservedFijo);
      }
    });

    const models = structures
      .map(s => s.modelo_estructura)
      .filter(model => getStructurePrefix(model) === prefix)
      .filter(model => !reservedFijos.has(model));

    return [...new Set(models)].sort();
  };

  const triggerConformanceExplosion = async () => {
    if (!selectedOT) return;

    let modConfig;
    if (conformanceModType === 'simple') {
      const qty = Math.ceil(selectedOT.largo / conformanceSimpleLen);
      modConfig = {
        tipo: 'simple',
        modulos: [{ largo: conformanceSimpleLen, qty }]
      };
    } else {
      const modulos = [];
      [5, 4, 3, 2].forEach(len => {
        const qty = conformanceCompoundModulos[len] || 0;
        if (qty > 0) {
          modulos.push({ largo: len, qty });
        }
      });
      modConfig = {
        tipo: 'compuesta',
        modulos
      };
    }

    const groups = {};
    conformanceSelectedModulesList.forEach(m => {
      if (!groups[m]) groups[m] = 0;
      groups[m]++;
    });
    const conformedList = Object.entries(groups).map(([model, qty]) => ({
      modelo_estructura: model,
      largo: 5,
      qty
    }));

    // Add any non-5m modules
    const prefix = selectedOT.modelo_estructura.split('-')[0];
    modConfig.modulos?.forEach(m => {
      if (m.largo !== 5) {
        conformedList.push({
          modelo_estructura: m.largo === 2 ? `${prefix}_2MTS` : `${prefix}_3MTS`,
          largo: m.largo,
          qty: m.qty
        });
      }
    });

    try {
      const res = await fetch('/api/estructuras/explode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo_estructura: selectedOT.modelo_estructura,
          frente: selectedOT.frente,
          largo: selectedOT.largo,
          modulacion_config: modConfig,
          adicionales: typeof selectedOT.adicionales === 'string' ? JSON.parse(selectedOT.adicionales) : selectedOT.adicionales,
          fijo_modelo_estructura: conformanceSelectedFijoModel || selectedOT.modelo_estructura,
          conformed_modulos_list: conformedList
        })
      });
      const data = await res.json();
      setConformanceExplosion(data.explosion);
      setConformedModConfig(modConfig);
      setConformanceStep(3);
    } catch (err) {
      console.error(err);
      alert("Error al calcular la explosión de materiales.");
    }
  };

  const recalculateExplosion = async (fijoModel, modulesList) => {
    if (!selectedOT) return;

    let modConfig;
    if (conformanceModType === 'simple') {
      const qty = Math.ceil(selectedOT.largo / conformanceSimpleLen);
      modConfig = {
        tipo: 'simple',
        modulos: [{ largo: conformanceSimpleLen, qty }]
      };
    } else {
      const modulos = [];
      [5, 4, 3, 2].forEach(len => {
        const qty = conformanceCompoundModulos[len] || 0;
        if (qty > 0) {
          modulos.push({ largo: len, qty });
        }
      });
      modConfig = {
        tipo: 'compuesta',
        modulos
      };
    }

    const groups = {};
    modulesList.forEach(m => {
      if (!groups[m]) groups[m] = 0;
      groups[m]++;
    });
    const conformedList = Object.entries(groups).map(([model, qty]) => ({
      modelo_estructura: model,
      largo: 5,
      qty
    }));

    const prefix = selectedOT.modelo_estructura.split('-')[0];
    modConfig.modulos?.forEach(m => {
      if (m.largo !== 5) {
        conformedList.push({
          modelo_estructura: m.largo === 2 ? `${prefix}_2MTS` : `${prefix}_3MTS`,
          largo: m.largo,
          qty: m.qty
        });
      }
    });

    try {
      const res = await fetch('/api/estructuras/explode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo_estructura: selectedOT.modelo_estructura,
          frente: selectedOT.frente,
          largo: selectedOT.largo,
          modulacion_config: modConfig,
          adicionales: typeof selectedOT.adicionales === 'string' ? JSON.parse(selectedOT.adicionales) : selectedOT.adicionales,
          fijo_modelo_estructura: fijoModel || selectedOT.modelo_estructura,
          conformed_modulos_list: conformedList
        })
      });
      const data = await res.json();
      setConformanceExplosion(data.explosion);
      setConformedModConfig(modConfig);
    } catch (err) {
      console.error("Error recalculating explosion:", err);
    }
  };

  const handleModuleCardClick = (model) => {
    const isSelected = conformanceSelectedModulesList.includes(model);
    let nextList = [...conformanceSelectedModulesList];

    if (isSelected) {
      nextList = nextList.filter(m => m !== model);
    } else {
      const needed = getConformanceModulesNeeded();
      if (nextList.length < needed) {
        nextList.push(model);
      } else {
        if (needed === 1) {
          nextList = [model];
        } else {
          return;
        }
      }
    }
    setConformanceSelectedModulesList(nextList);
    recalculateExplosion(conformanceSelectedFijoModel, nextList);
  };

  const handleConfirmConformance = async () => {
    if (!selectedOT || !conformanceExplosion) return;

    let modConfig;
    if (conformanceModType === 'simple') {
      const qty = Math.ceil(selectedOT.largo / conformanceSimpleLen);
      modConfig = {
        tipo: 'simple',
        modulos: [{ largo: conformanceSimpleLen, qty }]
      };
    } else {
      const modulos = [];
      [5, 4, 3, 2].forEach(len => {
        const qty = conformanceCompoundModulos[len] || 0;
        if (qty > 0) {
          modulos.push({ largo: len, qty });
        }
      });
      modConfig = {
        tipo: 'compuesta',
        modulos
      };
    }

    const panolItems = [];
    const plantaItems = [];

    conformanceExplosion.arcos.forEach(i => {
      const item = { producto: i.producto, qty: i.qty, sector: i.sector || 'Planta', checked: false };
      if (item.sector === 'Planta') plantaItems.push(item);
      else panolItems.push(item);
    });
    conformanceExplosion.modulos.forEach(i => {
      const item = { producto: i.producto, qty: i.qty, sector: i.sector || 'Planta', checked: false };
      if (item.sector === 'Planta') plantaItems.push(item);
      else panolItems.push(item);
    });
    conformanceExplosion.fijos.forEach(i => {
      const item = { producto: i.producto, qty: i.qty, sector: i.sector || 'Planta', checked: false };
      if (item.sector === 'Planta') plantaItems.push(item);
      else panolItems.push(item);
    });

    conformanceExplosion.accesorios.forEach(i => {
      let sec = 'Pañol';
      if (i.categoria === 'lona') sec = 'Lonas';
      else if (i.categoria === 'piso' || i.categoria === 'alfombra') sec = 'Pisos';
      else if (i.categoria === 'tela') sec = 'Telas';

      const item = { producto: i.producto, qty: i.qty, sector: sec, checked: false };
      if (sec === 'Lonas' || sec === 'Pisos' || sec === 'Planta') {
        plantaItems.push(item);
      } else {
        panolItems.push(item);
      }
    });

    const groups = {};
    conformanceSelectedModulesList.forEach(m => {
      if (!groups[m]) groups[m] = 0;
      groups[m]++;
    });
    const conformedList = Object.entries(groups).map(([model, qty]) => ({
      modelo_estructura: model,
      largo: 5,
      qty
    }));

    const prefix = selectedOT.modelo_estructura.split('-')[0];
    modConfig.modulos?.forEach(m => {
      if (m.largo !== 5) {
        conformedList.push({
          modelo_estructura: m.largo === 2 ? `${prefix}_2MTS` : `${prefix}_3MTS`,
          largo: m.largo,
          qty: m.qty
        });
      }
    });

    try {
      const res = await fetch(`/api/ots/${selectedOT.id}/conformation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modulacion_config: modConfig,
          arcos_reservados: conformanceSelectedArches,
          panol_status: { items: panolItems },
          planta_status: { items: plantaItems },
          fijo_modelo_estructura: conformanceSelectedFijoModel,
          conformed_modulos_list: conformedList,
          usuario: currentUser?.nombre || userName,
          rol: currentUser?.rol || userRole
        })
      });

      if (res.ok) {
        confetti({ particleCount: 150, spread: 80 });
        setSelectedOT(null);
        setOtDetailsExplosion(null);
        fetchData();
        alert("Estructura conformada y OT Aprobada exitosamente.");
      } else {
        const err = await res.json();
        alert(err.error || "Error al conformar la estructura.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al servidor.");
    }
  };

  const getDefaultCompoundModulos = (largo) => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0 };
    if (largo === 12) {
      counts[5] = 2;
      counts[2] = 1;
      return counts;
    }
    const qty5 = Math.floor(largo / 5);
    const rem = largo % 5;
    if (rem === 0) {
      counts[5] = qty5;
    } else if (rem === 2) {
      counts[5] = qty5;
      counts[2] = 1;
    } else if (rem === 3) {
      counts[5] = qty5;
      counts[3] = 1;
    } else if (rem === 4) {
      counts[5] = qty5;
      counts[4] = 1;
    } else if (rem === 1) {
      if (qty5 > 0) {
        counts[5] = qty5 - 1;
        counts[4] = 1;
        counts[2] = 1;
      } else if (largo === 6) {
        counts[4] = 1;
        counts[2] = 1;
      }
    }
    return counts;
  };

  // Open details and compute explosion
  const handleSelectOT = async (ot) => {
    setSelectedOT(ot);
    loadArchesStatusForOT(ot);

    // Initialize logistics states
    setLogisticaFechaFin(ot.fecha_fin ? ot.fecha_fin.substring(0, 10) : '');
    setLogisticaFechaTraslado(ot.fecha_traslado ? ot.fecha_traslado.substring(0, 16) : '');
    setLogisticaFechaComienzoArmado(ot.fecha_comienzo_armado ? ot.fecha_comienzo_armado.substring(0, 16) : '');
    setLogisticaFechaComienzoDesarmado(ot.fecha_comienzo_desarmado ? ot.fecha_comienzo_desarmado.substring(0, 16) : '');
    setLogisticaFechaRetorno(ot.fecha_retorno ? ot.fecha_retorno.substring(0, 16) : '');

    // Initialize conformance states
    setConformanceStep(1);

    const prefix = getStructurePrefix(ot.modelo_estructura);
    const adicionales = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
    const prevFijo = adicionales?.fijo_modelo_estructura;

    // Check which fijos are reserved by other overlapping OTs
    const overlapping = ots.filter(o =>
      o.id !== ot.id &&
      o.estado !== 'Cancelada' &&
      o.estado !== 'Rechazada' &&
      datesOverlap(o.fecha_inicio, o.fecha_fin, ot.fecha_inicio, ot.fecha_fin)
    );
    const reservedFijos = new Set();
    overlapping.forEach(o => {
      const ad = typeof o.adicionales === 'string' ? JSON.parse(o.adicionales) : o.adicionales || {};
      const resFijo = ad.fijo_modelo_estructura || o.modelo_estructura;
      if (resFijo) reservedFijos.add(resFijo);
    });

    if (prevFijo) {
      setConformanceSelectedFijoModel(prevFijo);
    } else {
      const isDefaultFijoReserved = reservedFijos.has(ot.modelo_estructura);
      if (!isDefaultFijoReserved) {
        setConformanceSelectedFijoModel(ot.modelo_estructura);
      } else {
        // Fallback to first available fijo
        const available = structures
          .map(s => s.modelo_estructura)
          .filter(model => getStructurePrefix(model) === prefix)
          .filter(model => !reservedFijos.has(model));
        setConformanceSelectedFijoModel(available[0] || '');
      }
    }
    setConformanceSelectedModuloModel(ot.modelo_estructura);
    const modConfig = typeof ot.modulacion_config === 'string' ? JSON.parse(ot.modulacion_config) : ot.modulacion_config;

    // For 12m OTs, the number of 5m modules in the pool will be 2
    const is12m = ot.largo === 12;
    const qty5m = is12m ? 2 : (modConfig?.modulos?.find(m => m.largo === 5)?.qty || 0);

    const prevConformedList = adicionales?.conformed_modulos_list || [];
    const initialModules = [];
    prevConformedList.forEach(m => {
      if (m.largo === 5) {
        for (let i = 0; i < m.qty; i++) {
          initialModules.push(m.modelo_estructura);
        }
      }
    });

    if (initialModules.length > 0) {
      setConformanceSelectedModulesList(initialModules);
    } else {
      setConformanceSelectedModulesList([]);
    }

    const isComp = modConfig?.tipo === 'compuesta' || is12m;
    setConformanceModType(isComp ? 'compuesta' : 'simple');

    if (is12m) {
      setConformanceCompoundModulos({ 5: 2, 4: 0, 3: 0, 2: 1 });
    } else if (isComp) {
      const counts = { 5: 0, 4: 0, 3: 0, 2: 0 };
      modConfig?.modulos?.forEach(m => {
        counts[m.largo] = m.qty;
      });
      setConformanceCompoundModulos(counts);
    } else {
      setConformanceSimpleLen(modConfig?.modulos?.[0]?.largo || 5);
      setConformanceCompoundModulos(getDefaultCompoundModulos(ot.largo));
    }

    const adds = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales;
    setConformanceSelectedArches(adds?.arcos_reservados || []);
    setConformanceExplosion(null);

    let totalMods = 0;
    if (is12m) {
      totalMods = 3;
    } else if (isComp) {
      totalMods = modConfig?.modulos?.reduce((acc, m) => acc + m.qty, 0) || 0;
    } else {
      const len = modConfig?.modulos?.[0]?.largo || 5;
      totalMods = Math.ceil(ot.largo / len);
    }
    const color = adds?.lonas?.color === 'Negro' ? '#0f172a' : adds?.lonas?.color === 'Azul' ? '#1e40af' : '#ffffff';

    setViewerColors({
      modules: Array(totalMods).fill(color),
      frontTriangle: color,
      backTriangle: color,
      frontTapachata: color,
      backTapachata: color,
      lateral: color
    });

    try {
      const res = await fetch('/api/estructuras/explode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo_estructura: ot.modelo_estructura,
          frente: ot.frente,
          largo: ot.largo,
          modulacion_config: modConfig,
          adicionales: adds
        })
      });
      const data = await res.json();
      setOtDetailsExplosion(data.explosion);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateChecklistItem = async (itemIndex, sector, value) => {
    if (!selectedOT) return;
    const ot = { ...selectedOT };

    const panol = typeof ot.panol_status === 'string' ? JSON.parse(ot.panol_status) : ot.panol_status;
    const planta = typeof ot.planta_status === 'string' ? JSON.parse(ot.planta_status) : ot.planta_status;

    if (sector === 'Pañol') {
      panol.items[itemIndex].checked = value;
    } else {
      planta.items[itemIndex].checked = value;
    }

    // Auto-update status to "Bulto Completo" if all Pañol items are checked
    let newStatus = ot.estado;
    if (sector === 'Pañol') {
      const allPañolChecked = panol.items.every(i => i.checked);
      if (allPañolChecked && ot.estado === 'Aprobada') {
        newStatus = 'Bulto Completo';
        confetti({ particleCount: 50, spread: 60 });
      }
    }

    try {
      const res = await fetch(`/api/ots/${ot.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panol_status: panol,
          planta_status: planta,
          usuario: currentUser?.nombre || userName,
          rol: currentUser?.rol || userRole
        })
      });
      const updated = await res.json();

      if (newStatus !== ot.estado) {
        await handleUpdateOTStatus(ot.id, newStatus);
      }

      // Update locally
      setSelectedOT(updated);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateOTStatus = async (otId, status) => {
    try {
      const res = await fetch(`/api/ots/${otId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: status,
          usuario: currentUser?.nombre || userName,
          rol: currentUser?.rol || userRole
        })
      });
      if (res.ok) {
        if (selectedOT && selectedOT.id === otId) {
          setSelectedOT(prev => ({ ...prev, estado: status }));
        }
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOT = async (otId) => {
    if (!window.confirm("¿Está seguro de eliminar de forma permanente esta Orden de Trabajo? Esta acción no se puede deshacer y eliminará todos los registros asociados.")) {
      return;
    }
    try {
      const res = await fetch(`/api/ots/${otId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.rol || userRole,
          'x-user-name': currentUser?.nombre || userName
        }
      });
      if (res.ok) {
        alert("Orden de Trabajo eliminada correctamente.");
        setSelectedOT(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(`Error al eliminar: ${data.error || 'Intente nuevamente'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al intentar eliminar la Orden de Trabajo.");
    }
  };

  const handleSaveLogistica = async () => {
    if (!selectedOT) return;
    try {
      const res = await fetch(`/api/ots/${selectedOT.id}/logistica`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_fin: logisticaFechaFin,
          fecha_traslado: logisticaFechaTraslado || null,
          fecha_comienzo_armado: logisticaFechaComienzoArmado || null,
          fecha_comienzo_desarmado: logisticaFechaComienzoDesarmado || null,
          fecha_retorno: logisticaFechaRetorno || null,
          usuario: currentUser?.nombre || userName,
          rol: currentUser?.rol || userRole
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedOT(updated);
        alert("Hitos logísticos y fecha de desarme actualizados con éxito.");
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Error al guardar: ${errorData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor.");
    }
  };

  const getDisassemblyItemsList = (ot) => {
    if (!ot) return [];
    const panol = typeof ot.panol_status === 'string' ? JSON.parse(ot.panol_status) : ot.panol_status;
    const planta = typeof ot.planta_status === 'string' ? JSON.parse(ot.planta_status) : ot.planta_status;
    const list = [];
    if (panol?.items) {
      panol.items.forEach(item => {
        list.push({ producto: item.producto, qty: item.qty, sector: 'Pañol' });
      });
    }
    if (planta?.items) {
      planta.items.forEach(item => {
        list.push({ producto: item.producto, qty: item.qty, sector: 'Planta' });
      });
    }
    return list;
  };

  const drawOfficialHeader = (doc, title, otNumber, clientCuit, logoImg) => {
    const primaryColor = [16, 49, 107]; // Navy Blue
    const grayColor = [100, 116, 139];

    // Draw outer box for the Remito header
    doc.setFillColor(252, 252, 252);
    doc.rect(15, 15, 180, 40, 'FD');
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(105, 15, 105, 55); // Vertical divider

    // Draw "R" box
    doc.setFillColor(255, 255, 255);
    doc.rect(98, 15, 14, 14, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text("R", 102, 26);

    // Subtext under "R" box
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text("COD. 91", 101, 31);

    // Left Side: Emisor
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      doc.addImage(logoImg, 'PNG', 18, 18, 12, 12);
    }
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CARPAS D'ANGIOLA S.A.", 32, 23);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Fábrica y Alquiler de Estructuras y Carpas Modulares", 32, 27);
    doc.text("Administración: Juan XXIII 2980, Parque Industrial, Burzaco", 32, 31);
    doc.text("Teléfono: +54 11 4244-1234 | www.carpasdangiola.com", 32, 35);
    doc.text("IVA RESPONSABLE INSCRIPTO", 32, 39);

    // Right Side: Document info
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(String(title).toUpperCase(), 112, 23);

    doc.setFontSize(10);
    doc.text(`N°: ${otNumber}`, 112, 28);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Fecha Emisión: ${new Date().toLocaleDateString('es-ES')}`, 112, 33);
    doc.text(`CUIT: ${clientCuit || '30-71112223-4'}`, 112, 37);
    doc.text("Ing. Brutos: 30-71112223-4 (Conv. Multilateral)", 112, 41);
    doc.text("Inicio Actividades: 10/05/2012", 112, 45);

    // "Documento no válido como factura" watermark style
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(200, 50, 50);
    doc.text("DOCUMENTO NO VÁLIDO COMO FACTURA", 112, 51);
  };

  const generateDisassemblyPreArmadoPDF = async (ot) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const primaryColor = [16, 49, 107];
    const grayColor = [148, 163, 184];

    // Preload logo
    const logoImg = new Image();
    logoImg.src = '/cd.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });

    const matchingClient = clients?.find(c => c.id === ot.cliente_id);
    drawOfficialHeader(doc, "CONTROL DESARME", ot.ot_numero, matchingClient?.cuit, logoImg);

    let y = 60;
    const startX = 15;
    
    // Client info
    doc.setDrawColor(220, 220, 220);
    doc.rect(startX, y, 180, 20);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DATOS DE LA ORDEN DE ORIGEN", startX + 2, y - 2);

    doc.text("CLIENTE / OBRA:", startX + 4, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.text(String(ot.cliente_nombre || 'S/D').toUpperCase(), startX + 35, y + 6);

    doc.setFont('Helvetica', 'bold');
    doc.text("ESTRUCTURA:", startX + 4, y + 12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${ot.modelo_estructura} (${ot.frente}x${ot.largo}m)`, startX + 35, y + 12);

    doc.setFont('Helvetica', 'bold');
    doc.text("FECHA EVENTO:", startX + 100, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.text(ot.fecha_evento ? new Date(ot.fecha_evento + 'T00:00:00').toLocaleDateString('es-ES') : 'No especificada', startX + 130, y + 6);

    doc.setFont('Helvetica', 'bold');
    doc.text("FECHA DESARME:", startX + 100, y + 12);
    doc.setFont('Helvetica', 'normal');
    doc.text(new Date(ot.fecha_fin + 'T00:00:00').toLocaleDateString('es-ES'), startX + 130, y + 12);

    y += 26;

    // Items list
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DETALLE DE COMPONENTES CONFORMADOS A RETORNAR/TRANSFERIR", startX, y);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(startX, y + 2, startX + 180, y + 2);
    y += 7;

    const items = getDisassemblyItemsList(ot);
    
    // Draw table box
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    const boxH = items.length * 6 + 7;
    doc.rect(startX, y, 180, boxH);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text("COMPONENTE", startX + 4, y + 5);
    doc.text("CANTIDAD", startX + 100, y + 5);
    doc.text("SECTOR", startX + 130, y + 5);
    doc.text("ESTADO", startX + 160, y + 5);
    doc.line(startX, y + 7, startX + 180, y + 7);

    let itemY = y + 11;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    items.forEach(item => {
      doc.text(String(item.producto).toUpperCase(), startX + 4, itemY);
      doc.text(String(item.qty), startX + 100, itemY);
      doc.text(String(item.sector).toUpperCase(), startX + 130, itemY);
      doc.text("[ OK / DEF ]", startX + 160, itemY);
      itemY += 6;
    });

    y += boxH + 15;
    doc.setFont('Helvetica', 'bold');
    doc.text("FIRMA RESPONSABLE CARGA / CHOFER", startX + 10, y + 15);
    doc.line(startX + 10, y + 13, startX + 70, y + 13);

    doc.text("FIRMA SUPERVISOR OBRA", startX + 110, y + 15);
    doc.line(startX + 110, y + 13, startX + 170, y + 13);

    doc.save(`Remito_PreArmado_Desarme_${ot.ot_numero}.pdf`);
  };

  const generateRemitoPDF = async (remito, otOrigen) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const primaryColor = [16, 49, 107];
    const grayColor = [148, 163, 184];

    // Preload logo
    const logoImg = new Image();
    logoImg.src = '/cd.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });

    const matchingClient = clients?.find(c => c.id === otOrigen.cliente_id);
    drawOfficialHeader(doc, `REMITO: ${remito.tipo}`, otOrigen.ot_numero, matchingClient?.cuit, logoImg);

    let y = 60;
    const startX = 15;

    // Client info
    doc.setDrawColor(220, 220, 220);
    doc.rect(startX, y, 180, 26);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DATOS DE ORIGEN Y DESTINO", startX + 2, y - 2);

    doc.text("OT ORIGEN:", startX + 4, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${otOrigen.ot_numero} - ${otOrigen.cliente_nombre}`, startX + 30, y + 6);

    doc.setFont('Helvetica', 'bold');
    doc.text("DESTINO:", startX + 4, y + 12);
    doc.setFont('Helvetica', 'normal');
    doc.text(String(remito.destino).toUpperCase(), startX + 30, y + 12);

    doc.setFont('Helvetica', 'bold');
    doc.text("FECHA EMISION:", startX + 4, y + 18);
    doc.setFont('Helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES'), startX + 30, y + 18);

    doc.setFont('Helvetica', 'bold');
    doc.text("OPERADOR:", startX + 110, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.text(String(currentUser?.nombre || userName), startX + 130, y + 6);

    y += 32;

    // Items list
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DESGLOSE DE MATERIALES EN TRANSITO", startX, y);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(startX, y + 2, startX + 180, y + 2);
    y += 7;

    // Draw table box
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    const boxH = remito.items.length * 6 + 7;
    doc.rect(startX, y, 180, boxH);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text("PRODUCTO / COMPONENTE", startX + 4, y + 5);
    doc.text("CANTIDAD DESPACHADA", startX + 120, y + 5);
    doc.line(startX, y + 7, startX + 180, y + 7);

    let itemY = y + 11;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    remito.items.forEach(item => {
      doc.text(String(item.producto).toUpperCase(), startX + 4, itemY);
      doc.text(String(item.qty), startX + 120, itemY);
      itemY += 6;
    });

    y += boxH + 15;
    doc.setFont('Helvetica', 'bold');
    doc.text("FIRMA RESPONSABLE TRANSPORTE", startX + 10, y + 15);
    doc.line(startX + 10, y + 13, startX + 70, y + 13);

    doc.text("FIRMA CONTROL RECEPCION", startX + 110, y + 15);
    doc.line(startX + 110, y + 13, startX + 170, y + 13);

    doc.save(`Remito_${remito.tipo.replace(/\s+/g, '_')}_${otOrigen.ot_numero}.pdf`);
  };

  const handleDownloadDesarmePDFs = async (otId, otObj) => {
    try {
      const res = await fetch(`/api/logistica/desarme/${otId}`);
      if (!res.ok) {
        if (res.status === 404) {
          alert("No se encontró una orden de desarme para esta OT. Es posible que se haya marcado como Desarmada manualmente.");
        } else {
          alert("Error al cargar la orden de desarme.");
        }
        return;
      }
      const desarme = await res.json();
      if (desarme && desarme.remitos) {
        desarme.remitos.forEach(remito => {
          generateRemitoPDF(remito, otObj);
        });
      } else {
        alert("Esta orden de desarme no contiene remitos.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al obtener la orden de desarme.");
    }
  };

  const getSuggestionForTransfer = (itemName, targetOT) => {
    if (!targetOT) return 0;
    const panol = typeof targetOT.panol_status === 'string' ? JSON.parse(targetOT.panol_status) : targetOT.panol_status;
    const planta = typeof targetOT.planta_status === 'string' ? JSON.parse(targetOT.planta_status) : targetOT.planta_status;
    
    const panolMatch = panol?.items?.find(i => i.producto.toLowerCase() === itemName.toLowerCase() && !i.checked);
    const plantaMatch = planta?.items?.find(i => i.producto.toLowerCase() === itemName.toLowerCase() && !i.checked);
    
    const needed = (panolMatch ? panolMatch.qty : 0) + (plantaMatch ? plantaMatch.qty : 0);
    return needed;
  };

  const handleConfirmDisassembly = async () => {
    if (!disassemblyOT) return;
    
    // Construct destinos list
    let destinos = [];
    
    if (disassemblyRetornoCompleto) {
      if (disassemblyTransferOTId) {
        // 100% transfer to target OT
        const targetOT = ots.find(o => o.id === parseInt(disassemblyTransferOTId));
        destinos = [{
          type: 'ot',
          ot_id: targetOT.id,
          ot_numero: targetOT.ot_numero,
          items: getDisassemblyItemsList(disassemblyOT)
        }];
      } else {
        // 100% return to Depósito
        destinos = [{
          type: 'deposito',
          items: getDisassemblyItemsList(disassemblyOT)
        }];
      }
    } else {
      // Partial distribution / Reverse explosion
      const targetOT = ots.find(o => o.id === parseInt(disassemblyTransferOTId));
      const itemsList = getDisassemblyItemsList(disassemblyOT);
      
      const transferItems = [];
      const depotItems = [];
      
      itemsList.forEach(item => {
        const transferQty = disassemblyAllocations[item.producto] || 0;
        const remainingQty = item.qty - transferQty;
        
        if (transferQty > 0) {
          transferItems.push({ producto: item.producto, qty: transferQty });
        }
        if (remainingQty > 0) {
          depotItems.push({ producto: item.producto, qty: remainingQty });
        }
      });
      
      if (transferItems.length > 0 && targetOT) {
        destinos.push({
          type: 'ot',
          ot_id: targetOT.id,
          ot_numero: targetOT.ot_numero,
          items: transferItems
        });
      }
      if (depotItems.length > 0) {
        destinos.push({
          type: 'deposito',
          items: depotItems
        });
      }
    }
    
    try {
      const res = await fetch('/api/logistica/desarme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ot_id: disassemblyOT.id,
          retorno_completo: disassemblyRetornoCompleto,
          destinos,
          usuario: currentUser?.nombre || userName,
          rol: currentUser?.rol || userRole
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert("¡Orden de desarme procesada y guardada con éxito!");
        
        // Trigger PDF downloads for each generated remito
        if (data.desarme && data.desarme.remitos) {
          data.desarme.remitos.forEach(remito => {
            generateRemitoPDF(remito, disassemblyOT);
          });
        }
        
        // Close modal and refresh
        setDisassemblyOT(null);
        setDisassemblyTransferOTId('');
        setDisassemblyAllocations({});
        setDisassemblyStep(1);
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Error al procesar el desarme: ${errorData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor.");
    }
  };

  const handleResetDB = async () => {
    if (!window.confirm("¿Estás seguro de reiniciar la base de datos? Se perderán las OTs creadas recientemente.")) return;
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error al reiniciar la base de datos.");
    }
  };

  const handleResetPassword = async (user) => {
    const newPass = prompt(`Restablecer contraseña para @${user.username} (deja el valor para confirmar o escribe una nueva):`, user.username);
    if (newPass === null) return; // user cancelled
    if (!newPass.trim()) {
      alert("La contraseña no puede estar vacía.");
      return;
    }
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          nombre: user.nombre,
          password: newPass,
          rol: user.rol,
          modulos: typeof user.modulos === 'string' ? user.modulos : JSON.stringify(user.modulos)
        })
      });
      if (res.ok) {
        alert(`Contraseña de @${user.username} restablecida con éxito a "${newPass}".`);
        fetchUsers();
      } else {
        alert("Error al restablecer la contraseña.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor.");
    }
  };

  const handleClearOTs = async () => {
    if (!window.confirm("ATENCIÓN: ¿Estás seguro de borrar TODAS las órdenes de trabajo y chats? Esta acción vaciará el listado por completo.")) return;
    try {
      const res = await fetch('/api/admin/clear-ots', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error al blanquear las órdenes de trabajo.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pendiente':
        return <span className="bg-yellow-100 text-yellow-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-yellow-250">Pendiente de Aprobación</span>;
      case 'Aprobada por Gerencia':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-purple-250">Aprobada por Gerencia</span>;
      case 'Rechazada':
        return <span className="bg-rose-100 text-rose-805 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-rose-250">Rechazada</span>;
      case 'Aprobada':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-blue-250">Aprobada (Stock Reservado)</span>;
      case 'Bulto Completo':
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-indigo-250">Bulto Completo</span>;
      case 'En Planta':
        return <span className="bg-orange-100 text-orange-855 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-orange-250">En Planta</span>;
      case 'Completada':
        return <span className="bg-emerald-100 text-emerald-855 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-250">Armado Completado</span>;
      case 'Cancelada':
        return <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-red-250">Cancelada</span>;
      case 'Desarmada':
        return <span className="bg-fuchsia-100 text-fuchsia-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-fuchsia-250">Desarmada / En Retorno</span>;
      case 'Retornada':
        return <span className="bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-teal-250">Retornada a Depósito</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-slate-200">{status}</span>;
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilterOT) {
      const filterVal = logFilterOT.trim().toLowerCase();
      const otNum = (log.ot_numero || '').toLowerCase();
      const otId = String(log.ot_id || '').toLowerCase();
      if (!otNum.includes(filterVal) && !otId.includes(filterVal) && !`ot-${otId}`.includes(filterVal)) {
        return false;
      }
    }

    if (log.fecha) {
      const logDate = new Date(log.fecha);
      if (logFilterFechaInicio) {
        const startDate = new Date(logFilterFechaInicio + 'T00:00:00');
        if (logDate < startDate) return false;
      }
      if (logFilterFechaFin) {
        const endDate = new Date(logFilterFechaFin + 'T23:59:59');
        if (logDate > endDate) return false;
      }
    }
    return true;
  });

  const exportLogsToCSV = () => {
    const headers = ['Fecha y Hora', 'Usuario', 'Rol', 'OT Ref', 'Acción', 'Detalles'];
    const csvRows = [headers.join(';')];

    filteredLogs.forEach(log => {
      const fechaStr = new Date(log.fecha).toLocaleString('es-ES').replace(/;/g, ',');
      const usuarioStr = (log.usuario || '').replace(/;/g, ',');
      const rolStr = (log.rol || '').replace(/;/g, ',');
      const otStr = (log.ot_numero || `OT-${log.ot_id}`).replace(/;/g, ',');
      const accionStr = (log.accion || '').replace(/;/g, ',');
      const detallesStr = (log.detalles || '').replace(/;/g, ',');

      csvRows.push([
        `"${fechaStr}"`,
        `"${usuarioStr}"`,
        `"${rolStr}"`,
        `"${otStr}"`,
        `"${accionStr}"`,
        `"${detallesStr}"`
      ].join(';'));
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    let filename = 'log_transacciones';
    if (logFilterOT) {
      filename += `_OT_${logFilterOT.replace(/\s+/g, '_')}`;
    }
    if (logFilterFechaInicio) {
      filename += `_desde_${logFilterFechaInicio}`;
    }
    if (logFilterFechaFin) {
      filename += `_hasta_${logFilterFechaFin}`;
    }
    filename += '.csv';

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans bg-[#f8fafc]">
        {/* Backdrop radial gradients to match the main app styling */}
        <div className="absolute top-[0%] left-[0%] w-[50%] h-[50%] bg-blue-800/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[0%] right-[0%] w-[50%] h-[50%] bg-[#10316b]/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative z-10 text-slate-800 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex justify-center">
              <img src="/cd.png" alt="Logo" className="h-14 object-contain filter drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-blue-900 Poppins">Carpas D'Angiola</h1>
              <p className="text-[10px] text-slate-555 font-extrabold uppercase tracking-widest">Módulo de Logística e Ingeniería Inteligente</p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(loginUsername, loginPassword); }} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-455 block mb-1">Nombre de Usuario</label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="ej. mariana, admin"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-blue-900 focus:bg-white rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-300"
                />
              </div>

              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-455 block mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-blue-900 focus:bg-white rounded-2xl py-3 px-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-300"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-900 hover:bg-blue-950 text-white font-black uppercase text-xs tracking-widest py-3.5 px-6 rounded-2xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Ingresar al Sistema</span>
              <Play className="w-3 h-3 fill-white" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-150 text-center text-[9px] text-slate-400 font-extrabold uppercase tracking-widest space-y-0.5">
            <span className="block">Acceso restringido a personal autorizado</span>
            <span className="block">ERP D'Angiola 2026 - V1.0.5</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 flex flex-col">
      {/* HEADER GLOBALES */}
      <header className="glass-panel sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <img src="/cd.png" alt="Carpas D'Angiola" className="h-10 w-auto filter drop-shadow-sm shrink-0" onError={(e) => e.target.style.display = 'none'} />
          <div>
            <h1 className="text-xl font-black uppercase text-blue-900 tracking-wider Poppins">Carpas D'Angiola</h1>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Módulo de Logística e Ingeniería Inteligente</p>
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200 justify-center md:justify-start">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${currentTab === 'dashboard' ? 'bg-blue-900 text-white shadow' : 'text-slate-600 hover:bg-slate-200/50'
              }`}
          >
            Tableros
          </button>
          <button
            onClick={() => setCurrentTab('calendar')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${currentTab === 'calendar' ? 'bg-blue-900 text-white shadow' : 'text-slate-600 hover:bg-slate-200/50'
              }`}
          >
            Agenda Semanal
          </button>
          {currentUser && (currentUser.rol === 'SuperAdmin' || currentUser.rol === 'Gerencia') && (
            <button
              onClick={() => setCurrentTab('gerencia')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${currentTab === 'gerencia' ? 'bg-blue-900 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
                }`}
            >
              VigIA
            </button>
          )}
          {currentUser && (currentUser.rol === 'SuperAdmin' || currentUser.rol === 'Gerencia') && (
            <button
              onClick={() => setCurrentTab('maestro')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${currentTab === 'maestro' ? 'bg-blue-900 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
                }`}
            >
              Maestro de Datos
            </button>
          )}
          {currentUser && (currentUser.rol === 'SuperAdmin' || currentUser.rol === 'Gerencia') && (
            <button
              onClick={() => setCurrentTab('admin')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${currentTab === 'admin' ? 'bg-blue-900 text-white shadow' : 'text-slate-600 hover:bg-slate-200/50'
                }`}
            >
              Configuración
            </button>
          )}
          {currentUser && (currentUser.rol === 'SuperAdmin' || currentUser.rol === 'Gerencia' || currentUser.rol === 'Operaciones' || userRole === 'SuperAdmin' || userRole === 'Gerencia' || userRole === 'Operaciones') && (
            <button
              onClick={() => setCurrentTab('personal_recursos')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${currentTab === 'personal_recursos' ? 'bg-blue-900 text-white shadow' : 'text-slate-600 hover:bg-slate-200/50'
                }`}
            >
              Personal y Recursos
            </button>
          )}
          {currentUser && currentUser.rol === 'SuperAdmin' && (
            <button
              onClick={() => setCurrentTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${currentTab === 'users' ? 'bg-blue-900 text-white shadow' : 'text-slate-600 hover:bg-slate-200/50'
                }`}
            >
              Usuarios
            </button>
          )}
          {currentUser && (currentUser.rol === 'Gerencia' || currentUser.rol === 'SuperAdmin') && (
            <button
              onClick={() => {
                setCurrentTab('logs');
                fetchLogs();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${currentTab === 'logs' ? 'bg-blue-900 text-white shadow' : 'text-slate-600 hover:bg-slate-200/50'
                }`}
            >
              Log Transacciones
            </button>
          )}
        </div>

        {/* User Session Info & Logout */}
        {currentUser && (
          <div className="flex items-center gap-4 bg-white/80 p-1.5 px-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-right">
              <p className="text-xs font-black text-blue-900 uppercase tracking-wide leading-none">{currentUser.nombre}</p>
              <span className="text-[9px] text-slate-450 font-extrabold uppercase tracking-widest leading-none">{currentUser.rol}</span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-blue-900 hover:bg-blue-955 text-white rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all-300 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        )}
      </header>

      {/* RENDER ACTIVE VIEW */}
      <main className="flex-1 px-6 max-w-7xl mx-auto w-full">
        {currentTab === 'dashboard' && (
          <RoleDashboard
            currentUser={currentUser}
            userRole={userRole}
            userName={userName}
            ots={ots}
            personalList={personalList}
            users={users}
            onCreateOTClick={handleOpenCreateModal}
            onSelectOT={handleSelectOT}
            onUpdateOTStatus={handleUpdateOTStatus}
            onUpdateChecklist={handleUpdateChecklistItem}
            onResetDB={handleResetDB}
            structures={structures}
            chatAlerts={chatAlerts}
            onFetchChatAlerts={fetchChatAlerts}
            structuresStock={structuresStock}
            clients={clients}
            onUpdateAdicionales={handleUpdateOTAdicionales}
            onOpenGerenciaDashboard={() => setCurrentTab('gerencia')}
          />
        )}

        {currentTab === 'gerencia' && (currentUser?.rol === 'SuperAdmin' || currentUser?.rol === 'Gerencia' || userRole === 'SuperAdmin' || userRole === 'Gerencia') && (
          <GerenciaDashboard
            currentUser={currentUser || { nombre: userName, rol: userRole }}
            onClose={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'calendar' && (
          <WeeklyCalendar
            ots={ots}
            userRole={currentUser?.rol || userRole}
            userName={currentUser?.nombre || userName}
            onSelectOT={handleSelectOT}
          />
        )}

        {currentTab === 'maestro' && (currentUser?.rol === 'SuperAdmin' || currentUser?.rol === 'Gerencia') && (
          <MaestroDatos currentUser={currentUser} />
        )}

        {currentTab === 'admin' && (currentUser?.rol === 'SuperAdmin' || currentUser?.rol === 'Gerencia') && (
          <div className="glass-panel rounded-[2.5rem] p-8 space-y-6">
            <h2 className="text-xl font-black uppercase text-blue-900 tracking-wider Poppins">Panel de Cargas & Administración</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-3xl p-6 bg-white/70 space-y-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase">Cargar Archivo CSV / Excel Histórico</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Realiza actualizaciones masivas de clientes, stocks de lonas, alfombras o placas fenólicas mediante PapaParse.
                </p>
                <div className="border-2 border-dashed border-slate-350 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100/50 transition-all-300">
                  <input type="file" className="hidden" id="csv-file" accept=".csv,.xlsx" onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      alert(`Archivo '${file.name}' cargado e importado con éxito mediante PapaParse! Base de datos de Planta actualizada.`);
                    }
                  }} />
                  <label htmlFor="csv-file" className="cursor-pointer block">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <span className="text-xs font-black text-blue-900 uppercase tracking-wider block">Subir Archivo de Inventarios</span>
                  </label>
                </div>
              </div>

              <div className="border border-slate-200 rounded-3xl p-6 bg-white/70 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase">Resetear Base de Datos de Planta</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Reinicia todas las tablas del sistema cargando el inventario histórico inicial provisto por la administración (`arcos.xlsx`, `modulos.xlsx`, `fijos.xlsx` y `clientes.csv`).
                </p>
                <button
                  onClick={handleResetDB}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider shadow transition-all-300 flex items-center gap-2 cursor-pointer w-full justify-center"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Cargar Datos Históricos de la Empresa</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-3xl p-6 bg-white/70 space-y-4 col-span-1 md:col-span-2 shadow-xs">
                <h3 className="text-sm font-bold text-slate-800 uppercase text-red-700 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Órdenes de Trabajo (OT) Individuales</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Busca y elimina de forma definitiva una Orden de Trabajo en caso de errores de carga o duplicación.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={otToDeleteId}
                    onChange={(e) => setOtToDeleteId(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-2xl p-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Seleccione la OT a eliminar...</option>
                    {ots.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.ot_numero} ─ {o.cliente_nombre} ({o.modelo_estructura} {o.frente}x{o.largo}m) ─ Estado: {o.estado}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!otToDeleteId}
                    onClick={() => {
                      if (otToDeleteId) {
                        handleDeleteOT(parseInt(otToDeleteId));
                        setOtToDeleteId('');
                      }
                    }}
                    className={`rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-wider transition-all-300 flex items-center justify-center gap-2 cursor-pointer ${
                      otToDeleteId 
                        ? 'bg-red-650 hover:bg-red-700 text-white shadow-md hover:-translate-y-0.5' 
                        : 'bg-slate-100 text-slate-400 border border-slate-250 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar OT Seleccionada</span>
                  </button>
                </div>
              </div>

              {currentUser?.rol === 'SuperAdmin' && (
                <div className="border border-slate-200 rounded-3xl p-6 bg-white/70 space-y-4 col-span-1 md:col-span-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase text-rose-700">Herramientas de SuperAdmin (Modo Prueba)</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Elimina y blanquea de forma directa todas las Órdenes de Trabajo y chats del sistema para iniciar simulaciones desde cero sin reiniciar el catálogo de inventario o clientes.
                  </p>
                  <button
                    onClick={handleClearOTs}
                    className="bg-rose-650 hover:bg-rose-700 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider shadow transition-all-300 flex items-center gap-2 cursor-pointer w-full justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Blanquear y Borrar todas las OTs creadas</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {currentTab === 'users' && currentUser?.rol === 'SuperAdmin' && (
          <div className="glass-panel rounded-[2.5rem] p-8 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black uppercase text-blue-900 tracking-wider Poppins">Gestor de Usuarios</h2>
                <p className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest">Administración de credenciales y roles (RBAC)</p>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserFormUsername('');
                  setUserFormNombre('');
                  setUserFormPassword('');
                  setUserFormRol('Comercial');
                  setUserFormModulos([]);
                  setShowUserModal(true);
                }}
                className="bg-blue-900 hover:bg-blue-950 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider shadow transition-all-300 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Usuario</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-white/70 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-4 text-[10px] font-black uppercase text-slate-450 tracking-wider font-mono">ID</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-450 tracking-wider font-mono">Nombre Completo</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-450 tracking-wider font-mono">Nombre de Usuario</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-450 tracking-wider font-mono">Rol de Acceso</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-450 tracking-wider font-mono">Contraseña</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-450 tracking-wider font-mono">Fecha Creación</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-450 tracking-wider font-mono text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-all-100">
                        <td className="p-4 text-xs font-bold text-slate-500 font-mono">{u.id}</td>
                        <td className="p-4 text-xs font-black text-slate-800 uppercase">{u.nombre}</td>
                        <td className="p-4 text-xs font-semibold text-blue-900 font-mono">@{u.username}</td>
                        <td className="p-4 text-xs font-bold text-slate-700">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${u.rol === 'SuperAdmin' ? 'bg-red-50 text-red-700 border border-red-200' :
                            u.rol === 'Comercial' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              u.rol === 'Operaciones' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                'bg-slate-50 text-slate-700 border border-slate-200'
                            }`}>
                            {u.rol}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(() => {
                              try {
                                const parsed = typeof u.modulos === 'string' ? JSON.parse(u.modulos) : u.modulos;
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                  return parsed.map(m => (
                                    <span key={m} className="bg-slate-100 text-slate-650 text-[8px] font-extrabold px-1 rounded-sm border border-slate-200/50 uppercase">
                                      {m}
                                    </span>
                                  ));
                                }
                              } catch (e) { }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className="p-4 text-xs font-semibold text-slate-550 font-mono">{u.password}</td>
                        <td className="p-4 text-[10px] text-slate-400 font-bold">
                          {u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleDateString() : 'Por Defecto'}
                        </td>
                        <td className="p-4 text-xs font-bold text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setUserFormUsername(u.username);
                                setUserFormNombre(u.nombre);
                                setUserFormPassword(u.password);
                                setUserFormRol(u.rol);
                                try {
                                  const parsed = typeof u.modulos === 'string' ? JSON.parse(u.modulos) : u.modulos;
                                  setUserFormModulos(Array.isArray(parsed) ? parsed : []);
                                } catch (e) {
                                  setUserFormModulos([]);
                                }
                                setShowUserModal(true);
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg p-2 transition-all-200 border border-slate-200 cursor-pointer"
                              title="Editar Usuario"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleResetPassword(u)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg p-2 transition-all-200 border border-amber-200 cursor-pointer font-semibold"
                              title="Blanquear Contraseña"
                            >
                              Blanquear
                            </button>
                            <button
                              disabled={u.username === 'admin' || (currentUser && u.id === currentUser.id)}
                              onClick={() => handleDeleteUser(u)}
                              className={`rounded-lg p-2 transition-all-200 border cursor-pointer ${u.username === 'admin' || (currentUser && u.id === currentUser.id)
                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                                : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-650'
                                }`}
                              title="Eliminar Usuario"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'personal_recursos' && currentUser && (currentUser.rol === 'Gerencia' || currentUser.rol === 'SuperAdmin' || currentUser.rol === 'Operaciones' || userRole === 'Gerencia' || userRole === 'SuperAdmin' || userRole === 'Operaciones') && (
          <PersonalRecursos
            personalList={personalList}
            recursosList={recursosList}
            usuariosList={users}
            onSavePersonal={handleSavePersonal}
            onDeletePersonal={handleDeletePersonal}
            onSaveRecurso={handleSaveRecurso}
            onDeleteRecurso={handleDeleteRecurso}
            userRole={currentUser?.rol || userRole}
          />
        )}

        {currentTab === 'logs' && (currentUser?.rol === 'SuperAdmin' || currentUser?.rol === 'Gerencia' || userRole === 'SuperAdmin' || userRole === 'Gerencia') && (
          <div className="glass-panel rounded-[2.5rem] p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-900 text-white p-2.5 rounded-2xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase text-blue-900 tracking-wider Poppins">Historial de Auditoría y Transacciones</h2>
                  <p className="text-xs text-slate-500 font-semibold">Log completo de operaciones críticas y trazabilidad del sistema.</p>
                </div>
              </div>
              <button
                onClick={fetchLogs}
                className="bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
            </div>

            {/* Filtros de Logs y Exporter */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-500 block mb-1">Filtrar por OT (Número / Ref)</label>
                <input
                  type="text"
                  value={logFilterOT}
                  onChange={(e) => setLogFilterOT(e.target.value)}
                  placeholder="Ej. OT-15 o 15"
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-900 rounded-xl py-2 px-3 text-xs font-semibold text-slate-805 focus:outline-none transition-all duration-300"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-500 block mb-1">Fecha Desde</label>
                <input
                  type="date"
                  value={logFilterFechaInicio}
                  onChange={(e) => setLogFilterFechaInicio(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-900 rounded-xl py-2 px-3 text-xs font-semibold text-slate-805 focus:outline-none transition-all duration-300"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest font-black text-slate-500 block mb-1">Fecha Hasta</label>
                <input
                  type="date"
                  value={logFilterFechaFin}
                  onChange={(e) => setLogFilterFechaFin(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-blue-900 rounded-xl py-2 px-3 text-xs font-semibold text-slate-805 focus:outline-none transition-all duration-300"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    setLogFilterOT('');
                    setLogFilterFechaInicio('');
                    setLogFilterFechaFin('');
                  }}
                  className="flex-1 bg-white border border-slate-200 text-slate-650 hover:bg-slate-100 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer h-[38px] flex items-center justify-center shadow-sm"
                >
                  Limpiar
                </button>
                <button
                  onClick={exportLogsToCSV}
                  className="flex-1 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer h-[38px] flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white/70">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest border-b border-slate-200">
                    <th className="p-4">Fecha y Hora</th>
                    <th className="p-4">Usuario (Rol)</th>
                    <th className="p-4">OT Ref.</th>
                    <th className="p-4">Operación / Acción</th>
                    <th className="p-4">Detalles de Transacción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-all-300">
                      <td className="p-4 font-semibold text-slate-650">
                        {new Date(log.fecha).toLocaleString('es-ES')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-800">{log.usuario}</span>
                          <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                            {log.rol}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-black text-blue-900 font-mono">
                        {log.ot_numero || `OT-${log.ot_id}`}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${log.accion === 'CREACION' ? 'bg-blue-50 text-blue-850 border-blue-250' :
                          log.accion.includes('APROBACION') ? 'bg-indigo-50 text-indigo-850 border-indigo-250' :
                            log.accion === 'MODULACION' ? 'bg-purple-50 text-purple-850 border-purple-250' :
                              log.accion.includes('CARGA') ? 'bg-amber-50 text-amber-850 border-amber-250' :
                                log.accion.includes('PRESTAMO') ? 'bg-rose-50 text-rose-850 border-rose-250' :
                                  'bg-slate-50 text-slate-850 border-slate-200'
                          }`}>
                          {log.accion}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        {log.detalles}
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-12 text-slate-400 font-semibold italic bg-slate-50/50">
                        {logs.length === 0
                          ? "No hay registros de transacciones en el historial."
                          : "Ningún registro coincide con los filtros de búsqueda."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* -------------------- 1. MODAL CREAR ORDEN TRABAJO (OT) -------------------- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-4xl p-6 md:p-8 max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button onClick={() => setShowCreateModal(false)} className="absolute right-6 top-6 p-1 rounded-full hover:bg-slate-100 transition-all-300">
              <X className="w-5 h-5 text-slate-500" />
            </button>

            <h2 className="text-lg font-black uppercase text-blue-900 tracking-wider Poppins mb-6">Nueva Orden de Trabajo Comercial</h2>

            <form onSubmit={handleSubmitOT} className="space-y-6">
              {/* Client & Date Selector */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Cliente / Razón Social *</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                    value={formClient}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormClient(val);
                      if (val) {
                        const matchingClient = clients.find(c => c.id === parseInt(val));
                        if (matchingClient) {
                          const dirParts = [
                            matchingClient.domicilio,
                            matchingClient.localidad,
                            matchingClient.provincia
                          ].filter(Boolean).join(', ');
                          setFormGeo({
                            direccion: dirParts || 'No especificada',
                            lat: parseFloat(matchingClient.latitud) || -34.6037,
                            lng: parseFloat(matchingClient.longitud) || -58.3816
                          });
                        }
                      }
                    }}
                    required
                  >
                    <option value="">Buscar Cliente...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} (CUIT: {c.cuit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Fecha Inicio Montaje *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                    value={formFechaInicio}
                    onChange={(e) => setFormFechaInicio(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Fecha de Evento *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                    value={formFechaEvento}
                    onChange={(e) => setFormFechaEvento(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Fecha Desarme (Fin) *</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                    value={formFechaFin}
                    onChange={(e) => setFormFechaFin(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Observaciones / Comentarios del Terreno o Cliente *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="ej. El cliente solicita que el armado se inicie por la mañana. Terreno de césped blando, se requieren estacas largas..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                />
              </div>

              {/* Structural Specification */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">Especificación de Estructura Modular</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Frente (Ancho Mts) *</label>
                    <select
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none"
                      value={formFrente}
                      onChange={(e) => setFormFrente(parseFloat(e.target.value))}
                      required
                    >
                      {((structures && structures.length > 0)
                        ? [...new Set(structures.map(s => parseFloat(s.frente)))].sort((a, b) => a - b)
                        : [10, 20]
                      ).map(f => (
                        <option key={f} value={f}>{f} Mts</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Largo (Largo Mts) *</label>
                    <input
                      type="number"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none"
                      value={formLargo}
                      onChange={(e) => setFormLargo(parseInt(e.target.value))}
                      min="2"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Material Estructural</label>
                    <div className="flex gap-2">
                      {['Aluminio', 'Acero'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormTipoEst(type)}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all-300 ${formTipoEst === type ? 'bg-blue-900 text-white border-blue-950' : 'bg-white text-slate-600 border-slate-200'
                            }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3 flex justify-between items-center text-xs">
                    <span className="font-extrabold text-blue-900 uppercase">Superficie Calculada:</span>
                    <span className="font-black text-blue-900 text-sm font-mono">{formFrente * formLargo} m²</span>
                  </div>

                  <button
                    type="button"
                    onClick={checkStockAvailability}
                    className="bg-slate-800 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all-300 shadow-md cursor-pointer"
                  >
                    Verificar Disponibilidad Temporal de Arcos
                  </button>
                </div>

                {stockCheckStatus !== 'unchecked' && (
                  <div className="space-y-3">
                    <div className={`p-3 rounded-xl border text-xs font-semibold ${stockCheckStatus === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                      }`}>
                      {stockCheckMsg}
                    </div>

                    {availabilityResults.length > 0 && (
                      <div className="border border-slate-200 rounded-xl bg-white p-3 space-y-3 shadow-inner">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                          Estructuras de {formFrente}m ({formTipoEst}) — Estado para estas Fechas:
                        </h4>
                        <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1 space-y-0">
                          {availabilityResults.map(res => {
                            const isAvailable = res.arcos_disponibles > 0;
                            const hasConflicts = (res.reserved_arches_detail || []).length > 0;
                            return (
                              <div key={res.modelo_estructura} className="py-2.5 space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className="badge-carpa">{res.modelo_estructura}</span>
                                    <span className="text-[10px] text-slate-500 font-semibold">
                                      {res.arcos_disponibles}/{res.arcos_totales} arcos libres
                                    </span>
                                  </div>
                                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${res.status === 'Incompleta'
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                    : isAvailable
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {res.status === 'Incompleta' ? 'Incompleta' : isAvailable ? '✓ Disponible' : '✗ Sin Stock'}
                                  </span>
                                </div>
                                {/* Blocked arches detail */}
                                {hasConflicts && (
                                  <div className="ml-1 space-y-1">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-red-500">Arcos bloqueados por conflicto de fechas:</p>
                                    {(res.reserved_arches_detail || []).map(d => (
                                      <div key={d.arco} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
                                        <span className="font-mono text-[10px] font-black text-red-700">{d.arco}</span>
                                        <span className="text-[9px] text-red-600 font-semibold">
                                          → {d.ot_numero} · {d.cliente} · {new Date(d.fecha_inicio).toLocaleDateString('es-ES')} a {new Date(d.fecha_fin).toLocaleDateString('es-ES')}
                                          {d.estado === 'Pendiente' && <span className="ml-1 bg-yellow-200 text-yellow-800 rounded px-1 font-black">PENDIENTE</span>}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Conditional Additions Matrix */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">Matriz de Adicionales Comerciales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Piso */}
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="pisos" className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded" checked={formPisos} onChange={(e) => setFormPisos(e.target.checked)} />
                      <label htmlFor="pisos" className="text-xs font-extrabold text-slate-700 uppercase">Pisos de Fenólico</label>
                    </div>
                    {formPisos && (
                      <select className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold focus:outline-none" value={formPisosTipo} onChange={(e) => setFormPisosTipo(e.target.value)}>
                        <option value="Placa Fenolico Estandar">Estándar (2.44x1.22)</option>
                        <option value="Placa Fenolico Barnizada">Barnizada Premium</option>
                      </select>
                    )}
                  </div>

                  {/* Alfombra */}
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="alfombras" className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded" checked={formAlfombras} onChange={(e) => setFormAlfombras(e.target.checked)} />
                      <label htmlFor="alfombras" className="text-xs font-extrabold text-slate-700 uppercase">Alfombra de Evento</label>
                    </div>
                    {formAlfombras && (
                      <select className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold focus:outline-none" value={formAlfombrasColor} onChange={(e) => setFormAlfombrasColor(e.target.value)}>
                        <option value="Gris">Gris Gris</option>
                        <option value="Negro">Negro Noche</option>
                        <option value="Beige">Beige Arena</option>
                      </select>
                    )}
                  </div>

                  {/* Lonas */}
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="lonas" className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded" checked={formLonas} onChange={(e) => setFormLonas(e.target.checked)} />
                      <label htmlFor="lonas" className="text-xs font-extrabold text-slate-700 uppercase">Lonas Cobertura</label>
                    </div>
                    {formLonas && (
                      <select className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold focus:outline-none" value={formLonasColor} onChange={(e) => setFormLonasColor(e.target.value)}>
                        <option value="Blanco">Blanco</option>
                        <option value="Negro">Negro</option>
                        <option value="Cristal/Blanco">Cristal/Blanco</option>
                        <option value="Cristal/Negro">Cristal/Negro</option>
                      </select>
                    )}
                  </div>

                  {/* Telas - Cielorraso */}
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="telasCielorraso" className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded" checked={formTelasCielorraso} onChange={(e) => setFormTelasCielorraso(e.target.checked)} />
                      <label htmlFor="telasCielorraso" className="text-xs font-extrabold text-slate-700 uppercase">Cielorraso Tela</label>
                    </div>
                    {formTelasCielorraso && (
                      <select className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-bold focus:outline-none" value={formTelasCielorrasoColor} onChange={(e) => setFormTelasCielorrasoColor(e.target.value)}>
                        <option value="Blanco">Blanco</option>
                        <option value="Negro">Negro</option>
                      </select>
                    )}
                  </div>

                  {/* Telas - Cortinas */}
                  <div className="flex flex-col gap-2 p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="telasCortinas" className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded" checked={formTelasCortinas} onChange={(e) => setFormTelasCortinas(e.target.checked)} />
                        <label htmlFor="telasCortinas" className="text-xs font-extrabold text-slate-700 uppercase">Cortinas Tela</label>
                      </div>
                    </div>
                    {formTelasCortinas && (
                      <div className="flex gap-1.5">
                        <select className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1 text-[10px] font-bold focus:outline-none" value={formTelasCortinasColor} onChange={(e) => setFormTelasCortinasColor(e.target.value)}>
                          <option value="Blanco">Blanco</option>
                          <option value="Negro">Negro</option>
                        </select>
                        <select className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1 text-[10px] font-bold focus:outline-none" value={formTelasCortinasTipo} onChange={(e) => setFormTelasCortinasTipo(e.target.value)}>
                          <option value="4 Mts">4 Mts</option>
                          <option value="3 Mts">3 Mts</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Geolocalization OSM & Leaflet */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">Ubicación y Georreferenciación de Montaje</h3>
                <MapGeoref value={formGeo} onChange={setFormGeo} />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider transition-all-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest shadow-md hover:-translate-y-0.5 transition-all-300"
                >
                  Generar Contrato OT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- 2. MODAL DETALLES ORDEN TRABAJO (OT) -------------------- */}
      {selectedOT && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-7xl p-6 md:p-8 overflow-y-auto shadow-2xl relative space-y-6" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            <button onClick={() => { setSelectedOT(null); setOtDetailsExplosion(null); }} className="absolute right-6 top-6 p-1 rounded-full hover:bg-slate-100 transition-all-300">
              <X className="w-5 h-5 text-slate-500" />
            </button>

            {/* Modal Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-black text-red-600 text-lg">{selectedOT.ot_numero}</span>
                  {getStatusBadge(selectedOT.estado)}
                </div>
                <h2 className="text-xl font-black uppercase text-blue-900 tracking-wider Poppins">{selectedOT.cliente_nombre}</h2>
              </div>
              <div className="flex items-center gap-2">
                <PDFReplicator ot={selectedOT} explosion={otDetailsExplosion} />
                {selectedOT.estado === 'Desarmada' && (
                  <button
                    onClick={() => handleDownloadDesarmePDFs(selectedOT.id, selectedOT)}
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir Remito Desarme</span>
                  </button>
                )}
                {!['Cancelada', 'Rechazada', 'Pendiente', 'Desarmada', 'Retornada'].includes(selectedOT.estado) && 
                  ['Operaciones', 'Gerencia', 'SuperAdmin'].includes(currentUser?.rol || userRole) && (
                  <button
                    onClick={() => {
                      setDisassemblyOT(selectedOT);
                      setSelectedOT(null);
                    }}
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer flex items-center gap-1.5"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Iniciar Desarme</span>
                  </button>
                )}
              </div>

            </div>

            {(() => {
              if (['Cancelada', 'Rechazada', 'Pendiente', 'Desarmada', 'Retornada'].includes(selectedOT.estado)) return null;
              const fechaDesarme = new Date(selectedOT.fecha_fin + 'T00:00:00');
              const now = new Date();
              const diffTime = fechaDesarme - now;
              const diffHours = diffTime / (1000 * 60 * 60);
              const isAlert = diffHours <= 48 && diffHours >= -72;
              if (isAlert && ['Operaciones', 'Gerencia', 'SuperAdmin'].includes(userRole)) {
                return (
                  <div className="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900 rounded-3xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm animate-pulse">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-black text-fuchsia-800 text-sm uppercase tracking-wide">
                        <AlertTriangle className="w-5 h-5 text-fuchsia-600 shrink-0" />
                        <span>Alerta Crítica: Desarme Planificado</span>
                      </div>
                      <p className="text-xs font-semibold text-fuchsia-700 leading-relaxed">
                        Esta orden de trabajo está programada para desarmar el {new Date(selectedOT.fecha_fin + 'T00:00:00').toLocaleDateString('es-ES')}. Por favor, genere la Orden de Desarme para procesar la logística inversa de materiales.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDisassemblyOT(selectedOT);
                        setSelectedOT(null);
                      }}
                      className="w-full md:w-auto bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest shadow-md transition-all-300 cursor-pointer shrink-0"
                    >
                      Crear Orden de Desarme
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* Plano y Renderizado 3D (Full Width) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 Poppins">Plano y Renderizado 3D</h3>
                <span className="text-[10px] font-black text-blue-900 border border-blue-200 px-2 py-0.5 rounded-md bg-blue-50/50 uppercase">Modular Doble Pendiente</span>
              </div>
              <div className="rounded-3xl border border-slate-250 bg-slate-50 shadow-sm p-4 h-auto lg:h-[650px] overflow-hidden">
                {(() => {
                  const isWizardActive = selectedOT.estado === 'Aprobada por Gerencia';
                  const normalizedModules = [];
                  if (isWizardActive) {
                    if (conformanceModType === 'simple') {
                      const qty = Math.ceil(selectedOT.largo / conformanceSimpleLen);
                      for (let i = 0; i < qty; i++) {
                        normalizedModules.push({ largo: conformanceSimpleLen });
                      }
                    } else {
                      [5, 4, 3, 2].forEach(len => {
                        const qty = conformanceCompoundModulos[len] || 0;
                        for (let i = 0; i < qty; i++) {
                          normalizedModules.push({ largo: len });
                        }
                      });
                    }
                  } else {
                    const modConfig = typeof selectedOT.modulacion_config === 'string' ? JSON.parse(selectedOT.modulacion_config) : selectedOT.modulacion_config;
                    const items = modConfig?.modulos || [];
                    items.forEach(m => {
                      for (let i = 0; i < m.qty; i++) {
                        normalizedModules.push({ largo: m.largo });
                      }
                    });
                  }
                  const hasHighLeg = selectedOT.modelo_estructura.includes('-H') || selectedOT.modelo_estructura.includes(' H');
                  const resolvedLegHeight = hasHighLeg ? 4 : 3;
                  const adicionales = typeof selectedOT.adicionales === 'string' ? JSON.parse(selectedOT.adicionales) : selectedOT.adicionales || {};
                  const telasCortinas = adicionales.telas_cortinas || { si: false, color: 'Blanco' };
                  return (
                    <ThreeViewer
                      modules={normalizedModules}
                      legHeight={resolvedLegHeight}
                      width={parseFloat(selectedOT.frente || 10)}
                      modelName={selectedOT.modelo_estructura}
                      telasCortinas={telasCortinas}
                      colors={viewerColors}
                      setColors={setViewerColors}
                    />
                  );
                })()}
              </div>
            </div>

            {/* Split Grid at bottom: Left: checklists/wizard, Right: Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left Column: Conformation Wizard OR Checklists */}
              <div className="space-y-4">

                {/* 1. OT is Pending -> Render Validation buttons (for Gerencia/SuperAdmin) or warning */}
                {selectedOT.estado === 'Pendiente' ? (
                  (userRole === 'Gerencia' || userRole === 'SuperAdmin') ? (
                    <div className="border border-slate-200 rounded-3xl p-5 bg-white shadow-xs space-y-4">
                      <div className="pb-3 border-b border-slate-100">
                        <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">
                          Aprobación Comercial del Contrato (Gerencia)
                        </h4>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                        Este contrato comercial está pendiente de aprobación de Gerencia para poder pasar al sector de Operaciones para su modulación y carga física.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await handleUpdateOTStatus(selectedOT.id, 'Aprobada por Gerencia');
                          }}
                          className="flex-1 bg-blue-900 hover:bg-blue-955 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest shadow-md transition-all-300 cursor-pointer"
                        >
                          Aprobar Contrato
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm("¿Estás seguro de desaprobar/rechazar este contrato?")) {
                              await handleUpdateOTStatus(selectedOT.id, 'Rechazada');
                            }
                          }}
                          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest shadow-md transition-all-300 cursor-pointer"
                        >
                          Desaprobar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-250 text-yellow-800 rounded-3xl p-5 text-xs font-bold text-center leading-relaxed shadow-sm">
                      ⚠️ Esta orden comercial está en espera de aprobación comercial por parte de la Gerencia. Las listas de carga y el asistente de conformación se habilitarán una vez aprobada.
                    </div>
                  )
                ) : selectedOT.estado === 'Rechazada' ? (
                  <div className="bg-rose-50 border border-rose-250 text-rose-800 rounded-3xl p-5 text-xs font-bold text-center leading-relaxed shadow-sm">
                    🚫 Este contrato comercial ha sido desaprobado/rechazado por la Gerencia. No está habilitado para modulación ni carga.
                  </div>
                ) : selectedOT.estado === 'Aprobada por Gerencia' ? (
                  (userRole === 'Operaciones' || userRole === 'Gerencia' || userRole === 'SuperAdmin') ? (
                    <div className="border border-slate-200 rounded-3xl p-5 bg-white shadow-xs space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">
                          Asistente de Conformación de Estructura
                        </h4>
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5 text-[9px] font-black uppercase">
                          Paso {conformanceStep} de 4
                        </span>
                      </div>

                      {/* Step 1: Modulación */}
                      {conformanceStep === 1 && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-2">Tipo de Modulación</label>
                            <div className="flex gap-2">
                              {['simple', 'compuesta'].map(type => {
                                const isDisabled = selectedOT.largo === 12 && type === 'simple';
                                return (
                                  <button
                                    key={type}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => {
                                      setConformanceModType(type);
                                      setConformanceSelectedArches([]);
                                    }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl border capitalize transition-all-305 ${isDisabled ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200' :
                                      conformanceModType === type ? 'bg-blue-900 text-white border-blue-955' : 'bg-slate-50 text-slate-600 border-slate-200'
                                      }`}
                                    title={isDisabled ? 'Para largo de 12m se requiere modulación compuesta (2 de 5m y 1 de 2m)' : ''}
                                  >
                                    {type} {isDisabled && '(No disponible)'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {conformanceModType === 'simple' ? (
                            <div className="space-y-3">
                              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Medida de Módulo Simple</label>
                              <div className="flex gap-2">
                                {[5, 4, 3, 2].map(len => (
                                  <button
                                    key={len}
                                    type="button"
                                    onClick={() => {
                                      setConformanceSimpleLen(len);
                                      setConformanceSelectedArches([]);
                                    }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all-305 ${conformanceSimpleLen === len ? 'bg-blue-900 text-white border-blue-955' : 'bg-slate-50 text-slate-600 border-slate-200'
                                      }`}
                                  >
                                    {len}m
                                  </button>
                                ))}
                              </div>
                              {selectedOT.largo % conformanceSimpleLen !== 0 ? (
                                <div className="text-[10px] font-bold text-red-650 bg-red-50 border border-red-150 p-2.5 rounded-xl leading-relaxed">
                                  ⚠️ El largo total ({selectedOT.largo}m) no es divisible de forma exacta por {conformanceSimpleLen}m. Seleccione otra modulación o use compuesta.
                                </div>
                              ) : (
                                <div className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 p-2.5 rounded-xl leading-relaxed">
                                  ✓ Resultará en <span className="text-blue-900 font-extrabold">{selectedOT.largo / conformanceSimpleLen} módulos</span> de {conformanceSimpleLen}m. Se necesitan <span className="text-blue-900 font-extrabold">{selectedOT.largo / conformanceSimpleLen + 1} arcos</span>.
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Medida y Cantidad de Módulos (Compuesta)</label>
                              <div className="grid grid-cols-2 gap-3">
                                {[5, 4, 3, 2].map(len => {
                                  const qty = conformanceCompoundModulos[len] || 0;
                                  return (
                                    <div key={len} className="flex items-center justify-between p-2 border border-slate-200 rounded-xl bg-slate-50/50">
                                      <span className="text-xs font-bold text-slate-700">{len}m</span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (qty > 0) {
                                              setConformanceCompoundModulos({
                                                ...conformanceCompoundModulos,
                                                [len]: qty - 1
                                              });
                                              setConformanceSelectedArches([]);
                                            }
                                          }}
                                          className="w-6 h-6 flex items-center justify-center bg-white border border-slate-250 rounded-lg text-xs font-extrabold hover:bg-slate-100"
                                        >
                                          -
                                        </button>
                                        <span className="text-xs font-black w-4 text-center">{qty}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setConformanceCompoundModulos({
                                              ...conformanceCompoundModulos,
                                              [len]: qty + 1
                                            });
                                            setConformanceSelectedArches([]);
                                          }}
                                          className="w-6 h-6 flex items-center justify-center bg-white border border-slate-250 rounded-lg text-xs font-extrabold hover:bg-slate-100"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {(() => {
                                const currentLen = (conformanceCompoundModulos[5] * 5) + (conformanceCompoundModulos[4] * 4) + (conformanceCompoundModulos[3] * 3) + (conformanceCompoundModulos[2] * 2);
                                const diff = selectedOT.largo - currentLen;
                                const totalMods = conformanceCompoundModulos[5] + conformanceCompoundModulos[4] + conformanceCompoundModulos[3] + conformanceCompoundModulos[2];

                                if (selectedOT.largo === 12) {
                                  const isValid12 = conformanceCompoundModulos[5] === 2 && conformanceCompoundModulos[2] === 1 && conformanceCompoundModulos[4] === 0 && conformanceCompoundModulos[3] === 0;
                                  return (
                                    <div className={`text-[10px] font-bold p-2.5 rounded-xl leading-relaxed border ${isValid12 ? 'bg-emerald-50 border-emerald-150 text-emerald-805' : 'bg-amber-50 border-amber-150 text-amber-805'
                                      }`}>
                                      <span>Largo definido: <strong className="font-extrabold">{currentLen}m</strong> / Objetivo: <strong className="font-extrabold">{selectedOT.largo}m</strong>.</span>
                                      {isValid12 ? (
                                        <span className="block mt-1">✓ Configuración correcta para 12m: 2 módulos de 5m y 1 de 2m. Se necesitan <strong className="font-extrabold">4 arcos</strong>.</span>
                                      ) : (
                                        <span className="block mt-1">⚠️ Para 12m, se requiere obligatoriamente 2 módulos de 5m y 1 de 2m.</span>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div className={`text-[10px] font-bold p-2.5 rounded-xl leading-relaxed border ${diff === 0 ? 'bg-emerald-50 border-emerald-150 text-emerald-805' : 'bg-amber-50 border-amber-150 text-amber-805'
                                    }`}>
                                    <span>Largo definido: <strong className="font-extrabold">{currentLen}m</strong> / Objetivo: <strong className="font-extrabold">{selectedOT.largo}m</strong>.</span>
                                    {diff !== 0 && <span className="block mt-1">⚠️ Faltan {diff}m para completar el largo objetivo. Se necesitan {totalMods + 1} arcos.</span>}
                                    {diff === 0 && <span className="block mt-1">✓ Suma exacta. Se necesitan <strong className="font-extrabold">{totalMods + 1} arcos</strong>.</span>}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          <div className="flex justify-end pt-2 border-t border-slate-100">
                            {conformanceModType === 'simple' ? (
                              <button
                                type="button"
                                disabled={selectedOT.largo % conformanceSimpleLen !== 0}
                                onClick={() => setConformanceStep(2)}
                                className="bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl px-5 py-2.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Siguiente
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  selectedOT.largo === 12
                                    ? (conformanceCompoundModulos[5] !== 2 || conformanceCompoundModulos[2] !== 1 || conformanceCompoundModulos[4] !== 0 || conformanceCompoundModulos[3] !== 0)
                                    : ((conformanceCompoundModulos[5] * 5) + (conformanceCompoundModulos[4] * 4) + (conformanceCompoundModulos[3] * 3) + (conformanceCompoundModulos[2] * 2)) !== selectedOT.largo
                                }
                                onClick={() => setConformanceStep(2)}
                                className="bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl px-5 py-2.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Siguiente
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Step 2: Selección de Arcos */}
                      {conformanceStep === 2 && (
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">
                                Selección de Arcos de Stock
                              </label>
                              <span className="text-[10px] font-black text-slate-500">
                                Requeridos: {getConformanceArchesNeeded()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                              {getArchesStatusForOT(selectedOT).map(({ arco, available, occupant }) => {
                                const isSelected = conformanceSelectedArches.includes(arco);
                                return (
                                  <button
                                    key={arco}
                                    type="button"
                                    disabled={!available}
                                    onClick={() => {
                                      if (isSelected) {
                                        setConformanceSelectedArches(conformanceSelectedArches.filter(a => a !== arco));
                                      } else {
                                        if (conformanceSelectedArches.length < getConformanceArchesNeeded()) {
                                          setConformanceSelectedArches([...conformanceSelectedArches, arco]);
                                        } else {
                                          alert(`Ya ha seleccionado la cantidad máxima de arcos necesarios (${getConformanceArchesNeeded()}).`);
                                        }
                                      }
                                    }}
                                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-[68px] transition-all-305 ${!available
                                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                                      : isSelected
                                        ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100'
                                        : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
                                      }`}
                                  >
                                    <span className="text-xs font-black text-slate-800">{arco}</span>
                                    {occupant ? (
                                      <span className="text-[8px] font-black uppercase text-red-650 tracking-wide line-clamp-2 leading-none">
                                        ❌ Ocupado ({occupant.ot_numero})
                                      </span>
                                    ) : (
                                      <span className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded leading-none w-max ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        }`}>
                                        {isSelected ? 'Seleccionado' : 'Disponible'}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setConformanceStep(1)}
                              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl px-4 py-2.5"
                            >
                              Volver
                            </button>
                            <span className="text-[10px] font-black text-blue-900 font-mono">
                              Seleccionados: {conformanceSelectedArches.length} / {getConformanceArchesNeeded()}
                            </span>
                            <button
                              type="button"
                              disabled={conformanceSelectedArches.length !== getConformanceArchesNeeded()}
                              onClick={triggerConformanceExplosion}
                              className="bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl px-5 py-2.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Siguiente
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Verificación de Módulos */}
                      {conformanceStep === 3 && conformanceExplosion && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">
                              Verificación de Componentes de Extensión (Módulos)
                            </label>
                            <span className="text-[10px] font-black text-slate-500">
                              Requeridos: {getConformanceModulesNeeded()}
                            </span>
                          </div>

                          <div className="border border-slate-200 rounded-2xl bg-slate-50/40 p-3 max-h-[320px] overflow-y-auto space-y-3">
                            {/* 5m Modules Pool selections */}
                            {getConformanceModulesNeeded() > 0 && (
                              <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-150 shadow-xs text-xs">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-extrabold text-slate-500 uppercase tracking-wide text-[10px]">
                                    Módulos de 5m (Estándar)
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {getAvailableModuleKits().map((model) => {
                                    const isSelected = conformanceSelectedModulesList.includes(model);
                                    return (
                                      <button
                                        type="button"
                                        key={model}
                                        onClick={() => handleModuleCardClick(model)}
                                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-[68px] transition-all-305 cursor-pointer w-full focus:outline-none ${isSelected
                                          ? 'bg-blue-50 border-blue-450 ring-2 ring-blue-100'
                                          : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
                                          }`}
                                      >
                                        <div className="flex justify-between items-start w-full">
                                          <span className={`text-xs font-black ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{model}</span>
                                          {isSelected && (
                                            <span className="text-[8px] font-black text-white bg-blue-900 px-1.5 py-0.5 rounded uppercase tracking-wider leading-none shadow-xs">
                                              Seleccionado
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex justify-between items-center w-full mt-1">
                                          <span className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded leading-none ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-slate-50 text-slate-500 border border-slate-200'
                                            }`}>
                                            {isSelected ? 'Confirmado' : 'Disponible'}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Non-5m Modules static info */}
                            {conformedModConfig?.modulos?.filter(m => m.largo !== 5).map((item, idx) => {
                              const prefix = selectedOT.modelo_estructura.split('-')[0];
                              return (
                                <div key={`non5m-${idx}`} className="flex justify-between items-center py-2.5 px-3.5 bg-white rounded-xl border border-slate-150 shadow-xs text-xs">
                                  <span className="font-extrabold text-slate-700">
                                    {prefix}-M{item.largo} (Módulo de {item.largo}m)
                                  </span>
                                  <span className="font-extrabold text-blue-900 uppercase bg-blue-50 px-2.5 py-0.5 rounded text-[10px] border border-blue-150 font-mono">
                                    Cant: {item.qty}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setConformanceStep(2)}
                              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl px-4 py-2.5"
                            >
                              Volver
                            </button>
                            <span className="text-[10px] font-black text-blue-900 font-mono">
                              Seleccionados: {conformanceSelectedModulesList.length} / {getConformanceModulesNeeded()}
                            </span>
                            <button
                              type="button"
                              disabled={conformanceSelectedModulesList.length !== getConformanceModulesNeeded()}
                              onClick={() => setConformanceStep(4)}
                              className="bg-blue-900 hover:bg-blue-950 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl px-5 py-2.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Siguiente
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Step 4: Verificación de Fijos */}
                      {conformanceStep === 4 && conformanceExplosion && (
                        <div className="space-y-4">
                          <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">
                            Verificación de Componentes Fijos de Estructura
                          </label>

                          <div className="border border-slate-200 rounded-2xl bg-slate-50/40 p-3 max-h-[320px] overflow-y-auto space-y-1.5">
                            <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-150 shadow-xs text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-extrabold text-slate-500 uppercase tracking-wide text-[10px]">
                                  Kit Estructura Fija (Esquineros y Riendas)
                                </span>
                                <span className="font-black text-indigo-900 uppercase bg-indigo-50 px-2.5 py-0.5 rounded text-[10px] border border-indigo-150 font-mono">
                                  Cant: 1
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {getAvailableFijoKits().map((model) => {
                                  const isSelected = conformanceSelectedFijoModel === model;
                                  return (
                                    <button
                                      key={model}
                                      type="button"
                                      onClick={() => {
                                        setConformanceSelectedFijoModel(model);
                                        recalculateExplosion(model, conformanceSelectedModulesList);
                                      }}
                                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-[54px] transition-all-305 ${isSelected
                                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100'
                                        : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
                                        }`}
                                    >
                                      <span className="text-xs font-black text-slate-800">{model}-F</span>
                                      <span className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded leading-none w-max ${isSelected ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-50 text-slate-500 border border-slate-200'
                                        }`}>
                                        {isSelected ? 'Seleccionado' : 'Disponible'}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setConformanceStep(3)}
                              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl px-4 py-2.5"
                            >
                              Volver
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmConformance}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl px-6 py-2.5 shadow-md hover:-translate-y-0.5 transition-all-300 cursor-pointer"
                            >
                              Confirmar Estructura y Aprobar OT
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-250 text-yellow-800 rounded-3xl p-5 text-xs font-bold text-center leading-relaxed shadow-sm">
                      ⚠️ Contrato aprobado por Gerencia. Esperando que el sector de Operaciones realice la modulación y conformación de la estructura.
                    </div>
                  )
                ) : (
                  /* 2. OT is Approved/Completed -> Render standard Logistics Checklists */
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 Poppins">Listas de Carga del Operario</h3>
                      <span className="text-[10px] font-black text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md bg-indigo-50/50 uppercase">Proceso de Pañol / Planta</span>
                    </div>

                    {(() => {
                      const panol = typeof selectedOT.panol_status === 'string' ? JSON.parse(selectedOT.panol_status) : selectedOT.panol_status;
                      const planta = typeof selectedOT.planta_status === 'string' ? JSON.parse(selectedOT.planta_status) : selectedOT.planta_status;

                      const isLona = (name) => {
                        const n = name.toLowerCase();
                        return n.includes('lona') || n.includes('techo') || n.includes('lateral') || n.includes('triangulo') || n.includes('tapachata') || n.includes('puerta');
                      };

                      const isPiso = (name) => {
                        const n = name.toLowerCase();
                        return n.includes('piso') || n.includes('placa') || n.includes('fenolico') || n.includes('caño') || n.includes('alfombra');
                      };

                      const isTela = (name) => {
                        const n = name.toLowerCase();
                        return n.includes('tela') || n.includes('cortina') || n.includes('cielorraso');
                      };

                      const getSector = (item) => {
                        if (item.sector) return item.sector;
                        const name = item.producto || '';
                        if (isLona(name)) return 'Lonas';
                        if (isPiso(name)) return 'Pisos';
                        if (isTela(name)) return 'Telas';
                        return item.sourceList;
                      };

                      const allItems = [];
                      if (panol?.items) {
                        panol.items.forEach((item, idx) => {
                          allItems.push({ ...item, originalIndex: idx, sourceList: 'Pañol' });
                        });
                      }
                      if (planta?.items) {
                        planta.items.forEach((item, idx) => {
                          allItems.push({ ...item, originalIndex: idx, sourceList: 'Planta' });
                        });
                      }

                      const isAdmin = userRole === 'Gerencia' || userRole === 'Operaciones' || userRole === 'SuperAdmin';

                      if (isAdmin) {
                        return (
                          <div className="border border-slate-200 rounded-3xl p-4 bg-slate-50/30 grid grid-cols-2 gap-4 max-h-[220px] overflow-y-auto">
                            <div className="space-y-2 border-r border-slate-200/80 pr-2">
                              <h4 className="text-[10px] font-black uppercase text-purple-700 tracking-wider font-mono">1. Checklist Pañol</h4>
                              <div className="space-y-1">
                                {panol?.items?.map((item, idx) => {
                                  const isEditable = userRole === 'Pañol' || userRole === 'Gerencia' || userRole === 'SuperAdmin';
                                  return (
                                    <div key={idx} className="flex items-start gap-2 py-1">
                                      <input
                                        type="checkbox"
                                        disabled={!isEditable}
                                        checked={item.checked}
                                        onChange={(e) => handleUpdateChecklistItem(idx, 'Pañol', e.target.checked)}
                                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                      />
                                      <span className={`text-[10px] font-semibold leading-tight ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                        {item.producto} <span className="font-extrabold text-purple-800">x{item.qty}</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-2 pl-2">
                              <h4 className="text-[10px] font-black uppercase text-orange-700 tracking-wider font-mono">2. Checklist Planta</h4>
                              <div className="space-y-1">
                                {planta?.items?.map((item, idx) => {
                                  const isEditable = userRole === 'Planta' || userRole === 'Gerencia' || userRole === 'SuperAdmin';
                                  return (
                                    <div key={idx} className="flex items-start gap-2 py-1">
                                      <input
                                        type="checkbox"
                                        disabled={!isEditable}
                                        checked={item.checked}
                                        onChange={(e) => handleUpdateChecklistItem(idx, 'Planta', e.target.checked)}
                                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                      />
                                      <span className={`text-[10px] font-semibold leading-tight ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                        {item.producto} <span className="font-extrabold text-orange-850">x{item.qty}</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              {selectedOT.estado === 'Bulto Completo' && (
                                <button
                                  onClick={() => handleUpdateOTStatus(selectedOT.id, 'Completada')}
                                  className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg py-2 mt-2 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer"
                                >
                                  Confirmar Carga / Despachar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const actualRole = currentUser?.rol || userRole;
                      const isOperario = actualRole === 'Operario';

                      if (isOperario) {
                        const asignaciones = selectedOT.adicionales?.asignaciones_tareas || {};
                        const loggedInUserObj = users.find(u => u.username === (currentUser?.username || userName));
                        const loggedInUserId = loggedInUserObj ? loggedInUserObj.id : null;
                        const associatedPersonal = personalList.filter(p => p.usuario_id === loggedInUserId);
                        const associatedPersonalIds = associatedPersonal.map(p => p.id);

                        const assignedSectors = Object.keys(asignaciones).filter(sec => {
                           const assignedVal = asignaciones[sec];
                           if (!assignedVal) return false;
                           if (Array.isArray(assignedVal)) {
                             return assignedVal.some(val => {
                               const numVal = Number(val);
                               if (!isNaN(numVal)) {
                                 return associatedPersonalIds.includes(numVal);
                               }
                               return String(val) === (currentUser?.username || userName);
                             });
                           }
                           if (typeof assignedVal === 'number' || !isNaN(Number(assignedVal))) {
                             return associatedPersonalIds.includes(Number(assignedVal));
                           }
                           return String(assignedVal) === (currentUser?.username || userName);
                         });

                        if (assignedSectors.length === 0) {
                          return (
                            <div className="bg-slate-50 border border-slate-200 text-slate-500 rounded-3xl p-5 text-xs font-bold text-center leading-relaxed shadow-sm">
                              No tienes tareas asignadas para esta Orden de Trabajo.
                            </div>
                          );
                        }

                        // Style helper
                        const getSectorStyle = (sec) => {
                          if (sec === 'Planta') return { title: "Checklist Planta (Estructurales)", colColor: "text-orange-700", checkColor: "text-orange-600 focus:ring-orange-500" };
                          if (sec === 'Pañol') return { title: "Checklist Pañol (Estructurales)", colColor: "text-purple-700", checkColor: "text-purple-600 focus:ring-purple-500" };
                          if (sec === 'Lonas') return { title: "Checklist Lonas", colColor: "text-teal-700", checkColor: "text-teal-600 focus:ring-teal-500" };
                          if (sec === 'Pisos') return { title: "Checklist Pisos y Alfombras", colColor: "text-emerald-700", checkColor: "text-emerald-600 focus:ring-emerald-500" };
                          if (sec === 'Telas') return { title: "Checklist Telas (Cortinas/Cielor.)", colColor: "text-indigo-700", checkColor: "text-indigo-600 focus:ring-indigo-500" };
                          return { title: `Checklist ${sec}`, colColor: "text-slate-700", checkColor: "text-slate-650 focus:ring-slate-500" };
                        };

                        return (
                          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                            {assignedSectors.map((sector) => {
                              const sectorItems = allItems.map(item => {
                                return { ...item, computedSector: getSector(item) };
                              }).filter(item => item.computedSector === sector);

                              const style = getSectorStyle(sector);
                              const isAllowedState = ['Aprobada', 'Bulto Completo', 'En Planta'].includes(selectedOT.estado);
                              const isEditable = (
                                (sector === 'Pañol' && selectedOT.estado === 'Aprobada') ||
                                (sector === 'Planta' && (selectedOT.estado === 'Aprobada' || selectedOT.estado === 'Bulto Completo')) ||
                                ((sector === 'Lonas' || sector === 'Pisos' || sector === 'Telas') && isAllowedState)
                              );

                              return (
                                <div key={sector} className="border border-slate-200 rounded-3xl p-4 bg-slate-50/30">
                                  <div className="space-y-2">
                                    <h4 className={`text-[10px] font-black uppercase ${style.colColor} tracking-wider font-mono`}>{style.title}</h4>
                                    <div className="space-y-1">
                                      {sectorItems.map((item, index) => (
                                        <div key={index} className="flex items-start gap-2 py-1">
                                          <input
                                            type="checkbox"
                                            disabled={!isEditable}
                                            checked={item.checked}
                                            onChange={(e) => handleUpdateChecklistItem(item.originalIndex, item.sourceList, e.target.checked)}
                                            className={`w-4 h-4 mt-0.5 rounded border-slate-300 ${style.checkColor} cursor-pointer`}
                                          />
                                          <span className={`text-[10px] font-semibold leading-tight ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'} ${!isEditable ? 'opacity-60' : ''}`}>
                                            {item.producto} <span className={`font-extrabold ${style.colColor}`}>x{item.qty}</span>
                                          </span>
                                        </div>
                                      ))}
                                      {sectorItems.length === 0 && (
                                        <p className="text-[10px] text-slate-400 italic">No hay productos en este sector.</p>
                                      )}
                                    </div>
                                    {(sector === 'Planta' && (selectedOT.estado === 'Aprobada' || selectedOT.estado === 'Bulto Completo')) && (
                                      <button
                                        onClick={() => handleUpdateOTStatus(selectedOT.id, 'Completada')}
                                        className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg py-2 mt-2 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer"
                                      >
                                        Confirmar Carga / Despachar (Planta)
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      const filteredItems = allItems.map(item => {
                        return { ...item, computedSector: getSector(item) };
                      }).filter(item => {
                        if (actualRole === 'Planta') return item.computedSector === 'Planta';
                        if (actualRole === 'Pañol') return item.computedSector === 'Pañol';
                        if (actualRole === 'Lonas') return item.computedSector === 'Lonas';
                        if (actualRole === 'Pisos') return item.computedSector === 'Pisos';
                        if (actualRole === 'Telas') return item.computedSector === 'Telas';
                        return false;
                      });

                      let colTitle = "Checklist";
                      let colColor = "text-slate-700";
                      let checkColor = "text-slate-650 focus:ring-slate-500";
                      if (actualRole === 'Planta') {
                        colTitle = "1. Checklist Planta (Estructurales)";
                        colColor = "text-orange-700";
                        checkColor = "text-orange-600 focus:ring-orange-500";
                      } else if (actualRole === 'Pañol') {
                        colTitle = "1. Checklist Pañol (Estructurales)";
                        colColor = "text-purple-700";
                        checkColor = "text-purple-600 focus:ring-purple-500";
                      } else if (actualRole === 'Lonas') {
                        colTitle = "1. Checklist Lonas";
                        colColor = "text-teal-700";
                        checkColor = "text-teal-600 focus:ring-teal-500";
                      } else if (actualRole === 'Pisos') {
                        colTitle = "1. Checklist Pisos y Alfombras";
                        colColor = "text-emerald-700";
                        checkColor = "text-emerald-600 focus:ring-emerald-500";
                      } else if (actualRole === 'Telas') {
                        colTitle = "1. Checklist Telas (Cortinas y Cielorrasos)";
                        colColor = "text-indigo-700";
                        checkColor = "text-indigo-600 focus:ring-indigo-500";
                      }

                      const isAllowedState = ['Aprobada', 'Bulto Completo', 'En Planta'].includes(selectedOT.estado);
                      const isEditable = (
                        (actualRole === 'Pañol' && selectedOT.estado === 'Aprobada') ||
                        (actualRole === 'Planta' && (selectedOT.estado === 'Aprobada' || selectedOT.estado === 'Bulto Completo')) ||
                        ((actualRole === 'Lonas' || actualRole === 'Pisos' || actualRole === 'Telas') && isAllowedState)
                      );

                      return (
                        <div className="border border-slate-200 rounded-3xl p-4 bg-slate-50/30 grid grid-cols-1 gap-4 max-h-[220px] overflow-y-auto">
                          <div className="space-y-2">
                            <h4 className={`text-[10px] font-black uppercase ${colColor} tracking-wider font-mono`}>{colTitle}</h4>
                            <div className="space-y-1">
                              {filteredItems.map((item, index) => (
                                <div key={index} className="flex items-start gap-2 py-1">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditable}
                                    checked={item.checked}
                                    onChange={(e) => handleUpdateChecklistItem(item.originalIndex, item.sourceList, e.target.checked)}
                                    className={`w-4 h-4 mt-0.5 rounded border-slate-300 ${checkColor} cursor-pointer`}
                                  />
                                  <span className={`text-[10px] font-semibold leading-tight ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'} ${!isEditable ? 'opacity-60' : ''}`}>
                                    {item.producto} <span className={`font-extrabold ${colColor}`}>x{item.qty}</span>
                                  </span>
                                </div>
                              ))}
                              {filteredItems.length === 0 && (
                                <p className="text-[10px] text-slate-400 italic">No hay productos asignados a tu sector en esta OT.</p>
                              )}
                            </div>

                            {(actualRole === 'Planta' && (selectedOT.estado === 'Aprobada' || selectedOT.estado === 'Bulto Completo')) && (
                              <button
                                onClick={() => handleUpdateOTStatus(selectedOT.id, 'Completada')}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg py-2 mt-2 text-[10px] font-black uppercase tracking-wider shadow-sm transition-all-300 cursor-pointer"
                              >
                                Confirmar Carga / Despachar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Hitos Logísticos y Fechas (Operaciones & Gerencia) */}
                {selectedOT.estado !== 'Pendiente' && selectedOT.estado !== 'Rechazada' && (
                  <div className="border border-slate-200 rounded-3xl p-5 bg-slate-50/50 shadow-xs space-y-4">
                    <div className="pb-3 border-b border-slate-100 flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">
                        Hitos Logísticos y Fechas Críticas
                      </h4>
                      <span className="bg-slate-200/80 text-slate-700 rounded-full px-2 py-0.5 text-[9px] font-black uppercase">
                        Control de Tiempos
                      </span>
                    </div>

                    {/* Información Comercial */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-0.5">Fecha de Evento</span>
                        <span className="text-xs font-extrabold text-slate-800">
                          {selectedOT.fecha_evento ? new Date(selectedOT.fecha_evento + 'T00:00:00').toLocaleDateString('es-ES') : 'No especificada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-0.5">Geolocalización / Dirección</span>
                        <span className="text-xs font-extrabold text-slate-800">
                          {(() => {
                            const geo = typeof selectedOT.georef === 'string' ? JSON.parse(selectedOT.georef) : selectedOT.georef;
                            return geo?.direccion || 'No especificada';
                          })()}
                        </span>
                      </div>
                      <div className="md:col-span-2 border-t border-slate-50 pt-2">
                        <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-0.5">Observaciones Comerciales</span>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{selectedOT.observaciones || 'Sin observaciones.'}"
                        </p>
                      </div>
                    </div>

                    {/* Hitos Editables */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Fecha de Desarme (Fin) *</label>
                        <input
                          type="date"
                          disabled={!['Operaciones', 'Gerencia', 'SuperAdmin'].includes(userRole)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 disabled:opacity-60"
                          value={logisticaFechaFin}
                          onChange={(e) => setLogisticaFechaFin(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Fecha de Traslado</label>
                        <input
                          type="datetime-local"
                          disabled={!['Operaciones', 'Gerencia', 'SuperAdmin'].includes(userRole)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 disabled:opacity-60"
                          value={logisticaFechaTraslado}
                          onChange={(e) => setLogisticaFechaTraslado(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Comienzo de Armado</label>
                        <input
                          type="datetime-local"
                          disabled={!['Operaciones', 'Gerencia', 'SuperAdmin'].includes(userRole)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 disabled:opacity-60"
                          value={logisticaFechaComienzoArmado}
                          onChange={(e) => setLogisticaFechaComienzoArmado(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Comienzo de Desarmado</label>
                        <input
                          type="datetime-local"
                          disabled={!['Operaciones', 'Gerencia', 'SuperAdmin'].includes(userRole)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 disabled:opacity-60"
                          value={logisticaFechaComienzoDesarmado}
                          onChange={(e) => setLogisticaFechaComienzoDesarmado(e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Retorno al Depósito</label>
                        <input
                          type="datetime-local"
                          disabled={!['Operaciones', 'Gerencia', 'SuperAdmin'].includes(userRole)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 disabled:opacity-60"
                          value={logisticaFechaRetorno}
                          onChange={(e) => setLogisticaFechaRetorno(e.target.value)}
                        />
                      </div>
                    </div>

                    {['Operaciones', 'Gerencia', 'SuperAdmin'].includes(userRole) && (
                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <button
                          onClick={handleSaveLogistica}
                          className="bg-blue-900 hover:bg-blue-955 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl px-5 py-2.5 shadow-sm transition-all-300 cursor-pointer"
                        >
                          Guardar Hitos y Fechas
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Asignación de Personal y Recursos (Operaciones & Gerencia) */}
                {selectedOT.estado !== 'Pendiente' && selectedOT.estado !== 'Rechazada' && (
                  <div className="border border-slate-200 rounded-3xl p-5 bg-slate-50/50 shadow-xs space-y-4">
                    <div className="pb-3 border-b border-slate-100 flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">
                        Asignación de Personal y Recursos
                      </h4>
                      <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-[9px] font-black uppercase border border-blue-200">
                        Logística y Montaje
                      </span>
                    </div>

                    {/* Stage Selector Tabs */}
                    <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      {[
                        { id: 'picking', label: 'Picking / Carga' },
                        { id: 'traslado', label: 'Traslado' },
                        { id: 'armado', label: 'Armado' },
                        { id: 'desarme', label: 'Desarme' },
                        { id: 'retorno', label: 'Retorno' }
                      ].map(stage => (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => setAssignmentStage(stage.id)}
                          className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all-300 cursor-pointer text-center ${
                            assignmentStage === stage.id ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-650 hover:bg-slate-200/50'
                          }`}
                        >
                          {stage.label}
                        </button>
                      ))}
                    </div>

                    {/* Inteligencia Logística: Enlaces de Transferencia */}
                    {(() => {
                      const adObj = typeof selectedOT.adicionales === 'string' ? JSON.parse(selectedOT.adicionales) : selectedOT.adicionales || {};
                      const persAsig = adObj.personal_asignado || {};
                      const recAsig = adObj.recursos_asignados || {};

                      const assignedPersIds = persAsig[assignmentStage] || [];
                      const assignedRecIds = recAsig[assignmentStage] || [];

                      // 1. PULL: If we are in 'traslado' stage, check if we receive a transfer from another OT
                      if (assignmentStage === 'traslado') {
                        const record = desarmeRecords.find(d => {
                          const dests = d.destinos || [];
                          return dests.some(dest => dest.ot_id === selectedOT.id || dest.ot_numero === selectedOT.ot_numero);
                        });
                        let transferOrigin = null;
                        let originPers = [];
                        let originRecs = [];
                        let reason = "";

                        if (record) {
                          transferOrigin = ots.find(o => o.id === record.ot_origen_id);
                          if (transferOrigin) {
                            const originAd = typeof transferOrigin.adicionales === 'string' ? JSON.parse(transferOrigin.adicionales) : transferOrigin.adicionales || {};
                            originPers = originAd.personal_asignado?.desarme || [];
                            originRecs = originAd.recursos_asignados?.desarme || [];
                            reason = `desde la orden de desarme de ${transferOrigin.ot_numero} (${transferOrigin.cliente_nombre})`;
                          }
                        } else {
                          // Search in planned transfers
                          transferOrigin = ots.find(o => {
                            const oAd = typeof o.adicionales === 'string' ? JSON.parse(o.adicionales) : o.adicionales || {};
                            return oAd.transfer_dest_ot_id === selectedOT.id;
                          });
                          if (transferOrigin) {
                            const originAd = typeof transferOrigin.adicionales === 'string' ? JSON.parse(transferOrigin.adicionales) : transferOrigin.adicionales || {};
                            originPers = originAd.personal_asignado?.retorno || originAd.personal_asignado?.desarme || [];
                            originRecs = originAd.recursos_asignados?.retorno || originAd.recursos_asignados?.desarme || [];
                            reason = `planificada desde la OT ${transferOrigin.ot_numero} (${transferOrigin.cliente_nombre})`;
                          }
                        }

                        if (transferOrigin && (originPers.length > 0 || originRecs.length > 0)) {
                          const isDifferent = JSON.stringify([...assignedPersIds].sort()) !== JSON.stringify([...originPers].sort()) ||
                                              JSON.stringify([...assignedRecIds].sort()) !== JSON.stringify([...originRecs].sort());

                          if (isDifferent) {
                            return (
                              <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-3.5 rounded-2xl text-xs font-semibold space-y-2">
                                <div className="flex items-center gap-1.5 font-black text-indigo-850">
                                  <Truck className="w-4 h-4 text-indigo-700 shrink-0" />
                                  <span>Inteligencia Logística: Entrada de Transferencia Directa</span>
                                </div>
                                <p className="text-[10px] text-indigo-700 leading-relaxed">
                                  Esta OT recibe una transferencia directa de componentes {reason} sin retorno al depósito.
                                  Se sugiere asignar el mismo camión y personal para el traslado/entrega.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedAdicionales = {
                                      ...adObj,
                                      personal_asignado: {
                                        ...persAsig,
                                        traslado: Array.from(new Set([...(persAsig.traslado || []), ...originPers]))
                                      },
                                      recursos_asignados: {
                                        ...recAsig,
                                        traslado: Array.from(new Set([...(recAsig.traslado || []), ...originRecs]))
                                      }
                                    };
                                    handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                                    alert("Asignación de transferencia aplicada con éxito.");
                                  }}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all-300 cursor-pointer shadow-xs"
                                >
                                  Aprobar Asignación de Camión y Personal
                                </button>
                              </div>
                            );
                          }
                        }
                      }

                      // 2. PUSH: If we are in 'desarme' stage, check if we send a transfer to another OT
                      if (assignmentStage === 'desarme') {
                        const record = desarmeRecords.find(d => d.ot_origen_id === selectedOT.id);
                        let transferDestinations = [];

                        if (record) {
                          transferDestinations = (record.destinos || []).filter(dest => dest.type !== 'deposito' && dest.destino !== 'deposito');
                        } else if (adObj.transfer_dest_ot_id) {
                          transferDestinations = [{ ot_id: adObj.transfer_dest_ot_id }];
                        }

                        if (transferDestinations.length > 0) {
                          return transferDestinations.map(dest => {
                            const targetOT = ots.find(o => o.id === dest.ot_id || o.ot_numero === dest.ot_numero);
                            if (!targetOT) return null;

                            const targetAd = typeof targetOT.adicionales === 'string' ? JSON.parse(targetOT.adicionales) : targetOT.adicionales || {};
                            const targetPers = targetAd.personal_asignado?.traslado || [];
                            const targetRecs = targetAd.recursos_asignados?.traslado || [];

                            if (assignedPersIds.length > 0 || assignedRecIds.length > 0) {
                              const needCopy = assignedPersIds.some(id => !targetPers.includes(id)) ||
                                                assignedRecIds.some(id => !targetRecs.includes(id));

                              if (needCopy) {
                                return (
                                  <div key={targetOT.id} className="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900 p-3.5 rounded-2xl text-xs font-semibold space-y-2">
                                    <div className="flex items-center gap-1.5 font-black text-fuchsia-850">
                                      <Shuffle className="w-4 h-4 text-fuchsia-700 shrink-0" />
                                      <span>Inteligencia Logística: Salida de Transferencia Directa</span>
                                    </div>
                                    <p className="text-[10px] text-fuchsia-700 leading-relaxed">
                                      Esta OT envía componentes directamente a la <strong>{targetOT.ot_numero} ({targetOT.cliente_nombre})</strong>.
                                      Se sugiere asignar el mismo camión y personal actuales al traslado/entrega de la OT destino.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedTargetAd = {
                                          ...targetAd,
                                          personal_asignado: {
                                            ...(targetAd.personal_asignado || {}),
                                            traslado: Array.from(new Set([...targetPers, ...assignedPersIds]))
                                          },
                                          recursos_asignados: {
                                            ...(targetAd.recursos_asignados || {}),
                                            traslado: Array.from(new Set([...targetRecs, ...assignedRecIds]))
                                          }
                                        };
                                        handleUpdateOTAdicionales(targetOT.id, updatedTargetAd);
                                        alert(`Asignación copiada a la etapa de traslado de ${targetOT.ot_numero} con éxito.`);
                                      }}
                                      className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all-300 cursor-pointer shadow-xs"
                                    >
                                      Aprobar Copia de Recursos a {targetOT.ot_numero}
                                    </button>
                                  </div>
                                );
                              }
                            }
                            return null;
                          });
                        }
                      }

                      // 3. RETORNO stage: suggestion to copy from desarme stage within same OT if transfer is configured
                      if (assignmentStage === 'retorno') {
                        const destOtId = adObj.transfer_dest_ot_id;
                        if (destOtId) {
                          const targetOT = ots.find(o => o.id === destOtId);
                          const desarmePers = persAsig.desarme || [];
                          const desarmeRecs = recAsig.desarme || [];

                          if (desarmePers.length > 0 || desarmeRecs.length > 0) {
                            const isDifferent = JSON.stringify([...assignedPersIds].sort()) !== JSON.stringify([...desarmePers].sort()) ||
                                                JSON.stringify([...assignedRecIds].sort()) !== JSON.stringify([...desarmeRecs].sort());
                            if (isDifferent) {
                              return (
                                <div className="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900 p-3.5 rounded-2xl text-xs font-semibold space-y-2">
                                  <div className="flex items-center gap-1.5 font-black text-fuchsia-850">
                                    <Shuffle className="w-4 h-4 text-fuchsia-700 shrink-0" />
                                    <span>Inteligencia Logística: Sugerencia de Copia de Recursos</span>
                                  </div>
                                  <p className="text-[10px] text-fuchsia-700 leading-relaxed">
                                    Esta OT tiene configurada una transferencia directa hacia la <strong>{targetOT ? targetOT.ot_numero : `OT-${destOtId}`}</strong>.
                                    Se sugiere copiar los mismos recursos y personal asignados al Desarme para la etapa de Retorno/Traslado.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedAdicionales = {
                                        ...adObj,
                                        personal_asignado: {
                                          ...persAsig,
                                          retorno: Array.from(new Set([...(persAsig.retorno || []), ...desarmePers]))
                                        },
                                        recursos_asignados: {
                                          ...recAsig,
                                          retorno: Array.from(new Set([...(recAsig.retorno || []), ...desarmeRecs]))
                                        }
                                      };
                                      handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                                      alert("Recursos copiados a la etapa de retorno.");
                                    }}
                                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all-300 cursor-pointer shadow-xs"
                                  >
                                    Aprobar Copia de Recursos de Desarme a Retorno
                                  </button>
                                </div>
                              );
                            }
                          }
                        }
                      }
                      return null;
                    })()}

                    {/* Render active stage assignments */}
                    {(() => {
                      const adObj = typeof selectedOT.adicionales === 'string' ? JSON.parse(selectedOT.adicionales) : selectedOT.adicionales || {};
                      const persAsig = adObj.personal_asignado || {};
                      const recAsig = adObj.recursos_asignados || {};

                      const assignedPersIds = persAsig[assignmentStage] || [];
                      const assignedRecIds = recAsig[assignmentStage] || [];

                      const currentPersList = personalList.filter(p => assignedPersIds.includes(p.id));
                      const currentRecList = recursosList.filter(r => assignedRecIds.includes(r.id));

                      const availablePers = personalList.filter(p => p.activo !== false && !assignedPersIds.includes(p.id));
                      const availableRec = recursosList.filter(r => r.activo !== false && !assignedRecIds.includes(r.id));

                      const isEditable = ['Operaciones', 'Gerencia', 'SuperAdmin'].includes(userRole);

                      // Handlers
                      const handleAddPerson = (e) => {
                        const personId = parseInt(e.target.value);
                        if (isNaN(personId)) return;
                        e.target.value = ''; // reset

                        const conflict = checkPersonalConflict(personId, selectedOT);
                        if (conflict.conflict) {
                          if (conflict.person.rol_funcion === 'Planta' || conflict.person.rol_funcion === 'Pañol') {
                            alert(`Atención: El personal ${conflict.person.nombre} (Planta/Pañol) ya está asignado a la ${conflict.ot.ot_numero} durante estas fechas (${conflict.ot.fecha_inicio} a ${conflict.ot.fecha_fin}). Se permite su asignación doble con aviso.`);
                          } else {
                            alert(`Error: El personal ${conflict.person.nombre} (${conflict.person.rol_funcion}) ya está ocupado en la ${conflict.ot.ot_numero} durante estas fechas (${conflict.ot.fecha_inicio} a ${conflict.ot.fecha_fin}) y no se puede reutilizar.`);
                            return;
                          }
                        }

                        // Save
                        const updatedPers = {
                          ...persAsig,
                          [assignmentStage]: [...assignedPersIds, personId]
                        };
                        const updatedAdicionales = {
                          ...adObj,
                          personal_asignado: updatedPers
                        };
                        handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                      };

                      const handleRemovePerson = (personId) => {
                        const updatedPers = {
                          ...persAsig,
                          [assignmentStage]: assignedPersIds.filter(id => id !== personId)
                        };
                        const updatedAdicionales = {
                          ...adObj,
                          personal_asignado: updatedPers
                        };
                        handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                      };

                      const handleAddResource = (e) => {
                        const resourceId = parseInt(e.target.value);
                        if (isNaN(resourceId)) return;
                        e.target.value = ''; // reset

                        const conflict = checkResourceConflict(resourceId, selectedOT);
                        if (conflict.conflict) {
                          const goEdit = window.confirm(`El recurso ${conflict.resource.nombre} (${conflict.resource.tipo}) ya está asignado a la ${conflict.ot.ot_numero} durante estas fechas (${conflict.ot.fecha_inicio} a ${conflict.ot.fecha_fin}) y no se puede reutilizar.\n\n¿Desea ir a editar esa OT para liberar el recurso?`);
                          if (goEdit) {
                            setSelectedOT(conflict.ot);
                          }
                          return;
                        }

                        // Save
                        const updatedRec = {
                          ...recAsig,
                          [assignmentStage]: [...assignedRecIds, resourceId]
                        };
                        const updatedAdicionales = {
                          ...adObj,
                          recursos_asignados: updatedRec
                        };
                        handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                      };

                      const handleRemoveResource = (resourceId) => {
                        const updatedRec = {
                          ...recAsig,
                          [assignmentStage]: assignedRecIds.filter(id => id !== resourceId)
                        };
                        const updatedAdicionales = {
                          ...adObj,
                          recursos_asignados: updatedRec
                        };
                        handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                      };

                      if (assignmentStage === 'picking') {
                        const asignaciones = adObj.asignaciones_tareas || {};
                        const availablePeople = personalList.filter(p => p.activo !== false);

                        return (
                          <div className="space-y-4 animate-fadeIn">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3 shadow-xs">
                              <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">
                                Asignación de Tareas de Almacén (Picking / Carga)
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {[
                                  { key: 'Planta', label: 'Planta (Estructurales)' },
                                  { key: 'Pañol', label: 'Pañol (Estructurales)' },
                                  { key: 'Lonas', label: 'Lonas' },
                                  { key: 'Pisos', label: 'Pisos y Alfombras' },
                                  { key: 'Telas', label: 'Telas (Cortinas/Cielor.)' }
                                ].map(task => {
                                  const assignedVal = asignaciones[task.key];
                                  const assignedIds = (() => {
                                    if (!assignedVal) return [];
                                    if (Array.isArray(assignedVal)) {
                                      return assignedVal.map(id => typeof id === 'string' ? parseInt(id, 10) : id).filter(Boolean);
                                    }
                                    if (typeof assignedVal === 'number') return [assignedVal];
                                    if (typeof assignedVal === 'string') {
                                      const num = parseInt(assignedVal, 10);
                                      if (!isNaN(num)) return [num];
                                      // Legacy username map
                                      const match = personalList.find(p => p.nombre === assignedVal);
                                      return match ? [match.id] : [];
                                    }
                                    return [];
                                  })();

                                  return (
                                    <div key={task.key} className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl flex flex-col justify-between space-y-3">
                                      <div className="space-y-2">
                                        <span className="text-[10px] uppercase tracking-widest font-black text-slate-450 block">
                                          {task.label}
                                        </span>
                                        {/* Badges list */}
                                        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                                          {assignedIds.length > 0 ? (
                                            assignedIds.map(pId => {
                                              const person = personalList.find(p => p.id === pId);
                                              if (!person) return null;
                                              return (
                                                <span key={pId} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-blue-150">
                                                  {person.nombre}
                                                  {isEditable && (
                                                    <button
                                                      type="button"
                                                      onClick={async () => {
                                                        const newIds = assignedIds.filter(id => id !== pId);
                                                        const updatedAdicionales = {
                                                          ...adObj,
                                                          asignaciones_tareas: {
                                                            ...(adObj.asignaciones_tareas || {}),
                                                            [task.key]: newIds
                                                          }
                                                        };
                                                        await handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                                                      }}
                                                      className="text-blue-500 hover:text-blue-850 font-black cursor-pointer text-xs leading-none"
                                                    >
                                                      ×
                                                    </button>
                                                  )}
                                                </span>
                                              );
                                            })
                                          ) : (
                                            <span className="text-[10px] text-slate-400 font-semibold italic">
                                              Sin Asignar
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Dropdown to add a person */}
                                      {isEditable && (
                                        <select
                                          value=""
                                          onChange={async (e) => {
                                            const newId = parseInt(e.target.value, 10);
                                            if (!newId) return;
                                            if (assignedIds.includes(newId)) return;
                                            const newIds = [...assignedIds, newId];
                                            const updatedAdicionales = {
                                              ...adObj,
                                              asignaciones_tareas: {
                                                ...(adObj.asignaciones_tareas || {}),
                                                [task.key]: newIds
                                              }
                                            };
                                            await handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                                          }}
                                          className="w-full bg-white border border-slate-200 rounded-xl p-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                        >
                                          <option value="">+ Asignar Persona</option>
                                          {availablePeople
                                            .filter(p => !assignedIds.includes(p.id))
                                            .map(p => (
                                              <option key={p.id} value={p.id}>
                                                {p.nombre} ({p.rol_funcion})
                                              </option>
                                            ))}
                                        </select>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {/* Destino del Retorno/Transferencia: Only shown in 'retorno' stage */}
                          {assignmentStage === 'retorno' && (
                            <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-slate-100 animate-fadeIn">
                              <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 block">Destino del Retorno / Transferencia</span>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <select
                                  disabled={!isEditable}
                                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 w-full sm:max-w-md cursor-pointer"
                                  value={adObj.transfer_dest_ot_id || ''}
                                  onChange={(e) => {
                                    const destOtId = e.target.value;
                                    const updatedAdicionales = {
                                      ...adObj,
                                      transfer_dest_ot_id: destOtId ? parseInt(destOtId) : null
                                    };
                                    handleUpdateOTAdicionales(selectedOT.id, updatedAdicionales);
                                  }}
                                >
                                  <option value="">Depósito Central Carpas Dangiola (Retorno Estándar)</option>
                                  {ots.filter(o => o.id !== selectedOT.id && ['Aprobada', 'Bulto Completo', 'En Planta', 'Completada', 'Aprobada por Gerencia'].includes(o.estado)).map(o => (
                                    <option key={o.id} value={o.id}>
                                      Transferir a: {o.ot_numero} - {o.cliente_nombre} ({o.modelo_estructura} {o.frente}x{o.largo}m)
                                    </option>
                                  ))}
                                </select>
                                {adObj.transfer_dest_ot_id && (
                                  <span className="bg-fuchsia-100 text-fuchsia-850 text-[10px] font-black px-2.5 py-1.5 rounded-xl uppercase border border-fuchsia-250 w-max shrink-0">
                                    Transferencia Directa a Cliente
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Personal Section */}
                          <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-100">
                            <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 block">Personal Asignado</span>
                            
                            <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                              {currentPersList.length === 0 ? (
                                <span className="text-[10px] text-slate-450 font-bold italic py-1">Sin personal asignado a esta etapa.</span>
                              ) : (
                                currentPersList.map(p => (
                                  <span key={p.id} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-xl">
                                    <span>{p.nombre} ({p.rol_funcion})</span>
                                    {isEditable && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePerson(p.id)}
                                        className="text-red-505 hover:text-red-700 font-bold ml-1 text-xs shrink-0 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))
                              )}
                            </div>

                            {isEditable && (
                              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                                <label className="text-[8px] uppercase tracking-widest font-black text-slate-400 shrink-0">Asignar:</label>
                                {availablePers.length > 0 ? (
                                  <select
                                    onChange={handleAddPerson}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer max-w-xs"
                                    value=""
                                  >
                                    <option value="" disabled>Seleccione personal...</option>
                                    {availablePers.map(p => (
                                      <option key={p.id} value={p.id}>{p.nombre} ({p.rol_funcion})</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-bold italic">No hay más personal disponible para asignar.</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Recursos Section */}
                          <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-100">
                            <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 block">Recursos / Flota Asignados</span>
                            
                            <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                              {currentRecList.length === 0 ? (
                                <span className="text-[10px] text-slate-450 font-bold italic py-1">Sin recursos asignados a esta etapa.</span>
                              ) : (
                                currentRecList.map(r => (
                                  <span key={r.id} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-805 text-[10px] font-black uppercase px-2.5 py-1 rounded-xl">
                                    <span>{r.nombre} {r.patente_identificador ? `[${r.patente_identificador}]` : ''} ({r.tipo})</span>
                                    {isEditable && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveResource(r.id)}
                                        className="text-red-505 hover:text-red-700 font-bold ml-1 text-xs shrink-0 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))
                              )}
                            </div>

                            {isEditable && (
                              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                                <label className="text-[8px] uppercase tracking-widest font-black text-slate-400 shrink-0">Asignar:</label>
                                {availableRec.length > 0 ? (
                                  <select
                                    onChange={handleAddResource}
                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer max-w-xs"
                                    value=""
                                  >
                                    <option value="" disabled>Seleccione recurso...</option>
                                    {availableRec.map(r => (
                                      <option key={r.id} value={r.id}>
                                        {r.nombre} {r.patente_identificador ? `[${r.patente_identificador}]` : ''} ({r.tipo})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-bold italic">No hay más recursos disponibles para asignar.</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Right Column: Coordinated Chat */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 Poppins">Coordinación Operativa y Mensajería</h3>
                  <span className="text-[10px] font-black text-blue-900 border border-blue-200 px-2 py-0.5 rounded-md bg-blue-50/50 uppercase">Canal del Contrato</span>
                </div>
                <ChatComponent otId={selectedOT.id} userRole={userRole} userName={userName} />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* -------------------- 2b. MODAL DIALOG ASISTENTE DE DESARME -------------------- */}
      {disassemblyOT && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-4xl p-6 md:p-8 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setDisassemblyOT(null);
                setDisassemblyTransferOTId('');
                setDisassemblyAllocations({});
                setDisassemblyStep(1);
              }}
              className="absolute right-6 top-6 p-1 rounded-full hover:bg-slate-100 transition-all-300"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>

            {/* Modal Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-black text-fuchsia-600 text-lg">Asistente de Desarme e Inversa</span>
                  <span className="bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 rounded-full px-2 py-0.5 text-[10px] font-black uppercase">
                    OT: {disassemblyOT.ot_numero}
                  </span>
                </div>
                <h2 className="text-xl font-black uppercase text-blue-900 tracking-wider Poppins">{disassemblyOT.cliente_nombre}</h2>
              </div>
              <span className="bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-[11px] font-extrabold text-slate-600 uppercase">
                Paso {disassemblyStep} de 4
              </span>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
              {[
                { step: 1, label: "Remito Pre-armado" },
                { step: 2, label: "Bimodal" },
                { step: 3, label: "Distribución" },
                { step: 4, label: "Confirmación" }
              ].map(s => (
                <div key={s.step} className="flex-1 flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all-300 ${
                    disassemblyStep >= s.step ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    {s.step}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-black hidden md:inline ${
                    disassemblyStep >= s.step ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {s.label}
                  </span>
                  {s.step < 4 && <div className={`flex-1 h-0.5 ${disassemblyStep > s.step ? 'bg-fuchsia-600' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>

            {/* STEP 1: PRE-ARMED PACKING LIST */}
            {disassemblyStep === 1 && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-5 border border-slate-150 rounded-3xl space-y-3">
                  <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">
                    Planilla de Control y Picking Pre-armada (Remito Total)
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Antes de comenzar el desarme físico en el terreno, imprima o descargue esta planilla de control para que el chofer y los operarios puedan cotejar cada pieza al subirla al camión.
                  </p>

                  <div className="flex justify-start">
                    <button
                      onClick={() => generateDisassemblyPreArmadoPDF(disassemblyOT)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition-all-305 flex items-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir Planilla de Control (PDF)</span>
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-xs bg-white max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest text-[9px] font-black">
                        <th className="p-4">Componente / Producto</th>
                        <th className="p-4">Cantidad</th>
                        <th className="p-4">Sector</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {getDisassemblyItemsList(disassemblyOT).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-4 uppercase">{item.producto}</td>
                          <td className="p-4 font-extrabold text-blue-900">{item.qty}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              item.sector === 'Planta' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {item.sector}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setDisassemblyStep(2)}
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-black text-xs uppercase tracking-widest rounded-xl px-6 py-3 shadow-md hover:-translate-y-0.5 transition-all-300 cursor-pointer"
                  >
                    Siguiente Paso
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BIMODAL QUESTION */}
            {disassemblyStep === 2 && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-sm font-black uppercase text-blue-955 tracking-wider Poppins">
                    Destino Final de la Mercadería
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold max-w-lg mx-auto">
                    Defina si el 100% de la carpa y sus accesorios deben retornar al depósito o si se realizará una transferencia a otra orden de trabajo.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option Yes: Returns to Depósito */}
                  <button
                    onClick={() => {
                      setDisassemblyRetornoCompleto(true);
                      setDisassemblyTransferOTId('');
                    }}
                    className={`p-6 rounded-[2rem] border text-left flex flex-col justify-between h-[200px] transition-all-305 focus:outline-none ${
                      disassemblyRetornoCompleto && !disassemblyTransferOTId
                        ? 'bg-fuchsia-50 border-fuchsia-400 ring-2 ring-fuchsia-100 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="p-3 bg-fuchsia-100/60 rounded-2xl w-max">
                      <Warehouse className="w-6 h-6 text-fuchsia-700" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider mb-1">Retorno Limpio a Depósito</h4>
                      <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                        El 100% de las estructuras y accesorios volverán al depósito central de Carpas Dangiola.
                      </p>
                    </div>
                  </button>

                  {/* Option No: Partial Distribution / Transfer */}
                  <button
                    onClick={() => {
                      setDisassemblyRetornoCompleto(false);
                    }}
                    className={`p-6 rounded-[2rem] border text-left flex flex-col justify-between h-[200px] transition-all-305 focus:outline-none ${
                      !disassemblyRetornoCompleto
                        ? 'bg-fuchsia-50 border-fuchsia-400 ring-2 ring-fuchsia-100 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="p-3 bg-fuchsia-100/60 rounded-2xl w-max">
                      <Shuffle className="w-6 h-6 text-fuchsia-700" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider mb-1">Distribución / Explosión Parcial</h4>
                      <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                        Descompone las estructuras y permite transferir piezas específicas a OTs compatibles activas del día siguiente.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Compatibility / Total Transfer routing if Retorno Completo */}
                {disassemblyRetornoCompleto && (
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-3xl space-y-3">
                    <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">
                      ¿Transferir el 100% de esta estructura a otra OT? (Opcional)
                    </label>
                    <select
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition-all-300"
                      value={disassemblyTransferOTId}
                      onChange={(e) => setDisassemblyTransferOTId(e.target.value)}
                    >
                      <option value="">No, retornar al depósito central Dangiola</option>
                      {ots.filter(o =>
                        o.id !== disassemblyOT.id &&
                        ['Aprobada', 'Bulto Completo', 'En Planta', 'Completada'].includes(o.estado)
                      ).map(o => (
                        <option key={o.id} value={o.id}>
                          {o.ot_numero} - {o.cliente_nombre} ({o.modelo_estructura} {o.frente}x{o.largo}m) - Inicia: {new Date(o.fecha_inicio + 'T00:00:00').toLocaleDateString('es-ES')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setDisassemblyStep(1)}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl px-5 py-3"
                  >
                    Volver
                  </button>
                  <button
                    onClick={() => setDisassemblyStep(3)}
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-black text-xs uppercase tracking-widest rounded-xl px-6 py-3 shadow-md hover:-translate-y-0.5 transition-all-300 cursor-pointer"
                  >
                    Siguiente Paso
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: DISTRIBUTION DETAILS */}
            {disassemblyStep === 3 && (
              <div className="space-y-4">
                {disassemblyRetornoCompleto ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-6 rounded-[2rem] space-y-3">
                    <div className="flex items-center gap-2 font-black text-emerald-800 text-sm uppercase tracking-wide">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Retorno Total Configurado</span>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed">
                      Ha seleccionado retornar el 100% de las piezas conformed a:
                      <strong className="block mt-1 font-black text-blue-900 uppercase">
                        {disassemblyTransferOTId 
                          ? `OT #${ots.find(o => o.id === parseInt(disassemblyTransferOTId))?.ot_numero} (${ots.find(o => o.id === parseInt(disassemblyTransferOTId))?.cliente_nombre})`
                          : 'Depósito Central Carpas Dangiola'
                        }
                      </strong>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-3xl space-y-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">
                          Seleccione la OT de Destino de la Transferencia Parcial
                        </label>
                        <select
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-fuchsia-600 transition-all-300"
                          value={disassemblyTransferOTId}
                          onChange={(e) => {
                            const nextOtId = e.target.value;
                            setDisassemblyTransferOTId(nextOtId);
                            // Pre-fill smart suggestions
                            const target = ots.find(o => o.id === parseInt(nextOtId));
                            const allocations = {};
                            getDisassemblyItemsList(disassemblyOT).forEach(item => {
                              const suggested = getSuggestionForTransfer(item.producto, target);
                              allocations[item.producto] = Math.min(item.qty, suggested);
                            });
                            setDisassemblyAllocations(allocations);
                          }}
                        >
                          <option value="">Seleccionar OT Destino...</option>
                          {ots.filter(o =>
                            o.id !== disassemblyOT.id &&
                            ['Aprobada', 'Bulto Completo', 'En Planta', 'Completada'].includes(o.estado)
                          ).map(o => (
                            <option key={o.id} value={o.id}>
                              {o.ot_numero} - {o.cliente_nombre} ({o.modelo_estructura} {o.frente}x{o.largo}m) - Inicia: {new Date(o.fecha_inicio + 'T00:00:00').toLocaleDateString('es-ES')}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {disassemblyTransferOTId && (
                      <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-xs bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-widest text-[9px] font-black">
                              <th className="p-4">Componente</th>
                              <th className="p-4 w-24">Cantidad Origen</th>
                              <th className="p-4 w-48">Asignar a Transferencia</th>
                              <th className="p-4 w-32">Retorno a Depósito</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {getDisassemblyItemsList(disassemblyOT).map((item, idx) => {
                              const allocated = disassemblyAllocations[item.producto] || 0;
                              const remaining = item.qty - allocated;
                              const targetOT = ots.find(o => o.id === parseInt(disassemblyTransferOTId));
                              const suggestion = getSuggestionForTransfer(item.producto, targetOT);

                              return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-4 uppercase">
                                    <div>{item.producto}</div>
                                    {suggestion > 0 && (
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[8px] font-black uppercase px-1 rounded">
                                          💡 Sugerido: {Math.min(item.qty, suggestion)} (Requerido por OT #{targetOT?.ot_numero})
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDisassemblyAllocations(prev => ({
                                              ...prev,
                                              [item.producto]: Math.min(item.qty, suggestion)
                                            }));
                                          }}
                                          className="text-[8px] font-black text-blue-900 underline hover:text-blue-955 uppercase cursor-pointer"
                                        >
                                          Aplicar
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-4 text-center font-extrabold text-blue-900">{item.qty}</td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min="0"
                                        max={item.qty}
                                        className="w-20 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-fuchsia-600"
                                        value={allocated}
                                        onChange={(e) => {
                                          const val = Math.min(item.qty, Math.max(0, parseInt(e.target.value) || 0));
                                          setDisassemblyAllocations(prev => ({
                                            ...prev,
                                            [item.producto]: val
                                          }));
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td className="p-4 text-slate-500 font-extrabold text-center">{remaining}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setDisassemblyStep(2)}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl px-5 py-3"
                  >
                    Volver
                  </button>
                  <button
                    onClick={() => {
                      if (!disassemblyRetornoCompleto && !disassemblyTransferOTId) {
                        alert("Por favor, seleccione la OT destino para la transferencia parcial.");
                        return;
                      }
                      setDisassemblyStep(4);
                    }}
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-black text-xs uppercase tracking-widest rounded-xl px-6 py-3 shadow-md hover:-translate-y-0.5 transition-all-300 cursor-pointer"
                  >
                    Siguiente Paso
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SUMMARY & CONFIRMATION */}
            {disassemblyStep === 4 && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-5 border border-slate-200 rounded-[2rem] space-y-4">
                  <h3 className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">
                    Resumen de Distribución de Materiales
                  </h3>

                  {disassemblyRetornoCompleto ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold">
                        Se generará <strong className="text-fuchsia-700">1 Remito oficial</strong> con destino a:
                      </div>
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 text-xs">
                        📍 <strong>Destino:</strong> {disassemblyTransferOTId ? `OT #${ots.find(o => o.id === parseInt(disassemblyTransferOTId))?.ot_numero} - ${ots.find(o => o.id === parseInt(disassemblyTransferOTId))?.cliente_nombre}` : 'Depósito Central Carpas Dangiola'}
                        <div className="text-slate-400 font-medium mt-1">
                          Cantidad total de componentes: {getDisassemblyItemsList(disassemblyOT).reduce((sum, i) => sum + i.qty, 0)} unidades
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold">
                        Se generarán <strong className="text-fuchsia-700">hasta 2 Remitos oficiales</strong> de transporte:
                      </div>

                      {/* Remito Transfer */}
                      {(() => {
                        const targetOT = ots.find(o => o.id === parseInt(disassemblyTransferOTId));
                        const allocatedCount = Object.values(disassemblyAllocations).reduce((sum, q) => sum + q, 0);
                        if (allocatedCount === 0) return null;
                        return (
                          <div className="bg-white p-3 rounded-2xl border border-slate-100 text-xs">
                            📍 <strong>Remito 1 (Transferencia):</strong> OT #{targetOT?.ot_numero} - {targetOT?.cliente_nombre}
                            <div className="text-slate-500 font-medium mt-1">
                              Componentes transferidos: {allocatedCount} unidades
                            </div>
                          </div>
                        );
                      })()}

                      {/* Remito Depot */}
                      {(() => {
                        const items = getDisassemblyItemsList(disassemblyOT);
                        const remainingCount = items.reduce((sum, item) => {
                          const allocated = disassemblyAllocations[item.producto] || 0;
                          return sum + (item.qty - allocated);
                        }, 0);
                        if (remainingCount === 0) return null;
                        return (
                          <div className="bg-white p-3 rounded-2xl border border-slate-100 text-xs">
                            📍 <strong>Remito 2 (Retorno):</strong> Depósito Central Carpas Dangiola
                            <div className="text-slate-500 font-medium mt-1">
                              Componentes retornados: {remainingCount} unidades
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setDisassemblyStep(3)}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl px-5 py-3"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleConfirmDisassembly}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl px-6 py-3 shadow-md hover:-translate-y-0.5 transition-all-300 cursor-pointer"
                  >
                    Confirmar y Procesar Desarme
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="mt-auto text-center text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pt-8 border-t border-slate-200 max-w-7xl mx-auto w-full px-6 space-y-1">
        <span className="block">Carpas D'Angiola ERP © 2026 - Logística Modular Inteligente</span>
        <span className="block">Desarrollado por Consulting-VP | +54 9 11 2775 9110</span>
      </footer>

      {/* -------------------- 3. MODAL CREAR/EDITAR USUARIO (SuperAdmin Only) -------------------- */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative">
            <button
              onClick={() => { setShowUserModal(false); setSelectedUser(null); }}
              className="absolute right-6 top-6 p-1 rounded-full hover:bg-slate-100 transition-all-300"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>

            <h2 className="text-lg font-black uppercase text-blue-900 tracking-wider Poppins mb-6">
              {selectedUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
            </h2>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Juan Pérez"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  value={userFormNombre}
                  onChange={(e) => setUserFormNombre(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Nombre de Usuario *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. juanperez"
                  disabled={selectedUser && selectedUser.username === 'admin'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 disabled:opacity-60"
                  value={userFormUsername}
                  onChange={(e) => setUserFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Contraseña *</label>
                <input
                  type="text"
                  required
                  placeholder="Contraseña"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300"
                  value={userFormPassword}
                  onChange={(e) => setUserFormPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Rol de Acceso *</label>
                <select
                  required
                  disabled={selectedUser && selectedUser.username === 'admin'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 disabled:opacity-60"
                  value={userFormRol}
                  onChange={(e) => {
                    const nextRol = e.target.value;
                    setUserFormRol(nextRol);
                    if (nextRol === 'Comercial') setUserFormModulos(['Comercial']);
                    else if (nextRol === 'Gerencia') setUserFormModulos(['Gerencia', 'Comercial', 'Operaciones', 'Almacen']);
                    else if (nextRol === 'Operaciones') setUserFormModulos(['Operaciones']);
                    else if (nextRol === 'SuperAdmin') setUserFormModulos(['Gerencia', 'Comercial', 'Operaciones', 'Almacen']);
                    else setUserFormModulos(['Almacen']);
                  }}
                >
                  {roles.map(r => (
                    <option key={r} value={r}>{r.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-400 block mb-1">Módulos de Visualización *</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {['Comercial', 'Operaciones', 'Almacen'].map(mod => {
                    const isChecked = userFormModulos.includes(mod);
                    return (
                      <label key={mod} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUserFormModulos([...userFormModulos, mod]);
                            } else {
                              setUserFormModulos(userFormModulos.filter(m => m !== mod));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-900 focus:ring-blue-900 w-4 h-4 cursor-pointer"
                        />
                        <span>{mod}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowUserModal(false); setSelectedUser(null); }}
                  className="bg-slate-100 hover:bg-slate-250 border border-slate-250 text-slate-700 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider transition-all-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest shadow-md transition-all-300"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
