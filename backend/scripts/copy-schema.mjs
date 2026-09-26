import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Copies src/db/schema.sql -> dist/db/schema.sql after tsc (tsc doesn't copy .sql).
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src', 'db', 'schema.sql');
const altSrc = path.join(process.cwd(), 'src', 'db', 'schema.sql');
const dest = path.join(process.cwd(), 'dist', 'db', 'schema.sql');

const from = fs.existsSync(src) ? src : altSrc;
if (!fs.existsSync(from)) {
  console.error(`[copy-schema] NOT FOUND: ${from}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(from, dest);
console.log(`[copy-schema] ${from} -> ${dest}`);
