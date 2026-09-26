import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

// الحوكمة: الإدارة تقرر «المراجعة الأولية» فقط ثم تتابع؛ كل مرحلة بعدها تقرر فيها جهتها فقط.
const env = isolateTestEnv('wf-authz');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const ADMIN = 'user-admin';
const MANAGER = 'user-manager';
const AUDITOR = 'user-auditor';
const IDA = 'user-ida';
const SOLAR = 'user-solar';
const IMC = 'user-imc';
const BANK = 'user-bank';
const EEHC = 'user-eehc';

interface TrackItem {
  stageId: string; status: string; decision: string | null; daysSpent: number | null; slaDays: number;
  decidedBy: { byName: string; byOrgNameAr: string; comments: string } | null;
  escalation: { comments: string } | null; events: unknown[];
}
interface AppView {
  currentStageId: string; currentAssignedOrgId: string; status: string;
  viewerCanDecide: boolean; allowedActions: string[]; isEscalated: boolean;
  currentStageOrder: number; totalStages: number; stageTrack: TrackItem[];
}

async function create(): Promise<string> {
  const r = await jfetch(`${base}/applications`, {
    method: 'POST', headers: H(ADMIN),
    body: { initiativeId: 'init-solar-2026', factoryId: 'factory-1', formData: { requestedCapacityKW: 300 } },
  });
  assert.equal(r.status, 201);
  return (r.json.data as { id: string }).id;
}
const view = async (id: string, as: string) => (await jfetch(`${base}/applications/${id}`, { headers: H(as) }));
const decide = (id: string, as: string, action: string, comments = 'ok') =>
  jfetch(`${base}/applications/${id}/decisions`, { method: 'POST', headers: H(as), body: { action, comments } });

