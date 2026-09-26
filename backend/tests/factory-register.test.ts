import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch } from './helpers.js';

const env = isolateTestEnv('factory-register');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const NEW_USER = {
  name: 'Test Factory Owner',
  nameEn: 'Test Factory Owner',
  email: 'owner@newfactory-test.eg',
  password: 'Strong#2026',
  factoryNameAr: 'مصنع الاختبار الجديد',
  factoryNameEn: 'New Test Factory',
  sector: 'الصناعات الهندسية',
  governorate: 'القاهرة',
  phone: '+20 100 000 0001',
};

describe('public factory self-registration + mine (API-only frontend)', () => {
  it('rejects missing fields / bad email / weak password', async () => {
    const m1 = await jfetch(`${base}/factories/register`, { method: 'POST', body: { email: 'x@y.zz' } });
    assert.equal(m1.status, 400);
    const m2 = await jfetch(`${base}/factories/register`, {
      method: 'POST', body: { ...NEW_USER, email: 'not-an-email', password: 'Strong#2026' },
    });
    assert.equal(m2.status, 400);
    const m3 = await jfetch(`${base}/factories/register`, {
      method: 'POST', body: { ...NEW_USER, email: 'weak@newfactory-test.eg', password: 'short' },
    });
    assert.equal(m3.status, 400);
  });

  let token = '';
  let factoryId = '';
  let userId = '';

  it('registers factory + org + owner and auto-logs in (201 + JWT)', async () => {
    const r = await jfetch(`${base}/factories/register`, { method: 'POST', body: NEW_USER });
    assert.equal(r.status, 201);
    const d = r.json.data as {
      user: { id: string; email: string; role: string; factoryId: string; mustChangePassword: boolean };
      organization: { id: string; nameAr: string };
      factory: { id: string; nameAr: string };
      accessToken: string; refreshToken: string;
    };
    assert.equal(d.user.email, NEW_USER.email);
    assert.equal(d.user.role, 'factory_owner');
    assert.ok(d.user.factoryId.length > 0);
    assert.equal(d.factory.nameAr, NEW_USER.factoryNameAr);
    assert.ok(d.accessToken.length > 20 && d.refreshToken.length > 20);
    token = d.accessToken;
    factoryId = d.factory.id;
    userId = d.user.id;
  });

  it('rejects duplicate email', async () => {
    const r = await jfetch(`${base}/factories/register`, { method: 'POST', body: NEW_USER });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'VALIDATION_ERROR');
  });

  it('new owner can login with chosen password + me exposes factoryId', async () => {
    const l = await jfetch(`${base}/auth/login`, {
      method: 'POST', body: { email: NEW_USER.email, password: NEW_USER.password },
    });
    assert.equal(l.status, 200);
    const me = await jfetch(`${base}/users/me`, {
      headers: { Authorization: `Bearer ${(l.json.data as { accessToken: string }).accessToken}` },
    });
    assert.equal(me.status, 200);
    assert.equal((me.json.data as { factoryId: string }).factoryId, factoryId);
  });

  it('GET /factories/mine resolves owner factory (401 without token, 404 without factory)', async () => {
    const anon = await jfetch(`${base}/factories/mine`);
    assert.equal(anon.status, 401);
    const mine = await jfetch(`${base}/factories/mine`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(mine.status, 200);
    assert.equal((mine.json.data as { id: string }).id, factoryId);
    // Admin has no factory -> 404 NO_FACTORY (not 500)
    const adminLogin = await jfetch(`${base}/auth/login`, {
      method: 'POST', body: { email: 'tarek.mansour@industry.gov.eg', password: 'Egypt@2026' },
    });
    assert.equal(adminLogin.status, 200);
    const adminMine = await jfetch(`${base}/factories/mine`, {
      headers: { Authorization: `Bearer ${(adminLogin.json.data as { accessToken: string }).accessToken}` },
    });
    assert.equal(adminMine.status, 404);
    assert.equal(adminMine.json.code, 'NO_FACTORY');
    void userId;
  });

  it('GET /factories directory is privileged (admin 200, factory 403, guest 401)', async () => {
    const guest = await jfetch(`${base}/factories`);
    assert.equal(guest.status, 401);
    const adminLogin = await jfetch(`${base}/auth/login`, {
      method: 'POST', body: { email: 'tarek.mansour@industry.gov.eg', password: 'Egypt@2026' },
    });
    assert.equal(adminLogin.status, 200);
    const adminList = await jfetch(`${base}/factories?pageSize=10`, {
      headers: { Authorization: `Bearer ${(adminLogin.json.data as { accessToken: string }).accessToken}` },
    });
    assert.equal(adminList.status, 200);
    assert.ok(((adminList.json.data as unknown[]) ?? []).length >= 3);
    const fac = await jfetch(`${base}/factories`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(fac.status, 403);
  });
});
