import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('initiatives');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const ADMIN = 'user-admin';
let createdId = '';

describe('initiatives CRUD + validation', () => {
  it('lists seeded initiatives', async () => {
    const r = await jfetch(`${base}/initiatives?page=1&pageSize=5`, { headers: H(ADMIN) });
    assert.equal(r.status, 200);
    const data = r.json as { total: number; data: unknown[] };
    assert.ok(data.total >= 4);
  });

  it('rejects short titles (400)', async () => {
    const r = await jfetch(`${base}/initiatives`, {
      method: 'POST', headers: H(ADMIN),
      body: { titleAr: 'ab', titleEn: 'xy' },
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'VALIDATION_ERROR');
  });

  it('rejects invalid status', async () => {
    const r = await jfetch(`${base}/initiatives`, {
      method: 'POST', headers: H(ADMIN),
      body: { titleAr: 'مبادرة اختبار قوية', titleEn: 'Strong Test Initiative', status: 'nope' },
    });
    assert.equal(r.status, 400);
  });

  it('creates initiative (201) with uuid id', async () => {
    const r = await jfetch(`${base}/initiatives`, {
      method: 'POST', headers: H(ADMIN),
      body: { titleAr: 'مبادرة اختبار قوية للبروداكشن', titleEn: 'Strong Production Test Initiative', status: 'draft' },
    });
    assert.equal(r.status, 201);
    const data = r.json.data as { id: string };
    assert.match(data.id, /^init-/);
    assert.ok(data.id.length > 15, 'uuid-based id, not Date.now');
    createdId = data.id;
  });

  it('rejects duplicate slug', async () => {
    const one = await jfetch(`${base}/initiatives/${createdId}`, { headers: H(ADMIN) });
    const slug = (one.json.data as { slug: string }).slug;
    const r = await jfetch(`${base}/initiatives`, {
      method: 'POST', headers: H(ADMIN),
      body: { titleAr: 'مبادرة اخرى مختلفة تماما', titleEn: 'Another Totally Different', slug },
    });
    assert.equal(r.status, 400);
  });

  it('validates customization maxFileSizeMB range', async () => {
    const r = await jfetch(`${base}/initiatives/${createdId}/customization`, {
      method: 'PUT', headers: H(ADMIN), body: { maxFileSizeMB: 500 },
    });
    assert.equal(r.status, 400);
  });

  it('validates workflow: empty stages rejected', async () => {
    const r = await jfetch(`${base}/initiatives/${createdId}/workflow`, {
      method: 'PUT', headers: H(ADMIN), body: { stages: [] },
    });
    assert.equal(r.status, 400);
  });

  it('validates workflow: duplicate code rejected', async () => {
    const r = await jfetch(`${base}/initiatives/${createdId}/workflow`, {
      method: 'PUT', headers: H(ADMIN),
      body: { stages: [
        { id: 's1', order: 1, code: 'DUP', nameAr: 'مرحلة 1', assignedOrgId: 'org-ida', slaDays: 3 },
        { id: 's2', order: 2, code: 'dup', nameAr: 'مرحلة 2', assignedOrgId: 'org-imc', slaDays: 3 },
      ] },
    });
    assert.equal(r.status, 400);
  });

  it('validates workflow: bad sla + unknown org', async () => {
    const badSla = await jfetch(`${base}/initiatives/${createdId}/workflow`, {
      method: 'PUT', headers: H(ADMIN),
      body: { stages: [{ id: 's1', order: 1, code: 'X1', nameAr: 'م1', assignedOrgId: 'org-ida', slaDays: 999 }] },
    });
    assert.equal(badSla.status, 400);
    const badOrg = await jfetch(`${base}/initiatives/${createdId}/workflow`, {
      method: 'PUT', headers: H(ADMIN),
      body: { stages: [{ id: 's1', order: 1, code: 'X1', nameAr: 'م1', assignedOrgId: 'org-ghost', slaDays: 3 }] },
    });
    assert.equal(badOrg.status, 404);
  });

  it('accepts valid workflow and bumps version', async () => {
    const r = await jfetch(`${base}/initiatives/${createdId}/workflow`, {
      method: 'PUT', headers: H(ADMIN),
      body: { stages: [
        { id: 'st-1', order: 1, code: 'ELIG', nameAr: 'الأهلية', assignedOrgId: 'org-ida', slaDays: 3, canReject: true, canRequestRework: true },
        // الوزارة تملك «المراجعة الأولية» فقط — المراحل اللاحقة لجهاتها.
        { id: 'st-2', order: 2, code: 'FINAL', nameAr: 'النهائية', assignedOrgId: 'org-nbe', slaDays: 2, canReject: false, canRequestRework: false },
      ] },
    });
    assert.equal(r.status, 200);
    assert.ok((r.json.data as { version: number }).version >= 2);
    const wf = await jfetch(`${base}/initiatives/${createdId}/workflow`, { headers: H(ADMIN) });
    const ids = (wf.json.data as { stages: Array<{ id: string }> }).stages.map((s) => s.id);
    assert.deepEqual(ids, ['stage-intake', 'st-1', 'st-2']);
  });
});
