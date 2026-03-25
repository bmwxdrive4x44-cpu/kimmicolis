const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

(async () => {
  const total = await db.ligne.count();
  const rows = await db.ligne.findMany({
    select: { villeDepart: true, villeArrivee: true },
  });

  const uniquePairs = new Set(
    rows.map((r) => [r.villeDepart, r.villeArrivee].sort().join('__'))
  );

  console.log(
    JSON.stringify(
      {
        total,
        uniquePairs: uniquePairs.size,
        duplicates: total - uniquePairs.size,
      },
      null,
      2
    )
  );

  await db.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
