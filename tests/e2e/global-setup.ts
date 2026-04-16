import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

/**
 * Fast HTTP prefetch of key routes to trigger Next.js JIT compilation.
 * This is much faster than browser-based warmup and avoids navigation timeouts.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const AUTH_DIR = path.join(__dirname, '.auth');

async function waitForServerReady() {
  console.log(`[global-setup] Waiting for server readiness on ${BASE_URL}...`);
  const start = Date.now();
  const maxMs = 180_000;

  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/csrf`, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        console.log('[global-setup] Server ready.');
        return;
      }
    } catch {
      // retry until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(`[global-setup] Server did not become ready within ${maxMs / 1000}s`);
}

async function requestWithRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLast = i === attempts;
      if (isLast) break;
      console.log(`[global-setup] Retry ${i}/${attempts} for ${label}...`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * i));
    }
  }
  throw lastError;
}

async function apiLoginAndSave(
  email: string,
  password: string,
  dashboardUrl: string,
  waitSelector: string,
  outFile: string,
) {
  console.log(`[global-setup] Logging in ${email} and warming ${dashboardUrl}...`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });

  // CSRF + credentials login via API (page.request = context.request = shared cookie jar)
  const page = await context.newPage();
  const csrfRes = await requestWithRetry(
    () => context.request.get('/api/auth/csrf', { timeout: 120_000 }),
    `csrf for ${email}`
  );
  const csrfData = await csrfRes.json().catch(() => ({}));
  const csrfToken: string = csrfData.csrfToken ?? '';

  await requestWithRetry(
    () => context.request.post('/api/auth/callback/credentials', {
      form: { email, password, csrfToken, callbackUrl: dashboardUrl, json: 'true' },
      timeout: 120_000,
    }),
    `credentials login for ${email}`
  );

  // Poll until session available
  for (let i = 0; i < 20; i++) {
    const s = await context.request.get('/api/auth/session', { timeout: 60_000 });
    const d = await s.json().catch(() => null);
    if (d?.user?.id) break;
    await page.waitForTimeout(1000);
  }

  // Navigate to dashboard to trigger JIT + warm up authenticated page
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  try {
    await page.locator(waitSelector).first().waitFor({ state: 'visible', timeout: 180_000 });
    console.log(`[global-setup]   ✓ ${dashboardUrl} warmed up`);
  } catch {
    console.log(`[global-setup]   ⚠ ${dashboardUrl} warmup selector timed out (continuing)`);
  }

  // Save storage state
  await context.storageState({ path: outFile });
  await browser.close();
  console.log(`[global-setup]   ✓ storageState saved → ${outFile}`);
}

async function quickPrefetch() {
  const routes = ['/api/qr/test'];
  for (const route of routes) {
    try {
      await fetch(`${BASE_URL}${route}`, { signal: AbortSignal.timeout(30_000) });
    } catch { /* ignore */ }
  }
}

export default async function globalSetup() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const seedScript = path.join(repoRoot, 'scripts', 'seed-demo-users.cjs');

  // 1. Seed demo users (idempotent)
  execFileSync('node', [seedScript, '--yes'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  await waitForServerReady();

  // 2. Create .auth dir
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // 3. Login + warm each role (sequentially to avoid overwhelming the dev server)
  await apiLoginAndSave(
    'transport@demo.dz', 'transport123',
    '/fr/dashboard/transporter',
    '[role="tablist"]',
    path.join(AUTH_DIR, 'transporter.json'),
  );

  await apiLoginAndSave(
    'admin@swiftcolis.dz', 'admin123',
    '/fr/dashboard/admin',
    '[role="tablist"]',
    path.join(AUTH_DIR, 'admin.json'),
  );

  await apiLoginAndSave(
    'client@demo.dz', 'client123',
    '/fr/dashboard/client',
    'button[role="combobox"]',
    path.join(AUTH_DIR, 'client.json'),
  );

  // 4. Quick API prefetch for remaining routes
  await quickPrefetch();

  console.log('[global-setup] All storageStates ready. Tests can start.');
}
