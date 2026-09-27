import React, { useEffect, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { api, ApiException, resolveApiAssetUrl } from '../../api';
import type { BannerLinkType, BannerPlacement, HomeBannerShape, UpsertHomeBannerReq } from '../../api';
import { AdminPageHeader } from './AdminLayout';
import { ErrorBox } from '../ui/ErrorBox';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { SkeletonCard } from '../common/SkeletonLoader';
import { BannerVisual, bannerHasText } from '../showcase/HomeBanners';
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Upload,
  Link2,
  CalendarDays,
  Home,
  Image as ImageIcon,
} from 'lucide-react';

const MAX_BANNERS = 12;
// الباك يقبل حتى 1.5M حرف للصورة — هامش أمان.
const MAX_IMAGE_CHARS = 1_400_000;

const PLACEMENTS: Array<{ id: BannerPlacement; ar: string; en: string }> = [
  { id: 'before_about', ar: 'فوق «عن المنصة»', en: 'Above “About the platform”' },
  { id: 'before_steps', ar: 'فوق «كيف تعمل المنصة»', en: 'Above “How it works”' },
  { id: 'before_cta', ar: 'أسفل الصفحة (قبل الدعوة الختامية)', en: 'Bottom (before the closing call-to-action)' },
];

interface Draft {
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
  active: boolean;
  /** YYYY-MM-DD بتوقيت الجهاز — يُحوَّل إلى ISO عند الحفظ */
  startDate: string;
  endDate: string;
}

const EMPTY_DRAFT: Draft = {
  imageUrl: '', titleAr: '', titleEn: '', subtitleAr: '', subtitleEn: '', ctaLabelAr: '', ctaLabelEn: '',
  linkType: 'none', linkTarget: '', placement: 'before_about', active: true, startDate: '', endDate: '',
};

const pad = (n: number) => String(n).padStart(2, '0');

function toDateInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** البداية من أول اليوم والنهاية حتى آخره (بتوقيت الجهاز). */
function fromDateInput(v: string, endOfDay: boolean): string {
  if (!v) return '';
  const [y, m, d] = v.split('-').map(Number);
  return (endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)).toISOString();
}

type LiveStatus = 'live' | 'hidden' | 'scheduled' | 'expired';

function bannerStatus(b: HomeBannerShape, now: string): LiveStatus {
  if (!b.active) return 'hidden';
  if (b.startsAt && now < b.startsAt) return 'scheduled';
  if (b.endsAt && now >= b.endsAt) return 'expired';
  return 'live';
}

/** هل يُعرض الرابط كصورة فعلاً؟ (رابط صفحة موقع أو موقع يمنع التضمين = لا) */
function imageLoads(src: string, timeoutMs = 10000): Promise<boolean> {
  return Promise.race([
    loadImage(src).then(() => true, () => false),
    new Promise<boolean>(resolve => window.setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('bad-image'));
    img.src = src;
  });
}

/** ضغط صورة البانر: ≤ 1920×1200، JPEG (الشفافية على خلفية بيضاء)، وتقليل الجودة حتى تناسب حد الرفع. */
async function compressBannerImage(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
  const img = await loadImage(raw);
  const scale = Math.min(1, 1920 / img.naturalWidth, 1200 / img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.86, 0.76, 0.66, 0.56]) {
    const out = canvas.toDataURL('image/jpeg', q);
    if (out.length <= MAX_IMAGE_CHARS) return out;
  }
  throw new Error('too-large');
}

