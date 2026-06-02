const http = require('http');

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log("=== STARTING PICKING & DELETION FLOW VERIFICATION ===");

  try {
    // 1. Fetch clients to get a valid client_id
    console.log("\n1. Fetching clients...");
    const clients = await request('GET', '/api/clientes');
    if (clients.length === 0) {
      throw new Error("No clients found in the database. Please seed the database first.");
    }
    const client = clients[0];
    console.log(`Using client: ${client.nombre} (ID: ${client.id})`);

    // 2. Fetch users to get/create a test operario user
    console.log("\n2. Fetching users...");
    const users = await request('GET', '/api/usuarios');
    let testUser = users.find(u => u.username === 'test_operario');
    if (!testUser) {
      console.log("Creating test user 'test_operario'...");
      testUser = await request('POST', '/api/usuarios', {
        username: 'test_operario',
        nombre: 'Test Operario',
        password: 'password123',
        rol: 'Operario'
      });
    }
    console.log(`Using user: ${testUser.username} (ID: ${testUser.id})`);

    // 3. Fetch personal or create a test personal
    console.log("\n3. Fetching personal...");
    const personalList = await request('GET', '/api/personal');
    let testPersonal = personalList.find(p => p.nombre === 'Juan Test');
    if (!testPersonal) {
      console.log("Creating test personal 'Juan Test'...");
      testPersonal = await request('POST', '/api/personal', {
        nombre: 'Juan Test',
        cuit: '20-12345678-9',
        telefono: '1122334455',
        rol_funcion: 'Operario Planta',
        activo: true,
        usuario_id: testUser.id
      });
    } else if (testPersonal.usuario_id !== testUser.id) {
      console.log(`Linking personal ID ${testPersonal.id} to user ID ${testUser.id}...`);
      testPersonal = await request('PUT', `/api/personal/${testPersonal.id}`, {
        ...testPersonal,
        usuario_id: testUser.id
      });
    }
    console.log(`Personal linked: ${testPersonal.nombre} -> User ID ${testPersonal.usuario_id}`);

    // 4. Create a test OT (Initially Pendiente)
    console.log("\n4. Creating test OT...");
    const otData = {
      ot_numero: 'OT-PICK-9999',
      cliente_id: client.id,
      fecha_inicio: '2026-06-10',
      fecha_fin: '2026-06-15',
      modelo_estructura: 'Aluminio C10',
      estructura_tipo: 'Pabellón',
      frente: 10,
      largo: 15,
      superficie: 150,
      modulacion_config: {},
      adicionales: {},
      georef: { direccion: 'Av. Corrientes 1234, CABA' },
      estado: 'Pendiente',
      panol_status: {},
      planta_status: {},
      creado_por: 'SuperAdmin'
    };
    const createdOT = await request('POST', '/api/ots', otData);
    console.log(`OT Created: ${createdOT.ot_numero} (ID: ${createdOT.id}, Status: ${createdOT.estado})`);

    // 5. Update assignment stage to Picking: assign multiple users (testPersonal.id) to Planta task
    console.log("\n5. Assigning multiple workers to Planta picking task...");
    const updatedAdicionales = {
      ...createdOT.adicionales,
      asignaciones_tareas: {
        Planta: [testPersonal.id, 99999] // Array of IDs (multiple persons)
      }
    };
    const updatedOT = await request('PUT', `/api/ots/${createdOT.id}/adicionales`, {
      adicionales: updatedAdicionales,
      usuario: 'SuperAdmin',
      rol: 'SuperAdmin'
    });
    console.log("Asignaciones actualizadas:", updatedOT.adicionales?.asignaciones_tareas);

    // Verify retrieval matches
    const assignedVal = updatedOT.adicionales?.asignaciones_tareas?.Planta;
    if (!Array.isArray(assignedVal) || !assignedVal.includes(testPersonal.id)) {
      throw new Error(`Failed to assign multiple workers. Expected array containing personal ID ${testPersonal.id}, but got: ${JSON.stringify(assignedVal)}`);
    }
    console.log("SUCCESS: Multi-person assignment verified.");

    // 6. Delete the test OT (Requires Gerencia or SuperAdmin role header)
    console.log("\n6. Attempting to delete OT with correct role (SuperAdmin)...");
    const deleteRes = await request('DELETE', `/api/ots/${createdOT.id}`, null, {
      'x-user-role': 'SuperAdmin',
      'x-user-name': 'SuperAdminUser'
    });
    console.log("Delete result:", deleteRes);

    // Verify it's actually deleted
    const allOTs = await request('GET', '/api/ots');
    const checkOT = allOTs.find(o => o.id === createdOT.id);
    if (checkOT) {
      throw new Error(`OT ${createdOT.ot_numero} was not deleted from database!`);
    }
    console.log("SUCCESS: OT deleted permanently.");

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");

  } catch (error) {
    console.error("\n❌ TEST FLOW FAILED:", error.message);
    process.exit(1);
  }
}

runTests();
