import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Root = repo root regardless of cwd (script lives at backend/scripts/).
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..', '..');
const strict = process.argv.includes('--strict');
const fail = [];
const ok = [];
const need = (p, label) => (fs.existsSync(p) ? ok.push(label) : fail.push(`MISSING ${label}: ${p}`));

// Build artifacts
need(path.join(root, 'backend', 'dist', 'index.js'), 'backend/dist');
need(path.join(root, 'backend', 'dist', 'db', 'schema.sql'), 'dist schema.sql');
need(path.join(root, 'frontend', 'dist', 'index.html'), 'frontend/dist (run frontend build)');
// Deploy files
need(path.join(root, 'backend', 'Dockerfile'), 'backend Dockerfile');
need(path.join(root, 'frontend', 'Dockerfile'), 'frontend Dockerfile');
need(path.join(root, 'docker-compose.yml'), 'compose');
need(path.join(root, 'Dockerfile'), 'single-service Dockerfile (Coolify)');
need(path.join(root, 'nginx.conf.sample'), 'nginx sample');
need(path.join(root, '.env.example'), 'root .env.example');
need(path.join(root, 'backend', '.env.production.example'), 'backend prod env template');
need(path.join(root, 'frontend', '.env.production.example'), 'frontend prod env template');
// Portable demo dataset + its compiled prod CLI (dist runner, no tsx in image).
need(path.join(root, 'seed-data.json'), 'seed-data.json (first-boot demo dataset)');
need(path.join(root, 'backend', 'src', 'db', 'seed-file-cli.ts'), 'compiled seed CLI (src/db/seed-file-cli.ts)');
// Hosting hardening: prune + backup cron + email verification
need(path.join(root, 'backend', 'scripts', 'prune-files.mjs'), 'prune-files script');
need(path.join(root, 'backend', 'scripts', 'backup-cron.sh'), 'backup cron script');
need(path.join(root, 'frontend', 'nginx-spa.conf'), 'frontend nginx (SPA)');
// Docker build-context hygiene (api image uses root context -> root .dockerignore gates it)
need(path.join(root, '.dockerignore'), 'root .dockerignore');
need(path.join(root, 'frontend', '.dockerignore'), 'frontend .dockerignore');
need(path.join(root, 'backend', '.dockerignore'), 'backend .dockerignore');
// OpenAPI valid
try {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'openapi.json'), 'utf8'));
  const n = Object.keys(j.paths || {}).length;
  if (n >= 28) ok.push(`openapi paths=${n}`);
  else fail.push(`openapi too few paths (${n}, expected 28+ with verify-email)`);
} catch (e) {
  fail.push('openapi invalid: ' + e.message);
}
// Compose sanity (text checks, no yaml dep)
const compose = fs.existsSync(path.join(root, 'docker-compose.yml'))
  ? fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8') : '';
for (const s of ['context: .', 'dockerfile: ./backend/Dockerfile', 'JWT_SECRET', 'condition: service_healthy', 'api-data']) {
  if (!compose.includes(s)) fail.push(`compose missing: ${s}`);
  else ok.push(`compose has ${s.split(':')[0]}`);
}
// Root .env checks (only --strict or when file exists)
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath) || strict) {
  if (!fs.existsSync(envPath)) fail.push('MISSING root .env (copy from .env.example)');
  else {
    const env = fs.readFileSync(envPath, 'utf8');
    const get = (k) => (env.split('\n').find((l) => l.startsWith(k + '=')) || '').slice(k.length + 1).trim();
    const jwt = get('JWT_SECRET');
    if (!jwt || jwt.includes('change-me') || jwt.length < 48) fail.push('JWT_SECRET weak/missing in root .env');
    else ok.push('JWT_SECRET strong');
    const cors = get('CORS_ORIGIN');
    if (!cors || cors.includes('*')) fail.push('CORS_ORIGIN must be explicit domains');
    else ok.push('CORS_ORIGIN explicit');
    if (!get('VITE_API_URL').startsWith('https://')) fail.push('VITE_API_URL must be https:// in prod');
    else ok.push('VITE_API_URL https');
  }
}

console.log(ok.map((s) => `  ok: ${s}`).join('\n'));
if (fail.length) {
  console.error(fail.map((s) => `  FAIL: ${s}`).join('\n'));
  process.exit(1);
}
console.log(`[check-prod] PASS (${ok.length} checks)`);
