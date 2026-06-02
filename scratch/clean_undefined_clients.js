const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/data/db.json');

console.log("=== CLEANING CORRUPTED CLIENT RECORDS IN JSON DB ===");

if (fs.existsSync(dbPath)) {
  const json = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  if (json.ventas_historicas) {
    const beforeCount = json.ventas_historicas.length;
    json.ventas_historicas = json.ventas_historicas.filter(s => s.cliente_nombre !== 'undefined' && s.cliente_nombre);
    const afterCount = json.ventas_historicas.length;
    fs.writeFileSync(dbPath, JSON.stringify(json, null, 2), 'utf8');
    console.log(`JSON DB: Removed ${beforeCount - afterCount} records with 'undefined' client names.`);
  } else {
    console.log("No ventas_historicas array found.");
  }
} else {
  console.log(`File not found: ${dbPath}`);
}

console.log("=== CLEANUP COMPLETED ===");
process.exit(0);
