import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';

const runGenerate = (args) => spawnSync('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

let result = runGenerate(['prisma', 'generate']);

if (result.status !== 0 && isWindows) {
  if (process.env.PRISMA_ALLOW_NO_ENGINE === 'true') {
    console.warn('[prisma-generate] Native generate failed on Windows, fallback to --no-engine (PRISMA_ALLOW_NO_ENGINE=true).');
    result = runGenerate(['prisma', 'generate', '--no-engine']);
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