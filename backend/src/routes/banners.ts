import { Router } from 'express';
import {
  BANNER_LINK_TYPES,
  BANNER_PLACEMENTS,
  MAX_BANNERS,
  countBanners,
  createBanner,
  deleteBanner,
  getBannerById,
  getBannerRawImage,
  listBanners,
  listLiveBanners,
  reorderBanners,
  updateBanner,
  type BannerPatch,
  type HomeBanner,
} from '../store/banners.js';
import { getInitiativeById } from '../store/initiatives.js';
import { addAuditLog } from '../store/audit.js';
import { apiError, okMessage } from '../middleware/error.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { ADMIN_ROLES, requireRole } from '../middleware/requireRole.js';

// بانرات الإعلانات في الصفحة الرئيسية.
// العام (قبل auth): المعروض الآن + صورة البانر. الإدارة (بعد auth): القائمة الكاملة والإضافة/التعديل/الحذف/الترتيب.
export const publicBannersRouter = Router();
export const bannersRouter = Router();

const DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
// أقل من JSON_LIMIT (2mb) مع هامش لباقي الحقول — الواجهة تضغط الصورة قبل الرفع.
const MAX_IMAGE_CHARS = 1_500_000;
const TEXT_LIMITS = {
  titleAr: 120, titleEn: 120, subtitleAr: 240, subtitleEn: 240, ctaLabelAr: 40, ctaLabelEn: 40,
} as const;

type FieldError = { field: string; issue: string; messageAr: string; messageEn: string };

function validateImageUrl(v: unknown): FieldError | null {
  const bad = (issue: string, messageAr: string, messageEn: string): FieldError => ({ field: 'imageUrl', issue, messageAr, messageEn });
  if (typeof v !== 'string' || !v.trim()) return bad('required', 'صورة البانر مطلوبة.', 'imageUrl is required.');
  const s = v.trim();
  if (s.length > MAX_IMAGE_CHARS) return bad('too large', 'حجم صورة البانر كبير جداً — استخدم صورة أصغر.', 'Banner image is too large.');
  if (s.startsWith('data:')) {
    return DATA_URL_RE.test(s) ? null : bad('format', 'صيغة الصورة غير مدعومة (PNG / JPG / WebP / GIF).', 'Unsupported image format (PNG/JPEG/WebP/GIF).');
  }
  if (s.startsWith('/') && !s.startsWith('//') && s.length <= 500) return null; // أصل من الواجهة مثل /covers/…
  if (isHttpUrl(s, ['https:'])) return null;
  return bad('format', 'رابط الصورة يجب أن يبدأ بـ https:// أو ارفع صورة من جهازك.', 'imageUrl must be an uploaded image or an https:// URL.');
}

function isHttpUrl(s: string, protocols = ['http:', 'https:']): boolean {
  if (s.length > 1000) return false;
  try { return protocols.includes(new URL(s).protocol); } catch { return false; }
}

