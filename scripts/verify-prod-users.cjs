const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query('SELECT email, role, name FROM "User" ORDER BY "createdAt"');
  const relais = await client.query('SELECT "commerceName", ville, status FROM "Relais" ORDER BY "createdAt"');
  await client.end();

  console.log(`\n=== Users in prod: ${res.rows.length} ===`);
  res.rows.forEach((u) => console.log(`  [${u.role}] ${u.email} — ${u.name}`));
  console.log(`\n=== Relais in prod: ${relais.rows.length} ===`);
  relais.rows.forEach((r) => console.log(`  ${r.commerceName} (${r.ville}) — ${r.status}`));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
