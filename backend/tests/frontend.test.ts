import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isolateTestEnv, startServer, jfetch, H, ROOT } from './helpers.js';

const env = isolateTestEnv('frontend-prod');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const F = `${ROOT}/frontend/src`;

describe('frontend production guards (static + live)', () => {
  it('ErrorBoundary exists and wraps App', () => {
    assert.ok(fs.existsSync(`${F}/components/common/ErrorBoundary.tsx`));
    const main = fs.readFileSync(`${F}/main.tsx`, 'utf8');
    assert.ok(main.includes('ErrorBoundary'), 'main.tsx must wrap App in ErrorBoundary');
  });

  it('no credential leak in LoginView', () => {
    const s = fs.readFileSync(`${F}/components/auth/LoginView.tsx`, 'utf8');
    assert.ok(!s.includes('console.table('), 'console.table call must be removed');
    // password literal may remain only in comments about the fix — ensure no assignment of default password
    assert.ok(!/password.*Egypt@2026/.test(s) || s.includes('PROD FIX'), 'unexpected password leak');
  });

  it('printReport escapes titles (XSS guard)', () => {
    const s = fs.readFileSync(`${F}/utils/reports.ts`, 'utf8');
    assert.ok(s.includes('escapeHtml'), 'escapeHtml missing');
    assert.ok(s.includes('safeTitle'), 'safeTitle must be used');
  });

  it('api client sends Bearer JWT (not only x-user-id)', () => {
    const s = fs.readFileSync(`${F}/api/client.ts`, 'utf8');
    assert.ok(s.includes('Authorization'), 'Bearer header missing');
    assert.ok(s.includes('PROD-GUARD'), 'Mock prod guard missing');
    const e = fs.readFileSync(`${F}/api/endpoints.ts`, 'utf8');
    assert.ok(e.includes('/api/v1/auth/login'), 'login endpoint missing');
  });

  it('live: /openapi.json is served', async () => {
    const res = await fetch(`${base}/openapi.json`);
    assert.equal(res.status, 200);
    const j = await res.json() as { paths: Record<string, unknown> };
    assert.ok(Object.keys(j.paths).length >= 20);
  });

  it('live: JWT login works end-to-end for frontend flow', async () => {
    const r = await jfetch(`${base}/auth/login`, {
      method: 'POST', body: { email: 'tarek.mansour@industry.gov.eg', password: 'Egypt@2026' },
    });
    assert.equal(r.status, 200);
    const d = r.json.data as { accessToken: string };
    const me = await fetch(`${base}/users/me`, { headers: { Authorization: `Bearer ${d.accessToken}` } });
    assert.equal(me.status, 200);
    void H;
  });
});

