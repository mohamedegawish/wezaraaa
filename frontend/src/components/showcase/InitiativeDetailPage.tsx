import React, { useMemo, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { DEFAULT_CUSTOMIZATION } from '../../types';
import type { Initiative } from '../../types';
import type { CustomizationShape } from '../../api/schemas';
import { resolveCoverUrl } from '../../api';
import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  Building2,
  CheckCircle2,
  FileText,
  HelpCircle,
  Percent,
  Landmark,
  BarChart3,
  ClipboardList,
  Inbox,
  Upload,
  Target,
  ListChecks,
  Scale,
  Banknote,
  Zap,
} from 'lucide-react';
import { benefitIcon } from '../ui/benefitIcons';
import type { BilingualItem, FinancingType } from '../../types';
import { PreEligibilityModal } from './PreEligibilityModal';
import { formatBillions, formatEGP } from '../../utils/format';

const FINANCING_LABELS: Record<FinancingType, [string, string]> = {
  bank_loans: ['قروض من الجهاز المصرفي', 'Bank loans'],
  grants: ['منح', 'Grants'],
  subsidy: ['دعم وحوافز', 'Subsidy & incentives'],
  mixed: ['تمويل مختلط', 'Mixed financing'],
};

// ---------------------------------------------------------------------------
// تخصيص صفحة المبادرة — يضبطه الأدمن (قد لا يكون العقد الخلفي حدّثه بعد،
// لذا نستورد النوع التعاقدي فقط ونعالج غياب page بافتراضات آمنة).
// ---------------------------------------------------------------------------
type PageLayout = 'standard' | 'spotlight' | 'compact';
type SectionId = 'stats' | 'benefits' | 'timeline' | 'faqs' | 'partners' | 'gallery' | 'documents' | 'apply'
  | 'objectives' | 'financing' | 'requirements' | 'criteria';
const SECTION_IDS: SectionId[] = ['objectives', 'stats', 'financing', 'benefits', 'requirements', 'criteria', 'timeline', 'faqs', 'partners', 'gallery', 'documents', 'apply'];

interface PageSectionConfig {
  id: string;
  kind?: string;
  visible: boolean;
  order: number;
  titleAr?: string;
  titleEn?: string;
  /** نص إضافي يحرره الأدمن من Page design — يُعرض تحت عنوان المقطع (كاست آمن لتوازي العقد). */
  bodyAr?: string;
  bodyEn?: string;
}

interface InitiativePageConfig {
  layout?: PageLayout;
  heroTitleAr?: string; heroTitleEn?: string;
  heroSubtitleAr?: string; heroSubtitleEn?: string;
  ctaPrimaryLabelAr?: string; ctaPrimaryLabelEn?: string;
  ctaSecondaryLabelAr?: string; ctaSecondaryLabelEn?: string;
  galleryImages?: string[];
  sections?: PageSectionConfig[];
}

/** CustomizationShape من العقد (contracts/api.contracts.ts) + حقل page الاختياري. */
type CustomizationWithPage = CustomizationShape & { page?: InitiativePageConfig };

function str(v: unknown): string { return typeof v === 'string' ? v : ''; }

function normSectionId(s: { id?: unknown; kind?: unknown }): SectionId | null {
  const cands = [s.kind, s.id, typeof s.id === 'string' ? s.id.replace(/^sec-/, '') : ''];
  for (const c of cands) {
    if (typeof c === 'string' && (SECTION_IDS as string[]).includes(c)) return c as SectionId;
  }
  return null;
}

/** قراءة آمنة لحقلي bodyAr/bodyEn (توازي العقد: قد يضيفهما وكيل آخر — typeof string وإلا تجاهل). */
function optBody(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  return v;
}

/** نص المقطع باللغة الحالية مع fallback للغة الأخرى عند فراغها. */
function sectionBodyText(s: Pick<PageSectionConfig, 'bodyAr' | 'bodyEn'>, isAr: boolean): string {
  const ar = typeof s.bodyAr === 'string' ? s.bodyAr.trim() : '';
  const en = typeof s.bodyEn === 'string' ? s.bodyEn.trim() : '';
  return isAr ? (ar || en) : (en || ar);
}

