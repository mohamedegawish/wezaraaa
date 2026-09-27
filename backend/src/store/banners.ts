import { getDb, nowIso } from '../db/sqlite.js';
import { newId } from './helpers.js';

export const BANNER_PLACEMENTS = ['before_about', 'before_steps', 'before_cta'] as const;
export const BANNER_LINK_TYPES = ['none', 'initiative', 'url'] as const;
export const MAX_BANNERS = 12;

export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];
export type BannerLinkType = (typeof BANNER_LINK_TYPES)[number];

export interface HomeBanner {
  id: string;
  /** صورة مرفوعة → مسار /api/v1/banners/:id/image?v=… (لا تُرسل داخل JSON)؛ غير ذلك كما خُزنت. */
  imageUrl: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaLabelAr: string;
  ctaLabelEn: string;
  linkType: BannerLinkType;
  linkTarget: string;
  placement: BannerPlacement;
  sortOrder: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export type BannerPatch = Partial<Omit<HomeBanner, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'>>;

const WRITABLE = [
  'imageUrl', 'titleAr', 'titleEn', 'subtitleAr', 'subtitleEn', 'ctaLabelAr', 'ctaLabelEn',
  'linkType', 'linkTarget', 'placement', 'active', 'startsAt', 'endsAt',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function bannerImagePath(id: string, updatedAt: string): string {
  return `/api/v1/banners/${encodeURIComponent(id)}/image?v=${encodeURIComponent(updatedAt)}`;
}

function toBanner(r: Row): HomeBanner {
  const raw = String(r.imageUrl ?? '');
  return {
    id: r.id,
    imageUrl: raw.startsWith('data:') ? bannerImagePath(r.id, r.updatedAt) : raw,
    titleAr: r.titleAr ?? '',
    titleEn: r.titleEn ?? '',
    subtitleAr: r.subtitleAr ?? '',
    subtitleEn: r.subtitleEn ?? '',
    ctaLabelAr: r.ctaLabelAr ?? '',
    ctaLabelEn: r.ctaLabelEn ?? '',
    linkType: r.linkType ?? 'none',
    linkTarget: r.linkTarget ?? '',
    placement: r.placement ?? 'before_about',
    sortOrder: Number(r.sortOrder ?? 0),
    active: Number(r.active) === 1,
    startsAt: r.startsAt ?? '',
    endsAt: r.endsAt ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** كل البانرات (للإدارة) بترتيب العرض. */
export function listBanners(): HomeBanner[] {
  const rows = getDb().prepare('SELECT * FROM home_banners ORDER BY sortOrder ASC, createdAt ASC').all() as Row[];
  return rows.map(toBanner);
}

/** معروض الآن = مفعل + داخل النافذة الزمنية (التواريخ ISO فتُقارن نصياً). */
export function isBannerLive(b: HomeBanner, now = nowIso()): boolean {
  return b.active && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || now < b.endsAt);
}

export function listLiveBanners(now = nowIso()): HomeBanner[] {
  return listBanners().filter((b) => isBannerLive(b, now));
}

export function getBannerById(id: string): HomeBanner | undefined {
  const r = getDb().prepare('SELECT * FROM home_banners WHERE id = ?').get(id) as Row | undefined;
  return r ? toBanner(r) : undefined;
}

/** القيمة الخام للصورة (data URL كاملة) — لراوت الصورة فقط. */
export function getBannerRawImage(id: string): string | undefined {
  const r = getDb().prepare('SELECT imageUrl FROM home_banners WHERE id = ?').get(id) as { imageUrl: string } | undefined;
  return r?.imageUrl;
}

export function countBanners(): number {
  return (getDb().prepare('SELECT COUNT(*) AS c FROM home_banners').get() as { c: number }).c;
}

function toColumn(field: (typeof WRITABLE)[number], v: unknown): string | number {
  if (field === 'active') return v ? 1 : 0;
  return String(v ?? '');
}

export function createBanner(patch: BannerPatch & { imageUrl: string }): HomeBanner {
  const db = getDb();
  const id = newId('banner');
  const now = nowIso();
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sortOrder), 0) AS m FROM home_banners').get() as { m: number }).m;
  const values = { active: true, ...patch } as Record<string, unknown>;
  const cols = WRITABLE.filter((f) => values[f] !== undefined);
  db.prepare(
    `INSERT INTO home_banners (id, ${cols.join(', ')}, sortOrder, createdAt, updatedAt)
     VALUES (?, ${cols.map(() => '?').join(', ')}, ?, ?, ?)`,
  ).run(id, ...cols.map((f) => toColumn(f, values[f])), maxOrder + 1, now, now);
  return getBannerById(id)!;
}

export function updateBanner(id: string, patch: BannerPatch): HomeBanner | undefined {
  const values = patch as Record<string, unknown>;
  const cols = WRITABLE.filter((f) => values[f] !== undefined);
  getDb().prepare(
    `UPDATE home_banners SET ${[...cols.map((f) => `${f} = ?`), 'updatedAt = ?'].join(', ')} WHERE id = ?`,
  ).run(...cols.map((f) => toColumn(f, values[f])), nowIso(), id);
  return getBannerById(id);
}

export function deleteBanner(id: string): boolean {
  return Number(getDb().prepare('DELETE FROM home_banners WHERE id = ?').run(id).changes) > 0;
}

/** يعيد ترقيم كل البانرات حسب ترتيب ids (قائمة كاملة — يتحقق منها الراوت). */
export function reorderBanners(ids: string[]): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE home_banners SET sortOrder = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    ids.forEach((id, i) => stmt.run(i + 1, id));
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* noop */ }
    throw e;
  }
}
