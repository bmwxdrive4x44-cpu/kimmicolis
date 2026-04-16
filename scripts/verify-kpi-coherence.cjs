#!/usr/bin/env node
/**
 * verify-kpi-coherence.cjs
 *
 * Compare les tables KPI pré-calculées (KpiTransporter, KpiEnseigne, KpiRelais)
 * avec les agrégats calculés directement depuis les tables sources (Mission, Colis, Relais).
 *
 * Usage:
 *   node scripts/verify-kpi-coherence.cjs
 *   npm run db:kpi:verify
 *
 * Retourne exit code 0 si tout est cohérent, 1 si des écarts sont détectés.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require(path.join(__dirname, '..', 'src', 'generated', 'prisma'));

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const TOLERANCE = 0; // Tolérance exacte (0 = zéro écart accepté)
const REPORT_FILE = path.join(__dirname, '..', 'kpi-coherence-report.json');

async function queryRaw(db, sql) {
  return db.$queryRawUnsafe(sql);
}

// ──────────────────────────────────────────────────────────────────────────────
// Requêtes de comparaison
// ──────────────────────────────────────────────────────────────────────────────

const SQL_TRANSPORTER = `
SELECT
  k."transporteurId",
  k."missionsTotal"                                                        AS kpi_missionsTotal,
  COUNT(m.id)::int                                                         AS src_missionsTotal,
  k."missionsCompleted"                                                    AS kpi_missionsCompleted,
  COALESCE(SUM(CASE WHEN m.status IN ('LIVRE','COMPLETED') THEN 1 ELSE 0 END), 0)::int AS src_missionsCompleted,
  k."missionsActive"                                                       AS kpi_missionsActive,
  COALESCE(SUM(CASE WHEN m.status IN ('ASSIGNE','EN_COURS','PICKED_UP') THEN 1 ELSE 0 END), 0)::int AS src_missionsActive,
  ROUND(k."earningsTotal"::numeric, 2)                                     AS kpi_earningsTotal,
  ROUND(COALESCE(SUM(CASE WHEN m.status IN ('LIVRE','COMPLETED') THEN COALESCE(c."netTransporteur",0) ELSE 0 END),0)::numeric, 2) AS src_earningsTotal
FROM "KpiTransporter" k
LEFT JOIN "Mission" m ON m."transporteurId" = k."transporteurId"
LEFT JOIN "Colis" c ON c.id = m."colisId"
GROUP BY k."transporteurId", k."missionsTotal", k."missionsCompleted", k."missionsActive", k."earningsTotal";
`;

const SQL_ENSEIGNE = `
SELECT
  k."enseigneId",
  k."parcelsTotal"                                                          AS kpi_parcelsTotal,
  COUNT(c.id)::int                                                          AS src_parcelsTotal,
  k."parcelsDelivered"                                                      AS kpi_parcelsDelivered,
  COALESCE(SUM(CASE WHEN c.status IN ('LIVRE','DELIVERED') THEN 1 ELSE 0 END), 0)::int  AS src_parcelsDelivered,
  k."pendingPayment"                                                        AS kpi_pendingPayment,
  COALESCE(SUM(CASE WHEN c.status IN ('CREATED','PENDING_PAYMENT') THEN 1 ELSE 0 END), 0)::int AS src_pendingPayment,
  ROUND(k."revenueDelivered"::numeric, 2)                                   AS kpi_revenueDelivered,
  ROUND(COALESCE(SUM(CASE WHEN c.status IN ('LIVRE','DELIVERED') THEN COALESCE(c."prixClient",0) ELSE 0 END),0)::numeric, 2) AS src_revenueDelivered
FROM "KpiEnseigne" k
LEFT JOIN "Colis" c ON c."clientId" = k."enseigneId"
GROUP BY k."enseigneId", k."parcelsTotal", k."parcelsDelivered", k."pendingPayment", k."revenueDelivered";
`;

const SQL_RELAIS = `
SELECT
  k."relaisId",
  k."handoversCompleted"                                                    AS kpi_handoversCompleted,
  COALESCE(SUM(CASE WHEN c."relaisArriveeId" = k."relaisId" AND c.status IN ('LIVRE','DELIVERED') THEN 1 ELSE 0 END), 0)::int AS src_handoversCompleted,
  k."stockArrival"                                                          AS kpi_stockArrival,
  COALESCE(SUM(CASE WHEN c."relaisArriveeId" = k."relaisId" AND c.status IN ('ARRIVE_RELAIS_DESTINATION','ARRIVED_RELAY') THEN 1 ELSE 0 END), 0)::int AS src_stockArrival,
  ROUND(k."commissionsTotal"::numeric, 2)                                   AS kpi_commissionsTotal,
  ROUND(COALESCE(SUM(CASE WHEN c."relaisArriveeId" = k."relaisId" AND c.status IN ('LIVRE','DELIVERED') THEN COALESCE(c."commissionRelais",0) ELSE 0 END),0)::numeric, 2) AS src_commissionsTotal
FROM "KpiRelais" k
LEFT JOIN "Colis" c ON c."relaisDepartId" = k."relaisId" OR c."relaisArriveeId" = k."relaisId"
GROUP BY k."relaisId", k."handoversCompleted", k."stockArrival", k."commissionsTotal";
`;

// ──────────────────────────────────────────────────────────────────────────────
// Analyse des écarts
// ──────────────────────────────────────────────────────────────────────────────

function findDivergences(rows, pairs) {
  const divergences = [];
  for (const row of rows) {
    const rowDivs = [];
    for (const [kpiKey, srcKey] of pairs) {
      const kpiVal = parseFloat(row[kpiKey] ?? 0);
      const srcVal = parseFloat(row[srcKey] ?? 0);
      const delta = Math.abs(kpiVal - srcVal);
      if (delta > TOLERANCE) {
        rowDivs.push({ field: kpiKey.replace('kpi_', ''), kpi: kpiVal, source: srcVal, delta });
      }
    }
    if (rowDivs.length > 0) {
      divergences.push({ id: row[Object.keys(row)[0]], divergences: rowDivs });
    }
  }
  return divergences;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[kpi-verify] Démarrage de la vérification de cohérence KPI...\n');
  const db = new PrismaClient();
  let exitCode = 1;

  try {
    const report = {
      runAt: new Date().toISOString(),
      summary: { ok: true, totalDivergences: 0 },
      transporter: { divergences: [] },
      enseigne: { divergences: [] },
      relais: { divergences: [] },
    };

    // ── KpiTransporter ────────────────────────────────────────────────────────
    console.log('[kpi-verify] Vérification KpiTransporter...');
    const transporterRows = await queryRaw(db, SQL_TRANSPORTER);
  const transporterPairs = [
    ['kpi_missionsTotal', 'src_missionsTotal'],
    ['kpi_missionsCompleted', 'src_missionsCompleted'],
    ['kpi_missionsActive', 'src_missionsActive'],
    ['kpi_earningsTotal', 'src_earningsTotal'],
  ];
    report.transporter.divergences = findDivergences(transporterRows, transporterPairs);
    const tOk = report.transporter.divergences.length === 0;
    console.log(
      tOk
        ? `  ✓ KpiTransporter: ${transporterRows.length} lignes — aucun écart`
        : `  ✗ KpiTransporter: ${report.transporter.divergences.length} transporteur(s) avec écarts`,
    );

    // ── KpiEnseigne ───────────────────────────────────────────────────────────
    console.log('[kpi-verify] Vérification KpiEnseigne...');
    const enseigneRows = await queryRaw(db, SQL_ENSEIGNE);
  const enseignePairs = [
    ['kpi_parcelsTotal', 'src_parcelsTotal'],
    ['kpi_parcelsDelivered', 'src_parcelsDelivered'],
    ['kpi_pendingPayment', 'src_pendingPayment'],
    ['kpi_revenueDelivered', 'src_revenueDelivered'],
  ];
    report.enseigne.divergences = findDivergences(enseigneRows, enseignePairs);
    const eOk = report.enseigne.divergences.length === 0;
    console.log(
      eOk
        ? `  ✓ KpiEnseigne: ${enseigneRows.length} lignes — aucun écart`
        : `  ✗ KpiEnseigne: ${report.enseigne.divergences.length} enseigne(s) avec écarts`,
    );

    // ── KpiRelais ─────────────────────────────────────────────────────────────
    console.log('[kpi-verify] Vérification KpiRelais...');
    const relaisRows = await queryRaw(db, SQL_RELAIS);
  const relaisPairs = [
    ['kpi_handoversCompleted', 'src_handoversCompleted'],
    ['kpi_stockArrival', 'src_stockArrival'],
    ['kpi_commissionsTotal', 'src_commissionsTotal'],
  ];
    report.relais.divergences = findDivergences(relaisRows, relaisPairs);
    const rOk = report.relais.divergences.length === 0;
    console.log(
      rOk
        ? `  ✓ KpiRelais: ${relaisRows.length} lignes — aucun écart`
        : `  ✗ KpiRelais: ${report.relais.divergences.length} relais avec écarts`,
    );

    // ── Synthèse ──────────────────────────────────────────────────────────────
    const total =
      report.transporter.divergences.length +
      report.enseigne.divergences.length +
      report.relais.divergences.length;

    report.summary.ok = total === 0;
    report.summary.totalDivergences = total;

    console.log('\n─────────────────────────────────────────────');
    if (total === 0) {
      console.log('[kpi-verify] ✅ COHERENCE OK — Les KPI sont alignés avec les données sources.');
      console.log('[kpi-verify] Vous pouvez passer EVENT_SYSTEM_PHASE=LIVE.');
    } else {
      console.error(`[kpi-verify] ❌ ${total} ECART(S) DETECTE(S) — NE PAS PASSER EN LIVE avant correction.`);
      console.error('[kpi-verify] Détails:');
      for (const div of report.transporter.divergences) {
        console.error(`  Transporteur ${div.id}:`, JSON.stringify(div.divergences));
      }
      for (const div of report.enseigne.divergences) {
        console.error(`  Enseigne ${div.id}:`, JSON.stringify(div.divergences));
      }
      for (const div of report.relais.divergences) {
        console.error(`  Relais ${div.id}:`, JSON.stringify(div.divergences));
      }
    }

    // Rapport JSON
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[kpi-verify] Rapport sauvegardé → kpi-coherence-report.json`);
    console.log('─────────────────────────────────────────────');

    exitCode = total === 0 ? 0 : 1;
  } finally {
    await db.$disconnect();
  }

  return exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error('[kpi-verify] Erreur fatale:', err);
    process.exitCode = 1;
  });
