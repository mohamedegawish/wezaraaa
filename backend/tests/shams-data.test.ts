import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

// بيانات مبادرة شمس الصناعة من الوثيقة الرسمية (seed.ts — المصدر الوحيد).
const env = isolateTestEnv('shams-data');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const ADMIN = 'user-admin';

const EXPECTED_CODES = [
  'MINISTRY_INTAKE', 'REG_SUBMIT', 'IDA_REVIEW', 'PREFEAS', 'TECH_REVIEW',
  'BANK_CREDIT', 'CONTRACT_INSTALL', 'UTILITY_APPROVAL', 'GRID_CONNECT',
];

describe('shams el-senaa seed (official document)', () => {
  it('seeds init-solar-2026 with document budget and dates', async () => {
    const r = await jfetch(`${base}/initiatives/init-solar-2026`, { headers: H(ADMIN) });
    assert.equal(r.status, 200);
    const d = r.json.data as {
      titleAr: string; status: string; budgetTotalEGP: number; budgetAllocatedEGP: number;
      startDate: string; endDate: string; impactMetrics: { targetFactories?: number };
      requiredDocsList: unknown[]; formSections: unknown[]; customization: { page?: { layout?: string } };
    };
    assert.equal(d.titleAr, 'شمس الصناعة');
    assert.equal(d.status, 'active');
    assert.equal(d.budgetTotalEGP, 12500000000);
    assert.equal(d.budgetAllocatedEGP, 0);
    assert.equal(d.startDate, '2026-01-01');
    assert.equal(d.endDate, '2030-12-31');
    assert.equal(d.impactMetrics?.targetFactories, 7000);
    assert.ok(Array.isArray(d.requiredDocsList) && d.requiredDocsList.length >= 10, 'requiredDocsList >= 10');
    assert.ok(Array.isArray(d.formSections) && d.formSections.length >= 3, 'formSections >= 3');
    assert.equal(d.customization?.page?.layout, 'spotlight');
  });

  it('carries the rest of the official document (targets, financing, eligibility, criteria, path, KPIs)', async () => {
    const r = await jfetch(`${base}/initiatives/init-solar-2026`);
    assert.equal(r.status, 200);
    const d = r.json.data as {
      objectives: unknown[]; eligibilityRequirements: unknown[]; selectionCriteria: unknown[];
      financialTerms: Record<string, unknown>; executionNotesAr: string; executionNotesEn: string;
    };
    assert.equal(d.objectives.length, 7);
    assert.equal(d.eligibilityRequirements.length, 13);
    assert.equal(d.selectionCriteria.length, 10);
    assert.equal(d.financialTerms.financingType, 'bank_loans');
    assert.equal(d.financialTerms.maxDurationYears, 5);
    assert.equal(d.financialTerms.maxFinancingPerClientEGP, 100_000_000);
    assert.equal(d.financialTerms.maxFinancingPerGroupEGP, 200_000_000);
    assert.ok(d.executionNotesAr.includes('التقديم') && d.executionNotesAr.includes('الربط والتشغيل'));
    assert.ok(d.executionNotesEn.length > 0);
    assert.equal('kpis' in d, false, 'KPIs are admin-only — never in the public read');

    const k = await jfetch(`${base}/initiatives/init-solar-2026/kpis`, { headers: H(ADMIN) });
    assert.equal(k.status, 200);
    const kpis = k.json.data as Array<{ id: string; unit: string; targetValue?: number }>;
    assert.equal(kpis.length, 16);
    assert.equal(new Set(kpis.map((x) => x.id)).size, 16);
    assert.equal(kpis.find((x) => x.unit === 'MW')?.targetValue, 1000);
  });

  it('has the ministry intake + 8 ordered stages with unique ids and existing orgs', async () => {
    const r = await jfetch(`${base}/initiatives/init-solar-2026/workflow`, { headers: H(ADMIN) });
    assert.equal(r.status, 200);
    const stages = (r.json.data as { stages: Array<{ id: string; order: number; code: string; assignedOrgId: string }> }).stages;
    assert.equal(stages.length, 9);
    assert.deepEqual(stages.map((s) => s.order), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(stages.map((s) => s.code), EXPECTED_CODES);
    assert.equal(stages[0].assignedOrgId, 'org-ministry');
    assert.ok(stages.slice(1).every((s) => s.assignedOrgId !== 'org-ministry'), 'ministry owns the intake stage only');
    assert.equal(new Set(stages.map((s) => s.id)).size, 9, 'stage ids must be unique');

    const orgs = await jfetch(`${base}/organizations?page=1&pageSize=100`, { headers: H(ADMIN) });
    assert.equal(orgs.status, 200);
    const orgIds = new Set(((orgs.json as { data?: Array<{ id: string }> }).data ?? []).map((o) => o.id));
    for (const s of stages) {
      assert.ok(orgIds.has(s.assignedOrgId), `assignedOrgId ${s.assignedOrgId} must exist in organizations`);
    }
  });

  it('accepts bodyAr/bodyEn section text (<=2000) and rejects oversize', async () => {
    const ok = await jfetch(`${base}/initiatives/init-solar-2026/customization`, {
      method: 'PUT', headers: H(ADMIN),
      body: { page: { sections: [{ id: 'sec-stats', kind: 'stats', titleAr: 'مؤشرات الأثر', titleEn: 'Impact metrics', visible: true, bodyAr: 'نص توضيحي أعلى القسم.', bodyEn: 'Intro text above the section.' }] } },
    });
    assert.equal(ok.status, 200);
    const saved = ((ok.json.data as { page?: { sections?: Array<{ bodyAr?: string; bodyEn?: string }> } }).page?.sections ?? [])[0];
    assert.equal(saved.bodyAr, 'نص توضيحي أعلى القسم.');
    assert.equal(saved.bodyEn, 'Intro text above the section.');

    const bad = await jfetch(`${base}/initiatives/init-solar-2026/customization`, {
      method: 'PUT', headers: H(ADMIN),
      body: { page: { sections: [{ id: 'sec-stats', kind: 'stats', titleAr: 'س', titleEn: 'S', visible: true, bodyAr: 'x'.repeat(2001) }] } },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.code, 'VALIDATION_ERROR');
  });
});
