import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { Socket } from 'node:net';
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

// Temporary diagnostic endpoint — REMOVE after debugging
// GET /api/health
export async function GET() {
  const parsed = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  const dbUrlPartial = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@').substring(0, 80)
    : '(not set)';

  const host = parsed?.hostname ?? null;
  const port = parsed?.port ? Number(parsed.port) : 5432;
  const dnsProbe = host ? await lookup(host).then((res) => ({ ok: true, address: res.address, family: res.family })).catch((err: unknown) => ({ ok: false, error: err instanceof Error ? err.message : String(err) })) : null;
  const tcpProbe = host ? await testTcp(host, port) : null;

  try {
    await db.$queryRaw`SELECT 1 AS ok`;
    return NextResponse.json({
      db: 'ok',
      url: dbUrlPartial,
      host,
      port,
      dnsProbe,
      tcpProbe,
      node: process.env.NODE_ENV,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        db: 'error',
        url: dbUrlPartial,
        host,
        port,
        dnsProbe,
        tcpProbe,
        error: message,
        node: process.env.NODE_ENV,
      },
      { status: 500 }
    );
  }
}
