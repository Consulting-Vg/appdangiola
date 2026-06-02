import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonDbPath = path.join(__dirname, 'data', 'db.json');

// Configuration
const connectionString = process.env.DATABASE_URL;
let pool = null;
let usePostgreSQL = false;
let jsonDb = null;

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

// Initialize connection
const initDb = async () => {
  if (connectionString) {
    try {
      pool = new pg.Pool({
        connectionString,
        ssl: connectionString.includes('render.com') || connectionString.includes('supabase')
          ? { rejectUnauthorized: false }
          : false
      });
      // Test connection
      await pool.query('SELECT NOW()');
      usePostgreSQL = true;
      console.log('Connected to PostgreSQL successfully.');
      // Auto migration to add usuario_id column
      await pool.query('ALTER TABLE personal ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL');
    } catch (err) {
      console.warn('PostgreSQL connection failed. Falling back to local JSON database.', err.message);
      usePostgreSQL = false;
      loadJsonDb();
    }
  } else {
    console.log('DATABASE_URL not set. Running in local JSON database mode.');
    usePostgreSQL = false;
    loadJsonDb();
  }
};

// Run initialization immediately
initDb();

// Expose Repository API
export const db = {
  isPostgreSQL: () => usePostgreSQL,

  // Reset database (used by Admin Dashboard)
  resetDatabase: async (data) => {
    if (usePostgreSQL) {
      // Re-run schema or truncate tables and re-insert
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        await client.query('TRUNCATE chat_mensajes, ordenes_desarme, ordenes_trabajo, inventario_accesorios, base_fijo, base_modulo, base_arco, estructuras_maestras, clientes, usuarios, log_transacciones, personal, recursos RESTART IDENTITY CASCADE');

        // Seed structures
        for (const est of data.estructuras_maestras) {
          await client.query(
            `INSERT INTO estructuras_maestras (id, modelo_estructura, arcos_totales, estructura_tipo, frente, largo_maximo, arcos_disponibles)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [est.id, est.modelo_estructura, est.arcos_totales, est.estructura_tipo, est.frente, est.largo_maximo, est.arcos_disponibles]
          );
        }

        // Seed clients
        for (const cl of data.clientes) {
          await client.query(
            `INSERT INTO clientes (id, cuenta, nombre, actividad, estado, observacion, domicilio, localidad, provincia, pais, telefono, email, cuit, vendedores, responsables, latitud, longitud)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [cl.id, cl.cuenta, cl.nombre, cl.actividad, cl.estado, cl.observacion, cl.domicilio, cl.localidad, cl.provincia, cl.pais, cl.telefono, cl.email, cl.cuit, cl.vendedores, cl.responsables, cl.latitud, cl.longitud]
          );
        }

        // Seed base_arco
        for (const arc of data.base_arco) {
          await client.query(
            `INSERT INTO base_arco (id, producto, arco, modelo_estructura, sector, qty_fija_arco)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [arc.id, arc.producto, arc.arco, arc.modelo_estructura, arc.sector, arc.qty_fija_arco]
          );
        }

        // Seed base_modulo
        for (const mod of data.base_modulo) {
          await client.query(
            `INSERT INTO base_modulo (id, producto, modelo_estructura, sector, modulacion, stock_inicial, modulo_val)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [mod.id, mod.producto, mod.modelo_estructura, mod.sector, mod.modulacion, mod.stock_inicial, mod.modulo_val || null]
          );
        }

        // Seed base_fijo
        for (const fj of data.base_fijo) {
          await client.query(
            `INSERT INTO base_fijo (id, producto, modelo_estructura, sector, qty_fija_carpa)
             VALUES ($1, $2, $3, $4, $5)`,
            [fj.id, fj.producto, fj.modelo_estructura, fj.sector, fj.qty_fija_carpa]
          );
        }

        // Seed accessories
        for (const acc of data.inventario_accesorios) {
          await client.query(
            `INSERT INTO inventario_accesorios (id, categoria, nombre, color, tipo, medida, estado, stock_total)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [acc.id, acc.categoria, acc.nombre, acc.color, acc.tipo, acc.medida, acc.estado, acc.stock_total]
          );
        }

        // Seed default users
        if (data.usuarios && data.usuarios.length > 0) {
          for (const user of data.usuarios) {
            await client.query(
              `INSERT INTO usuarios (id, username, nombre, password, rol, modulos)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [user.id, user.username, user.nombre, user.password, user.rol, user.modulos || '[]']
            );
          }
        }

        await client.query('COMMIT');
        console.log("PostgreSQL database reset complete.");
      } catch (err) {
        await client.query('ROLLBACK');
        console.error("PostgreSQL database reset failed, rolling back:", err);
        throw err;
      } finally {
        client.release();
      }
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
        recursos: []
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
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO clientes (cuenta, nombre, actividad, estado, observacion, domicilio, localidad, provincia, pais, telefono, email, cuit, vendedores, responsables, latitud, longitud)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [client.cuenta, client.nombre, client.actividad, client.estado, client.observacion, client.domicilio, client.localidad, client.provincia, client.pais, client.telefono, client.email, client.cuit, client.vendedores, client.responsables, client.latitud, client.longitud]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const nextId = db.clientes.length > 0 ? Math.max(...db.clientes.map(c => c.id)) + 1 : 1;
      const newClient = { id: nextId, ...client };
      db.clientes.push(newClient);
      saveJsonDb();
      return newClient;
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
          fecha_evento, observaciones
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
          ot.ot_numero, ot.cliente_id, ot.fecha_inicio, ot.fecha_fin, ot.modelo_estructura,
          ot.estructura_tipo, ot.frente, ot.largo, ot.superficie, JSON.stringify(ot.modulacion_config),
          JSON.stringify(ot.adicionales), JSON.stringify(ot.georef), ot.estado || 'Pendiente',
          JSON.stringify(ot.panol_status), JSON.stringify(ot.planta_status), ot.creado_por,
          ot.fecha_evento || null, ot.observaciones || null
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
          ? JSON.parse(getRes.rows[0].adicionales)
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
          ? JSON.parse(ot.adicionales)
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
          ? JSON.parse(getRes.rows[0].adicionales)
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
          ? JSON.parse(ot.adicionales)
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
          ? JSON.parse(getRes.rows[0].adicionales)
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
          ? JSON.parse(ot.adicionales)
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
          ? JSON.parse(getRes.rows[0].adicionales)
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

      const res = await pool.query(
        `UPDATE ordenes_trabajo 
         SET modulacion_config = $1, adicionales = $2, panol_status = $3, planta_status = $4, estado = 'Aprobada'
         WHERE id = $5 
         RETURNING *`,
        [
          JSON.stringify(modulacion_config),
          JSON.stringify(currentAdicionales),
          JSON.stringify(panol_status),
          JSON.stringify(planta_status),
          id
        ]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      const ot = db.ordenes_trabajo.find(o => o.id === id);
      if (ot) {
        let currentAdicionales = typeof ot.adicionales === 'string'
          ? JSON.parse(ot.adicionales)
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
         SET fecha_fin = $1, fecha_traslado = $2, fecha_comienzo_armado = $3, fecha_comienzo_desarmado = $4, fecha_retorno = $5
         WHERE id = $6 RETURNING *`,
        [
          data.fecha_fin,
          data.fecha_traslado || null,
          data.fecha_comienzo_armado || null,
          data.fecha_comienzo_desarmado || null,
          data.fecha_retorno || null,
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
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO personal (nombre, cuit, telefono, rol_funcion, activo, usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [persona.nombre, persona.cuit || null, persona.telefono || null, persona.rol_funcion, persona.activo !== false, persona.usuario_id || null]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.personal) db.personal = [];
      const nextId = db.personal.length > 0 ? Math.max(...db.personal.map(p => p.id)) + 1 : 1;
      const newPersona = {
        id: nextId,
        nombre: persona.nombre,
        cuit: persona.cuit || null,
        telefono: persona.telefono || null,
        rol_funcion: persona.rol_funcion,
        activo: persona.activo !== false,
        usuario_id: persona.usuario_id || null,
        fecha_creacion: new Date().toISOString()
      };
      db.personal.push(newPersona);
      saveJsonDb();
      return newPersona;
    }
  },

  updatePersonal: async (id, persona) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE personal
         SET nombre = $1, cuit = $2, telefono = $3, rol_funcion = $4, activo = $5, usuario_id = $6
         WHERE id = $7
         RETURNING *`,
        [persona.nombre, persona.cuit || null, persona.telefono || null, persona.rol_funcion, persona.activo !== false, persona.usuario_id || null, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.personal) db.personal = [];
      const idx = db.personal.findIndex(p => p.id === id);
      if (idx !== -1) {
        db.personal[idx] = {
          ...db.personal[idx],
          nombre: persona.nombre,
          cuit: persona.cuit || null,
          telefono: persona.telefono || null,
          rol_funcion: persona.rol_funcion,
          activo: persona.activo !== false,
          usuario_id: persona.usuario_id || null
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
    if (usePostgreSQL) {
      const res = await pool.query(
        `INSERT INTO recursos (nombre, tipo, patente_identificador, descripcion, activo)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [recurso.nombre, recurso.tipo, recurso.patente_identificador || null, recurso.descripcion || null, recurso.activo !== false]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.recursos) db.recursos = [];
      const nextId = db.recursos.length > 0 ? Math.max(...db.recursos.map(r => r.id)) + 1 : 1;
      const newRecurso = {
        id: nextId,
        nombre: recurso.nombre,
        tipo: recurso.tipo,
        patente_identificador: recurso.patente_identificador || null,
        descripcion: recurso.descripcion || null,
        activo: recurso.activo !== false,
        fecha_creacion: new Date().toISOString()
      };
      db.recursos.push(newRecurso);
      saveJsonDb();
      return newRecurso;
    }
  },

  updateRecurso: async (id, recurso) => {
    if (usePostgreSQL) {
      const res = await pool.query(
        `UPDATE recursos
         SET nombre = $1, tipo = $2, patente_identificador = $3, descripcion = $4, activo = $5
         WHERE id = $6
         RETURNING *`,
        [recurso.nombre, recurso.tipo, recurso.patente_identificador || null, recurso.descripcion || null, recurso.activo !== false, id]
      );
      return res.rows[0];
    } else {
      const db = loadJsonDb();
      if (!db.recursos) db.recursos = [];
      const idx = db.recursos.findIndex(r => r.id === id);
      if (idx !== -1) {
        db.recursos[idx] = {
          ...db.recursos[idx],
          nombre: recurso.nombre,
          tipo: recurso.tipo,
          patente_identificador: recurso.patente_identificador || null,
          descripcion: recurso.descripcion || null,
          activo: recurso.activo !== false
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
  }
};
