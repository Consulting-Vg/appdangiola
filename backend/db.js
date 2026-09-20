import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// Ensure PostgreSQL DATE (1082) is returned as a plain string 'YYYY-MM-DD' without UTC timezone offset
if (pg && pg.types) {
  pg.types.setTypeParser(1082, (val) => val);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonDbPath = path.join(__dirname, 'data', 'db.json');

// Universal Date Normalizer (handles ISO YYYY-MM-DD, DD/MM/YYYY, Excel serial numbers, Date objects, nulls)
export const normalizeDate = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined' || trimmed === '-' || trimmed === '─') {
      return null;
    }
    // If format is YYYY-MM-DD or starts with YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // If format is DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      let y = dmyMatch[3];
      if (y.length === 2) y = `20${y}`;
      return `${y}-${m}-${d}`;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return null;
  }
  if (typeof val === 'number') {
    // Excel serial date (e.g. 45000 -> 2023...)
    if (val > 10000 && val < 100000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const targetDate = new Date(excelEpoch.getTime() + val * 86400000);
      if (!isNaN(targetDate.getTime())) {
        return targetDate.toISOString().split('T')[0];
      }
    }
  }
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
  }
  return null;
};

// Configuration
const safeJsonParse = (val, fallback = {}) => {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    console.error("Error parsing JSON in backend/db.js:", e, val);
    return fallback;
  }
};

const connectionString = process.env.DATABASE_URL;
let pool = null;
let usePostgreSQL = false;
let jsonDb = null;
let dbInitError = null; // Stores startup error for health endpoint


// Load JSON db helper
const loadJsonDb = () => {
  if (!jsonDb) {
    try {
      if (fs.existsSync(jsonDbPath)) {
        const data = fs.readFileSync(jsonDbPath, 'utf8');
        jsonDb = JSON.parse(data);
      } else {
        jsonDb = {
          clientes: [],
          estructuras_maestras: [],
          base_arco: [],
          base_modulo: [],
          base_fijo: [],
          inventario_accesorios: [],
          ordenes_trabajo: [],
          chat_mensajes: [],
          usuarios: [],
          log_transacciones: [],
          ventas_historicas: [],
          personal: [],
          recursos: []
        };
      }
    } catch (err) {
      console.error("Error loading JSON database fallback:", err);
      jsonDb = {
        clientes: [],
        estructuras_maestras: [],
        base_arco: [],
        base_modulo: [],
        base_fijo: [],
        inventario_accesorios: [],
        ordenes_trabajo: [],
        chat_mensajes: [],
        usuarios: [],
        log_transacciones: [],
        ventas_historicas: [],
        personal: [],
        recursos: []
      };
    }
  }
  if (!jsonDb.personal) jsonDb.personal = [];
  if (!jsonDb.recursos) jsonDb.recursos = [];
  if (!jsonDb.vendedores) jsonDb.vendedores = [];
  return jsonDb;
};
 
// Save JSON db helper
const saveJsonDb = () => {
  if (jsonDb) {
    try {
      fs.writeFileSync(jsonDbPath, JSON.stringify(jsonDb, null, 2), 'utf8');
    } catch (err) {
      console.error("Error saving JSON DB fallback:", err);
    }
  }
};

// Ensure essential default users always exist in PostgreSQL
const ensureDefaultUsers = async (p) => {
  try {
    const defaultUsers = [
      { username: 'admin', nombre: 'Super Administrador', password: 'admin', rol: 'SuperAdmin', modulos: '["Comercial", "Operaciones", "Almacen"]' },
      { username: 'mariana', nombre: 'Mariana D´Angiola', password: 'comercial', rol: 'Comercial', modulos: '["Comercial"]' },
      { username: 'luis', nombre: 'Luis Navarro', password: 'operaciones', rol: 'Operaciones', modulos: '["Operaciones"]' },
      { username: 'operaciones', nombre: 'Operaciones', password: 'operaciones', rol: 'Operaciones', modulos: '["Operaciones"]' },
      { username: 'gomez', nombre: 'Gómez (Planta)', password: 'planta', rol: 'Operario', modulos: '["Almacen"]' },
      { username: 'fabian', nombre: 'Fabián (Pañol)', password: 'panol', rol: 'Operario', modulos: '["Almacen"]' },
      { username: 'lonas', nombre: 'Lonas Staff', password: 'lonas', rol: 'Operario', modulos: '["Almacen"]' },
      { username: 'pisos', nombre: 'Pisos Staff', password: 'pisos', rol: 'Operario', modulos: '["Almacen"]' },
      { username: 'telas', nombre: 'Telas Staff', password: 'telas', rol: 'Operario', modulos: '["Almacen"]' },
      { username: 'chofer', nombre: 'Chofer de Despacho', password: 'chofer', rol: 'Chofer', modulos: '["Chofer"]' }
    ];

    for (const u of defaultUsers) {
      await p.query(`
        INSERT INTO usuarios (username, nombre, password, rol, modulos)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO UPDATE 
        SET password = EXCLUDED.password, rol = EXCLUDED.rol, modulos = EXCLUDED.modulos
      `, [u.username, u.nombre, u.password, u.rol, u.modulos]);
    }
    console.log('[DB] Usuarios del sistema verificados y asegurados.');
  } catch (err) {
    console.error('[DB] Error asegurando usuarios por defecto:', err.message);
  }
};

// Seed helper for PostgreSQL
const seedPostgresData = async (data, skipTruncate = false) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    if (!skipTruncate) {
      console.log('Truncating tables prior to seeding PostgreSQL...');
      await client.query('TRUNCATE chat_mensajes, ordenes_desarme, ordenes_trabajo, inventario_accesorios, base_fijo, base_modulo, base_arco, estructuras_maestras, clientes, usuarios, log_transacciones, personal, recursos, vendedores RESTART IDENTITY CASCADE');
    }

    console.log('Seeding estructuras_maestras...');
    for (const est of data.estructuras_maestras) {
      await client.query(
        `INSERT INTO estructuras_maestras (id, modelo_estructura, arcos_totales, estructura_tipo, frente, largo_maximo, arcos_disponibles)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [est.id, est.modelo_estructura, est.arcos_totales, est.estructura_tipo, est.frente, est.largo_maximo, est.arcos_disponibles]
      );
    }

    console.log('Seeding clientes...');
    for (const cl of data.clientes) {
      await client.query(
        `INSERT INTO clientes (id, cuenta, nombre, actividad, estado, observacion, domicilio, localidad, provincia, pais, telefono, email, cuit, vendedores, responsables, latitud, longitud)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [cl.id, cl.cuenta, cl.nombre, cl.actividad, cl.estado, cl.observacion, cl.domicilio, cl.localidad, cl.provincia, cl.pais, cl.telefono, cl.email, cl.cuit, cl.vendedores, cl.responsables, cl.latitud, cl.longitud]
      );
    }

    console.log('Seeding base_arco...');
    for (const arc of data.base_arco) {
      await client.query(
        `INSERT INTO base_arco (id, producto, arco, modelo_estructura, sector, qty_fija_arco)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [arc.id, arc.producto, arc.arco, arc.modelo_estructura, arc.sector, arc.qty_fija_arco]
      );
    }

    console.log('Seeding base_modulo...');
    for (const mod of data.base_modulo) {
      await client.query(
        `INSERT INTO base_modulo (id, producto, modelo_estructura, sector, modulacion, stock_inicial, modulo_val)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [mod.id, mod.producto, mod.modelo_estructura, mod.sector, mod.modulacion, mod.stock_inicial, mod.modulo_val || null]
      );
    }

    console.log('Seeding base_fijo...');
    for (const fj of data.base_fijo) {
      await client.query(
        `INSERT INTO base_fijo (id, producto, modelo_estructura, sector, qty_fija_carpa)
         VALUES ($1, $2, $3, $4, $5)`,
        [fj.id, fj.producto, fj.modelo_estructura, fj.sector, fj.qty_fija_carpa]
      );
    }

    console.log('Seeding inventario_accesorios...');
    for (const acc of data.inventario_accesorios) {
      await client.query(
        `INSERT INTO inventario_accesorios (id, categoria, nombre, color, tipo, medida, estado, stock_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [acc.id, acc.categoria, acc.nombre, acc.color, acc.tipo, acc.medida, acc.estado, acc.stock_total]
      );
    }

    console.log('Seeding default users...');
    if (data.usuarios && data.usuarios.length > 0) {
      for (const user of data.usuarios) {
        await client.query(
          `INSERT INTO usuarios (id, username, nombre, password, rol, modulos)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.id, user.username, user.nombre, user.password, user.rol, user.modulos || '[]']
        );
      }
    }

    if (data.personal && data.personal.length > 0) {
      console.log('Seeding personal...');
      for (const p of data.personal) {
        await client.query(
          `INSERT INTO personal (id, nombre, cuit, telefono, rol_funcion, tipo, subtipo_chofer, roles_secundarios, activo, usuario_id, examen_medico_vencimiento, licencia_conducir_vencimiento)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE
           SET nombre = EXCLUDED.nombre, cuit = EXCLUDED.cuit, telefono = EXCLUDED.telefono, rol_funcion = EXCLUDED.rol_funcion,
               tipo = EXCLUDED.tipo, subtipo_chofer = EXCLUDED.subtipo_chofer, roles_secundarios = EXCLUDED.roles_secundarios,
               activo = EXCLUDED.activo, usuario_id = EXCLUDED.usuario_id, examen_medico_vencimiento = EXCLUDED.examen_medico_vencimiento,
               licencia_conducir_vencimiento = EXCLUDED.licencia_conducir_vencimiento`,
          [
            p.id,
            p.nombre,
            p.cuit || null,
            p.telefono || null,
            p.rol_funcion || 'Operario',
            p.tipo || 'Fijo',
            p.subtipo_chofer || null,
            p.roles_secundarios || null,
            p.activo !== false,
            p.usuario_id || null,
            normalizeDate(p.examen_medico_vencimiento),
            normalizeDate(p.licencia_conducir_vencimiento)
          ]
        );
      }
    }

    if (data.recursos && data.recursos.length > 0) {
      console.log('Seeding recursos...');
      for (const r of data.recursos) {
        await client.query(
          `INSERT INTO recursos (id, nombre, tipo, subtipo, patente_identificador, vtv_vencimiento, seguro_vencimiento, descripcion, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE
           SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, subtipo = EXCLUDED.subtipo,
               patente_identificador = EXCLUDED.patente_identificador, vtv_vencimiento = EXCLUDED.vtv_vencimiento,
               seguro_vencimiento = EXCLUDED.seguro_vencimiento, descripcion = EXCLUDED.descripcion, activo = EXCLUDED.activo`,
          [
            r.id,
            r.nombre,
            r.tipo || 'Vehículo / Camión',
            r.subtipo || null,
            r.patente_identificador || r.patente || null,
            normalizeDate(r.vtv_vencimiento || r.vtv),
            normalizeDate(r.seguro_vencimiento || r.seguro),
            r.descripcion || null,
            r.activo !== false
          ]
        );
      }
    }

    if (data.vendedores && data.vendedores.length > 0) {
      console.log('Seeding vendedores...');
      for (const v of data.vendedores) {
        await client.query(
          `INSERT INTO vendedores (id, nombre, activo)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, activo = EXCLUDED.activo`,
          [v.id, v.nombre, v.activo !== false]
        );
      }
    }

    await client.query('COMMIT');
    console.log("PostgreSQL database seeding complete.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("PostgreSQL database seeding failed, rolling back:", err);
    throw err;
  } finally {
    client.release();
  }
};
 