/** بانرات الإعلانات في الصفحة الرئيسية — إضافة/تعديل/إخفاء/جدولة/ترتيب/حذف (المسؤولون فقط). */
export const HomeBannersAdminView: React.FC = () => {
  const { language, initiatives, navigate, reloadHomeBanners } = usePlatformStore();
  const isAr = language === 'ar';

  const [banners, setBanners] = useState<HomeBannerShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [editing, setEditing] = useState<HomeBannerShape | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null); // null = النموذج مغلق
  const [formError, setFormError] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  // روابط صور فشل تحميلها (المعاينة + صور القائمة) — للتنبيه بدل صورة فارغة.
  const [brokenImages, setBrokenImages] = useState<ReadonlySet<string>>(() => new Set());
  const markBroken = (url: string) => setBrokenImages(prev => (prev.has(url) ? prev : new Set(prev).add(url)));
  const [previewAr, setPreviewAr] = useState(isAr);

  const errText = (e: unknown) => {
    if (e instanceof ApiException) return (isAr ? e.apiError.messageAr : e.apiError.messageEn) || e.message;
    return e instanceof Error ? e.message : String(e);
  };

  useEffect(() => {
    let alive = true;
    api.listBanners('all')
      .then(r => { if (alive) setBanners(r.data ?? []); })
      .catch(e => { if (alive) setError(errText(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (msg: string) => { setOkMsg(msg); setError(''); window.setTimeout(() => setOkMsg(''), 4000); };

  // بعد أي تعديل: القائمة هنا + بانرات الصفحة الرئيسية في الستور (تظهر للزائر فوراً).
  const afterChange = async (msg: string, next?: HomeBannerShape[]) => {
    setBanners(next ?? (await api.listBanners('all')).data ?? []);
    void reloadHomeBanners();
    flash(msg);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { setError(errText(e)); setOkMsg(''); } finally { setBusy(false); }
  };

  const openNew = (placement: BannerPlacement = 'before_about') => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, placement });
    setFormError('');
    setPreviewAr(isAr);
  };

  const openEdit = (b: HomeBannerShape) => {
    setEditing(b);
    setDraft({
      imageUrl: b.imageUrl, titleAr: b.titleAr, titleEn: b.titleEn, subtitleAr: b.subtitleAr, subtitleEn: b.subtitleEn,
      ctaLabelAr: b.ctaLabelAr, ctaLabelEn: b.ctaLabelEn, linkType: b.linkType, linkTarget: b.linkTarget,
      placement: b.placement, active: b.active, startDate: toDateInput(b.startsAt), endDate: toDateInput(b.endsAt),
    });
    setFormError('');
    setPreviewAr(isAr);
  };

  const closeForm = () => { setDraft(null); setEditing(null); };

  const patchDraft = (p: Partial<Draft>) => setDraft(d => (d ? { ...d, ...p } : d));

  const notAnImageAr = 'رابط الصورة لا يعرض صورة. استخدم رابطاً مباشراً لملف صورة (ينتهي عادةً بـ ‎.jpg أو ‎.png أو ‎.webp) وليس رابط صفحة موقع، أو ارفع الصورة من جهازك. لو تريد أن يفتح البانر موقعاً، ضع رابطه في «عند الضغط على البانر».';
  const notAnImageEn = 'The image link does not show an image. Use a direct link to an image file (usually ending in .jpg, .png or .webp), not a web page — or upload the image. To make the banner open a website, put that link under “When the banner is clicked”.';

  const save = async () => {
    if (!draft) return;
    const fail = (ar: string, en: string) => setFormError(isAr ? ar : en);
    if (!draft.imageUrl.trim()) return fail('اختر صورة للبانر (رفع من الجهاز أو رابط https).', 'Choose a banner image (upload or https link).');
    if (draft.linkType === 'initiative' && !draft.linkTarget) return fail('اختر المبادرة التي يفتحها البانر.', 'Choose the initiative the banner opens.');
    if (draft.linkType === 'url' && !/^https?:\/\//i.test(draft.linkTarget.trim())) return fail('الرابط الخارجي يجب أن يبدأ بـ https://', 'The external link must start with https://');
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) return fail('تاريخ الانتهاء قبل تاريخ البدء.', 'End date is before start date.');
    const external = /^https?:\/\//i.test(draft.imageUrl.trim());
    if (external) {
      setBusy(true);
      const ok = await imageLoads(draft.imageUrl.trim());
      setBusy(false);
      if (!ok) { markBroken(draft.imageUrl); return fail(notAnImageAr, notAnImageEn); }
    }

    const req: UpsertHomeBannerReq = {
      imageUrl: draft.imageUrl.trim(),
      titleAr: draft.titleAr, titleEn: draft.titleEn, subtitleAr: draft.subtitleAr, subtitleEn: draft.subtitleEn,
      ctaLabelAr: draft.linkType === 'none' ? '' : draft.ctaLabelAr,
      ctaLabelEn: draft.linkType === 'none' ? '' : draft.ctaLabelEn,
      linkType: draft.linkType,
      linkTarget: draft.linkType === 'none' ? '' : draft.linkTarget.trim(),
      placement: draft.placement,
      active: draft.active,
      startsAt: fromDateInput(draft.startDate, false),
      endsAt: fromDateInput(draft.endDate, true),
    };
    setBusy(true);
    setFormError('');
    try {
      if (editing) await api.updateBanner(editing.id, req);
      else await api.createBanner(req);
      const wasEditing = Boolean(editing);
      closeForm();
      await afterChange(wasEditing ? (isAr ? 'تم حفظ البانر' : 'Banner saved') : (isAr ? 'تمت إضافة البانر' : 'Banner added'));
    } catch (e) {
      setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = (b: HomeBannerShape) => run(async () => {
    await api.updateBanner(b.id, { active: !b.active });
    await afterChange(b.active ? (isAr ? 'تم إخفاء البانر' : 'Banner hidden') : (isAr ? 'البانر ظاهر الآن' : 'Banner is now visible'));
  });

  const remove = (b: HomeBannerShape) => {
    const name = (isAr ? b.titleAr || b.titleEn : b.titleEn || b.titleAr) || (isAr ? 'بدون عنوان' : 'untitled');
    if (!window.confirm(isAr ? `حذف البانر «${name}» نهائياً؟` : `Delete banner “${name}” permanently?`)) return;
    return run(async () => {
      await api.deleteBanner(b.id);
      await afterChange(isAr ? 'تم حذف البانر' : 'Banner deleted');
    });
  };

  // الترتيب داخل نفس المكان: تبديل مع الجار في المجموعة ثم إرسال القائمة الكاملة.
  const move = (b: HomeBannerShape, dir: -1 | 1) => {
    const group = banners.filter(x => x.placement === b.placement);
    const other = group[group.findIndex(x => x.id === b.id) + dir];
    if (!other) return;
    const ids = banners.map(x => x.id);
    const i = ids.indexOf(b.id);
    const j = ids.indexOf(other.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return run(async () => {
      const r = await api.reorderBanners(ids);
      await afterChange(isAr ? 'تم حفظ الترتيب' : 'Order saved', r.data);
    });
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      setFormError(isAr ? 'الملف يجب أن يكون صورة JPG أو PNG أو WebP.' : 'The file must be a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setFormError(isAr ? 'حجم الصورة كبير جداً (الحد 15 ميجابايت).' : 'Image too large (max 15 MB).');
      return;
    }
    setImageBusy(true);
    setFormError('');
    try {
      const url = await compressBannerImage(file);
      patchDraft({ imageUrl: url });
    } catch {
      setFormError(isAr ? 'تعذر تجهيز الصورة — جرّب صورة أصغر أو بصيغة أخرى.' : 'Could not process the image — try a smaller one or another format.');
    } finally {
      setImageBusy(false);
    }
  };

  const now = new Date().toISOString();
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const pickText = (ar: string, en: string) => (isAr ? ar || en : en || ar);

  const statusBadge = (s: LiveStatus, b: HomeBannerShape) => {
    if (s === 'live') return <Badge tone="approved">{isAr ? 'معروض الآن' : 'Live'}</Badge>;
    if (s === 'hidden') return <Badge tone="draft">{isAr ? 'مخفي' : 'Hidden'}</Badge>;
    if (s === 'scheduled') return <Badge tone="pending">{isAr ? `مجدول — يبدأ ${fmtDate(b.startsAt)}` : `Scheduled — starts ${fmtDate(b.startsAt)}`}</Badge>;
    return <Badge tone="rejected">{isAr ? 'انتهت مدة العرض' : 'Expired'}</Badge>;
  };

  const linkSummary = (b: HomeBannerShape) => {
    if (b.linkType === 'url') {
      let host = b.linkTarget;
      try { host = new URL(b.linkTarget).hostname; } catch { /* keep raw */ }
      return (isAr ? 'رابط خارجي: ' : 'External link: ') + host;
    }
    if (b.linkType === 'initiative') {
      const init = initiatives.find(i => i.id === b.linkTarget);
      return init ? (isAr ? `مبادرة: ${init.titleAr}` : `Initiative: ${init.titleEn}`) : (isAr ? 'مبادرة غير موجودة — الرابط معطل' : 'Initiative not found — link disabled');
    }
    return isAr ? 'بدون رابط' : 'No link';
  };

  const scheduleSummary = (b: HomeBannerShape) => {
    if (b.startsAt && b.endsAt) return isAr ? `من ${fmtDate(b.startsAt)} إلى ${fmtDate(b.endsAt)}` : `${fmtDate(b.startsAt)} → ${fmtDate(b.endsAt)}`;
    if (b.startsAt) return isAr ? `من ${fmtDate(b.startsAt)}` : `From ${fmtDate(b.startsAt)}`;
    if (b.endsAt) return isAr ? `حتى ${fmtDate(b.endsAt)}` : `Until ${fmtDate(b.endsAt)}`;
    return isAr ? 'عرض دائم' : 'Always on';
  };

  const atLimit = banners.length >= MAX_BANNERS;
  const iconBtn: React.CSSProperties = { width: '32px', height: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
  const metaChip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 };

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      <AdminPageHeader
        title={isAr ? 'بانرات الصفحة الرئيسية' : 'Home Page Banners'}
        description={isAr
          ? 'بانرات إعلانية تظهر لزوار الصفحة الرئيسية في المكان الذي تختاره، مع رابط اختياري وجدولة للعرض. المقاس المقترح 1600×400 بكسل.'
          : 'Ad banners shown to home page visitors where you choose, with an optional link and display schedule. Suggested size 1600×400 px.'}
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('home')}>
              <Home size={15} /> <span>{isAr ? 'عرض الصفحة الرئيسية' : 'View home page'}</span>
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openNew()} disabled={atLimit || loading}
              title={atLimit ? (isAr ? `الحد الأقصى ${MAX_BANNERS} بانراً` : `Maximum ${MAX_BANNERS} banners`) : undefined}>
              <Plus size={15} /> <span>{isAr ? 'إضافة بانر' : 'Add banner'}</span>
              <span style={{ opacity: 0.8, fontWeight: 600 }} className="num-ltr">({banners.length}/{MAX_BANNERS})</span>
            </button>
          </>
        }
      />

      <ErrorBox message={error} style={{ marginBottom: '1rem' }} />
      {okMsg && (
        <div className="card" role="status" style={{ padding: '0.9rem 1.25rem', marginBottom: '1rem', borderInlineStart: '4px solid var(--status-approved-text)', background: 'var(--status-approved-bg)', color: 'var(--status-approved-text)', fontWeight: 700 }}>
          {okMsg}
        </div>
      )}

      {loading ? (
        <SkeletonCard count={3} />
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {PLACEMENTS.map(p => {
            const group = banners.filter(b => b.placement === p.id);
            return (
              <section key={p.id} className="card" style={{ padding: '1.25rem' }} aria-label={isAr ? p.ar : p.en}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: group.length ? '1rem' : '0.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Megaphone size={18} style={{ color: 'var(--egypt-red)' }} />
                    {isAr ? p.ar : p.en}
                    <span className="num-ltr" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>({group.length})</span>
                  </h2>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openNew(p.id)} disabled={atLimit}>
                    <Plus size={14} /> <span>{isAr ? 'إضافة هنا' : 'Add here'}</span>
                  </button>
                </div>

                {group.length === 0 ? (
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
                    {isAr ? 'لا توجد بانرات في هذا المكان — لن يظهر شيء للزوار هنا.' : 'No banners here — nothing is shown to visitors in this spot.'}
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {group.map((b, gi) => {
                      const status = bannerStatus(b, now);
                      const title = pickText(b.titleAr, b.titleEn);
                      return (
                        <div key={b.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.75rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', opacity: status === 'live' ? 1 : 0.8 }}>
                          <div style={{ width: '220px', maxWidth: '100%', aspectRatio: '4 / 1', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-muted)', flexShrink: 0, border: '1px solid var(--border-subtle)' }}>
                            <img src={resolveApiAssetUrl(b.imageUrl)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={() => markBroken(b.imageUrl)} />
                          </div>

                          <div style={{ flex: 1, minWidth: '200px', display: 'grid', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '0.92rem', color: title ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                {title || (isAr ? 'بدون عنوان (صورة فقط)' : 'Untitled (image only)')}
                              </strong>
                              {statusBadge(status, b)}
                              {brokenImages.has(b.imageUrl) && (
                                <Badge tone="rejected">{isAr ? 'الصورة لا تظهر للزوار — عدّل رابط الصورة' : 'Image does not load — fix the image link'}</Badge>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                              <span style={metaChip}><Link2 size={13} />{linkSummary(b)}</span>
                              <span style={metaChip}><CalendarDays size={13} />{scheduleSummary(b)}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} disabled={busy || gi === 0}
                              onClick={() => move(b, -1)} title={isAr ? 'تقديم' : 'Move up'} aria-label={isAr ? 'تقديم' : 'Move up'}>
                              <ArrowUp size={14} />
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} disabled={busy || gi === group.length - 1}
                              onClick={() => move(b, 1)} title={isAr ? 'تأخير' : 'Move down'} aria-label={isAr ? 'تأخير' : 'Move down'}>
                              <ArrowDown size={14} />
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} disabled={busy}
                              onClick={() => toggleActive(b)}
                              title={b.active ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
                              aria-label={b.active ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}>
                              {b.active ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => openEdit(b)}>
                              <Pencil size={13} /> <span>{isAr ? 'تعديل' : 'Edit'}</span>
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ ...iconBtn, color: 'var(--gov-crimson)' }} disabled={busy}
                              onClick={() => remove(b)} title={isAr ? 'حذف' : 'Delete'} aria-label={isAr ? 'حذف' : 'Delete'}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {draft && (
        <Modal
          onClose={closeForm}
          maxWidth="860px"
          title={editing ? (isAr ? 'تعديل بانر' : 'Edit banner') : (isAr ? 'إضافة بانر جديد' : 'New banner')}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
              <button type="button" className="btn btn-secondary" onClick={closeForm}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy || imageBusy}>
                {busy ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : editing ? (isAr ? 'حفظ التعديلات' : 'Save changes') : (isAr ? 'إضافة البانر' : 'Add banner')}
              </button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: '1.1rem' }}>
            {/* معاينة حية بنفس مكون الصفحة الرئيسية */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-secondary)' }}>
                  {isAr ? 'معاينة كما ستظهر في الصفحة الرئيسية' : 'Preview as shown on the home page'}
                </span>
                <div role="group" aria-label={isAr ? 'لغة المعاينة' : 'Preview language'} style={{ display: 'flex', gap: '0.25rem' }}>
                  {[true, false].map(ar => (
                    <button key={String(ar)} type="button" className={`btn btn-sm ${previewAr === ar ? 'btn-primary' : 'btn-secondary'}`}
                      aria-pressed={previewAr === ar} onClick={() => setPreviewAr(ar)} style={{ padding: '0.2rem 0.6rem' }}>
                      {ar ? 'العربية' : 'English'}
                    </button>
                  ))}
                </div>
              </div>
              <div dir={previewAr ? 'rtl' : 'ltr'}>
                <div className={`home-feature${bannerHasText(draft, previewAr) ? ' has-text' : ''}`} style={{ boxShadow: 'none' }}>
                  {draft.imageUrl ? (
                    <div className="home-feature-slide is-active">
                      <BannerVisual banner={draft} isAr={previewAr} showCta={draft.linkType !== 'none'} eager
                        onImageError={() => markBroken(draft.imageUrl)} />
                    </div>
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      <ImageIcon size={26} style={{ opacity: 0.5 }} />
                      {isAr ? 'لم تُختر صورة بعد' : 'No image yet'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* الصورة */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label required">{isAr ? 'صورة البانر' : 'Banner image'}</label>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: imageBusy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Upload size={14} />
                  <span>{imageBusy ? (isAr ? 'جارٍ تجهيز الصورة...' : 'Processing...') : (isAr ? 'رفع صورة من الجهاز' : 'Upload from device')}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} disabled={imageBusy}
                    onChange={e => { void onPickFile(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <input
                  type="url"
                  className="form-control"
                  dir="ltr"
                  style={{ flex: 1, minWidth: '220px' }}
                  placeholder={isAr ? 'أو رابط مباشر لملف صورة https://….jpg' : 'or a direct image file link https://….jpg'}
                  value={/^https?:\/\//i.test(draft.imageUrl) ? draft.imageUrl : ''}
                  onChange={e => patchDraft({ imageUrl: e.target.value })}
                />
              </div>
              <small style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {isAr
                  ? 'المقاس المقترح 1600×400 بكسل (نسبة 4:1). الصورة تملأ البانر وقد تُقص أطرافها على الموبايل — اجعل المحتوى المهم في المنتصف. تُضغط الصورة تلقائياً قبل الرفع.'
                  : 'Suggested size 1600×400 px (4:1). The image fills the banner and its edges may be cropped on mobile — keep key content centered. Images are compressed automatically.'}
              </small>
              {draft.imageUrl && brokenImages.has(draft.imageUrl) && (
                <ErrorBox message={isAr ? notAnImageAr : notAnImageEn} style={{ marginTop: '0.5rem' }} />
              )}
            </div>

            {/* المكان والظهور */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="banner-placement">{isAr ? 'مكان الظهور في الصفحة الرئيسية' : 'Position on the home page'}</label>
                <select id="banner-placement" className="form-control" value={draft.placement}
                  onChange={e => patchDraft({ placement: e.target.value as BannerPlacement })}>
                  {PLACEMENTS.map(p => <option key={p.id} value={p.id}>{isAr ? p.ar : p.en}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer', paddingBottom: '0.55rem' }}>
                <input type="checkbox" checked={draft.active} onChange={e => patchDraft({ active: e.target.checked })} />
                {isAr ? 'ظاهر للزوار' : 'Visible to visitors'}
              </label>
            </div>

            {/* النصوص */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '0.9rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
                <input className="form-control" maxLength={120} value={draft.titleAr} onChange={e => patchDraft({ titleAr: e.target.value })}
                  placeholder={isAr ? 'اختياري — اتركه فارغاً إن كان النص داخل الصورة' : 'Optional — leave empty if the text is in the image'} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{isAr ? 'العنوان (إنجليزي)' : 'Title (English)'}</label>
                <input className="form-control" dir="ltr" maxLength={120} value={draft.titleEn} onChange={e => patchDraft({ titleEn: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{isAr ? 'وصف قصير (عربي)' : 'Short text (Arabic)'}</label>
                <textarea className="form-control" rows={2} maxLength={240} value={draft.subtitleAr} onChange={e => patchDraft({ subtitleAr: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{isAr ? 'وصف قصير (إنجليزي)' : 'Short text (English)'}</label>
                <textarea className="form-control" dir="ltr" rows={2} maxLength={240} value={draft.subtitleEn} onChange={e => patchDraft({ subtitleEn: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
            </div>

            {/* الرابط */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '0.9rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="banner-link-type">{isAr ? 'عند الضغط على البانر' : 'When the banner is clicked'}</label>
                <select id="banner-link-type" className="form-control" value={draft.linkType}
                  onChange={e => patchDraft({ linkType: e.target.value as BannerLinkType, linkTarget: '' })}>
                  <option value="none">{isAr ? 'لا شيء (بانر بدون رابط)' : 'Nothing (no link)'}</option>
                  <option value="initiative">{isAr ? 'فتح صفحة مبادرة' : 'Open an initiative page'}</option>
                  <option value="url">{isAr ? 'فتح رابط خارجي (نافذة جديدة)' : 'Open an external link (new tab)'}</option>
                </select>
              </div>
              {draft.linkType === 'initiative' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label required" htmlFor="banner-link-init">{isAr ? 'المبادرة' : 'Initiative'}</label>
                  <select id="banner-link-init" className="form-control" value={draft.linkTarget} onChange={e => patchDraft({ linkTarget: e.target.value })}>
                    <option value="">{isAr ? 'اختر المبادرة...' : 'Choose initiative...'}</option>
                    {initiatives.map(i => {
                      const hidden = i.status === 'draft' || i.status === 'archived';
                      return (
                        <option key={i.id} value={i.id}>
                          {isAr ? i.titleAr : i.titleEn}{hidden ? (isAr ? ' (غير منشورة — لن يعمل الرابط للزوار)' : ' (unpublished — link inactive for visitors)') : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              {draft.linkType === 'url' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label required" htmlFor="banner-link-url">{isAr ? 'الرابط' : 'Link'}</label>
                  <input id="banner-link-url" type="url" className="form-control" dir="ltr" placeholder="https://"
                    value={draft.linkTarget} onChange={e => patchDraft({ linkTarget: e.target.value })} />
                </div>
              )}
            </div>
            {draft.linkType !== 'none' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '0.9rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{isAr ? 'نص الزر (عربي)' : 'Button text (Arabic)'}</label>
                  <input className="form-control" maxLength={40} value={draft.ctaLabelAr} onChange={e => patchDraft({ ctaLabelAr: e.target.value })}
                    placeholder={isAr ? 'مثال: قدّم الآن — اختياري' : 'e.g. قدّم الآن — optional'} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{isAr ? 'نص الزر (إنجليزي)' : 'Button text (English)'}</label>
                  <input className="form-control" dir="ltr" maxLength={40} value={draft.ctaLabelEn} onChange={e => patchDraft({ ctaLabelEn: e.target.value })}
                    placeholder="e.g. Apply now" />
                </div>
              </div>
            )}

            {/* الجدولة */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.9rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="banner-start">{isAr ? 'يبدأ العرض في' : 'Show from'}</label>
                  <input id="banner-start" type="date" className="form-control" value={draft.startDate} onChange={e => patchDraft({ startDate: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="banner-end">{isAr ? 'ينتهي العرض بعد' : 'Show until'}</label>
                  <input id="banner-end" type="date" className="form-control" value={draft.endDate} min={draft.startDate || undefined}
                    onChange={e => patchDraft({ endDate: e.target.value })} />
                </div>
              </div>
              <small style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? 'اختياري — اتركهما فارغين ليظهر البانر دائماً. يتوقف العرض تلقائياً بعد نهاية يوم الانتهاء.' : 'Optional — leave both empty to always show it. The banner stops automatically after the end day.'}
              </small>
            </div>

            <div aria-live="polite"><ErrorBox message={formError} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
};
