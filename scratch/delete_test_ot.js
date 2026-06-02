import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonDbPath = path.resolve(__dirname, '../backend/data/db.json');

async function clean() {
  console.log('Cleaning up OT-TEST-1234...');

  // 1. Delete from PostgreSQL if configured
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      const pg = await import('pg');
      const pool = new pg.default.Pool({ connectionString });
      const res = await pool.query("DELETE FROM ordenes_trabajo WHERE ot_numero = 'OT-TEST-1234' RETURNING id");
      console.log(`Deleted from PostgreSQL: ${res.rowCount} rows.`);
      await pool.end();
    } catch (e) {
      console.error('Error deleting from PostgreSQL:', e.message);
    }
  }

  // 2. Delete from local db.json
  if (fs.existsSync(jsonDbPath)) {
    try {
      const raw = fs.readFileSync(jsonDbPath, 'utf8');
      const db = JSON.parse(raw);
      
      const beforeCount = db.ordenes_trabajo?.length || 0;
      db.ordenes_trabajo = (db.ordenes_trabajo || []).filter(ot => ot.ot_numero !== 'OT-TEST-1234');
      const afterCount = db.ordenes_trabajo.length;

      // Also clean transaction logs
      db.log_transacciones = (db.log_transacciones || []).filter(log => log.ot_numero !== 'OT-TEST-1234');

      fs.writeFileSync(jsonDbPath, JSON.stringify(db, null, 2), 'utf8');
      console.log(`Deleted from db.json: ${beforeCount - afterCount} rows.`);
    } catch (e) {
      console.error('Error deleting from db.json:', e);
    }
  }
}

clean().catch(console.error);
