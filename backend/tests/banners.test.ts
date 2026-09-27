import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

const env = isolateTestEnv('banners');
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
// 1×1 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

type Banner = { id: string; imageUrl: string; titleAr: string; placement: string; active: boolean; sortOrder: number; linkType: string; linkTarget: string; startsAt: string; endsAt: string };

const create = (body: Record<string, unknown>, user = ADMIN) =>
  jfetch(`${base}/banners`, { method: 'POST', headers: H(user), body });
const publicList = async () => (await jfetch(`${base}/banners`)).json.data as Banner[];
const adminList = async () => (await jfetch(`${base}/banners?scope=all`, { headers: H(ADMIN) })).json.data as Banner[];

describe('home banners', () => {
  let first = '';

  it('public list is empty on a fresh DB', async () => {
    const r = await jfetch(`${base}/banners`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.data, []);
  });

  it('only officials can create (guest 401, reviewer / auditor 403)', async () => {
    assert.equal((await jfetch(`${base}/banners`, { method: 'POST', body: { imageUrl: PNG } })).status, 401);
    assert.equal((await create({ imageUrl: PNG }, 'user-ida')).status, 403);
    assert.equal((await create({ imageUrl: PNG }, 'user-auditor')).status, 403);
  });

  it('scope=all needs an official', async () => {
    assert.equal((await jfetch(`${base}/banners?scope=all`)).status, 401);
    assert.equal((await jfetch(`${base}/banners?scope=all`, { headers: H('user-factory-sewedy') })).status, 403);
    assert.equal((await jfetch(`${base}/banners?scope=all`, { headers: H(MANAGER) })).status, 200);
  });

  it('validates image, link, placement and dates', async () => {
    const bad: Array<[Record<string, unknown>, string]> = [
      [{}, 'imageUrl'],
      [{ imageUrl: 'javascript:alert(1)' }, 'imageUrl'],
      [{ imageUrl: 'http://insecure.example/a.png' }, 'imageUrl'],
      [{ imageUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, 'imageUrl'],
      [{ imageUrl: PNG, placement: 'footer' }, 'placement'],
      [{ imageUrl: PNG, linkType: 'initiative', linkTarget: 'init-nope' }, 'linkTarget'],
      [{ imageUrl: PNG, linkType: 'url', linkTarget: 'javascript:alert(1)' }, 'linkTarget'],
      [{ imageUrl: PNG, startsAt: 'not a date' }, 'startsAt'],
      [{ imageUrl: PNG, startsAt: '2026-05-02T00:00:00Z', endsAt: '2026-05-01T00:00:00Z' }, 'endsAt'],
      [{ imageUrl: PNG, titleAr: 'x'.repeat(121) }, 'titleAr'],
      [{ imageUrl: PNG, active: 'yes' }, 'active'],
    ];
    for (const [body, field] of bad) {
      const r = await create(body);
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
      assert.equal((r.json as { details?: Array<{ field: string }> }).details?.[0]?.field, field);
    }
  });

  it('creates a banner and serves the uploaded image as binary', async () => {
    const r = await create({
      imageUrl: PNG, titleAr: 'تمويل ميسر', titleEn: 'Soft financing',
      linkType: 'initiative', linkTarget: 'init-solar-2026', ctaLabelAr: 'قدّم الآن',
    });
    assert.equal(r.status, 201);
    const b = r.json.data as Banner;
    first = b.id;
    assert.equal(b.placement, 'before_about');
    assert.equal(b.active, true);
    assert.match(b.imageUrl, /^\/api\/v1\/banners\/banner-[^/]+\/image\?v=/, 'data URL is not echoed in JSON');

    const img = await fetch(`${base.replace('/api/v1', '')}${b.imageUrl}`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.match(img.headers.get('cache-control') ?? '', /immutable/);
    assert.equal(Buffer.from(await img.arrayBuffer()).subarray(1, 4).toString(), 'PNG');

    assert.deepEqual((await publicList()).map(x => x.id), [first]);
  });

  it('hidden, scheduled and expired banners are not public', async () => {
    const hidden = (await create({ imageUrl: '/covers/solar-2026.jpg', active: false })).json.data as Banner;
    const future = (await create({ imageUrl: 'https://cdn.example.com/b.jpg', startsAt: '2999-01-01T00:00:00Z' })).json.data as Banner;
    const past = (await create({ imageUrl: PNG, endsAt: '2000-01-01T00:00:00Z' })).json.data as Banner;
    const pub = (await publicList()).map(x => x.id);
    assert.deepEqual(pub, [first]);
    const all = (await adminList()).map(x => x.id);
    for (const id of [first, hidden.id, future.id, past.id]) assert.ok(all.includes(id));
  });

  it('partial update keeps the image when the served URL is echoed back', async () => {
    const before = (await adminList()).find(b => b.id === first)!;
    const r = await jfetch(`${base}/banners/${first}`, {
      method: 'PUT', headers: H(MANAGER),
      body: { imageUrl: before.imageUrl, titleAr: 'عنوان جديد', placement: 'before_cta', linkType: 'none' },
    });
    assert.equal(r.status, 200);
    const b = r.json.data as Banner;
    assert.equal(b.titleAr, 'عنوان جديد');
    assert.equal(b.placement, 'before_cta');
    assert.equal(b.linkTarget, '', 'linkType none clears the target');
    const img = await fetch(`${base.replace('/api/v1', '')}${b.imageUrl}`);
    assert.equal(img.status, 200, 'image still served after update');
  });

  it('reorders (full list only) and deletes', async () => {
    const ids = (await adminList()).map(b => b.id);
    assert.equal((await jfetch(`${base}/banners/reorder`, { method: 'POST', headers: H(ADMIN), body: { ids: ids.slice(1) } })).status, 400);
    assert.equal((await jfetch(`${base}/banners/reorder`, { method: 'POST', headers: H(ADMIN), body: { ids: [...ids.slice(1), 'banner-nope'] } })).status, 404);
    const reversed = [...ids].reverse();
    const r = await jfetch(`${base}/banners/reorder`, { method: 'POST', headers: H(ADMIN), body: { ids: reversed } });
    assert.equal(r.status, 200);
    assert.deepEqual((r.json.data as Banner[]).map(b => b.id), reversed);

    assert.equal((await jfetch(`${base}/banners/${first}`, { method: 'DELETE', headers: H('user-ida') })).status, 403);
    assert.equal((await jfetch(`${base}/banners/${first}`, { method: 'DELETE', headers: H(ADMIN) })).status, 200);
    assert.equal((await jfetch(`${base}/banners/${first}`, { method: 'DELETE', headers: H(ADMIN) })).status, 404);
    assert.equal((await fetch(`${base}/banners/${first}/image`)).status, 404);
    assert.deepEqual(await publicList(), []);
  });

  it('enforces the banner limit', async () => {
    let r = await create({ imageUrl: PNG });
    while (r.status === 201) r = await create({ imageUrl: PNG });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, 'LIMIT_REACHED');
    assert.equal((await adminList()).length, 12);
  });

  it('writes audit entries', async () => {
    const r = await jfetch(`${base}/audit-logs?page=1&pageSize=100`, { headers: H(ADMIN) });
    const rows = (r.json as { data: Array<{ entityType: string; actionType: string }> }).data;
    const acts = new Set(rows.filter(x => x.entityType === 'banner').map(x => x.actionType));
    for (const a of ['create', 'update', 'delete']) assert.ok(acts.has(a), `missing audit ${a}`);
  });
});