function readPageConfig(initiative: Initiative): { layout: PageLayout; galleryImages: string[]; sections: PageSectionConfig[]; hero: { titleAr: string; titleEn: string; subtitleAr: string; subtitleEn: string; ctaPrimaryAr: string; ctaPrimaryEn: string; ctaSecondaryAr: string; ctaSecondaryEn: string } } {
  const legacy = { ...DEFAULT_CUSTOMIZATION, ...(initiative.customization || {}) };
  const raw = (initiative.customization as unknown as CustomizationWithPage | undefined)?.page;
  const layout: PageLayout = raw?.layout === 'spotlight' || raw?.layout === 'compact' ? raw.layout : 'standard';
  const galleryImages = Array.isArray((raw as { galleryImages?: unknown })?.galleryImages)
    ? ((raw as { galleryImages?: unknown }).galleryImages as string[]).filter(x => typeof x === 'string' && x.length > 0)
    : (Array.isArray((raw as unknown as { gallery?: unknown })?.gallery) ? (((raw as unknown as { gallery?: unknown }).gallery) as string[]).filter(x => typeof x === 'string' && x.length > 0) : []);
  const hero = {
    titleAr: str(raw?.heroTitleAr) || initiative.titleAr,
    titleEn: str(raw?.heroTitleEn) || initiative.titleEn,
    subtitleAr: str(raw?.heroSubtitleAr) || initiative.taglineAr || initiative.descriptionAr,
    subtitleEn: str(raw?.heroSubtitleEn) || initiative.taglineEn || initiative.descriptionEn,
    ctaPrimaryAr: str(raw?.ctaPrimaryLabelAr),
    ctaPrimaryEn: str(raw?.ctaPrimaryLabelEn),
    ctaSecondaryAr: str(raw?.ctaSecondaryLabelAr),
    ctaSecondaryEn: str(raw?.ctaSecondaryLabelEn),
  };

  if (Array.isArray(raw?.sections) && raw.sections.length > 0) {
    const seen = new Set<string>();
    const sections = (raw.sections as Array<{ id?: unknown; kind?: unknown; visible?: unknown; order?: unknown; titleAr?: unknown; titleEn?: unknown; bodyAr?: unknown; bodyEn?: unknown }>)
      .map((s, i) => {
        if (!s || typeof s !== 'object') return null;
        const visible = (s as { visible?: unknown }).visible !== false;
        const order = typeof (s as { order?: unknown }).order === 'number' ? (s as { order: number }).order : i;
        const titleAr = str((s as { titleAr?: unknown }).titleAr) || undefined;
        const titleEn = str((s as { titleEn?: unknown }).titleEn) || undefined;
        const bodyAr = optBody((s as { bodyAr?: unknown }).bodyAr);
        const bodyEn = optBody((s as { bodyEn?: unknown }).bodyEn);
        const id = normSectionId(s);
        if (id) {
          if (seen.has(id)) return null;
          seen.add(id);
          return {
            id,
            kind: typeof s.kind === 'string' && s.kind ? s.kind : id,
            visible,
            order,
            titleAr,
            titleEn,
            bodyAr,
            bodyEn,
          } as PageSectionConfig;
        }
        // مقطع مخصص (kind === 'custom'): يُحفظ عنوانه ونصه وترتيبه وإخفاؤه كما ضبطها الأدمن
        if (typeof s.kind !== 'string' || s.kind !== 'custom') return null;
        const rawId = typeof s.id === 'string' && s.id ? s.id : `sec-custom-${i}`;
        if (seen.has(rawId)) return null;
        seen.add(rawId);
        return { id: rawId, kind: 'custom', visible, order, titleAr, titleEn, bodyAr, bodyEn } as PageSectionConfig;
      })
      .filter((s): s is PageSectionConfig => s !== null);
    // قسم التقديم موجود دائما في النهاية إن لم يذكره الأدمن
    if (!sections.some(s => s.id === 'apply')) {
      sections.push({ id: 'apply', visible: true, order: 999, titleAr: undefined, titleEn: undefined });
    }
    // أقسام وثيقة المبادرة الجديدة: إعدادات محفوظة قبل وجودها لا تذكرها — نضيفها في موضعها المنطقي
    const orderOf = (id: string) => sections.find(s => s.id === id)?.order;
    const place: Array<[SectionId, () => number]> = [
      ['objectives', () => (orderOf('stats') ?? 0) - 0.5],
      ['financing', () => (orderOf('stats') ?? orderOf('benefits') ?? 0) + 0.5],
      ['requirements', () => (orderOf('timeline') ?? orderOf('documents') ?? orderOf('apply') ?? 999) - 0.6],
      ['criteria', () => (orderOf('timeline') ?? orderOf('documents') ?? orderOf('apply') ?? 999) - 0.3],
    ];
    for (const [id, at] of place) {
      if (!sections.some(s => s.id === id)) sections.push({ id, visible: true, order: at() });
    }
    return { layout, galleryImages, sections, hero };
  }

  // افتراضات آمنة من أعلام التخصيص القديمة (الأقسام الفارغة لا تُعرض أصلاً)
  const sections: PageSectionConfig[] = [
    { id: 'objectives', visible: true, order: 0 },
    { id: 'stats', visible: legacy.showImpactMetrics, order: 1 },
    { id: 'financing', visible: true, order: 2 },
    { id: 'benefits', visible: legacy.showBenefits, order: 3 },
    { id: 'requirements', visible: true, order: 4 },
    { id: 'criteria', visible: true, order: 5 },
    { id: 'timeline', visible: legacy.showTimeline, order: 6 },
    { id: 'documents', visible: true, order: 7 },
    { id: 'faqs', visible: legacy.showFaqs, order: 8 },
    { id: 'partners', visible: legacy.showPartners, order: 9 },
    ...(galleryImages.length > 0 ? [{ id: 'gallery' as SectionId, visible: true, order: 10 }] : []),
    { id: 'apply', visible: true, order: 11 },
  ];
  return { layout, galleryImages, sections, hero };
}