describe('workflow governance: intake by officials, stages by their organizations', () => {
  let id = '';

  it('new application waits for the ministry intake decision', async () => {
    id = await create();
    const r = await view(id, ADMIN);
    const app = r.json.data as AppView;
    assert.equal(app.currentStageId, 'stage-intake');
    assert.equal(app.currentAssignedOrgId, 'org-ministry');
    assert.equal(app.viewerCanDecide, true);
    assert.ok(!app.allowedActions.includes('escalate'), 'officials do not escalate to themselves');
    assert.equal(app.currentStageOrder, 1);
    assert.equal(app.totalStages, 9);
    assert.equal(app.stageTrack[0].status, 'current');
  });

  it('entities and the auditor cannot decide the intake stage', async () => {
    assert.equal((await view(id, IDA)).status, 403, 'IDA has not been reached yet');
    assert.equal((await decide(id, IDA, 'approve')).status, 403);
    const aud = await decide(id, AUDITOR, 'approve');
    assert.equal(aud.status, 403, 'auditor is read-only even in the ministry org');
  });

  it('initiative manager approves intake → routed to IDA', async () => {
    const r = await decide(id, MANAGER, 'approve', 'استيفاء أولي سليم');
    assert.equal(r.status, 200);
    const app = (await view(id, ADMIN)).json.data as AppView;
    assert.equal(app.currentStageId, 'stage-sh1');
    assert.equal(app.currentAssignedOrgId, 'org-ida');
    assert.equal(app.stageTrack[0].status, 'approved');
    assert.equal(app.stageTrack[0].decidedBy?.comments, 'استيفاء أولي سليم');
    assert.ok((app.stageTrack[0].decidedBy?.byName ?? '').length > 0);
    assert.equal(app.stageTrack[1].status, 'current');
  });

  it('officials become monitors: cannot decide the IDA stage', async () => {
    const r = await decide(id, ADMIN, 'approve');
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'NOT_ASSIGNED');
    assert.match(String(r.json.messageAr), /المتابعة فقط/);
    const app = (await view(id, ADMIN)).json.data as AppView;
    assert.equal(app.viewerCanDecide, false);
    assert.deepEqual(app.allowedActions, []);
  });

  it('IDA escalation alerts the ministry without moving the application', async () => {
    const mine = (await view(id, IDA)).json.data as AppView;
    assert.equal(mine.viewerCanDecide, true);
    assert.ok(mine.allowedActions.includes('escalate'));
    assert.equal((await decide(id, IDA, 'escalate', '')).status, 400, 'escalation needs a reason');
    assert.equal((await decide(id, IDA, 'escalate', 'تعارض في بيانات السجل الصناعي')).status, 200);
    const app = (await view(id, ADMIN)).json.data as AppView;
    assert.equal(app.currentAssignedOrgId, 'org-ida');
    assert.equal(app.isEscalated, true);
    assert.equal(app.stageTrack[1].escalation?.comments, 'تعارض في بيانات السجل الصناعي');
  });

  it('IDA decides its two stages; escalation flag clears once the stage is closed', async () => {
    assert.equal((await decide(id, IDA, 'approve')).status, 200);
    assert.equal((await decide(id, IDA, 'approve')).status, 200);
    const app = (await view(id, ADMIN)).json.data as AppView;
    assert.equal(app.currentStageId, 'stage-sh3');
    assert.equal(app.currentAssignedOrgId, 'org-apex-solar');
    assert.equal(app.isEscalated, false);
  });

  it('IDA keeps read-only visibility; the bank sees nothing before its stage', async () => {
    const got = (await view(id, IDA)).json.data as AppView;
    assert.equal(got.viewerCanDecide, false);
    const list = await jfetch(`${base}/applications?pageSize=100`, { headers: H(IDA) });
    assert.ok((list.json.data as Array<{ id: string }>).some((a) => a.id === id), 'participant org still lists it');
    assert.equal((await view(id, BANK)).status, 403);
    const bankList = await jfetch(`${base}/applications?pageSize=100`, { headers: H(BANK) });
    assert.ok(!(bankList.json.data as Array<{ id: string }>).some((a) => a.id === id));
  });

  it('rework keeps the stage with its owner; reject closes the application (409 after)', async () => {
    assert.equal((await decide(id, SOLAR, 'approve')).status, 200);            // → IMC
    assert.equal((await decide(id, IMC, 'request_rework', 'أرفق المواصفات')).status, 200);
    let app = (await view(id, ADMIN)).json.data as AppView;
    assert.equal(app.status, 'pending_documents');
    assert.equal(app.stageTrack.find((s) => s.stageId === 'stage-sh4')?.status, 'rework');
    assert.equal((await decide(id, IMC, 'approve')).status, 200);             // → NBE
    assert.equal((await decide(id, BANK, 'reject', 'الملاءة غير كافية')).status, 200);
    app = (await view(id, ADMIN)).json.data as AppView;
    assert.equal(app.status, 'rejected');
    const bankStage = app.stageTrack.find((s) => s.stageId === 'stage-sh5');
    assert.equal(bankStage?.status, 'rejected');
    assert.equal(bankStage?.decision, 'reject');
    const again = await decide(id, BANK, 'approve');
    assert.equal(again.status, 409);
    assert.equal(again.json.code, 'APPLICATION_CLOSED');
  });

  it('stage flags are enforced (GRID_CONNECT cannot reject) and the utility completes the flow', async () => {
    const id2 = await create();
    const { applyDecision } = await import('../src/store/applications.js');
    for (let i = 0; i < 8; i++) applyDecision(id2, 'approve', 'fast-forward', 'user-admin');
    const before = (await view(id2, EEHC)).json.data as AppView;
    assert.equal(before.currentStageId, 'stage-sh8');
    assert.ok(!before.allowedActions.includes('reject'));
    const r = await decide(id2, EEHC, 'reject', 'x');
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'ACTION_NOT_ALLOWED');
    assert.equal((await decide(id2, EEHC, 'approve')).status, 200);
    const done = (await view(id2, ADMIN)).json.data as AppView;
    assert.equal(done.status, 'completed');
    assert.ok(done.stageTrack.every((s) => s.status === 'approved'));
    assert.ok(done.stageTrack.every((s) => typeof s.daysSpent === 'number'));
  });
});

describe('workflow editor governance', () => {
  it('saving a workflow without the intake stage re-inserts it first', async () => {
    const r = await jfetch(`${base}/initiatives/init-modernization-2026/workflow`, {
      method: 'PUT', headers: H(ADMIN),
      body: { stages: [{ id: 'sm-1', order: 1, code: 'MOD_ELIGIBILITY', nameAr: 'مراجعة الأهلية', nameEn: 'Eligibility', assignedOrgId: 'org-imc', slaDays: 4 }] },
    });
    assert.equal(r.status, 200);
    const wf = await jfetch(`${base}/initiatives/init-modernization-2026/workflow`, { headers: H(ADMIN) });
    const stages = (wf.json.data as { stages: Array<{ id: string; order: number; assignedOrgId: string }> }).stages;
    assert.deepEqual(stages.map((s) => s.id), ['stage-intake', 'sm-1']);
    assert.deepEqual(stages.map((s) => s.order), [1, 2]);
  });

  it('the ministry cannot own a later stage', async () => {
    const r = await jfetch(`${base}/initiatives/init-modernization-2026/workflow`, {
      method: 'PUT', headers: H(ADMIN),
      body: { stages: [{ id: 'sm-1', order: 1, code: 'MOD_ELIGIBILITY', nameAr: 'مراجعة الأهلية', assignedOrgId: 'org-ministry', slaDays: 4 }] },
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'VALIDATION_ERROR');
  });
});
