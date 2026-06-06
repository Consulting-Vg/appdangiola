import React from 'react';
import { jsPDF } from 'jspdf';
import { FileText, Download } from 'lucide-react';

export default function PDFReplicator({ ot, explosion }) {
  const generatePDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [16, 49, 107]; // Institutional Blue
    const grayColor = [148, 163, 184];

    // Page Width is 210mm. Margins are 15mm. Printable width is 180mm.
    const startX = 15;
    let y = 15;

    // Helper: Draw text lines
    const text = (str, xOffset, yOffset, size = 10, style = 'normal', color = [0, 0, 0]) => {
      doc.setFont('Helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(str, xOffset, yOffset);
    };

    // Helper: Draw lines
    const line = (x1, y1, x2, y2, thickness = 0.2, color = [200, 200, 200]) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(thickness);
      doc.line(x1, y1, x2, y2);
    };

    // Helper: Draw container box
    const rect = (x, yPos, w, h, fill = false, fillColor = [255, 255, 255]) => {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      if (fill) {
        doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
        doc.rect(x, yPos, w, h, 'F');
      } else {
        doc.rect(x, yPos, w, h);
      }
    };

    // --- HEADER SECTION ---
    // Header container
    rect(startX, y, 180, 22, true, [245, 248, 253]);
    text("CARPAS D'ANGIOLA S.A.", startX + 5, y + 9, 14, 'bold', primaryColor);
    text("SISTEMA INTEGRAL DE LOGISTICA Y CONTROL", startX + 5, y + 14, 8, 'normal', grayColor);
    text("ORDEN DE TRABAJO", startX + 115, y + 9, 14, 'bold', primaryColor);
    text(`OT N°: ${ot.ot_numero || 'PENDIENTE'}`, startX + 115, y + 15, 11, 'bold', [220, 38, 38]);
    y += 26;

    // --- CLIENT & EVENT DATE INFO ---
    rect(startX, y, 180, 26);
    text("1. DATOS GENERALES Y COMERCIALES", startX + 2, y - 2, 7, 'bold', primaryColor);
    
    text("CLIENTE / RAZON SOCIAL:", startX + 4, y + 6, 8, 'bold', primaryColor);
    text(String(ot.cliente_nombre || 'S/D').toUpperCase(), startX + 46, y + 6, 8, 'normal');

    text("CUIT / RUT:", startX + 120, y + 6, 8, 'bold', primaryColor);
    text(String(ot.cliente_cuit || ot.cuit || 'S/D'), startX + 138, y + 6, 8, 'normal');

    text("DIRECCION LEGAL:", startX + 4, y + 12, 8, 'bold', primaryColor);
    text(String(ot.cliente_domicilio || 'S/D'), startX + 32, y + 12, 8, 'normal');

    text("FECHA INICIO EVENTO:", startX + 4, y + 18, 8, 'bold', primaryColor);
    text(new Date(ot.fecha_inicio).toLocaleDateString('es-ES'), startX + 38, y + 18, 8, 'normal');

    text("FECHA FINALIZACION:", startX + 100, y + 18, 8, 'bold', primaryColor);
    text(new Date(ot.fecha_fin).toLocaleDateString('es-ES'), startX + 135, y + 18, 8, 'normal');
    
    y += 30;

    // --- STRUCTURAL DIMENSIONS INFO ---
    rect(startX, y, 180, 22);
    text("2. ESPECIFICACIONES DE ESTRUCTURA", startX + 2, y - 2, 7, 'bold', primaryColor);

    text("MODELO ESTRUCTURA:", startX + 4, y + 6, 8, 'bold', primaryColor);
    text(String(ot.modelo_estructura), startX + 38, y + 6, 8, 'normal');

    text("TIPO:", startX + 90, y + 6, 8, 'bold', primaryColor);
    text(String(ot.estructura_tipo || 'Aluminio').toUpperCase(), startX + 100, y + 6, 8, 'normal');

    text("MEDIDAS:", startX + 130, y + 6, 8, 'bold', primaryColor);
    text(`${ot.frente} x ${ot.largo} Mts`, startX + 148, y + 6, 8, 'normal');

    text("SUPERFICIE TOTAL:", startX + 4, y + 14, 8, 'bold', primaryColor);
    text(`${ot.superficie || (ot.frente * ot.largo)} m²`, startX + 34, y + 14, 8, 'normal');

    text("MODULACION:", startX + 90, y + 14, 8, 'bold', primaryColor);
    const modConfig = typeof ot.modulacion_config === 'string' ? JSON.parse(ot.modulacion_config) : ot.modulacion_config;
    const modsStr = modConfig?.modulos?.map(m => `${m.qty} mod. de ${m.largo}m`).join(' + ') || 'S/D';
    text(modsStr, startX + 115, y + 14, 8, 'normal');

    y += 26;

    // --- CONDITIONAL MATRIX ---
    rect(startX, y, 180, 22);
    text("3. MATRIZ DE ADICIONALES COMERCIALES", startX + 2, y - 2, 7, 'bold', primaryColor);

    // Header row
    text("ADICIONAL", startX + 4, y + 5, 8, 'bold', primaryColor);
    text("REQUERIDO", startX + 30, y + 5, 8, 'bold', primaryColor);
    text("DETALLES / COLOR", startX + 55, y + 5, 8, 'bold', primaryColor);
    text("OBSERVACIONES", startX + 105, y + 5, 8, 'bold', primaryColor);
    line(startX, y + 7, startX + 180, y + 7, 0.2);

    const adds = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales;
    
    // Floors
    text("PISOS", startX + 4, y + 11, 8, 'normal');
    text(adds?.pisos?.si ? "SI" : "NO", startX + 32, y + 11, 8, adds?.pisos?.si ? 'bold' : 'normal');
    text(adds?.pisos?.tipo || '-', startX + 55, y + 11, 8, 'normal');
    text(adds?.pisos?.obs || '-', startX + 105, y + 11, 8, 'normal');
    line(startX, y + 13, startX + 180, y + 13, 0.1);

    // Carpets
    text("ALFOMBRA", startX + 4, y + 17, 8, 'normal');
    text(adds?.alfombras?.si ? "SI" : "NO", startX + 32, y + 17, 8, adds?.alfombras?.si ? 'bold' : 'normal');
    text(adds?.alfombras?.color || '-', startX + 55, y + 17, 8, 'normal');
    text(adds?.alfombras?.obs || '-', startX + 105, y + 17, 8, 'normal');

    y += 26;

    // --- LOGISTICS MOUNTING GEOREFERENCE ---
    rect(startX, y, 180, 16);
    text("4. GEOLOCALIZACION Y MONTAJE", startX + 2, y - 2, 7, 'bold', primaryColor);
    
    const geo = typeof ot.georef === 'string' ? JSON.parse(ot.georef) : ot.georef;
    text("LUGAR DE ARMADO:", startX + 4, y + 6, 8, 'bold', primaryColor);
    text(String(geo?.direccion || 'S/D'), startX + 36, y + 6, 7.5, 'normal');

    text("LATITUD:", startX + 4, y + 11, 8, 'bold', primaryColor);
    text(String(geo?.lat?.toFixed(6) || '-'), startX + 20, y + 11, 8, 'normal');

    text("LONGITUD:", startX + 60, y + 11, 8, 'bold', primaryColor);
    text(String(geo?.lng?.toFixed(6) || '-'), startX + 78, y + 11, 8, 'normal');
    
    y += 20;

    // Add page break or check height. Since A4 height is 297mm, and we are at y=154, we can fit the materials!
    // But to ensure it fits neatly, we will make a clean 2-page document or list materials here.
    // Segment items into the 5 sectors: PAÑOL, PLANTA, TELAS, PISOS, LONAS
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

    const panolItems = [];
    const plantaItems = [];
    const telasItems = [];
    const pisosItems = [];
    const lonasItems = [];

    const processItem = (item) => {
      const name = item.producto || item.nombre || '';
      const qty = item.qty !== undefined ? item.qty : (item.cantidad !== undefined ? item.cantidad : 1);
      const sector = item.sector || '';
      const obs = item.obs || '';

      // Determine provenance
      let provenance = "Desde Depósito";
      const match = obs.match(/transferencia de (OT-\d+)/i);
      if (match) {
        provenance = `Transf. directo desde ${match[1]}`;
      }

      const enrichedItem = { producto: name, qty, sector, provenance };

      if (isLona(name)) {
        lonasItems.push(enrichedItem);
      } else if (isPiso(name)) {
        pisosItems.push(enrichedItem);
      } else if (isTela(name)) {
        telasItems.push(enrichedItem);
      } else if (sector === 'Planta') {
        plantaItems.push(enrichedItem);
      } else if (sector === 'Pañol') {
        panolItems.push(enrichedItem);
      } else {
        panolItems.push(enrichedItem);
      }
    };

    const panol = typeof ot.panol_status === 'string' ? JSON.parse(ot.panol_status) : ot.panol_status;
    const planta = typeof ot.planta_status === 'string' ? JSON.parse(ot.planta_status) : ot.planta_status;
    
    let checklistItems = [];
    if (panol?.items?.length > 0 || planta?.items?.length > 0) {
      if (panol?.items) {
        panol.items.forEach(i => checklistItems.push({ ...i, sector: 'Pañol' }));
      }
      if (planta?.items) {
        planta.items.forEach(i => checklistItems.push({ ...i, sector: 'Planta' }));
      }
    }

    const aggregateProducts = (items) => {
      const aggregated = {};
      items.forEach(item => {
        let cleanName = String(item.producto || item.nombre || '').replace(/[-_][a-zA-Z]\d*$/i, '');
        if (!aggregated[cleanName]) {
          aggregated[cleanName] = { ...item, producto: cleanName, nombre: cleanName, qty: 0 };
        }
        aggregated[cleanName].qty += Number(item.qty !== undefined ? item.qty : (item.cantidad !== undefined ? item.cantidad : 1));
      });
      return Object.values(aggregated).sort((a, b) => {
      const secA = a.sector || '';
      const secB = b.sector || '';
      if (secA !== secB) return secA.localeCompare(secB);
      return a.producto.localeCompare(b.producto);
    });
    };

    if (checklistItems.length > 0) {
      checklistItems = aggregateProducts(checklistItems);
      checklistItems.forEach(processItem);
    } else if (explosion) {
      let expItems = [];
      if (explosion.arcos) expItems.push(...explosion.arcos);
      if (explosion.modulos) expItems.push(...explosion.modulos);
      if (explosion.fijos) expItems.push(...explosion.fijos);
      if (explosion.accesorios) expItems.push(...explosion.accesorios);
      expItems = aggregateProducts(expItems);
      expItems.forEach(processItem);
    }

    // Move to Page 2 for Materials Checklist
    doc.addPage();
    let yPage2 = 15;

    text("5. DESGLOSE DE CARGA POR SECTOR (PICKING & CHECKLIST)", startX, yPage2, 11, 'bold', primaryColor);
    line(startX, yPage2 + 2, startX + 180, yPage2 + 2, 0.5, primaryColor);
    yPage2 += 8;

    const checkPageWrap = (heightNeeded) => {
      if (yPage2 + heightNeeded > 275) {
        doc.addPage();
        yPage2 = 15;
      }
    };

    const printSectorSection = (title, items, titleColor) => {
      const rowCount = items.length || 1;
      const boxH = rowCount * 5 + 7;
      const totalH = 4 + boxH + 6; // Title spacing + box height + bottom margin

      checkPageWrap(totalH);

      text(title, startX, yPage2, 9, 'bold', titleColor);
      yPage2 += 4;

      rect(startX, yPage2, 180, boxH);
      text("PRODUCTO / COMPONENTE", startX + 4, yPage2 + 4, 8, 'bold', primaryColor);
      text("CANTIDAD", startX + 110, yPage2 + 4, 8, 'bold', primaryColor);
      text("PROCEDENCIA / ORIGEN", startX + 130, yPage2 + 4, 8, 'bold', primaryColor);
      line(startX, yPage2 + 6, startX + 180, yPage2 + 6, 0.2);

      let itemY = yPage2 + 10;
      items.forEach(item => {
        text(String(item.producto).toUpperCase(), startX + 4, itemY, 7, 'normal');
        text(String(item.qty), startX + 110, itemY, 8, 'bold');
        
        const provText = item.provenance || "Desde Depósito";
        const isTransferred = provText.includes('directo');
        doc.setFont('Helvetica', isTransferred ? 'bold' : 'normal');
        text(String(provText), startX + 130, itemY, 7, isTransferred ? 'bold' : 'normal', isTransferred ? [217, 70, 239] : [71, 85, 105]);
        doc.setFont('Helvetica', 'normal');
        
        itemY += 5;
      });

      if (items.length === 0) {
        text("Sin componentes cargados en este sector.", startX + 4, itemY, 7.5, 'italic', [150, 150, 150]);
      }

      yPage2 += boxH + 5;
    };

    // Render the 5 sectorizations
    printSectorSection("SECTOR PLANTA (ESTRUCTURALES DE HIERRO/ALUMINIO)", plantaItems, [220, 104, 3]);
    printSectorSection("SECTOR PAÑOL (BULONERÍA, HERRAJES Y RÍGIDOS)", panolItems, [109, 40, 217]);
    printSectorSection("SECTOR TELAS (CORTINADOS Y CIELORRASOS)", telasItems, [79, 70, 229]);
    printSectorSection("SECTOR PISOS ( fenolicos, alfombras y caños )", pisosItems, [5, 150, 105]);
    printSectorSection("SECTOR LONAS (TECHO, LATERALES, TRIÁNGULOS Y TAPACHATAS)", lonasItems, [13, 148, 136]);

    // Signature boxes
    checkPageWrap(25);
    yPage2 += 5;
    text("FIRMA RESPONSABLE COMERCIAL", startX + 10, yPage2 + 15, 7.5, 'bold', primaryColor);
    line(startX + 10, yPage2 + 13, startX + 65, yPage2 + 13, 0.2);

    text("FIRMA CONTROL LOGISTICO", startX + 115, yPage2 + 15, 7.5, 'bold', primaryColor);
    line(startX + 115, yPage2 + 13, startX + 170, yPage2 + 13, 0.2);

    // Save/Download PDF
    doc.save(`OT_${ot.ot_numero || 'PENDIENTE'}_Carpas_DAngiola.pdf`);
  };

  return (
    <button
      onClick={generatePDF}
      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-bold shadow transition-all-300 flex items-center gap-1.5 cursor-pointer"
    >
      <Download className="w-4 h-4" />
      <span>Descargar Documento OT (PDF)</span>
    </button>
  );
}
