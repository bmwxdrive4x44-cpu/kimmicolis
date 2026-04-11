import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const MAX_WINDOWS_RETRIES = 3;
const WINDOWS_RETRY_DELAY_MS = 1500;
const WINDOWS_ENGINE_PATH = join(process.cwd(), 'src', 'generated', 'prisma', 'query-engine-windows.exe');

const runGenerate = (args) => {
  const result = spawnSync('npx', args, {
    shell: true,
    env: process.env,
    encoding: 'utf8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
};

const wait = (ms) => {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
};

const isWindowsLockError = (result) => {
  if (!isWindows) {
    return false;
  }

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toLowerCase();
  const referencesPrismaEngine = output.includes('query_engine-windows.dll.node') ||
    output.includes('query-engine-windows.exe') ||
    output.includes('query-engine-windows.exe.tmp');

  return referencesPrismaEngine && (
    output.includes('eperm') ||
    output.includes('ebusy') ||
    output.includes('access is denied') ||
    output.includes('being used by another process')
  );
};

const canReuseExistingWindowsEngine = (result) => {
  return isWindowsLockError(result) && existsSync(WINDOWS_ENGINE_PATH);
};

const runWithWindowsRetry = (args) => {
  let attempt = 0;
  let result = runGenerate(args);

  while (attempt < MAX_WINDOWS_RETRIES && result.status !== 0 && isWindowsLockError(result)) {
    attempt += 1;
    console.warn(`[prisma-generate] Windows lock detected, retry ${attempt}/${MAX_WINDOWS_RETRIES} in ${WINDOWS_RETRY_DELAY_MS}ms.`);
    wait(WINDOWS_RETRY_DELAY_MS);
    result = runGenerate(args);
  }

  return result;
};

let result = runWithWindowsRetry(['prisma', 'generate']);

if (result.status !== 0 && isWindows) {
  if (canReuseExistingWindowsEngine(result)) {
    console.warn('[prisma-generate] Windows engine rename is locked, reusing existing query-engine-windows.exe.');
    process.exit(0);
  }

  if (process.env.PRISMA_ALLOW_NO_ENGINE === 'true') {
    console.warn('[prisma-generate] Native generate failed on Windows, fallback to --no-engine (PRISMA_ALLOW_NO_ENGINE=true).');
    result = runWithWindowsRetry(['prisma', 'generate', '--no-engine']);
  } else {
    console.error('[prisma-generate] Native generate failed on Windows.');
    console.error('[prisma-generate] Aborting to avoid generating a no-engine client that can break local DB runtime.');
    console.error('[prisma-generate] Fix suggestion: close Node processes locking Prisma DLL, then rerun `npx prisma generate`.');
    process.exit(result.status ?? 1);
  }
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);