// Helper: sleep for ms milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Initialize connection — with exponential backoff retries
const initDb = async () => {
  const connStr = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  const MAX_RETRIES = 5;

  if (connStr) {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[DB] Intento ${attempt}/${MAX_RETRIES} de conexión a PostgreSQL...`);
        pool = new pg.Pool({
          connectionString: connStr,
          ssl: connStr.includes('render.com') || connStr.includes('supabase')
            ? { rejectUnauthorized: false }
            : false,
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 30000,
        });
        // Test connection
        await pool.query('SELECT NOW()');
        usePostgreSQL = true;
        console.log('[DB] Conexión a PostgreSQL establecida correctamente.');
        lastError = null;
        break; // success — exit retry loop
      } catch (err) {
        lastError = err;
        console.warn(`[DB] Intento ${attempt} fallido: ${err.message}`);
        if (pool) {
          try { await pool.end(); } catch (_) {}
          pool = null;
        }
        if (attempt < MAX_RETRIES) {
          const waitMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s...
          console.log(`[DB] Reintentando en ${waitMs / 1000}s...`);
          await sleep(waitMs);
        }
      }
    }

    if (!usePostgreSQL) {
      // All retries exhausted
      if (isProduction) {
        // In production, never fall back to ephemeral JSON — data would be lost on every restart
        console.error('[DB] FATAL: No se pudo conectar a PostgreSQL en producción después de', MAX_RETRIES, 'intentos.');
        console.error('[DB] Error:', lastError?.message);
        console.error('[DB] El servidor NO puede iniciar sin base de datos persistente en producción.');
        dbInitError = lastError?.message || 'No se pudo conectar a PostgreSQL';
        // Do NOT exit — let the server start so /health can report the error.
        // API middleware in server.js will return 503 until DB is available.
        return;
      } else {
        console.warn('[DB] Fallback a base de datos JSON local (solo para desarrollo).');
        loadJsonDb();
        return;
      }
    }

    // --- PostgreSQL connected: initialize schema and migrations ---
    try {
      // Check if schema is initialized by verifying if "usuarios" table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'usuarios'
        )
      `);
      const schemaExists = tableCheck.rows[0].exists;

      if (!schemaExists) {
        console.log('[DB] Base de datos vacía. Inicializando schema desde schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf8');
          await pool.query(schemaSql);
          console.log('[DB] Schema inicializado correctamente.');
        } else {
          console.warn('[DB] schema.sql no encontrado en', schemaPath);
        }
      }

      // Guarantee default users exist regardless of seed status
      await ensureDefaultUsers(pool);

      // Safe seeding: only seed if ALL key tables are completely empty
      // This prevents accidental overwrite of real production data
      const counts = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM usuarios) AS usuarios,
          (SELECT COUNT(*) FROM clientes) AS clientes,
          (SELECT COUNT(*) FROM ordenes_trabajo) AS ordenes_trabajo
      `);
      const row = counts.rows[0];
      const totalRows = parseInt(row.usuarios) + parseInt(row.clientes) + parseInt(row.ordenes_trabajo);

      if (totalRows === 0) {
        console.log('[DB] Base de datos completamente vacía. Realizando seed inicial desde db.json...');
        const seedData = loadJsonDb();
        await seedPostgresData(seedData, true);
        console.log('[DB] Seed inicial completado.');
      } else {
        console.log(`[DB] Base de datos con datos existentes (${row.usuarios} usuarios, ${row.clientes} clientes, ${row.ordenes_trabajo} OTs). Omitiendo seed.`);
      }

      // Re-verify default users after full seed
      await ensureDefaultUsers(pool);

      // Ensure Master Data (estructuras_maestras, base_arco, base_modulo, base_fijo) is always complete
      const masterCheck = await pool.query('SELECT COUNT(*) FROM base_arco');
      const baseArcoCount = parseInt(masterCheck.rows[0].count || 0);
      if (baseArcoCount < 6000) {
        console.log(`[DB] base_arco incompleta en PostgreSQL (${baseArcoCount} registros). Sincronizando 66 estructuras y 6105 arcos desde db.json...`);
        const fullData = loadJsonDb();
        if (fullData.base_arco && fullData.base_arco.length > 0) {
          await pool.query('TRUNCATE base_fijo, base_modulo, base_arco, estructuras_maestras RESTART IDENTITY CASCADE');
          
          for (const est of fullData.estructuras_maestras || []) {
            await pool.query(
              `INSERT INTO estructuras_maestras (id, modelo_estructura, arcos_totales, estructura_tipo, frente, largo_maximo, arcos_disponibles)
               VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE
               SET modelo_estructura = EXCLUDED.modelo_estructura, arcos_totales = EXCLUDED.arcos_totales,
                   estructura_tipo = EXCLUDED.estructura_tipo, frente = EXCLUDED.frente, largo_maximo = EXCLUDED.largo_maximo,
                   arcos_disponibles = EXCLUDED.arcos_disponibles`,
              [est.id, est.modelo_estructura, est.arcos_totales, est.estructura_tipo, est.frente, est.largo_maximo, est.arcos_disponibles]
            );
          }

          for (const arc of fullData.base_arco || []) {
            await pool.query(
              `INSERT INTO base_arco (id, producto, arco, modelo_estructura, sector, qty_fija_arco)
               VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE
               SET producto = EXCLUDED.producto, arco = EXCLUDED.arco, modelo_estructura = EXCLUDED.modelo_estructura,
                   sector = EXCLUDED.sector, qty_fija_arco = EXCLUDED.qty_fija_arco`,
              [arc.id, arc.producto, arc.arco, arc.modelo_estructura, arc.sector, arc.qty_fija_arco]
            );
          }

          for (const mod of fullData.base_modulo || []) {
            await pool.query(
              `INSERT INTO base_modulo (id, producto, modelo_estructura, sector, modulacion, stock_inicial, modulo_val)
               VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE
               SET producto = EXCLUDED.producto, modelo_estructura = EXCLUDED.modelo_estructura, sector = EXCLUDED.sector,
                   modulacion = EXCLUDED.modulacion, stock_inicial = EXCLUDED.stock_inicial, modulo_val = EXCLUDED.modulo_val`,
              [mod.id, mod.producto, mod.modelo_estructura, mod.sector, mod.modulacion, mod.stock_inicial, mod.modulo_val || null]
            );
          }

          for (const fj of fullData.base_fijo || []) {
            await pool.query(
              `INSERT INTO base_fijo (id, producto, modelo_estructura, sector, qty_fija_carpa)
               VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE
               SET producto = EXCLUDED.producto, modelo_estructura = EXCLUDED.modelo_estructura, sector = EXCLUDED.sector,
                   qty_fija_carpa = EXCLUDED.qty_fija_carpa`,
              [fj.id, fj.producto, fj.modelo_estructura, fj.sector, fj.qty_fija_carpa]
            );
          }
          console.log('[DB] Sincronización de tablas maestras completada exitosamente.');
        }
      }

      // Repair existing OTs that have mismatched component prefixes (e.g. C10-H2 on C10-L1 OTs)
      const existingOTsRes = await pool.query('SELECT id, ot_numero, modelo_estructura, adicionales, planta_status, panol_status FROM ordenes_trabajo');
      for (const ot of existingOTsRes.rows) {
        if (!ot.modelo_estructura) continue;
        let modified = false;
        let planta = typeof ot.planta_status === 'string' ? safeJsonParse(ot.planta_status, { items: [] }) : ot.planta_status || { items: [] };
        let panol = typeof ot.panol_status === 'string' ? safeJsonParse(ot.panol_status, { items: [] }) : ot.panol_status || { items: [] };

        const targetModel = ot.modelo_estructura; // e.g. C10-L1
        const targetPrefix = targetModel.split('-')[0]; // e.g. C10

        const repairItems = (items) => {
          if (!Array.isArray(items)) return items;
          return items.map(item => {
            if (!item.producto) return item;
            let p = item.producto;
            // Detect if item starts with a wrong submodel (e.g. C10-H2 when OT is C10-L1)
            const match = p.match(/^([A-Z0-9]+-[A-Z0-9]+)/);
            if (match) {
              const itemModel = match[1];
              if (itemModel.startsWith(targetPrefix) && itemModel !== targetModel) {
                p = p.replaceAll(itemModel, targetModel);
                modified = true;
              }
            }
            return { ...item, producto: p };
          });
        };

        if (planta.items) planta.items = repairItems(planta.items);
        if (panol.items) panol.items = repairItems(panol.items);

        if (modified) {
          console.log(`[DB] Reparando checklist de OT #${ot.ot_numero || ot.id} para modelo ${targetModel}...`);
          await pool.query(
            'UPDATE ordenes_trabajo SET planta_status = $1, panol_status = $2 WHERE id = $3',
            [JSON.stringify(planta), JSON.stringify(panol), ot.id]
          );
        }
      }

      console.log('[DB] Migraciones completadas.');
    } catch (err) {
      console.error('[DB] Error durante inicialización del schema/migraciones:', err.message);
      dbInitError = err.message;
      if (isProduction) {
        // Don't exit — let health endpoint surface the error
      }
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      const msg = '[DB] FATAL: DATABASE_URL no está configurada en producción.';
      console.error(msg);
      dbInitError = 'DATABASE_URL no está configurada';
      return;
    }
    console.log('[DB] DATABASE_URL no configurada. Modo JSON local (solo desarrollo).');
    loadJsonDb();
  }
};

// Expose database init error (for /health endpoint in server.js)
export const getDbInitError = () => dbInitError;

// Run initialization immediately
initDb();