/** '' = بلا حد، تاريخ صالح → ISO، غير ذلك null. */
function normDate(v: unknown): string | null {
  if (v === '' || v === null) return '';
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * يحوّل جسم الطلب إلى patch منظف. التحقق المركب (الرابط، النافذة الزمنية) على الحالة النهائية
 * = الحالي + التعديل، حتى يصح التعديل الجزئي.
 */
function parseBannerBody(body: Record<string, unknown>, current?: HomeBanner): { patch: BannerPatch } | { error: FieldError } {
  const patch: BannerPatch = {};

  // المحرر قد يعيد رابط الصورة المخدومة كما استلمه — يعني «بدون تغيير».
  const imageChanged = body.imageUrl !== undefined && !(current && body.imageUrl === current.imageUrl);
  if (imageChanged || !current) {
    const e = validateImageUrl(body.imageUrl);
    if (e) return { error: e };
    patch.imageUrl = String(body.imageUrl).trim();
  }

  for (const [f, max] of Object.entries(TEXT_LIMITS) as Array<[keyof typeof TEXT_LIMITS, number]>) {
    const v = body[f];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim().length > max) {
      return { error: { field: f, issue: `string <= ${max}`, messageAr: `النص طويل جداً (الحد ${max} حرفاً).`, messageEn: `${f} must be a string of at most ${max} chars.` } };
    }
    patch[f] = v.trim();
  }

  if (body.placement !== undefined) {
    if (!BANNER_PLACEMENTS.includes(body.placement as HomeBanner['placement'])) {
      return { error: { field: 'placement', issue: `must be ${BANNER_PLACEMENTS.join('|')}`, messageAr: 'مكان العرض غير صالح.', messageEn: 'Invalid placement.' } };
    }
    patch.placement = body.placement as HomeBanner['placement'];
  }
  if (body.linkType !== undefined) {
    if (!BANNER_LINK_TYPES.includes(body.linkType as HomeBanner['linkType'])) {
      return { error: { field: 'linkType', issue: `must be ${BANNER_LINK_TYPES.join('|')}`, messageAr: 'نوع الرابط غير صالح.', messageEn: 'Invalid linkType.' } };
    }
    patch.linkType = body.linkType as HomeBanner['linkType'];
  }
  if (body.linkTarget !== undefined) {
    if (typeof body.linkTarget !== 'string') {
      return { error: { field: 'linkTarget', issue: 'string', messageAr: 'وجهة الرابط غير صالحة.', messageEn: 'linkTarget must be a string.' } };
    }
    patch.linkTarget = body.linkTarget.trim();
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') {
      return { error: { field: 'active', issue: 'boolean', messageAr: 'حالة الظهور غير صالحة.', messageEn: 'active must be boolean.' } };
    }
    patch.active = body.active;
  }
  for (const f of ['startsAt', 'endsAt'] as const) {
    if (body[f] === undefined) continue;
    const d = normDate(body[f]);
    if (d === null) {
      return { error: { field: f, issue: 'ISO date or empty', messageAr: 'التاريخ غير صالح.', messageEn: `${f} must be an ISO date or empty.` } };
    }
    patch[f] = d;
  }

  const linkType = patch.linkType ?? current?.linkType ?? 'none';
  const linkTarget = patch.linkTarget ?? current?.linkTarget ?? '';
  if (linkType === 'none') {
    if (linkTarget) patch.linkTarget = '';
  } else if (linkType === 'initiative') {
    if (!linkTarget || !getInitiativeById(linkTarget)) {
      return { error: { field: 'linkTarget', issue: 'initiative not found', messageAr: 'اختر مبادرة موجودة للرابط.', messageEn: 'linkTarget must be an existing initiative id.' } };
    }
  } else if (!isHttpUrl(linkTarget)) {
    return { error: { field: 'linkTarget', issue: 'http(s) url', messageAr: 'الرابط الخارجي يجب أن يبدأ بـ https:// أو http://', messageEn: 'linkTarget must be an http(s) URL.' } };
  }

  const startsAt = patch.startsAt ?? current?.startsAt ?? '';
  const endsAt = patch.endsAt ?? current?.endsAt ?? '';
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { error: { field: 'endsAt', issue: '> startsAt', messageAr: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء.', messageEn: 'endsAt must be after startsAt.' } };
  }
  return { patch };
}

const bannerLabel = (b: Pick<HomeBanner, 'titleAr' | 'titleEn'>) => {
  const t = b.titleAr || b.titleEn;
  return t ? ` «${t}»` : '';
};

function audit(req: AuthedRequest, actionType: string, entityId: string, summaryAr: string) {
  addAuditLog({
    userId: req.userId, userName: req.user?.name ?? req.userId ?? 'unknown', ip: req.clientIp ?? '',
    actionType, entityType: 'banner', entityId, summaryAr,
  });
}

publicBannersRouter.get('/highlights', (req, res, next) => {
  // ?scope=all (قائمة الإدارة الكاملة) تكمل إلى auth ثم bannersRouter — حتى تعمل إعادة تدوير التوكن (401).
  if (req.query.scope === 'all') return next();
  return okMessage(res, 200, 'ok', listLiveBanners());
});

