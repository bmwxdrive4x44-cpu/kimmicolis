import { readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

const cwd = process.cwd();
const ignoredDirs = new Set(['node_modules', '.git', '.next']);

function collectMiddlewareFiles(dirPath, found = []) {
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      collectMiddlewareFiles(fullPath, found);
      continue;
    }

    if (entry.isFile() && basename(fullPath) === 'middleware.ts') {
      found.push(fullPath);
    }
  }

  return found;
}

const candidates = collectMiddlewareFiles(cwd);

if (candidates.length === 0) {
  console.log('[build-guard] No residual middleware.ts found.');
} else {
  for (const filePath of candidates) {
    rmSync(filePath, { force: true });
    console.log(`[build-guard] Removed residual middleware file: ${filePath}`);
  }
}