// Expose Repository API
export const db = {
  isPostgreSQL: () => usePostgreSQL,

  // Reset database (used by Admin Dashboard)
  resetDatabase: async (data) => {
    if (usePostgreSQL) {
      await seedPostgresData(data, false);
    } else {
      jsonDb = {
        clientes: data.clientes || [],
        estructuras_maestras: data.estructuras_maestras || [],
        base_arco: data.base_arco || [],
        base_modulo: data.base_modulo || [],
        base_fijo: data.base_fijo || [],
        inventario_accesorios: data.inventario_accesorios || [],
        usuarios: data.usuarios || [],
        ordenes_trabajo: [],
        chat_mensajes: [],
        log_transacciones: [],
        ordenes_desarme: [],
        personal: [],
        recursos: [],
        vendedores: []
      };
      saveJsonDb();
      console.log("Local JSON database reset complete.");
    }
  },

  // Clients
  getClients: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM clientes ORDER BY nombre');
      return res.rows;
    } else {
      return loadJsonDb().clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
  },

  saveClient: async (client) => {
    const cuenta = client.cuenta && client.cuenta.trim() !== '' ? client.cuenta.trim() : `CLI-${Date.now().toString().slice(-6)}`;
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO clientes (cuenta, nombre, actividad, estado, observacion, domicilio, localidad, provincia, pais, telefono, email, cuit, vendedores, responsables, latitud, longitud)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [cuenta, client.nombre, client.actividad || 'General', client.estado || 'Activo', client.observacion || null, client.domicilio || null, client.localidad || null, client.provincia || null, client.pais || 'ARGENTINA', client.telefono || null, client.email || null, client.cuit || null, client.vendedores || null, client.responsables || null, client.latitud || null, client.longitud || null]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const nextId = db.clientes.length > 0 ? Math.max(...db.clientes.map(c => c.id)) + 1 : 1;
      const newClient = { id: nextId, ...client, cuenta };
      db.clientes.push(newClient);
      saveJsonDb();
      return newClient;
    }
  },

  updateClient: async (id, client) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE clientes
         SET cuenta = $1, nombre = $2, actividad = $3, estado = $4, observacion = $5, domicilio = $6, localidad = $7, provincia = $8, pais = $9, telefono = $10, email = $11, cuit = $12, vendedores = $13, responsables = $14, latitud = $15, longitud = $16
         WHERE id = $17
         RETURNING *`,
        [client.cuenta, client.nombre, client.actividad, client.estado, client.observacion, client.domicilio, client.localidad, client.provincia, client.pais, client.telefono, client.email, client.cuit, client.vendedores, client.responsables, client.latitud, client.longitud, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const idx = db.clientes.findIndex(c => c.id === id);
      if (idx !== -1) {
        db.clientes[idx] = { ...db.clientes[idx], ...client };
        saveJsonDb();
        return db.clientes[idx];
      }
      return null;
    }
  },

  deleteClient: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      const idx = db.clientes.findIndex(c => c.id === id);
      if (idx !== -1) {
        db.clientes.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  clearClients: async () => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM clientes');
      return true;
    } else {
      const db = loadJsonDb();
      db.clientes = [];
      saveJsonDb();
      return true;
    }
  },

  saveStructure: async (est) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO estructuras_maestras (modelo_estructura, arcos_totales, estructura_tipo, frente, largo_maximo, arcos_disponibles)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [est.modelo_estructura, est.arcos_totales, est.estructura_tipo, est.frente, est.largo_maximo, est.arcos_disponibles]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const nextId = db.estructuras_maestras.length > 0 ? Math.max(...db.estructuras_maestras.map(e => e.id)) + 1 : 1;
      const newEst = { id: nextId, ...est };
      db.estructuras_maestras.push(newEst);
      saveJsonDb();
      return newEst;
    }
  },

  updateStructure: async (id, est) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE estructuras_maestras
         SET modelo_estructura = $1, arcos_totales = $2, estructura_tipo = $3, frente = $4, largo_maximo = $5, arcos_disponibles = $6
         WHERE id = $7
         RETURNING *`,
        [est.modelo_estructura, est.arcos_totales, est.estructura_tipo, est.frente, est.largo_maximo, est.arcos_disponibles, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const idx = db.estructuras_maestras.findIndex(e => e.id === id);
      if (idx !== -1) {
        db.estructuras_maestras[idx] = { ...db.estructuras_maestras[idx], ...est };
        saveJsonDb();
        return db.estructuras_maestras[idx];
      }
      return null;
    }
  },

  deleteStructure: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM estructuras_maestras WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      const idx = db.estructuras_maestras.findIndex(e => e.id === id);
      if (idx !== -1) {
        db.estructuras_maestras.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  clearStructures: async () => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM estructuras_maestras');
      return true;
    } else {
      const db = loadJsonDb();
      db.estructuras_maestras = [];
      saveJsonDb();
      return true;
    }
  },

  saveArch: async (arc) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO base_arco (producto, arco, modelo_estructura, sector, qty_fija_arco)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [arc.producto, arc.arco, arc.modelo_estructura, arc.sector, arc.qty_fija_arco]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const nextId = db.base_arco.length > 0 ? Math.max(...db.base_arco.map(a => a.id)) + 1 : 1;
      const newArc = { id: nextId, ...arc };
      db.base_arco.push(newArc);
      saveJsonDb();
      return newArc;
    }
  },

  updateArch: async (id, arc) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE base_arco
         SET producto = $1, arco = $2, modelo_estructura = $3, sector = $4, qty_fija_arco = $5
         WHERE id = $6
         RETURNING *`,
        [arc.producto, arc.arco, arc.modelo_estructura, arc.sector, arc.qty_fija_arco, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const idx = db.base_arco.findIndex(a => a.id === id);
      if (idx !== -1) {
        db.base_arco[idx] = { ...db.base_arco[idx], ...arc };
        saveJsonDb();
        return db.base_arco[idx];
      }
      return null;
    }
  },

  deleteArch: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM base_arco WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      const idx = db.base_arco.findIndex(a => a.id === id);
      if (idx !== -1) {
        db.base_arco.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  clearArches: async () => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM base_arco');
      return true;
    } else {
      const db = loadJsonDb();
      db.base_arco = [];
      saveJsonDb();
      return true;
    }
  },

  saveModule: async (mod) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO base_modulo (producto, modelo_estructura, sector, modulacion, stock_inicial, modulo_val)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [mod.producto, mod.modelo_estructura, mod.sector, mod.modulacion, mod.stock_inicial, mod.modulo_val]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const nextId = db.base_modulo.length > 0 ? Math.max(...db.base_modulo.map(m => m.id)) + 1 : 1;
      const newMod = { id: nextId, ...mod };
      db.base_modulo.push(newMod);
      saveJsonDb();
      return newMod;
    }
  },

  updateModule: async (id, mod) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE base_modulo
         SET producto = $1, modelo_estructura = $2, sector = $3, modulacion = $4, stock_inicial = $5, modulo_val = $6
         WHERE id = $7
         RETURNING *`,
        [mod.producto, mod.modelo_estructura, mod.sector, mod.modulacion, mod.stock_inicial, mod.modulo_val, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const idx = db.base_modulo.findIndex(m => m.id === id);
      if (idx !== -1) {
        db.base_modulo[idx] = { ...db.base_modulo[idx], ...mod };
        saveJsonDb();
        return db.base_modulo[idx];
      }
      return null;
    }
  },

  deleteModule: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM base_modulo WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      const idx = db.base_modulo.findIndex(m => m.id === id);
      if (idx !== -1) {
        db.base_modulo.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  clearModules: async () => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM base_modulo');
      return true;
    } else {
      const db = loadJsonDb();
      db.base_modulo = [];
      saveJsonDb();
      return true;
    }
  },

  saveFijo: async (fj) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO base_fijo (producto, modelo_estructura, sector, qty_fija_carpa)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [fj.producto, fj.modelo_estructura, fj.sector, fj.qty_fija_carpa]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const nextId = db.base_fijo.length > 0 ? Math.max(...db.base_fijo.map(f => f.id)) + 1 : 1;
      const newFj = { id: nextId, ...fj };
      db.base_fijo.push(newFj);
      saveJsonDb();
      return newFj;
    }
  },

  updateFijo: async (id, fj) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE base_fijo
         SET producto = $1, modelo_estructura = $2, sector = $3, qty_fija_carpa = $4
         WHERE id = $5
         RETURNING *`,
        [fj.producto, fj.modelo_estructura, fj.sector, fj.qty_fija_carpa, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const idx = db.base_fijo.findIndex(f => f.id === id);
      if (idx !== -1) {
        db.base_fijo[idx] = { ...db.base_fijo[idx], ...fj };
        saveJsonDb();
        return db.base_fijo[idx];
      }
      return null;
    }
  },

  deleteFijo: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM base_fijo WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      const idx = db.base_fijo.findIndex(f => f.id === id);
      if (idx !== -1) {
        db.base_fijo.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  clearFijos: async () => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM base_fijo');
      return true;
    } else {
      const db = loadJsonDb();
      db.base_fijo = [];
      saveJsonDb();
      return true;
    }
  },

  saveAccessory: async (acc) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO inventario_accesorios (categoria, nombre, color, tipo, medida, estado, stock_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [acc.categoria, acc.nombre, acc.color, acc.tipo, acc.medida, acc.estado, acc.stock_total]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const nextId = db.inventario_accesorios.length > 0 ? Math.max(...db.inventario_accesorios.map(a => a.id)) + 1 : 1;
      const newAcc = { id: nextId, ...acc };
      db.inventario_accesorios.push(newAcc);
      saveJsonDb();
      return newAcc;
    }
  },

  updateAccessory: async (id, acc) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE inventario_accesorios
         SET categoria = $1, nombre = $2, color = $3, tipo = $4, medida = $5, estado = $6, stock_total = $7
         WHERE id = $8
         RETURNING *`,
        [acc.categoria, acc.nombre, acc.color, acc.tipo, acc.medida, acc.estado, acc.stock_total, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const idx = db.inventario_accesorios.findIndex(a => a.id === id);
      if (idx !== -1) {
        db.inventario_accesorios[idx] = { ...db.inventario_accesorios[idx], ...acc };
        saveJsonDb();
        return db.inventario_accesorios[idx];
      }
      return null;
    }
  },

  deleteAccessory: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM inventario_accesorios WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      const idx = db.inventario_accesorios.findIndex(a => a.id === id);
      if (idx !== -1) {
        db.inventario_accesorios.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  clearAccessoriesByCategory: async (categoria) => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM inventario_accesorios WHERE categoria = $1', [categoria]);
      return true;
    } else {
      const db = loadJsonDb();
      db.inventario_accesorios = db.inventario_accesorios.filter(a => a.categoria !== categoria);
      saveJsonDb();
      return true;
    }
  },

  getVendedores: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM vendedores ORDER BY nombre ASC');
      return res.rows;
    } else {
      const db = loadJsonDb();
      if (!db.vendedores) db.vendedores = [];
      return db.vendedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
  },

  saveVendedor: async (vend) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO vendedores (nombre, activo)
         VALUES ($1, $2)
         RETURNING *`,
        [vend.nombre, vend.activo !== false]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.vendedores) db.vendedores = [];
      const nextId = db.vendedores.length > 0 ? Math.max(...db.vendedores.map(v => v.id)) + 1 : 1;
      const newVend = {
        id: nextId,
        nombre: vend.nombre,
        activo: vend.activo !== false,
        fecha_creacion: new Date().toISOString()
      };
      db.vendedores.push(newVend);
      saveJsonDb();
      return newVend;
    }
  },

  updateVendedor: async (id, vend) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE vendedores
         SET nombre = $1, activo = $2
         WHERE id = $3
         RETURNING *`,
        [vend.nombre, vend.activo !== false, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.vendedores) db.vendedores = [];
      const idx = db.vendedores.findIndex(v => v.id === id);
      if (idx !== -1) {
        db.vendedores[idx] = {
          ...db.vendedores[idx],
          nombre: vend.nombre,
          activo: vend.activo !== false
        };
        saveJsonDb();
        return db.vendedores[idx];
      }
      return null;
    }
  },

  deleteVendedor: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM vendedores WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      if (!db.vendedores) db.vendedores = [];
      const idx = db.vendedores.findIndex(v => v.id === id);
      if (idx !== -1) {
        db.vendedores.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  clearVendedores: async () => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM vendedores');
      return true;
    } else {
      const db = loadJsonDb();
      db.vendedores = [];
      saveJsonDb();
      return true;
    }
  },

  // Structures
  getStructures: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM estructuras_maestras');
      return res.rows;
    } else {
      return loadJsonDb().estructuras_maestras;
    }
  },

  getArches: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM base_arco');
      return res.rows;
    } else {
      return loadJsonDb().base_arco;
    }
  },

  getModules: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM base_modulo');
      return res.rows;
    } else {
      return loadJsonDb().base_modulo;
    }
  },

  getFijos: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM base_fijo');
      return res.rows;
    } else {
      return loadJsonDb().base_fijo;
    }
  },

  // Accessories Stock
  getAccessories: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM inventario_accesorios');
      return res.rows;
    } else {
      return loadJsonDb().inventario_accesorios;
    }
  },

  updateAccessoryStock: async (id, delta) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        'UPDATE inventario_accesorios SET stock_total = stock_total + $1 WHERE id = $2 RETURNING *',
        [delta, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const item = db.inventario_accesorios.find(a => a.id === id);
      if (item) {
        item.stock_total += delta;
        saveJsonDb();
        return item;
      }
      return null;
    }
  },

  // Work Orders (OTs)
  getOTs: async () => {
    if (usePostgreSQL) {
      const res = await pool.query(`
        SELECT ot.*, cl.nombre as cliente_nombre 
        FROM ordenes_trabajo ot
        JOIN clientes cl ON ot.cliente_id = cl.id
        ORDER BY ot.fecha_creacion DESC
      `);
      return res.rows;
    } else {
      const db = loadJsonDb();
      return db.ordenes_trabajo.map(ot => {
        const client = db.clientes.find(c => c.id === ot.cliente_id);
        return {
          ...ot,
          cliente_nombre: client ? client.nombre : 'Cliente Desconocido'
        };
      }).sort((a, b) => b.id - a.id);
    }
  },

  saveOT: async (ot) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO ordenes_trabajo (
          ot_numero, cliente_id, fecha_inicio, fecha_fin, modelo_estructura, 
          estructura_tipo, frente, largo, superficie, modulacion_config, 
          adicionales, georef, estado, panol_status, planta_status, creado_por,
          fecha_evento, observaciones, fecha_comienzo_desarmado
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *`,
        [
          ot.ot_numero, ot.cliente_id, ot.fecha_inicio, ot.fecha_fin, ot.modelo_estructura,
          ot.estructura_tipo, ot.frente, ot.largo, ot.superficie, JSON.stringify(ot.modulacion_config),
          JSON.stringify(ot.adicionales), JSON.stringify(ot.georef), ot.estado || 'Pendiente',
          JSON.stringify(ot.panol_status), JSON.stringify(ot.planta_status), ot.creado_por,
          ot.fecha_evento || null, ot.observaciones || null, ot.fecha_comienzo_desarmado || null
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const nextId = db.ordenes_trabajo.length > 0 ? Math.max(...db.ordenes_trabajo.map(o => o.id)) + 1 : 1;
      const newOT = {
        id: nextId,
        ...ot,
        fecha_creacion: new Date().toISOString()
      };
      db.ordenes_trabajo.push(newOT);
      saveJsonDb();
      return newOT;
    }
  },

  updateOTStatus: async (id, status, usuario, rol) => {
    if (usePostgreSQL) {
      const getRes = await pool.query('SELECT adicionales FROM ordenes_trabajo WHERE id = $1', [id]);
      let currentAdicionales = {};
      if (getRes.rows[0]) {
        currentAdicionales = typeof getRes.rows[0].adicionales === 'string'
          ? safeJsonParse(getRes.rows[0].adicionales)
          : getRes.rows[0].adicionales || {};
      }
      if (status === 'Aprobada por Gerencia') {
        currentAdicionales.aprobado_por = usuario || 'Sistema';
      }
      if (status === 'Completada') {
        currentAdicionales.completado_por = usuario || 'Sistema';
      }
      const res = await pool.query(
        'UPDATE ordenes_trabajo SET estado = $1, adicionales = $2 WHERE id = $3 RETURNING *',
        [status, JSON.stringify(currentAdicionales), id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const ot = db.ordenes_trabajo.find(o => o.id === id);
      if (ot) {
        let currentAdicionales = typeof ot.adicionales === 'string'
          ? safeJsonParse(ot.adicionales)
          : ot.adicionales || {};
        if (status === 'Aprobada por Gerencia') {
          currentAdicionales.aprobado_por = usuario || 'Sistema';
        }
        if (status === 'Completada') {
          currentAdicionales.completado_por = usuario || 'Sistema';
        }
        ot.estado = status;
        ot.adicionales = currentAdicionales;
        saveJsonDb();
        return ot;
      }
      return null;
    }
  },

  updateOTChecklists: async (id, panol_status, planta_status, usuario, rol) => {
    if (usePostgreSQL) {
      const getRes = await pool.query('SELECT adicionales FROM ordenes_trabajo WHERE id = $1', [id]);
      let currentAdicionales = {};
      if (getRes.rows[0]) {
        currentAdicionales = typeof getRes.rows[0].adicionales === 'string'
          ? safeJsonParse(getRes.rows[0].adicionales)
          : getRes.rows[0].adicionales || {};
      }
      if (rol) {
        currentAdicionales[`cargado_${rol.toLowerCase()}_por`] = usuario || 'Sistema';
      }
      const res = await pool.query(
        'UPDATE ordenes_trabajo SET panol_status = $1, planta_status = $2, adicionales = $3 WHERE id = $4 RETURNING *',
        [JSON.stringify(panol_status), JSON.stringify(planta_status), JSON.stringify(currentAdicionales), id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const ot = db.ordenes_trabajo.find(o => o.id === id);
      if (ot) {
        let currentAdicionales = typeof ot.adicionales === 'string'
          ? safeJsonParse(ot.adicionales)
          : ot.adicionales || {};
        if (rol) {
          currentAdicionales[`cargado_${rol.toLowerCase()}_por`] = usuario || 'Sistema';
        }
        ot.panol_status = panol_status;
        ot.planta_status = planta_status;
        ot.adicionales = currentAdicionales;
        saveJsonDb();
        return ot;
      }
      return null;
    }
  },

  updateOTAdicionales: async (id, adicionales, usuario, rol) => {
    if (usePostgreSQL) {
      const getRes = await pool.query('SELECT ot_numero, adicionales FROM ordenes_trabajo WHERE id = $1', [id]);
      let currentAdicionales = {};
      let ot_numero = '';
      if (getRes.rows[0]) {
        ot_numero = getRes.rows[0].ot_numero;
        currentAdicionales = typeof getRes.rows[0].adicionales === 'string'
          ? safeJsonParse(getRes.rows[0].adicionales)
          : getRes.rows[0].adicionales || {};
      }
      
      // Prevent modification if already confirmed
      if (currentAdicionales.chofer_llegada) {
        adicionales.chofer_llegada = true;
        adicionales.chofer_llegada_fecha = currentAdicionales.chofer_llegada_fecha;
        adicionales.chofer_llegada_coords = currentAdicionales.chofer_llegada_coords;
      }
      
      const updatedAdicionales = { ...currentAdicionales, ...adicionales };
      if (rol) {
        updatedAdicionales[`modificado_${rol.toLowerCase()}_por`] = usuario || 'Sistema';
      }
      
      // If confirming arrival now
      if (!currentAdicionales.chofer_llegada && adicionales.chofer_llegada) {
        const coords = adicionales.chofer_llegada_coords || 'No disponible';
        await pool.query(
          'INSERT INTO log_transacciones (ot_id, ot_numero, usuario, rol, accion, detalles) VALUES ($1, $2, $3, $4, $5, $6)',
          [id, ot_numero, usuario || 'Chofer', rol || 'Chofer', 'ENTREGA_CHOFER', `Llegada confirmada en destino. Coordenadas de entrega: ${coords}`]
        );
      }

      const res = await pool.query(
        'UPDATE ordenes_trabajo SET adicionales = $1 WHERE id = $2 RETURNING *',
        [JSON.stringify(updatedAdicionales), id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const ot = db.ordenes_trabajo.find(o => o.id === id);
      if (ot) {
        let currentAdicionales = typeof ot.adicionales === 'string'
          ? safeJsonParse(ot.adicionales)
          : ot.adicionales || {};
        
        // Prevent modification if already confirmed
        if (currentAdicionales.chofer_llegada) {
          adicionales.chofer_llegada = true;
          adicionales.chofer_llegada_fecha = currentAdicionales.chofer_llegada_fecha;
          adicionales.chofer_llegada_coords = currentAdicionales.chofer_llegada_coords;
        }

        const updatedAdicionales = { ...currentAdicionales, ...adicionales };
        if (rol) {
          updatedAdicionales[`modificado_${rol.toLowerCase()}_por`] = usuario || 'Sistema';
        }

        // If confirming arrival now
        if (!currentAdicionales.chofer_llegada && adicionales.chofer_llegada) {
          const coords = adicionales.chofer_llegada_coords || 'No disponible';
          if (!db.log_transacciones) db.log_transacciones = [];
          const newLog = {
            id: db.log_transacciones.length + 1,
            ot_id: id,
            ot_numero: ot.ot_numero,
            usuario: usuario || 'Chofer',
            rol: rol || 'Chofer',
            accion: 'ENTREGA_CHOFER',
            detalles: `Llegada confirmada en destino. Coordenadas de entrega: ${coords}`,
            fecha: new Date().toISOString()
          };
          db.log_transacciones.push(newLog);
        }

        ot.adicionales = updatedAdicionales;
        saveJsonDb();
        return ot;
      }
      return null;
    }
  },

  updateOTConformation: async (id, modulacion_config, arcos_reservados, panol_status, planta_status, fijo_modelo_estructura, modulo_modelo_estructura, conformed_modulos_list, usuario, rol) => {
    if (usePostgreSQL) {
      const getRes = await pool.query('SELECT adicionales FROM ordenes_trabajo WHERE id = $1', [id]);
      let currentAdicionales = {};
      if (getRes.rows[0]) {
        currentAdicionales = typeof getRes.rows[0].adicionales === 'string'
          ? safeJsonParse(getRes.rows[0].adicionales)
          : getRes.rows[0].adicionales || {};
      }
      currentAdicionales.arcos_reservados = arcos_reservados;
      if (fijo_modelo_estructura) {
        currentAdicionales.fijo_modelo_estructura = fijo_modelo_estructura;
      }
      if (modulo_modelo_estructura) {
        currentAdicionales.modulo_modelo_estructura = modulo_modelo_estructura;
      }
      if (conformed_modulos_list) {
        currentAdicionales.conformed_modulos_list = conformed_modulos_list;
      }
      currentAdicionales.modulado_por = usuario || 'Sistema';


      let derivedModelo = null;
      if (arcos_reservados && arcos_reservados.length > 0) {
        const uniqueModels = new Set();
        arcos_reservados.forEach(arco => {
          const parts = arco.split('_');
          if (parts.length >= 2) {
            uniqueModels.add(parts[0]);
          }
        });
        if (uniqueModels.size > 0) {
          derivedModelo = Array.from(uniqueModels).join(' + ');
        }
      }
      
      const queryStr = derivedModelo 
        ? `UPDATE ordenes_trabajo 
           SET modulacion_config = $1, adicionales = $2, panol_status = $3, planta_status = $4, estado = 'Aprobada', modelo_estructura = $6
           WHERE id = $5 
           RETURNING *`
        : `UPDATE ordenes_trabajo 
           SET modulacion_config = $1, adicionales = $2, panol_status = $3, planta_status = $4, estado = 'Aprobada'
           WHERE id = $5 
           RETURNING *`;
           
      const queryParams = derivedModelo
        ? [JSON.stringify(modulacion_config), JSON.stringify(currentAdicionales), JSON.stringify(panol_status), JSON.stringify(planta_status), id, derivedModelo]
        : [JSON.stringify(modulacion_config), JSON.stringify(currentAdicionales), JSON.stringify(panol_status), JSON.stringify(planta_status), id];

      const res = await pool.query(queryStr, queryParams);

      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const ot = db.ordenes_trabajo.find(o => o.id === id);
      if (ot) {
        let currentAdicionales = typeof ot.adicionales === 'string'
          ? safeJsonParse(ot.adicionales)
          : ot.adicionales || {};
        currentAdicionales.arcos_reservados = arcos_reservados;
        if (fijo_modelo_estructura) {
          currentAdicionales.fijo_modelo_estructura = fijo_modelo_estructura;
        }
        if (modulo_modelo_estructura) {
          currentAdicionales.modulo_modelo_estructura = modulo_modelo_estructura;
        }
        if (conformed_modulos_list) {
          currentAdicionales.conformed_modulos_list = conformed_modulos_list;
        }
        
        currentAdicionales.modulado_por = usuario || 'Sistema';
        
        ot.modulacion_config = modulacion_config;
        ot.adicionales = currentAdicionales;
        ot.panol_status = panol_status;
        ot.planta_status = planta_status;
        if (arcos_reservados && arcos_reservados.length > 0) {
          const uniqueModels = new Set();
          arcos_reservados.forEach(arco => {
            const parts = arco.split('_');
            if (parts.length >= 2) uniqueModels.add(parts[0]);
          });
          if (uniqueModels.size > 0) ot.modelo_estructura = Array.from(uniqueModels).join(' + ');
        }
        ot.estado = 'Aprobada';
        saveJsonDb();
        return ot;
      }
      return null;
    }
  },

  // Chat messages
  getChatMessages: async (otId) => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM chat_mensajes WHERE ot_id = $1 ORDER BY fecha_envio ASC', [otId]);
      return res.rows;
    } else {
      const db = loadJsonDb();
      return db.chat_mensajes
        .filter(m => m.ot_id === otId)
        .sort((a, b) => new Date(a.fecha_envio) - new Date(b.fecha_envio));
    }
  },

  getAllChatMessages: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM chat_mensajes ORDER BY fecha_envio DESC');
      return res.rows;
    } else {
      const db = loadJsonDb();
      return (db.chat_mensajes || []).sort((a, b) => new Date(b.fecha_envio) - new Date(a.fecha_envio));
    }
  },

  saveChatMessage: async (msg) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        'INSERT INTO chat_mensajes (ot_id, usuario, rol, mensaje) VALUES ($1, $2, $3, $4) RETURNING *',
        [msg.ot_id, msg.usuario, msg.rol, msg.mensaje]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.chat_mensajes) db.chat_mensajes = [];
      const nextId = db.chat_mensajes.length > 0 ? Math.max(...db.chat_mensajes.map(m => m.id)) + 1 : 1;
      const newMsg = {
        id: nextId,
        ot_id: parseInt(msg.ot_id),
        usuario: msg.usuario,
        rol: msg.rol,
        mensaje: msg.mensaje,
        fecha_envio: new Date().toISOString()
      };
      db.chat_mensajes.push(newMsg);
      saveJsonDb();
      return newMsg;
    }
  },

  // Users Management Methods
  getUsers: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT id, username, nombre, password, rol, modulos, fecha_creacion FROM usuarios ORDER BY id');
      return res.rows;
    } else {
      const db = loadJsonDb();
      return db.usuarios || [];
    }
  },

  getUserByUsername: async (username) => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT id, username, nombre, password, rol, modulos, fecha_creacion FROM usuarios WHERE username = $1', [username]);
      return res.rows[0] || null;
    } else {
      const db = loadJsonDb();
      return (db.usuarios || []).find(u => u.username === username) || null;
    }
  },

  saveUser: async (user) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO usuarios (username, nombre, password, rol, modulos)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, nombre, password, rol, modulos, fecha_creacion`,
        [user.username, user.nombre, user.password, user.rol, user.modulos || '[]']
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.usuarios) db.usuarios = [];
      const nextId = db.usuarios.length > 0 ? Math.max(...db.usuarios.map(u => u.id)) + 1 : 1;
      const newUser = { id: nextId, username: user.username, nombre: user.nombre, password: user.password, rol: user.rol, modulos: user.modulos || '[]', fecha_creacion: new Date().toISOString() };
      db.usuarios.push(newUser);
      saveJsonDb();
      return newUser;
    }
  },

  updateUser: async (id, user) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE usuarios 
         SET username = $1, nombre = $2, password = $3, rol = $4, modulos = $5
         WHERE id = $6
         RETURNING id, username, nombre, password, rol, modulos, fecha_creacion`,
        [user.username, user.nombre, user.password, user.rol, user.modulos || '[]', id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.usuarios) db.usuarios = [];
      const index = db.usuarios.findIndex(u => u.id === id);
      if (index !== -1) {
        db.usuarios[index] = { ...db.usuarios[index], ...user };
        saveJsonDb();
        return db.usuarios[index];
      }
      return null;
    }
  },

  deleteUser: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id, username, nombre, password, rol, modulos, fecha_creacion', [id]);
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.usuarios) db.usuarios = [];
      const index = db.usuarios.findIndex(u => u.id === id);
      if (index !== -1) {
        const deleted = db.usuarios.splice(index, 1)[0];
        saveJsonDb();
        return deleted;
      }
      return null;
    }
  },

  saveTransactionLog: async (log) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        'INSERT INTO log_transacciones (ot_id, ot_numero, usuario, rol, accion, detalles) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [log.ot_id, log.ot_numero, log.usuario, log.rol, log.accion, log.detalles]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.log_transacciones) db.log_transacciones = [];
      const newLog = {
        id: db.log_transacciones.length + 1,
        ot_id: log.ot_id,
        ot_numero: log.ot_numero,
        usuario: log.usuario,
        rol: log.rol,
        accion: log.accion,
        detalles: log.detalles,
        fecha: new Date().toISOString()
      };
      db.log_transacciones.push(newLog);
      saveJsonDb();
      return newLog;
    }
  },

  getTransactionLogs: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM log_transacciones ORDER BY fecha DESC');
      return res.rows;
    } else {
      const db = loadJsonDb();
      return (db.log_transacciones || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
  },

  clearOTs: async () => {
    if (usePostgreSQL) {
      await pool.query('TRUNCATE TABLE chat_mensajes, ordenes_desarme, ordenes_trabajo, log_transacciones RESTART IDENTITY CASCADE');
      return true;
    } else {
      const db = loadJsonDb();
      db.ordenes_trabajo = [];
      db.chat_mensajes = [];
      db.log_transacciones = [];
      db.ordenes_desarme = [];
      saveJsonDb();
      return true;
    }
  },

  deleteOT: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM ordenes_trabajo WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      if (!db.ordenes_trabajo) db.ordenes_trabajo = [];
      const idx = db.ordenes_trabajo.findIndex(o => o.id === id);
      if (idx !== -1) {
        db.ordenes_trabajo.splice(idx, 1);
        if (db.chat_mensajes) {
          db.chat_mensajes = db.chat_mensajes.filter(m => m.ot_id !== id);
        }
        if (db.ordenes_desarme) {
          db.ordenes_desarme = db.ordenes_desarme.filter(d => d.ot_origen_id !== id && d.ot_id !== id);
        }
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  updateOTLogistica: async (id, data, usuario, rol) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE ordenes_trabajo 
         SET fecha_fin = $1, fecha_traslado = $2, fecha_comienzo_armado = $3, 
             fecha_comienzo_desarmado = $4, fecha_retorno = $5,
             fecha_inicio = $6, fecha_evento = $7
         WHERE id = $8 RETURNING *`,
        [
          data.fecha_fin,
          data.fecha_traslado || null,
          data.fecha_comienzo_armado || null,
          data.fecha_comienzo_desarmado || null,
          data.fecha_retorno || null,
          data.fecha_inicio,
          data.fecha_evento || null,
          id
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const ot = db.ordenes_trabajo.find(o => o.id === id);
      if (ot) {
        ot.fecha_fin = data.fecha_fin;
        ot.fecha_traslado = data.fecha_traslado || null;
        ot.fecha_comienzo_armado = data.fecha_comienzo_armado || null;
        ot.fecha_comienzo_desarmado = data.fecha_comienzo_desarmado || null;
        ot.fecha_retorno = data.fecha_retorno || null;
        ot.fecha_inicio = data.fecha_inicio;
        ot.fecha_evento = data.fecha_evento || null;
        saveJsonDb();
        return ot;
      }
      return null;
    }
  },

  saveDesarme: async (desarme) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO ordenes_desarme (ot_origen_id, retorno_completo, destinos, remitos, creado_por)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          desarme.ot_origen_id,
          desarme.retorno_completo,
          JSON.stringify(desarme.destinos),
          JSON.stringify(desarme.remitos),
          desarme.creado_por
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.ordenes_desarme) db.ordenes_desarme = [];
      const nextId = db.ordenes_desarme.length > 0 ? Math.max(...db.ordenes_desarme.map(d => d.id)) + 1 : 1;
      const newDesarme = {
        id: nextId,
        ...desarme,
        fecha_creacion: new Date().toISOString()
      };
      db.ordenes_desarme.push(newDesarme);
      saveJsonDb();
      return newDesarme;
    }
  },

  getDesarmeByOT: async (otId) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `SELECT * FROM ordenes_desarme WHERE ot_origen_id = $1 ORDER BY id DESC LIMIT 1`,
        [otId]
      );
      return res.rows[0] || null;
    } else {
      const db = loadJsonDb();
      if (!db.ordenes_desarme) db.ordenes_desarme = [];
      const match = db.ordenes_desarme.find(d => d.ot_origen_id === otId);
      return match || null;
    }
  },

  getAllDesarmes: async () => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `SELECT * FROM ordenes_desarme ORDER BY id DESC`
      );
      return res.rows;
    } else {
      const db = loadJsonDb();
      return db.ordenes_desarme || [];
    }
  },


  // ─── VENTAS HISTÓRICAS (Dashboard de Gerencia BI) ───────────────────────────

  getVentasHistoricas: async (filters = {}) => {
    if (usePostgreSQL) {
      let query = 'SELECT * FROM ventas_historicas WHERE 1=1';
      const params = [];
      let idx = 1;
      if (filters.fecha_desde) { query += ` AND fecha_armado >= $${idx++}`; params.push(filters.fecha_desde); }
      if (filters.fecha_hasta) { query += ` AND fecha_armado <= $${idx++}`; params.push(filters.fecha_hasta); }
      if (filters.vendedor)    { query += ` AND LOWER(vendedor) LIKE LOWER($${idx++})`; params.push(`%${filters.vendedor}%`); }
      if (filters.cliente)     { query += ` AND LOWER(cliente_nombre) LIKE LOWER($${idx++})`; params.push(`%${filters.cliente}%`); }
      if (filters.ot_id)       { query += ` AND ot_id = $${idx++}`; params.push(filters.ot_id); }
      query += ' ORDER BY fecha_armado DESC';
      const res = await pool.query(query, params);
      return res.rows;
    } else {
      const db = loadJsonDb();
      let rows = db.ventas_historicas || [];
      if (filters.fecha_desde) rows = rows.filter(r => r.fecha_armado >= filters.fecha_desde);
      if (filters.fecha_hasta) rows = rows.filter(r => r.fecha_armado <= filters.fecha_hasta);
      if (filters.vendedor)    rows = rows.filter(r => r.vendedor && r.vendedor.toLowerCase().includes(filters.vendedor.toLowerCase()));
      if (filters.cliente)     rows = rows.filter(r => r.cliente_nombre && r.cliente_nombre.toLowerCase().includes(filters.cliente.toLowerCase()));
      if (filters.ot_id)       rows = rows.filter(r => r.ot_id === filters.ot_id);
      return rows.sort((a, b) => (b.fecha_armado || '').localeCompare(a.fecha_armado || ''));
    }
  },

  insertVentaHistorica: async (venta) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO ventas_historicas
          (fecha_alta, fecha_armado, fecha_desarme, cliente_nombre, cliente_cuenta, vendedor,
           carpa_raw, superficie_m2, localidad, provincia, latitud, longitud,
           piso, tarima, alfombra, cortina, tribuna, sillas, adicionales_raw,
           condicion_fiscal, condicion_pago, origen, ot_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         RETURNING *`,
        [
          venta.fecha_alta || null, venta.fecha_armado, venta.fecha_desarme,
          venta.cliente_nombre, venta.cliente_cuenta || null, venta.vendedor || null,
          venta.carpa_raw || null, venta.superficie_m2 || null,
          venta.localidad || null, venta.provincia || null,
          venta.latitud || null, venta.longitud || null,
          venta.piso || false, venta.tarima || false, venta.alfombra || false,
          venta.cortina || false, venta.tribuna || false, venta.sillas || false,
          venta.adicionales_raw || null, venta.condicion_fiscal || null,
          venta.condicion_pago || null, venta.origen || 'historico', venta.ot_id || null
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.ventas_historicas) db.ventas_historicas = [];
      const nextId = db.ventas_historicas.length > 0 ? Math.max(...db.ventas_historicas.map(v => v.id)) + 1 : 1;
      const newVenta = { id: nextId, ...venta, fecha_creacion: new Date().toISOString() };
      db.ventas_historicas.push(newVenta);
      saveJsonDb();
      return newVenta;
    }
  },

  bulkInsertVentasHistoricas: async (ventas) => {
    if (usePostgreSQL) {
      const client = await pool.connect();
      const results = [];
      try {
        await client.query('BEGIN');
        for (const venta of ventas) {
          const res = await client.query(
            `INSERT INTO ventas_historicas
              (fecha_alta, fecha_armado, fecha_desarme, cliente_nombre, cliente_cuenta, vendedor,
               carpa_raw, superficie_m2, localidad, provincia, latitud, longitud,
               piso, tarima, alfombra, cortina, tribuna, sillas, adicionales_raw,
               condicion_fiscal, condicion_pago, origen, ot_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
             RETURNING *`,
            [
              venta.fecha_alta || null, venta.fecha_armado, venta.fecha_desarme,
              venta.cliente_nombre, venta.cliente_cuenta || null, venta.vendedor || null,
              venta.carpa_raw || null, venta.superficie_m2 || null,
              venta.localidad || null, venta.provincia || null,
              venta.latitud || null, venta.longitud || null,
              venta.piso || false, venta.tarima || false, venta.alfombra || false,
              venta.cortina || false, venta.tribuna || false, venta.sillas || false,
              venta.adicionales_raw || null, venta.condicion_fiscal || null,
              venta.condicion_pago || null, venta.origen || 'historico', venta.ot_id || null
            ]
          );
          results.push(res.rows[0]);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return results;
    } else {
      const db = loadJsonDb();
      if (!db.ventas_historicas) db.ventas_historicas = [];
      const results = [];
      for (const venta of ventas) {
        const nextId = db.ventas_historicas.length > 0 ? Math.max(...db.ventas_historicas.map(v => v.id)) + 1 : 1;
        const newVenta = { id: nextId, ...venta, fecha_creacion: new Date().toISOString() };
        db.ventas_historicas.push(newVenta);
        results.push(newVenta);
      }
      saveJsonDb();
      return results;
    }
  },

  clearVentasHistoricas: async () => {
    if (usePostgreSQL) {
      const client = await pool.connect();
      try {
        const res = await client.query('DELETE FROM ventas_historicas');
        return res.rowCount;
      } finally {
        client.release();
      }
    } else {
      const db = loadJsonDb();
      const count = (db.ventas_historicas || []).length;
      db.ventas_historicas = [];
      saveJsonDb();
      return count;
    }
  },

  getAllPersonal: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM personal ORDER BY nombre ASC');
      return res.rows;
    } else {
      const db = loadJsonDb();
      if (!db.personal) db.personal = [];
      return db.personal.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
  },

  savePersonal: async (persona) => {
    const nombre = (persona.nombre || '').trim();
    const cuit = (persona.cuit || '').trim() || null;
    const telefono = (persona.telefono || '').trim() || null;
    const rol_funcion = persona.rol_funcion || 'Operario';
    const tipo = persona.tipo || 'Fijo';
    const subtipo_chofer = (persona.subtipo_chofer || '').trim() || null;
    const roles_secundarios = persona.roles_secundarios || null;
    const activo = persona.activo !== false;
    const usuario_id = persona.usuario_id || null;
    const examen_medico_vencimiento = normalizeDate(persona.examen_medico_vencimiento || persona.examen_medico || persona.Examen_Medico_Vencimiento);
    const licencia_conducir_vencimiento = normalizeDate(persona.licencia_conducir_vencimiento || persona.licencia_conducir || persona.Licencia_Conducir_Vencimiento);

    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO personal (nombre, cuit, telefono, rol_funcion, tipo, subtipo_chofer, roles_secundarios, activo, usuario_id, examen_medico_vencimiento, licencia_conducir_vencimiento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          nombre,
          cuit,
          telefono,
          rol_funcion,
          tipo,
          subtipo_chofer,
          roles_secundarios,
          activo,
          usuario_id,
          examen_medico_vencimiento,
          licencia_conducir_vencimiento
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.personal) db.personal = [];
      const nextId = db.personal.length > 0 ? Math.max(...db.personal.map(p => p.id)) + 1 : 1;
      const newPersona = {
        id: nextId,
        nombre,
        cuit,
        telefono,
        rol_funcion,
        tipo,
        subtipo_chofer,
        roles_secundarios,
        activo,
        usuario_id,
        examen_medico_vencimiento,
        licencia_conducir_vencimiento,
        fecha_creacion: new Date().toISOString()
      };
      db.personal.push(newPersona);
      saveJsonDb();
      return newPersona;
    }
  },

  updatePersonal: async (id, persona) => {
    const nombre = (persona.nombre || '').trim();
    const cuit = persona.cuit !== undefined ? ((persona.cuit || '').trim() || null) : undefined;
    const telefono = persona.telefono !== undefined ? ((persona.telefono || '').trim() || null) : undefined;
    const rol_funcion = persona.rol_funcion;
    const tipo = persona.tipo || 'Fijo';
    const subtipo_chofer = persona.subtipo_chofer !== undefined ? ((persona.subtipo_chofer || '').trim() || null) : null;
    const roles_secundarios = persona.roles_secundarios || null;
    const activo = persona.activo !== false;
    const usuario_id = persona.usuario_id || null;
    const examen_medico_vencimiento = normalizeDate(persona.examen_medico_vencimiento !== undefined ? persona.examen_medico_vencimiento : (persona.examen_medico || persona.Examen_Medico_Vencimiento));
    const licencia_conducir_vencimiento = normalizeDate(persona.licencia_conducir_vencimiento !== undefined ? persona.licencia_conducir_vencimiento : (persona.licencia_conducir || persona.Licencia_Conducir_Vencimiento));

    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE personal
         SET nombre = $1, cuit = $2, telefono = $3, rol_funcion = $4, tipo = $5, subtipo_chofer = $6, roles_secundarios = $7, activo = $8, usuario_id = $9,
             examen_medico_vencimiento = $10, licencia_conducir_vencimiento = $11
         WHERE id = $12
         RETURNING *`,
        [
          nombre,
          cuit !== undefined ? cuit : null,
          telefono !== undefined ? telefono : null,
          rol_funcion,
          tipo,
          subtipo_chofer,
          roles_secundarios,
          activo,
          usuario_id,
          examen_medico_vencimiento,
          licencia_conducir_vencimiento,
          id
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.personal) db.personal = [];
      const idx = db.personal.findIndex(p => p.id === id);
      if (idx !== -1) {
        db.personal[idx] = {
          ...db.personal[idx],
          nombre,
          cuit: cuit !== undefined ? cuit : db.personal[idx].cuit,
          telefono: telefono !== undefined ? telefono : db.personal[idx].telefono,
          rol_funcion: rol_funcion || db.personal[idx].rol_funcion,
          tipo: tipo || db.personal[idx].tipo || 'Fijo',
          subtipo_chofer: subtipo_chofer !== null ? subtipo_chofer : db.personal[idx].subtipo_chofer,
          roles_secundarios: roles_secundarios !== undefined ? roles_secundarios : db.personal[idx].roles_secundarios,
          activo,
          usuario_id,
          examen_medico_vencimiento,
          licencia_conducir_vencimiento
        };
        saveJsonDb();
        return db.personal[idx];
      }
      return null;
    }
  },

  deletePersonal: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM personal WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      if (!db.personal) db.personal = [];
      const idx = db.personal.findIndex(p => p.id === id);
      if (idx !== -1) {
        db.personal.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  getAllRecursos: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM recursos ORDER BY nombre ASC');
      return res.rows;
    } else {
      const db = loadJsonDb();
      if (!db.recursos) db.recursos = [];
      return db.recursos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
  },

  saveRecurso: async (recurso) => {
    const nombre = (recurso.nombre || '').trim();
    const tipo = recurso.tipo || 'Vehículo / Camión';
    const subtipo = (recurso.subtipo || '').trim() || null;
    const patente_identificador = (recurso.patente_identificador || recurso.patente || recurso.identificador || '').trim() || null;
    const vtv_vencimiento = normalizeDate(recurso.vtv_vencimiento || recurso.vtv || recurso.VTV_Vencimiento || recurso.VTV);
    const seguro_vencimiento = normalizeDate(recurso.seguro_vencimiento || recurso.seguro || recurso.Seguro_Vencimiento || recurso.Seguro);
    const descripcion = (recurso.descripcion || '').trim() || null;
    const activo = recurso.activo !== false;

    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO recursos (nombre, tipo, subtipo, patente_identificador, vtv_vencimiento, seguro_vencimiento, descripcion, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          nombre,
          tipo,
          subtipo,
          patente_identificador,
          vtv_vencimiento,
          seguro_vencimiento,
          descripcion,
          activo
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.recursos) db.recursos = [];
      const nextId = db.recursos.length > 0 ? Math.max(...db.recursos.map(r => r.id)) + 1 : 1;
      const newRecurso = {
        id: nextId,
        nombre,
        tipo,
        subtipo,
        patente_identificador,
        vtv_vencimiento,
        seguro_vencimiento,
        descripcion,
        activo,
        fecha_creacion: new Date().toISOString()
      };
      db.recursos.push(newRecurso);
      saveJsonDb();
      return newRecurso;
    }
  },

  updateRecurso: async (id, recurso) => {
    const nombre = (recurso.nombre || '').trim();
    const tipo = recurso.tipo || 'Vehículo / Camión';
    const subtipo = recurso.subtipo !== undefined ? ((recurso.subtipo || '').trim() || null) : null;
    const patente_identificador = recurso.patente_identificador !== undefined 
      ? ((recurso.patente_identificador || '').trim() || null) 
      : ((recurso.patente || '').trim() || null);
    const vtv_vencimiento = normalizeDate(recurso.vtv_vencimiento !== undefined ? recurso.vtv_vencimiento : (recurso.vtv || recurso.VTV_Vencimiento || recurso.VTV));
    const seguro_vencimiento = normalizeDate(recurso.seguro_vencimiento !== undefined ? recurso.seguro_vencimiento : (recurso.seguro || recurso.Seguro_Vencimiento || recurso.Seguro));
    const descripcion = recurso.descripcion !== undefined ? ((recurso.descripcion || '').trim() || null) : null;
    const activo = recurso.activo !== false;

    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE recursos
         SET nombre = $1, tipo = $2, subtipo = $3, patente_identificador = $4, vtv_vencimiento = $5, seguro_vencimiento = $6, descripcion = $7, activo = $8
         WHERE id = $9
         RETURNING *`,
        [
          nombre,
          tipo,
          subtipo,
          patente_identificador,
          vtv_vencimiento,
          seguro_vencimiento,
          descripcion,
          activo,
          id
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.recursos) db.recursos = [];
      const idx = db.recursos.findIndex(r => r.id === id);
      if (idx !== -1) {
        db.recursos[idx] = {
          ...db.recursos[idx],
          nombre,
          tipo,
          subtipo: subtipo !== null ? subtipo : db.recursos[idx].subtipo,
          patente_identificador,
          vtv_vencimiento,
          seguro_vencimiento,
          descripcion,
          activo
        };
        saveJsonDb();
        return db.recursos[idx];
      }
      return null;
    }
  },

  deleteRecurso: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM recursos WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      if (!db.recursos) db.recursos = [];
      const idx = db.recursos.findIndex(r => r.id === id);
      if (idx !== -1) {
        db.recursos.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  clearPersonal: async () => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM personal');
      return true;
    } else {
      const db = loadJsonDb();
      db.personal = [];
      saveJsonDb();
      return true;
    }
  },

  clearRecursos: async () => {
    if (usePostgreSQL) {
      await pool.query('DELETE FROM recursos');
      return true;
    } else {
      const db = loadJsonDb();
      db.recursos = [];
      saveJsonDb();
      return true;
    }
  },

  // ── MÓDULO APRENDIZAJE IA (RAG & AUTO-SKILLS) ──
  saveDocumento: async ({ titulo, contenido, tipo }) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO base_conocimiento (titulo, contenido, tipo)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [titulo, contenido, tipo || 'general']
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.base_conocimiento) db.base_conocimiento = [];
      const newDoc = {
        id: db.base_conocimiento.length + 1,
        titulo,
        contenido,
        tipo: tipo || 'general',
        fecha_carga: new Date().toISOString()
      };
      db.base_conocimiento.push(newDoc);
      saveJsonDb();
      return newDoc;
    }
  },

  getDocumentos: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM base_conocimiento ORDER BY id DESC');
      return res.rows;
    } else {
      const db = loadJsonDb();
      return db.base_conocimiento || [];
    }
  },

  deleteDocumento: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM base_conocimiento WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      if (!db.base_conocimiento) db.base_conocimiento = [];
      const idx = db.base_conocimiento.findIndex(d => d.id === Number(id));
      if (idx !== -1) {
        db.base_conocimiento.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  saveSkill: async ({ nombre, descripcion, trigger_keywords, instrucciones }) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO skills_agente (nombre, descripcion, trigger_keywords, instrucciones)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (nombre) DO UPDATE SET
           descripcion = EXCLUDED.descripcion,
           trigger_keywords = EXCLUDED.trigger_keywords,
           instrucciones = EXCLUDED.instrucciones,
           fecha_creacion = CURRENT_TIMESTAMP
         RETURNING *`,
        [nombre, descripcion || null, trigger_keywords, instrucciones]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.skills_agente) db.skills_agente = [];
      const idx = db.skills_agente.findIndex(s => s.nombre.toLowerCase() === nombre.toLowerCase());
      const skill = {
        id: idx !== -1 ? db.skills_agente[idx].id : db.skills_agente.length + 1,
        nombre,
        descripcion: descripcion || null,
        trigger_keywords,
        instrucciones,
        fecha_creacion: new Date().toISOString()
      };
      if (idx !== -1) {
        db.skills_agente[idx] = skill;
      } else {
        db.skills_agente.push(skill);
      }
      saveJsonDb();
      return skill;
    }
  },

  getSkills: async () => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM skills_agente ORDER BY id DESC');
      return res.rows;
    } else {
      const db = loadJsonDb();
      return db.skills_agente || [];
    }
  },

  deleteSkill: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM skills_agente WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      if (!db.skills_agente) db.skills_agente = [];
      const idx = db.skills_agente.findIndex(s => s.id === Number(id));
      if (idx !== -1) {
        db.skills_agente.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  buscarConocimientoLocal: async (consulta) => {
    try {
      let docs = [];
      if (usePostgreSQL) {
        const res = await pool.query('SELECT titulo, contenido, tipo FROM base_conocimiento');
        docs = res.rows;
      } else {
        const db = loadJsonDb();
        docs = db.base_conocimiento || [];
      }

      if (!docs.length) return '';

      // Simple keyword matching helper (minimum word length 3)
      const queryWords = consulta.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (!queryWords.length) return '';

      // Match documents containing query words
      const matches = docs.filter(doc => {
        const text = `${doc.titulo} ${doc.contenido}`.toLowerCase();
        return queryWords.some(word => text.includes(word));
      });

      if (!matches.length) return '';

      let contextText = '\n--- NORMAS, MANUALES Y DIRECTIVAS DE REFERENCIA (RAG) ---\n';
      matches.slice(0, 3).forEach(doc => {
        const tipoLabel = doc.tipo ? ` [Tipo: ${doc.tipo.toUpperCase()}]` : '';
        contextText += `📄 DOCUMENTO: ${doc.titulo}${tipoLabel}\nCONTENIDO:\n${doc.contenido}\n---\n`;
      });
      return contextText;
    } catch (e) {
      console.error("Error en buscarConocimientoLocal:", e);
      return '';
    }
  },

  buscarSkillCoincidente: async (consulta) => {
    try {
      let skills = [];
      if (usePostgreSQL) {
        const res = await pool.query('SELECT nombre, trigger_keywords, instrucciones FROM skills_agente');
        skills = res.rows;
      } else {
        const db = loadJsonDb();
        skills = db.skills_agente || [];
      }

      const consultaLower = consulta.toLowerCase();
      for (const skill of skills) {
        if (!skill.trigger_keywords) continue;
        const keywords = skill.trigger_keywords.split(',').map(kw => kw.trim().toLowerCase()).filter(Boolean);
        if (keywords.some(kw => consultaLower.includes(kw))) {
          return `\n⚠️ [REGLA DE COMPORTAMIENTO ACTIVA: ${skill.nombre.toUpperCase()}]\nInstrucciones especiales a seguir:\n${skill.instrucciones}\n`;
        }
      }
      return '';
    } catch (e) {
      console.error("Error en buscarSkillCoincidente:", e);
      return '';
    }
  },

  // ==========================================
  // 13. PLANIFICACIÓN OPERATIVA DIARIA & AUTO-INHERITANCE
  // ==========================================
  getPlanificacionDia: async (fechaRaw) => {
    const normalizeIsoDate = (dStr) => {
      if (!dStr) return new Date().toISOString().split('T')[0];
      if (dStr instanceof Date) {
        return isNaN(dStr.getTime()) ? new Date().toISOString().split('T')[0] : dStr.toISOString().split('T')[0];
      }
      const s = String(dStr).trim();
      if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
          return `${year}-${month}-${day}`;
        }
      }
      if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
        return s.substring(0, 10);
      }
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return s.substring(0, 10);
    };

    const fecha = normalizeIsoDate(fechaRaw);
    let dayRecord = null;
    let allOts = [];

    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM planificacion_diaria WHERE fecha = $1', [fecha]);
      if (res.rows.length > 0) dayRecord = res.rows[0];
      const otsRes = await pool.query('SELECT id, ot_numero, fecha_inicio, fecha_fin FROM ordenes_trabajo');
      allOts = otsRes.rows.filter(o => o.fecha_inicio && o.fecha_fin && normalizeIsoDate(o.fecha_inicio) <= fecha && normalizeIsoDate(o.fecha_fin) >= fecha);
    } else {
      const db = loadJsonDb();
      if (!db.planificacion_diaria) db.planificacion_diaria = [];
      dayRecord = db.planificacion_diaria.find(p => p.fecha === fecha);
      const otsList = db.ordenes_trabajo || [];
      allOts = otsList.filter(o => o.fecha_inicio && o.fecha_fin && normalizeIsoDate(o.fecha_inicio) <= fecha && normalizeIsoDate(o.fecha_fin) >= fecha);
    }

    const currentAsignaciones = dayRecord?.asignaciones
      ? (typeof dayRecord.asignaciones === 'string' ? JSON.parse(dayRecord.asignaciones) : dayRecord.asignaciones)
      : { ots: {}, sectores: {}, novedades: {} };

    if (!currentAsignaciones.ots) currentAsignaciones.ots = {};
    if (!currentAsignaciones.sectores) currentAsignaciones.sectores = {};
    if (!currentAsignaciones.novedades) currentAsignaciones.novedades = {};

    // Auto-inheritance from previous days for active OTs if not yet customized today
    for (const ot of allOts) {
      const key = `ot_${ot.id}`;
      const existingOtAsig = currentAsignaciones.ots[key];
      const hasContent = existingOtAsig && ((existingOtAsig.personal && existingOtAsig.personal.length > 0) || (existingOtAsig.vehiculos && existingOtAsig.vehiculos.length > 0));

      if (!hasContent) {
        let priorAsig = null;
        const normInicio = normalizeIsoDate(ot.fecha_inicio);
        if (usePostgreSQL) {
          const priorRes = await pool.query(
            `SELECT asignaciones FROM planificacion_diaria 
             WHERE fecha < $1 AND fecha >= $2 
             ORDER BY fecha DESC LIMIT 15`,
            [fecha, normInicio]
          );
          for (const row of priorRes.rows) {
            const pAsig = typeof row.asignaciones === 'string' ? JSON.parse(row.asignaciones) : row.asignaciones;
            if (pAsig?.ots?.[key] && (pAsig.ots[key].personal?.length > 0 || pAsig.ots[key].vehiculos?.length > 0)) {
              priorAsig = pAsig.ots[key];
              break;
            }
          }
        } else {
          const db = loadJsonDb();
          const priorRecords = (db.planificacion_diaria || [])
            .filter(p => p.fecha < fecha && p.fecha >= normInicio)
            .sort((a, b) => b.fecha.localeCompare(a.fecha));

          for (const rec of priorRecords) {
            const pAsig = rec.asignaciones;
            if (pAsig?.ots?.[key] && (pAsig.ots[key].personal?.length > 0 || pAsig.ots[key].vehiculos?.length > 0)) {
              priorAsig = pAsig.ots[key];
              break;
            }
          }
        }

        if (priorAsig) {
          currentAsignaciones.ots[key] = { ...priorAsig };
        }
      }
    }

    return {
      fecha,
      asignaciones: currentAsignaciones,
      publicado: true,
      publicado_por: dayRecord?.publicado_por || null,
      fecha_modificacion: dayRecord?.fecha_modificacion || null
    };
  },

  savePlanificacionDia: async (fechaRaw, asignaciones, publicado = true, publicado_por = null) => {
    const normalizeIsoDate = (dStr) => {
      if (!dStr) return new Date().toISOString().split('T')[0];
      if (dStr instanceof Date) {
        return isNaN(dStr.getTime()) ? new Date().toISOString().split('T')[0] : dStr.toISOString().split('T')[0];
      }
      const s = String(dStr).trim();
      if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 4 ? parts[2] : `20${parts[2]}`;
          return `${year}-${month}-${day}`;
        }
      }
      if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
        return s.substring(0, 10);
      }
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return s.substring(0, 10);
    };

    const fecha = normalizeIsoDate(fechaRaw);
    const parsedAsignaciones = typeof asignaciones === 'string' ? JSON.parse(asignaciones) : (asignaciones || { ots: {}, sectores: {}, novedades: {} });

    // 1. Save record for today (Instant atomic write)
    let savedRecord = null;
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO planificacion_diaria (fecha, asignaciones, publicado, publicado_por, fecha_publicacion, fecha_modificacion)
         VALUES ($1, $2, TRUE, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (fecha) DO UPDATE
         SET asignaciones = $2,
             publicado = TRUE,
             publicado_por = COALESCE($3, planificacion_diaria.publicado_por),
             fecha_modificacion = CURRENT_TIMESTAMP
         RETURNING *`,
        [fecha, JSON.stringify(parsedAsignaciones), publicado_por]
      );
      savedRecord = res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.planificacion_diaria) db.planificacion_diaria = [];
      const idx = db.planificacion_diaria.findIndex(p => p.fecha === fecha);
      const record = {
        fecha,
        asignaciones: parsedAsignaciones,
        publicado: true,
        publicado_por: publicado_por || (idx !== -1 ? db.planificacion_diaria[idx].publicado_por : null),
        fecha_publicacion: idx !== -1 && db.planificacion_diaria[idx].fecha_publicacion ? db.planificacion_diaria[idx].fecha_publicacion : new Date().toISOString(),
        fecha_modificacion: new Date().toISOString()
      };
      if (idx !== -1) {
        db.planificacion_diaria[idx] = { ...db.planificacion_diaria[idx], ...record };
      } else {
        db.planificacion_diaria.push(record);
      }
      savedRecord = record;

      // 2. Cascade forward in memory for active OTs (up to 7 days) and save JSON once
      try {
        const otsList = (db.ordenes_trabajo || []).filter(o => o.fecha_fin && normalizeIsoDate(o.fecha_fin) >= fecha);
        for (const ot of otsList) {
          const key = `ot_${ot.id}`;
          const otAsig = parsedAsignaciones?.ots?.[key];
          if (otAsig && ot.fecha_fin) {
            const endDateStr = normalizeIsoDate(ot.fecha_fin);
            let cur = new Date(fecha + 'T00:00:00');
            cur.setDate(cur.getDate() + 1);
            const end = new Date(endDateStr + 'T00:00:00');

            let steps = 0;
            while (cur <= end && steps < 7) {
              const nextDateStr = cur.toISOString().split('T')[0];
              const fIdx = db.planificacion_diaria.findIndex(p => p.fecha === nextDateStr);
              if (fIdx !== -1) {
                const curAsig = db.planificacion_diaria[fIdx].asignaciones || { ots: {}, sectores: {}, novedades: {} };
                if (!curAsig.ots) curAsig.ots = {};
                curAsig.ots[key] = { ...otAsig };
                db.planificacion_diaria[fIdx].asignaciones = curAsig;
                db.planificacion_diaria[fIdx].fecha_modificacion = new Date().toISOString();
              }
              cur.setDate(cur.getDate() + 1);
              steps++;
            }
          }
        }
      } catch (cascadeErr) {
        console.error("[DB] Error leve en cascada:", cascadeErr);
      }

      saveJsonDb();
    }

    return savedRecord;
  },

  getPlanificacionPlanta: async (fecha) => {
    if (usePostgreSQL) {
      const res = await pool.query('SELECT * FROM planificacion_planta WHERE fecha = $1', [fecha]);
      if (res.rows.length > 0) return res.rows[0];
      return { fecha, tareas: [] };
    } else {
      const db = loadJsonDb();
      if (!db.planificacion_planta) db.planificacion_planta = [];
      const item = db.planificacion_planta.find(p => p.fecha === fecha);
      if (item) return item;
      return { fecha, tareas: [] };
    }
  },

  savePlanificacionPlanta: async (fecha, tareas) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO planificacion_planta (fecha, tareas, fecha_modificacion)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (fecha) DO UPDATE
         SET tareas = $2, fecha_modificacion = CURRENT_TIMESTAMP
         RETURNING *`,
        [fecha, typeof tareas === 'string' ? tareas : JSON.stringify(tareas)]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.planificacion_planta) db.planificacion_planta = [];
      const idx = db.planificacion_planta.findIndex(p => p.fecha === fecha);
      const parsedTareas = typeof tareas === 'string' ? JSON.parse(tareas) : tareas;
      const record = {
        fecha,
        tareas: parsedTareas,
        fecha_modificacion: new Date().toISOString()
      };
      if (idx !== -1) {
        db.planificacion_planta[idx] = record;
      } else {
        db.planificacion_planta.push(record);
      }
      saveJsonDb();
      return record;
    }
  },

  // ==========================================
  // RECORDATORIOS OPERATIVOS (VTV, SALUD, GENERAL)
  // ==========================================
  getRecordatorios: async (desde = null, hasta = null) => {

    let manualRecords = [];
    let recursosList = [];
    let personalList = [];

    if (usePostgreSQL) {
      const recRes = await pool.query('SELECT * FROM recordatorios_operativos ORDER BY fecha ASC');
      manualRecords = recRes.rows;
      const rRes = await pool.query('SELECT * FROM recursos WHERE activo = TRUE');
      recursosList = rRes.rows;
      const pRes = await pool.query('SELECT * FROM personal WHERE activo = TRUE');
      personalList = pRes.rows;
    } else {
      const db = loadJsonDb();
      manualRecords = db.recordatorios_operativos || [];
      recursosList = (db.recursos || []).filter(r => r.activo !== false);
      personalList = (db.personal || []).filter(p => p.activo !== false);
    }

    const autoRecords = [];

    const subtractDays = (dStr, days) => {
      if (!dStr) return null;
      const d = new Date(dStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dStr;
      d.setDate(d.getDate() - days);
      return d.toISOString().split('T')[0];
    };

    // 1. Recordatorios Automáticos de VTV (7 días de anticipación) y Seguro desde Tabla Maestra de Flota (Recursos)
    for (const r of recursosList) {
      if (r.vtv_vencimiento) {
        const vDate = normalizeDate(r.vtv_vencimiento);
        if (vDate) {
          const alertDate = subtractDays(vDate, 7);
          autoRecords.push({
            id: `auto_vtv_${r.id}`,
            fecha: alertDate,
            fecha_vencimiento_real: vDate,
            dias_anticipacion: 7,
            titulo: `⚠️ Solicitar Turno VTV (Vence el ${vDate}) — ${r.nombre} (${r.patente_identificador || 'S/Patente'})`,
            tipo: 'Vehículo',
            subtipo: 'VTV',
            entidad_id: r.id,
            entidad_tipo: 'recurso',
            descripcion: `Alerta generada con 7 días de anticipación para tramitar el turno previo. La VTV oficial del vehículo ${r.nombre} (${r.patente_identificador || 'S/P'}) vence el ${vDate}.`,
            es_automatico: true,
            origen: 'Tabla Maestra (Recursos / Flota)',
            completado: false
          });
        }
      }

      if (r.seguro_vencimiento) {
        const sDate = normalizeDate(r.seguro_vencimiento);
        if (sDate) {
          const alertDate = subtractDays(sDate, 7);
          autoRecords.push({
            id: `auto_seguro_${r.id}`,
            fecha: alertDate,
            fecha_vencimiento_real: sDate,
            dias_anticipacion: 7,
            titulo: `⚠️ Renovar Póliza Seguro (Vence el ${sDate}) — ${r.nombre} (${r.patente_identificador || 'S/Patente'})`,
            tipo: 'Vehículo',
            subtipo: 'Seguro',
            entidad_id: r.id,
            entidad_tipo: 'recurso',
            descripcion: `Alerta con 7 días de anticipación. La póliza de seguro del vehículo ${r.nombre} (${r.patente_identificador || 'S/P'}) vence el ${sDate}.`,
            es_automatico: true,
            origen: 'Tabla Maestra (Recursos / Flota)',
            completado: false
          });
        }
      }
    }

    // 2. Recordatorios Automáticos de Salud y Licencias desde Tabla Maestra de Personal (7 días de anticipación)
    for (const p of personalList) {
      if (p.examen_medico_vencimiento) {
        const mDate = normalizeDate(p.examen_medico_vencimiento);
        if (mDate) {
          const alertDate = subtractDays(mDate, 7);
          autoRecords.push({
            id: `auto_medico_${p.id}`,
            fecha: alertDate,
            fecha_vencimiento_real: mDate,
            dias_anticipacion: 7,
            titulo: `⚠️ Renovar Examen Médico / Libreta Sanitaria (Vence el ${mDate}) — ${p.nombre}`,
            tipo: 'Personal',
            subtipo: 'Salud',
            entidad_id: p.id,
            entidad_tipo: 'personal',
            descripcion: `Alerta con 7 días de anticipación. El apto médico / libreta sanitaria de ${p.nombre} (${p.rol_funcion || 'Personal'}) vence el ${mDate}.`,
            es_automatico: true,
            origen: 'Tabla Maestra (Personal)',
            completado: false
          });
        }
      }

      if (p.licencia_conducir_vencimiento) {
        const lDate = normalizeDate(p.licencia_conducir_vencimiento);
        if (lDate) {
          const alertDate = subtractDays(lDate, 7);
          autoRecords.push({
            id: `auto_licencia_${p.id}`,
            fecha: alertDate,
            fecha_vencimiento_real: lDate,
            dias_anticipacion: 7,
            titulo: `⚠️ Renovar Registro de Conducir (Vence el ${lDate}) — ${p.nombre}`,
            tipo: 'Personal',
            subtipo: 'Licencia',
            entidad_id: p.id,
            entidad_tipo: 'personal',
            descripcion: `Alerta con 7 días de anticipación. La licencia de conducir de ${p.nombre} (${p.rol_funcion || 'Chofer'}) vence el ${lDate}.`,
            es_automatico: true,
            origen: 'Tabla Maestra (Personal)',
            completado: false
          });
        }
      }
    }

    // Consolidar manuales y automáticos
    let allRecords = [...autoRecords, ...manualRecords];
    if (desde) allRecords = allRecords.filter(r => r.fecha >= desde);
    if (hasta) allRecords = allRecords.filter(r => r.fecha <= hasta);

    return allRecords.sort((a, b) => a.fecha.localeCompare(b.fecha));
  },

  saveRecordatorio: async (rec) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO recordatorios_operativos (fecha, titulo, tipo, entidad_id, entidad_tipo, descripcion, completado)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [rec.fecha, rec.titulo, rec.tipo || 'General', rec.entidad_id || null, rec.entidad_tipo || null, rec.descripcion || null, Boolean(rec.completado)]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.recordatorios_operativos) db.recordatorios_operativos = [];
      const nextId = db.recordatorios_operativos.length > 0 ? Math.max(...db.recordatorios_operativos.map(r => r.id)) + 1 : 1;
      const newRec = {
        id: nextId,
        fecha: rec.fecha,
        titulo: rec.titulo,
        tipo: rec.tipo || 'General',
        entidad_id: rec.entidad_id || null,
        entidad_tipo: rec.entidad_tipo || null,
        descripcion: rec.descripcion || null,
        completado: Boolean(rec.completado),
        fecha_creacion: new Date().toISOString()
      };
      db.recordatorios_operativos.push(newRec);
      saveJsonDb();
      return newRec;
    }
  },

  updateRecordatorio: async (id, rec) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE recordatorios_operativos
         SET fecha = $1, titulo = $2, tipo = $3, entidad_id = $4, entidad_tipo = $5, descripcion = $6, completado = $7
         WHERE id = $8
         RETURNING *`,
        [rec.fecha, rec.titulo, rec.tipo || 'General', rec.entidad_id || null, rec.entidad_tipo || null, rec.descripcion || null, Boolean(rec.completado), id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.recordatorios_operativos) db.recordatorios_operativos = [];
      const idx = db.recordatorios_operativos.findIndex(r => r.id === Number(id));
      if (idx !== -1) {
        db.recordatorios_operativos[idx] = { ...db.recordatorios_operativos[idx], ...rec };
        saveJsonDb();
        return db.recordatorios_operativos[idx];
      }
      return null;
    }
  },

  deleteRecordatorio: async (id) => {
    if (usePostgreSQL) {
      const res = await pool.query('DELETE FROM recordatorios_operativos WHERE id = $1 RETURNING id', [id]);
      return res.rowCount > 0;
    } else {
      const db = loadJsonDb();
      if (!db.recordatorios_operativos) db.recordatorios_operativos = [];
      const idx = db.recordatorios_operativos.findIndex(r => r.id === Number(id));
      if (idx !== -1) {
        db.recordatorios_operativos.splice(idx, 1);
        saveJsonDb();
        return true;
      }
      return false;
    }
  },

  // ==========================================
  // ACTUALIZACIÓN COMPLETA DE OT DESDE CALENDARIO
  // ==========================================
  updateOrdenTrabajoFull: async (id, data) => {
    if (usePostgreSQL) {
      const fields = [];
      const values = [];
      let idx = 1;

      const allowed = [
        'fecha_inicio', 'fecha_fin', 'fecha_evento', 'estado', 'observaciones',
        'frente', 'largo', 'superficie', 'estructura_tipo', 'modelo_estructura',
        'modulacion_config', 'adicionales', 'georef', 'panol_status', 'planta_status',
        'fecha_traslado', 'fecha_comienzo_armado', 'fecha_comienzo_desarmado', 'fecha_retorno'
      ];

      for (const key of allowed) {
        if (data[key] !== undefined) {
          fields.push(`${key} = $${idx}`);
          if (['modulacion_config', 'adicionales', 'georef', 'panol_status', 'planta_status'].includes(key) && typeof data[key] === 'object') {
            values.push(JSON.stringify(data[key]));
          } else {
            values.push(data[key]);
          }
          idx++;
        }
      }

      if (fields.length === 0) return null;

      values.push(id);
      const query = `UPDATE ordenes_trabajo SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
      const res = await pool.query(query, values);
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.ordenes_trabajo) db.ordenes_trabajo = [];
      const otIdx = db.ordenes_trabajo.findIndex(o => o.id === Number(id) || o.id === id);
      if (otIdx !== -1) {
        db.ordenes_trabajo[otIdx] = {
          ...db.ordenes_trabajo[otIdx],
          ...data
        };
        saveJsonDb();
        return db.ordenes_trabajo[otIdx];
      }
      return null;
    }
  },

  // ==========================================
  // ENCARGADOS DE SECTORES
  // ==========================================
  getEncargadosSectores: async () => {
    if (usePostgreSQL) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS encargados_sectores (
          id SERIAL PRIMARY KEY,
          sector VARCHAR(100) UNIQUE NOT NULL,
          encargado_nombre VARCHAR(255),
          encargado_id INTEGER,
          contacto VARCHAR(100),
          actualizado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const res = await pool.query('SELECT * FROM encargados_sectores ORDER BY sector');
      return res.rows;
    } else {
      const db = loadJsonDb();
      return db.encargados_sectores || [];
    }
  },

  saveEncargadosSectores: async (sectoresArray) => {
    if (usePostgreSQL) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS encargados_sectores (
          id SERIAL PRIMARY KEY,
          sector VARCHAR(100) UNIQUE NOT NULL,
          encargado_nombre VARCHAR(255),
          encargado_id INTEGER,
          contacto VARCHAR(100),
          actualizado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      for (const s of sectoresArray) {
        await pool.query(`
          INSERT INTO encargados_sectores (sector, encargado_nombre, encargado_id, contacto, actualizado_el)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT (sector) DO UPDATE
          SET encargado_nombre = EXCLUDED.encargado_nombre,
              encargado_id = EXCLUDED.encargado_id,
              contacto = EXCLUDED.contacto,
              actualizado_el = CURRENT_TIMESTAMP
        `, [s.sector, s.encargado_nombre, s.encargado_id || null, s.contacto || null]);
      }
      const res = await pool.query('SELECT * FROM encargados_sectores ORDER BY sector');
      return res.rows;
    } else {
      const db = loadJsonDb();
      db.encargados_sectores = sectoresArray;
      saveJsonDb();
      return db.encargados_sectores;
    }
  },

  // ==========================================
  // REGISTRO DE USO DE ACCESORIOS (ROLLOS / CONSUMOS)
  // ==========================================
  recordAccessoryUsage: async (id, { usuario, cantidad_usada, destino_obs }) => {
    if (usePostgreSQL) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS registro_usos_accesorios (
          id SERIAL PRIMARY KEY,
          accesorio_id INTEGER REFERENCES inventario_accesorios(id) ON DELETE CASCADE,
          usuario VARCHAR(255),
          cantidad NUMERIC,
          destino_obs TEXT,
          fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(
        'INSERT INTO registro_usos_accesorios (accesorio_id, usuario, cantidad, destino_obs) VALUES ($1, $2, $3, $4)',
        [id, usuario || 'Sector', cantidad_usada || 0, destino_obs || '']
      );
      // Retrieve accessory and its usage history
      const acc = await pool.query('SELECT * FROM inventario_accesorios WHERE id = $1', [id]);
      const usos = await pool.query('SELECT * FROM registro_usos_accesorios WHERE accesorio_id = $1 ORDER BY fecha DESC', [id]);
      return { ...(acc.rows[0] || {}), historial_usos: usos.rows };
    } else {
      const db = loadJsonDb();
      if (!db.registro_usos_accesorios) db.registro_usos_accesorios = [];
      const newRecord = {
        id: Date.now(),
        accesorio_id: id,
        usuario: usuario || 'Sector',
        cantidad: cantidad_usada || 0,
        destino_obs: destino_obs || '',
        fecha: new Date().toISOString()
      };
      db.registro_usos_accesorios.push(newRecord);
      saveJsonDb();
      const item = db.inventario_accesorios.find(a => a.id === id);
      return {
        ...(item || {}),
        historial_usos: db.registro_usos_accesorios.filter(u => u.accesorio_id === id)
      };
    }
  }
};

export default db;