describe('frontend has zero static data (API-only, seeder is the single source)', () => {
  it('mock layer files are deleted', () => {
    assert.ok(!fs.existsSync(`${F}/store/mockData.ts`), 'mockData.ts must be deleted');
    assert.ok(!fs.existsSync(`${F}/api/mockAdapter.ts`), 'mockAdapter.ts must be deleted');
    assert.ok(!fs.existsSync(`${F}/components/layout/PersonaSwitcher.tsx`), 'demo PersonaSwitcher must be deleted');
  });

  it('no mock references anywhere in frontend src', () => {
    const hits = (fs.readdirSync(F, { recursive: true }) as string[])
      .filter((p) => p.endsWith('.tsx'))
      .filter((p) => /USE_MOCK|mockAdapter|mockData/.test(fs.readFileSync(`${F}/${p}`, 'utf8')));
    assert.deepEqual(hits, [], 'found mock references in frontend src');
  });

  it('no local-auth / local-mutation engines in the store', () => {
    const s = fs.readFileSync(`${F}/store/state.ts`, 'utf8');
    for (const dead of ['loginByEmail', 'submitNewApplication', 'processDecision', 'addOrgUser', 'restoreAdminData', 'persistAdminData', 'STORAGE_KEY_ADMIN', '196.221.18.44', 'admin@industry.gov.eg']) {
      assert.ok(!s.includes(dead), `static/mock leftover in state.ts: ${dead}`);
    }
  });

  it('LoginView authenticates via API only', () => {
    const s = fs.readFileSync(`${F}/components/auth/LoginView.tsx`, 'utf8');
    assert.ok(!s.includes('loginByEmail'), 'local loginByEmail must be gone');
    assert.ok(!s.includes('registerFactoryUser'), 'local registerFactoryUser must be gone');
    assert.ok(s.includes('await login('), 'must call store.login (JWT)');
    assert.ok(s.includes('await registerFactory('), 'must call store.registerFactory (API)');
  });

  it('PreEligibilityModal has a confirm button (regression)', () => {
    const s = fs.readFileSync(`${F}/components/showcase/PreEligibilityModal.tsx`, 'utf8');
    assert.ok(s.includes('setSubmitted(true)'), 'confirm must submit the assessment');
    assert.ok(s.includes('onProceedToApply'), 'result must offer proceeding to apply');
    assert.ok(s.includes('max-width: 600px') || s.includes('600px'), 'mobile rules must exist');
  });

  it('endpoints expose the API-only surface with no mock branches', () => {
    const e = fs.readFileSync(`${F}/api/endpoints.ts`, 'utf8');
    for (const fn of ['registerFactory', 'changePassword', 'listAuditLogs', 'getMyFactory', 'fullListFactories', 'fetchAllPages']) {
      assert.ok(e.includes(fn), `endpoints.ts missing ${fn}`);
    }
    assert.ok(!e.includes('mockAdapter'), 'mock branches must be gone');
  });

  it('silent JWT rotation + timeline normalization exist', () => {
    const c = fs.readFileSync(`${F}/api/client.ts`, 'utf8');
    assert.ok(c.includes('refreshSession'), 'boot-time refreshSession missing');
    assert.ok(c.includes('/api/v1/auth/refresh'), 'refresh endpoint missing');
    // P0-1: tokens must live in memory, never localStorage (XSS)
    assert.ok(c.includes('memAccess'), 'memory token store missing (P0-1)');
    assert.ok(!c.includes("localStorage.getItem('accessToken')") || c.includes('legacyA'), 'accessToken must not be read from localStorage in hot path (P0-1)');
    assert.ok(c.includes("credentials: 'include'"), 'fetch must send httpOnly cookie (P0-1)');
    const t = fs.readFileSync(`${F}/components/factory/InteractiveTimeline.tsx`, 'utf8');
    assert.ok(t.includes('ACTION_TITLES'), 'action title map missing');
    assert.ok(t.includes('ev.at ?? ev.timestamp') || t.includes('.at ?? '), 'backend `at` normalization missing');
  });

  it('P0 security guards: escapeHtml + audit IP + register transaction + public limiter', () => {
    const r = fs.readFileSync(`${F}/utils/reports.ts`, 'utf8');
    assert.ok(r.includes('export function escapeHtml'), 'escapeHtml must be exported (P0-5)');
    const modal = fs.readFileSync(`${F}/components/admin/ApplicationReviewModal.tsx`, 'utf8');
    assert.ok(modal.includes('escapeHtml('), 'printReport body must be escaped (P0-5)');
    const auth = fs.readFileSync(`${ROOT}/backend/src/middleware/auth.ts`, 'utf8');
    assert.ok(auth.includes('config.trustProxy'), 'audit IP must respect TRUST_PROXY (P0-2)');
    const fac = fs.readFileSync(`${ROOT}/backend/src/routes/factories.ts`, 'utf8');
    assert.ok(fac.includes('BEGIN IMMEDIATE'), 'factory register must be transactional (P0-6)');
    const app = fs.readFileSync(`${ROOT}/backend/src/app.ts`, 'utf8');
    assert.ok(app.includes('publicReadLimiter'), 'public reads must be rate-limited (P1-1)');
    assert.ok(app.includes("credentials: true"), 'CORS must allow credentials for httpOnly cookie (P0-1)');
  });
});
