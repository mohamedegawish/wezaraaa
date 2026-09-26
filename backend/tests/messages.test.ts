import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('msgs');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const ADMIN = 'user-admin';
const IDA = 'user-ida';
const BANK = 'user-bank';
const OWNER1 = 'user-factory-1'; // factory-1
const OWNER_SEWEDY = 'user-factory-sewedy'; // factory-sewedy
let appId = '';

describe('application messages (contract-first 5b)', () => {
  it('creates an application for factory-1', async () => {
    const r = await jfetch(`${base}/applications`, {
      method: 'POST', headers: H(ADMIN),
      body: { initiativeId: 'init-solar-2026', factoryId: 'factory-1', formData: { requestedCapacityKW: 300 } },
    });
    assert.equal(r.status, 201);
    appId = (r.json.data as { id: string }).id;
    // المراجعة الأولية للوزارة ثم يصبح الطلب مسنداً لـ IDA.
    const intake = await jfetch(`${base}/applications/${appId}/decisions`, {
      method: 'POST', headers: H(ADMIN), body: { action: 'approve', comments: 'intake ok' },
    });
    assert.equal(intake.status, 200);
  });

  it('reviewer (IDA, assigned org) sends message to ministry -> 201', async () => {
    const r = await jfetch(`${base}/applications/${appId}/messages`, {
      method: 'POST', headers: H(IDA),
      body: { toOrgId: 'org-ministry', subject: 'استفسار فني', body: 'يرجى مراجعة القدرة المطلوبة.', customFields: { priority: 'high' } },
    });
    assert.equal(r.status, 201);
    const m = r.json.data as Record<string, unknown>;
    assert.equal(m['applicationId'], appId);
    assert.equal(m['toOrgId'], 'org-ministry');
    assert.equal(m['fromOrgId'], 'org-ida');
    assert.deepEqual(m['customFields'], { priority: 'high' });
    assert.ok(typeof m['fromUserName'] === 'string' && (m['fromUserName'] as string).length > 0);
  });

  it('empty body -> 400', async () => {
    const r = await jfetch(`${base}/applications/${appId}/messages`, {
      method: 'POST', headers: H(IDA),
      body: { toOrgId: 'org-ministry', body: '   ' },
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'VALIDATION_ERROR');
  });

  it('oversized customFields -> 400', async () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 11; i++) big[`k${i}`] = 'v';
    const r = await jfetch(`${base}/applications/${appId}/messages`, {
      method: 'POST', headers: H(IDA),
      body: { toOrgId: 'org-ministry', body: 'ok', customFields: big },
    });
    assert.equal(r.status, 400);
  });

  it('message to own org -> 400', async () => {
    const r = await jfetch(`${base}/applications/${appId}/messages`, {
      method: 'POST', headers: H(IDA),
      body: { toOrgId: 'org-ida', body: 'self message' },
    });
    assert.equal(r.status, 400);
  });

  it('detailsFile of another factory -> 400', async () => {
    const { getDb } = await import('../src/db/sqlite.js');
    const db = getDb();
    db.prepare(
      "INSERT INTO details_files (id, factoryId, fileName, fileSize, description, storedPath, uploadedAt, uploadedBy, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
    ).run('file-foreign-1', 'factory-sewedy', 'other.pdf', '1 MB', 'foreign', '/tmp/other.pdf', new Date().toISOString(), 'user-factory-sewedy');
    const r = await jfetch(`${base}/applications/${appId}/messages`, {
      method: 'POST', headers: H(IDA),
      body: { toOrgId: 'org-ministry', body: 'with foreign file', detailsFileId: 'file-foreign-1' },
    });
    assert.equal(r.status, 400);
  });

  it('unrelated reviewer (bank) sends on IDA-assigned app -> 403', async () => {
    const r = await jfetch(`${base}/applications/${appId}/messages`, {
      method: 'POST', headers: H(BANK),
      body: { toOrgId: 'org-ministry', body: 'should fail' },
    });
    assert.equal(r.status, 403);
  });

  it('unauthorized (no credentials) -> 401', async () => {
    const r = await jfetch(`${base}/applications/${appId}/messages`, {
      method: 'POST', headers: H(),
      body: { toOrgId: 'org-ministry', body: 'anon' },
    });
    assert.equal(r.status, 401);
  });

  it('sender org (IDA) lists and sees the message; uninvolved org (bank) sees empty', async () => {
    const a = await jfetch(`${base}/applications/${appId}/messages`, { headers: H(IDA) });
    assert.equal(a.status, 200);
    const dataA = (a.json as { data: unknown[] }).data;
    assert.ok(dataA.length >= 1);
    const b = await jfetch(`${base}/applications/${appId}/messages`, { headers: H(BANK) });
    assert.equal(b.status, 200);
    assert.deepEqual((b.json as { data: unknown[] }).data, []);
  });

  it('other factory owner sees nothing (403); own factory owner sees all', async () => {
    const other = await jfetch(`${base}/applications/${appId}/messages`, { headers: H(OWNER_SEWEDY) });
    assert.equal(other.status, 403);
    const own = await jfetch(`${base}/applications/${appId}/messages`, { headers: H(OWNER1) });
    assert.equal(own.status, 200);
    assert.ok(((own.json as { data: unknown[] }).data ?? []).length >= 1);
  });

  it('factory owner can send about own application -> 201', async () => {
    const r = await jfetch(`${base}/applications/${appId}/messages`, {
      method: 'POST', headers: H(OWNER1),
      body: { toOrgId: 'org-ida', body: 'استفسار من المصنع حول الطلب.' },
    });
    assert.equal(r.status, 201);
  });

  it('unknown application -> 404', async () => {
    const r = await jfetch(`${base}/applications/app-nope/messages`, {
      method: 'POST', headers: H(ADMIN),
      body: { toOrgId: 'org-ida', body: 'x' },
    });
    assert.equal(r.status, 404);
    const g = await jfetch(`${base}/applications/app-nope/messages`, { headers: H(ADMIN) });
    assert.equal(g.status, 404);
  });
});
