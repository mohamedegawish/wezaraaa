import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('apps');
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
let appId = '';
let firstStage = '';

describe('applications + decision engine (PROD FIX 2.1)', () => {
  it('rejects creation without formData', async () => {
    const r = await jfetch(`${base}/applications`, {
      method: 'POST', headers: H(ADMIN),
      body: { initiativeId: 'init-solar-2026', factoryId: 'factory-1' },
    });
    assert.equal(r.status, 400);
  });

  it('rejects inactive initiative', async () => {
    const r = await jfetch(`${base}/applications`, {
      method: 'POST', headers: H(ADMIN),
      body: { initiativeId: 'init-import-sub-2026', factoryId: 'factory-1', formData: { a: 1 } },
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'INITIATIVE_NOT_ACTIVE');
  });

  it('creates application on active initiative', async () => {
    const r = await jfetch(`${base}/applications`, {
      method: 'POST', headers: H(ADMIN),
      body: { initiativeId: 'init-solar-2026', factoryId: 'factory-1', formData: { requestedCapacityKW: 500 } },
    });
    assert.equal(r.status, 201);
    const data = r.json.data as { id: string; applicationNumber: string };
    assert.match(data.id, /^app-/);
    assert.match(data.applicationNumber, /^EGY-SOL-2026-/);
    appId = data.id;
    const got = await jfetch(`${base}/applications/${appId}`, { headers: H(ADMIN) });
    firstStage = ((got.json.data as { currentStageId: string }).currentStageId);
    assert.ok(firstStage.length > 0);
    // PROD FIX: detailsFiles must not leak storedPath
    const files = (got.json.data as { detailsFiles: Record<string, unknown>[] }).detailsFiles;
    assert.ok(Array.isArray(files));
    for (const f of files) assert.ok(!('storedPath' in f), 'storedPath leaked');
  });

  it('new application starts at the ministry intake stage', async () => {
    assert.equal(firstStage, 'stage-intake');
    const got = await jfetch(`${base}/applications/${appId}`, { headers: H(ADMIN) });
    assert.equal((got.json.data as { currentAssignedOrgId: string }).currentAssignedOrgId, 'org-ministry');
  });

  it('reject without comments -> 400', async () => {
    const r = await jfetch(`${base}/applications/${appId}/decisions`, {
      method: 'POST', headers: H(IDA), body: { action: 'reject' },
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'COMMENTS_REQUIRED');
  });

  it('invalid action -> 400', async () => {
    const r = await jfetch(`${base}/applications/${appId}/decisions`, {
      method: 'POST', headers: H(IDA), body: { action: 'nuke' },
    });
    assert.equal(r.status, 400);
  });

  it('approve advances to NEXT stage (not stuck)', async () => {
    // المراجعة الأولية: الإدارة تعتمد ثم ينتقل الطلب لجهة المرحلة التالية (IDA).
    const intake = await jfetch(`${base}/applications/${appId}/decisions`, {
      method: 'POST', headers: H(ADMIN), body: { action: 'approve', comments: 'intake ok' },
    });
    assert.equal(intake.status, 200);
    firstStage = (intake.json.data as { newStageId: string }).newStageId;
    const r = await jfetch(`${base}/applications/${appId}/decisions`, {
      method: 'POST', headers: H(IDA), body: { action: 'approve', comments: 'ok' },
    });
    assert.equal(r.status, 200);
    const data = r.json.data as { newStatus: string; newStageId: string };
    assert.equal(data.newStatus, 'in_progress');
    assert.notEqual(data.newStageId, firstStage, 'approve must advance stage');
  });

  it('escalate alerts the ministry but keeps the application with its organization', async () => {
    const r = await jfetch(`${base}/applications/${appId}/decisions`, {
      method: 'POST', headers: H(IDA), body: { action: 'escalate', comments: 'needs ministry' },
    });
    assert.equal(r.status, 200);
    const data = r.json.data as { newStatus: string };
    assert.notEqual(data.newStatus, 'rejected', 'escalate must NOT become rejected');
    const got = await jfetch(`${base}/applications/${appId}`, { headers: H(ADMIN) });
    const app = got.json.data as { currentAssignedOrgId: string; isEscalated: boolean };
    assert.equal(app.currentAssignedOrgId, 'org-ida');
    assert.equal(app.isEscalated, true);
  });

  it('wrong org cannot decide (NOT_ASSIGNED)', async () => {
    // create fresh app assigned to IDA, then try deciding as bank reviewer
    const c = await jfetch(`${base}/applications`, {
      method: 'POST', headers: H(ADMIN),
      body: { initiativeId: 'init-solar-2026', factoryId: 'factory-1', formData: { x: 1 } },
    });
    const id = (c.json.data as { id: string }).id;
    const r = await jfetch(`${base}/applications/${id}/decisions`, {
      method: 'POST', headers: H('user-bank'), body: { action: 'approve', comments: 'x' },
    });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'NOT_ASSIGNED');
  });
});
