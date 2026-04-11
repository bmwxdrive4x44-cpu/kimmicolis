const { PrismaClient } = require('../src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  try {
    const row = await prisma.colis.findFirst({
      select: {
        id: true,
        recipientEmail: true,
      },
    });

    console.log(JSON.stringify({ ok: true, row }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
