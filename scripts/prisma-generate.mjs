import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';

const runGenerate = (args) => spawnSync('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

let result = runGenerate(['prisma', 'generate']);

if (result.status !== 0 && isWindows) {
  console.warn('[prisma-generate] Native generate failed on Windows, fallback to --no-engine.');
  result = runGenerate(['prisma', 'generate', '--no-engine']);
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);