import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temporary AR directories exist
const tempArDir = path.join(__dirname, 'public', 'temp-ar');
if (!fs.existsSync(tempArDir)) {
  fs.mkdirSync(tempArDir, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve temporary AR files statically
app.use('/api/temp-ar', express.static(tempArDir));


// ----------------------------------------------------
// 1. CLIENTS ENDPOINTS
// ----------------------------------------------------
app.get('/api/clientes', async (req, res) => {
  try {
    const clients = await db.getClients();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const client = await db.saveClient(req.body);
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 2. STRUCTURES ENDPOINTS & LOGIC
// ----------------------------------------------------
app.get('/api/estructuras', async (req, res) => {
  try {
    const structures = await db.getStructures();
    const arches = await db.getArches();
    const modules = await db.getModules();
    const fijos = await db.getFijos();
    res.json({ structures, arches, modules, fijos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Two date ranges overlap when one starts before the other ends
// Range A: [start1, end1]  Range B: [start2, end2]
// Overlap when: start1 <= end2 AND start2 <= end1
const datesOverlap = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) return false;
  const s1 = start1.substring(0, 10);
  const e1 = end1.substring(0, 10);
  const s2 = start2.substring(0, 10);
  const e2 = end2.substring(0, 10);
  return s1 <= e2 && s2 <= e1;
};

// Check temporal availability of arches across all models matching selected width and material
app.post('/api/estructuras/check-availability', async (req, res) => {
  const { frente, estructura_tipo, fecha_inicio, fecha_fin, arcos_necesarios, exclude_ot_id } = req.body;
  if (!frente || !estructura_tipo || !fecha_inicio || !fecha_fin || !arcos_necesarios) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const structures = await db.getStructures();
    const matchingModels = structures.filter(s =>
      parseFloat(s.frente) === parseFloat(frente) &&
      s.estructura_tipo.toLowerCase() === estructura_tipo.toLowerCase()
    );

    if (matchingModels.length === 0) {
      return res.json({
        available: false,
        results: [],
        reason: `No se encontraron modelos de ${estructura_tipo} con frente de ${frente}m.`
      });
    }

    const archesData = await db.getArches();
    const ots = await db.getOTs();

    const results = [];
    let hasAnyAvailable = false;

    for (const model of matchingModels) {
      const modelName = model.modelo_estructura;

      if (model.estado === 'Incompleta / No Disponible para Eventos') {
        results.push({
          modelo_estructura: modelName,
          arcos_totales: model.arcos_totales,
          arcos_disponibles: 0,
          arcos_disponibles_list: [],
          reserved_arches_detail: [],
          status: 'Incompleta',
          reason: 'Estructura marcada como Incompleta en Planta.'
        });
        continue;
      }

      // All arches defined for this model
      const allArches = [...new Set(
        archesData.filter(a => a.modelo_estructura === modelName).map(a => a.arco)
      )];

      // OTs that overlap in date AND are active (arches are physically unique and reserved globally by code)
      const overlappingOTs = ots.filter(ot =>
        ot.estado !== 'Cancelada' &&
        ot.estado !== 'Rechazada' &&
        (!exclude_ot_id || ot.id !== exclude_ot_id) &&
        datesOverlap(ot.fecha_inicio, ot.fecha_fin, fecha_inicio, fecha_fin)
      );

      // Map reserved arches → which OT/client holds them
      const reservedArchMap = {};
      overlappingOTs.forEach(ot => {
        const reserved = ot.adicionales?.arcos_reservados || [];
        reserved.forEach(arch => {
          if (!reservedArchMap[arch]) {
            reservedArchMap[arch] = {
              ot_numero: ot.ot_numero,
              cliente: ot.cliente_nombre,
              fecha_inicio: ot.fecha_inicio,
              fecha_fin: ot.fecha_fin,
              estado: ot.estado
            };
          }
        });
      });

      const availableArches = allArches.filter(a => !reservedArchMap[a]);
      const reservedDetail = allArches
        .filter(a => reservedArchMap[a])
        .map(a => ({ arco: a, ...reservedArchMap[a] }));

      const modelAvailable = availableArches.length > 0;

      results.push({
        modelo_estructura: modelName,
        arcos_totales: model.arcos_totales,
        arcos_disponibles: availableArches.length,
        arcos_disponibles_list: availableArches,
        reserved_arches_detail: reservedDetail,
        status: modelAvailable ? 'Disponible' : 'Insuficiente',
        reason: modelAvailable
          ? `${availableArches.length} arco(s) libre(s)`
          : `Sin arcos disponibles para estas fechas`
      });
    }

    const totalAvailableArches = results.reduce((sum, r) => sum + r.arcos_disponibles, 0);
    hasAnyAvailable = totalAvailableArches >= arcos_necesarios;

    res.json({ available: hasAnyAvailable, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── NEW: Detailed arch status for a given model + date range (used by Operaciones panel)
app.post('/api/estructuras/arcos-status', async (req, res) => {
  const { modelo_estructura, frente, estructura_tipo, fecha_inicio, fecha_fin, exclude_ot_id } = req.body;
  if (!modelo_estructura || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Faltan parámetros: modelo_estructura, fecha_inicio, fecha_fin' });
  }
  try {
    const structures = await db.getStructures();
    const archesData = await db.getArches();
    const ots = await db.getOTs();

    // Find all structures matching the same frente and material type
    let matchingModels = [];
    if (frente && estructura_tipo) {
      matchingModels = structures.filter(s =>
        parseFloat(s.frente) === parseFloat(frente) &&
        s.estructura_tipo.toLowerCase() === estructura_tipo.toLowerCase()
      ).map(s => s.modelo_estructura);
    } else {
      const prefix = modelo_estructura.split('-')[0];
      matchingModels = structures.filter(s =>
        s.modelo_estructura.startsWith(prefix)
      ).map(s => s.modelo_estructura);
    }

    const allArches = [...new Set(
      archesData.filter(a => matchingModels.includes(a.modelo_estructura)).map(a => a.arco)
    )];

    const overlappingOTs = ots.filter(ot =>
      ot.estado !== 'Cancelada' &&
      ot.estado !== 'Rechazada' &&
      (!exclude_ot_id || ot.id !== exclude_ot_id) &&
      datesOverlap(ot.fecha_inicio, ot.fecha_fin, fecha_inicio, fecha_fin)
    );

    const reservedArchMap = {};
    overlappingOTs.forEach(ot => {
      const reserved = ot.adicionales?.arcos_reservados || [];
      reserved.forEach(arch => {
        if (!reservedArchMap[arch]) {
          reservedArchMap[arch] = {
            ot_numero: ot.ot_numero,
            cliente: ot.cliente_nombre,
            fecha_inicio: ot.fecha_inicio,
            fecha_fin: ot.fecha_fin,
            estado: ot.estado
          };
        }
      });
    });

    const archStatus = allArches.map(arco => ({
      arco,
      disponible: !reservedArchMap[arco],
      reservado_por: reservedArchMap[arco] || null
    }));

    res.json({ modelo_estructura, archStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Materials Explosion Algorithm (Modulo 2)
app.post('/api/estructuras/explode', async (req, res) => {
  const { modelo_estructura, frente, largo, modulacion_config, adicionales, fijo_modelo_estructura, modulo_modelo_estructura, conformed_modulos_list } = req.body;
  if (!modelo_estructura || !modulacion_config) {
    return res.status(400).json({ error: 'Missing configuration parameters' });
  }

  try {
    const archesData = await db.getArches();
    const modulesData = await db.getModules();
    const fijosData = await db.getFijos();
    const accessoriesStock = await db.getAccessories();

    // 1. Calculate number of modules and arches
    let totalModules = 0;
    const selectedModules = modulacion_config.modulos || [];
    selectedModules.forEach(m => {
      totalModules += m.qty;
    });

    const archesCount = totalModules + 1;

    // 2. Cascade Explosion:
    const explosion = {
      arcos: [],
      modulos: [],
      fijos: [],
      accesorios: []
    };

    // A. Resolve Arch Components (based on A1 to A_n)
    // For each arch from A1 to A_archesCount, fetch components
    const archIds = Array.from({ length: archesCount }, (_, i) => `${modelo_estructura}_A${i + 1}`);
    const archComponents = archesData.filter(a => 
      a.modelo_estructura === modelo_estructura && 
      archIds.includes(a.arco)
    );
    
    // Group and sum arch components
    const archSummary = {};
    archComponents.forEach(c => {
      if (!archSummary[c.producto]) {
        archSummary[c.producto] = { producto: c.producto, sector: c.sector, qty: 0 };
      }
      archSummary[c.producto].qty += c.qty_fija_arco;
    });
    explosion.arcos = Object.values(archSummary);

    // B. Resolve Module Components
    const moduleSummary = {};
    const prefix = modelo_estructura.split('-')[0]; // e.g. C10

    if (conformed_modulos_list && conformed_modulos_list.length > 0) {
      conformed_modulos_list.forEach(m => {
        let lookupModel = m.modelo_estructura;
        if (m.largo === 2) lookupModel = `${prefix}_2MTS`;
        else if (m.largo === 3) lookupModel = `${prefix}_3MTS`;

        const modComponents = modulesData.filter(mod => {
          const matchModel = m.largo === 5
            ? (mod.modulo_val === lookupModel)
            : (mod.modelo_estructura === lookupModel);
          return matchModel && mod.modulacion === m.largo;
        });
        
        modComponents.forEach(c => {
          if (!moduleSummary[c.producto]) {
            moduleSummary[c.producto] = { producto: c.producto, sector: c.sector, qty: 0 };
          }
          const qtyPerMod = c.stock_inicial || c.qty_fija_modulo || 0;
          moduleSummary[c.producto].qty += qtyPerMod * m.qty;
        });
      });
    } else {
      selectedModules.forEach(m => {
        // Find the model name in database for this module length
        let lookupModel = modulo_modelo_estructura || modelo_estructura;
        if (m.largo === 2) lookupModel = `${prefix}_2MTS`;
        else if (m.largo === 3) lookupModel = `${prefix}_3MTS`;

        const modComponents = modulesData.filter(mod => {
          const matchModel = m.largo === 5
            ? (mod.modulo_val === `${lookupModel}-M1` || mod.modulo_val === `${modelo_estructura}-M1`)
            : (mod.modelo_estructura === lookupModel);
          return matchModel && mod.modulacion === m.largo;
        });
        
        modComponents.forEach(c => {
          if (!moduleSummary[c.producto]) {
            moduleSummary[c.producto] = { producto: c.producto, sector: c.sector, qty: 0 };
          }
          const qtyPerMod = c.stock_inicial || c.qty_fija_modulo || 0;
          moduleSummary[c.producto].qty += qtyPerMod * m.qty;
        });
      });
    }
    explosion.modulos = Object.values(moduleSummary);

    // C. Resolve Fixed Components (Single selection per total structure)
    const lookupFijoModel = fijo_modelo_estructura || modelo_estructura;
    const fixedComponents = fijosData.filter(f => f.modelo_estructura === lookupFijoModel);
    explosion.fijos = fixedComponents.map(f => ({
      producto: f.producto,
      sector: f.sector,
      qty: f.qty_fija_carpa
    }));

    // D. Resolve Accessories & Calculations
    const area = frente * largo;

    // Flooring (Pisos)
    if (adicionales?.pisos?.si) {
      const floorType = adicionales.pisos.tipo || 'Placa Fenolico Estandar';
      const floorAcc = accessoriesStock.find(a => a.categoria === 'piso' && a.nombre === floorType);
      if (floorAcc) {
        const plateSize = parseFloat(floorAcc.medida) || 3.0; // med unitaria, e.g. 3m
        const plateQty = Math.ceil(area / plateSize);
        explosion.accesorios.push({
          producto: floorType,
          categoria: 'piso',
          qty: plateQty,
          estado: floorAcc.estado,
          obs: 'Calculado por m²'
        });
        // Caños: exact quantity as plates
        const canosAcc = accessoriesStock.find(a => a.categoria === 'piso' && a.nombre.includes('Caño'));
        if (canosAcc) {
          explosion.accesorios.push({
            producto: canosAcc.nombre,
            categoria: 'piso',
            qty: plateQty,
            estado: canosAcc.estado,
            obs: 'Soporte inferior (1 caño por placa)'
          });
        }
      }
    }

    // Carpets (Alfombras)
    if (adicionales?.alfombras?.si) {
      const color = adicionales.alfombras.color || 'Gris';
      const alfAcc = accessoriesStock.find(a => a.categoria === 'alfombra' && a.color === color);
      explosion.accesorios.push({
        producto: alfAcc ? alfAcc.nombre : `Alfombra ${color}`,
        categoria: 'alfombra',
        qty: area,
        estado: alfAcc?.estado || 'Nueva',
        obs: `Filtrado por color ${color} en m²`
      });
    }

    // Fabrics - Cielorraso (Ceiling Liner)
    if (adicionales?.telas_cielorraso?.si) {
      const color = adicionales.telas_cielorraso.color || 'Blanco';
      const telaAcc = accessoriesStock.find(a => a.categoria === 'tela' && a.color === color && a.tipo === 'Cielorraso');
      explosion.accesorios.push({
        producto: telaAcc ? telaAcc.nombre : `Tela Cielorraso ${color}`,
        categoria: 'tela',
        qty: area,
        estado: telaAcc?.estado || 'Nuevo',
        obs: `Superficie Frente x Largo (${area} m²)`
      });
    }

    // Fabrics - Cortinas (Curtains)
    if (adicionales?.telas_cortinas?.si) {
      const color = adicionales.telas_cortinas.color || 'Blanco';
      const cortinaTipo = adicionales.telas_cortinas.tipo || '4 Mts';
      const telaAcc = accessoriesStock.find(a => a.categoria === 'tela' && a.color === color && a.tipo === cortinaTipo);
      explosion.accesorios.push({
        producto: telaAcc ? telaAcc.nombre : `Tela Cortina ${cortinaTipo} ${color}`,
        categoria: 'tela',
        qty: totalModules * 2,
        estado: telaAcc?.estado || 'Nuevo',
        obs: `2 Cortinas por módulo (${totalModules * 2} unidades)`
      });
    }

    // Canvas (Lonas)
    if (adicionales?.lonas?.si) {
      const color = adicionales.lonas.color || 'Blanco';
      const height = (modelo_estructura.includes('-H') || modelo_estructura.includes(' H')) ? 4 : 3;

      // 1. Triangles (2 per structure)
      const lonaTri = accessoriesStock.find(a => 
        a.categoria === 'lona' && 
        a.color === color && 
        a.tipo === 'Triangulo' && 
        a.medida === String(frente)
      ) || accessoriesStock.find(a => 
        a.categoria === 'lona' && 
        a.color === color && 
        a.tipo === 'Triangulo'
      );

      explosion.accesorios.push({
        producto: lonaTri ? lonaTri.nombre : `Lona Triángulo Frente ${color} (${frente}m)`,
        categoria: 'lona',
        qty: 2,
        estado: lonaTri?.estado || 'Regular',
        obs: '2 Triángulos frontales fijos'
      });

      // 2. Techos / Paños (1 per module, matching front & module length)
      const roofGroups = {};
      selectedModules.forEach(m => {
        const modLength = m.largo;
        const measure = `${frente}x${modLength}`;
        const lonaTecho = accessoriesStock.find(a => 
          a.categoria === 'lona' && 
          a.color === color && 
          a.tipo === 'Paño' && 
          a.medida === measure
        ) || accessoriesStock.find(a => 
          a.categoria === 'lona' && 
          a.color === color && 
          a.tipo === 'Paño'
        );

        const name = lonaTecho ? lonaTecho.nombre : `Lona Techo Paño ${color} ${measure}`;
        if (!roofGroups[name]) {
          roofGroups[name] = {
            producto: name,
            categoria: 'lona',
            qty: 0,
            estado: lonaTecho?.estado || 'Regular',
            obs: `1 Lona de techo por módulo de ${modLength}m`
          };
        }
        roofGroups[name].qty += m.qty;
      });
      Object.values(roofGroups).forEach(item => explosion.accesorios.push(item));

      // 3. Laterales (2 per module, matching leg height & module length)
      const lateralGroups = {};
      selectedModules.forEach(m => {
        const modLength = m.largo;
        const measure = `${modLength}x${height}`;
        const lonaLat = accessoriesStock.find(a => 
          a.categoria === 'lona' && 
          a.color === color && 
          a.tipo === 'Lateral' && 
          a.medida === measure
        ) || accessoriesStock.find(a => 
          a.categoria === 'lona' && 
          a.color === color && 
          a.tipo === 'Lateral' && 
          a.medida === `5x${height}`
        );

        const name = lonaLat ? lonaLat.nombre : `Lona Lateral ${color} ${measure}`;
        if (!lateralGroups[name]) {
          lateralGroups[name] = {
            producto: name,
            categoria: 'lona',
            qty: 0,
            estado: lonaLat?.estado || 'Regular',
            obs: `2 Lonas laterales por módulo de ${modLength}m`
          };
        }
        lateralGroups[name].qty += m.qty * 2;
      });
      Object.values(lateralGroups).forEach(item => explosion.accesorios.push(item));

      // 4. Tapachata (Configurable joint covers matching leg height)
      // Standard: 2 tapachatas of 5m (or proportional) per joint to cover left and right side of frame.
      const tapaMedida = `5x${height}`;
      const lonaTapa = accessoriesStock.find(a => 
        a.categoria === 'lona' && 
        a.color === color && 
        a.tipo === 'Tapachata' && 
        a.medida === tapaMedida
      );

      const jointsCount = Math.max(0, totalModules - 1);
      const tapachataQty = jointsCount * Math.round(frente / 5);

      if (tapachataQty > 0) {
        explosion.accesorios.push({
          producto: lonaTapa ? lonaTapa.nombre : `Lona Tapachata ${color} (${tapaMedida})`,
          categoria: 'lona',
          qty: tapachataQty,
          estado: lonaTapa?.estado || 'Regular',
          obs: `${jointsCount} uniones entre módulos (${Math.round(frente / 5)} tapachatas de 5m por unión)`
        });
      }
    }

    res.json({
      frente,
      largo,
      area,
      archesCount,
      totalModules,
      explosion
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. WORK ORDERS (OTs) ENDPOINTS
// ----------------------------------------------------
app.get('/api/ots', async (req, res) => {
  try {
    const ots = await db.getOTs();
    res.json(ots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ots', async (req, res) => {
  try {
    const otData = req.body;
    let currentAdicionales = otData.adicionales || {};
    currentAdicionales.creado_por = otData.creado_por || 'Sistema';
    otData.adicionales = currentAdicionales;

    const ot = await db.saveOT(otData);
    
    // Log transaction
    await db.saveTransactionLog({
      ot_id: ot.id,
      ot_numero: ot.ot_numero,
      usuario: otData.creado_por || 'Sistema',
      rol: 'Comercial',
      accion: 'CREACION',
      detalles: 'Se generó el contrato comercial de la OT'
    });

    res.status(201).json(ot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ots/:id/status', async (req, res) => {
  const { id } = req.params;
  const { estado, usuario, rol } = req.body;
  try {
    const ot = await db.updateOTStatus(parseInt(id), estado, usuario, rol);
    
    // Log transaction
    await db.saveTransactionLog({
      ot_id: ot.id,
      ot_numero: ot.ot_numero,
      usuario: usuario || 'Sistema',
      rol: rol || 'Gerencia',
      accion: estado === 'Aprobada por Gerencia' ? 'APROBACION' : 'CAMBIO_ESTADO',
      detalles: `Se actualizó el estado de la OT a: ${estado}`
    });

    res.json(ot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ots/:id/conformation', async (req, res) => {
  const { id } = req.params;
  const { modulacion_config, arcos_reservados, panol_status, planta_status, fijo_modelo_estructura, modulo_modelo_estructura, conformed_modulos_list, usuario, rol } = req.body;
  try {
    const ot = await db.updateOTConformation(
      parseInt(id),
      modulacion_config,
      arcos_reservados,
      panol_status,
      planta_status,
      fijo_modelo_estructura,
      modulo_modelo_estructura,
      conformed_modulos_list,
      usuario,
      rol
    );

    // Log transaction
    await db.saveTransactionLog({
      ot_id: ot.id,
      ot_numero: ot.ot_numero,
      usuario: usuario || 'Sistema',
      rol: rol || 'Operaciones',
      accion: 'MODULACION',
      detalles: 'Se realizó la modulación y conformación completa de la estructura'
    });

    res.json(ot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ots/:id/checklist', async (req, res) => {
  const { id } = req.params;
  const { panol_status, planta_status, usuario, rol } = req.body;
  try {
    const ot = await db.updateOTChecklists(parseInt(id), panol_status, planta_status, usuario, rol);

    // Log transaction
    await db.saveTransactionLog({
      ot_id: ot.id,
      ot_numero: ot.ot_numero,
      usuario: usuario || 'Sistema',
      rol: rol || 'Almacen',
      accion: `CARGA_${String(rol).toUpperCase()}`,
      detalles: `Se actualizaron ítems en la etapa de carga: ${rol}`
    });

    res.json(ot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logistics Alerta por Estructura Incompleta (Modulo 3)
app.post('/api/ots/:id/checklist/extra-item', async (req, res) => {
  const { id } = req.params;
  const { item_tomado, estructura_origen, cantidad, usuario, rol } = req.body; // e.g. "cable de acero", "C10-L1", 2

  if (!item_tomado || !estructura_origen) {
    return res.status(400).json({ error: 'Missing item or source structure model' });
  }

  try {
    // Flag source structure as incomplete in db
    const structures = await db.getStructures();
    const sourceEst = structures.find(s => s.modelo_estructura === estructura_origen);
    if (!sourceEst) {
      return res.status(404).json({ error: 'Estructura de origen no encontrada' });
    }

    if (db.isPostgreSQL()) {
      // In Postgres
      const connectionString = process.env.DATABASE_URL;
      const pool = new pg.Pool({ connectionString, ssl: connectionString.includes('render.com') || connectionString.includes('supabase') ? { rejectUnauthorized: false } : false });
      await pool.query(
        "UPDATE estructuras_maestras SET estado = 'Incompleta / No Disponible para Eventos' WHERE modelo_estructura = $1",
        [estructura_origen]
      );
      pool.end();
    } else {
      // In local JSON
      sourceEst.estado = 'Incompleta / No Disponible para Eventos';
      // Write database
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const jsonDbPath = path.join(__dirname, 'data', 'db.json');
      
      const fileData = fs.readFileSync(jsonDbPath, 'utf8');
      const parsed = JSON.parse(fileData);
      const target = parsed.estructuras_maestras.find(s => s.modelo_estructura === estructura_origen);
      if (target) {
        target.estado = 'Incompleta / No Disponible para Eventos';
        fs.writeFileSync(jsonDbPath, JSON.stringify(parsed, null, 2), 'utf8');
      }
    }

    const otsList = await db.getOTs();
    const ot = otsList.find(o => o.id === parseInt(id));
    if (ot) {
      await db.saveTransactionLog({
        ot_id: ot.id,
        ot_numero: ot.ot_numero,
        usuario: usuario || 'Sistema',
        rol: rol || 'Almacen',
        accion: 'PRESTAMO_PIEZA',
        detalles: `Se tomó ${cantidad || 1}x ${item_tomado} prestado de la estructura ${estructura_origen}`
      });
    }

    const qtyText = cantidad ? `(${cantidad} unidades)` : '';
    res.json({
      success: true,
      message: `El componente '${item_tomado}' ${qtyText} fue restado. La estructura '${estructura_origen}' ha quedado incompleta y bloqueada para reservas.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await db.getTransactionLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ots/:id/adicionales', async (req, res) => {
  const { id } = req.params;
  const { adicionales, usuario, rol } = req.body;
  try {
    const ot = await db.updateOTAdicionales(parseInt(id), adicionales, usuario, rol);
    res.json(ot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Helper to check if a user is mentioned in a chat message
const userIsMentioned = (messageText, user) => {
  if (!messageText) return false;
  const text = messageText.toLowerCase();

  // Normalize helper to remove accents and replace ñ with n
  const normalize = (str) => {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n');
  };

  const cleanText = normalize(text);

  // 1. Check role mentions (e.g. "@Planta", "operaciones")
  if (user.rol) {
    const roleKey = normalize(user.rol);
    const roleRegex = new RegExp(`\\b${roleKey}\\b`, 'i');
    if (roleRegex.test(cleanText)) return true;
  }

  // Explicit check for pañol / panol
  if (user.rol && user.rol.toLowerCase() === 'pañol') {
    if (/\bpanol\b/i.test(text) || /\bpañol\b/i.test(text)) return true;
  }

  // 2. Check username mentions (e.g. "@mariana", "mariana")
  if (user.username) {
    const usernameKey = normalize(user.username);
    const usernameRegex = new RegExp(`\\b${usernameKey}\\b`, 'i');
    if (usernameRegex.test(cleanText)) return true;
  }

  // 3. Check name mentions (e.g. "Mariana D'Angiola")
  if (user.nombre) {
    const nameWords = user.nombre.split(/[\s()\-´`'’]+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && w.toLowerCase() !== 'staff' && w.toLowerCase() !== 'administrador' && w.toLowerCase() !== 'super');
    
    for (const word of nameWords) {
      const cleanWord = normalize(word);
      const wordRegex = new RegExp(`\\b${cleanWord}\\b`, 'i');
      if (wordRegex.test(cleanText)) return true;
    }
  }

  return false;
};

// ----------------------------------------------------
// 4. CHAT ENDPOINTS
// ----------------------------------------------------
app.get('/api/chat/alerts', async (req, res) => {
  const { username, rol, nombre } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Missing username parameter' });
  }

  try {
    const allOTs = await db.getOTs();
    const allMessages = await db.getAllChatMessages();

    const user = { username, rol, nombre };
    const matchingMessages = allMessages.filter(msg => {
      // Avoid self-alerting
      const isSelf = msg.usuario === nombre || (msg.usuario === username && msg.rol === rol);
      if (isSelf) return false;

      return userIsMentioned(msg.mensaje, user);
    });

    const alerts = matchingMessages.map(msg => {
      const ot = allOTs.find(o => o.id === msg.ot_id);
      return {
        id: msg.id,
        ot_id: msg.ot_id,
        ot_numero: ot ? ot.ot_numero : `OT-${msg.ot_id}`,
        cliente_nombre: ot ? ot.cliente_nombre : 'Cliente Desconocido',
        mensaje: msg.mensaje,
        usuario: msg.usuario,
        rol: msg.rol,
        fecha_envio: msg.fecha_envio
      };
    });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chat/:ot_id', async (req, res) => {
  const { ot_id } = req.params;
  try {
    const msgs = await db.getChatMessages(parseInt(ot_id));
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const msg = await db.saveChatMessage(req.body);
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventario/estructuras', async (req, res) => {
  try {
    const structures = await db.getStructures();
    const archesData = await db.getArches();
    const modulesData = await db.getModules();
    const fijosData = await db.getFijos();
    const ots = await db.getOTs();

    // 1. Filter out active OTs (status not in 'Cancelada', 'Rechazada')
    const activeOTs = ots.filter(ot => ot.estado !== 'Cancelada' && ot.estado !== 'Rechazada');

    // 2. Compute occupied components for each active OT, split by reserved (in factory) vs in-use (outside)
    const reservedCapacity = {}; // key: master model -> product -> quantity
    const inUseCapacity = {};    // key: master model -> product -> quantity

    for (const ot of activeOTs) {
      const model = ot.modelo_estructura;
      const prefix = model.split('-')[0];
      const modConfig = typeof ot.modulacion_config === 'string' ? JSON.parse(ot.modulacion_config) : ot.modulacion_config;
      const adicionales = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};

      const isEnUso = ot.estado === 'Completada';
      const targetMap = isEnUso ? inUseCapacity : reservedCapacity;

      let totalModules = 0;
      const selectedModules = modConfig?.modulos || [];
      selectedModules.forEach(m => { totalModules += m.qty; });
      const archesCount = totalModules + 1;

      // A. Arches occupied
      const arcosReservados = adicionales.arcos_reservados || [];
      const archIds = arcosReservados.length > 0 
        ? arcosReservados 
        : Array.from({ length: archesCount }, (_, i) => `${model}_A${i + 1}`);

      const archComponents = archesData.filter(a => 
        a.modelo_estructura === model && 
        archIds.includes(a.arco)
      );

      archComponents.forEach(c => {
        const key = model;
        if (!targetMap[key]) targetMap[key] = {};
        if (!targetMap[key][c.producto]) targetMap[key][c.producto] = 0;
        targetMap[key][c.producto] += c.qty_fija_arco;
      });

      // B. Modules occupied
      const conformedModulosList = adicionales.conformed_modulos_list || [];
      if (conformedModulosList.length > 0) {
        conformedModulosList.forEach(m => {
          let lookupModel = m.modelo_estructura;
          if (m.largo === 2) lookupModel = `${prefix}_2MTS`;
          else if (m.largo === 3) lookupModel = `${prefix}_3MTS`;

          const modComponents = modulesData.filter(mod => {
            const matchModel = m.largo === 5
              ? (mod.modulo_val === lookupModel)
              : (mod.modelo_estructura === lookupModel);
            return matchModel && mod.modulacion === m.largo;
          });

          modComponents.forEach(c => {
            const key = model;
            if (!targetMap[key]) targetMap[key] = {};
            if (!targetMap[key][c.producto]) targetMap[key][c.producto] = 0;
            const qtyPerMod = c.stock_inicial || c.qty_fija_modulo || 0;
            targetMap[key][c.producto] += qtyPerMod * m.qty;
          });
        });
      } else {
        selectedModules.forEach(m => {
          let lookupModel = adicionales.modulo_modelo_estructura || model;
          if (m.largo === 2) lookupModel = `${prefix}_2MTS`;
          else if (m.largo === 3) lookupModel = `${prefix}_3MTS`;

          const modComponents = modulesData.filter(mod => {
            const matchModel = m.largo === 5
              ? (mod.modulo_val === `${lookupModel}-M1` || mod.modulo_val === `${model}-M1`)
              : (mod.modelo_estructura === lookupModel);
            return matchModel && mod.modulacion === m.largo;
          });

          modComponents.forEach(c => {
            const key = model;
            if (!targetMap[key]) targetMap[key] = {};
            if (!targetMap[key][c.producto]) targetMap[key][c.producto] = 0;
            const qtyPerMod = c.stock_inicial || c.qty_fija_modulo || 0;
            targetMap[key][c.producto] += qtyPerMod * m.qty;
          });
        });
      }

      // C. Fijos occupied
      const lookupFijoModel = adicionales.fijo_modelo_estructura || model;
      const fixedComponents = fijosData.filter(f => f.modelo_estructura === lookupFijoModel);
      fixedComponents.forEach(f => {
        const key = model;
        if (!targetMap[key]) targetMap[key] = {};
        if (!targetMap[key][f.producto]) targetMap[key][f.producto] = 0;
        targetMap[key][f.producto] += f.qty_fija_carpa;
      });
    }

    // 3. Compute total capacity for each master structure
    const stockReport = [];

    for (const est of structures) {
      const model = est.modelo_estructura;
      const prefix = model.split('-')[0];
      const materialsMap = {};

      // A. Arches capacity
      const archComponents = archesData.filter(a => a.modelo_estructura === model);
      archComponents.forEach(c => {
        if (!materialsMap[c.producto]) {
          materialsMap[c.producto] = { producto: c.producto, sector: c.sector, total: 0 };
        }
        materialsMap[c.producto].total += c.qty_fija_arco;
      });

      // B. Modules capacity
      const modComponents = modulesData.filter(mod => 
        (mod.modulo_val && mod.modulo_val.startsWith(model)) || 
        (mod.modelo_estructura === `${prefix}_2MTS`) || 
        (mod.modelo_estructura === `${prefix}_3MTS`)
      );
      modComponents.forEach(c => {
        if (!materialsMap[c.producto]) {
          materialsMap[c.producto] = { producto: c.producto, sector: c.sector, total: 0 };
        }
        const qtyPerMod = c.stock_inicial || c.qty_fija_modulo || 0;
        materialsMap[c.producto].total += qtyPerMod;
      });

      // C. Fijos capacity
      const fixedComponents = fijosData.filter(f => f.modelo_estructura === model);
      fixedComponents.forEach(f => {
        if (!materialsMap[f.producto]) {
          materialsMap[f.producto] = { producto: f.producto, sector: f.sector, total: 0 };
        }
        materialsMap[f.producto].total += f.qty_fija_carpa;
      });

      // Map calculations
      const materialsList = Object.values(materialsMap).map(item => {
        const reserved = (reservedCapacity[model] && reservedCapacity[model][item.producto]) || 0;
        const inUse = (inUseCapacity[model] && inUseCapacity[model][item.producto]) || 0;
        const occupied = reserved + inUse;
        const available = Math.max(0, item.total - occupied);
        return {
          ...item,
          reserved,
          inUse,
          available
        };
      });

      stockReport.push({
        modelo_estructura: model,
        estructura_tipo: est.estructura_tipo,
        frente: est.frente,
        largo_maximo: est.largo_maximo,
        materiales: materialsList
      });
    }

    res.json(stockReport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. INVENTORY & ADMIN ENDPOINTS
// ----------------------------------------------------
app.get('/api/inventario', async (req, res) => {
  try {
    const accessories = await db.getAccessories();
    res.json(accessories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/reset', async (req, res) => {
  try {
    // Read local db.json template and reload
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const jsonDbPath = path.join(__dirname, 'data', 'db.json');

    if (fs.existsSync(jsonDbPath)) {
      const raw = fs.readFileSync(jsonDbPath, 'utf8');
      const parsed = JSON.parse(raw);
      
      await db.resetDatabase(parsed);
      res.json({ success: true, message: 'Database successfully reset to parsed historical seeding template.' });
    } else {
      res.status(400).json({ error: 'Seed data template file not found.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/clear-ots', async (req, res) => {
  try {
    await db.clearOTs();
    res.json({ success: true, message: 'Todas las órdenes de trabajo y chats fueron eliminados con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 6. USER AUTH & MANAGEMENT ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan usuario o contraseña.' });
  }
  try {
    const user = await db.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }
    res.json({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      rol: user.rol,
      modulos: user.modulos || '[]',
      fecha_creacion: user.fecha_creacion
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/usuarios', async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/usuarios', async (req, res) => {
  try {
    const user = await db.saveUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await db.updateUser(parseInt(id), req.body);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await db.deleteUser(parseInt(id));
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clean up temp AR files older than 1 hour
const cleanTempArFolder = () => {
  try {
    const files = fs.readdirSync(tempArDir);
    const now = Date.now();
    let deletedCount = 0;
    files.forEach(file => {
      const filePath = path.join(tempArDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 3600000) { // 1 hour
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    if (deletedCount > 0) {
      console.log(`[AR Cleanup] Deleted ${deletedCount} expired GLB files.`);
    }
  } catch (e) {
    console.error('[AR Cleanup] Error cleaning up temp-ar directory:', e);
  }
};

// Android AR Upload endpoint
app.post('/api/ar/upload-glb', express.raw({ type: 'application/octet-stream', limit: '20mb' }), (req, res) => {
  try {
    cleanTempArFolder();

    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'Request body must contain binary GLB data' });
    }

    const filename = `carpa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.glb`;
    const filePath = path.join(tempArDir, filename);
    
    fs.writeFileSync(filePath, req.body);
    
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const publicUrl = `${protocol}://${host}/api/temp-ar/${filename}`;
    
    console.log(`[AR Upload] Saved GLB to ${filePath}. Accessible at ${publicUrl}`);
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('[AR Upload] Error saving GLB:', err);
    res.status(500).json({ error: err.message });
  }
});

// Startup server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Carpas D'Angiola ERP Backend API running on port ${PORT}`);
  cleanTempArFolder();
});

