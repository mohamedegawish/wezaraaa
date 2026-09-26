import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('page-layout');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const ADMIN = 'user-admin';

const VALID_PAGE = {
  layout: 'spotlight',
  heroTitleAr: 'شمس الصناعة: طاقة مصانعنا من أرضنا',
  heroTitleEn: 'Industry Sun: our factories powered by our land',
  heroSubtitleAr: 'تمويل ميسر 5% لمحطات شمسية على أسطح المصانع',
  heroSubtitleEn: '5% soft financing for rooftop solar',
  ctaPrimaryLabelAr: 'قدّم الآن',
  ctaPrimaryLabelEn: 'Apply now',
  ctaSecondaryLabelAr: 'افحص الأهلية',
  ctaSecondaryLabelEn: 'Check eligibility',
  galleryImages: ['/covers/solar-2026.jpg'],
  sections: [
    { id: 'sec-stats', kind: 'stats', titleAr: 'مؤشرات الأثر', titleEn: 'Impact metrics', visible: true },
    { id: 'sec-benefits', kind: 'benefits', titleAr: 'المزايا', titleEn: 'Benefits', visible: true },
    { id: 'sec-timeline', kind: 'timeline', titleAr: 'المراحل', titleEn: 'Timeline', visible: true },
    { id: 'sec-faqs', kind: 'faqs', titleAr: 'الأسئلة الشائعة', titleEn: 'FAQs', visible: true },
    { id: 'sec-partners', kind: 'partners', titleAr: 'الشركاء', titleEn: 'Partners', visible: true },
    { id: 'sec-apply', kind: 'apply', titleAr: 'التقديم', titleEn: 'Apply', visible: true },
  ],
};

describe('initiative page layout (customization.page)', () => {
  it('seeds init-solar-2026 with a ready page example', async () => {
    const r = await jfetch(`${base}/initiatives/init-solar-2026/customization`, { headers: H(ADMIN) });
    assert.equal(r.status, 200);
    const page = (r.json.data as { page?: { layout?: string; sections?: unknown[] } }).page;
    assert.ok(page, 'seeded customization.page must exist');
    assert.equal(page.layout, 'spotlight');
    assert.equal((page.sections ?? []).length, 6);
  });

  it('accepts a valid page (200) and returns it via GET', async () => {
    const put = await jfetch(`${base}/initiatives/init-solar-2026/customization`, {
      method: 'PUT', headers: H(ADMIN), body: { page: VALID_PAGE },
    });
    assert.equal(put.status, 200);
    const saved = (put.json.data as { page?: typeof VALID_PAGE }).page;
    assert.deepEqual(saved, VALID_PAGE);

    const get = await jfetch(`${base}/initiatives/init-solar-2026/customization`, { headers: H(ADMIN) });
    assert.equal(get.status, 200);
    assert.deepEqual((get.json.data as { page?: typeof VALID_PAGE }).page, VALID_PAGE);
  });

  it('rejects an invalid layout (400)', async () => {
    const r = await jfetch(`${base}/initiatives/init-solar-2026/customization`, {
      method: 'PUT', headers: H(ADMIN), body: { page: { layout: 'mega' } },
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'VALIDATION_ERROR');
  });

  it('rejects bad sections and oversized gallery (400)', async () => {
    const badKind = await jfetch(`${base}/initiatives/init-solar-2026/customization`, {
      method: 'PUT', headers: H(ADMIN),
      body: { page: { sections: [{ id: 'x', kind: 'nope', titleAr: 'س', titleEn: 'S', visible: true }] } },
    });
    assert.equal(badKind.status, 400);

    const tooMany = await jfetch(`${base}/initiatives/init-solar-2026/customization`, {
      method: 'PUT', headers: H(ADMIN),
      body: { page: { galleryImages: Array.from({ length: 9 }, (_, i) => `/covers/${i}.jpg`) } },
    });
    assert.equal(tooMany.status, 400);
  });

  it('keeps backward compat: PUT without page still works', async () => {
    const r = await jfetch(`${base}/initiatives/init-solar-2026/customization`, {
      method: 'PUT', headers: H(ADMIN), body: { maxFileSizeMB: 20 },
    });
    assert.equal(r.status, 200);
    const data = r.json.data as { maxFileSizeMB?: number; page?: unknown };
    assert.equal(data.maxFileSizeMB, 20);
    assert.ok(data.page, 'previously saved page must survive a legacy PUT');
  });
});