// الصورة المرفوعة تُخدم ثنائياً بكاش طويل (الرابط يحمل ?v=updatedAt فيتجدد مع كل تعديل).
// عامة لأن <img> لا يرسل Bearer؛ معرفات البانرات UUID غير قابلة للتخمين.
publicBannersRouter.get('/highlights/:id/image', (req, res) => {
  const raw = getBannerRawImage(req.params.id);
  const m = raw ? DATA_URL_RE.exec(raw) : null;
  if (!m) return apiError(res, 404, 'NOT_FOUND', 'الصورة غير موجودة.', 'Image not found.');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  return res.type(m[1]).send(Buffer.from(m[2], 'base64'));
});

bannersRouter.get('/highlights', requireRole(...ADMIN_ROLES), (_req, res) => {
  return okMessage(res, 200, 'ok', listBanners());
});

bannersRouter.post('/highlights', requireRole(...ADMIN_ROLES), (req: AuthedRequest, res) => {
  if (countBanners() >= MAX_BANNERS) {
    return apiError(res, 400, 'LIMIT_REACHED', `الحد الأقصى ${MAX_BANNERS} بانراً — احذف بانراً قديماً أولاً.`, `Maximum ${MAX_BANNERS} banners.`);
  }
  const parsed = parseBannerBody((req.body ?? {}) as Record<string, unknown>);
  if ('error' in parsed) {
    const e = parsed.error;
    return apiError(res, 400, 'VALIDATION_ERROR', e.messageAr, e.messageEn, [{ field: e.field, issue: e.issue }]);
  }
  const created = createBanner(parsed.patch as BannerPatch & { imageUrl: string });
  audit(req, 'create', created.id, `إضافة بانر إعلاني${bannerLabel(created)} في الصفحة الرئيسية`);
  return okMessage(res, 201, 'تمت إضافة البانر', created);
});

bannersRouter.post('/highlights/reorder', requireRole(...ADMIN_ROLES), (req: AuthedRequest, res) => {
  const ids = (req.body ?? {}).ids as unknown;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string') || new Set(ids).size !== ids.length) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'قائمة الترتيب غير صالحة.', 'ids must be an array of unique strings.', [{ field: 'ids', issue: 'unique string[]' }]);
  }
  const all = listBanners();
  const known = new Set(all.map((b) => b.id));
  const missing = (ids as string[]).find((id) => !known.has(id));
  if (missing) return apiError(res, 404, 'NOT_FOUND', 'بانر غير موجود في قائمة الترتيب.', `Banner not found: ${missing}`);
  if (ids.length !== all.length) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'يجب إرسال كل البانرات في قائمة الترتيب.', 'ids must list every banner.', [{ field: 'ids', issue: 'must include all banners' }]);
  }
  reorderBanners(ids as string[]);
  audit(req, 'update', '', 'إعادة ترتيب بانرات الصفحة الرئيسية');
  return okMessage(res, 200, 'تم حفظ الترتيب', listBanners());
});

bannersRouter.put('/highlights/:id', requireRole(...ADMIN_ROLES), (req: AuthedRequest, res) => {
  const current = getBannerById(req.params.id);
  if (!current) return apiError(res, 404, 'NOT_FOUND', 'البانر غير موجود.', 'Banner not found.');
  const parsed = parseBannerBody((req.body ?? {}) as Record<string, unknown>, current);
  if ('error' in parsed) {
    const e = parsed.error;
    return apiError(res, 400, 'VALIDATION_ERROR', e.messageAr, e.messageEn, [{ field: e.field, issue: e.issue }]);
  }
  const updated = updateBanner(current.id, parsed.patch)!;
  audit(req, 'update', current.id, `تعديل بانر إعلاني${bannerLabel(updated)}`);
  return okMessage(res, 200, 'تم حفظ البانر', updated);
});

bannersRouter.delete('/highlights/:id', requireRole(...ADMIN_ROLES), (req: AuthedRequest, res) => {
  const current = getBannerById(req.params.id);
  if (!current) return apiError(res, 404, 'NOT_FOUND', 'البانر غير موجود.', 'Banner not found.');
  deleteBanner(current.id);
  audit(req, 'delete', current.id, `حذف بانر إعلاني${bannerLabel(current)}`);
  return okMessage(res, 200, 'تم حذف البانر', { id: current.id });
});
