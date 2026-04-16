#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const phase = String(process.env.EVENT_SYSTEM_PHASE || '').toUpperCase();

if (phase !== 'BACKFILL') {
  console.error('[kpi-backfill] Refus: EVENT_SYSTEM_PHASE doit etre BACKFILL pour eviter le double comptage.');
  console.error('[kpi-backfill] Exemple: EVENT_SYSTEM_PHASE=BACKFILL npm run db:kpi:backfill');
  process.exit(1);
}

console.log('[kpi-backfill] Phase BACKFILL detectee. Lancement du backfill SQL atomique...');

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', './scripts/backfill-kpi-from-source.sql'],
  { stdio: 'inherit', env: process.env },
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('[kpi-backfill] Termine. Pense a repasser EVENT_SYSTEM_PHASE=LIVE pour relancer l emission des events.');
