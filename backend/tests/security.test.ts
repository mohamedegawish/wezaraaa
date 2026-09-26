import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('security');
let base = '';
let uploadDir = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
  uploadDir = env.uploadDir;
});
after(async () => { await close(); await env.cleanup(); });

const ADMIN = 'user-admin';
const FACTORY = 'user-factory-1';

describe('security hardening (PROD FIX)', () => {
  it('GET /users forbidden for factory, allowed for admin', async () => {
    const denied = await jfetch(`${base}/users?page=1`, { headers: H(FACTORY) });
    assert.equal(denied.status, 403);
    const ok = await jfetch(`${base}/users?page=1`, { headers: H(ADMIN) });
    assert.equal(ok.status, 200);
  });

  it('dashboard/audit forbidden for factory', async () => {
    assert.equal((await jfetch(`${base}/dashboard/summary`, { headers: H(FACTORY) })).status, 403);
    assert.equal((await jfetch(`${base}/audit-logs`, { headers: H(FACTORY) })).status, 403);
    assert.equal((await jfetch(`${base}/dashboard/summary`, { headers: H(ADMIN) })).status, 200);
  });

  it('PUT /factories rejects mass-assignment junk', async () => {
    const r = await jfetch(`${base}/factories/factory-1`, {
      method: 'PUT', headers: H(ADMIN), body: { evilField: 'x', anotherBad: 1 },
    });
    assert.equal(r.status, 400);
  });

  it('PUT /factories accepts whitelisted fields', async () => {
    const r = await jfetch(`${base}/factories/factory-1`, {
      method: 'PUT', headers: H(ADMIN), body: { governorate: 'القاهرة' },
    });
    assert.equal(r.status, 200);
  });

  it('upload rejects fake PDF (extension ok, content not PDF)', async () => {
    const fd = new FormData();
    fd.append('file', new Blob(['MZ fake exe content'], { type: 'application/pdf' }), 'evil.pdf');
    const res = await fetch(`${base}/factories/factory-1/details-files`, {
      method: 'POST', headers: { 'x-user-id': ADMIN }, body: fd,
    });
    assert.equal(res.status, 400);
    const j = await res.json() as { code: string };
    assert.equal(j.code, 'INVALID_FILE_TYPE');
  });

  it('upload accepts real PDF and hides storedPath', async () => {
    const pdf = new Blob(['%PDF-1.4 fake-id-test'], { type: 'application/pdf' });
    const fd = new FormData();
    fd.append('file', pdf, 'real.pdf');
    fd.append('description', 'test');
    const res = await fetch(`${base}/factories/factory-1/details-files`, {
      method: 'POST', headers: { 'x-user-id': ADMIN }, body: fd,
    });
    assert.equal(res.status, 201);
    const j = await res.json() as { data: Record<string, unknown> };
    assert.ok(!('storedPath' in (j.data as object)), 'storedPath leaked in upload response');
    const list = await jfetch(`${base}/factories/factory-1/details-files`, { headers: H(ADMIN) });
    const arr = (list.json.data as Record<string, unknown>[]);
    for (const f of arr) assert.ok(!('storedPath' in f), 'storedPath leaked in list');
    void uploadDir;
  });

  it('PUT/DELETE /users/:id work (contract completion)', async () => {
    const c = await jfetch(`${base}/users`, {
      method: 'POST', headers: H(ADMIN),
      body: { name: 'ت', nameEn: 'T', email: `t-${Date.now()}@x.eg`, role: 'auditor', organizationId: 'org-ministry' },
    });
    assert.equal(c.status, 201);
    const id = (c.json.data as { id: string }).id;
    const u = await jfetch(`${base}/users/${id}`, { method: 'PUT', headers: H(ADMIN), body: { name: 'تم' } });
    assert.equal(u.status, 200);
    const d = await jfetch(`${base}/users/${id}`, { method: 'DELETE', headers: H(ADMIN) });
    assert.equal(d.status, 200);
  });

  it('cannot delete self', async () => {
    const r = await jfetch(`${base}/users/${ADMIN}`, { method: 'DELETE', headers: H(ADMIN) });
    assert.equal(r.status, 400);
  });
});
