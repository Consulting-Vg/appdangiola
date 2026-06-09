import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
  FileText, CheckSquare, Plus, MessageSquare, Clock, MapPin,
  Layers, CheckCircle2, ChevronRight, User, Calendar, Trash2,
  HelpCircle, AlertOctagon, AlertTriangle, RefreshCw,
  BarChart3, ShieldCheck, TrendingUp, Package, Eye, Truck,
  Shuffle, Warehouse, Printer, ArrowRight, Sun
} from 'lucide-react';
import PDFReplicator from './PDFReplicator';

export default function RoleDashboard({
  currentUser,
  userRole,
  userName,
  ots,
  personalList = [],
  users = [],
  onCreateOTClick,
  onSelectOT,
  onUpdateOTStatus,
  onUpdateChecklist,
  onResetDB,
  structures,
  chatAlerts = [],
  onFetchChatAlerts,
  structuresStock = [],
  clients = [],
  onUpdateAdicionales,
  onOpenGerenciaDashboard,
  onWeatherAnalysis
}) {
  const getModulesForUser = () => {
    // 1. Determine default modules by role
    const defaultModulesByRole = (() => {
      const role = currentUser?.rol || userRole;
      if (role === 'Comercial') return ['Comercial'];
      if (role === 'Gerencia') return ['Gerencia', 'Comercial', 'Operaciones', 'Almacen', 'Chofer'];
      if (role === 'Operaciones') return ['Operaciones', 'Chofer'];
      if (role === 'Chofer') return ['Chofer'];
      if (['Planta', 'Pañol', 'Lonas', 'Pisos', 'Telas', 'Operario'].includes(role)) return ['Almacen'];
      if (role === 'SuperAdmin') return ['Gerencia', 'Comercial', 'Operaciones', 'Almacen', 'Chofer'];
      return [];
    })();

    // 2. If currentUser has custom modulos, parse and merge them
    if (currentUser) {
      try {
        const parsed = typeof currentUser.modulos === 'string'
          ? JSON.parse(currentUser.modulos)
          : currentUser.modulos;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = Array.from(new Set([...parsed, ...defaultModulesByRole]));
          return merged;
        }
      } catch (e) {
        console.error(e);
      }
    }

    return defaultModulesByRole;
  };

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

  const aggregateProducts = (items) => {
    const aggregated = {};
    items.forEach(item => {
      let cleanName = String(item.producto).replace(/[-_][a-zA-Z]\d*$/i, '');
      if (!aggregated[cleanName]) {
        aggregated[cleanName] = { ...item, producto: cleanName, qty: 0 };
        if (item.total !== undefined) aggregated[cleanName].total = 0;
        if (item.reserved !== undefined) aggregated[cleanName].reserved = 0;
        if (item.inUse !== undefined) aggregated[cleanName].inUse = 0;
        if (item.available !== undefined) aggregated[cleanName].available = 0;
      }
      aggregated[cleanName].qty += Number(item.qty || 1);
      if (item.total !== undefined) aggregated[cleanName].total += Number(item.total || 0);
      if (item.reserved !== undefined) aggregated[cleanName].reserved += Number(item.reserved || 0);
      if (item.inUse !== undefined) aggregated[cleanName].inUse += Number(item.inUse || 0);
      if (item.available !== undefined) aggregated[cleanName].available += Number(item.available || 0);
    });
    return Object.values(aggregated).sort((a, b) => {
      const secA = a.sector || '';
      const secB = b.sector || '';
      if (secA !== secB) return secA.localeCompare(secB);
      return a.producto.localeCompare(b.producto);
    });
  };

  const isUserAssignedToOT = (ot, uId, uName, pList = []) => {
    const asignaciones = ot.adicionales?.asignaciones_tareas || {};
    // Find all personal IDs associated with this app user ID
    const associatedPersonalIds = pList
      .filter(p => p.usuario_id === uId)
      .map(p => p.id);

    return Object.keys(asignaciones).some(sec => {
      const val = asignaciones[sec];
      if (!val) return false;
      if (Array.isArray(val)) {
        return val.some(item => {
          const numItem = Number(item);
          if (!isNaN(numItem)) {
            return associatedPersonalIds.includes(numItem);
          }
          return String(item) === uName;
        });
      }
      const numVal = Number(val);
      if (!isNaN(numVal)) {
        return associatedPersonalIds.includes(numVal);
      }
      return String(val) === uName;
    });
  };

  const getUserAssignedSectors = (ot, uId, uName, pList = []) => {
    const asignaciones = ot.adicionales?.asignaciones_tareas || {};
    const associatedPersonalIds = pList
      .filter(p => p.usuario_id === uId)
      .map(p => p.id);

    const sectors = new Set();
    Object.keys(asignaciones).forEach(sec => {
      const val = asignaciones[sec];
      if (!val) return;
      let isAssigned = false;
      if (Array.isArray(val)) {
        isAssigned = val.some(item => {
          const numItem = Number(item);
          if (!isNaN(numItem)) {
            return associatedPersonalIds.includes(numItem);
          }
          return String(item) === uName;
        });
      } else {
        const numVal = Number(val);
        if (!isNaN(numVal)) {
          isAssigned = associatedPersonalIds.includes(numVal);
        } else {
          isAssigned = String(val) === uName;
        }
      }
      if (isAssigned) {
        sectors.add(sec);
      }
    });
    return sectors;
  };

  const filterMaterials = (mats, role) => {
    if (!role) return mats;
    if (['Gerencia', 'Operaciones', 'SuperAdmin', 'Comercial'].includes(role)) {
      return mats;
    }
    if (role === 'Operario') {
      const username = currentUser?.username || userName;
      const userId = currentUser?.id || null;
      const assignedSectors = new Set();
      (ots || []).forEach(ot => {
        const sectors = getUserAssignedSectors(ot, userId, username, personalList);
        sectors.forEach(sec => assignedSectors.add(sec));
      });
      if (assignedSectors.size === 0) return [];

      return mats.filter(item => {
        const name = item.producto || '';
        const sector = item.sector || '';
        return Array.from(assignedSectors).some(sec => {
          if (sec === 'Planta') return sector === 'Planta' && !isLona(name) && !isPiso(name) && !isTela(name);
          if (sec === 'Pañol') return sector === 'Pañol' && !isLona(name) && !isPiso(name) && !isTela(name);
          if (sec === 'Lonas') return isLona(name);
          if (sec === 'Pisos') return isPiso(name);
          if (sec === 'Telas') return isTela(name);
          return false;
        });
      });
    }
    return mats.filter(item => {
      const name = item.producto || '';
      const sector = item.sector || '';
      if (role === 'Planta') {
        return sector === 'Planta' && !isLona(name) && !isPiso(name) && !isTela(name);
      }
      if (role === 'Pañol') {
        return sector === 'Pañol' && !isLona(name) && !isPiso(name) && !isTela(name);
      }
      if (role === 'Lonas') {
        return isLona(name);
      }
      if (role === 'Pisos') {
        return isPiso(name);
      }
      if (role === 'Telas') {
        return isTela(name);
      }
      return false;
    });
  };

  const getDefaultModuleForRole = (role) => {
    if (role === 'Comercial') return 'Comercial';
    if (role === 'Gerencia') return 'Gerencia';
    if (role === 'Operaciones') return 'Operaciones';
    if (role === 'Chofer') return 'Chofer';
    if (['Planta', 'Pañol', 'Lonas', 'Pisos', 'Telas', 'Operario'].includes(role)) return 'Almacen';
    if (role === 'SuperAdmin') return 'Gerencia';
    return null;
  };

  const allowedModules = getModulesForUser();
  const primaryModule = getDefaultModuleForRole(currentUser?.rol || userRole);
  const defaultModule = allowedModules.includes(primaryModule)
    ? primaryModule
    : (allowedModules.includes('Gerencia') ? 'Gerencia' : (allowedModules[0] || 'Comercial'));
  const [activeModule, setActiveModule] = useState(defaultModule);

  useEffect(() => {
    const modules = getModulesForUser();
    if (modules.length > 0 && !modules.includes(activeModule)) {
      const pMod = getDefaultModuleForRole(currentUser?.rol || userRole);
      const def = modules.includes(pMod)
        ? pMod
        : (modules.includes('Gerencia') ? 'Gerencia' : modules[0]);
      setActiveModule(def);
    }
  }, [currentUser, userRole]);

  const [activeTab, setActiveTab] = useState('all');
  const [operacionesSubTab, setOperacionesSubTab] = useState('ots'); // 'ots', 'stock'
  const [gerenciaSubTab, setGerenciaSubTab] = useState('ots'); // 'ots', 'stock'
  const [borrowItem, setBorrowItem] = useState({ item: '', sourceEst: '', qty: 1 });
  const [borrowOTId, setBorrowOTId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [desarmeRecords, setDesarmeRecords] = useState([]);

  useEffect(() => {
    const fetchDesarmes = async () => {
      try {
        const res = await fetch('/api/logistica/desarmes');
        if (res.ok) {
          const data = await res.json();
          setDesarmeRecords(data);
        }
      } catch (err) {
        console.error("Error al cargar registros de desarme:", err);
      }
    };
    fetchDesarmes();
  }, [ots]);

  const getDisassemblyAlerts = () => {
    const now = new Date();
    return (ots || []).filter(ot => {
      if (['Cancelada', 'Rechazada', 'Pendiente', 'Desarmada', 'Retornada'].includes(ot.estado)) return false;
      const fechaDesarme = new Date(ot.fecha_fin + 'T00:00:00');
      const diffTime = fechaDesarme - now;
      const diffHours = diffTime / (1000 * 60 * 60);
      return diffHours <= 48; // within 48 hours or overdue
    });
  };
  const disassemblyAlerts = getDisassemblyAlerts();

  const calculateDistanceBetween = (lat1, lng1, lat2, lng2) => {
    const l1 = parseFloat(lat1);
    const g1 = parseFloat(lng1);
    const l2 = parseFloat(lat2);
    const g2 = parseFloat(lng2);
    if (isNaN(l1) || isNaN(g1) || isNaN(l2) || isNaN(g2)) return "0.0";

    const R = 6371; // radio de la tierra en km
    const dLat = ((l2 - l1) * Math.PI) / 180;
    const dLon = ((g2 - g1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((l1 * Math.PI) / 180) *
      Math.cos((l2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Aplicamos el coeficiente de ruteo 1.35
    return (R * c * 1.35).toFixed(1);
  };

  const calculateKms = (lat2, lng2) => {
    return calculateDistanceBetween(-34.83473863535278, -58.42446638785623, lat2, lng2);
  };

  const handleGPSArrivalRetorno = (otId, destKey, checked) => {
    if (!checked) return;
    const ot = ots.find(o => o.id === otId);
    if (!ot) return;
    const adObj = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
    const retornoLlegadas = adObj.chofer_retorno_llegadas || {};

    const saveGPSInfo = async (coordsStr) => {
      const updatedLlegadas = {
        ...retornoLlegadas,
        [destKey]: {
          llegada: true,
          fecha: new Date().toISOString(),
          coords: coordsStr
        }
      };
      if (onUpdateAdicionales) {
        await onUpdateAdicionales(otId, {
          ...adObj,
          chofer_retorno_llegadas: updatedLlegadas
        });
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          saveGPSInfo(coordsStr);
        },
        (err) => {
          console.error("Error obteniendo ubicación GPS retorno:", err);
          saveGPSInfo('Acceso GPS denegado');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      saveGPSInfo('GPS no soportado');
    }
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

    const list = [];
    const panol = typeof ot.panol_status === 'string' ? JSON.parse(ot.panol_status) : ot.panol_status;
    const planta = typeof ot.planta_status === 'string' ? JSON.parse(ot.planta_status) : ot.planta_status;
    if (panol?.items) {
      panol.items.forEach(item => {
        list.push({ producto: item.producto, qty: item.qty, sector: item.sector || 'Pañol' });
      });
    }
    if (planta?.items) {
      planta.items.forEach(item => {
        list.push({ producto: item.producto, qty: item.qty, sector: item.sector || 'Planta' });
      });
    }
    
    const aggregatedList = aggregateProducts(list);
    
    const isLona = (name) => {
      const n = name.toLowerCase();
      return n.includes('lona') || n.includes('techo') || n.includes('lateral') || n.includes('triangulo') || n.includes('tapachata') || n.includes('puerta');
    };
    const isPiso = (name) => {
      const n = name.toLowerCase();
      return n.includes('piso') || n.includes('placa') || n.includes('fenolico') || n.includes('caño');
    };
    const isAlfombra = (name) => {
      const n = name.toLowerCase();
      return n.includes('alfombra');
    };
    const isTela = (name) => {
      const n = name.toLowerCase();
      return n.includes('tela') || n.includes('cortina') || n.includes('cielorraso');
    };

    const plantaItems = [];
    const panolItems = [];
    const lonasItems = [];
    const pisosItems = [];
    const alfombrasItems = [];
    const telasItems = [];

    aggregatedList.forEach(item => {
      const name = item.producto || '';
      const sector = item.sector || '';
      if (sector === 'Lonas' || isLona(name)) {
        lonasItems.push(item);
      } else if (sector === 'Pisos' || isPiso(name)) {
        pisosItems.push(item);
      } else if (sector === 'Alfombras' || isAlfombra(name)) {
        alfombrasItems.push(item);
      } else if (sector === 'Telas' || isTela(name)) {
        telasItems.push(item);
      } else if (sector === 'Planta') {
        plantaItems.push(item);
      } else if (sector === 'Pañol') {
        panolItems.push(item);
      } else {
        panolItems.push(item);
      }
    });

    let currentPage = 1;

    const checkPageWrap = (heightNeeded) => {
      if (y + heightNeeded > 235) {
        doc.addPage();
        currentPage++;
        drawOfficialHeader(doc, "CONTROL DESARME", ot.ot_numero, matchingClient?.cuit, logoImg);
        y = 60;
      }
    };

    const printSectorSection = (title, items, titleColor) => {
      if (items.length === 0) return;
      const rowCount = items.length;
      const boxH = rowCount * 6 + 7;
      const totalH = 4 + boxH + 6;

      checkPageWrap(totalH);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
      doc.text(title, startX, y);
      y += 4;

      doc.setDrawColor(220, 220, 220);
      doc.rect(startX, y, 180, boxH);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("COMPONENTE", startX + 4, y + 5);
      doc.text("CANTIDAD", startX + 100, y + 5);
      doc.text("SECTOR", startX + 130, y + 5);
      doc.text("ESTADO", startX + 160, y + 5);
      doc.line(startX, y + 7, startX + 180, y + 7);

      let itemY = y + 11;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);

      items.forEach((item, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(startX + 0.5, itemY - 3.5, 179.5, 5.5, 'F');
        }
        doc.text(String(item.producto).toUpperCase(), startX + 4, itemY);
        doc.text(String(item.qty), startX + 100, itemY);
        doc.text(String(item.sector || 'N/A').toUpperCase(), startX + 130, itemY);
        doc.text("[ OK / DEF ]", startX + 160, itemY);
        itemY += 6;
      });

      y += boxH + 5;
    };

    printSectorSection("SECTOR PLANTA (ESTRUCTURALES DE HIERRO/ALUMINIO)", plantaItems, [220, 104, 3]);
    printSectorSection("SECTOR PAÑOL (BULONERÍA, HERRAJES Y RÍGIDOS)", panolItems, [109, 40, 217]);
    printSectorSection("SECTOR TELAS (CORTINADOS Y CIELORRASOS)", telasItems, [79, 70, 229]);
    printSectorSection("SECTOR PISOS ( fenolicos y caños )", pisosItems, [5, 150, 105]);
    printSectorSection("SECTOR ALFOMBRAS ( revestimiento de pisos )", alfombrasItems, [101, 163, 13]);
    printSectorSection("SECTOR LONAS (TECHO, LATERALES, TRIÁNGULOS Y TAPACHATAS)", lonasItems, [13, 148, 136]);

    checkPageWrap(25);
    y += 5;
    doc.setFont('Helvetica', 'bold');
    doc.text("FIRMA RESPONSABLE CARGA / CHOFER", startX + 10, y + 15);
    doc.line(startX + 10, y + 13, startX + 70, y + 13);

    doc.text("FIRMA SUPERVISOR OBRA", startX + 110, y + 15);
    doc.line(startX + 110, y + 13, startX + 170, y + 13);

    doc.save(`Remito_PreArmado_Desarme_${ot.ot_numero}.pdf`);
  };

  const printDisassemblyRemitoOfficial = async (remito, otOrigen) => {
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

    const aggregatedItems = aggregateProducts(remito.items);

    const isLona = (name) => {
      const n = name.toLowerCase();
      return n.includes('lona') || n.includes('techo') || n.includes('lateral') || n.includes('triangulo') || n.includes('tapachata') || n.includes('puerta');
    };
    const isPiso = (name) => {
      const n = name.toLowerCase();
      return n.includes('piso') || n.includes('placa') || n.includes('fenolico') || n.includes('caño');
    };
    const isAlfombra = (name) => {
      const n = name.toLowerCase();
      return n.includes('alfombra');
    };
    const isTela = (name) => {
      const n = name.toLowerCase();
      return n.includes('tela') || n.includes('cortina') || n.includes('cielorraso');
    };

    const plantaItems = [];
    const panolItems = [];
    const lonasItems = [];
    const pisosItems = [];
    const alfombrasItems = [];
    const telasItems = [];

    aggregatedItems.forEach(item => {
      const name = item.producto || '';
      const sector = item.sector || '';
      if (sector === 'Lonas' || isLona(name)) {
        lonasItems.push(item);
      } else if (sector === 'Pisos' || isPiso(name)) {
        pisosItems.push(item);
      } else if (sector === 'Alfombras' || isAlfombra(name)) {
        alfombrasItems.push(item);
      } else if (sector === 'Telas' || isTela(name)) {
        telasItems.push(item);
      } else if (sector === 'Planta') {
        plantaItems.push(item);
      } else if (sector === 'Pañol') {
        panolItems.push(item);
      } else {
        panolItems.push(item);
      }
    });

    let currentPage = 1;

    const checkPageWrap = (heightNeeded) => {
      if (y + heightNeeded > 235) {
        doc.addPage();
        currentPage++;
        drawOfficialHeader(doc, `REMITO: ${remito.tipo}`, otOrigen.ot_numero, matchingClient?.cuit, logoImg);
        y = 60;
      }
    };

    const printSectorSection = (title, items, titleColor) => {
      if (items.length === 0) return;
      const rowCount = items.length;
      const boxH = rowCount * 6 + 7;
      const totalH = 4 + boxH + 6;

      checkPageWrap(totalH);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
      doc.text(title, startX, y);
      y += 4;

      doc.setDrawColor(220, 220, 220);
      doc.rect(startX, y, 180, boxH);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("PRODUCTO / COMPONENTE", startX + 4, y + 5);
      doc.text("CANTIDAD DESPACHADA", startX + 120, y + 5);
      doc.line(startX, y + 7, startX + 180, y + 7);

      let itemY = y + 11;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);

      items.forEach((item, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(startX + 0.5, itemY - 3.5, 179.5, 5.5, 'F');
        }
        doc.text(String(item.producto).toUpperCase(), startX + 4, itemY);
        doc.text(String(item.qty), startX + 120, itemY);
        itemY += 6;
      });

      y += boxH + 5;
    };

    printSectorSection("SECTOR PLANTA (ESTRUCTURALES DE HIERRO/ALUMINIO)", plantaItems, [220, 104, 3]);
    printSectorSection("SECTOR PAÑOL (BULONERÍA, HERRAJES Y RÍGIDOS)", panolItems, [109, 40, 217]);
    printSectorSection("SECTOR TELAS (CORTINADOS Y CIELORRASOS)", telasItems, [79, 70, 229]);
    printSectorSection("SECTOR PISOS ( fenolicos y caños )", pisosItems, [5, 150, 105]);
    printSectorSection("SECTOR ALFOMBRAS ( revestimiento de pisos )", alfombrasItems, [101, 163, 13]);
    printSectorSection("SECTOR LONAS (TECHO, LATERALES, TRIÁNGULOS Y TAPACHATAS)", lonasItems, [13, 148, 136]);

    checkPageWrap(25);
    y += 5;
    doc.setFont('Helvetica', 'bold');
    doc.text("FIRMA RESPONSABLE TRANSPORTE", startX + 10, y + 15);
    doc.line(startX + 10, y + 13, startX + 70, y + 13);

    doc.text("FIRMA CONTROL RECEPCION", startX + 110, y + 15);
    doc.line(startX + 110, y + 13, startX + 170, y + 13);

    doc.save(`Remito_${remito.tipo.replace(/\s+/g, '_')}_${otOrigen.ot_numero}.pdf`);
  };

  const generateRemitoPDF = async (ot) => {

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [16, 49, 107]; // Navy Blue
    const grayColor = [100, 116, 139];

    // Preload logo
    const logoImg = new Image();
    logoImg.src = '/cd.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });

    const panol = typeof ot.panol_status === 'string' ? JSON.parse(ot.panol_status) : ot.panol_status;
    const planta = typeof ot.planta_status === 'string' ? JSON.parse(ot.planta_status) : ot.planta_status;
    
    let checklistItems = [];
    if (panol?.items) {
      panol.items.forEach(i => checklistItems.push({ ...i, sector: i.sector || 'Pañol' }));
    }
    if (planta?.items) {
      planta.items.forEach(i => checklistItems.push({ ...i, sector: i.sector || 'Planta' }));
    }

    const loadedItems = checklistItems.filter(i => i.checked);
    const itemsToPrintRaw = loadedItems.length > 0 ? loadedItems : checklistItems;
    const itemsToPrint = aggregateProducts(itemsToPrintRaw);

    const isLona = (name) => {
      const n = name.toLowerCase();
      return n.includes('lona') || n.includes('techo') || n.includes('lateral') || n.includes('triangulo') || n.includes('tapachata') || n.includes('puerta');
    };
    const isPiso = (name) => {
      const n = name.toLowerCase();
      return n.includes('piso') || n.includes('placa') || n.includes('fenolico') || n.includes('caño');
    };
    const isAlfombra = (name) => {
      const n = name.toLowerCase();
      return n.includes('alfombra');
    };
    const isTela = (name) => {
      const n = name.toLowerCase();
      return n.includes('tela') || n.includes('cortina') || n.includes('cielorraso');
    };

    const plantaItems = [];
    const panolItems = [];
    const lonasItems = [];
    const pisosItems = [];
    const alfombrasItems = [];
    const telasItems = [];

    itemsToPrint.forEach(item => {
      const name = item.producto || item.nombre || '';
      const sector = item.sector || '';
      if (sector === 'Lonas' || isLona(name)) {
        lonasItems.push(item);
      } else if (sector === 'Pisos' || isPiso(name)) {
        pisosItems.push(item);
      } else if (sector === 'Alfombras' || isAlfombra(name)) {
        alfombrasItems.push(item);
      } else if (sector === 'Telas' || isTela(name)) {
        telasItems.push(item);
      } else if (sector === 'Planta') {
        plantaItems.push(item);
      } else if (sector === 'Pañol') {
        panolItems.push(item);
      } else {
        panolItems.push(item);
      }
    });

    const geo = typeof ot.georef === 'string' ? JSON.parse(ot.georef) : ot.georef;
    const direccion = geo?.direccion || 'No especificada';
    const lat = geo?.lat;
    const lng = geo?.lng;
    const kms = calculateKms(lat, lng);
    const gpsLink = (lat && lng)
      ? `https://www.google.com/maps/dir/?api=1&origin=-34.83473863535278,-58.42446638785623&destination=${lat},${lng}&travelmode=driving`
      : '';

    const matchingClient = clients?.find(c => c.id === ot.cliente_id);

    const splitDireccion = doc.splitTextToSize(`Dirección Entrega: ${direccion}`, 100);
    const clientBoxHeight = Math.max(28, 16 + (splitDireccion.length * 5));
    const startX = 15;

    let currentPage = 1;
    let y = 60 + clientBoxHeight + 5; // Starting position for items list

    const drawHeader = (pageNum) => {
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
      if (logoImg.complete && logoImg.naturalWidth > 0) {
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
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("REMITO", 112, 23);

      doc.setFontSize(10);
      doc.text(`N°: ${ot.ot_numero}`, 112, 28);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(`Fecha Emisión: ${new Date().toLocaleDateString('es-ES')}`, 112, 33);
      doc.text(`CUIT: ${matchingClient?.cuit || '30-71112223-4'}`, 112, 37);
      doc.text("Ing. Brutos: 30-71112223-4 (Conv. Multilateral)", 112, 41);
      doc.text("Inicio Actividades: 10/05/2012", 112, 45);

      // "Documento no válido como factura" watermark style
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(200, 50, 50);
      doc.text("DOCUMENTO NO VÁLIDO COMO FACTURA", 112, 51);

      // Client and Delivery Info Box
      doc.setFillColor(245, 247, 250);
      doc.rect(15, 60, 180, clientBoxHeight, 'FD');
      doc.setDrawColor(210, 215, 223);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("DESTINATARIO / ENTREGA", 18, 65);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(`Cliente: ${ot.cliente_nombre}`, 18, 71);
      
      let currentY = 76;
      splitDireccion.forEach((lineText) => {
        doc.text(lineText, 18, currentY);
        currentY += 4.5;
      });
      doc.text(`OT Referencia: ${ot.ot_numero}  |  Estado: ${ot.estado}`, 18, currentY);

      // Distance and route info inside client box (on the right)
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("DATOS DE RUTA", 125, 65);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Distancia Estimada: ${kms} km`, 125, 71);
      doc.text(`GPS Link: ${gpsLink ? 'Generado' : 'No disponible'}`, 125, 76);
    };

    const drawFooter = () => {
      // Draw signature boxes
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.25);

      // Chofer box
      doc.rect(15, 245, 85, 35);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text("CHOFER (DESPACHO)", 18, 250);
      doc.setFont('Helvetica', 'normal');
      doc.text("Firma: ____________________________", 18, 260);
      doc.text("Aclaración: ________________________", 18, 267);
      doc.text("DNI / Legajo: ______________________", 18, 274);

      // Client box
      doc.rect(110, 245, 85, 35);
      doc.setFont('Helvetica', 'bold');
      doc.text("RECIBÍ CONFORME (CLIENTE)", 113, 250);
      doc.setFont('Helvetica', 'normal');
      doc.text("Firma: ____________________________", 113, 260);
      doc.text("Aclaración: ________________________", 113, 267);
      doc.text("DNI / Relación: ____________________", 113, 274);
    };

    const checkPageWrap = (heightNeeded) => {
      if (y + heightNeeded > 235) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${currentPage} - Sigue en la siguiente página`, 15, 242);

        doc.addPage();
        currentPage++;

        drawHeader(currentPage);
        y = 60 + clientBoxHeight + 8;
      }
    };

    const printSectorSection = (title, items, titleColor) => {
      if (items.length === 0) return;
      const rowCount = items.length;
      const boxH = rowCount * 6 + 7;
      const totalH = 4 + boxH + 6;

      checkPageWrap(totalH);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
      doc.text(title, startX, y);
      y += 4;

      doc.setDrawColor(220, 220, 220);
      doc.rect(startX, y, 180, boxH);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("CANTIDAD", startX + 4, y + 5);
      doc.text("DETALLE / PRODUCTO ENVIADO", startX + 30, y + 5);
      doc.text("SECTOR ORIGEN", startX + 145, y + 5);
      doc.line(startX, y + 7, startX + 180, y + 7);

      let itemY = y + 11;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);

      items.forEach((item, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(startX + 0.5, itemY - 3.5, 179.5, 5.5, 'F');
        }
        doc.setFont('Helvetica', 'bold');
        doc.text(String(item.qty), startX + 6, itemY);
        doc.setFont('Helvetica', 'normal');

        const prodText = item.producto || 'Componente';
        const textWidth = doc.getTextWidth(prodText);
        let displayName = prodText;
        if (textWidth > 110) {
          displayName = doc.splitTextToSize(prodText, 110)[0] + '...';
        }
        doc.text(displayName, startX + 30, itemY);

        const secLabel = item.sector || item.computedSector || title.split(' ')[1] || 'OT';
        doc.text(String(secLabel).toUpperCase(), startX + 145, itemY);

        itemY += 6;
      });

      y += boxH + 5;
    };

    drawHeader(currentPage);

    // Render the 6 tables
    printSectorSection("SECTOR PLANTA (ESTRUCTURALES DE HIERRO/ALUMINIO)", plantaItems, [220, 104, 3]);
    printSectorSection("SECTOR PAÑOL (BULONERÍA, HERRAJES Y RÍGIDOS)", panolItems, [109, 40, 217]);
    printSectorSection("SECTOR TELAS (CORTINADOS Y CIELORRASOS)", telasItems, [79, 70, 229]);
    printSectorSection("SECTOR PISOS ( fenolicos y caños )", pisosItems, [5, 150, 105]);
    printSectorSection("SECTOR ALFOMBRAS ( revestimiento de pisos )", alfombrasItems, [101, 163, 13]);
    printSectorSection("SECTOR LONAS (TECHO, LATERALES, TRIÁNGULOS Y TAPACHATAS)", lonasItems, [13, 148, 136]);

    // Now draw the final footer on the last page
    drawFooter();

    doc.save(`Remito_${ot.ot_numero}.pdf`);
  };

  // Group OTs by status
  const pendingOTs = ots.filter(o => o.estado === 'Pendiente');
  const approvedByGerenciaOTs = ots.filter(o => o.estado === 'Aprobada por Gerencia');
  const approvedOTs = ots.filter(o => o.estado === 'Aprobada');
  const bultoCompletoOTs = ots.filter(o => o.estado === 'Bulto Completo');
  const completedOTs = ots.filter(o => o.estado === 'Completada');

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pendiente':
        return <span className="bg-yellow-100 text-yellow-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-yellow-250">Pendiente de Aprobación</span>;
      case 'Aprobada por Gerencia':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-purple-250">Aprobada por Gerencia</span>;
      case 'Rechazada':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-rose-250">Rechazada</span>;
      case 'Aprobada':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-blue-250">Aprobada (Stock Reservado)</span>;
      case 'Bulto Completo':
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-indigo-250">Bulto Completo</span>;
      case 'En Planta':
        return <span className="bg-orange-100 text-orange-850 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-orange-250">En Planta</span>;
      case 'Completada':
        return <span className="bg-emerald-100 text-emerald-850 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-250">Armado Completado</span>;
      case 'Cancelada':
        return <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-red-250">Cancelada</span>;
      case 'Desarmada':
        return <span className="bg-fuchsia-100 text-fuchsia-850 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-fuchsia-250">Desarmada (Logística Inversa)</span>;
      case 'Retornada':
        return <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-slate-300">Retornada al Depósito</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-slate-200">{status}</span>;
    }
  };

  const exportToCSV = () => {
    if (!structuresStock || structuresStock.length === 0) {
      alert("No hay datos de stock para exportar.");
      return;
    }

    const activeRole = currentUser?.rol || userRole;

    const filteredStructures = structuresStock.map(est => {
      const filteredMats = filterMaterials(est.materiales || [], activeRole);
      return {
        ...est,
        materiales: aggregateProducts(filteredMats)
      };
    }).filter(est => est.materiales.length > 0);

    if (filteredStructures.length === 0) {
      alert("No hay datos de stock disponibles para exportar con tu rol actual.");
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
    csvContent += "Estructura;Tipo;Frente (m);Largo Max (m);Componente/Producto;Sector;Total;Reservado (En Planta);En Uso (Fuera);Disponible;Ocupacion (%)\n";

    filteredStructures.forEach(est => {
      est.materiales.forEach(item => {
        const totalOccupied = item.reserved + item.inUse;
        const occupancyPct = item.total > 0 ? ((totalOccupied / item.total) * 100).toFixed(0) : "0";

        const row = [
          est.modelo_estructura,
          est.estructura_tipo,
          est.frente,
          est.largo_maximo,
          item.producto,
          item.sector,
          item.total,
          item.reserved,
          item.inUse,
          item.available,
          `${occupancyPct}%`
        ];

        const escapedRow = row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";");
        csvContent += escapedRow + "\n";
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Stock_Estructuras_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateStockPDF = async () => {
    if (!structuresStock || structuresStock.length === 0) {
      alert("No hay datos de stock para exportar.");
      return;
    }

    const activeRole = currentUser?.rol || userRole;

    const filteredStructures = structuresStock.map(est => {
      const filteredMats = filterMaterials(est.materiales || [], activeRole);
      return {
        ...est,
        materiales: filteredMats
      };
    }).filter(est => est.materiales.length > 0);

    if (filteredStructures.length === 0) {
      alert("No hay datos de stock disponibles para imprimir con tu rol actual.");
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [16, 49, 107]; // Blue
    const secondaryColor = [79, 70, 229]; // Indigo
    const grayColor = [100, 116, 139];

    // Preload logo
    const logoImg = new Image();
    logoImg.src = '/cd.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });

    let pageNum = 1;

    const printHeader = (pageNum) => {
      // Draw background header panel
      doc.setFillColor(245, 248, 253);
      doc.rect(15, 15, 180, 24, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.rect(15, 15, 180, 24);

      // Add logo
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        doc.addImage(logoImg, 'PNG', 18, 17, 20, 20);
      }

      // Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("CARPAS D'ANGIOLA S.A.", 42, 24);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text("INVENTARIO DE STOCK Y CONTROL DE OCUPACIÓN", 42, 29);
      doc.text("SISTEMA INTEGRAL DE LOGISTICA Y CONTROL", 42, 33);

      // Report Info
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("REPORTE DE STOCK", 135, 23);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text(`Fecha: ${new Date().toLocaleString('es-ES')}`, 135, 28);
      doc.text(`Página: ${pageNum}`, 135, 33);
    };

    let y = 45;
    printHeader(pageNum);

    filteredStructures.forEach((est, estIdx) => {
      // Check space before printing structure header (needs at least 35mm)
      if (y > 250) {
        doc.addPage();
        pageNum++;
        y = 45;
        printHeader(pageNum);
      }

      // Structure Header
      doc.setFillColor(240, 242, 245);
      doc.rect(15, y, 180, 8, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(15, y, 180, 8);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${est.modelo_estructura} — ${est.estructura_tipo} (Frente ${est.frente}m)  |  Largo Máx: ${est.largo_maximo}m`, 18, y + 5.5);

      y += 8;

      // Table Header for materials
      doc.setFillColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text("COMPONENTE", 18, y + 5);
      doc.text("SECTOR", 78, y + 5);
      doc.text("TOTAL", 102, y + 5);
      doc.text("RESERVADO", 120, y + 5);
      doc.text("EN USO", 145, y + 5);
      doc.text("DISPONIBLE", 168, y + 5);

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(15, y + 7, 195, y + 7);

      y += 7;

      // Print materials
      est.materiales.forEach((item) => {
        // Check space before printing row (needs at least 7mm)
        if (y > 275) {
          doc.addPage();
          pageNum++;
          y = 45;
          printHeader(pageNum);

          // Repeat structure header on new page
          doc.setFillColor(240, 242, 245);
          doc.rect(15, y, 180, 8, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.rect(15, y, 180, 8);
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text(`${est.modelo_estructura} (Continuación)`, 18, y + 5.5);
          y += 8;

          // Repeat table header
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          doc.text("COMPONENTE", 18, y + 5);
          doc.text("SECTOR", 78, y + 5);
          doc.text("TOTAL", 102, y + 5);
          doc.text("RESERVADO", 120, y + 5);
          doc.text("EN USO", 145, y + 5);
          doc.text("DISPONIBLE", 168, y + 5);
          doc.line(15, y + 7, 195, y + 7);
          y += 7;
        }

        // Print row
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(String(item.producto).toUpperCase(), 18, y + 5.5);
        doc.text(String(item.sector), 78, y + 5.5);
        doc.text(String(item.total), 104, y + 5.5);

        // Reserved
        if (item.reserved > 0) {
          doc.setTextColor(217, 119, 6); // Amber
          doc.text(String(item.reserved), 122, y + 5.5);
          doc.setTextColor(0, 0, 0);
        } else {
          doc.text("-", 122, y + 5.5);
        }

        // In Use
        if (item.inUse > 0) {
          doc.setTextColor(79, 70, 229); // Indigo
          doc.text(String(item.inUse), 147, y + 5.5);
          doc.setTextColor(0, 0, 0);
        } else {
          doc.text("-", 147, y + 5.5);
        }

        // Available
        if (item.available > 0) {
          doc.setTextColor(5, 150, 105); // Green
        } else {
          doc.setTextColor(220, 38, 38); // Red
        }
        doc.setFont('Helvetica', 'bold');
        doc.text(String(item.available), 170, y + 5.5);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        doc.line(15, y + 7.5, 195, y + 7.5);
        y += 7.5;
      });

      y += 5; // space between structures
    });

    doc.save(`Reporte_Stock_Estructuras_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const renderStockInventory = () => {
    if (!structuresStock || structuresStock.length === 0) {
      return (
        <div className="glass-panel rounded-[2rem] p-8 text-center text-slate-400 font-semibold italic">
          Cargando información del inventario de estructuras...
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Export Panel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 p-4 rounded-3xl border border-slate-200 shadow-sm backdrop-blur-md">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 Poppins">Exportar Inventario</h3>
            <p className="text-[10px] text-slate-500 font-semibold">Descarga el reporte de stock de estructuras en formato CSV o PDF impreso.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition-all-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={generateStockPDF}
              className="bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition-all-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Imprimir PDF</span>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {structuresStock.map((est) => {
            const activeRole = currentUser?.rol || userRole;
            const filteredMats = filterMaterials(est.materiales || [], activeRole);
            const aggregatedMats = aggregateProducts(filteredMats);
            if (aggregatedMats.length === 0) return null;
            return (
              <div key={est.modelo_estructura} className="glass-panel rounded-[2rem] p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black uppercase text-blue-900 tracking-wider Poppins flex items-center gap-2">
                      <span className="badge-carpa">{est.modelo_estructura}</span>
                      <span>{est.estructura_tipo} — Frente {est.frente} Mts</span>
                    </h3>
                    <p className="text-[10px] text-slate-450 font-semibold">Largo Máximo Configurable: {est.largo_maximo} Mts</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-slate-455 font-black uppercase tracking-widest">
                        <th className="pb-3 w-1/3">Componente / Producto</th>
                        <th className="pb-3 text-center">Sector</th>
                        <th className="pb-3 text-center">Total</th>
                        <th className="pb-3 text-center">Reservado (En Planta)</th>
                        <th className="pb-3 text-center">En Uso (Fuera)</th>
                        <th className="pb-3 text-center">Disponible</th>
                        <th className="pb-3 w-1/4 text-center">Ocupación / Uso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {aggregatedMats.map((item) => {
                        const totalOccupied = item.reserved + item.inUse;
                        const occupancyPct = item.total > 0 ? (totalOccupied / item.total) * 100 : 0;

                        return (
                          <tr key={item.producto} className="hover:bg-slate-50/50 transition-all-300">
                            <td className="py-3 font-extrabold text-slate-800 uppercase tracking-wide">{item.producto}</td>
                            <td className="py-3 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.sector === 'Planta' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                }`}>
                                {item.sector}
                              </span>
                            </td>
                            <td className="py-3 text-center font-bold text-slate-700">{item.total}</td>
                            <td className="py-3 text-center">
                              {item.reserved > 0 ? (
                                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-205">
                                  {item.reserved}
                                </span>
                              ) : (
                                <span className="text-slate-350 font-bold">-</span>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              {item.inUse > 0 ? (
                                <span className="bg-indigo-105 text-indigo-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                                  {item.inUse}
                                </span>
                              ) : (
                                <span className="text-slate-350 font-bold">-</span>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${item.available > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-250'
                                : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                {item.available}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2 justify-center">
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${occupancyPct >= 90 ? 'bg-red-500' : occupancyPct >= 50 ? 'bg-amber-500' : 'bg-blue-600'
                                      }`}
                                    style={{ width: `${Math.min(100, occupancyPct)}%` }}
                                  ></div>
                                </div>
                                <span className="text-[10px] font-black text-slate-500 font-mono w-10 text-right">{occupancyPct.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleBorrowItemSubmit = async (e) => {
    e.preventDefault();
    if (!borrowItem.item || !borrowItem.sourceEst || !borrowOTId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/ots/${borrowOTId}/checklist/extra-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_tomado: borrowItem.item,
          estructura_origen: borrowItem.sourceEst,
          cantidad: borrowItem.qty || 1,
          usuario: currentUser?.nombre || userName,
          rol: currentUser?.rol || userRole
        })
      });
      const data = await res.json();
      alert(data.message);
      setBorrowItem({ item: '', sourceEst: '', qty: 1 });
      setBorrowOTId(null);
      // reload
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Error al registrar componente prestado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Module Selector for users with multiple modules (like SuperAdmin or custom assigned) */}
      {allowedModules.length > 1 && (
        <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 w-fit flex-wrap">
          {allowedModules.includes('Gerencia') && (
            <button
              onClick={() => setActiveModule('Gerencia')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${activeModule === 'Gerencia' ? 'bg-indigo-700 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
                }`}
            >
              Gerencia
            </button>
          )}
          {allowedModules.includes('Comercial') && (
            <button
              onClick={() => setActiveModule('Comercial')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${activeModule === 'Comercial' ? 'bg-blue-900 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
                }`}
            >
              Comercial
            </button>
          )}
          {allowedModules.includes('Operaciones') && (
            <button
              onClick={() => setActiveModule('Operaciones')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${activeModule === 'Operaciones' ? 'bg-blue-900 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
                }`}
            >
              Operaciones
            </button>
          )}
          {allowedModules.includes('Almacen') && (
            <button
              onClick={() => setActiveModule('Almacen')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${activeModule === 'Almacen' ? 'bg-blue-900 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
                }`}
            >
              Depositos
            </button>
          )}
          {allowedModules.includes('Chofer') && (
            <button
              onClick={() => setActiveModule('Chofer')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer ${activeModule === 'Chofer' ? 'bg-blue-900 text-white shadow' : 'text-slate-650 hover:bg-slate-200/50'
                }`}
            >
              Chofer
            </button>
          )}
        </div>
      )}

      {/* -------------------- GENERAL SYSTEM STATS & ALERTS -------------------- */}
      {/* -------------------- COORDINATION MENTIONS & ALERTS -------------------- */}
      {chatAlerts && chatAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-150 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-900">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              <h4 className="text-xs font-black uppercase tracking-wider Poppins flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-700" />
                Menciones en Chat de Coordinación ({chatAlerts.length})
              </h4>
            </div>
            <button
              onClick={() => onFetchChatAlerts && onFetchChatAlerts()}
              className="text-[10px] font-black uppercase tracking-wider text-indigo-700 hover:text-indigo-900 transition-all-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Actualizar</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
            {chatAlerts.map((alert) => {
              const matchingOT = ots.find(o => o.id === alert.ot_id);
              return (
                <div key={alert.id} className="bg-white/85 border border-indigo-100 rounded-xl p-3 flex flex-col justify-between gap-2.5 shadow-xs hover:border-indigo-200 transition-all-300">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[10px] text-slate-500 font-extrabold flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-450" />
                        <span className="text-slate-700 font-black">{alert.usuario}</span> ({alert.rol})
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400">
                        {new Date(alert.fecha_envio).toLocaleDateString('es-ES')} {new Date(alert.fecha_envio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold">
                      En <span className="font-mono font-black text-blue-900">{alert.ot_numero}</span> - <span className="text-slate-650 font-black">{alert.cliente_nombre}</span>
                    </div>
                    <p className="text-xs text-slate-750 bg-slate-50/50 p-2 rounded-lg italic border border-slate-100 font-medium line-clamp-2 leading-relaxed">
                      "{alert.mensaje}"
                    </p>
                  </div>
                  {matchingOT && (
                    <button
                      onClick={() => onSelectOT(matchingOT)}
                      className="w-full bg-indigo-700 hover:bg-indigo-850 text-white rounded-lg py-1.5 text-[9px] font-black uppercase tracking-widest shadow-xs transition-all-300 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Chat / 3D de la Obra</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {structures && structures.some(s => s.estado === 'Incompleta / No Disponible para Eventos') && (
        <div className="bg-red-50 border border-red-250 text-red-800 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider Poppins">¡ALERTA DE ESTRUCTURA INCOMPLETA EN PLANTA!</h4>
            <p className="text-xs text-red-700 mt-1 font-medium">
              Los siguientes pórticos/estructuras tienen piezas prestadas a otras obras y están bloqueados para reservas comerciales:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {structures.filter(s => s.estado === 'Incompleta / No Disponible para Eventos').map(s => (
                <span key={s.id} className="bg-red-150 border border-red-300 text-red-900 text-[10px] font-black px-2 py-0.5 rounded-md uppercase font-mono">
                  {s.modelo_estructura}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- COMMERCIAL DASHBOARD -------------------- */}
      {activeModule === 'Comercial' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 p-5 rounded-3xl border border-slate-200 shadow-sm backdrop-blur-md">
            <div>
              <h2 className="text-lg font-black uppercase text-blue-900 tracking-wider Poppins">Portal Comercial</h2>
              <p className="text-xs text-slate-500 font-semibold">Genera cotizaciones, accede a Realidad Aumentada para visualizar carpas y controla tus operaciones.</p>
            </div>
            <button
              onClick={onCreateOTClick}
              className="bg-blue-900 text-white rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-widest shadow-md hover:bg-blue-950 hover:-translate-y-0.5 transition-all-300 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generar Nueva OT</span>
            </button>
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 Poppins">Historial de Contratos OT</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-slate-400 font-black uppercase tracking-widest">
                    <th className="pb-3">OT N°</th>
                    <th className="pb-3">Cliente</th>
                    <th className="pb-3">Fechas</th>
                    <th className="pb-3">Estructura</th>
                    <th className="pb-3 pr-4">Superficie / Estado</th>
                    <th className="pb-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ots.map((ot) => (
                    <tr key={ot.id} className="hover:bg-slate-50/50 transition-all-300">
                      <td className="py-4 font-black text-blue-900 font-mono">{ot.ot_numero}</td>
                      <td className="py-4">
                        <div className="font-extrabold text-slate-800">{ot.cliente_nombre}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{ot.cliente_cuit || ot.cuit}</div>
                      </td>
                      <td className="py-4 font-semibold text-slate-600">
                        {new Date(ot.fecha_inicio).toLocaleDateString('es-ES')} a {new Date(ot.fecha_fin).toLocaleDateString('es-ES')}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="badge-carpa">{['Pendiente', 'Aprobada por Gerencia'].includes(ot.estado) ? 'A Confirmar' : ot.modelo_estructura}</span>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">{ot.estructura_tipo}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 whitespace-nowrap">{ot.superficie || (ot.frente * ot.largo)} m²</span>
                          {getStatusBadge(ot.estado)}
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <button
                          onClick={() => onSelectOT(ot)}
                          className="bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all-300 cursor-pointer"
                        >
                          Ver Detalle / 3D
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ots.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-slate-400 font-semibold italic">No hay órdenes de trabajo cargadas en el sistema.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- OPERATIONS / GERENCIA DASHBOARD -------------------- */}
      {activeModule === 'Operaciones' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 p-5 rounded-3xl border border-slate-200 shadow-sm backdrop-blur-md">
            <div>
              <h2 className="text-lg font-black uppercase text-blue-900 tracking-wider Poppins">Portal de Operaciones</h2>
              <p className="text-xs text-slate-500 font-semibold">Ejecuta Explosión de Materiales y Gestión de OTs.</p>
            </div>
          </div>

          {/* URGENT DISASSEMBLY ALERTS */}
          {disassemblyAlerts.length > 0 && (
            <div className="border-2 border-fuchsia-300 rounded-[2rem] p-6 bg-fuchsia-50/30 shadow-md space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-fuchsia-600 animate-bounce" />
                <h3 className="text-sm font-black uppercase text-fuchsia-900 tracking-wider Poppins">Alertas Críticas de Logística Inversa (Desarme Pendiente)</h3>
              </div>
              <p className="text-xs text-fuchsia-800 font-semibold">
                Las siguientes OTs activas están a menos de 48 horas de su desarme planificado o se encuentran vencidas. Debe crear la Orden de Desarme correspondiente:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {disassemblyAlerts.map(ot => (
                  <div key={ot.id} className="bg-white/95 border border-fuchsia-200 rounded-2xl p-4 flex justify-between items-center gap-4 hover:border-fuchsia-400 transition-all-300 shadow-sm">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono font-black text-fuchsia-700 text-xs">{ot.ot_numero}</span>
                        <span className="text-[10px] font-black text-slate-800 uppercase">{ot.cliente_nombre}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        Estructura: {ot.modelo_estructura} ({ot.frente}x{ot.largo}m)
                      </div>
                      <div className="text-[10px] text-fuchsia-700 font-extrabold mt-1">
                        Desarme original: {new Date(ot.fecha_fin + 'T00:00:00').toLocaleDateString('es-ES')}
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectOT(ot)}
                      className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all-300 cursor-pointer shadow-sm shrink-0"
                    >
                      Crear Orden de Desarme
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-tab Navigation */}
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setOperacionesSubTab('ots')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all-300 ${operacionesSubTab === 'ots'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              Gestión de OTs
            </button>
            <button
              onClick={() => setOperacionesSubTab('stock')}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all-300 ${operacionesSubTab === 'stock'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              Consulta de Stock Total
            </button>
          </div>

          {operacionesSubTab === 'stock' ? (
            renderStockInventory()
          ) : (
            <>
              {/* Section A: Pending Commercial Approvals (Only visible to Gerencia or SuperAdmin) */}
              {(userRole === 'Gerencia' || userRole === 'SuperAdmin') && (
                <div className="glass-panel rounded-[2rem] p-6">
                  <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 Poppins">Contratos Pendientes de Aprobación Comercial (Gerencia) ({pendingOTs.length})</h3>
                  <div className="space-y-4">
                    {pendingOTs.map((ot) => (
                      <div key={ot.id} className="bg-white/80 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-slate-300 transition-all-300">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-red-650 text-sm">{ot.ot_numero}</span>
                            <span className="text-xs font-black text-slate-800 uppercase">{ot.cliente_nombre}</span>
                            {getStatusBadge(ot.estado)}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs font-semibold text-slate-600">
                            <div><span className="text-slate-400">Estructura:</span> {ot.modelo_estructura} ({ot.frente}x{ot.largo}m)</div>
                            <div><span className="text-slate-400">Superficie:</span> {ot.superficie} m²</div>
                            <div><span className="text-slate-400">Montaje:</span> {new Date(ot.fecha_inicio).toLocaleDateString()}</div>
                            <div><span className="text-slate-400">Desarme:</span> {new Date(ot.fecha_fin).toLocaleDateString()}</div>
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5 line-clamp-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{ot.georef?.direccion}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                          <button
                            onClick={() => onSelectOT(ot)}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer"
                          >
                            Revisar Planos / 3D
                          </button>
                          <button
                            disabled={loading}
                            onClick={async () => {
                              setLoading(true);
                              await onUpdateOTStatus(ot.id, 'Aprobada por Gerencia');
                              setLoading(false);
                            }}
                            className="bg-blue-900 hover:bg-blue-950 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all-300 cursor-pointer"
                          >
                            Aceptar
                          </button>
                          <button
                            disabled={loading}
                            onClick={async () => {
                              if (window.confirm("¿Estás seguro de desaprobar/rechazar este contrato?")) {
                                setLoading(true);
                                await onUpdateOTStatus(ot.id, 'Rechazada');
                                setLoading(false);
                              }
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all-300 cursor-pointer"
                          >
                            Desaprobar
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingOTs.length === 0 && (
                      <div className="text-center py-8 text-slate-400 font-semibold italic">No hay contratos pendientes de aprobación por Gerencia.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Section B: Approved by Gerencia - Pending Modulation (Visible to Operaciones, Gerencia, SuperAdmin) */}
              <div className="glass-panel rounded-[2rem] p-6">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 Poppins">Contratos Aprobados por Gerencia - Pendientes de Modulación ({approvedByGerenciaOTs.length})</h3>
                <div className="space-y-4">
                  {approvedByGerenciaOTs.map((ot) => (
                    <div key={ot.id} className="bg-white/80 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-slate-300 transition-all-300">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-purple-700 text-sm">{ot.ot_numero}</span>
                          <span className="text-xs font-black text-slate-800 uppercase">{ot.cliente_nombre}</span>
                          {getStatusBadge(ot.estado)}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs font-semibold text-slate-600">
                          <div><span className="text-slate-400">Estructura:</span> {ot.modelo_estructura} ({ot.frente}x{ot.largo}m)</div>
                          <div><span className="text-slate-400">Superficie:</span> {ot.superficie} m²</div>
                          <div><span className="text-slate-400">Montaje:</span> {new Date(ot.fecha_inicio).toLocaleDateString()}</div>
                          <div><span className="text-slate-400">Desarme:</span> {new Date(ot.fecha_fin).toLocaleDateString()}</div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5 line-clamp-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{ot.georef?.direccion}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                        <button
                          onClick={() => onSelectOT(ot)}
                          className="bg-purple-900 hover:bg-purple-950 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all-305 cursor-pointer"
                        >
                          Modular Estructura
                        </button>
                      </div>
                    </div>
                  ))}
                  {approvedByGerenciaOTs.length === 0 && (
                    <div className="text-center py-8 text-slate-400 font-semibold italic">No hay contratos aprobados por Gerencia esperando modulación.</div>
                  )}
                </div>
              </div>

              {/* General Active OTs Log */}
              <div className="glass-panel rounded-[2rem] p-6">
                <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 Poppins">Log General de Contratos Activos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-slate-400 font-black uppercase tracking-widest">
                        <th className="pb-3">OT N°</th>
                        <th className="pb-3">Cliente</th>
                        <th className="pb-3">Fechas</th>
                        <th className="pb-3">Estructura</th>
                        <th className="pb-3 pr-4">Superficie / Estado</th>
                        <th className="pb-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ots.map((ot) => (
                        <tr key={ot.id} className="hover:bg-slate-50/50 transition-all-300">
                          <td className="py-4 font-black text-blue-900 font-mono">{ot.ot_numero}</td>
                          <td className="py-4">
                            <div className="font-extrabold text-slate-800">{ot.cliente_nombre}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">{ot.cliente_cuit || ot.cuit}</div>
                          </td>
                          <td className="py-4 font-semibold text-slate-600">
                            {new Date(ot.fecha_inicio).toLocaleDateString('es-ES')} a {new Date(ot.fecha_fin).toLocaleDateString('es-ES')}
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <span className="badge-carpa">{['Pendiente', 'Aprobada por Gerencia'].includes(ot.estado) ? 'A Confirmar' : ot.modelo_estructura}</span>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase">{ot.estructura_tipo}</span>
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 whitespace-nowrap">{ot.superficie || (ot.frente * ot.largo)} m²</span>
                              {getStatusBadge(ot.estado)}
                            </div>
                          </td>
                          <td className="py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => onSelectOT(ot)}
                                className="bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all-300 cursor-pointer"
                              >
                                Revisar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* -------------------- WAREHOUSE STAFF DASHBOARD (PLANTA & PAÑOL) -------------------- */}
      {activeModule === 'Almacen' && (
        <div className="space-y-6">
          <div className="bg-white/40 p-5 rounded-3xl border border-slate-200 shadow-sm backdrop-blur-md">
            <h2 className="text-lg font-black uppercase text-blue-900 tracking-wider Poppins">Portal Operativo de Depósitos - {userRole.toUpperCase()}</h2>
            <p className="text-xs text-slate-500 font-semibold">Procesa checklists de carga digital de piezas de carpas y marca el envío a obra.</p>
          </div>

          {/* Main check board */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* OTs list in process */}
            <div className="lg:col-span-1 glass-panel rounded-[2rem] p-5 space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 Poppins">Órdenes de Trabajo Activas</h3>

              <div className="flex gap-2 border-b border-slate-100 pb-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all-300 ${activeTab === 'all' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setActiveTab('aprobadas')}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all-300 ${activeTab === 'aprobadas' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Aprobadas ({approvedOTs.length})
                </button>
                <button
                  onClick={() => setActiveTab('bultos')}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all-300 ${activeTab === 'bultos' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Bultos Compl. ({bultoCompletoOTs.length})
                </button>
              </div>

              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {(() => {
                  const filteredOts = ots
                    .filter(ot => {
                      if (ot.estado === 'Pendiente' || ot.estado === 'Aprobada por Gerencia' || ot.estado === 'Rechazada' || ot.estado === 'Cancelada') return false;
                      if (activeTab === 'aprobadas') return ot.estado === 'Aprobada';
                      if (activeTab === 'bultos') return ot.estado === 'Bulto Completo';
                      return true;
                    })
                    .filter(ot => {
                      const actualRole = currentUser?.rol || userRole;
                      if (actualRole === 'Operario') {
                        const username = currentUser?.username || userName;
                        const userId = currentUser?.id || null;
                        return isUserAssignedToOT(ot, userId, username, personalList);
                      }
                      return true;
                    });

                  if (filteredOts.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-400 font-semibold italic">No hay órdenes de trabajo activas para cargar.</div>
                    );
                  }

                  return filteredOts.map((ot) => (
                    <button
                      key={ot.id}
                      onClick={() => onSelectOT(ot)}
                      className="w-full text-left p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 transition-all-300 shadow-xs hover:shadow-md cursor-pointer block"
                    >
                      <div className="flex justify-between items-center gap-2 mb-2">
                        <span className="font-mono font-black text-blue-900">{ot.ot_numero}</span>
                        {getStatusBadge(ot.estado)}
                      </div>
                      <div className="font-extrabold text-slate-800 mb-1">{ot.cliente_nombre}</div>
                      <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{ot.modelo_estructura} ({ot.frente}x{ot.largo}m)</span>
                      </div>
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* Checklist interface details */}
            <div className="lg:col-span-2 glass-panel rounded-[2rem] p-6 space-y-6">
              <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 Poppins">Detalle del Cargado Físico y Checklists</h3>
              <p className="text-xs text-slate-500 italic">Selecciona una Orden de Trabajo del menú izquierdo para inspeccionar y marcar ítems.</p>

              {/* Borrowing item wizard */}
              <div className="border border-purple-200 bg-purple-50/50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-purple-900">
                  <AlertTriangle className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-black uppercase tracking-wider Poppins">Registrar Componente Prestado (Alerta de Incompleta)</span>
                </div>
                <p className="text-[10px] text-purple-800 leading-relaxed">
                  Si durante la carga de un camión te falta una pieza y decides sacarla de otro juego de estructura, selecciona la estructura origen aquí. El sistema descontará la pieza y **bloqueará** automáticamente esa estructura matriz en Planta para evitar futuras reservas comerciales incompletas.
                </p>
                {(() => {
                  const activeOTStructureModels = new Set(
                    ots
                      .filter(ot => ot.estado !== 'Cancelada' && ot.estado !== 'Rechazada')
                      .map(ot => ot.modelo_estructura)
                  );

                  const reservedOrInUseModels = new Set();
                  structuresStock.forEach(s => {
                    if (s.materiales && s.materiales.some(m => m.reserved > 0 || m.inUse > 0)) {
                      reservedOrInUseModels.add(s.modelo_estructura);
                    }
                  });

                  const selectedEst = structuresStock.find(s => s.modelo_estructura === borrowItem.sourceEst);
                  const selectedEstMaterials = selectedEst ? selectedEst.materiales : [];

                  const activeRole = currentUser?.rol || userRole;
                  const filteredEstMaterials = filterMaterials(selectedEstMaterials, activeRole);

                  // Filter out materials that are reserved or in use
                  const availableMaterials = filteredEstMaterials.filter(m =>
                    m.available > 0 &&
                    m.reserved === 0 &&
                    m.inUse === 0
                  );
                  const selectedMaterial = filteredEstMaterials.find(m => m.producto === borrowItem.item);
                  const maxAvailable = selectedMaterial ? selectedMaterial.available : 1;

                  return (
                    <form onSubmit={handleBorrowItemSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">OT de Destino</label>
                        <select
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none"
                          value={borrowOTId || ''}
                          onChange={(e) => setBorrowOTId(parseInt(e.target.value))}
                        >
                          <option value="">Selecciona OT...</option>
                          {ots.filter(o => o.estado === 'Aprobada' || o.estado === 'Bulto Completo' || o.estado === 'En Planta').map(o => (
                            <option key={o.id} value={o.id}>{o.ot_numero} - {o.cliente_nombre}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Estructura Origen</label>
                        <select
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none"
                          value={borrowItem.sourceEst}
                          onChange={(e) => {
                            const newSource = e.target.value;
                            const nextEst = structuresStock.find(s => s.modelo_estructura === newSource);
                            const activeRole = currentUser?.rol || userRole;
                            const filteredMats = nextEst ? filterMaterials(nextEst.materiales || [], activeRole) : [];
                            const nextAvailableMats = filteredMats.filter(m => m.available > 0 && m.reserved === 0 && m.inUse === 0);
                            setBorrowItem({
                              sourceEst: newSource,
                              item: nextAvailableMats[0] ? nextAvailableMats[0].producto : '',
                              qty: 1
                            });
                          }}
                        >
                          <option value="">Seleccionar...</option>
                          {structures && structures
                            .filter(s => !activeOTStructureModels.has(s.modelo_estructura) && !reservedOrInUseModels.has(s.modelo_estructura))
                            .map(s => (
                              <option key={s.id} value={s.modelo_estructura}>{s.modelo_estructura}</option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Pieza Tomada</label>
                        <select
                          disabled={!borrowItem.sourceEst}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none disabled:opacity-50 disabled:bg-slate-50 text-[11px]"
                          value={borrowItem.item}
                          onChange={(e) => {
                            const newProduct = e.target.value;
                            const mat = selectedEstMaterials.find(m => m.producto === newProduct);
                            const maxAv = mat ? mat.available : 1;
                            setBorrowItem(prev => ({
                              ...prev,
                              item: newProduct,
                              qty: Math.min(prev.qty, maxAv)
                            }));
                          }}
                        >
                          {!borrowItem.sourceEst ? (
                            <option value="">Primero elija origen...</option>
                          ) : availableMaterials.length === 0 ? (
                            <option value="">Sin stock disponible</option>
                          ) : (
                            <>
                              <option value="">Seleccionar pieza...</option>
                              {availableMaterials.map(m => (
                                <option key={m.producto} value={m.producto}>
                                  {m.producto} ({m.available})
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block mb-1">Cantidad (Stock: {selectedMaterial ? maxAvailable : 0})</label>
                        <input
                          type="number"
                          min="1"
                          max={maxAvailable}
                          disabled={!borrowItem.item}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none disabled:opacity-50 disabled:bg-slate-50"
                          value={borrowItem.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            const capped = Math.min(Math.max(1, val), maxAvailable);
                            setBorrowItem(prev => ({ ...prev, qty: capped }));
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !borrowOTId || !borrowItem.sourceEst || !borrowItem.item}
                        className="w-full bg-purple-750 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider shadow hover:bg-purple-850 transition-all-300 disabled:opacity-50 cursor-pointer h-[38px]"
                      >
                        Reportar
                      </button>
                    </form>
                  );
                })()}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* -------------------- CHOFER DASHBOARD -------------------- */}
      {activeModule === 'Chofer' && (() => {
        const dispatchesPending = ots.filter(o => ['Aprobada', 'En Planta', 'Bulto Completo'].includes(o.estado));
        const dispatchesCompleted = ots.filter(o => o.estado === 'Completada');
        const disassemblies = ots.filter(o => ['Completada', 'Desarmada'].includes(o.estado));


        return (
          <div className="space-y-6">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-6 rounded-3xl text-white shadow-md relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-xl font-black uppercase tracking-wider Poppins flex items-center gap-2">
                  <Truck className="w-6 h-6 text-blue-300" />
                  Tablero del Chofer - Hoja de Ruta y Remitos
                </h2>
                <p className="text-xs text-blue-200 font-semibold mt-1">
                  Visualiza despachos listos, calcula distancias de entrega, descarga remitos y navega en tiempo real.
                </p>
              </div>
              <div className="absolute right-5 bottom-0 opacity-10 transform translate-x-6 translate-y-6">
                <Truck className="w-48 h-48" />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Panel 1: Pendientes de Despacho */}
              <div className="glass-panel rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-widest font-black text-blue-700 Poppins flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    1. Despachos Listos para Entrega ({dispatchesPending.length})
                  </h3>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-blue-250">
                    Cargados
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Órdenes con carga física completa en Planta y Pañol listas para salir.
                </p>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {dispatchesPending.map((ot) => {
                    const geo = typeof ot.georef === 'string' ? JSON.parse(ot.georef) : ot.georef;
                    const lat = geo?.lat;
                    const lng = geo?.lng;
                    const address = geo?.direccion || 'No especificada';
                    const kms = calculateKms(lat, lng);
                    const adObj = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
                    const gpsLink = (lat && lng)
                      ? `https://www.google.com/maps/dir/?api=1&origin=-34.83473863535278,-58.42446638785623&destination=${lat},${lng}&travelmode=driving`
                      : null;

                    return (
                      <div
                        key={ot.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 hover:border-blue-300 transition-all-300"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-mono font-black text-blue-900 text-xs block">{ot.ot_numero}</span>
                            <span className="font-black text-sm text-slate-800">{ot.cliente_nombre}</span>
                          </div>
                          <span className="bg-indigo-50 text-indigo-700 text-[9px] font-extrabold px-2 py-0.5 rounded border border-indigo-200 uppercase">
                            {ot.modelo_estructura}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>
                            <strong className="block text-slate-400 font-bold uppercase tracking-wider text-[8px] mb-0.5">Destino</strong>
                            <span className="font-semibold text-slate-700 block truncate" title={address}>
                              {address}
                            </span>
                          </div>
                          <div>
                            <strong className="block text-slate-400 font-bold uppercase tracking-wider text-[8px] mb-0.5">Distancia Estimada</strong>
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-blue-700" />
                              {kms} km (Ruta óptima)
                            </span>
                          </div>
                        </div>

                        {/* Recorrido Visual */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[10px] space-y-1.5">
                          <strong className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Recorrido</strong>
                          <div className="flex items-center gap-1.5 flex-wrap font-semibold text-slate-700">
                            <span className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                              <Warehouse className="w-3.5 h-3.5 text-blue-900" />
                              Depósito Central
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 max-w-xs truncate" title={address}>
                              <MapPin className="w-3.5 h-3.5 text-indigo-700" />
                              Obra: {address.split(',')[0]}
                            </span>
                          </div>
                        </div>

                        {/* Checkbox de llegada para el Chofer */}
                        <div className="flex items-center gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50">
                          <input
                            type="checkbox"
                            id={`llegada-pending-${ot.id}`}
                            checked={adObj.chofer_llegada || false}
                            disabled={adObj.chofer_llegada || false}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              if (!checked) return;
                              if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                  async (position) => {
                                    const lat = position.coords.latitude;
                                    const lng = position.coords.longitude;
                                    const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                                    const ad = {
                                      chofer_llegada: true,
                                      chofer_llegada_fecha: new Date().toISOString(),
                                      chofer_llegada_coords: coordsStr
                                    };
                                    if (onUpdateAdicionales) {
                                      await onUpdateAdicionales(ot.id, ad);
                                    }
                                  },
                                  async (err) => {
                                    console.error("Error obteniendo ubicación:", err);
                                    const ad = {
                                      chofer_llegada: true,
                                      chofer_llegada_fecha: new Date().toISOString(),
                                      chofer_llegada_coords: 'Acceso GPS denegado'
                                    };
                                    if (onUpdateAdicionales) {
                                      await onUpdateAdicionales(ot.id, ad);
                                    }
                                  },
                                  { enableHighAccuracy: true, timeout: 5000 }
                                );
                              } else {
                                const ad = {
                                  chofer_llegada: true,
                                  chofer_llegada_fecha: new Date().toISOString(),
                                  chofer_llegada_coords: 'GPS no soportado'
                                };
                                if (onUpdateAdicionales) {
                                  await onUpdateAdicionales(ot.id, ad);
                                }
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                          <label htmlFor={`llegada-pending-${ot.id}`} className="text-[10px] font-bold text-slate-700 cursor-pointer flex flex-col">
                            <span>Llegada a Destino (GPS)</span>
                            {adObj.chofer_llegada_fecha && (
                              <span className="text-[9px] text-emerald-700 font-semibold flex flex-col mt-0.5">
                                <span>Llegó: {new Date(adObj.chofer_llegada_fecha).toLocaleTimeString('es-ES')}</span>
                                {adObj.chofer_llegada_coords && (
                                  <span className="text-[8px] text-slate-500 font-normal">Coords: {adObj.chofer_llegada_coords}</span>
                                )}
                              </span>
                            )}
                          </label>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {gpsLink ? (
                            <a
                              href={gpsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-[120px] bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5 shadow-sm transition-all-300"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              Navegar (GPS)
                            </a>
                          ) : (
                            <button
                              disabled
                              className="flex-1 min-w-[120px] bg-slate-100 text-slate-400 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5 border border-slate-200"
                            >
                              GPS no disp.
                            </button>
                          )}

                           <button
                            type="button"
                            onClick={() => onWeatherAnalysis && onWeatherAnalysis(ot)}
                            className="flex-1 min-w-[120px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-250 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all-300 cursor-pointer"
                          >
                            <Sun className="w-3.5 h-3.5 text-amber-600" />
                            Análisis Climático
                          </button>

                          <button
                            onClick={() => generateRemitoPDF(ot)}
                            className="flex-1 min-w-[120px] bg-blue-900 hover:bg-blue-955 text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all-300 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Remito PDF
                          </button>

                          <button
                            onClick={async () => {
                              if (confirm(`¿Confirmar entrega y finalización del despacho para la OT ${ot.ot_numero}?`)) {
                                await onUpdateOTStatus(ot.id, 'Completada');
                              }
                            }}
                            className="w-full bg-slate-900 hover:bg-black text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all-300 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Confirmar Entrega
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {dispatchesPending.length === 0 && (
                    <div className="text-center py-12 text-slate-400 font-semibold italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No hay despachos listos pendientes de envío en este momento.
                    </div>
                  )}
                </div>
              </div>

              {/* Panel 2: Entregas Realizadas / Historial */}
              <div className="glass-panel rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-widest font-black text-slate-500 Poppins flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    2. Historial de Entregas Completadas ({dispatchesCompleted.length})
                  </h3>
                  <span className="bg-emerald-100 text-emerald-850 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-emerald-250">
                    Entregadas
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Órdenes que ya fueron entregadas en obra y despachadas con éxito.
                </p>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {dispatchesCompleted.map((ot) => {
                    const geo = typeof ot.georef === 'string' ? JSON.parse(ot.georef) : ot.georef;
                    const lat = geo?.lat;
                    const lng = geo?.lng;
                    const address = geo?.direccion || 'No especificada';
                    const kms = calculateKms(lat, lng);
                    const adObj = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
                    const gpsLink = (lat && lng)
                      ? `https://www.google.com/maps/dir/?api=1&origin=-34.83473863535278,-58.42446638785623&destination=${lat},${lng}&travelmode=driving`
                      : null;

                    return (
                      <div
                        key={ot.id}
                        className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3 opacity-90"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-mono font-black text-slate-500 text-xs block">{ot.ot_numero}</span>
                            <span className="font-bold text-sm text-slate-700">{ot.cliente_nombre}</span>
                          </div>
                          <span className="bg-slate-100 text-slate-650 text-[9px] font-extrabold px-2 py-0.5 rounded border border-slate-200 uppercase">
                            {ot.modelo_estructura}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-500">
                          <div>
                            <strong>Destino:</strong> {address}
                          </div>
                          <div>
                            <strong>Distancia:</strong> {kms} km
                          </div>
                        </div>

                        {/* Recorrido Visual */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[10px] space-y-1.5 opacity-90">
                          <strong className="block text-slate-455 font-bold uppercase tracking-wider text-[8px]">Recorrido</strong>
                          <div className="flex items-center gap-1.5 flex-wrap font-semibold text-slate-600">
                            <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              <Warehouse className="w-3.5 h-3.5 text-slate-550" />
                              Depósito Central
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 max-w-xs truncate" title={address}>
                              <MapPin className="w-3.5 h-3.5 text-slate-550" />
                              Obra: {address.split(',')[0]}
                            </span>
                          </div>
                        </div>

                        {/* Estado llegada confirmada en historial */}
                        <div className="flex items-center gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50 mt-1">
                          <input
                            type="checkbox"
                            id={`llegada-completed-${ot.id}`}
                            checked={adObj.chofer_llegada || false}
                            disabled={adObj.chofer_llegada || false}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              if (!checked) return;
                              if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                  async (position) => {
                                    const lat = position.coords.latitude;
                                    const lng = position.coords.longitude;
                                    const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                                    const ad = {
                                      chofer_llegada: true,
                                      chofer_llegada_fecha: new Date().toISOString(),
                                      chofer_llegada_coords: coordsStr
                                    };
                                    if (onUpdateAdicionales) {
                                      await onUpdateAdicionales(ot.id, ad);
                                    }
                                  },
                                  async (err) => {
                                    console.error("Error obteniendo ubicación:", err);
                                    const ad = {
                                      chofer_llegada: true,
                                      chofer_llegada_fecha: new Date().toISOString(),
                                      chofer_llegada_coords: 'Acceso GPS denegado'
                                    };
                                    if (onUpdateAdicionales) {
                                      await onUpdateAdicionales(ot.id, ad);
                                    }
                                  },
                                  { enableHighAccuracy: true, timeout: 5000 }
                                );
                              } else {
                                const ad = {
                                  chofer_llegada: true,
                                  chofer_llegada_fecha: new Date().toISOString(),
                                  chofer_llegada_coords: 'GPS no soportado'
                                };
                                if (onUpdateAdicionales) {
                                  await onUpdateAdicionales(ot.id, ad);
                                }
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                          <label htmlFor={`llegada-completed-${ot.id}`} className="text-[10px] font-bold text-slate-700 cursor-pointer flex flex-col">
                            <span>Llegada al cliente confirmada</span>
                            {adObj.chofer_llegada_fecha && (
                              <span className="text-[9px] text-emerald-700 font-semibold flex flex-col mt-0.5">
                                <span>Llegó: {new Date(adObj.chofer_llegada_fecha).toLocaleTimeString('es-ES')}</span>
                                {adObj.chofer_llegada_coords && (
                                  <span className="text-[8px] text-slate-500 font-normal">Coords: {adObj.chofer_llegada_coords}</span>
                                )}
                              </span>
                            )}
                          </label>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {gpsLink && (
                            <a
                              href={gpsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1 shadow-sm transition-all-300"
                            >
                              Ver Ruta
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => onWeatherAnalysis && onWeatherAnalysis(ot)}
                            className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-250 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all-300 cursor-pointer"
                          >
                            <Sun className="w-3.5 h-3.5 text-amber-600" />
                            Análisis Climático
                          </button>

                          <button
                            onClick={() => generateRemitoPDF(ot)}
                            className="flex-1 bg-blue-900/10 hover:bg-blue-900/20 text-blue-900 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all-300 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Remito PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {dispatchesCompleted.length === 0 && (
                    <div className="text-center py-12 text-slate-400 font-semibold italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No hay registro de entregas completadas en este periodo.
                    </div>
                  )}
                </div>
              </div>

              {/* Panel 3: Retiros de Desarme y Logística Inversa */}
              <div className="glass-panel rounded-[2rem] p-6 space-y-4 col-span-1 xl:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-widest font-black text-fuchsia-700 Poppins flex items-center gap-1.5">
                    <Shuffle className="w-4 h-4 text-fuchsia-600" />
                    3. Retiros de Desarme y Logística Inversa ({disassemblies.length})
                  </h3>
                  <span className="bg-fuchsia-100 text-fuchsia-850 text-[10px] font-black px-2 py-0.5 rounded-full uppercase border border-fuchsia-250">
                    Logística Inversa
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Órdenes en proceso de desarme o desarmadas. Visualice destinos, distancias calculadas y descargue los remitos oficiales.
                </p>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {disassemblies.map((ot) => {
                    const geo = typeof ot.georef === 'string' ? JSON.parse(ot.georef) : ot.georef;
                    const latOrigin = geo?.lat;
                    const lngOrigin = geo?.lng;
                    const addressOrigin = geo?.direccion || 'No especificada';
                    
                    // Find the disassembly record for this OT if it's Desarmada
                    const record = desarmeRecords.find(d => d.ot_origen_id === ot.id);
                    const adObj = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
                    
                    return (
                      <div
                        key={ot.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 hover:border-fuchsia-300 transition-all-300"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-fuchsia-900 text-xs block">{ot.ot_numero}</span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase border ${
                                ot.estado === 'Desarmada'
                                  ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-250'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-250'
                              }`}>
                                {ot.estado === 'Desarmada' ? 'Desarmada' : 'En Cliente / Pendiente Desarme'}
                              </span>
                            </div>
                            <span className="font-black text-sm text-slate-800">{ot.cliente_nombre}</span>
                          </div>
                          <span className="bg-slate-100 text-slate-650 text-[9px] font-extrabold px-2 py-0.5 rounded border border-slate-200 uppercase">
                            {ot.modelo_estructura}
                          </span>
                        </div>

                        {/* Origin details */}
                        <div className="text-[10px] text-slate-650 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                          <div>
                            <strong className="text-slate-400 font-bold uppercase tracking-wider text-[8px] mr-1">Origen (Obra):</strong>
                            <span className="font-semibold text-slate-700">{addressOrigin}</span>
                          </div>
                          <div>
                            <strong className="text-slate-400 font-bold uppercase tracking-wider text-[8px] mr-1">Fecha Desarme:</strong>
                            <span className="font-bold text-slate-750">
                              {ot.fecha_fin ? new Date(ot.fecha_fin + 'T00:00:00').toLocaleDateString('es-ES') : 'No especificada'}
                            </span>
                          </div>
                        </div>

                        {/* Destinations & Distances Block */}
                        <div className="space-y-3">
                          <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-450">Ruta y Destinos de Carga</h4>
                          
                          {/* If not disassembled yet (Completada state) */}
                          {ot.estado === 'Completada' && (() => {
                            const distVal = calculateDistanceBetween(latOrigin, lngOrigin, -34.83473863535278, -58.42446638785623);
                            const retornoLlegadas = adObj.chofer_retorno_llegadas || {};

                            return (
                              <div className="space-y-3">
                                <div className="border border-slate-150 rounded-xl p-3 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <Warehouse className="w-3.5 h-3.5 text-blue-900" />
                                      <span className="text-[11px] font-black text-slate-800 uppercase">Retorno al Depósito Central (Dangiola)</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500 block">Juan XXIII 2980, Parque Industrial Burzaco</span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-black text-blue-900 block">
                                      {distVal} km
                                    </span>
                                    <span className="text-[8px] font-black text-slate-450 uppercase">Ruta óptima (+1.35)</span>
                                  </div>
                                </div>

                                {/* Recorrido Visual */}
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[10px] space-y-1.5">
                                  <strong className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Recorrido Retorno</strong>
                                  <div className="flex items-center gap-1.5 flex-wrap font-semibold text-slate-700">
                                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 max-w-xs truncate" title={addressOrigin}>
                                      <MapPin className="w-3 h-3 text-indigo-700" />
                                      Obra: {addressOrigin.split(',')[0]}
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                                      <Warehouse className="w-3 h-3 text-blue-900" />
                                      Depósito Central
                                    </span>
                                  </div>
                                </div>

                                {/* Checkbox de llegada para el Retorno */}
                                <div className="flex items-center gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50">
                                  <input
                                    type="checkbox"
                                    id={`llegada-retorno-${ot.id}-deposito`}
                                    checked={Boolean(retornoLlegadas?.deposito?.llegada)}
                                    disabled={Boolean(retornoLlegadas?.deposito?.llegada)}
                                    onChange={(e) => handleGPSArrivalRetorno(ot.id, 'deposito', e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                  <label htmlFor={`llegada-retorno-${ot.id}-deposito`} className="text-[10px] font-bold text-slate-700 cursor-pointer flex flex-col">
                                    <span>Confirmar Llegada a Depósito (GPS)</span>
                                    {retornoLlegadas?.deposito?.fecha && (
                                      <span className="text-[9px] text-emerald-700 font-semibold flex flex-col mt-0.5">
                                        <span>Llegó: {new Date(retornoLlegadas.deposito.fecha).toLocaleTimeString('es-ES')}</span>
                                        {retornoLlegadas.deposito.coords && (
                                          <span className="text-[8px] text-slate-500 font-normal font-mono">Coords: {retornoLlegadas.deposito.coords}</span>
                                        )}
                                      </span>
                                    )}
                                  </label>
                                </div>
                              </div>
                            );
                          })()}

                          {/* If disassembled (Desarmada state) */}
                          {ot.estado === 'Desarmada' && record && record.destinos && record.destinos.map((dest, idx) => {
                            let destTitle = "";
                            let destAddress = "";
                            let destLat = null;
                            let destLng = null;
                            let icon = <Warehouse className="w-3.5 h-3.5 text-blue-900" />;
                            
                            if (dest.type === 'deposito' || dest.destino === 'deposito') {
                              destTitle = "Retorno a Depósito Central (Dangiola)";
                              destAddress = "Juan XXIII 2980, Parque Industrial Burzaco";
                              destLat = -34.83473863535278;
                              destLng = -58.42446638785623;
                            } else {
                              // It's a transfer to another OT
                              const targetOt = ots.find(o => o.id === dest.ot_id || o.ot_numero === dest.ot_numero);
                              destTitle = `Transferencia Directa a ${dest.ot_numero || 'OT-' + dest.ot_id}`;
                              icon = <Truck className="w-3.5 h-3.5 text-fuchsia-600" />;
                              if (targetOt) {
                                const targetGeo = typeof targetOt.georef === 'string' ? JSON.parse(targetOt.georef) : targetOt.georef;
                                destAddress = targetGeo?.direccion || 'Obra destino';
                                destLat = targetGeo?.lat;
                                destLng = targetGeo?.lng;
                                destTitle += ` - ${targetOt.cliente_nombre}`;
                              } else {
                                destAddress = "Obra destino";
                              }
                            }
                            
                            const distVal = (latOrigin && lngOrigin && destLat && destLng)
                              ? calculateDistanceBetween(latOrigin, lngOrigin, destLat, destLng)
                              : "0.0";
                              
                            const routeGpsLink = (latOrigin && lngOrigin && destLat && destLng)
                              ? `https://www.google.com/maps/dir/?api=1&origin=${latOrigin},${lngOrigin}&destination=${destLat},${destLng}&travelmode=driving`
                              : null;

                            const destKey = dest.type === 'deposito' || dest.destino === 'deposito'
                              ? 'deposito'
                              : `ot-${dest.ot_id || dest.ot_numero}`;
                            const retornoLlegadas = adObj.chofer_retorno_llegadas || {};

                            return (
                              <div key={idx} className="border border-fuchsia-100 rounded-2xl p-4 bg-fuchsia-50/10 space-y-3 hover:border-fuchsia-250 transition-all-300">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      {icon}
                                      <span className="text-[11px] font-black text-slate-800 uppercase">{destTitle}</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500 block">{destAddress}</span>
                                    {dest.items && (
                                      <span className="text-[9px] text-fuchsia-700 font-bold block bg-fuchsia-50 border border-fuchsia-100 rounded-md px-1.5 py-0.5 mt-1 max-w-max">
                                        Lleva {dest.items.length} componentes de esta OT
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 gap-2">
                                    <div className="text-left sm:text-right">
                                      <span className="text-xs font-black text-fuchsia-900 block">{distVal} km</span>
                                      <span className="text-[8px] font-black text-slate-450 uppercase">Ruta óptima (+1.35)</span>
                                    </div>
                                    {routeGpsLink && (
                                      <a
                                        href={routeGpsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg py-1.5 px-2.5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all-300 cursor-pointer"
                                      >
                                        <MapPin className="w-3 h-3" />
                                        GPS Destino
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {/* Recorrido Visual */}
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[10px] space-y-1.5">
                                  <strong className="block text-slate-455 font-bold uppercase tracking-wider text-[8px]">Recorrido</strong>
                                  <div className="flex items-center gap-1.5 flex-wrap font-semibold text-slate-700">
                                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 max-w-xs truncate" title={addressOrigin}>
                                      <MapPin className="w-3 h-3 text-indigo-700" />
                                      Obra: {addressOrigin.split(',')[0]}
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                    {dest.type === 'deposito' || dest.destino === 'deposito' ? (
                                      <span className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                                        <Warehouse className="w-3 h-3 text-blue-900" />
                                        Depósito Central
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 bg-fuchsia-50 text-fuchsia-700 px-2 py-0.5 rounded border border-fuchsia-200 max-w-xs truncate" title={destAddress}>
                                        <Truck className="w-3 h-3 text-fuchsia-700" />
                                        {destTitle.split(' - ')[0]}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Checkbox de llegada para este destino */}
                                <div className="flex items-center gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50 mt-1">
                                  <input
                                    type="checkbox"
                                    id={`llegada-retorno-${ot.id}-${destKey}`}
                                    checked={Boolean(retornoLlegadas?.[destKey]?.llegada)}
                                    disabled={Boolean(retornoLlegadas?.[destKey]?.llegada)}
                                    onChange={(e) => handleGPSArrivalRetorno(ot.id, destKey, e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                  />
                                  <label htmlFor={`llegada-retorno-${ot.id}-${destKey}`} className="text-[10px] font-bold text-slate-700 cursor-pointer flex flex-col">
                                    <span>Confirmar Llegada a Destino (GPS)</span>
                                    {retornoLlegadas?.[destKey]?.fecha && (
                                      <span className="text-[9px] text-emerald-700 font-semibold flex flex-col mt-0.5">
                                        <span>Llegó: {new Date(retornoLlegadas[destKey].fecha).toLocaleTimeString('es-ES')}</span>
                                        {retornoLlegadas[destKey].coords && (
                                          <span className="text-[8px] text-slate-500 font-normal font-mono">Coords: {retornoLlegadas[destKey].coords}</span>
                                        )}
                                      </span>
                                    )}
                                  </label>
                                </div>
                              </div>
                            );
                          })}

                          {ot.estado === 'Desarmada' && (!record || !record.destinos) && (
                            <div className="text-slate-400 italic text-[10px] p-2 bg-slate-50 rounded-lg">
                              No hay detalles de destinos disponibles para este desarme.
                            </div>
                          )}
                        </div>

                        {/* Actions block */}
                        <div className="flex gap-2 flex-wrap pt-1">
                          <button
                            type="button"
                            onClick={() => onWeatherAnalysis && onWeatherAnalysis(ot)}
                            className="flex-1 min-w-[120px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-255 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all-300 cursor-pointer"
                          >
                            <Sun className="w-3.5 h-3.5 text-amber-600" />
                            Análisis Climático
                          </button>

                          {/* GPS link for return to Depot (if not disassembled yet) */}
                          {ot.estado === 'Completada' && latOrigin && lngOrigin && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=${latOrigin},${lngOrigin}&destination=-34.83473863535278,-58.42446638785623&travelmode=driving`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-[120px] bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5 shadow-sm transition-all-300"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              Navegar Retorno (GPS)
                            </a>
                          )}

                          {/* Print Pre-disassembly control sheet */}
                          {ot.estado === 'Completada' && (
                            <button
                              onClick={() => generateDisassemblyPreArmadoPDF(ot)}
                              className="flex-1 min-w-[120px] bg-blue-900 hover:bg-blue-955 text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all-300 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Planilla Control Desarme
                            </button>
                          )}

                          {/* Print Official Disassembly Remitos */}
                          {ot.estado === 'Desarmada' && record && record.remitos && record.remitos.map((remito, rIdx) => (
                            <button
                              key={rIdx}
                              onClick={() => printDisassemblyRemitoOfficial(remito, ot)}
                              className="flex-1 min-w-[120px] bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all-300 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Imprimir Remito: {remito.tipo.replace('Retorno a ', '')}
                            </button>
                          ))}

                          {/* Confirmar Recepcion (Finalizar Viaje) */}
                          {ot.estado === 'Desarmada' && (
                            <button
                              onClick={async () => {
                                if (confirm(`¿Confirmar recepción de retorno y finalizar viaje para la OT ${ot.ot_numero}? Esto cambiará su estado a Retornada.`)) {
                                  await onUpdateOTStatus(ot.id, 'Retornada');
                                }
                              }}
                              className="w-full bg-slate-900 hover:bg-black text-white rounded-xl py-2.5 px-3 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all-300 cursor-pointer mt-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Confirmar Recepción de Retorno (Finalizar Viaje)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {disassemblies.length === 0 && (
                    <div className="text-center py-12 text-slate-400 font-semibold italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No hay retiros de desarme planificados o registrados en este período.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* -------------------- GERENCIA DASHBOARD -------------------- */}
      {activeModule === 'Gerencia' && (() => {
        const totalM2 = ots
          .filter(o => ['Aprobada', 'Bulto Completo', 'Completada'].includes(o.estado))
          .reduce((sum, o) => sum + (parseFloat(o.superficie) || (o.frente * o.largo) || 0), 0);
        const pendingApproval = ots.filter(o => o.estado === 'Pendiente');
        const pendingModulation = ots.filter(o => o.estado === 'Aprobada por Gerencia');
        const inLogistics = ots.filter(o => ['Aprobada', 'Bulto Completo'].includes(o.estado));
        const completed = ots.filter(o => o.estado === 'Completada');
        const rejected = ots.filter(o => o.estado === 'Rechazada');

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-3xl border border-indigo-100 shadow-sm">
              <div>
                <h2 className="text-lg font-black uppercase text-indigo-900 tracking-wider Poppins flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Tablero de Gerencia
                </h2>
                <p className="text-xs text-indigo-600 font-semibold">Vista 360° del Carpas D'Angiola.</p>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex gap-2 border-b border-indigo-200 pb-2">
              <button
                onClick={() => setGerenciaSubTab('ots')}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all-300 ${gerenciaSubTab === 'ots'
                  ? 'border-indigo-700 text-indigo-700 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
              >
                Tablero de Control
              </button>
              <button
                onClick={() => setGerenciaSubTab('stock')}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all-300 ${gerenciaSubTab === 'stock'
                  ? 'border-indigo-700 text-indigo-700 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
              >
                Stock de Estructuras
              </button>
              <button
                onClick={onOpenGerenciaDashboard}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all-300 border-transparent text-cyan-600 hover:text-cyan-800 hover:border-cyan-400 flex items-center gap-1.5`}
              >
                VigIA — BI Console
              </button>
            </div>

            {gerenciaSubTab === 'stock' ? (
              renderStockInventory()
            ) : (
              <>
                {/* URGENT DISASSEMBLY ALERTS */}
                {disassemblyAlerts.length > 0 && (
                  <div className="border-2 border-fuchsia-300 rounded-[2rem] p-6 bg-fuchsia-50/30 shadow-md space-y-3 mb-6">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-fuchsia-600 animate-bounce" />
                      <h3 className="text-sm font-black uppercase text-fuchsia-900 tracking-wider Poppins">Alertas Críticas de Logística Inversa (Desarme Pendiente)</h3>
                    </div>
                    <p className="text-xs text-fuchsia-800 font-semibold">
                      Las siguientes OTs activas están a menos de 48 horas de su desarme planificado o se encuentran vencidas. Debe crear la Orden de Desarme correspondiente:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {disassemblyAlerts.map(ot => (
                        <div key={ot.id} className="bg-white/95 border border-fuchsia-200 rounded-2xl p-4 flex justify-between items-center gap-4 hover:border-fuchsia-400 transition-all-300 shadow-sm">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-mono font-black text-fuchsia-700 text-xs">{ot.ot_numero}</span>
                              <span className="text-[10px] font-black text-slate-800 uppercase">{ot.cliente_nombre}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              Estructura: {ot.modelo_estructura} ({ot.frente}x{ot.largo}m)
                            </div>
                            <div className="text-[10px] text-fuchsia-700 font-extrabold mt-1">
                              Desarme original: {new Date(ot.fecha_fin + 'T00:00:00').toLocaleDateString('es-ES')}
                            </div>
                          </div>
                          <button
                            onClick={() => onSelectOT(ot)}
                            className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all-300 cursor-pointer shadow-sm shrink-0"
                          >
                            Crear Orden de Desarme
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="bg-white border border-yellow-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all-300">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-yellow-600">Pendientes Aprobación</span>
                      <div className="w-8 h-8 bg-yellow-100 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-yellow-600" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-yellow-700">{pendingApproval.length}</div>
                    <div className="text-[10px] text-yellow-500 font-semibold mt-1">Contratos aguardando tu validación</div>
                  </div>

                  <div className="bg-white border border-purple-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all-300">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-purple-600">En Modulación</span>
                      <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Layers className="w-4 h-4 text-purple-600" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-purple-700">{pendingModulation.length}</div>
                    <div className="text-[10px] text-purple-500 font-semibold mt-1">Aprobados — pendientes en Operaciones</div>
                  </div>

                  <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all-300">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">En Logística / Planta</span>
                      <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Package className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-blue-700">{inLogistics.length}</div>
                    <div className="text-[10px] text-blue-500 font-semibold mt-1">
                      <span>{totalM2.toFixed(0)} m² activos en calle</span>
                    </div>
                  </div>

                  <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all-300">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Entregados (Chofer)</span>
                      <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <Truck className="w-4 h-4 text-indigo-650" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-indigo-700">
                      {(() => {
                        const arrivedCount = ots.filter(o => {
                          const ad = typeof o.adicionales === 'string' ? JSON.parse(o.adicionales) : o.adicionales || {};
                          return ad.chofer_llegada === true;
                        }).length;
                        return arrivedCount;
                      })()}
                    </div>
                    <div className="text-[10px] text-indigo-500 font-semibold mt-1">
                      {(() => {
                        const dispatchesInTransit = ots.filter(o => o.estado === 'Bulto Completo');
                        const arrivedAtDestination = dispatchesInTransit.filter(o => {
                          const ad = typeof o.adicionales === 'string' ? JSON.parse(o.adicionales) : o.adicionales || {};
                          return ad.chofer_llegada === true;
                        });
                        return `Chofer: ${arrivedAtDestination.length}/${dispatchesInTransit.length} en destino`;
                      })()}
                    </div>
                  </div>

                  <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all-300">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Completados</span>
                      <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-emerald-700">{completed.length}</div>
                    <div className="text-[10px] text-emerald-500 font-semibold mt-1">{rejected.length} rechazado(s)</div>
                  </div>
                </div>

                {/* SECCIÓN 1: CONTRATOS PENDIENTES DE VALIDACIÓN */}
                <div className="glass-panel rounded-[2rem] p-6 space-y-4">
                  <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 Poppins">1. Contratos Pendientes de Aprobación por Gerencia ({pendingApproval.length})</h3>
                  <div className="space-y-4">
                    {pendingApproval.map((ot) => (
                      <div key={ot.id} className="bg-yellow-50/50 border border-yellow-250 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-yellow-800 text-sm">{ot.ot_numero}</span>
                            <span className="text-xs font-black text-slate-800 uppercase">{ot.cliente_nombre}</span>
                            {getStatusBadge(ot.estado)}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs font-semibold text-slate-600">
                            <div><span className="text-slate-400">Estructura:</span> {ot.modelo_estructura} ({ot.frente}x{ot.largo}m)</div>
                            <div><span className="text-slate-400">Superficie:</span> {ot.superficie} m²</div>
                            <div><span className="text-slate-400">Montaje:</span> {new Date(ot.fecha_inicio).toLocaleDateString()}</div>
                            <div><span className="text-slate-400">Desarme:</span> {new Date(ot.fecha_fin).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                          <button
                            onClick={() => onSelectOT(ot)}
                            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all-300 cursor-pointer shadow-xs"
                          >
                            Revisar / Autorizar
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingApproval.length === 0 && (
                      <div className="text-center py-6 text-slate-400 font-semibold italic">No hay contratos pendientes de aprobación.</div>
                    )}
                  </div>
                </div>

                {/* SECCIÓN 2: ESTADO OPERACIONES */}
                <div className="glass-panel rounded-[2rem] p-6 space-y-4">
                  <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 Poppins">2. Estado de Operaciones — Contratos en Modulación ({pendingModulation.length})</h3>
                  <div className="space-y-4">
                    {pendingModulation.map((ot) => (
                      <div key={ot.id} className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-purple-800 text-sm">{ot.ot_numero}</span>
                            <span className="text-xs font-black text-slate-800 uppercase">{ot.cliente_nombre}</span>
                            {getStatusBadge(ot.estado)}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs font-semibold text-slate-600">
                            <div><span className="text-slate-400">Estructura:</span> {ot.modelo_estructura} ({ot.frente}x{ot.largo}m)</div>
                            <div><span className="text-slate-400">Superficie:</span> {ot.superficie} m²</div>
                            <div><span className="text-slate-400">Montaje:</span> {new Date(ot.fecha_inicio).toLocaleDateString()}</div>
                            <div><span className="text-slate-400">Desarme:</span> {new Date(ot.fecha_fin).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => onSelectOT(ot)}
                          className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all-305 cursor-pointer"
                        >
                          Ver / Modular
                        </button>
                      </div>
                    ))}
                    {pendingModulation.length === 0 && (
                      <div className="text-center py-6 text-slate-400 font-semibold italic">No hay contratos en proceso de modulación.</div>
                    )}
                  </div>
                </div>

                {/* SECCIÓN 3: ESTADO PLANTA / ALMACÉN */}
                <div className="glass-panel rounded-[2rem] p-6">
                  <h3 className="text-xs uppercase tracking-widest font-black text-blue-700 mb-1 Poppins flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    3. Estado Planta / Almacén — OTs en Logística ({inLogistics.length})
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mb-4">Órdenes conformadas en proceso de carga en pañol y planta.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 text-slate-400 font-black uppercase tracking-widest">
                          <th className="pb-3">OT N°</th>
                          <th className="pb-3">Cliente</th>
                          <th className="pb-3">Fechas</th>
                          <th className="pb-3">Estructura</th>
                          <th className="pb-3 pr-4">Superficie / Estado</th>
                          <th className="pb-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inLogistics.map((ot) => (
                          <tr key={ot.id} className="hover:bg-slate-50/50 transition-all-300">
                            <td className="py-3 font-black text-blue-900 font-mono">{ot.ot_numero}</td>
                            <td className="py-3 font-extrabold text-slate-800">{ot.cliente_nombre}</td>
                            <td className="py-3 font-semibold text-slate-600">
                              {new Date(ot.fecha_inicio).toLocaleDateString('es-ES')} a {new Date(ot.fecha_fin).toLocaleDateString('es-ES')}
                            </td>
                            <td className="py-3"><span className="badge-carpa">{['Pendiente', 'Aprobada por Gerencia'].includes(ot.estado) ? 'A Confirmar' : ot.modelo_estructura}</span></td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 whitespace-nowrap">{ot.superficie || (ot.frente * ot.largo)} m²</span>
                                <div className="flex flex-col gap-1">
                                  {getStatusBadge(ot.estado)}
                                  {(() => {
                                    const ad = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
                                    if (ad.chofer_llegada === true) {
                                      return (
                                        <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-indigo-250 uppercase w-max">
                                          Entregado (Chofer)
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <button
                                onClick={() => onSelectOT(ot)}
                                className="bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all-300 cursor-pointer"
                              >
                                Revisar
                              </button>
                            </td>
                          </tr>
                        ))}
                        {inLogistics.length === 0 && (
                          <tr>
                            <td colSpan="6" className="text-center py-8 text-slate-400 font-semibold italic">No hay órdenes de trabajo en logística.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECCIÓN 4: COMPLETADOS */}
                <div className="glass-panel rounded-[2rem] p-6">
                  <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 mb-4 Poppins">4. Historial General de OTs Activas</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 text-slate-400 font-black uppercase tracking-widest">
                          <th className="pb-3">OT N°</th>
                          <th className="pb-3">Cliente</th>
                          <th className="pb-3">Fechas</th>
                          <th className="pb-3">Estructura</th>
                          <th className="pb-3 pr-4">Superficie / Estado</th>
                          <th className="pb-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ots.map((ot) => (
                          <tr key={ot.id} className="hover:bg-slate-50/50 transition-all-300">
                            <td className="py-3 font-black text-blue-900 font-mono">{ot.ot_numero}</td>
                            <td className="py-3 font-extrabold text-slate-800">{ot.cliente_nombre}</td>
                            <td className="py-3 font-semibold text-slate-600">
                              {new Date(ot.fecha_inicio).toLocaleDateString('es-ES')} a {new Date(ot.fecha_fin).toLocaleDateString('es-ES')}
                            </td>
                            <td className="py-3"><span className="badge-carpa">{['Pendiente', 'Aprobada por Gerencia'].includes(ot.estado) ? 'A Confirmar' : ot.modelo_estructura}</span></td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 whitespace-nowrap">{ot.superficie || (ot.frente * ot.largo)} m²</span>
                                {getStatusBadge(ot.estado)}
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <button
                                onClick={() => onSelectOT(ot)}
                                className="bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all-300 cursor-pointer"
                              >
                                Revisar
                              </button>
                            </td>
                          </tr>
                        ))}
                        {ots.length === 0 && (
                          <tr>
                            <td colSpan="6" className="text-center py-8 text-slate-400 font-semibold italic">No hay órdenes de trabajo en el sistema.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

    </div>
  );
}
