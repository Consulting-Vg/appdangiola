import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import ChatComponent from './ChatComponent';
import {
  Calendar as CalendarIcon, Users, Truck, Plus, Trash2, Edit3, CheckCircle,
  AlertTriangle, Clock, MapPin, Layers, ChevronLeft, ChevronRight,
  Tv, Save, X, Search, Filter, ShieldCheck, UserCheck,
  AlertCircle, ArrowRight, UserPlus, Info, Check, RefreshCw, Eye, Sparkles,
  Maximize, Minimize, Bell, Wrench, Shield, FileText, ChevronDown, CheckSquare,
  Package, Repeat, ArrowRightLeft, Boxes, HelpCircle, Printer, MessageSquare,
  Moon, Sun
} from 'lucide-react';

const SECTORES_INTERNOS = [
  { id: 'Lonas', nombre: 'Lonas', icon: '⛺', desc: 'Lavado, confección y plegado' },
  { id: 'Planta', nombre: 'Planta / Taller', icon: '🏭', desc: 'Mantenimiento y armado interno' },
  { id: 'Pañol', nombre: 'Pañol', icon: '📦', desc: 'Herramientas y bulonería' },
  { id: 'Alfombras', nombre: 'Alfombras', icon: '🧶', desc: 'Corte, colocación y empaque' },
  { id: 'Telas', nombre: 'Telas', icon: '🧵', desc: 'Confección y cielo rasos' },
  { id: 'Herrería', nombre: 'Herrería', icon: '🛠️', desc: 'Estructuras y anclajes' },
  { id: 'Limpieza', nombre: 'Limpieza', icon: '🧹', desc: 'Acondicionamiento general' }
];

