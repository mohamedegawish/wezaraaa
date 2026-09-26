import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('authz-ownership');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

// Seeded links (seed.ts backfill): user-factory-sewedy -> factory-sewedy, user-factory-1 -> factory-1
describe('P0-SEC ownership isolation (factories + applications)', () => {
  it('factory owner reads own factory but NOT another factory', async () => {
    const own = await jfetch(`${base}/factories/factory-sewedy`, { headers: H('user-factory-sewedy') });
    assert.equal(own.status, 200);
    const other = await jfetch(`${base}/factories/factory-1`, { headers: H('user-factory-sewedy') });
    assert.equal(other.status, 403);
    assert.equal(other.json.code, 'FORBIDDEN');
  });

  it('admin still reads any factory', async () => {
    const r = await jfetch(`${base}/factories/factory-1`, { headers: H('user-admin') });
    assert.equal(r.status, 200);
  });

  it('factory owner cannot edit another factory', async () => {
    const r = await jfetch(`${base}/factories/factory-1`, {
      method: 'PUT', headers: H('user-factory-sewedy'), body: { employeesCount: 999 },
    });
    assert.equal(r.status, 403);
  });

  it('factory owner cannot submit an application for another factory', async () => {
    const r = await jfetch(`${base}/applications`, {
      method: 'POST', headers: H('user-factory-sewedy'),
      body: { initiativeId: 'init-solar-2026', factoryId: 'factory-1', formData: { requestedCapacityKW: 100 } },
    });
    assert.equal(r.status, 403);
  });

  it('factory owner lists only own applications and cannot read another factory application', async () => {
    // Admin creates one app for factory-1 (allowed — admin acts on behalf)
    const created = await jfetch(`${base}/applications`, {
      method: 'POST', headers: H('user-admin'),
      body: { initiativeId: 'init-solar-2026', factoryId: 'factory-1', formData: { requestedCapacityKW: 100 } },
    });
    assert.equal(created.status, 201);
    const otherAppId = (created.json.data as { id: string }).id;
    // Owner of factory-sewedy must NOT read it
    const peek = await jfetch(`${base}/applications/${otherAppId}`, { headers: H('user-factory-sewedy') });
    assert.equal(peek.status, 403);
    // And must NOT see it in list
    const list = await jfetch(`${base}/applications?page=1&pageSize=100`, { headers: H('user-factory-sewedy') });
    assert.equal(list.status, 200);
    const rows = ((list.json as { data?: unknown[] }).data ?? []) as Array<{ factoryId?: string }>;
    assert.ok(rows.every((a) => a.factoryId !== 'factory-1'), 'owner list leaked another factory application');
    // Admin sees it
    const adminPeek = await jfetch(`${base}/applications/${otherAppId}`, { headers: H('user-admin') });
    assert.equal(adminPeek.status, 200);
  });

  it('reviewer cannot list another organization assignment', async () => {
    const r = await jfetch(`${base}/applications?orgId=org-imc`, { headers: H('user-ida') });
    assert.equal(r.status, 403);
  });
});
