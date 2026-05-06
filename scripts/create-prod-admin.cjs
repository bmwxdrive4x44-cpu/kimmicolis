/**
 * create-prod-admin.cjs
 * Crée ou remet à jour UN compte ADMIN en production sans toucher au reste.
 *
 * Usage :
 *   DATABASE_URL="postgres://..." ADMIN_EMAIL="ton@email.com" ADMIN_PASSWORD="motDePasse" \
 *     node scripts/create-prod-admin.cjs --yes --allow-remote
 *
 * Variables d'environnement :
 *   DATABASE_URL     — URL Postgres (POSTGRES_PRISMA_URL sur Vercel)
 *   ADMIN_EMAIL      — email du compte admin à créer (défaut : admin@swiftcolis.dz)
 *   ADMIN_PASSWORD   — mot de passe en clair (sera haché bcrypt)
 *   ADMIN_NAME       — nom affiché (défaut : Admin)
 */

'use strict';

const { PrismaClient } = require('../src/generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    yes: args.has('--yes'),
    allowRemote: args.has('--allow-remote'),
  };
}

function isLocalDatabaseUrl(url) {
  if (!url) return false;
  return /localhost|127\.0\.0\.1/i.test(url);
}

async function main() {
  const { yes, allowRemote } = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL || '';

  if (!yes) {
    console.error('⛔  Refus : lancez avec --yes pour confirmer.');
    process.exit(1);
  }

  if (!allowRemote && !isLocalDatabaseUrl(databaseUrl)) {
    console.error('⛔  Refus : base distante détectée. Ajoutez --allow-remote pour continuer.');
    process.exit(1);
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@swiftcolis.dz').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Admin').trim();

  if (!password || password.length < 8) {
    console.error('⛔  ADMIN_PASSWORD absent ou trop court (minimum 8 caractères).');
    process.exit(1);
  }

  console.log(`\n🔧  Création / mise à jour du compte admin : ${email}`);

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: 'ADMIN',
      isActive: true,
      password: hashedPassword,
    },
    create: {
      email,
      name,
      role: 'ADMIN',
      isActive: true,
      password: hashedPassword,
    },
    select: { id: true, email: true, role: true, name: true },
  });

  console.log(`✅  Compte admin prêt :`);
  console.log(`    ID    : ${user.id}`);
  console.log(`    Email : ${user.email}`);
  console.log(`    Nom   : ${user.name}`);
  console.log(`    Rôle  : ${user.role}`);
  console.log('\n⚠️   Changez le mot de passe dès la première connexion.\n');
}

main()
  .catch((e) => {
    console.error('❌  Erreur :', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
