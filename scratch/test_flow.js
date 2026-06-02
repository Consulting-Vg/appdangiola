async function testFlow() {
  console.log('Starting verification flow...');

  // 1. Reset database to starting state
  const resetRes = await fetch('http://localhost:5001/api/admin/reset', { method: 'POST' });
  const resetData = await resetRes.json();
  console.log('DB Reset:', resetData);

  // 2. Fetch users and verify planta's role is Operario
  const usersRes = await fetch('http://localhost:5001/api/usuarios');
  const users = await usersRes.json();
  const plantaUser = users.find(u => u.username === 'planta');
  console.log('Planta User:', plantaUser);
  if (plantaUser.rol !== 'Operario') {
    throw new Error('Planta user is not an Operario!');
  }

  // 3. Get OTs
  const otsRes = await fetch('http://localhost:5001/api/ots');
  const ots = await otsRes.json();
  console.log(`Fetched ${ots.length} OTs.`);

  // Find an active/approved OT or create one if needed. Let's look at the first OT.
  let targetOT = ots[0];
  if (!targetOT) {
    console.log('No OTs found. Creating a mock OT...');
    const createRes = await fetch('http://localhost:5001/api/ots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ot_numero: 'OT-TEST-1234',
        cliente_id: 1,
        fecha_inicio: '2026-06-02',
        fecha_fin: '2026-06-10',
        modelo_estructura: 'Pabellon 10x15',
        estructura_tipo: 'Aluminio',
        frente: 10.0,
        largo: 15.0,
        superficie: 150.0,
        modulacion_config: {},
        adicionales: {},
        georef: {},
        estado: 'Aprobada',
        panol_status: { items: [] },
        planta_status: { items: [] },
        creado_por: 'admin'
      })
    });
    targetOT = await createRes.json();
  }
  console.log(`Target OT: ${targetOT.ot_numero}, Estado: ${targetOT.estado}`);

  // Let's set its status to 'Aprobada' if it's not.
  if (targetOT.estado !== 'Aprobada') {
    const statusRes = await fetch(`http://localhost:5001/api/ots/${targetOT.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Aprobada', usuario: 'admin', rol: 'SuperAdmin' })
    });
    const updatedStatus = await statusRes.json();
    targetOT.estado = updatedStatus.estado;
    console.log(`Updated OT status to: ${targetOT.estado}`);
  }

  // 4. Update task assignments (assign Planta task to 'planta', Pañol to 'pañol')
  const adicionales = {
    asignaciones_tareas: {
      Planta: 'planta',
      Pañol: 'pañol'
    }
  };

  const adicRes = await fetch(`http://localhost:5001/api/ots/${targetOT.id}/adicionales`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adicionales,
      usuario: 'admin',
      rol: 'SuperAdmin'
    })
  });
  const updatedOT = await adicRes.json();
  const savedAdicionales = typeof updatedOT.adicionales === 'string'
    ? JSON.parse(updatedOT.adicionales)
    : updatedOT.adicionales || {};

  console.log('Saved asignaciones:', savedAdicionales.asignaciones_tareas);
  if (savedAdicionales.asignaciones_tareas?.Planta !== 'planta' || savedAdicionales.asignaciones_tareas?.Pañol !== 'pañol') {
    throw new Error('Task assignments failed to save correctly!');
  }

  // 5. Simulate RoleDashboard filtering for Operario
  const actualRole = 'Operario';
  const checkFilter = (ot, username) => {
    if (actualRole === 'Operario') {
      const parsedAdicionales = typeof ot.adicionales === 'string'
        ? JSON.parse(ot.adicionales)
        : ot.adicionales || {};
      const asignaciones = parsedAdicionales.asignaciones_tareas || {};
      return Object.values(asignaciones).includes(username);
    }
    return true;
  };

  const visibleToPlanta = checkFilter(updatedOT, 'planta');
  const visibleToPañol = checkFilter(updatedOT, 'pañol');
  const visibleToLonas = checkFilter(updatedOT, 'lonas');

  console.log('Visible to planta:', visibleToPlanta); // Should be true
  console.log('Visible to pañol:', visibleToPañol);   // Should be true
  console.log('Visible to lonas:', visibleToLonas);   // Should be false

  if (!visibleToPlanta || !visibleToPañol || visibleToLonas) {
    throw new Error('Filtering simulation failed!');
  }

  // 6. Simulate App.jsx checklist filtering for Operario
  const getSector = (item) => {
    if (item.sector) return item.sector;
    const name = item.producto || '';
    const isLona = (n) => n.toLowerCase().includes('lona');
    const isPiso = (n) => n.toLowerCase().includes('piso');
    const isTela = (n) => n.toLowerCase().includes('tela');
    if (isLona(name)) return 'Lonas';
    if (isPiso(name)) return 'Pisos';
    if (isTela(name)) return 'Telas';
    return item.sourceList;
  };

  const getVisibleChecklists = (ot, username) => {
    const parsedAdicionales = typeof ot.adicionales === 'string'
      ? JSON.parse(ot.adicionales)
      : ot.adicionales || {};
    const asignaciones = parsedAdicionales.asignaciones_tareas || {};
    const assignedSectors = Object.keys(asignaciones).filter(sec => asignaciones[sec] === username);
    return assignedSectors;
  };

  console.log('Sectors visible to planta:', getVisibleChecklists(updatedOT, 'planta')); // Should be ['Planta']
  console.log('Sectors visible to pañol:', getVisibleChecklists(updatedOT, 'pañol'));   // Should be ['Pañol']
  console.log('Sectors visible to lonas:', getVisibleChecklists(updatedOT, 'lonas'));   // Should be []

  const sectorsPlanta = getVisibleChecklists(updatedOT, 'planta');
  if (sectorsPlanta.length !== 1 || sectorsPlanta[0] !== 'Planta') {
    throw new Error('Checklist sector filtering simulation failed for planta!');
  }

  console.log('Verification completed successfully!');
}

testFlow().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
