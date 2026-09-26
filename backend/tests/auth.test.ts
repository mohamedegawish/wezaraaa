import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('auth');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const EMAIL = 'tarek.mansour@industry.gov.eg';
const PASS = 'Egypt@2026';
let access = '';
let refresh = '';

describe('JWT auth (PROD FIX)', () => {
  it('login rejects wrong password', async () => {
    const r = await jfetch(`${base}/auth/login`, { method: 'POST', body: { email: EMAIL, password: 'wrong-pass-123' } });
    assert.equal(r.status, 401);
    assert.equal(r.json.code, 'INVALID_CREDENTIALS');
  });

  it('login validates required fields', async () => {
    const r = await jfetch(`${base}/auth/login`, { method: 'POST', body: { email: '' } });
    assert.equal(r.status, 400);
  });

  it('login succeeds with seeded password', async () => {
    const r = await jfetch(`${base}/auth/login`, { method: 'POST', body: { email: EMAIL, password: PASS } });
    assert.equal(r.status, 200);
    const d = r.json.data as { accessToken: string; refreshToken: string; user: { id: string } };
    assert.ok(d.accessToken.length > 20);
    assert.ok(d.refreshToken.length > 20);
    access = d.accessToken;
    refresh = d.refreshToken;
  });

  it('Bearer token grants access to protected route', async () => {
    const res = await fetch(`${base}/users/me`, { headers: { Authorization: `Bearer ${access}` } });
    assert.equal(res.status, 200);
    const j = await res.json() as { data: { id: string } };
    assert.equal(j.data.id, 'user-admin');
  });

  it('invalid Bearer rejected', async () => {
    const res = await fetch(`${base}/users/me`, { headers: { Authorization: 'Bearer broken.token.here' } });
    assert.equal(res.status, 401);
  });

  it('JWT works for RBAC-protected dashboard', async () => {
    const res = await fetch(`${base}/dashboard/summary`, { headers: { Authorization: `Bearer ${access}` } });
    assert.equal(res.status, 200);
  });

  it('refresh rotates pair', async () => {
    const r = await jfetch(`${base}/auth/refresh`, { method: 'POST', body: { refreshToken: refresh } });
    assert.equal(r.status, 200);
    const d = r.json.data as { accessToken: string; refreshToken: string };
    assert.ok(d.accessToken.length > 20);
    // old refresh must be revoked
    const reuse = await jfetch(`${base}/auth/refresh`, { method: 'POST', body: { refreshToken: refresh } });
    assert.equal(reuse.status, 401);
    access = d.accessToken;
    refresh = d.refreshToken;
  });

  it('logout revokes refresh', async () => {
    const out = await jfetch(`${base}/auth/logout`, { method: 'POST', body: { refreshToken: refresh } });
    assert.equal(out.status, 200);
    const again = await jfetch(`${base}/auth/refresh`, { method: 'POST', body: { refreshToken: refresh } });
    assert.equal(again.status, 401);
  });

  it('change-password enforces min 8 + current check', async () => {
    // login again for fresh tokens
    const l = await jfetch(`${base}/auth/login`, { method: 'POST', body: { email: EMAIL, password: PASS } });
    const a = (l.json.data as { accessToken: string }).accessToken;
    const short = await fetch(`${base}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a}` },
      body: JSON.stringify({ currentPassword: PASS, newPassword: 'short' }),
    });
    assert.equal(short.status, 400);
    const wrong = await fetch(`${base}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a}` },
      body: JSON.stringify({ currentPassword: 'bad-current-123', newPassword: 'NewStrong-12345' }),
    });
    assert.equal(wrong.status, 401);
    const ok = await fetch(`${base}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a}` },
      body: JSON.stringify({ currentPassword: PASS, newPassword: 'NewStrong-12345' }),
    });
    assert.equal(ok.status, 200);
    // new password works, old does not
    const withNew = await jfetch(`${base}/auth/login`, { method: 'POST', body: { email: EMAIL, password: 'NewStrong-12345' } });
    assert.equal(withNew.status, 200);
    const withOld = await jfetch(`${base}/auth/login`, { method: 'POST', body: { email: EMAIL, password: PASS } });
    assert.equal(withOld.status, 401);
  });

  it('demo x-user-id still works in test env (backward compat)', async () => {
    const r = await jfetch(`${base}/initiatives?page=1`, { headers: H('user-admin') });
    assert.equal(r.status, 200);
  });
});
