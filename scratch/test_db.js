import { db } from '../backend/db.js';

console.log('usePostgreSQL:', db.isPostgreSQL());
try {
  const users = await db.getUsers ? await db.getUsers() : [];
  console.log('Users count:', users.length);
  console.log('Users:', users.map(u => ({ username: u.username, rol: u.rol })));
} catch (e) {
  console.error(e);
}
process.exit(0);
