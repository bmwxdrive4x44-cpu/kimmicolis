import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();

const candidates = [
  join(cwd, 'middleware.ts'),
  join(cwd, 'src', 'middleware.ts'),
  join(cwd, 'src', 'src', 'middleware.ts'),
];

let removed = 0;
for (const filePath of candidates) {
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
    removed += 1;
    console.log(`[build-guard] Removed residual middleware file: ${filePath}`);
  }
}

if (removed === 0) {
  console.log('[build-guard] No residual middleware.ts found.');
}
