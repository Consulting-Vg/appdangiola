import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import XLSX from 'xlsx';

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve temporary AR files statically
app.use('/api/temp-ar', express.static(tempArDir));

// Database in-memory cache variable for AI chat assistant
let dbMemoryCache = null;

// Middleware to clear database memory cache on mutations (non-GET requests)
app.use((req, res, next) => {
  if (req.method !== 'GET' && !req.path.startsWith('/api/chat-ia') && !req.path.startsWith('/api/clima')) {
    console.log(`[Cache Invalidation] Mutation detected: ${req.method} ${req.path}. In-memory DB cache cleared.`);
    dbMemoryCache = null;
  }
  next();
});



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
// 1b. PERSONAL ENDPOINTS
// ----------------------------------------------------
app.get('/api/personal', async (req, res) => {
  try {
    const personal = await db.getAllPersonal();
    res.json(personal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/personal', async (req, res) => {
  try {
    const persona = await db.savePersonal(req.body);
    res.status(201).json(persona);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/personal/:id', async (req, res) => {
  try {
    const persona = await db.updatePersonal(parseInt(req.params.id), req.body);
    if (!persona) return res.status(404).json({ error: 'Personal no encontrado' });
    res.json(persona);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/personal/:id', async (req, res) => {
  try {
    const success = await db.deletePersonal(parseInt(req.params.id));
    if (!success) return res.status(404).json({ error: 'Personal no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 1c. RECURSOS ENDPOINTS
// ----------------------------------------------------
app.get('/api/recursos', async (req, res) => {
  try {
    const recursos = await db.getAllRecursos();
    res.json(recursos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/recursos', async (req, res) => {
  try {
    const recurso = await db.saveRecurso(req.body);
    res.status(201).json(recurso);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/recursos/:id', async (req, res) => {
  try {
    const recurso = await db.updateRecurso(parseInt(req.params.id), req.body);
    if (!recurso) return res.status(404).json({ error: 'Recurso no encontrado' });
    res.json(recurso);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/recursos/:id', async (req, res) => {
  try {
    const success = await db.deleteRecurso(parseInt(req.params.id));
    if (!success) return res.status(404).json({ error: 'Recurso no encontrado' });
    res.json({ success: true });
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
        datesOverlap(ot.fecha_inicio, ot.fecha_comienzo_desarmado || ot.fecha_fin, fecha_inicio, fecha_fin)
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

// ── NEW: Weather analysis + Gemini safety assessment API
app.post('/api/clima', async (req, res) => {
  const { lat, lng, ot_numero, cliente_nombre } = req.body;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Faltan coordenadas de latitud y longitud.' });
  }

  try {
    // 1. Fetch weather forecast from Open-Meteo
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max&timezone=auto`;
    const weatherRes = await fetch(url);
    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo returned status ${weatherRes.status}`);
    }
    const weatherData = await weatherRes.json();

    // 2. Query Gemini API for Safety analysis
    const apiKey = process.env.GEMINI_API_KEY;
    let aiRecommendation = null;

    if (apiKey) {
      try {
        const current = weatherData.current_weather || {};
        const daily = weatherData.daily || { time: [] };
        
        const forecastText = daily.time.map((date, idx) => {
          return `${date}: Temp Máx ${daily.temperature_2m_max?.[idx]}°C, Temp Mín ${daily.temperature_2m_min?.[idx]}°C, Prob. Precipitaciones ${daily.precipitation_probability_max?.[idx]}%, Viento Máx ${daily.windspeed_10m_max?.[idx]} km/h`;
        }).join('\n');

        const prompt = `Actúa como un experto en prevención de riesgos laborales e ingenieria de estructuras temporales (carpas y tinglados). Analiza el pronóstico meteorológico para realizar tareas de montaje, desmontaje y logística de carpas en la ubicación especificada.
OT: ${ot_numero || 'No especificada'}
Cliente: ${cliente_nombre || 'No especificado'}

Datos del clima actual:
- Temperatura: ${current.temperature}°C
- Velocidad del viento: ${current.windspeed} km/h

Pronóstico de los próximos 7 días:
${forecastText}

Redacta un informe de recomendación de seguridad operativa breve, profesional y conciso en español (máximo 4 párrafos cortos o viñetas), indicando:
1. Nivel de riesgo operativo (Bajo, Medio, Alto) y por qué.
2. Recomendaciones de seguridad cruciales. Advierte sobre vientos mayores a 35 km/h (peligro al subir lonas o levantar pórticos), lluvias intensas o frío/calor extremos.
3. Indicación de días óptimos para montaje/desarme vs. días de alerta o suspensión.
Sé práctico, técnico y directo.`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (geminiRes.ok) {
          const geminiJson = await geminiRes.json();
          aiRecommendation = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } else {
          const errText = await geminiRes.text();
          console.error("Gemini API error:", geminiRes.status, errText);
        }
      } catch (geminiErr) {
        console.error("Error communicating with Gemini:", geminiErr);
      }
    } else {
      console.log("No GEMINI_API_KEY found in process.env, skipping AI recommendations");
    }

    res.json({
      weather: weatherData,
      aiRecommendation
    });
  } catch (err) {
    console.error("Error in /api/clima:", err);
    res.status(500).json({ error: err.message || 'Error al obtener análisis climático' });
  }
});

// ── NEW: getDBCacheSummary helper function
async function getDBCacheSummary() {
  if (dbMemoryCache) {
    console.log("[Cache Hit] Serving pre-processed database summary from memory.");
    return dbMemoryCache;
  }

  console.log("[Cache Miss] Pre-processing database and loading into memory...");
  try {
    const [clients, ots, structures, sales, accessories] = await Promise.all([
      db.getClients().catch(() => []),
      db.getOTs().catch(() => []),
      db.getStructures().catch(() => []),
      db.getVentasHistoricas().catch(() => []),
      db.getAccessories().catch(() => [])
    ]);

    // Condense the databases into a simplified format to avoid bloating prompt context
    const condensedClients = (clients || []).map(c => ({
      id: c.id,
      nombre: c.nombre,
      localidad: c.localidad,
      provincia: c.provincia,
      vendedores: c.vendedores
    }));

    const condensedOTs = (ots || []).map(o => {
      let adicionales = {};
      try {
        adicionales = typeof o.adicionales === 'string' ? JSON.parse(o.adicionales) : o.adicionales || {};
      } catch (e) {}

      return {
        ot_numero: o.ot_numero,
        cliente_nombre: o.cliente_nombre,
        modelo_estructura: o.modelo_estructura,
        fecha_inicio: o.fecha_inicio,
        fecha_fin: o.fecha_fin,
        estado: o.estado,
        superficie: o.superficie,
        arcos_necesarios: o.arcos_necesarios,
        adicionales: adicionales ? {
          lonas: adicionales.lonas?.si ? `Lonas (${adicionales.lonas.color || 'sin color'}, ${adicionales.lonas.cantidad_panos || 0} paños / ${adicionales.lonas.metros || 0}m)` : null,
          pisos: adicionales.pisos?.si ? `Pisos (${adicionales.pisos.color || 'sin color'}, ${adicionales.pisos.cantidad_panos || 0} paños / ${adicionales.pisos.metros || 0}m)` : null,
          alfombras: adicionales.alfombras?.si ? `Alfombras (${adicionales.alfombras.color || 'sin color'}, ${adicionales.alfombras.cantidad_panos || 0} paños / ${adicionales.alfombras.metros || 0}m)` : null,
          telas: adicionales.telas?.si ? `Telas (${adicionales.telas.color || 'sin color'}, ${adicionales.telas.cantidad_panos || 0} paños / ${adicionales.telas.metros || 0}m)` : null
        } : null
      };
    });

    const condensedStructures = (structures || []).map(s => ({
      modelo_estructura: s.modelo_estructura,
      arcos_totales: s.arcos_totales,
      arcos_disponibles: s.arcos_disponibles,
      estructura_tipo: s.estructura_tipo
    }));

    // Summary statistics of historical sales
    const salesSummary = {
      total_records: (sales || []).length,
      total_m2: (sales || []).reduce((sum, v) => sum + (parseFloat(v.superficie_m2) || 0), 0),
      top_clients: {},
      top_vendedores: {},
      top_carpas: {},
      ventas_por_ano_mes: {}
    };

    (sales || []).forEach(v => {
      if (v.cliente_nombre) {
        salesSummary.top_clients[v.cliente_nombre] = (salesSummary.top_clients[v.cliente_nombre] || 0) + 1;
      }
      if (v.vendedor) {
        salesSummary.top_vendedores[v.vendedor] = (salesSummary.top_vendedores[v.vendedor] || 0) + 1;
      }
      if (v.carpa_raw) {
        salesSummary.top_carpas[v.carpa_raw] = (salesSummary.top_carpas[v.carpa_raw] || 0) + 1;
      }
      if (v.fecha_alta) {
        const month = v.fecha_alta.substring(0, 7); // YYYY-MM
        salesSummary.ventas_por_ano_mes[month] = (salesSummary.ventas_por_ano_mes[month] || 0) + 1;
      }
    });

    const getTopN = (obj, n = 5) => {
      return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));
    };

    salesSummary.top_clients = getTopN(salesSummary.top_clients, 10);
    salesSummary.top_vendedores = getTopN(salesSummary.top_vendedores, 10);
    salesSummary.top_carpas = getTopN(salesSummary.top_carpas, 10);
    salesSummary.ventas_por_ano_mes = getTopN(salesSummary.ventas_por_ano_mes, 12);

    const condensedAccessories = (accessories || []).map(a => ({
      categoria: a.categoria,
      nombre: a.nombre,
      color: a.color,
      medida: a.medida,
      stock_total: a.stock_total
    }));

    dbMemoryCache = {
      timestamp: new Date().toISOString(),
      clientes: condensedClients,
      ordenes_trabajo: condensedOTs,
      estructuras: condensedStructures,
      ventas_historicas_resumen: salesSummary,
      inventario_accesorios: condensedAccessories
    };

    return dbMemoryCache;
  } catch (err) {
    console.error("Error pre-processing databases to memory:", err);
    throw err;
  }
}

// ── NEW: AI Chat Agent endpoint for VigIA console
app.post('/api/chat-ia', async (req, res) => {
  const { messages, userRole, userName } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Falta historial de mensajes válido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada en el backend.' });
  }

  try {
    const dbSummary = await getDBCacheSummary();

    const systemInstruction = `Actúas como un agente experto COMERCIAL y de GERENCIA de IA para Carpas D'Angiola, una empresa líder en alquiler y montaje de estructuras temporales (carpas y tinglados).
Tienes acceso en tiempo real a las bases de datos de la empresa, las cuales han sido procesadas previamente y cargadas en memoria.

Datos de Memoria (Timestamp de carga: ${dbSummary.timestamp}):
- Clientes de la empresa: ${JSON.stringify(dbSummary.clientes)}
- Órdenes de Trabajo (OTs) activas: ${JSON.stringify(dbSummary.ordenes_trabajo)}
- Estructuras Maestras (Modelos de carpas disponibles y stock de arcos): ${JSON.stringify(dbSummary.estructuras)}
- Inventario de Accesorios (Lonas, pisos, alfombras, etc.): ${JSON.stringify(dbSummary.inventario_accesorios)}
- Resumen de Ventas Históricas (KPIs y agregaciones comerciales): ${JSON.stringify(dbSummary.ventas_historicas_resumen)}

Instrucciones de Respuesta:
1. Responde a preguntas comerciales y de gerencia de forma profesional, clara, directa y en español.
2. Utiliza los datos provistos en memoria para dar estadísticas, tendencias, comparativas, o responder detalles específicos de clientes u OTs.
3. Si el usuario te pregunta por totales, haz los cálculos basándote en la información estructurada que tienes.
4. Mantén tus respuestas concisas pero completas. No inventes datos que no existan en la base de datos de memoria. Si no encuentras algo, indícalo cortésmente.
5. Tu nombre es "VigIA Asistente Comercial". Eres el copiloto de la gerencia.`;

    const formattedContents = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: formattedContents
    };

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error in /api/chat-ia:", geminiRes.status, errText);
      return res.status(500).json({ error: `Gemini API error: ${geminiRes.status}` });
    }

    const geminiJson = await geminiRes.json();
    const assistantText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || 'No se recibió respuesta del asistente de IA.';

    res.json({ response: assistantText });
  } catch (err) {
    console.error("Error in /api/chat-ia:", err);
    res.status(500).json({ error: err.message || 'Error interno en el asistente de IA' });
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
      datesOverlap(ot.fecha_inicio, ot.fecha_comienzo_desarmado || ot.fecha_fin, fecha_inicio, fecha_fin)
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

    // Auto-sync OT to Gerencia BI historical data if approved or completed
    if (estado === 'Aprobada por Gerencia' || estado === 'Aprobada' || estado === 'Completada') {
      await syncOtToVentasHistoricas(ot);
    }

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

app.delete('/api/ots/:id', async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'];
  const userName = req.headers['x-user-name'] || 'Usuario Autorizado';

  if (userRole !== 'Gerencia' && userRole !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo Gerencia o SuperAdmin pueden eliminar Órdenes de Trabajo.' });
  }

  try {
    const ots = await db.getOTs();
    const ot = ots.find(o => o.id === parseInt(id));
    if (!ot) {
      return res.status(404).json({ error: 'Orden de Trabajo no encontrada.' });
    }

    const success = await db.deleteOT(parseInt(id));
    if (!success) {
      return res.status(500).json({ error: 'No se pudo eliminar la Orden de Trabajo.' });
    }

    // Log transaction
    await db.saveTransactionLog({
      ot_id: ot.id,
      ot_numero: ot.ot_numero,
      usuario: userName,
      rol: userRole,
      accion: 'ELIMINAR_OT',
      detalles: `Eliminación permanente de la OT ${ot.ot_numero} (Cliente: ${ot.cliente_nombre})`
    });

    res.json({ success: true, message: `Orden de Trabajo ${ot.ot_numero} eliminada con éxito.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ----------------------------------------------------
// 3b. LOGISTICS & DISASSEMBLY MODULE
// ----------------------------------------------------
app.put('/api/ots/:id/logistica', async (req, res) => {
  const { id } = req.params;
  const { fecha_fin, fecha_traslado, fecha_comienzo_armado, fecha_comienzo_desarmado, fecha_retorno, usuario, rol } = req.body;
  
  if (!fecha_fin) {
    return res.status(400).json({ error: 'Falta parámetro fecha_fin (Fecha de Desarme original)' });
  }

  try {
    const ot = await db.updateOTLogistica(parseInt(id), {
      fecha_fin,
      fecha_traslado,
      fecha_comienzo_armado,
      fecha_comienzo_desarmado,
      fecha_retorno
    }, usuario, rol);

    if (!ot) {
      return res.status(404).json({ error: 'OT no encontrada' });
    }

    // Log transaction
    await db.saveTransactionLog({
      ot_id: ot.id,
      ot_numero: ot.ot_numero,
      usuario: usuario || 'Sistema',
      rol: rol || 'Operaciones',
      accion: 'LOGISTICA_HITOS',
      detalles: `Se actualizaron hitos logísticos y fecha de desarme original: ${fecha_fin}`
    });

    res.json(ot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistica/alertas-desarme', async (req, res) => {
  try {
    const OTs = await db.getOTs();
    const now = new Date();
    const alerts = OTs.filter(ot => {
      if (['Cancelada', 'Rechazada', 'Pendiente', 'Desarmada', 'Retornada'].includes(ot.estado)) return false;
      const fechaDesarme = new Date(ot.fecha_fin + 'T00:00:00');
      const diffTime = fechaDesarme - now;
      const diffHours = diffTime / (1000 * 60 * 60);
      return diffHours <= 48 && diffHours >= -72;
    });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logistica/desarme', async (req, res) => {
  const { ot_id, retorno_completo, destinos, usuario, rol } = req.body;

  if (!ot_id || retorno_completo === undefined || !destinos) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos: ot_id, retorno_completo, destinos' });
  }

  try {
    const ots = await db.getOTs();
    const originalOT = ots.find(o => o.id === parseInt(ot_id));
    if (!originalOT) {
      return res.status(404).json({ error: 'OT de origen no encontrada' });
    }

    // 1. Update OT state to Desarmada
    const updatedOT = await db.updateOTStatus(originalOT.id, 'Desarmada', usuario, rol);

    // 2. Process returned accessories and transfers
    const remitosList = [];
    
    for (const dest of destinos) {
      const { type, ot_id: target_ot_id, ot_numero: target_ot_numero, items } = dest;
      
      if (type === 'deposito') {
        const accessories = await db.getAccessories();
        for (const item of items) {
          const acc = accessories.find(a => a.nombre.toLowerCase() === item.producto.toLowerCase());
          if (acc) {
            await db.updateAccessoryStock(acc.id, item.qty);
          }
        }

        remitosList.push({
          destino: 'Depósito Central Dangiola',
          tipo: 'Retorno Físico',
          items
        });

        await db.saveTransactionLog({
          ot_id: originalOT.id,
          ot_numero: originalOT.ot_numero,
          usuario: usuario || 'Sistema',
          rol: rol || 'Operaciones',
          accion: 'RETORNO_DEPOSITO',
          detalles: `Se retornaron ${items.length} componentes al depósito central.`
        });
      } else if (type === 'ot' && target_ot_id) {
        const targetOT = ots.find(o => o.id === parseInt(target_ot_id));
        if (targetOT) {
          const targetPanol = typeof targetOT.panol_status === 'string' ? JSON.parse(targetOT.panol_status) : targetOT.panol_status || { items: [] };
          const targetPlanta = typeof targetOT.planta_status === 'string' ? JSON.parse(targetOT.planta_status) : targetOT.planta_status || { items: [] };
          
          let transferredCount = 0;
          items.forEach(transferItem => {
            const itemCopy = { ...transferItem };
            
            // 1. Try to fulfill from targetPlanta items first
            if (targetPlanta.items) {
              for (let idx = 0; idx < targetPlanta.items.length; idx++) {
                const matched = targetPlanta.items[idx];
                if (matched.producto.toLowerCase() === itemCopy.producto.toLowerCase() && !matched.checked) {
                  const neededQty = matched.qty;
                  const transferQty = itemCopy.qty;
                  
                  if (transferQty >= neededQty) {
                    matched.checked = true;
                    matched.obs = (matched.obs || '') + ` [Recibido por transferencia de ${originalOT.ot_numero}]`;
                    transferredCount += neededQty;
                    itemCopy.qty -= neededQty;
                  } else {
                    // Split checklist line
                    matched.qty = transferQty;
                    matched.checked = true;
                    matched.obs = (matched.obs || '') + ` [Recibido por transferencia de ${originalOT.ot_numero}]`;
                    
                    const remainingQty = neededQty - transferQty;
                    targetPlanta.items.splice(idx + 1, 0, {
                      producto: matched.producto,
                      qty: remainingQty,
                      checked: false,
                      sector: matched.sector,
                      obs: ''
                    });
                    transferredCount += transferQty;
                    itemCopy.qty = 0;
                  }
                }
                if (itemCopy.qty <= 0) break;
              }
            }
            
            // 2. If there is still quantity to transfer, try to fulfill from targetPanol items
            if (itemCopy.qty > 0 && targetPanol.items) {
              for (let idx = 0; idx < targetPanol.items.length; idx++) {
                const matched = targetPanol.items[idx];
                if (matched.producto.toLowerCase() === itemCopy.producto.toLowerCase() && !matched.checked) {
                  const neededQty = matched.qty;
                  const transferQty = itemCopy.qty;
                  
                  if (transferQty >= neededQty) {
                    matched.checked = true;
                    matched.obs = (matched.obs || '') + ` [Recibido por transferencia de ${originalOT.ot_numero}]`;
                    transferredCount += neededQty;
                    itemCopy.qty -= neededQty;
                  } else {
                    // Split checklist line
                    matched.qty = transferQty;
                    matched.checked = true;
                    matched.obs = (matched.obs || '') + ` [Recibido por transferencia de ${originalOT.ot_numero}]`;
                    
                    const remainingQty = neededQty - transferQty;
                    targetPanol.items.splice(idx + 1, 0, {
                      producto: matched.producto,
                      qty: remainingQty,
                      checked: false,
                      sector: matched.sector,
                      obs: ''
                    });
                    transferredCount += transferQty;
                    itemCopy.qty = 0;
                  }
                }
                if (itemCopy.qty <= 0) break;
              }
            }
          });

          await db.updateOTChecklists(targetOT.id, targetPanol, targetPlanta, usuario, rol);

          await db.saveTransactionLog({
            ot_id: originalOT.id,
            ot_numero: originalOT.ot_numero,
            usuario: usuario || 'Sistema',
            rol: rol || 'Operaciones',
            accion: 'TRANSFERENCIA_SALIDA',
            detalles: `Se transfirieron ${items.length} componentes directamente a la OT #${targetOT.ot_numero}.`
          });

          await db.saveTransactionLog({
            ot_id: targetOT.id,
            ot_numero: targetOT.ot_numero,
            usuario: usuario || 'Sistema',
            rol: rol || 'Operaciones',
            accion: 'TRANSFERENCIA_ENTRADA',
            detalles: `Se recibieron ${items.length} componentes por transferencia directa desde la OT #${originalOT.ot_numero}.`
          });

          remitosList.push({
            destino: `OT #${targetOT.ot_numero} - ${targetOT.cliente_nombre}`,
            tipo: 'Transferencia Directa',
            items
          });
        }
      }
    }

    const desarmeRecord = await db.saveDesarme({
      ot_origen_id: originalOT.id,
      retorno_completo,
      destinos,
      remitos: remitosList,
      creado_por: usuario || 'Sistema'
    });

    res.status(201).json({
      success: true,
      desarme: desarmeRecord,
      ot: updatedOT
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistica/desarme/:otId', async (req, res) => {
  const { otId } = req.params;
  try {
    const record = await db.getDesarmeByOT(parseInt(otId));
    if (!record) {
      return res.status(404).json({ error: 'No se encontró un registro de desarme para esta OT' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistica/desarmes', async (req, res) => {
  try {
    const records = await db.getAllDesarmes();
    res.json(records);
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

      const key = model;
      if (!targetMap[key]) targetMap[key] = {};

      const panol = typeof ot.panol_status === 'string' ? JSON.parse(ot.panol_status) : ot.panol_status;
      if (panol && panol.items) {
        panol.items.forEach(item => {
          if (!targetMap[key][item.producto]) targetMap[key][item.producto] = 0;
          targetMap[key][item.producto] += Number(item.qty || 1);
        });
      }

      const planta = typeof ot.planta_status === 'string' ? JSON.parse(ot.planta_status) : ot.planta_status;
      if (planta && planta.items) {
        planta.items.forEach(item => {
          if (!targetMap[key][item.producto]) targetMap[key][item.producto] = 0;
          targetMap[key][item.producto] += Number(item.qty || 1);
        });
      }
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

// Sync OT to ventas_historicas
const syncOtToVentasHistoricas = async (ot) => {
  try {
    const existing = await db.getVentasHistoricas({ ot_id: ot.id });
    if (existing && existing.length > 0) return;

    let clienteNombre = ot.cliente_nombre;
    if ((!clienteNombre || clienteNombre === 'undefined' || clienteNombre === 'null') && ot.cliente_id) {
      const clients = await db.getClients();
      const client = clients.find(c => String(c.id) === String(ot.cliente_id));
      if (client) {
        clienteNombre = client.nombre;
      }
    }

    const adicionales = typeof ot.adicionales === 'string' ? JSON.parse(ot.adicionales) : ot.adicionales || {};
    const georef = typeof ot.georef === 'string' ? JSON.parse(ot.georef) : ot.georef || {};

    const piso = adicionales.pisos?.si || false;
    const tarima = adicionales.tarima?.si || adicionales.tarimas?.si || false;
    const alfombra = adicionales.alfombras?.si || adicionales.alfombra?.si || false;
    const cortina = adicionales.telas_cortinas?.si || adicionales.cortina?.si || false;
    const tribuna = adicionales.tribuna?.si || false;
    const sillas = adicionales.sillas?.si || false;

    let localidad = georef.direccion ? georef.direccion.split(',')[1]?.trim() || georef.direccion.substring(0, 50) : null;
    let provincia = georef.direccion ? georef.direccion.split(',')[2]?.trim() || 'Buenos Aires' : 'Buenos Aires';

    await db.insertVentaHistorica({
      fecha_alta: ot.fecha_creacion ? ot.fecha_creacion.substring(0, 10) : new Date().toISOString().substring(0, 10),
      fecha_armado: ot.fecha_inicio,
      fecha_desarme: ot.fecha_fin,
      cliente_nombre: clienteNombre || 'Cliente Desconocido',
      cliente_cuenta: ot.cliente_id ? String(ot.cliente_id) : null,
      vendedor: ot.creado_por || 'Sistema',
      carpa_raw: ot.modelo_estructura,
      superficie_m2: parseFloat(ot.superficie) || (parseFloat(ot.frente) * parseFloat(ot.largo)) || 0,
      localidad,
      provincia,
      latitud: georef.lat ? parseFloat(georef.lat) : null,
      longitud: georef.lng ? parseFloat(georef.lng) : null,
      piso,
      tarima,
      alfombra,
      cortina,
      tribuna,
      sillas,
      adicionales_raw: JSON.stringify(adicionales),
      condicion_fiscal: 'Responsable Inscripto',
      condicion_pago: 'Contado',
      origen: 'sistema_actual',
      ot_id: ot.id
    });
    console.log(`[Gerencia BI] Synced OT ${ot.ot_numero} to historical records.`);
  } catch (err) {
    console.error(`[Gerencia BI] Error syncing OT ${ot.id} to historical:`, err);
  }
};

// Startup server
const PORT = process.env.PORT || 5001;

// ────────────────────────────────────────────────────────────────────────────
// 7. GERENCIA BI — ENDPOINTS DEL DASHBOARD DE GERENCIA
// ────────────────────────────────────────────────────────────────────────────

// Helper: detectar adicionales desde texto libre del sistema anterior
const parseAdicionalesFromText = (text) => {
  if (!text) return { piso: false, tarima: false, alfombra: false, cortina: false, tribuna: false, sillas: false };
  const t = text.toLowerCase();
  return {
    piso:     t.includes('piso') || t.includes('fenolico') || t.includes('fenólico'),
    tarima:   t.includes('tarima') || t.includes('escenario'),
    alfombra: t.includes('alfombra'),
    cortina:  t.includes('cortina') || t.includes('lateral'),
    tribuna:  t.includes('tribuna') || t.includes('grader'),
    sillas:   t.includes('silla') || t.includes('butaca')
  };
};


// CSV Line parser that respects quoted values with commas
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// Helper: Parse clientes.csv from the workspace root
const parseClientesCSV = () => {
  try {
    const csvPath = path.resolve(__dirname, '../clientes.csv');
    if (!fs.existsSync(csvPath)) {
      console.warn(`[Gerencia BI] clientes.csv not found at \${csvPath}`);
      return null;
    }
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    
    // Normalize headers to find indexes case-insensitively
    const nombreIdx = headers.findIndex(h => h.toLowerCase() === 'nombre');
    const cuentaIdx = headers.findIndex(h => h.toLowerCase() === 'cuenta');
    const cuitIdx = headers.findIndex(h => h.toLowerCase() === 'cuit');
    const domicilioIdx = headers.findIndex(h => h.toLowerCase() === 'domicilio');
    const localidadIdx = headers.findIndex(h => h.toLowerCase() === 'localidad');
    const provinciaIdx = headers.findIndex(h => h.toLowerCase() === 'provincia');
    const telefonoIdx = headers.findIndex(h => h.toLowerCase() === 'teléfono' || h.toLowerCase() === 'telefono');
    const emailIdx = headers.findIndex(h => h.toLowerCase() === 'email_1' || h.toLowerCase() === 'email');
    const estadoIdx = headers.findIndex(h => h.toLowerCase() === 'estado');
    const observacionIdx = headers.findIndex(h => h.toLowerCase() === 'observación' || h.toLowerCase() === 'observacion');
    const vendedoresIdx = headers.findIndex(h => h.toLowerCase() === 'vendedores');
    const responsablesIdx = headers.findIndex(h => h.toLowerCase() === 'responsables');
    const latIdx = headers.findIndex(h => h.toLowerCase() === 'latitud');
    const lngIdx = headers.findIndex(h => h.toLowerCase() === 'longitud');

    const clients = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cells = parseCSVLine(line);
      const nombre = cells[nombreIdx] || '';
      if (!nombre) continue;

      clients.push({
        nombre: nombre,
        cuenta: cells[cuentaIdx] || `CL-\${i}`,
        cuit: cells[cuitIdx] || '',
        domicilio: cells[domicilioIdx] || '',
        localidad: cells[localidadIdx] || '',
        provincia: cells[provinciaIdx] || '',
        telefono: cells[telefonoIdx] || '',
        email: cells[emailIdx] || '',
        estado: cells[estadoIdx] || '',
        observacion: cells[observacionIdx] || '',
        vendedores: cells[vendedoresIdx] || '',
        responsables: cells[responsablesIdx] || '',
        latitud: parseFloat(cells[latIdx]) || null,
        longitud: parseFloat(cells[lngIdx]) || null
      });
    }
    return clients;
  } catch (err) {
    console.error('[Gerencia BI] Error parsing clientes.csv:', err);
    return null;
  }
};

// GET /api/gerencia/clientes-csv — lista de clientes cargada directamente del archivo clientes.csv
app.get('/api/gerencia/clientes-csv', async (req, res) => {
  try {
    let clients = parseClientesCSV();
    if (!clients) {
      console.log('[Gerencia BI] Falling back to database for clientes-csv');
      const dbClients = await db.getClients();
      clients = dbClients.map(c => ({
        nombre: c.nombre,
        cuenta: c.cuenta,
        cuit: c.cuit,
        domicilio: c.domicilio,
        localidad: c.localidad,
        provincia: c.provincia,
        telefono: c.telefono,
        email: c.email,
        estado: c.estado,
        observacion: c.observacion,
        vendedores: c.vendedores,
        responsables: c.responsables,
        latitud: c.latitud,
        longitud: c.longitud
      }));
    }
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gerencia/ventas-historicas — con filtros opcionales por query string
app.get('/api/gerencia/ventas-historicas', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, vendedor, cliente } = req.query;
    const rows = await db.getVentasHistoricas({ fecha_desde, fecha_hasta, vendedor, cliente });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gerencia/upload-historico — carga masiva de registros históricos (array JSON)
app.post('/api/gerencia/upload-historico', async (req, res) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo el SuperAdmin puede realizar esta acción.' });
  }
  try {
    const records = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Se esperaba un array de registros.' });
    }
    // Normalizar y enriquecer cada registro
    const normalized = records.map(r => {
      const adds = parseAdicionalesFromText(r.adicionales_raw || r.adicionales || '');
      return {
        fecha_alta:       r.fecha_alta || r['Alta'] || null,
        fecha_armado:     r.fecha_armado || r['Armado'] || r['Fecha Armado'] || r['fecha_inicio'] || '',
        fecha_desarme:    r.fecha_desarme || r['Desarme'] || r['Fecha Desarme'] || r['fecha_fin'] || '',
        cliente_nombre:   r.cliente_nombre || r['Cliente'] || r['cliente'] || '',
        cliente_cuenta:   r.cliente_cuenta || r['Cuenta'] || r['cuenta'] || null,
        vendedor:         r.vendedor || r['Vendedor'] || null,
        carpa_raw:        r.carpa_raw || r['Carpa'] || r['carpa'] || null,
        superficie_m2:    parseFloat(r.superficie_m2 || r['Superficie'] || r['m2'] || 0) || null,
        localidad:        r.localidad || r['Localidad'] || null,
        provincia:        r.provincia || r['Provincia'] || null,
        latitud:          parseFloat(r.latitud || r['Latitud'] || 0) || null,
        longitud:         parseFloat(r.longitud || r['Longitud'] || 0) || null,
        piso:             r.piso !== undefined ? !!r.piso : adds.piso,
        tarima:           r.tarima !== undefined ? !!r.tarima : adds.tarima,
        alfombra:         r.alfombra !== undefined ? !!r.alfombra : adds.alfombra,
        cortina:          r.cortina !== undefined ? !!r.cortina : adds.cortina,
        tribuna:          r.tribuna !== undefined ? !!r.tribuna : adds.tribuna,
        sillas:           r.sillas !== undefined ? !!r.sillas : adds.sillas,
        adicionales_raw:  r.adicionales_raw || r['Adicionales'] || r.adicionales || null,
        condicion_fiscal: r.condicion_fiscal || r['Cond. Fiscal'] || r['CondicionFiscal'] || null,
        condicion_pago:   r.condicion_pago || r['Cond. Pago'] || r['CondicionPago'] || null,
        origen:           'historico',
        ot_id:            null
      };
    }).filter(r => r.fecha_armado && r.cliente_nombre); // solo filas con datos mínimos

    const results = await db.bulkInsertVentasHistoricas(normalized);
    res.json({ insertados: results.length, total_enviados: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/gerencia/delete-historico — vaciar todos los registros históricos
app.delete('/api/gerencia/delete-historico', async (req, res) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo el SuperAdmin puede realizar esta acción.' });
  }
  try {
    const eliminados = await db.clearVentasHistoricas();
    res.json({ mensaje: 'Todos los registros históricos fueron eliminados.', eliminados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gerencia/kpis — KPIs globales
app.get('/api/gerencia/kpis', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, vendedor, cliente } = req.query;
    const rows = await db.getVentasHistoricas({ fecha_desde, fecha_hasta, vendedor, cliente });

    const totalM2 = rows.reduce((s, r) => s + (parseFloat(r.superficie_m2) || 0), 0);
    const totalEventos = rows.length;

    // Top 3 Clientes por frecuencia
    const clientCount = {};
    rows.forEach(r => {
      if (r.cliente_nombre && r.cliente_nombre !== 'undefined' && r.cliente_nombre !== 'Cliente Desconocido') {
        clientCount[r.cliente_nombre] = (clientCount[r.cliente_nombre] || 0) + 1;
      }
    });
    const top3Clientes = Object.entries(clientCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nombre, cantidad]) => ({ nombre, cantidad }));

    // Top 3 Estructuras (post-split por |)
    const estCount = {};
    rows.forEach(r => {
      const carpas = (r.carpa_raw || '').split('|').map(s => s.trim()).filter(Boolean);
      carpas.forEach(c => { estCount[c] = (estCount[c] || 0) + 1; });
    });
    const top3Estructuras = Object.entries(estCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nombre, cantidad]) => ({ nombre, cantidad }));

    // Ticket medio en m2
    const ticketMedio = totalEventos > 0 ? (totalM2 / totalEventos).toFixed(1) : 0;

    // Adicionales usage rates
    const adicionales = ['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'];
    const adicionalesStats = {};
    adicionales.forEach(a => {
      adicionalesStats[a] = rows.filter(r => r[a]).length;
    });

    res.json({ totalM2: totalM2.toFixed(1), totalEventos, ticketMedio, top3Clientes, top3Estructuras, adicionalesStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gerencia/evolucion-mensual — cierres y m2 agrupados por mes
app.get('/api/gerencia/evolucion-mensual', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, vendedor, cliente } = req.query;
    const rows = await db.getVentasHistoricas({ fecha_desde, fecha_hasta, vendedor, cliente });

    const byMonth = {};
    rows.forEach(r => {
      const d = r.fecha_armado ? String(r.fecha_armado).substring(0, 7) : null;
      if (!d) return;
      if (!byMonth[d]) byMonth[d] = { mes: d, cierres: 0, m2: 0 };
      byMonth[d].cierres++;
      byMonth[d].m2 += parseFloat(r.superficie_m2) || 0;
    });

    const sorted = Object.values(byMonth).sort((a, b) => a.mes.localeCompare(b.mes));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gerencia/top-modelos — Top 10 modelos de carpa
app.get('/api/gerencia/top-modelos', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, vendedor, cliente } = req.query;
    const rows = await db.getVentasHistoricas({ fecha_desde, fecha_hasta, vendedor, cliente });

    const modelCount = {};
    rows.forEach(r => {
      const carpas = (r.carpa_raw || '').split('|').map(s => s.trim()).filter(Boolean);
      carpas.forEach(c => {
        const key = c.substring(0, 40); // truncar para normalizar
        modelCount[key] = (modelCount[key] || 0) + 1;
      });
    });

    const top10 = Object.entries(modelCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([nombre, cantidad]) => ({ nombre, cantidad }));
    res.json(top10);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gerencia/vendedores — lista de vendedores únicos
app.get('/api/gerencia/vendedores', async (req, res) => {
  try {
    const rows = await db.getVentasHistoricas({});
    const vendedores = [...new Set(rows.map(r => r.vendedor).filter(Boolean))].sort();
    res.json(vendedores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gerencia/cliente-perfil/:nombre — Perfil completo de un cliente
app.get('/api/gerencia/cliente-perfil/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    const rows = await db.getVentasHistoricas({ cliente: nombre });

    // First find the client details from CSV/DB to provide profile context even if there are no history records
    let csvClients = parseClientesCSV();
    let clientInfo = null;
    if (csvClients) {
      clientInfo = csvClients.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
    }
    if (!clientInfo) {
      const dbClients = await db.getClients();
      const matched = dbClients.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      if (matched) {
        clientInfo = {
          nombre: matched.nombre,
          cuenta: matched.cuenta,
          cuit: matched.cuit,
          domicilio: matched.domicilio,
          localidad: matched.localidad,
          provincia: matched.provincia,
          telefono: matched.telefono,
          email: matched.email,
          estado: matched.estado,
          observacion: matched.observacion,
          vendedores: matched.vendedores,
          responsables: matched.responsables,
          latitud: matched.latitud,
          longitud: matched.longitud
        };
      }
    }

    if (rows.length === 0) {
      if (clientInfo) {
        return res.json({
          encontrado: true,
          cliente_nombre: clientInfo.nombre,
          condicion_fiscal: 'Responsable Inscripto',
          condicion_pago: 'Cuenta Corriente',
          total_eventos: 0,
          primera_compra: null,
          ultima_compra: null,
          dias_inactividad: null,
          ciclo_promedio_dias: null,
          proxima_venta_estimada: null,
          lead_time_promedio_dias: null,
          inicio_armado_sugerido: null,
          adicional_preferido: null,
          vendedor_principal: clientInfo.vendedores || 'Sin vendedor asignado',
          estructura_principal: 'Sin estructura predominante',
          intervalos: [],
          rows: []
        });
      }
      return res.json({ encontrado: false, rows: [] });
    }

    // Ordenar por fecha de armado
    const sorted = rows.sort((a, b) => (a.fecha_armado || '').localeCompare(b.fecha_armado || ''));

    // Calcular días entre compras
    const intervalos = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].fecha_armado);
      const d2 = new Date(sorted[i].fecha_armado);
      if (!isNaN(d1) && !isNaN(d2)) {
        intervalos.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      }
    }
    const cicloProm = intervalos.length > 0 ? Math.round(intervalos.reduce((s, v) => s + v, 0) / intervalos.length) : null;

    // Última compra y días de inactividad
    const ultimaFecha = sorted[sorted.length - 1]?.fecha_armado;
    const diasInactividad = ultimaFecha ? Math.round((new Date() - new Date(ultimaFecha)) / (1000 * 60 * 60 * 24)) : null;

    // Próxima venta estimada
    const proximaVenta = cicloProm && ultimaFecha
      ? new Date(new Date(ultimaFecha).getTime() + cicloProm * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
      : null;

    // Lead time promedio (días entre alta y armado)
    const leadTimes = rows.filter(r => r.fecha_alta && r.fecha_armado).map(r =>
      Math.round((new Date(r.fecha_armado) - new Date(r.fecha_alta)) / (1000 * 60 * 60 * 24))
    ).filter(d => d > 0 && d < 365);
    const leadTimeProm = leadTimes.length > 0 ? Math.round(leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length) : 7;

    // Inicio de armado sugerido
    const inicioArmadoSugerido = proximaVenta
      ? new Date(new Date(proximaVenta).getTime() - leadTimeProm * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
      : null;

    // Adicional preferido
    const adicionales = ['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'];
    let adMax = null, adMaxCount = 0;
    adicionales.forEach(a => {
      const count = rows.filter(r => r[a]).length;
      if (count > adMaxCount) { adMaxCount = count; adMax = a; }
    });

    // Vendedor más frecuente
    const vendedorCount = {};
    rows.forEach(r => { if (r.vendedor) vendedorCount[r.vendedor] = (vendedorCount[r.vendedor] || 0) + 1; });
    const vendedorPrincipal = Object.entries(vendedorCount).sort((a, b) => b[1] - a[1])[0]?.[0] || (clientInfo ? clientInfo.vendedores : null);

    // Estructura más contratada
    const estCount = {};
    rows.forEach(r => {
      (r.carpa_raw || '').split('|').map(s => s.trim()).filter(Boolean).forEach(c => {
        estCount[c] = (estCount[c] || 0) + 1;
      });
    });
    const estPrincipal = Object.entries(estCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    res.json({
      encontrado: true,
      cliente_nombre: rows[0].cliente_nombre,
      condicion_fiscal: rows[0].condicion_fiscal || 'Responsable Inscripto',
      condicion_pago: rows[0].condicion_pago || 'Cuenta Corriente',
      total_eventos: rows.length,
      primera_compra: sorted[0]?.fecha_armado,
      ultima_compra: ultimaFecha,
      dias_inactividad: diasInactividad,
      ciclo_promedio_dias: cicloProm,
      proxima_venta_estimada: proximaVenta,
      lead_time_promedio_dias: leadTimeProm,
      inicio_armado_sugerido: inicioArmadoSugerido,
      adicional_preferido: adMax,
      vendedor_principal: vendedorPrincipal,
      estructura_principal: estPrincipal,
      intervalos,
      rows: sorted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gerencia/auditoria-vendedor/:vendedor — Auditoría gerencial por vendedor
app.get('/api/gerencia/auditoria-vendedor/:vendedor', async (req, res) => {
  try {
    const vendedor = decodeURIComponent(req.params.vendedor);
    const rows = await db.getVentasHistoricas({ vendedor });

    if (rows.length === 0) return res.json({ encontrado: false });

    // Ticket medio m2
    const totalM2 = rows.reduce((s, r) => s + (parseFloat(r.superficie_m2) || 0), 0);
    const ticketMedio = rows.length > 0 ? (totalM2 / rows.length).toFixed(1) : 0;

    // Estructura más vendida por este vendedor
    const estCount = {};
    rows.forEach(r => {
      (r.carpa_raw || '').split('|').map(s => s.trim()).filter(Boolean).forEach(c => {
        estCount[c] = (estCount[c] || 0) + 1;
      });
    });
    const estructuraPrincipal = Object.entries(estCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Matriz de Periodicidad: por cada cliente, último evento y semáforo
    const clienteMap = {};
    rows.forEach(r => {
      if (!clienteMap[r.cliente_nombre]) {
        clienteMap[r.cliente_nombre] = { cliente: r.cliente_nombre, ultimas: [], total: 0 };
      }
      clienteMap[r.cliente_nombre].ultimas.push(r.fecha_armado);
      clienteMap[r.cliente_nombre].total++;
    });

    const hoy = new Date();
    const matrizPeriodicidad = Object.values(clienteMap).map(c => {
      const sorted = c.ultimas.sort();
      const ultima = sorted[sorted.length - 1];
      const dias = ultima ? Math.round((hoy - new Date(ultima)) / (1000 * 60 * 60 * 24)) : null;
      let semaforo = 'verde';
      if (dias === null || dias > 180) semaforo = 'rojo';
      else if (dias > 90) semaforo = 'amarillo';
      return { cliente: c.cliente, ultima_compra: ultima, dias_inactividad: dias, semaforo, total_compras: c.total };
    }).sort((a, b) => (b.dias_inactividad || 9999) - (a.dias_inactividad || 9999));

    res.json({
      encontrado: true,
      vendedor,
      total_eventos: rows.length,
      total_m2: totalM2.toFixed(1),
      ticket_medio_m2: ticketMedio,
      estructura_principal: estructuraPrincipal,
      matriz_periodicidad: matrizPeriodicidad
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gerencia/demanda-predictiva — Motor de planificación logística
app.get('/api/gerencia/demanda-predictiva', async (req, res) => {
  try {
    const { horizonte = 'mes' } = req.query;
    const rows = await db.getVentasHistoricas({});

    // Determinar función de filtrado según horizonte
    let filterFn;
    const hoy = new Date();
    let horizonteDias = 30;
    if (horizonte === 'marzo') {
      filterFn = (proxima) => proxima.getMonth() === 2; // Marzo (index 2)
    } else if (horizonte === 'diciembre') {
      filterFn = (proxima) => proxima.getMonth() === 11; // Diciembre (index 11)
    } else {
      horizonteDias = horizonte === 'semana' ? 7 : horizonte === 'trimestre' ? 90 : 30;
      const limite = new Date(hoy.getTime() + horizonteDias * 24 * 60 * 60 * 1000);
      filterFn = (proxima) => proxima >= hoy && proxima <= limite;
    }

    // Agrupar por cliente y calcular ciclo de recompra
    const clienteMap = {};
    rows.forEach(r => {
      if (!clienteMap[r.cliente_nombre]) clienteMap[r.cliente_nombre] = [];
      clienteMap[r.cliente_nombre].push(r);
    });

    const predicciones = [];
    for (const [cliente, eventos] of Object.entries(clienteMap)) {
      if (eventos.length < 2) continue; // necesitamos al menos 2 eventos para calcular ciclo
      const sorted = eventos.sort((a, b) => (a.fecha_armado || '').localeCompare(b.fecha_armado || ''));
      const intervalos = [];
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i - 1].fecha_armado);
        const d2 = new Date(sorted[i].fecha_armado);
        if (!isNaN(d1) && !isNaN(d2)) intervalos.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      }
      const ciclo = Math.round(intervalos.reduce((s, v) => s + v, 0) / intervalos.length);
      const ultima = new Date(sorted[sorted.length - 1].fecha_armado);
      const proxima = new Date(ultima.getTime() + ciclo * 24 * 60 * 60 * 1000);

      if (filterFn(proxima)) {
        // Probabilidades de adicionales basadas en historial de este cliente
        const total = eventos.length;
        const adicionales = {};
        ['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].forEach(a => {
          adicionales[a] = Math.round((eventos.filter(e => e[a]).length / total) * 100);
        });

        // Carpas más probables (basado en última + más frecuente)
        const estCount = {};
        eventos.forEach(e => {
          (e.carpa_raw || '').split('|').map(s => s.trim()).filter(Boolean).forEach(c => {
            estCount[c] = (estCount[c] || 0) + 1;
          });
        });
        const carpaEsperada = Object.entries(estCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        predicciones.push({
          cliente,
          proxima_fecha: proxima.toISOString().substring(0, 10),
          ciclo_dias: ciclo,
          ultima_compra: sorted[sorted.length - 1].fecha_armado,
          carpa_esperada: carpaEsperada,
          adicionales_prob: adicionales,
          confianza: intervalos.length >= 4 ? 'alta' : intervalos.length >= 2 ? 'media' : 'baja',
          total_eventos_historicos: total
        });
      }
    }

    predicciones.sort((a, b) => a.proxima_fecha.localeCompare(b.proxima_fecha));

    // Consolidar demanda de carpas
    const demandaCarpas = {};
    predicciones.forEach(p => {
      if (p.carpa_esperada) {
        if (!demandaCarpas[p.carpa_esperada]) demandaCarpas[p.carpa_esperada] = { modelo: p.carpa_esperada, cantidad: 0, clientes: [] };
        demandaCarpas[p.carpa_esperada].cantidad++;
        demandaCarpas[p.carpa_esperada].clientes.push(p.cliente);
      }
    });

    // Consolidar prob. de adicionales
    const adicionalesConsolidado = {};
    ['piso', 'tarima', 'alfombra', 'cortina', 'tribuna', 'sillas'].forEach(a => {
      const preds = predicciones.filter(p => p.adicionales_prob[a] > 0);
      if (preds.length > 0) {
        adicionalesConsolidado[a] = Math.round(preds.reduce((s, p) => s + p.adicionales_prob[a], 0) / preds.length);
      } else {
        adicionalesConsolidado[a] = 0;
      }
    });

    res.json({
      horizonte,
      horizonte_dias: horizonteDias,
      total_clientes_en_rango: predicciones.length,
      predicciones,
      demanda_carpas: Object.values(demandaCarpas).sort((a, b) => b.cantidad - a.cantidad),
      adicionales_consolidado: adicionalesConsolidado
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 8. MASTER DATA MANAGEMENT ENDPOINTS
// ----------------------------------------------------

app.get('/api/maestro/:table', async (req, res) => {
  try {
    const { table } = req.params;
    let data = [];
    if (table === 'personal') {
      data = await db.getAllPersonal();
    } else if (table === 'recursos') {
      data = await db.getAllRecursos();
    } else if (table === 'estructuras') {
      data = await db.getStructures();
    } else if (table === 'arcos') {
      data = await db.getArches();
    } else if (table === 'modulos') {
      data = await db.getModules();
    } else if (table === 'fijos') {
      data = await db.getFijos();
    } else if (table === 'clientes') {
      data = await db.getClients();
    } else if (table === 'vendedores') {
      data = await db.getVendedores();
    } else if (['lonas', 'telas', 'pisos', 'alfombras'].includes(table)) {
      const allAcc = await db.getAccessories();
      const catMap = { lonas: 'lona', telas: 'tela', pisos: 'piso', alfombras: 'alfombra' };
      data = allAcc.filter(a => a.categoria === catMap[table]);
    } else {
      return res.status(400).json({ error: 'Tabla no reconocida' });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/maestro/:table', async (req, res) => {
  try {
    const { table } = req.params;
    let result = null;
    const body = req.body;

    if (table === 'personal') {
      result = await db.savePersonal(body);
    } else if (table === 'recursos') {
      result = await db.saveRecurso(body);
    } else if (table === 'estructuras') {
      result = await db.saveStructure(body);
    } else if (table === 'arcos') {
      result = await db.saveArch(body);
    } else if (table === 'modulos') {
      result = await db.saveModule(body);
    } else if (table === 'fijos') {
      result = await db.saveFijo(body);
    } else if (table === 'clientes') {
      result = await db.saveClient(body);
    } else if (table === 'vendedores') {
      result = await db.saveVendedor(body);
    } else if (['lonas', 'telas', 'pisos', 'alfombras'].includes(table)) {
      const catMap = { lonas: 'lona', telas: 'tela', pisos: 'piso', alfombras: 'alfombra' };
      body.categoria = catMap[table];
      result = await db.saveAccessory(body);
    } else {
      return res.status(400).json({ error: 'Tabla no reconocida' });
    }
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/maestro/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const numericId = parseInt(id);
    let result = null;
    const body = req.body;

    if (table === 'personal') {
      result = await db.updatePersonal(numericId, body);
    } else if (table === 'recursos') {
      result = await db.updateRecurso(numericId, body);
    } else if (table === 'estructuras') {
      result = await db.updateStructure(numericId, body);
    } else if (table === 'arcos') {
      result = await db.updateArch(numericId, body);
    } else if (table === 'modulos') {
      result = await db.updateModule(numericId, body);
    } else if (table === 'fijos') {
      result = await db.updateFijo(numericId, body);
    } else if (table === 'clientes') {
      result = await db.updateClient(numericId, body);
    } else if (table === 'vendedores') {
      result = await db.updateVendedor(numericId, body);
    } else if (['lonas', 'telas', 'pisos', 'alfombras'].includes(table)) {
      const catMap = { lonas: 'lona', telas: 'tela', pisos: 'piso', alfombras: 'alfombra' };
      body.categoria = catMap[table];
      result = await db.updateAccessory(numericId, body);
    } else {
      return res.status(400).json({ error: 'Tabla no reconocida' });
    }

    if (!result) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/maestro/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const numericId = parseInt(id);
    let success = false;

    if (table === 'personal') {
      success = await db.deletePersonal(numericId);
    } else if (table === 'recursos') {
      success = await db.deleteRecurso(numericId);
    } else if (table === 'estructuras') {
      success = await db.deleteStructure(numericId);
    } else if (table === 'arcos') {
      success = await db.deleteArch(numericId);
    } else if (table === 'modulos') {
      success = await db.deleteModule(numericId);
    } else if (table === 'fijos') {
      success = await db.deleteFijo(numericId);
    } else if (table === 'clientes') {
      success = await db.deleteClient(numericId);
    } else if (table === 'vendedores') {
      success = await db.deleteVendedor(numericId);
    } else if (['lonas', 'telas', 'pisos', 'alfombras'].includes(table)) {
      success = await db.deleteAccessory(numericId);
    } else {
      return res.status(400).json({ error: 'Tabla no reconocida' });
    }

    if (!success) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/maestro/import/:table', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  try {
    const { table } = req.params;
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'El archivo está vacío' });
    }

    // Parse with SheetJS
    const workbook = XLSX.read(req.body, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No se encontraron filas de datos en el archivo' });
    }

    // Helper to find a value case-insensitively with fallback names
    const getVal = (row, fields, defaultVal = null) => {
      for (const field of fields) {
        const lowerField = field.toLowerCase().replace(/[\s\-_]/g, '');
        for (const k of Object.keys(row)) {
          const lowerK = k.toLowerCase().replace(/[\s\-_]/g, '');
          if (lowerK === lowerField) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
              return row[k];
            }
          }
        }
      }
      return defaultVal;
    };

    // Determine import mode: 'replace' (default) clears table first; 'append' just inserts new rows
    const importMode = (req.query.mode === 'append') ? 'append' : 'replace';
    const shouldClear = importMode === 'replace';
    let insertedCount = 0;

    if (table === 'personal') {
      if (shouldClear) await db.clearPersonal();
      for (const row of rows) {
        const nombre = getVal(row, ['Nombre', 'nombre']);
        if (!nombre) continue;
        const cuit = getVal(row, ['CUIT', 'cuit']);
        const telefono = getVal(row, ['Teléfono', 'Telefono', 'telefono']);
        const rol_funcion = getVal(row, ['Rol', 'Función', 'Funcion', 'rol_funcion', 'rol'], 'Operario');
        const activo = getVal(row, ['Activo', 'activo'], 'sí') !== 'no' && getVal(row, ['Activo', 'activo'], true) !== false;
        await db.savePersonal({ nombre, cuit, telefono, rol_funcion, activo });
        insertedCount++;
      }
    } else if (table === 'recursos') {
      if (shouldClear) await db.clearRecursos();
      for (const row of rows) {
        const nombre = getVal(row, ['Nombre', 'nombre']);
        if (!nombre) continue;
        const tipo = getVal(row, ['Tipo', 'tipo'], 'Maquinaria');
        const patente_identificador = getVal(row, ['Patente', 'Identificador', 'patente_identificador', 'patente']);
        const descripcion = getVal(row, ['Descripción', 'Descripcion', 'descripcion']);
        const activo = getVal(row, ['Activo', 'activo'], 'sí') !== 'no' && getVal(row, ['Activo', 'activo'], true) !== false;
        await db.saveRecurso({ nombre, tipo, patente_identificador, descripcion, activo });
        insertedCount++;
      }
    } else if (table === 'estructuras') {
      if (shouldClear) await db.clearStructures();
      for (const row of rows) {
        const modelo_estructura = getVal(row, ['Modelo_Estructura', 'Modelo', 'Nombre', 'modelo_estructura']);
        if (!modelo_estructura) continue;
        const arcos_totales = parseInt(getVal(row, ['Arcos totales', 'Arcos Totales', 'arcos_totales', 'arcos'], 0)) || 0;
        const estructura_tipo = getVal(row, ['Estructura', 'Tipo', 'estructura_tipo'], 'Aluminio');
        const frente = parseFloat(getVal(row, ['Frente', 'frente'], 0)) || 0;
        const largo_maximo = parseFloat(getVal(row, ['Largo_Maximo', 'Largo Máximo', 'largo_maximo'], 0)) || 0;
        const arcos_disponibles = parseInt(getVal(row, ['Arcos_Disponibles_Seleccion', 'Arcos Disponibles', 'arcos_disponibles'], arcos_totales)) || 0;
        await db.saveStructure({ modelo_estructura, arcos_totales, estructura_tipo, frente, largo_maximo, arcos_disponibles });
        insertedCount++;
      }
    } else if (table === 'arcos') {
      if (shouldClear) await db.clearArches();
      for (const row of rows) {
        const producto = getVal(row, ['Producto', 'Nombre', 'producto']);
        if (!producto) continue;
        const arco = getVal(row, ['Arco', 'arco']);
        const modelo_estructura = getVal(row, ['Modelo_Estructura', 'Modelo', 'Estructura', 'modelo_estructura']);
        const sector = getVal(row, ['Sector', 'sector'], 'Planta');
        const qty_fija_arco = parseInt(getVal(row, ['Qty_fija_arco', 'Cantidad', 'Qty', 'qty_fija_arco'], 0)) || 0;
        await db.saveArch({ producto, arco, modelo_estructura, sector, qty_fija_arco });
        insertedCount++;
      }
    } else if (table === 'modulos') {
      if (shouldClear) await db.clearModules();
      for (const row of rows) {
        const producto = getVal(row, ['Producto', 'Nombre', 'producto']);
        if (!producto) continue;
        const modulo_val = getVal(row, ['Modulo', 'modulo', 'modulo_val']);
        let baseModel = modulo_val || '';
        if (modulo_val) {
          let parts = modulo_val.includes('_') ? modulo_val.split('_') : modulo_val.split('-');
          if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            if (lastPart.startsWith('M') || lastPart === 'F') {
              parts.pop();
              baseModel = parts.join(modulo_val.includes('_') ? '_' : '-');
            }
          }
        }
        if (baseModel.includes("2MTS") || baseModel.includes("3MTS")) {
          baseModel = baseModel.replace(/-/g, "_");
        }
        const sector = getVal(row, ['Sector', 'sector'], 'Planta');
        const modulacion = parseInt(getVal(row, ['Modulacion', 'modulacion'], 5)) || 5;
        const stock_inicial = parseInt(getVal(row, ['Qty_fija_modulo', 'Qty-fija-modulo', 'Stock', 'Cantidad', 'stock_inicial'], 0)) || 0;
        await db.saveModule({ producto, modelo_estructura: baseModel, sector, modulacion, stock_inicial, modulo_val });
        insertedCount++;
      }
    } else if (table === 'fijos') {
      if (shouldClear) await db.clearFijos();
      for (const row of rows) {
        const producto = getVal(row, ['Producto', 'Nombre', 'producto']);
        if (!producto) continue;
        const fijo_val = getVal(row, ['Fijos', 'fijo', 'fijo_val']);
        let baseModel = fijo_val || '';
        if (fijo_val) {
          let parts = fijo_val.includes('_') ? fijo_val.split('_') : fijo_val.split('-');
          if (parts.length > 1 && parts[parts.length - 1] === 'F') {
            parts.pop();
            baseModel = parts.join(fijo_val.includes('_') ? '_' : '-');
          }
        }
        if (baseModel.includes("2MTS") || baseModel.includes("3MTS")) {
          baseModel = baseModel.replace(/-/g, "_");
        }
        const sector = getVal(row, ['Sector', 'sector'], 'Planta');
        const qty_fija_carpa = parseInt(getVal(row, ['Qty_fija_carpa', 'Qty-fija-carpa', 'Cantidad', 'qty_fija_carpa'], 0)) || 0;
        await db.saveFijo({ producto, modelo_estructura: baseModel, sector, qty_fija_carpa });
        insertedCount++;
      }
    } else if (table === 'clientes') {
      if (shouldClear) await db.clearClients();
      for (const row of rows) {
        const nombre = getVal(row, ['Nombre', 'nombre']);
        if (!nombre) continue;
        const cuenta = getVal(row, ['Cuenta', 'cuenta']) || `CL-${insertedCount + 1}`;
        const cuit = getVal(row, ['CUIT', 'cuit']);
        const actividad = getVal(row, ['Actividad', 'actividad']);
        const estado = getVal(row, ['Estado', 'estado']);
        const observacion = getVal(row, ['Observación', 'Observacion', 'observacion']);
        const domicilio = getVal(row, ['Domicilio', 'domicilio']);
        const localidad = getVal(row, ['Localidad', 'localidad']);
        const provincia = getVal(row, ['Provincia', 'provincia']);
        const pais = getVal(row, ['País', 'Pais', 'pais'], 'ARGENTINA');
        const telefono = getVal(row, ['Teléfono', 'Telefono', 'telefono']);
        const email = getVal(row, ['Email_1', 'Email', 'email']);
        const vendedores = getVal(row, ['Vendedores', 'vendedores']);
        const responsables = getVal(row, ['Responsables', 'responsables']);
        const latitud = parseFloat(getVal(row, ['Latitud', 'latitud'])) || null;
        const longitud = parseFloat(getVal(row, ['Longitud', 'longitud'])) || null;

        await db.saveClient({
          cuenta, nombre, cuit, actividad, estado, observacion, domicilio,
          localidad, provincia, pais, telefono, email, vendedores, responsables, latitud, longitud
        });
        insertedCount++;
      }
    } else if (table === 'vendedores') {
      if (shouldClear) await db.clearVendedores();
      for (const row of rows) {
        const nombre = getVal(row, ['Nombre', 'Vendedor', 'nombre']);
        if (!nombre) continue;
        const activo = getVal(row, ['Activo', 'activo'], 'sí') !== 'no' && getVal(row, ['Activo', 'activo'], true) !== false;
        await db.saveVendedor({ nombre, activo });
        insertedCount++;
      }
    } else if (['lonas', 'telas', 'pisos', 'alfombras'].includes(table)) {
      const catMap = { lonas: 'lona', telas: 'tela', pisos: 'piso', alfombras: 'alfombra' };
      const categoria = catMap[table];
      if (shouldClear) await db.clearAccessoriesByCategory(categoria);

      for (const row of rows) {
        let nombre = '';
        let color = null;
        let tipo = null;
        let medida = null;
        let estado = 'Regular';
        let stock_total = 0;

        if (table === 'pisos') {
          const est = getVal(row, ['Estructura', 'estructura', 'nombre']);
          if (!est) continue;
          nombre = est;
          medida = getVal(row, ['Medida', 'medida']);
          estado = getVal(row, ['Estado', 'estado'], 'Regular');
          stock_total = parseInt(getVal(row, ['Cantidad', 'Cantidad total', 'stock', 'stock_total'], 0)) || 0;
        } else if (table === 'lonas') {
          color = getVal(row, ['Color', 'color']);
          tipo = getVal(row, ['Tipo', 'tipo']);
          if (!color || !tipo) continue;
          medida = getVal(row, ['Medida', 'medida']);
          nombre = `Lona ${tipo} ${color} ${medida || ''}`.trim();
          stock_total = parseInt(getVal(row, ['Cantidad', 'Cantidad total', 'stock', 'stock_total'], 0)) || 0;
        } else if (table === 'telas') {
          color = getVal(row, ['Color', 'color']);
          const cortina = getVal(row, ['Cortina', 'cortina']);
          if (!color || !cortina) continue;
          tipo = cortina;
          nombre = `Tela ${cortina} ${color}`;
          estado = getVal(row, ['Tipo', 'Estado', 'estado'], 'Nuevo');
          stock_total = parseInt(getVal(row, ['Stock', 'stock', 'Cantidad', 'stock_total'], 0)) || 0;
        } else if (table === 'alfombras') {
          color = getVal(row, ['Colores', 'Color', 'color']);
          if (!color) continue;
          nombre = `Alfombra ${color}`;
          estado = getVal(row, ['Estado', 'estado'], 'Nueva');
          stock_total = parseInt(getVal(row, ['Metros', 'metros', 'Cantidad', 'stock', 'stock_total'], 0)) || 0;
        }

        await db.saveAccessory({ categoria, nombre, color, tipo, medida, estado, stock_total });
        insertedCount++;
      }
    } else {
      return res.status(400).json({ error: 'Tabla no reconocida' });
    }

    res.json({ success: true, insertados: insertedCount, total_enviados: rows.length, mode: importMode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Carpas D'Angiola ERP Backend API running on port ${PORT}`);
  cleanTempArFolder();
});
