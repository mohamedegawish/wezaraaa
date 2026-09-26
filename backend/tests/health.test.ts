import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('health');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

describe('health + boot (PROD FIX 0.1/0.6)', () => {
  it('GET /health returns ok with db+uploads checks', async () => {
    const r = await jfetch(`${base}/health`);
    assert.equal(r.status, 200);
    assert.equal(r.json.status, 'ok');
    const checks = r.json.checks as Record<string, string>;
    assert.equal(checks.db, 'ok');
    assert.equal(checks.uploads, 'ok');
  });

  it('unknown route returns unified NOT_FOUND ApiError', async () => {
    const r = await jfetch(`${base}/nope`, { headers: H('user-admin') });
    assert.equal(r.status, 404);
    assert.equal(r.json.code, 'NOT_FOUND');
    assert.ok(typeof r.json.messageAr === 'string');
  });

  it('missing auth header returns 401 UNAUTHORIZED on protected routes', async () => {
    const r = await jfetch(`${base}/users/me`);
    assert.equal(r.status, 401);
    assert.equal(r.json.code, 'UNAUTHORIZED');
  });

  it('public showcase reads need no auth (API-only frontend guests)', async () => {
    const list = await jfetch(`${base}/initiatives?page=1&pageSize=5`);
    assert.equal(list.status, 200);
    assert.ok((list.json.data as unknown[]).length > 0);
    const full = await jfetch(`${base}/initiatives?full=1&pageSize=5`);
    assert.equal(full.status, 200);
    const first = (full.json.data as Array<{ workflow?: { stages?: unknown[] }; customization?: unknown }>)[0];
    assert.ok(Array.isArray(first.workflow?.stages), 'full=1 must embed workflow stages');
    assert.ok(first.customization && typeof first.customization === 'object', 'full=1 must embed customization');
    const one = await jfetch(`${base}/initiatives/init-solar-2026`);
    assert.equal(one.status, 200);
  });
});
