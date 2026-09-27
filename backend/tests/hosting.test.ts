import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { isolateTestEnv, startServer, H, ROOT } from './helpers.js';

async function waitFor(url: string, timeoutMs = 15000): Promise<Response> {
  const start = Date.now();
  let last: unknown = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      return r;
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 250)); }
  }
  throw new Error('server did not start: ' + String(last));
}

describe('hosting readiness (deploy gate)', () => {
  it('build artifacts exist (backend dist + schema + frontend dist)', () => {
    assert.ok(fs.existsSync(`${ROOT}/backend/dist/index.js`), 'backend dist missing — run npm run build');
    assert.ok(fs.existsSync(`${ROOT}/backend/dist/db/schema.sql`), 'dist schema.sql missing — copy-schema broken');
    assert.ok(fs.existsSync(`${ROOT}/frontend/dist/index.html`), 'frontend dist missing — run frontend build');
  });

  it('deploy files exist with required content', () => {
    const compose = fs.readFileSync(`${ROOT}/docker-compose.yml`, 'utf8');
    for (const s of ['context: .', 'dockerfile: ./backend/Dockerfile', 'JWT_SECRET', 'condition: service_healthy', 'api-data', 'frontend:', 'nginx:']) {
      assert.ok(compose.includes(s), `compose missing: ${s}`);
    }
    const nginx = fs.readFileSync(`${ROOT}/nginx.conf.sample`, 'utf8');
    for (const s of ['api.industry.gov.eg', 'client_max_body_size 105m', 'acme-challenge', '301 https']) {
      assert.ok(nginx.includes(s), `nginx sample missing: ${s}`);
    }
    const bDocker = fs.readFileSync(`${ROOT}/backend/Dockerfile`, 'utf8');
    assert.ok(bDocker.includes('COPY contracts'), 'backend image must ship contracts/openapi.json');
    const fDocker = fs.readFileSync(`${ROOT}/frontend/Dockerfile`, 'utf8');
    assert.ok(fDocker.includes('VITE_API_URL'), 'frontend image must bake VITE_API_URL');
    // frontend/src/api/schemas.ts re-exports ../../../contracts — a frontend-only build context fails tsc.
    assert.ok(fs.readFileSync(`${ROOT}/frontend/src/api/schemas.ts`, 'utf8').includes('contracts/api.contracts'));
    assert.ok(fDocker.includes('COPY contracts /app/contracts'), 'frontend image must ship contracts next to frontend/');
    assert.ok(compose.includes('dockerfile: ./frontend/Dockerfile'), 'compose frontend must build from repo root');
    for (const f of [`${ROOT}/.env.example`, `${ROOT}/backend/.env.production.example`, `${ROOT}/frontend/.env.production.example`, `${ROOT}/docs/DEPLOY.md`]) {
      assert.ok(fs.existsSync(f), `missing ${f}`);
    }
    const rootEnv = fs.readFileSync(`${ROOT}/.env.example`, 'utf8');
    assert.ok(rootEnv.includes('JWT_SECRET') && rootEnv.includes('CORS_ORIGIN') && rootEnv.includes('VITE_API_URL'));
    // HOSTING: build-context hygiene — api + single-service images use root context, so ROOT
    // .dockerignore is the gate that keeps node_modules/secrets/live DB out of the daemon context.
    for (const di of ['.dockerignore', 'frontend/.dockerignore', 'backend/.dockerignore']) {
      assert.ok(fs.existsSync(`${ROOT}/${di}`), `missing ${di}`);
    }
    const dRoot = fs.readFileSync(`${ROOT}/.dockerignore`, 'utf8').split(/\r?\n/);
    for (const s of ['**/node_modules', '**/dist', '**/.env', '**/.env.*', 'data', 'backend/data', '**/*.db']) {
      assert.ok(dRoot.includes(s), `root .dockerignore missing: ${s}`);
    }
    // Single-service image (Coolify): SPA built same-origin + served by the API, data on /data.
    const sDocker = fs.readFileSync(`${ROOT}/Dockerfile`, 'utf8');
    for (const s of ['VITE_SAME_ORIGIN=1', 'SERVE_FRONTEND=1', 'FRONTEND_DIST=/app/public', 'DB_PATH=/data/app.db', 'COPY contracts ./contracts', 'COPY contracts /build/contracts', 'HEALTHCHECK']) {
      assert.ok(sDocker.includes(s), `single-service Dockerfile missing: ${s}`);
    }
    const dFront = fs.readFileSync(`${ROOT}/frontend/.dockerignore`, 'utf8');
    for (const s of ['node_modules', 'dist', '.env']) {
      assert.ok(dFront.includes(s), `frontend .dockerignore missing: ${s}`);
    }
  });

  it('check-prod gate passes', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);
    const { stdout } = await run(process.execPath, ['scripts/check-prod.mjs'], { cwd: `${ROOT}/backend` });
    assert.match(stdout, /\[check-prod\] PASS/);
  });

  it('prod boot refuses weak JWT_SECRET (fail fast)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-refuse-'));
    const child: ChildProcess = spawn(process.execPath, ['dist/index.js'], {
      cwd: `${ROOT}/backend`,
      env: {
        ...process.env, NODE_ENV: 'production', PORT: '4131',
        DB_PATH: path.join(dir, 'app.db'), UPLOAD_DIR: path.join(dir, 'up'),
        CORS_ORIGIN: 'https://industry.gov.eg', JWT_SECRET: 'dev-only-insecure-secret-change-me',
        SEED_ON_BOOT: '0', ALLOW_DEMO_AUTH: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout?.on('data', (d) => { out += String(d); });
    child.stderr?.on('data', (d) => { out += String(d); });
    const code: number = await new Promise((resolve) => {
      const t = setTimeout(() => { try { child.kill(); } catch { /* noop */ } resolve(-1); }, 12000);
      child.on('exit', (c) => { clearTimeout(t); resolve(c ?? -1); });
    });
    try { child.kill(); } catch { /* noop */ }
    fs.rmSync(dir, { recursive: true, force: true });
    assert.notEqual(code, 0, 'prod with weak secret must not boot cleanly');
    assert.match(out, /JWT_SECRET/, 'refusal must mention JWT_SECRET');
  });

  it('prod behind proxy (TRUST_PROXY=1): rate limit keys X-Forwarded-For, demo auth stays blocked', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-proxy-'));
    const child: ChildProcess = spawn(process.execPath, ['dist/index.js'], {
      cwd: `${ROOT}/backend`,
      env: {
        ...process.env, NODE_ENV: 'production', PORT: '4133',
        DB_PATH: path.join(dir, 'app.db'), UPLOAD_DIR: path.join(dir, 'up'),
        CORS_ORIGIN: 'https://industry.gov.eg', JWT_SECRET: 'b'.repeat(64),
        SEED_ON_BOOT: '1', ALLOW_DEMO_AUTH: '0', TRUST_PROXY: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const health = await waitFor('http://127.0.0.1:4133/api/v1/health');
      assert.equal(health.status, 200);
      // Demo switch-user blocked in prod even through proxy
      const sw = await fetch('http://127.0.0.1:4133/api/v1/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
        body: JSON.stringify({ userId: 'user-admin' }),
      });
      assert.equal(sw.status, 401);
      // 50 wrong-password logins from ONE forwarded IP (authLimiter max=50/15m) -> 429
      const login = 'http://127.0.0.1:4133/api/v1/auth/login';
      const badCreds = { email: 'admin@example.com', password: 'wrong-password' };
      let last = 0;
      let limited = false;
      for (let i = 0; i <= 60; i++) {
        const r = await fetch(login, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '5.6.7.8' },
          body: JSON.stringify(badCreds),
        });
        last = r.status;
        if (r.status === 429 || r.status === 423) { limited = true; break; }
      }
      assert.ok(limited, `expected 429/423 after 50 attempts from same forwarded IP, last=${last}`);
      // A DIFFERENT forwarded IP with a different email is NOT limited -> proves keying by XFF, not by socket addr
      // (same email would be 423 due to per-account lockout, so use other email)
      const other = await fetch(login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '9.9.9.9' },
        body: JSON.stringify({ email: 'other-unique@example.com', password: 'wrong-password' }),
      });
      assert.equal(other.status, 401, 'different forwarded IP with fresh email must not be rate limited');
    } finally {
      try { child.kill(); } catch { /* noop */ }
      await new Promise((r) => setTimeout(r, 300));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prod boot with strong secrets serves health + security headers', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-ok-'));
    const secret = 'a'.repeat(64);
    const child: ChildProcess = spawn(process.execPath, ['dist/index.js'], {
      cwd: `${ROOT}/backend`,
      env: {
        ...process.env, NODE_ENV: 'production', PORT: '4132',
        DB_PATH: path.join(dir, 'app.db'), UPLOAD_DIR: path.join(dir, 'up'),
        CORS_ORIGIN: 'https://industry.gov.eg', JWT_SECRET: secret,
        SEED_ON_BOOT: '1', ALLOW_DEMO_AUTH: '0', TRUST_PROXY: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const res = await waitFor('http://127.0.0.1:4132/api/v1/health');
      assert.equal(res.status, 200);
      const j = await res.json() as { status: string };
      assert.equal(j.status, 'ok');
      // Helmet: no x-powered-by, has nosniff + HSTS in prod
      assert.equal(res.headers.get('x-powered-by'), null);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      const hsts = res.headers.get('strict-transport-security') ?? '';
      assert.ok(hsts.includes('max-age=31536000'), `HSTS missing in prod: ${hsts}`);
      // Demo auth disabled in prod
      const sw = await fetch('http://127.0.0.1:4132/api/v1/auth/switch-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'user-admin' }),
      });
      assert.equal(sw.status, 401);
      const unauth = await fetch('http://127.0.0.1:4132/api/v1/initiatives?page=1');
      assert.equal(unauth.status, 200);
      const denyWrite = await fetch('http://127.0.0.1:4132/api/v1/initiatives', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      assert.equal(denyWrite.status, 401);
    } finally {
      try { child.kill(); } catch { /* noop */ }
      await new Promise((r) => setTimeout(r, 300));
      fs.rmSync(dir, { recursive: true, force: true });
    }
    void H;
  });
});

describe('single-service SPA mode (SERVE_FRONTEND)', () => {
  const env = isolateTestEnv('spa');
  let srv: { base: string; close: () => Promise<void> } | null = null;
  before(async () => {
    process.env.SERVE_FRONTEND = '1';
    process.env.FRONTEND_DIST = `${ROOT}/frontend/dist`;
    const s = await startServer();
    srv = s;
  });
  after(async () => {
    delete process.env.SERVE_FRONTEND;
    delete process.env.FRONTEND_DIST;
    if (srv) await srv.close();
    await env.cleanup();
  });

  it('serves frontend index.html for non-API routes', async () => {
    const port = new URL(srv!.base).port;
    const res = await fetch(`http://127.0.0.1:${port}/showcase`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('<div id="root"') || html.includes('id="root"'), 'SPA fallback must serve index.html');
  });

  it('serves the SPA (not the API info JSON) at the site root', async () => {
    const port = new URL(srv!.base).port;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    assert.ok((await res.text()).includes('id="root"'), '/ must serve index.html in SPA mode');
  });
});