const DEFAULT_SECTION_TITLES: Record<SectionId, { ar: string; en: string }> = {
  objectives: { ar: 'المستهدفات الرئيسية', en: 'Key Objectives' },
  financing: { ar: 'المحددات المالية والتمويلية', en: 'Financing Terms' },
  requirements: { ar: 'اشتراطات تأهيل المنشأة والمشروع', en: 'Facility & Project Eligibility Requirements' },
  criteria: { ar: 'معايير اختيار المصانع', en: 'Factory Selection Criteria' },
  stats: { ar: 'الإنجازات والأرقام', en: 'Achievements & Key Figures' },
  benefits: { ar: 'الحوافز والمزايا', en: 'Incentives & Benefits' },
  timeline: { ar: 'مسار العمل والمراحل', en: 'Workflow & Stages' },
  faqs: { ar: 'الأسئلة الشائعة', en: 'Frequently Asked Questions' },
  partners: { ar: 'الجهات الشريكة والمسؤولة', en: 'Partners & Responsible Agencies' },
  gallery: { ar: 'معرض الصور', en: 'Gallery' },
  documents: { ar: 'المستندات المطلوبة', en: 'Required Documents' },
  apply: { ar: 'التقديم على المبادرة', en: 'Apply for the Initiative' },
};

const sectionTitle = (s: PageSectionConfig, isAr: boolean): string => {
  const d = (DEFAULT_SECTION_TITLES as Record<string, { ar: string; en: string }>)[s.id];
  if (d) {
    if (isAr) return s.titleAr || d.ar;
    return s.titleEn || d.en;
  }
  // مقطع مخصص: عنوان الأدمن كما هو، وإلا fallback محايد
  if (isAr) return s.titleAr || s.titleEn || 'قسم مخصص';
  return s.titleEn || s.titleAr || 'Custom section';
};

/**
 * InitiativeDetailPage — صفحة المبادرة المنفصلة، تُصيَّر حسب تخصيص الأدمن
 * (initiative.customization.page: layout + sections). هوية مصرية، RTL/En، متجاوبة.
 */
