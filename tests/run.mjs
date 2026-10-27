// Runs every *.test.mjs under tests/unit and tests/rules. Explicit file paths work on Node 18+,
// unlike directory or glob arguments to `node --test`, whose behaviour differs between versions.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = ['unit', 'rules'].flatMap((dir) =>
  fs
    .readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith('.test.mjs'))
    .map((f) => path.join(root, dir, f)),
);
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
