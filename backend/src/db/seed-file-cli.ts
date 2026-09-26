// Compiled seed-file CLI (dist/db/seed-file-cli.js) — runs with plain node inside
// the production image (no tsx there). Dev equivalent: npm run seed:file.
// Usage: node dist/db/seed-file-cli.js [/path/to/seed-data.json] [--force-apps]
// REFUSES production unless CONFIRM=YES.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFromFile } from './seedFromFile.js';
import { closeDb } from './sqlite.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--')) ?? path.join(here, '..', '..', 'seed-data.json');

if ((process.env.NODE_ENV ?? 'development') === 'production' && process.env.CONFIRM !== 'YES') {
  console.error('[seed:file] REFUSED in production without CONFIRM=YES');
  process.exit(1);
}
try {
  const r = seedFromFile(file, { forceApps: args.includes('--force-apps') });
  console.log(`[seed:file] orgs=${r.orgs} users=${r.users} factories=${r.factories} initiatives=${r.initiatives} applications=${r.applications} (created=${r.appsCreated}${r.skipped ? ', apps skipped - already seeded' : ''})`);
  for (const a of r.apps) console.log(`  app ${a.ref}: ${a.id} [${a.status}]`);
  closeDb();
} catch (e) {
  console.error('[seed:file] FAILED:', (e as Error).message);
  try { closeDb(); } catch { /* noop */ }
  process.exit(1);
}