const NOVEDADES_AUSENCIAS = [
  { id: 'Franco', nombre: 'Franco Compensatorio', icon: '🏖️', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'ART', nombre: 'ART / Licencia Médica', icon: '🏥', color: 'bg-rose-50 text-rose-800 border-rose-200' },
  { id: 'Turno_Medico', nombre: 'Turno Médico / Trámite', icon: '🩺', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { id: 'Vacaciones', nombre: 'Vacaciones', icon: '✈️', color: 'bg-purple-50 text-purple-800 border-purple-200' }
];

const ETAPAS_OT = ['Armado', 'Evento', 'Desarme', 'Guardia', 'Mantenimiento'];

export default function PlanificadorOperativo({ 
  ots = [], 
  userRole, 
  userName, 
  onRefreshData, 
  onOpenOTDetail, 
  initialDate, 
  focusedEventId,
  viewMode = 'diaria',
  onChangeViewMode,
  isNightMode: propIsNightMode,
  toggleNightMode: propToggleNightMode
}) {
  const [localNightMode, setLocalNightMode] = useState(() => {
    try {
      return localStorage.getItem('dangiola_night_mode') === 'true';
    } catch {
      return false;
    }
  });

  const isNightMode = propIsNightMode !== undefined ? propIsNightMode : localNightMode;
  const toggleNightMode = () => {
    if (propToggleNightMode) {
      propToggleNightMode();
    } else {
      setLocalNightMode(prev => {
        const next = !prev;
        try { localStorage.setItem('dangiola_night_mode', String(next)); } catch (e) {}
        return next;
      });
    }
  };

  // ── Date & View State
  const [selectedDate, setSelectedDate] = useState(() => initialDate || new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('cronograma'); // 'cronograma' | 'proyeccion_planta' | 'recordatorios'
  const [tvMode, setTvMode] = useState(false);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  // ── Master Resources State (from tables personal & recursos)
  const [personalList, setPersonalList] = useState([]);
  const [recursosList, setRecursosList] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // ── Resource Bank Filter & Search
  const [resourceTab, setResourceTab] = useState('personal'); // 'personal' | 'vehiculos'
  const [personalFilter, setPersonalFilter] = useState('todos'); // 'todos' | 'Chofer' | 'Encargado' | 'Operario' | 'Fijo' | 'Eventual'
  const [searchQuery, setSearchQuery] = useState('');

  // ── Daily Assignments State
  const [dayAssignments, setDayAssignments] = useState({
    ots: {},
    sectores: {},
    novedades: {}
  });
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'

  // ── Cascading Date Range & Event Filter State
  const [filterPreset, setFilterPreset] = useState('mes'); // 'dia' | 'semana' | 'mes' | 'custom'
  const [filterDesde, setFilterDesde] = useState(() => {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [filterHasta, setFilterHasta] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });
  const [selectedEventIds, setSelectedEventIds] = useState([]); // Array of IDs; empty = all in range
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [eventFilterSearch, setEventFilterSearch] = useState('');

  // Quick Preset Helper for Día, Semana, Mes
  const applyPresetFilter = (type) => {
    setFilterPreset(type);
    const baseDate = new Date(selectedDate + 'T00:00:00');
    
    if (type === 'dia') {
      setFilterDesde(selectedDate);
      setFilterHasta(selectedDate);
    } else if (type === 'semana') {
      const day = baseDate.getDay();
      const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(baseDate.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setFilterDesde(monday.toISOString().split('T')[0]);
      setFilterHasta(sunday.toISOString().split('T')[0]);
    } else if (type === 'mes') {
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      setFilterDesde(firstDay.toISOString().split('T')[0]);
      setFilterHasta(lastDay.toISOString().split('T')[0]);
    }
  };

  // ── Planta Tasks & Reminders State
  const [plantaTareas, setPlantaTareas] = useState([]);
  const [recordatorios, setRecordatorios] = useState([]);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderFecha, setNewReminderFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [newReminderTipo, setNewReminderTipo] = useState('General');

  // ── Drag & Drop Active State
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'persona' | 'vehiculo', data: obj }

  // ── OT Edit Modal State
  const [editingOT, setEditingOT] = useState(null);
  const [savingOT, setSavingOT] = useState(false);

  // ── Helper Safe JSON Parse ──
  const safeJsonParse = (str, fallback = {}) => {
    if (!str) return fallback;
    if (typeof str === 'object') return str;
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  };

  // ── Helper Sector Classifier ──
  const getSectorForItem = (item) => {
    if (item.sector) {
      const s = String(item.sector).toLowerCase();
      if (s.includes('pañol') || s.includes('panol')) return 'Pañol';
      if (s.includes('lona')) return 'Lonas';
      if (s.includes('planta') || s.includes('taller') || s.includes('piso') || s.includes('estructura')) return 'Planta';
      if (s.includes('alfombra')) return 'Alfombras';
      if (s.includes('tela') || s.includes('cielorraso')) return 'Telas';
      if (s.includes('herrer')) return 'Herrería';
      if (s.includes('limpieza') || s.includes('lavado')) return 'Limpieza';
      return item.sector;
    }
    const n = (item.producto || '').toLowerCase();
    if (n.includes('lona') || n.includes('techo') || n.includes('lateral') || n.includes('triangulo') || n.includes('tapachata') || n.includes('puerta')) return 'Lonas';
    if (n.includes('alfombra')) return 'Alfombras';
    if (n.includes('tela') || n.includes('cielorraso') || n.includes('cortina') || n.includes('faldon')) return 'Telas';
    if (n.includes('herrer') || n.includes('reja') || n.includes('soporte hierro') || n.includes('anclaje hierro')) return 'Herrería';
    if (n.includes('limpieza') || n.includes('lavado') || n.includes('lustre') || n.includes('hidro')) return 'Limpieza';
    if (n.includes('bulon') || n.includes('tuerca') || n.includes('arandela') || n.includes('herraje') || n.includes('cinta') || n.includes('tensor') || n.includes('cable') || n.includes('grillete') || n.includes('estaca') || n.includes('herramienta') || n.includes('taladro')) return 'Pañol';
    return 'Planta';
  };

  // ── Checklist & Material Explosion Modal State ──
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [activeChecklistOT, setActiveChecklistOT] = useState(null);
  const [activeSectorTab, setActiveSectorTab] = useState('Pañol');
  const [checklistSearch, setChecklistSearch] = useState('');
  
  // Agregar item manual y stock inteligente
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemSector, setNewItemSector] = useState('Pañol');
  const [stockInventoryList, setStockInventoryList] = useState(() => {
    try {
      const cached = localStorage.getItem('dangiola_catalogo_maestro');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [loadingStockCatalog, setLoadingStockCatalog] = useState(false);
  const [showStockSuggestions, setShowStockSuggestions] = useState(false);
  const [showStockCatalogModal, setShowStockCatalogModal] = useState(false);
  const [stockCatalogSearch, setStockCatalogSearch] = useState('');

  // Préstamo de otra OT
  const [showLoanSection, setShowLoanSection] = useState(false);
  const [loanSourceOTId, setLoanSourceOTId] = useState('');
  const [loanItemName, setLoanItemName] = useState('');
  const [loanItemQty, setLoanItemQty] = useState(1);
  const [loanSuccessMsg, setLoanSuccessMsg] = useState('');
  const [savingChecklist, setSavingChecklist] = useState(false);

  // Módulo de Chat en Vivo Integrado con OTs
  const [activeChatOT, setActiveChatOT] = useState(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [showChecklistChatTab, setShowChecklistChatTab] = useState(false);

  // Open checklist modal for a given OT and sector
  const handleOpenChecklistModal = (ot, sector = 'Pañol') => {
    setActiveChecklistOT(ot);
    setActiveSectorTab(sector);
    setNewItemSector(sector === 'todos' ? 'Pañol' : sector);
    setChecklistSearch('');
    setShowLoanSection(false);
    setShowStockCatalogModal(false);
    setShowStockSuggestions(false);
    setLoanSuccessMsg('');
    setChecklistModalOpen(true);
    fetchStockInventory();
  };

  // Helper to extract aggregated items for activeChecklistOT
  const getActiveOTItems = () => {
    if (!activeChecklistOT) return [];
    const panol = typeof activeChecklistOT.panol_status === 'string' ? safeJsonParse(activeChecklistOT.panol_status) : (activeChecklistOT.panol_status || {});
    const planta = typeof activeChecklistOT.planta_status === 'string' ? safeJsonParse(activeChecklistOT.planta_status) : (activeChecklistOT.planta_status || {});
    
    const items = [];
    (panol.items || []).forEach((item, idx) => {
      items.push({
        ...item,
        originalIndex: idx,
        sourceList: 'Pañol',
        detectedSector: getSectorForItem(item)
      });
    });
    (planta.items || []).forEach((item, idx) => {
      items.push({
        ...item,
        originalIndex: idx,
        sourceList: 'Planta',
        detectedSector: getSectorForItem(item)
      });
    });
    return items;
  };

  // Toggle item boolean state (preparado / enviado)
  const handleToggleItemField = async (sourceList, originalIndex, field) => {
    if (!activeChecklistOT) return;
    const ot = { ...activeChecklistOT };
    const panol = typeof ot.panol_status === 'string' ? safeJsonParse(ot.panol_status) : { ...(ot.panol_status || { items: [] }) };
    const planta = typeof ot.planta_status === 'string' ? safeJsonParse(ot.planta_status) : { ...(ot.planta_status || { items: [] }) };

    const targetList = sourceList === 'Pañol' ? panol : planta;
    if (targetList.items && targetList.items[originalIndex]) {
      const currentVal = !!targetList.items[originalIndex][field];
      targetList.items[originalIndex][field] = !currentVal;
      if (field === 'preparado') {
        targetList.items[originalIndex].checked = !currentVal;
      }
    }

    const updatedOT = { ...ot, panol_status: panol, planta_status: planta };
    setActiveChecklistOT(updatedOT);

    try {
      setSavingChecklist(true);
      await fetch(`/api/ots/${ot.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panol_status: JSON.stringify(panol),
          planta_status: JSON.stringify(planta),
          usuario: userName || 'Sistema',
          rol: userRole || 'Operaciones'
        })
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(`Error al actualizar estado ${field}:`, err);
    } finally {
      setSavingChecklist(false);
    }
  };

  // Update item field value (cant_egresan, cant_regresan, observaciones, qty)
  const handleUpdateItemValue = async (sourceList, originalIndex, field, value) => {
    if (!activeChecklistOT) return;
    const ot = { ...activeChecklistOT };
    const panol = typeof ot.panol_status === 'string' ? safeJsonParse(ot.panol_status) : { ...(ot.panol_status || { items: [] }) };
    const planta = typeof ot.planta_status === 'string' ? safeJsonParse(ot.planta_status) : { ...(ot.planta_status || { items: [] }) };

    const targetList = sourceList === 'Pañol' ? panol : planta;
    if (targetList.items && targetList.items[originalIndex]) {
      targetList.items[originalIndex][field] = value;
    }

    const updatedOT = { ...ot, panol_status: panol, planta_status: planta };
    setActiveChecklistOT(updatedOT);

    try {
      await fetch(`/api/ots/${ot.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panol_status: JSON.stringify(panol),
          planta_status: JSON.stringify(planta),
          usuario: userName || 'Sistema',
          rol: userRole || 'Operaciones'
        })
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(`Error al actualizar ${field}:`, err);
    }
  };

  // Update item quantity
  const handleUpdateItemQty = async (sourceList, originalIndex, delta) => {
    if (!activeChecklistOT) return;
    const ot = { ...activeChecklistOT };
    const panol = typeof ot.panol_status === 'string' ? safeJsonParse(ot.panol_status) : { ...(ot.panol_status || { items: [] }) };
    const planta = typeof ot.planta_status === 'string' ? safeJsonParse(ot.planta_status) : { ...(ot.planta_status || { items: [] }) };

    const targetList = sourceList === 'Pañol' ? panol : planta;
    if (targetList.items && targetList.items[originalIndex]) {
      const currentQty = Number(targetList.items[originalIndex].qty) || 1;
      const newQty = Math.max(0, currentQty + delta);
      targetList.items[originalIndex].qty = newQty;
      if (targetList.items[originalIndex].cant_egresan === undefined) {
        targetList.items[originalIndex].cant_egresan = newQty;
      }
    }

    const updatedOT = { ...ot, panol_status: panol, planta_status: planta };
    setActiveChecklistOT(updatedOT);

    try {
      setSavingChecklist(true);
      await fetch(`/api/ots/${ot.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panol_status: JSON.stringify(panol),
          planta_status: JSON.stringify(planta),
          usuario: userName || 'Sistema',
          rol: userRole || 'Operaciones'
        })
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Error al actualizar cantidad de ítem:", err);
    } finally {
      setSavingChecklist(false);
    }
  };

  // Print Official Remito & Checklist PDF
  const handlePrintRemitoChecklistPDF = async (ot, sectorFilter = 'todos') => {
    if (!ot) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const primaryColor = [16, 49, 107];

    // Preload logo
    const logoImg = new Image();
    logoImg.src = '/cd.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });

    // Draw header box
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 10, 277, 28, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(10, 10, 277, 28, 'S');

    if (logoImg.complete && logoImg.naturalWidth > 0) {
      try {
        doc.addImage(logoImg, 'PNG', 14, 13, 30, 22);
      } catch (e) {}
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CARPAS D'ANGIOLA — REMITO Y PLANILLA DE CARGA / CHECKLIST", 48, 19);

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`OT: OT-${ot.ot_numero || ot.id}   |   CLIENTE: ${ot.cliente_nombre || 'N/A'}   |   ESTRUCTURA: ${ot.modelo_estructura || ''} (${ot.frente || 0}x${ot.largo || 0}m)`, 48, 26);
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-ES')}   |   SECTOR: ${sectorFilter.toUpperCase()}   |   LUGAR: ${ot.georef?.direccion || ot.domicilio || 'En Obra'}`, 48, 33);

    let y = 43;
    const startX = 10;
    const colWidths = [16, 20, 75, 25, 20, 20, 20, 81]; // Total 277 mm
    const headers = ['PREP.', 'ENVIADO', 'COMPONENTE / MATERIAL / HERRAMIENTA', 'SECTOR', 'CANT.', 'EGRESAN', 'REGRESAN', 'OBSERVACIONES'];

    // Header table row
    doc.setFillColor(16, 49, 107);
    doc.rect(startX, y, 277, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let curX = startX;
    headers.forEach((h, idx) => {
      doc.text(h, curX + 2, y + 5.5);
      curX += colWidths[idx];
    });

    y += 8;

    // Filter items
    const items = getActiveOTItems().filter(i => sectorFilter === 'todos' ? true : i.detectedSector === sectorFilter);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    items.forEach((item, rowIdx) => {
      if (y > 182) {
        doc.addPage();
        y = 15;
        doc.setFillColor(16, 49, 107);
        doc.rect(startX, y, 277, 8, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        let cx = startX;
        headers.forEach((h, idx) => {
          doc.text(h, cx + 2, y + 5.5);
          cx += colWidths[idx];
        });
        y += 8;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
      }

      if (rowIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(startX, y, 277, 7, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(startX, y, 277, 7, 'S');

      curX = startX;

      // Col 1: Prep
      const isPrep = item.preparado || item.checked;
      doc.text(isPrep ? '[ X ]' : '[   ]', curX + 4, y + 5);
      curX += colWidths[0];

      // Col 2: Enviado
      doc.text(item.enviado ? '[ X ]' : '[   ]', curX + 5, y + 5);
      curX += colWidths[1];

      // Col 3: Producto
      const prodName = String(item.producto || '').substring(0, 48);
      doc.text(prodName, curX + 2, y + 5);
      curX += colWidths[2];

      // Col 4: Sector
      doc.text(String(item.detectedSector || item.sector || ''), curX + 2, y + 5);
      curX += colWidths[3];

      // Col 5: Cant Req
      doc.text(String(item.qty || 1), curX + 6, y + 5);
      curX += colWidths[4];

      // Col 6: Egresan
      doc.text(String(item.cant_egresan ?? item.qty ?? ''), curX + 6, y + 5);
      curX += colWidths[5];

      // Col 7: Regresan
      doc.text(String(item.cant_regresan ?? ''), curX + 6, y + 5);
      curX += colWidths[6];

      // Col 8: Observaciones
      const obs = String(item.observaciones || '').substring(0, 50);
      doc.text(obs, curX + 2, y + 5);

      y += 7;
    });

    // Signatures at bottom
    y = Math.max(y + 10, 172);
    if (y > 185) {
      doc.addPage();
      y = 30;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    doc.line(20, y, 85, y);
    doc.text("FIRMA RESPONSABLE CARGA / PAÑOL", 22, y + 5);

    doc.line(110, y, 175, y);
    doc.text("FIRMA CHOFER / TRANSPORTE", 118, y + 5);

    doc.line(200, y, 265, y);
    doc.text("FIRMA CONTROL RECEPCIÓN EN OBRA", 204, y + 5);

    doc.save(`Remito_Checklist_OT-${ot.ot_numero || ot.id}_${sectorFilter}.pdf`);
  };

  // Delete item from checklist
  const handleDeleteItem = async (sourceList, originalIndex) => {
    if (!activeChecklistOT) return;
    if (!window.confirm("¿Eliminar este ítem del checklist de la OT?")) return;

    const ot = { ...activeChecklistOT };
    const panol = typeof ot.panol_status === 'string' ? safeJsonParse(ot.panol_status) : { ...(ot.panol_status || { items: [] }) };
    const planta = typeof ot.planta_status === 'string' ? safeJsonParse(ot.planta_status) : { ...(ot.planta_status || { items: [] }) };

    if (sourceList === 'Pañol' && panol.items) {
      panol.items.splice(originalIndex, 1);
    } else if (sourceList === 'Planta' && planta.items) {
      planta.items.splice(originalIndex, 1);
    }

    const updatedOT = { ...ot, panol_status: panol, planta_status: planta };
    setActiveChecklistOT(updatedOT);

    try {
      setSavingChecklist(true);
      await fetch(`/api/ots/${ot.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panol_status: JSON.stringify(panol),
          planta_status: JSON.stringify(planta),
          usuario: userName || 'Sistema',
          rol: userRole || 'Operaciones'
        })
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Error al eliminar ítem:", err);
    } finally {
      setSavingChecklist(false);
    }
  };

  // Add new item manual
  const handleAddNewItem = async (e) => {
    e.preventDefault();
    if (!activeChecklistOT || !newItemName.trim()) return;

    const ot = { ...activeChecklistOT };
    const panol = typeof ot.panol_status === 'string' ? safeJsonParse(ot.panol_status) : { ...(ot.panol_status || { items: [] }) };
    panol.items = panol.items || [];

    const newItem = {
      producto: newItemName.trim(),
      qty: Number(newItemQty) || 1,
      sector: newItemSector || activeSectorTab || 'Pañol',
      checked: false
    };

    panol.items.push(newItem);

    const updatedOT = { ...ot, panol_status: panol };
    setActiveChecklistOT(updatedOT);
    setNewItemName('');
    setNewItemQty(1);

    try {
      setSavingChecklist(true);
      await fetch(`/api/ots/${ot.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panol_status: JSON.stringify(panol),
          planta_status: JSON.stringify(ot.planta_status),
          usuario: userName || 'Sistema',
          rol: userRole || 'Operaciones'
        })
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Error al agregar ítem:", err);
    } finally {
      setSavingChecklist(false);
    }
  };

  // Direct Add item from stock catalog or suggestion
  const handleDirectAddStockItem = async (stockItem, qty = 1) => {
    if (!activeChecklistOT || !stockItem) return;
    const ot = { ...activeChecklistOT };
    const panol = typeof ot.panol_status === 'string' ? safeJsonParse(ot.panol_status) : { ...(ot.panol_status || { items: [] }) };
    panol.items = panol.items || [];

    const itemSector = stockItem.sector || (activeSectorTab === 'todos' ? 'Pañol' : activeSectorTab);
    const newItem = {
      producto: stockItem.nombre,
      qty: Number(qty) || 1,
      sector: itemSector,
      checked: false
    };

    panol.items.push(newItem);

    const updatedOT = { ...ot, panol_status: panol };
    setActiveChecklistOT(updatedOT);
    setNewItemName('');
    setShowStockSuggestions(false);

    try {
      setSavingChecklist(true);
      await fetch(`/api/ots/${ot.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panol_status: JSON.stringify(panol),
          planta_status: JSON.stringify(ot.planta_status),
          usuario: userName || 'Sistema',
          rol: userRole || 'Operaciones'
        })
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Error al agregar ítem de stock:", err);
    } finally {
      setSavingChecklist(false);
    }
  };

  // Borrow item from another active OT
  const handleBorrowItemFromOT = async (e) => {
    e.preventDefault();
    if (!activeChecklistOT || !loanSourceOTId || !loanItemName.trim()) return;

    const sourceOT = ots.find(o => String(o.id) === String(loanSourceOTId));
    const targetOT = { ...activeChecklistOT };

    const panol = typeof targetOT.panol_status === 'string' ? safeJsonParse(targetOT.panol_status) : { ...(targetOT.panol_status || { items: [] }) };
    panol.items = panol.items || [];

    const label = `${loanItemName.trim()} (Prestado de OT-${sourceOT?.ot_numero || loanSourceOTId} • ${sourceOT?.cliente_nombre || 'Obra'})`;
    
    panol.items.push({
      producto: label,
      qty: Number(loanItemQty) || 1,
      sector: activeSectorTab === 'todos' ? 'Pañol' : activeSectorTab,
      checked: false,
      prestado_de_ot_id: sourceOT?.id,
      prestado_de_ot_numero: sourceOT?.ot_numero
    });

    const updatedOT = { ...targetOT, panol_status: panol };
    setActiveChecklistOT(updatedOT);
    setLoanSuccessMsg(`✅ Ítem prestado agregado con éxito desde OT-${sourceOT?.ot_numero || loanSourceOTId}`);
    setLoanItemName('');
    setLoanItemQty(1);

    try {
      setSavingChecklist(true);
      await fetch(`/api/ots/${targetOT.id}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panol_status: JSON.stringify(panol),
          planta_status: JSON.stringify(targetOT.planta_status),
          usuario: userName || 'Sistema',
          rol: userRole || 'Operaciones'
        })
      });
      if (onRefreshData) onRefreshData();
      setTimeout(() => setLoanSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Error al registrar préstamo de material:", err);
    } finally {
      setSavingChecklist(false);
    }
  };

  // 1. Load Master Personal and Recursos
  const fetchMasterResources = async () => {
    try {
      setLoadingResources(true);
      const [resP, resR] = await Promise.all([
        fetch('/api/personal'),
        fetch('/api/recursos')
      ]);
      if (resP.ok) {
        const dataP = await resP.json();
        setPersonalList(dataP.filter(p => p.activo !== false));
      }
      if (resR.ok) {
        const dataR = await resR.json();
        setRecursosList(dataR.filter(r => r.activo !== false));
      }
    } catch (err) {
      console.error("Error al cargar recursos maestros:", err);
    } finally {
      setLoadingResources(false);
    }
  };

  // Load Stock and Inventory Items for Intelligent Autocomplete with Instant Local Cache
  const fetchStockInventory = async () => {
    try {
      setLoadingStockCatalog(true);
      
      // 1. Try local cache first for instant 0ms rendering
      try {
        const cached = localStorage.getItem('dangiola_catalogo_maestro');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStockInventoryList(parsed);
          }
        }
      } catch (_) {}

      // 2. Fetch fresh data from backend
      const res = await fetch(`/api/inventario/catalogo-maestro?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setStockInventoryList(data);
          try {
            localStorage.setItem('dangiola_catalogo_maestro', JSON.stringify(data));
          } catch (_) {}
          return;
        }
      }

      // 3. Fallback: If catalogo-maestro returned empty, fetch base inventory
      const [accRes, estRes] = await Promise.all([
        fetch('/api/inventario').catch(() => null),
        fetch('/api/inventario/estructuras').catch(() => null)
      ]);
      const fallbackItems = [];
      if (accRes && accRes.ok) {
        const accs = await accRes.json();
        (accs || []).forEach(a => fallbackItems.push({
          id: `acc_${a.id}`,
          nombre: a.nombre,
          sector: a.categoria === 'lona' ? 'Lonas' : a.categoria === 'tela' ? 'Telas' : a.categoria === 'alfombra' ? 'Alfombras' : 'Pañol',
          categoria: a.categoria || 'Accesorio',
          stock_total: Number(a.stock_total || 0),
          stock_disponible: Number(a.stock_total || 0),
          origen_tabla: 'inventario_accesorios'
        }));
      }
      if (fallbackItems.length > 0) {
        setStockInventoryList(fallbackItems);
        try {
          localStorage.setItem('dangiola_catalogo_maestro', JSON.stringify(fallbackItems));
        } catch (_) {}
      }
    } catch (err) {
      console.error("Error al cargar catálogo maestro de stock:", err);
    } finally {
      setLoadingStockCatalog(false);
    }
  };

  useEffect(() => {
    fetchMasterResources();
    fetchStockInventory();
  }, []);

  useEffect(() => {
    if (showStockCatalogModal && stockInventoryList.length === 0) {
      fetchStockInventory();
    }
  }, [showStockCatalogModal]);

  // Helper normalize date string to YYYY-MM-DD
  const normalizeDateStr = (dStr) => {
    if (!dStr) return new Date().toISOString().split('T')[0];
    const s = String(dStr).trim();
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return s.substring(0, 10);
  };

  // 2. Load Daily Planning for Selected Date (with auto-inheritance)
  const fetchDayPlanning = async (date) => {
    try {
      const normDate = normalizeDateStr(date);
      const res = await fetch(`/api/planificacion/dia/${normDate}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.asignaciones) {
          const asig = typeof data.asignaciones === 'string' ? JSON.parse(data.asignaciones) : data.asignaciones;
          setDayAssignments({
            ots: asig.ots || {},
            sectores: asig.sectores || {},
            novedades: asig.novedades || {}
          });
        } else {
          setDayAssignments({ ots: {}, sectores: {}, novedades: {} });
        }
      }
      setSaveStatus('saved');
    } catch (err) {
      console.error("Error al cargar planificacion del dia:", err);
    }
  };

  // 3. Load Planta Tasks
  const fetchPlantaTasks = async (date) => {
    try {
      const normDate = normalizeDateStr(date);
      const res = await fetch(`/api/planificacion/planta/${normDate}`);
      if (res.ok) {
        const data = await res.json();
        setPlantaTareas(data?.tareas || []);
      }
    } catch (err) {
      console.error("Error al cargar tareas de planta:", err);
    }
  };

  // 4. Load Reminders
  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/planificacion/recordatorios');
      if (res.ok) {
        const data = await res.json();
        setRecordatorios(data || []);
      }
    } catch (err) {
      console.error("Error al cargar recordatorios:", err);
    }
  };

  useEffect(() => {
    fetchDayPlanning(selectedDate);
    fetchPlantaTasks(selectedDate);
    fetchReminders();
  }, [selectedDate]);

  // Polling in TV Mode
  useEffect(() => {
    if (!tvMode) return;
    const interval = setInterval(() => {
      fetchDayPlanning(selectedDate);
      fetchReminders();
    }, 4000);
    return () => clearInterval(interval);
  }, [tvMode, selectedDate]);

  // ── Auto-Save Plan Function (Real-Time)
  const autoSaveDayPlan = async (newAssignments) => {
    try {
      setSaveStatus('saving');
      const normDate = normalizeDateStr(selectedDate);
      const payload = {
        fecha: normDate,
        asignaciones: newAssignments,
        publicado: true,
        publicado_por: userName || 'Coordinación'
      };

      const res = await fetch('/api/planificacion/dia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveStatus('saved');
        // Auto-clear saved status after 3s
        setTimeout(() => setSaveStatus('saved'), 3000);
      } else {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          errMsg = errJson?.error || JSON.stringify(errJson);
        } catch(_) {}
        console.error('[AutoSave] Error del servidor:', errMsg, '| Fecha:', normDate, '| Payload keys:', Object.keys(payload));
        setSaveStatus('error');
        // Silent retry after 800ms
        setTimeout(async () => {
          try {
            const retryRes = await fetch('/api/planificacion/dia', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (retryRes.ok) {
              setSaveStatus('saved');
            } else {
              const retryErr = await retryRes.json().catch(() => ({}));
              console.error('[AutoSave] Retry failed:', retryErr?.error || retryRes.status);
              setSaveStatus('error');
            }
          } catch (e) {
            console.error('[AutoSave] Retry exception:', e.message);
            setSaveStatus('error');
          }
        }, 800);
      }
    } catch (err) {
      console.error('[AutoSave] Exception:', err.message);
      setSaveStatus('error');
    }
  };

  // ── Step 1: Events in Date Range [filterDesde, filterHasta]
  const eventosEnRango = ots.filter(ot => {
    const isAprobada = ot.estado === 'Aprobada por Gerencia' || ot.estado === 'Aprobada' || ot.estado === 'En Curso' || !ot.estado;
    if (!isAprobada) return false;
    if (!ot.fecha_inicio) return false;
    const start = ot.fecha_inicio.substring(0, 10);
    const end = (ot.fecha_fin || ot.fecha_inicio).substring(0, 10);
    return start <= filterHasta && end >= filterDesde;
  });

  // ── Step 2: Filter OTs active on selected date (Approved OTs) + Cascading selection
  const otsDelDia = ots.filter(ot => {
    const isAprobada = ot.estado === 'Aprobada por Gerencia' || ot.estado === 'Aprobada' || ot.estado === 'En Curso' || !ot.estado;
    if (!isAprobada) return false;
    if (!ot.fecha_inicio) return false;
    const start = ot.fecha_inicio.substring(0, 10);
    const end = (ot.fecha_fin || ot.fecha_inicio).substring(0, 10);
    const isActiveToday = selectedDate >= start && selectedDate <= end;
    if (!isActiveToday) return false;

    // Apply cascading selection filter (if 1 or more specific events were selected)
    if (selectedEventIds.length > 0) {
      return selectedEventIds.includes(ot.id);
    }
    return true;
  });

  // Calculate personnel and vehicle assignment status
  const getAssignedPersonalIds = () => {
    const ids = new Set();
    Object.values(dayAssignments.ots || {}).forEach(otAsig => {
      (otAsig.personal || []).forEach(p => ids.add(p.id));
    });
    Object.values(dayAssignments.sectores || {}).forEach(secAsig => {
      (secAsig.personal || []).forEach(p => ids.add(p.id));
    });
    Object.values(dayAssignments.novedades || {}).forEach(novAsig => {
      (novAsig.personal || []).forEach(p => ids.add(p.id));
    });
    return ids;
  };

  const getAssignedVehicleIds = () => {
    const ids = new Set();
    Object.values(dayAssignments.ots || {}).forEach(otAsig => {
      (otAsig.vehiculos || []).forEach(v => ids.add(v.id));
    });
    return ids;
  };

  const assignedPersonalIds = getAssignedPersonalIds();
  const assignedVehicleIds = getAssignedVehicleIds();

  // ── Drag & Drop Handlers
  const handleDragStart = (e, item, type) => {
    setDraggedItem({ type, data: item });
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id: item.id }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Helper removals
  const cleanAssignmentsForPersona = (prev, personaId) => {
    const newOts = {};
    Object.keys(prev?.ots || {}).forEach(k => {
      newOts[k] = {
        ...prev.ots[k],
        personal: (prev.ots[k]?.personal || []).filter(p => (typeof p === 'object' ? p.id : p) !== personaId)
      };
    });

    const newSectores = {};
    Object.keys(prev?.sectores || {}).forEach(k => {
      newSectores[k] = {
        ...prev.sectores[k],
        personal: (prev.sectores[k]?.personal || []).filter(p => (typeof p === 'object' ? p.id : p) !== personaId)
      };
    });

    const newNovedades = {};
    Object.keys(prev?.novedades || {}).forEach(k => {
      newNovedades[k] = {
        ...prev.novedades[k],
        personal: (prev.novedades[k]?.personal || []).filter(p => (typeof p === 'object' ? p.id : p) !== personaId)
      };
    });

    return { ots: newOts, sectores: newSectores, novedades: newNovedades };
  };

  const cleanAssignmentsForVehicle = (prev, vehiculoId) => {
    const newOts = {};
    Object.keys(prev?.ots || {}).forEach(k => {
      newOts[k] = {
        ...prev.ots[k],
        vehiculos: (prev.ots[k]?.vehiculos || []).filter(v => (typeof v === 'object' ? v.id : v) !== vehiculoId)
      };
    });
    return { ...prev, ots: newOts };
  };

  // Drop on OT Card
  const handleDropOnOT = (otId) => {
    if (!draggedItem) return;
    const key = `ot_${otId}`;
    
    let updated;
    if (draggedItem.type === 'persona') {
      const p = draggedItem.data;
      const cleaned = cleanAssignmentsForPersona(dayAssignments, p.id);
      const currentOt = cleaned.ots[key] || { personal: [], vehiculos: [], etapa: 'Armado', notas: '' };
      const currentPersonal = Array.isArray(currentOt.personal) ? currentOt.personal : [];
      const updatedPersonal = [...currentPersonal.filter(item => (typeof item === 'object' ? item.id : item) !== p.id), p];
      updated = {
        ...cleaned,
        ots: {
          ...cleaned.ots,
          [key]: { ...currentOt, personal: updatedPersonal }
        }
      };
    } else if (draggedItem.type === 'vehiculo') {
      const v = draggedItem.data;
      const cleaned = cleanAssignmentsForVehicle(dayAssignments, v.id);
      const currentOt = cleaned.ots[key] || { personal: [], vehiculos: [], etapa: 'Armado', notas: '' };
      const currentVehiculos = Array.isArray(currentOt.vehiculos) ? currentOt.vehiculos : [];
      const updatedVehiculos = [...currentVehiculos.filter(item => (typeof item === 'object' ? item.id : item) !== v.id), v];
      updated = {
        ...cleaned,
        ots: {
          ...cleaned.ots,
          [key]: { ...currentOt, vehiculos: updatedVehiculos }
        }
      };
    }

    if (updated) {
      setDayAssignments(updated);
      autoSaveDayPlan(updated);
    }
    setDraggedItem(null);
  };

  // Drop on Sector
  const handleDropOnSector = (sectorId) => {
    if (!draggedItem || draggedItem.type !== 'persona') return;
    const p = draggedItem.data;
    const cleaned = cleanAssignmentsForPersona(dayAssignments, p.id);
    const currentSec = cleaned.sectores[sectorId] || { personal: [] };
    const currentPersonal = Array.isArray(currentSec.personal) ? currentSec.personal : [];
    const updatedPersonal = [...currentPersonal.filter(item => (typeof item === 'object' ? item.id : item) !== p.id), p];
    const updated = {
      ...cleaned,
      sectores: {
        ...cleaned.sectores,
        [sectorId]: { ...currentSec, personal: updatedPersonal }
      }
    };
    setDayAssignments(updated);
    autoSaveDayPlan(updated);
    setDraggedItem(null);
  };

  // Drop on Novedad
  const handleDropOnNovedad = (novedadId) => {
    if (!draggedItem || draggedItem.type !== 'persona') return;
    const p = draggedItem.data;
    const cleaned = cleanAssignmentsForPersona(dayAssignments, p.id);
    const currentNov = cleaned.novedades[novedadId] || { personal: [] };
    const currentPersonal = Array.isArray(currentNov.personal) ? currentNov.personal : [];
    const updatedPersonal = [...currentPersonal.filter(item => (typeof item === 'object' ? item.id : item) !== p.id), p];
    const updated = {
      ...cleaned,
      novedades: {
        ...cleaned.novedades,
        [novedadId]: { ...currentNov, personal: updatedPersonal }
      }
    };
    setDayAssignments(updated);
    autoSaveDayPlan(updated);
    setDraggedItem(null);
  };

  // Remove specific item from OT
  const handleRemoveFromOT = (otId, itemId, type) => {
    const key = `ot_${otId}`;
    const current = dayAssignments.ots[key];
    if (!current) return;
    
    let updated;
    if (type === 'persona') {
      updated = {
        ...dayAssignments,
        ots: {
          ...dayAssignments.ots,
          [key]: {
            ...current,
            personal: current.personal.filter(p => p.id !== itemId)
          }
        }
      };
    } else {
      updated = {
        ...dayAssignments,
        ots: {
          ...dayAssignments.ots,
          [key]: {
            ...current,
            vehiculos: current.vehiculos.filter(v => v.id !== itemId)
          }
        }
      };
    }
    setDayAssignments(updated);
    autoSaveDayPlan(updated);
  };

  // Update OT Prop (steppers, stage, notes)
  const handleUpdateOTProp = (otId, field, value) => {
    const key = `ot_${otId}`;
    const current = dayAssignments.ots?.[key] || { personal: [], vehiculos: [], etapa: 'Armado', notas: '' };
    const cleanValue = (field === 'operarios_requeridos' || field === 'vehiculos_requeridos') 
      ? Math.max(0, parseInt(value, 10) || 0) 
      : (value || '');

    const updated = {
      ...dayAssignments,
      ots: {
        ...(dayAssignments.ots || {}),
        [key]: { ...current, [field]: cleanValue }
      }
    };
    setDayAssignments(updated);
    autoSaveDayPlan(updated);
  };

  // OT Full Save Handler (from Modal)
  const handleSaveOTFull = async (e) => {
    e.preventDefault();
    if (!editingOT) return;
    try {
      setSavingOT(true);
      const res = await fetch(`/api/ots/${editingOT.id}/full`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingOT,
          usuario: userName,
          rol: userRole
        })
      });
      if (res.ok) {
        if (onRefreshData) onRefreshData();
        setEditingOT(null);
      } else {
        alert("Error al guardar la Orden de Trabajo.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al actualizar la OT.");
    } finally {
      setSavingOT(false);
    }
  };

  // Add Planta Task
  const handleAddPlantaTask = async (titulo) => {
    if (!titulo.trim()) return;
    const newTask = { id: Date.now(), titulo: titulo.trim(), personal_estimado: 2, estado: 'Pendiente' };
    const updated = [...plantaTareas, newTask];
    setPlantaTareas(updated);
    try {
      await fetch('/api/planificacion/planta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: selectedDate, tareas: updated })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Planta Task
  const handleDeletePlantaTask = async (taskId) => {
    const updated = plantaTareas.filter(t => t.id !== taskId);
    setPlantaTareas(updated);
    try {
      await fetch('/api/planificacion/planta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: selectedDate, tareas: updated })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Add Reminder
  const handleAddReminder = async () => {
    if (!newReminderTitle.trim()) return;
    try {
      const res = await fetch('/api/planificacion/recordatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: newReminderFecha,
          titulo: newReminderTitle.trim(),
          tipo: newReminderTipo
        })
      });
      if (res.ok) {
        setNewReminderTitle('');
        fetchReminders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered Personal List
  const filteredPersonal = personalList.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.rol_funcion && p.rol_funcion.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (p.subtipo_chofer && p.subtipo_chofer.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (personalFilter === 'todos') return true;
    if (personalFilter === 'Chofer') return p.rol_funcion === 'Chofer' || (p.roles_secundarios && p.roles_secundarios.includes('Chofer'));
    if (personalFilter === 'Encargado') return p.rol_funcion === 'Supervisor' || p.rol_funcion === 'Encargado' || (p.roles_secundarios && p.roles_secundarios.includes('Encargado'));
    if (personalFilter === 'Operario') return ['Operario', 'Planta', 'Pañol'].includes(p.rol_funcion);
    if (personalFilter === 'Fijo') return p.tipo === 'Fijo' || !p.tipo;
    if (personalFilter === 'Eventual') return p.tipo === 'Eventual';
    return true;
  });

  // Filtered Recursos List
  const filteredVehiculos = recursosList.filter(r => {
    const isVehiculo = r.tipo === 'Vehículo / Camión' || r.tipo?.toLowerCase().includes('veh');
    const matchesSearch = r.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.patente_identificador && r.patente_identificador.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (r.subtipo && r.subtipo.toLowerCase().includes(searchQuery.toLowerCase()));
    return isVehiculo && matchesSearch;
  });

  // ── Alertas activas: muestra desde HOY hasta 30 días adelante (independiente del día seleccionado)
  const todayStr = new Date().toISOString().split('T')[0];
  const in30Days = new Date(); in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysStr = in30Days.toISOString().split('T')[0];
  // Alertas urgentes: vencidas o de hoy
  const urgentReminders = recordatorios.filter(r => !r.completado && r.fecha <= todayStr);
  // Alertas próximas: entre mañana y 30 días
  const upcomingReminders = recordatorios.filter(r => !r.completado && r.fecha > todayStr && r.fecha <= in30DaysStr);
  // Banner total (urgentes primero)
  const todayReminders = [...urgentReminders, ...upcomingReminders];
  const totalAlertas = todayReminders.length;

  return (
    <div className={`flex flex-col bg-slate-50 text-slate-800 transition-all ${tvMode ? 'p-3' : 'p-4 md:p-6'} space-y-5`}>
      
      {/* ── TOP HEADER / TOOLBAR INSTITUCIONAL ── */}
      <div className={`rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4 border transition-colors ${
        isNightMode ? 'bg-[#196fa9] border-[#2e88cb] text-white shadow-sky-950/40' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        
        {/* Title and Icon */}
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-2xl text-white shadow-md ${
            isNightMode ? 'bg-sky-950 border border-sky-400/30' : 'bg-blue-900 shadow-blue-900/20'
          }`}>
            <Layers className="w-6 h-6 text-sky-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-xl md:text-2xl font-black tracking-tight Poppins ${
                isNightMode ? 'text-white drop-shadow-xs' : 'text-blue-900'
              }`}>
                Planificación Operativa
              </h1>
              <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full border ${
                isNightMode ? 'bg-sky-950 text-sky-200 border-sky-400/40' : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                En Vivo
              </span>
            </div>
            <p className={`text-xs font-semibold ${isNightMode ? 'text-sky-150 opacity-85' : 'text-slate-500'}`}>
              Asignación interactiva de personal y flota a proyectos aprobados
            </p>
          </div>
        </div>

        {/* Date Stepper */}
        <div className={`flex items-center gap-2 p-1.5 rounded-2xl border ${
          isNightMode ? 'bg-[#145d8f] border-[#297bb9]' : 'bg-slate-100 border-slate-200'
        }`}>
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isNightMode ? 'text-sky-200 hover:text-white hover:bg-sky-900/60' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
            }`}
            title="Día Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={`border text-xs font-black px-3 py-1.5 rounded-xl shadow-xs outline-none cursor-pointer ${
              isNightMode ? 'bg-sky-950 border-sky-400/50 text-white font-mono' : 'bg-white border-slate-200 text-blue-900'
            }`}
          />

          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isNightMode ? 'text-sky-200 hover:text-white hover:bg-sky-900/60' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
            }`}
            title="Día Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer shadow-xs ${
              isNightMode ? 'bg-sky-900/80 hover:bg-sky-800 text-white border-sky-400/40' : 'bg-white hover:bg-blue-50 text-blue-900 border-slate-200'
            }`}
          >
            Hoy
          </button>
        </div>

        {/* Navigation & Real-time Status */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Selector de Modo de Vista: Día, Semana, Mes */}
          {onChangeViewMode && (
            <div className={`flex items-center p-1 rounded-2xl border ${
              isNightMode ? 'bg-[#145d8f] border-[#297bb9]' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => onChangeViewMode('diaria')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                  viewMode === 'diaria'
                    ? isNightMode ? 'bg-sky-400 text-sky-950 shadow-md font-black' : 'bg-blue-900 text-white shadow-xs'
                    : isNightMode ? 'text-sky-200 hover:text-white hover:bg-sky-900/50' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
                }`}
              >
                Día
              </button>
              <button
                type="button"
                onClick={() => onChangeViewMode('semanal')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                  viewMode === 'semanal'
                    ? isNightMode ? 'bg-sky-400 text-sky-950 shadow-md font-black' : 'bg-blue-900 text-white shadow-xs'
                    : isNightMode ? 'text-sky-200 hover:text-white hover:bg-sky-900/50' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
                }`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => onChangeViewMode('mensual')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                  viewMode === 'mensual'
                    ? isNightMode ? 'bg-sky-400 text-sky-950 shadow-md font-black' : 'bg-blue-900 text-white shadow-xs'
                    : isNightMode ? 'text-sky-200 hover:text-white hover:bg-sky-900/50' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
                }`}
              >
                Mes
              </button>
            </div>
          )}

          {/* Sub-view Navigation */}
          <div className={`flex items-center p-1 rounded-2xl border ${
            isNightMode ? 'bg-[#145d8f] border-[#297bb9]' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveTab('cronograma')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'cronograma' 
                  ? isNightMode ? 'bg-sky-400 text-sky-950 font-black shadow-xs' : 'bg-blue-900 text-white shadow-sm' 
                  : isNightMode ? 'text-sky-200 hover:text-white' : 'text-slate-600 hover:text-blue-900'
              }`}
            >
              Cronograma Diario
            </button>
            <button
              onClick={() => setActiveTab('proyeccion_planta')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'proyeccion_planta' 
                  ? isNightMode ? 'bg-sky-400 text-sky-950 font-black shadow-xs' : 'bg-blue-900 text-white shadow-sm' 
                  : isNightMode ? 'text-sky-200 hover:text-white' : 'text-slate-600 hover:text-blue-900'
              }`}
            >
              Proyección Planta
            </button>
            <button
              onClick={() => setActiveTab('recordatorios')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'recordatorios' 
                  ? isNightMode ? 'bg-sky-400 text-sky-950 font-black shadow-xs' : 'bg-blue-900 text-white shadow-sm' 
                  : isNightMode ? 'text-sky-200 hover:text-white' : 'text-slate-600 hover:text-blue-900'
              }`}
            >
              <Bell className="w-3 h-3" />
              Alertas ({recordatorios.length})
              {totalAlertas > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black bg-rose-500 text-white leading-none shadow-sm">
                  {totalAlertas > 9 ? '9+' : totalAlertas}
                </span>
              )}
            </button>
          </div>

          {/* Botón de Chat en Vivo de OTs */}
          <button
            type="button"
            onClick={() => {
              const defaultOT = otsDelDia[0] || ots[0] || null;
              setActiveChatOT(defaultOT);
              setChatDrawerOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-2xl border transition cursor-pointer shadow-2xs ${
              isNightMode ? 'bg-sky-950 text-sky-200 border-sky-400/40 hover:bg-sky-900' : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
            }`}
            title="Abrir Chat de Coordinación en Vivo de OTs"
          >
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline font-black uppercase tracking-wider">Chat en Vivo</span>
          </button>

          {/* Botón Modo Noche */}
          <button
            type="button"
            onClick={toggleNightMode}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wider rounded-2xl transition cursor-pointer shadow-xs ${
              isNightMode
                ? 'bg-sky-950 text-sky-200 border-2 border-sky-400/70 hover:bg-sky-900 shadow-sky-950/60 ring-2 ring-sky-400/30'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
            }`}
            title={isNightMode ? 'Desactivar Modo Noche' : 'Activar Modo Noche (Colores Suaves Oceánicos)'}
          >
            {isNightMode ? (
              <>
                <Moon className="w-4 h-4 text-sky-300 fill-sky-300" />
                <span className="hidden sm:inline">Modo Noche</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">Modo Noche</span>
              </>
            )}
          </button>

          {/* TV Mode Toggle */}
          <button
            onClick={() => setTvMode(!tvMode)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-2xl border transition cursor-pointer ${
              tvMode 
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md' 
                : isNightMode ? 'bg-sky-950 text-sky-200 border-sky-400/40 hover:bg-sky-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Modo Pantalla Gigante / TV para Planta y Depósito"
          >
            <Tv className="w-4 h-4" />
            <span className="hidden sm:inline">{tvMode ? 'Salir TV' : 'Modo TV'}</span>
          </button>

          {/* Live Auto-Save Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold border ${
            isNightMode ? 'bg-sky-950/80 border-sky-400/40 text-sky-200' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-700 animate-spin" />
                <span className="text-blue-800">Guardando...</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span className="text-rose-700">Error al guardar</span>
                <button
                  onClick={() => autoSaveDayPlan(dayAssignments)}
                  className="ml-1 text-[10px] underline text-rose-600 hover:text-rose-800 cursor-pointer font-black"
                  title="Reintentar guardado"
                >
                  Reintentar
                </button>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700">Auto-guardado activo</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTRO EN CASCADA (DESDE - HASTA → SELECCIÓN DE EVENTOS) ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Paso 1: Fechas Desde / Hasta con Presets Día, Semana, Mes */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-blue-900 tracking-wider Poppins">
              <Filter className="w-4 h-4 text-blue-900" />
              <span>1. Filtro:</span>
            </div>

            {/* Presets Día / Semana / Mes */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => applyPresetFilter('dia')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  filterPreset === 'dia'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-900 hover:bg-white'
                }`}
                title="Filtrar solo el día seleccionado"
              >
                Día
              </button>
              <button
                type="button"
                onClick={() => applyPresetFilter('semana')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  filterPreset === 'semana'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-900 hover:bg-white'
                }`}
                title="Filtrar los eventos de toda la semana"
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => applyPresetFilter('mes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  filterPreset === 'mes'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-900 hover:bg-white'
                }`}
                title="Filtrar los eventos de todo el mes"
              >
                Mes
              </button>
            </div>

            {/* Selector manual Desde / Hasta */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500 pl-1">Desde:</span>
              <input
                type="date"
                value={filterDesde}
                onChange={(e) => {
                  setFilterDesde(e.target.value);
                  setFilterPreset('custom');
                }}
                className="bg-white border border-slate-200 text-xs font-bold text-blue-900 px-2.5 py-1 rounded-xl shadow-2xs outline-none cursor-pointer"
              />
              <span className="text-[11px] font-bold text-slate-500">Hasta:</span>
              <input
                type="date"
                value={filterHasta}
                onChange={(e) => {
                  setFilterHasta(e.target.value);
                  setFilterPreset('custom');
                }}
                className="bg-white border border-slate-200 text-xs font-bold text-blue-900 px-2.5 py-1 rounded-xl shadow-2xs outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Paso 2: Selección en Cascada de Eventos del Rango */}
          <div className="relative flex-1 min-w-[280px]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins whitespace-nowrap">
                2. Eventos ({eventosEnRango.length}):
              </span>

              {/* Dropdown Toggle Button */}
              <button
                type="button"
                onClick={() => setShowEventDropdown(!showEventDropdown)}
                className="flex-1 flex items-center justify-between gap-2 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 px-3.5 py-2 rounded-2xl text-xs font-bold text-slate-800 transition cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-900" />
                  <span className="truncate">
                    {selectedEventIds.length === 0 
                      ? `Todos los eventos del rango (${eventosEnRango.length})` 
                      : `${selectedEventIds.length} de ${eventosEnRango.length} evento(s) seleccionado(s)`
                    }
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showEventDropdown ? 'rotate-180' : ''}`} />
              </button>

              {selectedEventIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedEventIds([])}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-2xl transition cursor-pointer whitespace-nowrap"
                  title="Mostrar todos los eventos del rango"
                >
                  Ver Todos
                </button>
              )}
            </div>

            {/* Dropdown Popover */}
            {showEventDropdown && (
              <div className="absolute left-0 right-0 top-12 bg-white border border-slate-200 rounded-3xl p-4 shadow-xl z-40 space-y-3 mt-1 max-h-[350px] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={eventFilterSearch}
                      onChange={(e) => setEventFilterSearch(e.target.value)}
                      placeholder="Buscar por cliente, número OT o modelo..."
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl pl-8 pr-3 py-1.5 outline-none focus:bg-white focus:border-blue-900"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedEventIds(eventosEnRango.map(e => e.id))}
                      className="px-2.5 py-1.5 bg-blue-50 text-blue-900 hover:bg-blue-100 rounded-xl text-[10px] font-black uppercase transition cursor-pointer"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEventIds([])}
                      className="px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase transition cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {eventosEnRango.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400 font-semibold">
                      No hay eventos en el rango de fechas seleccionado.
                    </div>
                  ) : (
                    eventosEnRango
                      .filter(e => {
                        const q = eventFilterSearch.toLowerCase();
                        return (e.cliente_nombre || '').toLowerCase().includes(q) ||
                               (`OT-${e.ot_numero || e.id}`).toLowerCase().includes(q) ||
                               (e.modelo_estructura || '').toLowerCase().includes(q);
                      })
                      .map(ev => {
                        const isSelected = selectedEventIds.includes(ev.id);
                        return (
                          <div
                            key={ev.id}
                            className={`p-2.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                              isSelected 
                                ? 'bg-blue-50/70 border-blue-200 text-blue-950 font-bold' 
                                : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-700'
                            }`}
                          >
                            <label className="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEventIds(prev => [...prev, ev.id]);
                                  } else {
                                    setSelectedEventIds(prev => prev.filter(id => id !== ev.id));
                                  }
                                }}
                                className="w-4 h-4 text-blue-900 rounded border-slate-300 focus:ring-blue-900 cursor-pointer"
                              />
                              <div>
                                <div className="text-xs font-black flex items-center gap-1.5">
                                  <span className="text-blue-900 font-mono">OT-{ev.ot_numero || ev.id}</span>
                                  <span>•</span>
                                  <span>{ev.cliente_nombre || 'Sin Cliente'}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-semibold">
                                  {ev.modelo_estructura} ({ev.frente}x{ev.largo}m) • {ev.fecha_inicio?.substring(0, 10)} al {ev.fecha_fin?.substring(0, 10)}
                                </div>
                              </div>
                            </label>

                            {/* Quick Jump to Date */}
                            <button
                              type="button"
                              onClick={() => {
                                if (ev.fecha_inicio) {
                                  setSelectedDate(ev.fecha_inicio.substring(0, 10));
                                  if (!selectedEventIds.includes(ev.id)) {
                                    setSelectedEventIds([ev.id]);
                                  }
                                  setShowEventDropdown(false);
                                }
                              }}
                              className="px-2 py-1 bg-white hover:bg-blue-900 hover:text-white text-blue-900 border border-slate-200 rounded-xl text-[10px] font-bold transition cursor-pointer shadow-2xs whitespace-nowrap"
                              title="Navegar el calendario a la fecha de inicio de esta OT"
                            >
                              📅 Ir a Fecha
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Event Chips */}
        {selectedEventIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Filtrando por:</span>
            {selectedEventIds.map(id => {
              const ev = ots.find(o => o.id === id);
              if (!ev) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs"
                >
                  <span>OT-{ev.ot_numero || ev.id} ({ev.cliente_nombre})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedEventIds(prev => prev.filter(x => x !== id))}
                    className="text-blue-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── REMINDERS BANNER — Vencimientos próximos (30 días) + urgentes ── */}
      {totalAlertas > 0 && (
        <div className={`p-3.5 rounded-2xl border shadow-xs ${
          urgentReminders.length > 0
            ? 'bg-rose-50 border-rose-300'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Bell className={`w-4 h-4 animate-bounce ${
                urgentReminders.length > 0 ? 'text-rose-600' : 'text-amber-600'
              }`} />
              <div className="flex flex-col gap-0.5">
                {urgentReminders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-rose-800">
                      🚨 {urgentReminders.length} Alerta{urgentReminders.length > 1 ? 's' : ''} Urgente{urgentReminders.length > 1 ? 's' : ''}:
                    </span>
                    <span className="text-[11px] font-semibold text-rose-700">
                      {urgentReminders.slice(0, 2).map(r => r.titulo).join(' • ')}
                      {urgentReminders.length > 2 ? ` y ${urgentReminders.length - 2} más...` : ''}
                    </span>
                  </div>
                )}
                {upcomingReminders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                      ⏰ {upcomingReminders.length} Vencimiento{upcomingReminders.length > 1 ? 's' : ''} próximo{upcomingReminders.length > 1 ? 's' : ''} (30 días):
                    </span>
                    <span className="text-[11px] font-semibold text-amber-700">
                      {upcomingReminders.slice(0, 2).map(r => `${r.titulo} (${r.fecha})`).join(' • ')}
                      {upcomingReminders.length > 2 ? ` y ${upcomingReminders.length - 2} más...` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveTab('recordatorios')}
              className={`text-[11px] font-black underline cursor-pointer whitespace-nowrap ${
                urgentReminders.length > 0 ? 'text-rose-700 hover:text-rose-900' : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              Ver todas las alertas →
            </button>
          </div>
        </div>
      )}

      {/* ── VIEW 1: CRONOGRAMA DIARIO INTERACTIVO (DRAG & DROP) ── */}
      {activeTab === 'cronograma' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT: BANCO DE PERSONAL Y VEHÍCULOS (3 COLS) */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-4.5 flex flex-col gap-4 shadow-xs sticky top-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-blue-900" />
                <h2 className="font-black text-sm text-blue-900 uppercase tracking-wider Poppins">Banco de Recursos</h2>
              </div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {resourceTab === 'personal' 
                  ? `${personalList.length - assignedPersonalIds.size} disp. / ${personalList.length}`
                  : `${recursosList.length - assignedVehicleIds.size} disp. / ${recursosList.length}`
                }
              </span>
            </div>

            {/* Tab switch: Personal vs Vehículos */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl">
              <button
                onClick={() => setResourceTab('personal')}
                className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  resourceTab === 'personal' 
                    ? 'bg-white text-blue-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Personal ({personalList.length})</span>
              </button>

              <button
                onClick={() => setResourceTab('vehiculos')}
                className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  resourceTab === 'vehiculos' 
                    ? 'bg-white text-blue-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Flota ({recursosList.length})</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={resourceTab === 'personal' ? "Buscar persona o rol..." : "Buscar vehículo o patente..."}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 outline-none focus:border-blue-900 focus:bg-white transition"
              />
            </div>

            {/* Quick Filters for Personal */}
            {resourceTab === 'personal' && (
              <div className="flex flex-wrap gap-1">
                {['todos', 'Chofer', 'Encargado', 'Operario', 'Fijo', 'Eventual'].map(f => (
                  <button
                    key={f}
                    onClick={() => setPersonalFilter(f)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                      personalFilter === f 
                        ? 'bg-blue-900 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'todos' ? 'Todos' : f}
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable Resource Cards */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[50vh]">
              {resourceTab === 'personal' ? (
                filteredPersonal.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No se encontraron personas con ese criterio.
                  </div>
                ) : (
                  filteredPersonal.map(persona => {
                    const isAssigned = assignedPersonalIds.has(persona.id);
                    return (
                      <div
                        key={persona.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, persona, 'persona')}
                        className={`p-2.5 rounded-2xl border transition-all select-none cursor-grab active:cursor-grabbing flex items-center justify-between ${
                          isAssigned 
                            ? 'bg-slate-50 border-slate-200 opacity-60' 
                            : 'bg-white hover:bg-blue-50/50 border-slate-200 hover:border-blue-300 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                            persona.rol_funcion === 'Chofer' ? 'bg-amber-100 text-amber-800' :
                            persona.rol_funcion === 'Encargado' || persona.rol_funcion === 'Supervisor' ? 'bg-purple-100 text-purple-800' :
                            'bg-blue-100 text-blue-900'
                          }`}>
                            {persona.nombre.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{persona.nombre}</div>
                            <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                              <span>{persona.rol_funcion || 'Operario'}</span>
                              <span>•</span>
                              <span className={persona.tipo === 'Eventual' ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                                {persona.tipo || 'Fijo'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isAssigned ? (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Asignado
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">Arrastrar →</span>
                        )}
                      </div>
                    );
                  })
                )
              ) : (
                filteredVehiculos.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No se encontraron vehículos.
                  </div>
                ) : (
                  filteredVehiculos.map(vehiculo => {
                    const isAssigned = assignedVehicleIds.has(vehiculo.id);
                    return (
                      <div
                        key={vehiculo.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, vehiculo, 'vehiculo')}
                        className={`p-2.5 rounded-2xl border transition-all select-none cursor-grab active:cursor-grabbing flex items-center justify-between ${
                          isAssigned 
                            ? 'bg-slate-50 border-slate-200 opacity-60' 
                            : 'bg-white hover:bg-emerald-50/50 border-slate-200 hover:border-emerald-300 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
                            🚚
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{vehiculo.nombre}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">
                              {vehiculo.patente_identificador || 'S/Patente'} {vehiculo.subtipo ? `• ${vehiculo.subtipo}` : ''}
                            </div>
                          </div>
                        </div>

                        {isAssigned ? (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> En viaje
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">Arrastrar →</span>
                        )}
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>

          {/* CENTER: OTS ACTIVAS DEL DÍA (6 COLS) */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4.5 h-4.5 text-blue-900" />
                <h2 className="font-black text-sm text-blue-900 uppercase tracking-wider Poppins">
                  Órdenes de Trabajo del Día ({otsDelDia.length})
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                Arrastra personal y camiones directamente a cada obra
              </span>
            </div>

            {otsDelDia.length === 0 ? (
              <div className="p-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3 shadow-xs">
                <CalendarIcon className="w-10 h-10 text-slate-300" />
                <div className="text-slate-700 font-black text-sm">No hay OTs aprobadas programadas para esta fecha.</div>
                <p className="text-xs text-slate-400 max-w-sm font-semibold">
                  Las órdenes de trabajo aprobadas que coincidan con la fecha aparecerán aquí de forma automática.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {otsDelDia.map(ot => {
                  const key = `ot_${ot.id}`;
                  const asig = dayAssignments.ots[key] || { personal: [], vehiculos: [], etapa: 'Armado', notas: '' };
                  const personalAsignado = asig.personal || [];
                  const vehiculosAsignados = asig.vehiculos || [];
                  
                  // Dotación requerida: configurable por el usuario o calculada por defecto
                  const defaultOperarios = Math.max(2, Math.ceil((ot.superficie || 100) / 75));
                  const defaultVehiculos = 1;
                  const operariosEstimados = asig.operarios_requeridos !== undefined ? asig.operarios_requeridos : defaultOperarios;
                  const vehiculosEstimados = asig.vehiculos_requeridos !== undefined ? asig.vehiculos_requeridos : defaultVehiculos;
                  
                  const choferesAsignados = personalAsignado.filter(p => p.rol_funcion === 'Chofer' || (p.roles_secundarios && p.roles_secundarios.includes('Chofer'))).length;
                  const dotacionCompleta = personalAsignado.length >= operariosEstimados && (vehiculosAsignados.length >= vehiculosEstimados || choferesAsignados >= vehiculosEstimados);

                  return (
                    <div
                      key={ot.id}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnOT(ot.id)}
                      className={`bg-white border rounded-3xl p-5 shadow-xs transition-all ${
                        dotacionCompleta 
                          ? 'border-emerald-300 ring-2 ring-emerald-100' 
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {/* OT Top Row */}
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-blue-900 tracking-wide font-mono">
                              OT-{ot.ot_numero || ot.id}
                            </span>
                            <span className="text-sm font-black text-slate-800">
                              {ot.cliente_nombre || 'Cliente sin nombre'}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              ot.estado === 'Aprobada por Gerencia' || ot.estado === 'Aprobada' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                              'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {ot.estado}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 font-semibold">
                            <span className="flex items-center gap-1 text-slate-700">
                              <Layers className="w-3.5 h-3.5 text-slate-400" />
                              {ot.modelo_estructura} ({ot.frente}x{ot.largo}m • {ot.superficie} m²)
                            </span>
                            {ot.georef?.direccion && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {ot.georef.direccion}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Etapa Selector & Quick Action Buttons */}
                        <div className="flex items-center gap-2">
                          <select
                            value={asig.etapa || 'Armado'}
                            onChange={(e) => handleUpdateOTProp(ot.id, 'etapa', e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-xs font-bold text-blue-900 px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                          >
                            {ETAPAS_OT.map(e => (
                              <option key={e} value={e}>{e}</option>
                            ))}
                          </select>

                          {/* Botón de Chat en Vivo de la OT */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChatOT(ot);
                              setChatDrawerOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl transition cursor-pointer border border-blue-200 text-xs font-bold shadow-2xs"
                            title="Abrir Chat de Coordinación en Vivo de esta OT"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-blue-800" />
                            <span>Chat</span>
                          </button>

                          {/* Quick Edit Full OT */}
                          <button
                            onClick={() => setEditingOT(ot)}
                            className="p-2 bg-slate-100 hover:bg-blue-50 text-blue-900 rounded-xl transition cursor-pointer border border-slate-200"
                            title="Editar OT Completa (fechas, medidas, adicionales)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Dotación Alertas & Controles Modificables */}
                      <div className="flex flex-wrap items-center justify-between gap-3 my-3 px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex flex-wrap items-center gap-4">
                          
                          {/* Modificador de Operarios Requeridos */}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">Operarios:</span>
                            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                              <button
                                onClick={() => handleUpdateOTProp(ot.id, 'operarios_requeridos', Math.max(1, operariosEstimados - 1))}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg font-bold transition text-xs cursor-pointer"
                                title="Disminuir operarios requeridos"
                              >
                                -
                              </button>
                              <span className={`px-2 text-xs font-black ${
                                personalAsignado.length >= operariosEstimados ? 'text-emerald-700' : 'text-amber-700'
                              }`}>
                                {personalAsignado.length} / {operariosEstimados}
                              </span>
                              <button
                                onClick={() => handleUpdateOTProp(ot.id, 'operarios_requeridos', operariosEstimados + 1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg font-bold transition text-xs cursor-pointer"
                                title="Aumentar operarios requeridos"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Modificador de Vehículos Requeridos */}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">Vehículos:</span>
                            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                              <button
                                onClick={() => handleUpdateOTProp(ot.id, 'vehiculos_requeridos', Math.max(0, vehiculosEstimados - 1))}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg font-bold transition text-xs cursor-pointer"
                                title="Disminuir vehículos requeridos"
                              >
                                -
                              </button>
                              <span className={`px-2 text-xs font-black ${
                                vehiculosAsignados.length >= vehiculosEstimados ? 'text-emerald-700' : 'text-amber-700'
                              }`}>
                                {vehiculosAsignados.length} / {vehiculosEstimados}
                              </span>
                              <button
                                onClick={() => handleUpdateOTProp(ot.id, 'vehiculos_requeridos', vehiculosEstimados + 1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg font-bold transition text-xs cursor-pointer"
                                title="Aumentar vehículos requeridos"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {dotacionCompleta ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> Dotación Completa
                          </span>
                        ) : (
                          <span className="text-amber-800 font-bold flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5" /> Faltan Recursos
                          </span>
                        )}
                      </div>

                      {/* Drop Zones Container */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        
                        {/* Drop Zone: Personal Asignado */}
                        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 min-h-[90px] flex flex-col justify-between">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                            <span>Operarios y Cuadrilla</span>
                            <span>{personalAsignado.length} asignados</span>
                          </div>

                          {personalAsignado.length === 0 ? (
                            <div className="text-center py-3 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-xl">
                              Arrastra personas aquí
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {personalAsignado.map(p => (
                                <span
                                  key={p.id}
                                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-800 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs group"
                                >
                                  <span>{p.nombre}</span>
                                  {p.rol_funcion === 'Chofer' && <span className="text-[9px] text-amber-700 font-black">🚚</span>}
                                  <button
                                    onClick={() => handleRemoveFromOT(ot.id, p.id, 'persona')}
                                    className="text-slate-300 hover:text-rose-600 transition cursor-pointer"
                                    title="Quitar"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Drop Zone: Vehículos Asignados */}
                        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 min-h-[90px] flex flex-col justify-between">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                            <span>Vehículos / Camiones</span>
                            <span>{vehiculosAsignados.length} asignados</span>
                          </div>

                          {vehiculosAsignados.length === 0 ? (
                            <div className="text-center py-3 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-xl">
                              Arrastra camión o furgón aquí
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {vehiculosAsignados.map(v => (
                                <span
                                  key={v.id}
                                  className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs group"
                                >
                                  <span>🚚 {v.nombre}</span>
                                  {v.patente_identificador && (
                                    <span className="text-[9px] text-emerald-700 font-mono">({v.patente_identificador})</span>
                                  )}
                                  <button
                                    onClick={() => handleRemoveFromOT(ot.id, v.id, 'vehiculo')}
                                    className="text-emerald-400 hover:text-rose-600 transition cursor-pointer"
                                    title="Quitar"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sector Checklists & Material Explosion Quick Buttons */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-blue-900" />
                            <span>Checklists y Materiales por Sector:</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenChecklistModal(ot, 'todos')}
                            className="text-[10px] font-bold text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Ver Todo</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {SECTORES_INTERNOS.map(sec => {
                            // Extract items of this sector for this OT
                            const allItems = [];
                            const panol = typeof ot.panol_status === 'string' ? safeJsonParse(ot.panol_status) : (ot.panol_status || {});
                            const planta = typeof ot.planta_status === 'string' ? safeJsonParse(ot.planta_status) : (ot.planta_status || {});
                            (panol.items || []).forEach(i => allItems.push({ ...i, detSec: getSectorForItem(i) }));
                            (planta.items || []).forEach(i => allItems.push({ ...i, detSec: getSectorForItem(i) }));

                            const secItems = allItems.filter(i => i.detSec === sec.id);
                            const checkedCount = secItems.filter(i => i.checked).length;
                            const isComplete = secItems.length > 0 && checkedCount === secItems.length;

                            return (
                              <button
                                key={sec.id}
                                type="button"
                                onClick={() => handleOpenChecklistModal(ot, sec.id)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black transition cursor-pointer border shadow-2xs hover:scale-[1.03] ${
                                  secItems.length === 0
                                    ? 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300'
                                    : isComplete
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                      : 'bg-blue-50 text-blue-950 border-blue-200 hover:bg-blue-100'
                                }`}
                                title={`Abrir checklist y explosión de materiales de ${sec.nombre} para OT-${ot.ot_numero || ot.id}`}
                              >
                                <span>{sec.icon}</span>
                                <span>{sec.nombre}</span>
                                {secItems.length > 0 ? (
                                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded-md ${
                                    isComplete ? 'bg-emerald-200 text-emerald-950 font-black' : 'bg-blue-200/80 text-blue-950'
                                  }`}>
                                    {checkedCount}/{secItems.length}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-mono">+</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Observations / Notes for this OT on this day */}
                      <div className="mt-3">
                        <input
                          type="text"
                          value={asig.notas || ''}
                          onChange={(e) => handleUpdateOTProp(ot.id, 'notas', e.target.value)}
                          placeholder="Notas del día para esta obra (ej. llegada 8:00hs, llevar estacas especiales)..."
                          className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl px-3 py-1.5 text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-blue-900 transition"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: SECTORES INTERNOS Y AUSENCIAS (3 COLS) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            
            {/* SECTORES INTERNOS */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4.5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-900" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-blue-900 Poppins">
                    Sectores Internos
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {SECTORES_INTERNOS.length} sectores
                </span>
              </div>

              <div className="space-y-2.5">
                {SECTORES_INTERNOS.map(sec => {
                  const secAsig = dayAssignments.sectores[sec.id] || { personal: [] };
                  const personalEnSector = secAsig.personal || [];
                  const defaultOT = otsDelDia[0] || ots[0];

                  return (
                    <div
                      key={sec.id}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnSector(sec.id)}
                      className="p-3 bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-2xl transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                          <span>{sec.icon}</span>
                          <span>{sec.nombre}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {defaultOT && (
                            <button
                              type="button"
                              onClick={() => handleOpenChecklistModal(defaultOT, sec.id)}
                              className="px-2 py-0.5 bg-white hover:bg-blue-900 hover:text-white border border-slate-200 text-blue-900 rounded-lg text-[9px] font-black uppercase transition cursor-pointer shadow-2xs flex items-center gap-1"
                              title={`Ver explosión de materiales y checklist de ${sec.nombre}`}
                            >
                              <Package className="w-2.5 h-2.5" />
                              <span>Checklist</span>
                            </button>
                          )}
                          <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                            {personalEnSector.length}
                          </span>
                        </div>
                      </div>

                      {personalEnSector.length === 0 ? (
                        <div className="text-[10px] text-slate-400 font-semibold">
                          Soltar personal para asignar a taller
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {personalEnSector.map(p => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-2xs"
                            >
                              <span>{p.nombre}</span>
                              <button
                                onClick={() => {
                                  const updated = {
                                    ...dayAssignments,
                                    sectores: {
                                      ...dayAssignments.sectores,
                                      [sec.id]: {
                                        personal: personalEnSector.filter(item => item.id !== p.id)
                                      }
                                    }
                                  };
                                  setDayAssignments(updated);
                                  autoSaveDayPlan(updated);
                                }}
                                className="text-slate-300 hover:text-rose-600 transition cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NOVEDADES Y AUSENCIAS */}
            <div className="bg-white border border-slate-200 rounded-3xl p-4.5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                <Shield className="w-4 h-4 text-amber-700" />
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 Poppins">
                  Novedades y Ausencias
                </h3>
              </div>

              <div className="space-y-2">
                {NOVEDADES_AUSENCIAS.map(nov => {
                  const novAsig = dayAssignments.novedades[nov.id] || { personal: [] };
                  const personalEnNovedad = novAsig.personal || [];
                  return (
                    <div
                      key={nov.id}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnNovedad(nov.id)}
                      className={`p-2.5 border rounded-2xl transition ${nov.color}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <span>{nov.icon}</span>
                          <span>{nov.nombre}</span>
                        </div>
                        <span className="text-[10px] font-black bg-white px-1.5 py-0.5 rounded-md border">
                          {personalEnNovedad.length}
                        </span>
                      </div>

                      {personalEnNovedad.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {personalEnNovedad.map(p => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-2xs"
                            >
                              <span>{p.nombre}</span>
                              <button
                                onClick={() => {
                                  const updated = {
                                    ...dayAssignments,
                                    novedades: {
                                      ...dayAssignments.novedades,
                                      [nov.id]: {
                                        personal: personalEnNovedad.filter(item => item.id !== p.id)
                                      }
                                    }
                                  };
                                  setDayAssignments(updated);
                                  autoSaveDayPlan(updated);
                                }}
                                className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: EXPLOSIÓN DE MATERIALES Y CHECKLIST DE SECTORES ── */}
      {checklistModalOpen && activeChecklistOT && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header del Modal */}
            <div className="bg-slate-50 p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-900 text-white rounded-2xl shadow-md shadow-blue-900/20">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-blue-900 uppercase tracking-wider Poppins">
                      Explosión de Materiales y Checklists
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Enlace OT
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold">
                    Control de carga, pañol, bulonería, lonas, herrería y préstamos entre obras
                  </p>
                </div>
              </div>

              {/* Selector de OT Activa y Botón Cerrar */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl shadow-2xs">
                  <span className="text-xs font-black text-slate-400">OT:</span>
                  <select
                    value={activeChecklistOT.id}
                    onChange={(e) => {
                      const selected = ots.find(o => String(o.id) === e.target.value);
                      if (selected) setActiveChecklistOT(selected);
                    }}
                    className="bg-transparent text-xs font-black text-blue-900 outline-none cursor-pointer"
                  >
                    {ots.map(o => (
                      <option key={o.id} value={o.id}>
                        OT-{o.ot_numero || o.id} • {o.cliente_nombre || 'Obra'} ({o.modelo_estructura})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setChecklistModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Subheader: Info de la OT Seleccionada */}
            <div className="bg-blue-50/50 px-6 py-3 border-b border-blue-100/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4 font-semibold text-slate-700">
                <span className="flex items-center gap-1.5 text-blue-900 font-black">
                  <span className="font-mono text-sm">OT-{activeChecklistOT.ot_numero || activeChecklistOT.id}</span>
                  <span>•</span>
                  <span>{activeChecklistOT.cliente_nombre}</span>
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeChecklistOT.modelo_estructura} ({activeChecklistOT.frente}x{activeChecklistOT.largo}m • {activeChecklistOT.superficie} m²)</span>
                </span>
                {activeChecklistOT.georef?.direccion && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[200px]">{activeChecklistOT.georef.direccion}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Fechas:</span>
                <span className="text-[11px] font-bold text-slate-700">
                  {activeChecklistOT.fecha_inicio?.substring(0, 10)} al {activeChecklistOT.fecha_fin?.substring(0, 10)}
                </span>
              </div>
            </div>

            {/* Pestañas de Sectores */}
            <div className="px-6 pt-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveSectorTab('todos');
                  setNewItemSector('Pañol');
                }}
                className={`px-3 py-2 rounded-t-2xl text-xs font-black uppercase tracking-wider transition border-b-2 cursor-pointer ${
                  activeSectorTab === 'todos'
                    ? 'border-blue-900 text-blue-900 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                📋 Todos los Sectores ({getActiveOTItems().length})
              </button>

              {SECTORES_INTERNOS.map(sec => {
                const itemsOfSec = getActiveOTItems().filter(i => i.detectedSector === sec.id);
                const checkedSec = itemsOfSec.filter(i => i.checked).length;
                const isComplete = itemsOfSec.length > 0 && checkedSec === itemsOfSec.length;

                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setActiveSectorTab(sec.id);
                      setNewItemSector(sec.id);
                    }}
                    className={`px-3 py-2 rounded-t-2xl text-xs font-black uppercase tracking-wider transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      activeSectorTab === sec.id
                        ? 'border-blue-900 text-blue-900 bg-blue-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>{sec.icon}</span>
                    <span>{sec.nombre}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                      isComplete 
                        ? 'bg-emerald-100 text-emerald-900 font-bold' 
                        : activeSectorTab === sec.id 
                          ? 'bg-blue-100 text-blue-900' 
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      {checkedSec}/{itemsOfSec.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sub-Header: Filtro y Botón Préstamo */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={checklistSearch}
                  onChange={(e) => setChecklistSearch(e.target.value)}
                  placeholder="Filtrar materiales por nombre (ej. Bulones, Cables, Lona, Estacas)..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-900 shadow-2xs"
                />
              </div>

              {/* Botón para Abrir / Cerrar Sección Préstamo entre OTs */}
              <button
                type="button"
                onClick={() => setShowLoanSection(!showLoanSection)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border shadow-2xs ${
                  showLoanSection 
                    ? 'bg-amber-100 text-amber-900 border-amber-300' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-800" />
                <span>Pedir Prestado de Otra OT</span>
              </button>

              {/* Botón para Abrir / Cerrar Chat Integrado de la OT */}
              <button
                type="button"
                onClick={() => setShowChecklistChatTab(!showChecklistChatTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border shadow-2xs ${
                  showChecklistChatTab 
                    ? 'bg-blue-900 text-white border-blue-950' 
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200'
                }`}
                title="Abrir canal de chat y coordinación en vivo de esta OT"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{showChecklistChatTab ? 'Ocultar Chat' : '💬 Chat OT'}</span>
              </button>
            </div>

            {/* Contenido Central: Formularios + Tabla con Columnas Disgregadas */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* ── PANEL DE CHAT INTEGRADO DE LA OT ── */}
              {showChecklistChatTab && activeChecklistOT && (
                <div className="bg-white border-2 border-blue-300 rounded-3xl p-4 shadow-lg space-y-2 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 rounded-xl">
                        <MessageSquare className="w-4 h-4 text-blue-900" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider Poppins">
                          Canal de Chat en Vivo • OT-{activeChecklistOT.ot_numero || activeChecklistOT.id}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          {activeChecklistOT.cliente_nombre} • {activeChecklistOT.modelo_estructura}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowChecklistChatTab(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <ChatComponent
                    otId={activeChecklistOT.id}
                    userRole={userRole}
                    userName={userName}
                  />
                </div>
              )}

              {/* Mensaje de confirmación de préstamo */}
              {loanSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>{loanSuccessMsg}</span>
                  </div>
                  <button type="button" onClick={() => setLoanSuccessMsg('')}>
                    <X className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              )}

              {/* ── SECCIÓN: PEDIR PRESTADO DE OTRA OT ── */}
              {showLoanSection && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-900 tracking-wider">
                    <ArrowRightLeft className="w-4 h-4 text-amber-800" />
                    <span>Préstamo de Materiales entre OTs (Explosión Cruzada)</span>
                  </div>
                  <p className="text-xs text-amber-800/80 font-medium">
                    Asigna un componente que se encuentra en otra obra activa directamente a esta OT.
                  </p>

                  <form onSubmit={handleBorrowItemFromOT} className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[10px] font-black uppercase text-amber-900 mb-1">
                        OT Origen (Prestamista):
                      </label>
                      <select
                        value={loanSourceOTId}
                        onChange={(e) => setLoanSourceOTId(e.target.value)}
                        className="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 shadow-2xs"
                        required
                      >
                        <option value="">Seleccionar OT prestamista...</option>
                        {ots.filter(o => String(o.id) !== String(activeChecklistOT.id)).map(o => (
                          <option key={o.id} value={o.id}>
                            OT-{o.ot_numero || o.id} • {o.cliente_nombre || 'Obra'} ({o.modelo_estructura})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[10px] font-black uppercase text-amber-900 mb-1">
                        Material / Herramienta a prestar:
                      </label>
                      <input
                        type="text"
                        value={loanItemName}
                        onChange={(e) => setLoanItemName(e.target.value)}
                        placeholder="Ej. Cables de acero 10m, Maza, Bulones 1/2..."
                        className="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 shadow-2xs"
                        required
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[10px] font-black uppercase text-amber-900 mb-1">
                        Cantidad:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={loanItemQty}
                        onChange={(e) => setLoanItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white border border-amber-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800 outline-none text-center shadow-2xs"
                      />
                    </div>

                    <div className="self-end">
                      <button
                        type="submit"
                        disabled={savingChecklist || !loanSourceOTId || !loanItemName.trim()}
                        className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs"
                      >
                        + Confirmar Préstamo
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── SECCIÓN: AGREGAR ÍTEM INTELIGENTE DESDE TABLAS MAESTRAS & STOCK ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-900 tracking-wider">
                    <Package className="w-4 h-4 text-blue-900" />
                    <span>Agregar Componente / Insumo desde Tablas Maestras</span>
                    <span className="bg-blue-100 text-blue-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {stockInventoryList.length} ítems en base de datos
                    </span>
                  </div>

                  {/* Botón para Abrir Explorador de Catálogo Maestro */}
                  <button
                    type="button"
                    onClick={() => {
                      if (stockInventoryList.length === 0) fetchStockInventory();
                      setShowStockCatalogModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-blue-50 text-blue-900 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-800" />
                    <span>📦 Explorar Catálogo Maestro ({stockInventoryList.length})</span>
                  </button>
                </div>

                <form onSubmit={handleAddNewItem} className="flex flex-wrap items-center gap-2.5 relative">
                  {/* Autocomplete de búsqueda en Tablas Maestras */}
                  <div className="flex-1 min-w-[240px] relative">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => {
                        setNewItemName(e.target.value);
                        setShowStockSuggestions(e.target.value.trim().length > 0);
                      }}
                      onFocus={() => {
                        if (newItemName.trim().length > 0) setShowStockSuggestions(true);
                      }}
                      placeholder="Escribe para buscar componente o insumo en tablas maestras..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-900 shadow-2xs"
                      required
                    />

                    {/* Dropdown de Sugerencias en Vivo desde Tablas Maestras */}
                    {showStockSuggestions && newItemName.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                        {(() => {
                          const rawTerms = newItemName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().split(/\s+/).filter(Boolean);
                          const suggestions = stockInventoryList.filter(item => {
                            const fullStr = `${item.nombre || ''} ${item.producto || ''} ${item.modelo_estructura || ''} ${item.sector || ''} ${item.categoria || ''}`
                              .toLowerCase()
                              .normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "");
                            return rawTerms.every(t => fullStr.includes(t));
                          }).slice(0, 30);

                          if (suggestions.length === 0) {
                            return (
                              <div className="p-3 text-xs text-slate-500 flex items-center justify-between">
                                <span>No figura en tablas maestras. Se agregará como ítem manual: <strong>"{newItemName}"</strong></span>
                              </div>
                            );
                          }

                          return suggestions.map(sug => {
                            const hasStock = sug.stock_disponible > 0;
                            return (
                              <div
                                key={sug.id}
                                onClick={() => {
                                  setNewItemName(sug.nombre);
                                  if (sug.sector) setNewItemSector(sug.sector);
                                  setShowStockSuggestions(false);
                                }}
                                className="p-2.5 hover:bg-blue-50/70 flex items-center justify-between cursor-pointer transition gap-2"
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-800">{sug.nombre}</span>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold mt-0.5">
                                    <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">{sug.sector}</span>
                                    {sug.origen_tabla && (
                                      <span className="text-slate-400 font-mono text-[9px]">• {sug.origen_tabla}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                    hasStock 
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                                  }`}>
                                    {hasStock ? `📦 Disp: ${sug.stock_disponible} u.` : `🔴 Sin Stock (Total: ${sug.stock_total})`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDirectAddStockItem(sug, newItemQty || 1);
                                    }}
                                    className="px-2.5 py-1 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                                  >
                                    + Agregar
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Selector de Sector */}
                  <div className="w-36">
                    <select
                      value={newItemSector}
                      onChange={(e) => setNewItemSector(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 outline-none shadow-2xs cursor-pointer"
                    >
                      {SECTORES_INTERNOS.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Cantidad */}
                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-center text-slate-800 outline-none shadow-2xs"
                      placeholder="Cant."
                    />
                  </div>

                  {/* Botón Agregar */}
                  <button
                    type="submit"
                    disabled={savingChecklist || !newItemName.trim()}
                    className="bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs"
                  >
                    + Agregar Ítem
                  </button>
                </form>
              </div>

              {/* ── TABLA / LISTA DE ÍTEMS DE MATERIALES CON COLUMNAS DISGREGADAS ── */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-3 py-2.5 border-b border-slate-200 grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 items-center">
                  <div className="col-span-1 text-center" title="Estado Preparado en Depósito/Planta">Prep.</div>
                  <div className="col-span-1 text-center" title="Estado Enviado/Cargado en Camión">Env./Carg.</div>
                  <div className="col-span-3">Componente / Material / Herramienta</div>
                  <div className="col-span-1 text-center">Sector</div>
                  <div className="col-span-1 text-center">Cant. Req.</div>
                  <div className="col-span-1 text-center">Egresan</div>
                  <div className="col-span-1 text-center">Regresan</div>
                  <div className="col-span-2">Observaciones</div>
                  <div className="col-span-1 text-right">Acción</div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {(() => {
                    const currentItems = getActiveOTItems().filter(i => {
                      const matchSector = activeSectorTab === 'todos' ? true : i.detectedSector === activeSectorTab;
                      const matchSearch = checklistSearch.trim() === '' || (i.producto || '').toLowerCase().includes(checklistSearch.toLowerCase());
                      return matchSector && matchSearch;
                    });

                    if (currentItems.length === 0) {
                      return (
                        <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                          No hay ítems registrados para este sector. Puedes agregar nuevos componentes con el formulario de arriba o desde el catálogo.
                        </div>
                      );
                    }

                    return currentItems.map((item, idx) => {
                      const isPrepared = item.preparado || item.checked;
                      const isSent = !!item.enviado;

                      return (
                        <div
                          key={`${item.sourceList}-${item.originalIndex}-${idx}`}
                          className={`px-3 py-2 grid grid-cols-12 gap-2 items-center text-xs transition ${
                            isSent 
                              ? 'bg-blue-50/40 text-slate-700' 
                              : isPrepared 
                                ? 'bg-emerald-50/30 text-slate-700' 
                                : 'bg-white text-slate-800 hover:bg-slate-50/70'
                          }`}
                        >
                          {/* 1. Check: Estado Preparado */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleToggleItemField(item.sourceList, item.originalIndex, 'preparado')}
                              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                                isPrepared 
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs' 
                                  : 'border-slate-300 hover:border-blue-900 bg-white'
                              }`}
                              title="Marcar Estado: Preparado en Pañol / Planta"
                            >
                              {isPrepared && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          </div>

                          {/* 2. Check: Estado Enviado / Cargado */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleToggleItemField(item.sourceList, item.originalIndex, 'enviado')}
                              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                                isSent 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-2xs' 
                                  : 'border-slate-300 hover:border-blue-900 bg-white'
                              }`}
                              title="Marcar Estado: Enviado / Cargado en Transporte"
                            >
                              {isSent && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          </div>

                          {/* 3. Nombre del Producto / Componente */}
                          <div className="col-span-3 flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className={`font-bold truncate ${isPrepared ? 'text-slate-600' : 'text-slate-900'}`}>
                              {item.producto}
                            </span>

                            {/* Badge si es prestado de otra OT */}
                            {(item.prestado_de_ot_numero || item.producto?.includes('Prestado de')) && (
                              <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0">
                                <span>🤝 Prestado</span>
                              </span>
                            )}
                          </div>

                          {/* 4. Sector Badge */}
                          <div className="col-span-1 text-center">
                            <span className="px-1.5 py-0.5 rounded-lg text-[9px] font-black bg-slate-100 text-slate-600 border border-slate-200 truncate inline-block max-w-full">
                              {item.detectedSector || item.sector}
                            </span>
                          </div>

                          {/* 5. Cantidad Requerida con Steppers */}
                          <div className="col-span-1 flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item.sourceList, item.originalIndex, -1)}
                              className="w-4 h-4 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-black text-[10px] cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-mono font-black text-xs px-1 text-slate-800">
                              {item.qty || 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item.sourceList, item.originalIndex, 1)}
                              className="w-4 h-4 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-black text-[10px] cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* 6. Campo Numérico: Estado Egresan */}
                          <div className="col-span-1 flex justify-center">
                            <input
                              type="number"
                              min="0"
                              value={item.cant_egresan !== undefined ? item.cant_egresan : (item.qty || '')}
                              onChange={(e) => handleUpdateItemValue(item.sourceList, item.originalIndex, 'cant_egresan', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full max-w-[50px] bg-slate-50 border border-slate-200 rounded-lg px-1 py-1 text-xs font-bold text-center text-slate-800 outline-none focus:bg-white focus:border-blue-900 shadow-2xs"
                              placeholder="0"
                              title="Cantidad que egresa a obra"
                            />
                          </div>

                          {/* 7. Campo Numérico: Estado Regresan */}
                          <div className="col-span-1 flex justify-center">
                            <input
                              type="number"
                              min="0"
                              value={item.cant_regresan !== undefined ? item.cant_regresan : ''}
                              onChange={(e) => handleUpdateItemValue(item.sourceList, item.originalIndex, 'cant_regresan', e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full max-w-[50px] bg-slate-50 border border-slate-200 rounded-lg px-1 py-1 text-xs font-bold text-center text-slate-800 outline-none focus:bg-white focus:border-blue-900 shadow-2xs"
                              placeholder="0"
                              title="Cantidad que regresa de obra"
                            />
                          </div>

                          {/* 8. Campo Texto: Observaciones */}
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.observaciones || ''}
                              onChange={(e) => handleUpdateItemValue(item.sourceList, item.originalIndex, 'observaciones', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-900 shadow-2xs placeholder:text-slate-400 placeholder:text-[10px]"
                              placeholder="Observaciones / Novedades..."
                            />
                          </div>

                          {/* 9. Eliminar Ítem */}
                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.sourceList, item.originalIndex)}
                              className="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Eliminar del checklist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>

            {/* Footer del Modal */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Todos los cambios y préstamos se guardan automáticamente en la OT.</span>
              </div>

              <button
                type="button"
                onClick={() => setChecklistModalOpen(false)}
                className="bg-blue-900 hover:bg-blue-955 text-white rounded-xl px-6 py-2 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs"
              >
                Listo / Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: CATÁLOGO MAESTRO COMPLETO CON CONTROL DE STOCK (947 ÍTEMS) ── */}
      {showStockCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm uppercase tracking-wider Poppins">
                      Catálogo Maestro del Sistema ({stockInventoryList.length} Componentes)
                    </h3>
                    {loadingStockCatalog && (
                      <RefreshCw className="w-3.5 h-3.5 text-blue-300 animate-spin" />
                    )}
                  </div>
                  <p className="text-[11px] text-blue-200 font-medium">
                    Componentes Estructurales (Arcos, Módulos, Fijos) y Accesorios con Stock Real en Tiempo Real
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchStockInventory}
                  disabled={loadingStockCatalog}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Sincronizar con base de datos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStockCatalog ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Recargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowStockCatalogModal(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filtros de Búsqueda */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stockCatalogSearch}
                  onChange={(e) => setStockCatalogSearch(e.target.value)}
                  placeholder="Buscar por código, producto o modelo (ej. PERNO, ARCO, BULON, PLACA, LONA, ALFOMBRA)..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-900 shadow-2xs"
                />
              </div>
              <span className="text-xs text-slate-500 font-bold">
                {stockInventoryList.filter(it => {
                  const rawTerms = stockCatalogSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().split(/\s+/).filter(Boolean);
                  const fullStr = `${it.nombre || ''} ${it.producto || ''} ${it.modelo_estructura || ''} ${it.sector || ''} ${it.categoria || ''} ${it.origen_tabla || ''}`
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
                  return rawTerms.every(t => fullStr.includes(t));
                }).length} componentes filtrados
              </span>
            </div>

            {/* Grid de Ítems del Catálogo */}
            <div className="flex-1 overflow-y-auto p-4 max-h-[55vh]">
              {loadingStockCatalog && stockInventoryList.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-semibold flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 text-blue-900 animate-spin" />
                  <span>Cargando catálogo maestro desde la base de datos...</span>
                </div>
              ) : (() => {
                const rawTerms = stockCatalogSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().split(/\s+/).filter(Boolean);
                const filtered = stockInventoryList.filter(it => {
                  const fullStr = `${it.nombre || ''} ${it.producto || ''} ${it.modelo_estructura || ''} ${it.sector || ''} ${it.categoria || ''} ${it.origen_tabla || ''}`
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
                  return rawTerms.every(t => fullStr.includes(t));
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs font-semibold space-y-3">
                      <p>No se encontraron componentes en las tablas maestras con ese criterio.</p>
                      {stockInventoryList.length === 0 && (
                        <button
                          type="button"
                          onClick={fetchStockInventory}
                          className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Cargar 947 componentes ahora
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filtered.slice(0, 100).map(item => {
                      const hasStock = item.stock_disponible > 0;
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-xs transition flex items-center justify-between gap-2"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate" title={item.nombre}>
                              {item.nombre}
                            </span>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-semibold">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                                {item.sector}
                              </span>
                              <span className="text-slate-400 text-[9px] font-mono">
                                {item.origen_tabla}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div className={`text-[10px] font-black ${hasStock ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {hasStock ? `Disp: ${item.stock_disponible} u.` : 'Sin Stock'}
                              </div>
                              <div className="text-[9px] text-slate-400 font-semibold">
                                Total: {item.stock_total} u.
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleDirectAddStockItem(item, 1);
                                setShowStockCatalogModal(false);
                              }}
                              className="px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-2xs"
                            >
                              + Agregar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Al agregar un componente, se insertará automáticamente con su sector y stock verificado.</span>
              <button
                type="button"
                onClick={() => setShowStockCatalogModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'proyeccion_planta' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-blue-900 uppercase tracking-wider Poppins">
                Proyección de Tareas de Planta ({selectedDate})
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                Planificación de lavado de lonas, confección, herrería y mantenimiento general de depósito
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              id="newPlantaTaskInput"
              placeholder="Nueva tarea de planta (ej. Reparación de faldones carpa 20m)..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddPlantaTask(e.target.value);
                  e.target.value = '';
                }
              }}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900 transition"
            />
            <button
              onClick={() => {
                const el = document.getElementById('newPlantaTaskInput');
                if (el) {
                  handleAddPlantaTask(el.value);
                  el.value = '';
                }
              }}
              className="bg-blue-900 hover:bg-blue-955 text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              Agregar Tarea
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {plantaTareas.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-slate-400 text-xs font-semibold">
                No hay tareas programadas para esta fecha.
              </div>
            ) : (
              plantaTareas.map(t => (
                <div key={t.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{t.titulo}</div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Estado: {t.estado} • Estimado: {t.personal_estimado} operarios
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePlantaTask(t.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 3: RECORDATORIOS Y VENCIMIENTOS ── */}
      {activeTab === 'recordatorios' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-blue-900 uppercase tracking-wider Poppins">
                Alertas Operativas y Vencimientos
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                Control de VTV, seguros, libretas sanitarias y revisiones técnicas
              </p>
            </div>
          </div>

          {/* New Reminder Form */}
          <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <input
              type="date"
              value={newReminderFecha}
              onChange={(e) => setNewReminderFecha(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl"
            />
            <select
              value={newReminderTipo}
              onChange={(e) => setNewReminderTipo(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-bold px-3 py-2 rounded-xl"
            >
              <option value="General">General</option>
              <option value="Vehículo">VTV / Seguro Vehículo</option>
              <option value="Personal">Personal / Examen Médico</option>
              <option value="Obra">Permiso de Obra</option>
            </select>
            <input
              type="text"
              value={newReminderTitle}
              onChange={(e) => setNewReminderTitle(e.target.value)}
              placeholder="Descripción del recordatorio..."
              className="flex-1 bg-white border border-slate-200 text-xs font-semibold px-3 py-2 rounded-xl outline-none"
            />
            <button
              onClick={handleAddReminder}
              className="bg-blue-900 hover:bg-blue-955 text-white text-xs font-black uppercase px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              Crear Alerta
            </button>
          </div>

          {(() => {
              // Ordenar por secciones: urgentes (hoy/vencidos), próximos 30d, futuros
              const urgentes = recordatorios.filter(r => !r.completado && r.fecha <= todayStr);
              const proximos = recordatorios.filter(r => !r.completado && r.fecha > todayStr && r.fecha <= in30DaysStr);
              const futuros  = recordatorios.filter(r => !r.completado && r.fecha > in30DaysStr);
              const completados = recordatorios.filter(r => r.completado);

              const calcDias = (f) => {
                if (!f) return null;
                return Math.round((new Date(f + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000);
              };

              const Card = ({ r }) => {
                const isAuto = Boolean(r.es_automatico);
                const isVeh  = r.subtipo === 'VTV' || r.subtipo === 'Seguro' || r.tipo === 'Vehículo';
                const dias   = r.fecha_vencimiento_real ? calcDias(r.fecha_vencimiento_real) : calcDias(r.fecha);
                const isUrgente = r.fecha <= todayStr;
                return (
                  <div className={`p-3.5 rounded-2xl border flex flex-wrap items-start justify-between gap-3 transition ${
                    isUrgente ? 'bg-rose-50 border-rose-300' : isAuto ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-xl flex-shrink-0 ${isUrgente ? 'bg-rose-100 text-rose-700' : isVeh ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
                        {isVeh ? <Truck className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`text-xs font-black ${isUrgente ? 'text-rose-800' : 'text-slate-800'}`}>{r.titulo}</span>
                          {isAuto
                            ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">⚡ Auto</span>
                            : <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-600">Manual</span>
                          }
                          {dias !== null && (
                            <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black ${
                              dias <= 0 ? 'bg-rose-200 text-rose-800' : dias <= 7 ? 'bg-orange-200 text-orange-900' : 'bg-amber-100 text-amber-900'
                            }`}>
                              {dias <= 0 ? `VENCIDO hace ${Math.abs(dias)}d` : `en ${dias} días`}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
                          <span>📅 Alerta: <strong>{r.fecha}</strong></span>
                          {r.fecha_vencimiento_real && (
                            <span className={dias !== null && dias <= 0 ? 'text-rose-700 font-bold' : 'text-amber-800 font-bold'}>
                              🚨 Vence: <strong>{r.fecha_vencimiento_real}</strong>
                            </span>
                          )}
                          {r.tipo && <span>• {r.tipo}{r.subtipo ? ` / ${r.subtipo}` : ''}</span>}
                        </div>
                        {r.descripcion && <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{r.descripcion}</p>}
                      </div>
                    </div>
                    {!isAuto && (
                      <button
                        onClick={async () => {
                          try { await fetch(`/api/planificacion/recordatorios/${r.id}`, { method: 'DELETE' }); fetchReminders(); }
                          catch (e) { console.error(e); }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer flex-shrink-0"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              };

              if (recordatorios.length === 0) return (
                <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  No hay alertas registradas. Los vencimientos de VTV y Seguro se generan automáticamente desde la Tabla Maestra.
                </div>
              );

              return (
                <div className="space-y-4">
                  {urgentes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-3 py-1 rounded-full border border-rose-300 inline-flex items-center gap-1.5 mb-2">
                        🚨 {urgentes.length} Urgente{urgentes.length > 1 ? 's' : ''} — Acción inmediata
                      </p>
                      <div className="space-y-2">{urgentes.map(r => <Card key={r.id} r={r} />)}</div>
                    </div>
                  )}
                  {proximos.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300 inline-flex items-center gap-1.5 mb-2">
                        ⏰ {proximos.length} Próximo{proximos.length > 1 ? 's' : ''} — Dentro de 30 días
                      </p>
                      <div className="space-y-2">{proximos.map(r => <Card key={r.id} r={r} />)}</div>
                    </div>
                  )}
                  {futuros.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 inline-flex items-center gap-1.5 mb-2">
                        📋 {futuros.length} Futuro{futuros.length > 1 ? 's' : ''} — Más de 30 días
                      </p>
                      <div className="space-y-2">{futuros.map(r => <Card key={r.id} r={r} />)}</div>
                    </div>
                  )}
                  {completados.length > 0 && (
                    <details>
                      <summary className="text-[10px] font-bold text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                        ✅ {completados.length} completado{completados.length > 1 ? 's' : ''} (click para ver)
                      </summary>
                      <div className="space-y-2 mt-2 opacity-60">{completados.map(r => <Card key={r.id} r={r} />)}</div>
                    </details>
                  )}
                </div>
              );
            })()}
        </div>
      )}

      {/* ── MODAL: QUICK EDIT FULL OT ── */}
      {editingOT && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-[2rem] w-full max-w-2xl p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingOT(null)}
              className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Edit3 className="w-5 h-5 text-blue-900" />
              <div>
                <h3 className="text-base font-black text-blue-900 Poppins">
                  Editar Orden de Trabajo OT-{editingOT.ot_numero || editingOT.id}
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Modificaciones directas al proyecto con sincronización bidireccional
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveOTFull} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Cliente</label>
                  <input
                    type="text"
                    value={editingOT.cliente_nombre || ''}
                    onChange={(e) => setEditingOT({ ...editingOT, cliente_nombre: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Estado de la OT</label>
                  <select
                    value={editingOT.estado || 'Aprobada por Gerencia'}
                    onChange={(e) => setEditingOT({ ...editingOT, estado: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900"
                  >
                    <option value="Aprobada por Gerencia">Aprobada por Gerencia</option>
                    <option value="Aprobada">Aprobada</option>
                    <option value="En Curso">En Curso</option>
                    <option value="Finalizada">Finalizada</option>
                    <option value="Pendiente de Aprobación">Pendiente de Aprobación</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Fecha Inicio (Armado)</label>
                  <input
                    type="date"
                    value={editingOT.fecha_inicio ? editingOT.fecha_inicio.substring(0, 10) : ''}
                    onChange={(e) => setEditingOT({ ...editingOT, fecha_inicio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Fecha Evento</label>
                  <input
                    type="date"
                    value={editingOT.fecha_evento ? editingOT.fecha_evento.substring(0, 10) : ''}
                    onChange={(e) => setEditingOT({ ...editingOT, fecha_evento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Fecha Fin (Desarme)</label>
                  <input
                    type="date"
                    value={editingOT.fecha_fin ? editingOT.fecha_fin.substring(0, 10) : ''}
                    onChange={(e) => setEditingOT({ ...editingOT, fecha_fin: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Frente (m)</label>
                  <input
                    type="number"
                    value={editingOT.frente || ''}
                    onChange={(e) => {
                      const frente = parseFloat(e.target.value) || 0;
                      const largo = parseFloat(editingOT.largo) || 0;
                      setEditingOT({ ...editingOT, frente, superficie: frente * largo });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Largo (m)</label>
                  <input
                    type="number"
                    value={editingOT.largo || ''}
                    onChange={(e) => {
                      const largo = parseFloat(e.target.value) || 0;
                      const frente = parseFloat(editingOT.frente) || 0;
                      setEditingOT({ ...editingOT, largo, superficie: frente * largo });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Superficie Total (m²)</label>
                  <input
                    type="number"
                    readOnly
                    value={editingOT.superficie || ''}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Observaciones / Requerimientos Técnicos</label>
                <textarea
                  value={editingOT.observaciones || ''}
                  onChange={(e) => setEditingOT({ ...editingOT, observaciones: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold outline-none focus:bg-white focus:border-blue-900 min-h-[80px]"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOT(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingOT}
                  className="flex-1 bg-blue-900 hover:bg-blue-955 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  {savingOT ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL / HUB DE CHAT EN VIVO DE COORDINACIÓN DE OTs ── */}
      {chatDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Chat Hub */}
            <div className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider Poppins">
                    Chat de Coordinación Operativa en Vivo
                  </h3>
                  <p className="text-[11px] text-blue-200 font-medium">
                    Canal directo por OT para logística, avisos de carga y novedades de obra
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChatDrawerOpen(false);
                  setActiveChatOT(null);
                }}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector Rápido de OTs del Día */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-black uppercase text-slate-500 shrink-0">OT Activa:</span>
              {otsDelDia.length === 0 ? (
                <span className="text-xs text-slate-400 font-semibold italic">No hay OTs para el día seleccionado</span>
              ) : (
                otsDelDia.map(o => {
                  const isSelected = activeChatOT && String(activeChatOT.id) === String(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setActiveChatOT(o)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border shrink-0 ${
                        isSelected
                          ? 'bg-blue-900 text-white border-blue-950 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-900'
                      }`}
                    >
                      OT-{o.ot_numero || o.id} • {o.cliente_nombre || 'Obra'}
                    </button>
                  );
                })
              )}
            </div>

            {/* Cuerpo del Chat */}
            <div className="flex-1 p-4 bg-slate-50 overflow-y-auto">
              {activeChatOT ? (
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black text-blue-900">
                        OT-{activeChatOT.ot_numero || activeChatOT.id} • {activeChatOT.cliente_nombre}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        {activeChatOT.modelo_estructura} • Fechas: {activeChatOT.fecha_inicio} al {activeChatOT.fecha_fin}
                      </div>
                    </div>
                    {activeChatOT.georef?.direccion && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{activeChatOT.georef.direccion}</span>
                      </div>
                    )}
                  </div>

                  {/* Componente Chat Oficial */}
                  <ChatComponent
                    otId={activeChatOT.id}
                    userRole={userRole}
                    userName={userName}
                  />
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                  Selecciona una OT superior para abrir su canal de mensajes.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">Los mensajes se sincronizan automáticamente entre roles (Gerencia, Operaciones, Planta, Pañol, etc.).</span>
              <button
                type="button"
                onClick={() => {
                  setChatDrawerOpen(false);
                  setActiveChatOT(null);
                }}
                className="px-4 py-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
