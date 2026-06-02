import { db } from '../backend/db.js';
import { exec } from 'child_process';
import http from 'http';

// We will simulate the server sync function locally by importing and running it,
// or we can start the server, call the PUT status endpoint, and check the DB.
// Let's first inspect the sync logic directly.

const syncOtToVentasHistoricas = async (ot) => {
  try {
    const existing = await db.getVentasHistoricas({ ot_id: ot.id });
    if (existing && existing.length > 0) {
      console.log(`[Test] OT ${ot.id} already exists in ventas_historicas.`);
      return;
    }

    let clienteNombre = ot.cliente_nombre;
    if ((!clienteNombre || clienteNombre === 'undefined' || clienteNombre === 'null') && ot.cliente_id) {
      const clients = await db.getClients();
      const client = clients.find(c => String(c.id) === String(ot.cliente_id));
      if (client) {
        clienteNombre = client.nombre;
      }
    }

    console.log(`[Test] Syncing OT ${ot.id} with clienteNombre:`, clienteNombre);
    
    // We don't need to insert it in the actual db to verify, just check the resolved client name.
    return clienteNombre;
  } catch (err) {
    console.error(`[Test] Error:`, err);
  }
};

(async () => {
  console.log("=== Testing syncOtToVentasHistoricas client resolution ===");

  // Test case 1: ot has cliente_nombre missing (undefined JS value), and cliente_id is a number
  const testOt1 = {
    id: 99991,
    cliente_id: 445, // A.F.A.
    cliente_nombre: undefined
  };
  const res1 = await syncOtToVentasHistoricas(testOt1);
  if (res1 === 'A.F.A.') {
    console.log("✅ Test case 1 passed (resolved from ID number).");
  } else {
    console.log("❌ Test case 1 failed:", res1);
  }

  // Test case 2: ot has cliente_nombre as the string 'undefined', and cliente_id is a string
  const testOt2 = {
    id: 99992,
    cliente_id: '1374', // A IMPORT S.A.
    cliente_nombre: 'undefined'
  };
  const res2 = await syncOtToVentasHistoricas(testOt2);
  if (res2 === 'A IMPORT S.A.') {
    console.log("✅ Test case 2 passed (resolved from ID string & string 'undefined').");
  } else {
    console.log("❌ Test case 2 failed:", res2);
  }

  // Test case 3: ot has cliente_nombre as 'null' and cliente_id is a number
  const testOt3 = {
    id: 99993,
    cliente_id: 1374,
    cliente_nombre: 'null'
  };
  const res3 = await syncOtToVentasHistoricas(testOt3);
  if (res3 === 'A IMPORT S.A.') {
    console.log("✅ Test case 3 passed (resolved from ID string & string 'null').");
  } else {
    console.log("❌ Test case 3 failed:", res3);
  }

  console.log("=== Sync tests completed ===");
  process.exit(0);
})();
