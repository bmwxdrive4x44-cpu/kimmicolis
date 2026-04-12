import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { Socket } from 'node:net';
import { PrismaClient } from '@/generated/prisma';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = ['cdg1', 'fra1'];

async function testTcp(host: string, port: number, timeoutMs = 4000) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = new Socket();
    let done = false;

    const finish = (result: { ok: boolean; error?: string }) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish({ ok: true }));
    socket.on('timeout', () => finish({ ok: false, error: 'TCP_TIMEOUT' }));
    socket.on('error', (err) => finish({ ok: false, error: err.message }));
    socket.connect(port, host);
  });
}

async function probePrisma(url: string | null | undefined) {
  if (!url) {
    return { ok: false, error: 'URL_NOT_SET' };
  }

  const client = new PrismaClient({
    datasources: {
      db: { url },
    },
  });

  try {
    await client.$queryRaw`SELECT 1 AS ok`;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await client.$disconnect();
  }
}

// Temporary diagnostic endpoint — REMOVE after debugging
// GET /api/health
export async function GET() {
  const parsed = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  const parsedDirect = process.env.DIRECT_DATABASE_URL ? new URL(process.env.DIRECT_DATABASE_URL) : null;
  const dbUrlPartial = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@').substring(0, 80)
    : '(not set)';
  const directDbUrlPartial = process.env.DIRECT_DATABASE_URL
    ? process.env.DIRECT_DATABASE_URL.replace(/:([^:@]+)@/, ':***@').substring(0, 80)
    : '(not set)';

  const host = parsed?.hostname ?? null;
  const port = parsed?.port ? Number(parsed.port) : 5432;
  const dnsProbe = host ? await lookup(host).then((res) => ({ ok: true, address: res.address, family: res.family })).catch((err: unknown) => ({ ok: false, error: err instanceof Error ? err.message : String(err) })) : null;
  const tcpProbe = host ? await testTcp(host, port) : null;
  const directHost = parsedDirect?.hostname ?? null;
  const directPort = parsedDirect?.port ? Number(parsedDirect.port) : 5432;
  const directDnsProbe = directHost ? await lookup(directHost).then((res) => ({ ok: true, address: res.address, family: res.family })).catch((err: unknown) => ({ ok: false, error: err instanceof Error ? err.message : String(err) })) : null;
  const directTcpProbe = directHost ? await testTcp(directHost, directPort) : null;
  const prismaPoolerProbe = await probePrisma(process.env.DATABASE_URL);
  const prismaDirectProbe = await probePrisma(process.env.DIRECT_DATABASE_URL);

  try {
    await db.$queryRaw`SELECT 1 AS ok`;
    return NextResponse.json({
      db: 'ok',
      url: dbUrlPartial,
      directUrl: directDbUrlPartial,
      host,
      port,
      dnsProbe,
      tcpProbe,
      directHost,
      directPort,
      directDnsProbe,
      directTcpProbe,
      prismaPoolerProbe,
      prismaDirectProbe,
      node: process.env.NODE_ENV,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        db: 'error',
        url: dbUrlPartial,
        directUrl: directDbUrlPartial,
        host,
        port,
        dnsProbe,
        tcpProbe,
        directHost,
        directPort,
        directDnsProbe,
        directTcpProbe,
        prismaPoolerProbe,
        prismaDirectProbe,
        error: message,
        node: process.env.NODE_ENV,
      },
      { status: 500 }
    );
  }
}
