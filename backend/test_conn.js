import pg from 'pg';
import parse from 'pg-connection-string';

const connectionString = 'postgresql://dangiola_user:Dangiola-Secure-Password-2026@/dangiola?host=/cloudsql/gobiernoia-500314:us-central1:dangiola-db';

console.log("Parsed configuration:");
try {
  const config = parse.parse(connectionString);
  console.log(JSON.stringify(config, null, 2));
} catch (e) {
  console.error("Error parsing connection string:", e);
}