export const InitiativeDetailPage: React.FC = () => {
  const { initiatives, selectedInitiativeId, language, navigate, currentUser } = usePlatformStore();
  const isAr = language === 'ar';

  const initiative = useMemo(
    () => initiatives.find(i => i.id === selectedInitiativeId) ?? null,
    [initiatives, selectedInitiativeId],
  );

  const [eligibilityOpen, setEligibilityOpen] = useState(false);

  // ---- حالة فارغة: لا مبادرة مختارة أو غائبة ----
  if (!initiative) {
    return (
      <div className="container-custom" style={{ padding: '3rem 1.5rem', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '2.5rem 1.5rem', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--bg-muted)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: 'var(--text-muted)' }}>
            <Inbox size={24} />
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>
            {isAr ? 'المبادرة غير موجودة' : 'Initiative not found'}
          </h2>
          <p style={{ fontSize: '0.87rem', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 1.25rem 0' }}>
            {isAr ? 'ربما حُذفت أو انتهت صلاحية الرابط. عُد إلى الكتالوج واختر مبادرة من القائمة.' : 'It may have been removed or the link expired. Go back to the catalog and pick an initiative.'}
          </p>
          <button className="btn btn-primary" style={{ borderRadius: '9999px' }} onClick={() => navigate('initiatives')}>
            {isAr ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
            <span>{isAr ? 'عودة إلى الكتالوج' : 'Back to Catalog'}</span>
          </button>
        </div>
      </div>
    );
  }

  const custom = { ...DEFAULT_CUSTOMIZATION, ...(initiative.customization || {}) };
  const page = readPageConfig(initiative);
  // مقطع «مسار العمل والمراحل» (timeline) لم يعد يُعرض للعامة — يبقى في الإعدادات المحفوظة فقط لضبط ترتيب المقاطع الأخرى
  const visibleSections = page.sections.filter(s => s.visible && s.id !== 'timeline').sort((a, b) => a.order - b.order);
  const isComingSoon = initiative.status === 'coming_soon';
  const cover = resolveCoverUrl(initiative.coverImage);

  const handleInitiateApply = () => {
    if (currentUser.role === 'factory_owner') {
      navigate('factory-portal', initiative.id);
    } else {
      navigate('login');
    }
  };

  const BackBtn = (
    <button className="btn btn-secondary" style={{ borderRadius: '9999px', fontSize: '0.82rem' }} onClick={() => navigate('initiatives')}>
      {isAr ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
      <span>{isAr ? 'عودة للكتالوج' : 'Back to catalog'}</span>
    </button>
  );

  // ---- الهيرو حسب layout ----
  const heroStandard = (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}>
      <div style={{ height: '300px', position: 'relative', background: 'var(--egypt-black)', overflow: 'hidden' }}>
        <img src={cover} alt={isAr ? initiative.titleAr : initiative.titleEn} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,11,20,0.15) 0%, rgba(7,11,20,0.72) 88%)' }} />
        <div style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '1.25rem 1.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(255,255,255,0.94)', borderRadius: '9999px', padding: '0.24rem 0.65rem', color: '#0F172A' }}>
            <Landmark size={12} />{isAr ? initiative.category : initiative.categoryEn}
          </span>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, margin: '0.55rem 0 0.3rem 0', lineHeight: 1.35, letterSpacing: '-0.015em' }}>
            {isAr ? page.hero.titleAr : page.hero.titleEn}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.9rem', lineHeight: 1.65, margin: 0, maxWidth: '760px' }}>
            {isAr ? page.hero.subtitleAr : page.hero.subtitleEn}
          </p>
        </div>
      </div>
    </div>
  );

  const heroSpotlight = (
    <div className="card detail-spotlight" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-xl)', display: 'grid', gridTemplateColumns: '1.1fr 1fr', background: 'var(--egypt-black)', color: '#fff', border: '1px solid #1E293B' }}>
      <div style={{ padding: '1.75rem 1.75rem 1.5rem 1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start', fontSize: '0.72rem', fontWeight: 700, background: 'var(--gov-gold-light)', color: 'var(--egypt-gold-deep)', border: '1px solid var(--gov-gold-border)', borderRadius: '9999px', padding: '0.24rem 0.7rem' }}>
          <Landmark size={12} />{isAr ? initiative.badgeTextAr : initiative.badgeTextEn}
        </span>
        <h1 style={{ fontSize: '1.55rem', fontWeight: 800, margin: '0.7rem 0 0.4rem 0', lineHeight: 1.35 }}>{isAr ? page.hero.titleAr : page.hero.titleEn}</h1>
        <p style={{ color: 'var(--on-dark-softer)', fontSize: '0.92rem', lineHeight: 1.7, margin: 0 }}>{isAr ? page.hero.subtitleAr : page.hero.subtitleEn}</p>
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
          {custom.enablePreEligibility && (
            <button className="btn btn-gold" style={{ borderRadius: '9999px', fontSize: '0.83rem' }} onClick={() => setEligibilityOpen(true)}>
              <Gauge size={15} /><span>{isAr ? (page.hero.ctaSecondaryAr || 'فحص الأهلية الفوري') : (page.hero.ctaSecondaryEn || 'Instant Eligibility Check')}</span>
            </button>
          )}
          <button className="btn btn-primary" style={{ borderRadius: '9999px', fontSize: '0.83rem', background: 'var(--on-dark-ghost-2)', border: '1px solid var(--on-dark-border-3)' }} onClick={handleInitiateApply} disabled={isComingSoon}>
            <span>{isAr ? (page.hero.ctaPrimaryAr || 'التقديم المباشر') : (page.hero.ctaPrimaryEn || 'Apply Directly')}</span>{isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
          </button>
        </div>
      </div>
      <div style={{ minHeight: '260px', position: 'relative' }}>
        <img src={page.galleryImages[0] || cover} alt={isAr ? initiative.titleAr : initiative.titleEn} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(270deg, transparent 55%, rgba(7,11,20,0.55) 100%)' }} />
      </div>
    </div>
  );

  const heroCompact = (
    <div className="card" style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap', borderInlineStart: '3px solid var(--egypt-red)' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{isAr ? initiative.category : initiative.categoryEn}</div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.15rem 0 0 0', lineHeight: 1.4 }}>{isAr ? page.hero.titleAr : page.hero.titleEn}</h1>
      </div>
      <button className="btn btn-primary" style={{ borderRadius: '9999px', fontSize: '0.82rem' }} onClick={handleInitiateApply} disabled={isComingSoon}>
        <span>{isAr ? (page.hero.ctaPrimaryAr || 'التقديم') : (page.hero.ctaPrimaryEn || 'Apply')}</span>{isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
      </button>
    </div>
  );

  // ---- كتلة «عن المبادرة» — ثابتة قبل المقاطع ----
  const aboutBlock = (
    <div className="card" style={{ padding: '1.35rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
      <h2 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--gov-primary-900)', margin: '0 0 0.5rem 0' }}>
        {isAr ? 'عن المبادرة والأهداف الوطنية' : 'About the National Initiative'}
      </h2>
      <p style={{ color: 'var(--text-body)', fontSize: '0.9rem', lineHeight: 1.75, margin: 0 }}>
        {isAr ? initiative.descriptionAr : initiative.descriptionEn}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem', marginTop: '1rem' }}>
        <div style={{ background: 'var(--bg-app)', padding: '0.9rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div className="emblem-accent" style={{ marginBottom: '0.3rem' }}><Percent size={12} /><span>{isAr ? 'إجمالي المخصصات' : 'Total Budget'}</span></div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gov-gold-bright)', fontVariantNumeric: 'tabular-nums' }}>
            {formatBillions(initiative.budgetTotalEGP, isAr)} {isAr ? 'مليار جنيه' : 'Billion EGP'}
          </div>
        </div>
        <div style={{ background: 'var(--bg-app)', padding: '0.9rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{isAr ? 'القطاعات المستهدفة' : 'Target Sectors'}</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gov-primary-800)', marginTop: '0.25rem', lineHeight: 1.6 }}>
            {isAr ? (initiative.targetSectors ?? []).join('، ') : (initiative.targetSectorsEn ?? []).join(', ')}
          </div>
        </div>
      </div>
    </div>
  );

  // ---- المقاطع ----
  // نص البند باللغة الحالية مع fallback للأخرى (بيانات الأدمن قد تكون بالعربي فقط)
  const itemText = (it: BilingualItem) => ((isAr ? it.textAr : it.textEn) || it.textAr || it.textEn || '').trim();

  const renderSection = (s: PageSectionConfig) => {
    const title = (
      <h2 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.85rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ width: '3px', height: '18px', background: 'var(--egypt-red)', borderRadius: '9999px', display: 'inline-block', flexShrink: 0 }} />
        {sectionTitle(s, isAr)}
      </h2>
    );
    // نص الأدمن الإضافي: فقرة صغيرة بلون ثانوي تحت العنوان وفوق محتوى المقطع
    const bodyTxt = sectionBodyText(s, isAr);
    const bodyPara = bodyTxt ? (
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.75, margin: '0 0 0.9rem 0', whiteSpace: 'pre-line' }}>
        {bodyTxt}
      </p>
    ) : null;
    // نسخة داكنة الخلفية لمقطع التقديم (apply)
    const bodyParaOnDark = bodyTxt ? (
      <p style={{ fontSize: '0.85rem', color: 'var(--on-dark-softer)', lineHeight: 1.75, margin: '0 0 0.9rem 0', whiteSpace: 'pre-line' }}>
        {bodyTxt}
      </p>
    ) : null;
    switch (s.id) {
      case 'objectives':
      case 'requirements':
      case 'criteria': {
        const items = (s.id === 'objectives' ? initiative.objectives : s.id === 'requirements' ? initiative.eligibilityRequirements : initiative.selectionCriteria) ?? [];
        const list = items.map(itemText).filter(Boolean);
        if (!list.length) return null;
        const Icon = s.id === 'objectives' ? Target : s.id === 'requirements' ? ListChecks : Scale;
        return (
          <section key={s.id}>
            {title}
            {bodyPara}
            <div className="card" style={{ padding: '0.4rem 0', borderRadius: 'var(--radius-md)' }}>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {list.map((t, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.7rem 1.1rem', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '9px', background: s.id === 'objectives' ? 'var(--egypt-red-soft)' : 'var(--gov-primary-100)', color: s.id === 'objectives' ? 'var(--egypt-red)' : 'var(--gov-primary-800)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.78rem', fontWeight: 800 }}>
                      {s.id === 'objectives' ? <Icon size={15} /> : (i + 1).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                    </span>
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-body)', lineHeight: 1.75, paddingTop: '0.15rem' }}>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        );
      }
      case 'financing': {
        const ft = initiative.financialTerms ?? {};
        const facts: Array<{ ar: string; en: string; v: string }> = [
          ...(initiative.budgetTotalEGP ? [{ ar: 'الحد الأقصى لقيمة المبادرة', en: 'Maximum initiative value', v: formatEGP(initiative.budgetTotalEGP, isAr) }] : []),
          ...(ft.financingType ? [{ ar: 'صورة التمويل', en: 'Financing type', v: FINANCING_LABELS[ft.financingType]?.[isAr ? 0 : 1] ?? ft.financingType }] : []),
          ...(ft.currency ? [{ ar: 'عملة التمويل', en: 'Currency', v: ft.currency === 'EGP' ? (isAr ? 'الجنيه المصري' : 'Egyptian pound') : (isAr ? 'الدولار الأمريكي' : 'US dollar') }] : []),
          ...(ft.maxDurationYears ? [{ ar: 'الحد الأقصى لمدة المبادرة', en: 'Maximum duration', v: isAr ? `${ft.maxDurationYears.toLocaleString('ar-EG')} سنوات من تاريخ الإطلاق` : `${ft.maxDurationYears} years from launch` }] : []),
          ...(ft.maxFinancingPerClientEGP ? [{ ar: 'الحد الأقصى لتمويل العميل الواحد', en: 'Max financing per client', v: formatEGP(ft.maxFinancingPerClientEGP, isAr) }] : []),
          ...(ft.maxFinancingPerGroupEGP ? [{ ar: 'الحد الأقصى للعميل والأطراف المرتبطة', en: 'Max for client & related parties', v: formatEGP(ft.maxFinancingPerGroupEGP, isAr) }] : []),
        ];
        const para = (ar?: string, en?: string) => ((isAr ? ar : en) || ar || en || '').trim();
        const notes = [
          { ar: 'الفئة المستفيدة', en: 'Beneficiaries', v: para(ft.beneficiariesAr, ft.beneficiariesEn) },
          { ar: 'غرض التمويل', en: 'Purpose', v: para(ft.purposeAr, ft.purposeEn) },
          { ar: 'ملاحظات', en: 'Notes', v: para(ft.notesAr, ft.notesEn) },
        ].filter(n => n.v);
        // القيمة وحدها معروضة أصلاً في «عن المبادرة» — لا نكرر قسماً بها فقط
        if (facts.length <= 1 && !notes.length) return null;
        return (
          <section key={s.id}>
            {title}
            {bodyPara}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '0.75rem' }}>
              {facts.map(f => (
                <div key={f.en} className="card" style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-md)', borderInlineStart: '3px solid var(--gov-gold-bright)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{isAr ? f.ar : f.en}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--gov-primary-900)', marginTop: '0.25rem', lineHeight: 1.45 }}>{f.v}</div>
                </div>
              ))}
            </div>
            {notes.length > 0 && (
              <div className="card" style={{ padding: '0.9rem 1.1rem', borderRadius: 'var(--radius-md)', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {notes.map(n => (
                  <div key={n.en} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <Banknote size={15} style={{ color: 'var(--gov-gold-dark)', flexShrink: 0, marginTop: '0.25rem' }} />
                    <p style={{ margin: 0, fontSize: '0.87rem', color: 'var(--text-body)', lineHeight: 1.75 }}>
                      <strong style={{ color: 'var(--gov-primary-900)' }}>{isAr ? n.ar : n.en}: </strong>{n.v}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      }
      case 'stats': {
        const m = initiative.impactMetrics;
        if (!m) return null;
        const cards = [
          { icon: BarChart3, ar: 'مصانع مستهدفة', en: 'Target Factories', v: (m.targetFactories ?? 0).toLocaleString(isAr ? 'ar-EG' : 'en-US') },
          ...(m.targetCapacityMW ? [{ icon: Zap, ar: 'القدرة المستهدفة (ميجاوات)', en: 'Target Capacity (MW)', v: m.targetCapacityMW.toLocaleString(isAr ? 'ar-EG' : 'en-US') }] : []),
          ...(m.jobsCreated ? [{ icon: ClipboardList, ar: 'فرص عمل', en: 'Jobs', v: m.jobsCreated.toLocaleString(isAr ? 'ar-EG' : 'en-US') }] : []),
          ...(m.savedEnergyGWh ? [{ icon: Gauge, ar: 'طاقة موفرة (ج.و.س)', en: 'Saved Energy (GWh)', v: String(m.savedEnergyGWh) }] : []),
        ];
        return (
          <section key={s.id}>
            {title}
            {bodyPara}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.8rem' }}>
              {cards.map(c => (
                <div key={c.en} className="card" style={{ padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--egypt-red-soft)', color: 'var(--egypt-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <c.icon size={17} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{isAr ? c.ar : c.en}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{c.v}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      }
      case 'benefits': {
        if (!initiative.benefits?.length) return null;
        return (
          <section key={s.id}>
            {title}
            {bodyPara}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '0.9rem' }}>
              {initiative.benefits.map((b, i) => { const BIcon = benefitIcon(b.iconName); return (
                <div key={i} className="card" style={{ padding: '1.15rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--gov-primary-900)', color: 'var(--gov-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.7rem' }}>
                    <BIcon size={18} />
                  </div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)', margin: '0 0 0.3rem 0' }}>{isAr ? b.titleAr : b.titleEn}</h4>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-body)', lineHeight: 1.65, margin: 0 }}>{isAr ? b.descriptionAr : b.descriptionEn}</p>
                </div>
              ); })}
            </div>
          </section>
        );
      }
      case 'documents': {
        if (!initiative.requiredDocsList?.length) return null;
        return (
          <section key={s.id}>
            {title}
            {bodyPara}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {initiative.requiredDocsList.map((doc, i) => (
                <div key={i} className="card" style={{ padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderInlineStartWidth: '3px', borderInlineStartColor: doc.mandatory ? 'var(--egypt-gold)' : 'var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <FileText size={17} style={{ color: 'var(--gov-primary-700)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--gov-primary-900)' }}>{((isAr ? doc.titleAr : doc.titleEn) || doc.titleAr || '').trim()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.73rem', fontWeight: 700, color: doc.mandatory ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      {doc.mandatory ? (isAr ? 'إلزامي' : 'Mandatory') : (isAr ? 'اختياري' : 'Optional')}
                      {doc.mandatory && <CheckCircle2 size={13} style={{ color: 'var(--egypt-gold)' }} />}
                    </span>
                    {/* الرفع يتم داخل نموذج التقديم — المصنع يُفتح له النموذج، والزائر يُوجَّه لتسجيل الدخول */}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleInitiateApply}
                      disabled={isComingSoon}
                      title={isAr ? 'رفع المستند عند التقديم' : 'Upload when applying'}
                      aria-label={isAr ? `رفع: ${doc.titleAr}` : `Upload: ${doc.titleEn || doc.titleAr}`}
                      style={{ width: '34px', height: '34px', padding: 0, borderRadius: '10px', justifyContent: 'center', color: doc.mandatory ? 'var(--egypt-red)' : 'var(--gov-primary-700)' }}
                    >
                      <Upload size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      }
      case 'faqs': {
        if (!initiative.faqs?.length) return null;
        return (
          <section key={s.id}>
            {title}
            {bodyPara}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {initiative.faqs.map((f, i) => (
                <div key={i} className="card" style={{ padding: '1rem 1.1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: 'var(--gov-primary-900)', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                    <HelpCircle size={15} style={{ color: 'var(--gov-gold-dark)', flexShrink: 0 }} />
                    <span>{isAr ? f.questionAr : f.questionEn}</span>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-body)', lineHeight: 1.65, margin: 0, paddingInlineStart: '1.35rem' }}>{isAr ? f.answerAr : f.answerEn}</p>
                </div>
              ))}
            </div>
          </section>
        );
      }
      case 'partners': {
        if (!initiative.participatingOrgs?.length) return null;
        return (
          <section key={s.id}>
            {title}
            {bodyPara}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {initiative.participatingOrgs.map((org, i) => (
                <span key={i} style={{ background: 'var(--gov-primary-100)', color: 'var(--gov-primary-900)', padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.83rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Building2 size={13} />{org}
                </span>
              ))}
            </div>
          </section>
        );
      }
      case 'gallery': {
        if (!page.galleryImages.length) return null;
        return (
          <section key={s.id}>
            {title}
            {bodyPara}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '0.7rem' }}>
              {page.galleryImages.map((g, i) => (
                <div key={i} className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-md)', height: '150px' }}>
                  <img src={resolveCoverUrl(g)} alt={`${isAr ? initiative.titleAr : initiative.titleEn} — ${i + 1}`} loading="lazy" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </section>
        );
      }
      case 'apply': {
        return (
          <section key={s.id} style={{ background: 'var(--egypt-black)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', color: '#fff', border: '1px solid #1E293B' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>
              {sectionTitle(s, isAr)}
            </h2>
            {bodyParaOnDark}
            <p style={{ fontSize: '0.85rem', color: 'var(--on-dark-softer)', lineHeight: 1.65, margin: '0 0 1.1rem 0', maxWidth: '640px' }}>
              {isAr ? 'تحقق من أهلية منشأتك أولاً ثم قدّم طلبك إلكترونياً — العملية تستغرق دقائق.' : 'Check your factory eligibility first, then submit your application online — it takes minutes.'}
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {custom.enablePreEligibility && (
                <button className="btn btn-gold" style={{ borderRadius: '9999px' }} onClick={() => setEligibilityOpen(true)}>
                  <Gauge size={15} /><span>{isAr ? (page.hero.ctaSecondaryAr || 'فحص الأهلية') : (page.hero.ctaSecondaryEn || 'Check Eligibility')}</span>
                </button>
              )}
              <button className="btn btn-primary" style={{ borderRadius: '9999px', background: 'var(--on-dark-ghost-2)', border: '1px solid var(--on-dark-border-3)', flex: '1 1 200px', maxWidth: '320px', justifyContent: 'center' }} onClick={handleInitiateApply} disabled={isComingSoon}>
                <span>{isAr ? (page.hero.ctaPrimaryAr || 'التقديم الآن') : (page.hero.ctaPrimaryEn || 'Apply Now')}</span>{isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
              </button>
            </div>
          </section>
        );
      }
      default: {
        // مقطع مخصص (kind === 'custom'): عنوان الأدمن + نصه ببطاقة نظيفة
        return (
          <section key={s.id}>
            {title}
            {bodyTxt ? (
              <div className="card" style={{ padding: '1.15rem 1.25rem', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-body)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>
                  {bodyTxt}
                </p>
              </div>
            ) : (
              <div className="card" style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
                  {isAr ? 'لا يوجد محتوى لهذا القسم بعد — أضفه من تصميم الصفحة.' : 'No content for this section yet — add it from Page design.'}
                </p>
              </div>
            )}
          </section>
        );
      }
    }
  };

  return (
    <div className="container-custom" style={{ padding: '1.5rem 1.5rem 3rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1020px' }}>
      <style>{`@media (max-width: 820px){ .detail-spotlight{ grid-template-columns: 1fr !important; } }`}</style>
      <div>{BackBtn}</div>
      {page.layout === 'spotlight' ? heroSpotlight : page.layout === 'compact' ? heroCompact : heroStandard}
      {aboutBlock}
      {visibleSections.map(renderSection)}
      {eligibilityOpen && (
        <PreEligibilityModal
          initiative={initiative}
          onClose={() => setEligibilityOpen(false)}
          onProceedToApply={() => { setEligibilityOpen(false); handleInitiateApply(); }}
        />
      )}
    </div>
  );
};
