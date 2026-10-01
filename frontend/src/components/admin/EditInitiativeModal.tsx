import React, { useEffect, useState } from 'react';
import { Initiative, InitiativeCustomization, InitiativeStatus, DEFAULT_CUSTOMIZATION, FormSection, BilingualItem, FinancialTerms, InitiativeKpi } from '../../types';
import { resolveCoverUrl } from '../../api';
import { api } from '../../api';
import { usePlatformStore, store } from '../../store/state';
import { ApiException } from '../../api/client';
import { useToast } from '../common/ToastSystem';
import { ErrorBox } from '../ui/ErrorBox';
import { Modal } from '../ui/Modal';

import { ImageUpload } from '../ui/ImageUpload';
import { FormSchemaBuilder } from './FormSchemaBuilder';
import { SectionCard } from './initiative-editor/SectionCard';
import { MoneyInput } from './initiative-editor/MoneyInput';
import { UnitInput } from './initiative-editor/UnitInput';
import { BilingualListEditor } from './initiative-editor/BilingualListEditor';
import { GovernoratePicker } from './initiative-editor/GovernoratePicker';
import { KpiEditor } from './initiative-editor/KpiEditor';
import { BENEFIT_ICONS } from '../ui/benefitIcons';
import { formatBillions } from '../../utils/format';
import {
  Save,
  Image as ImageIcon,
  Check,
  Eye,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  LayoutTemplate,
  Info,
  Target,
  Banknote,
  MapPin,
  ClipboardCheck,
  ListChecks,
  Route,
  BarChart3,
  Gift,
  HelpCircle,
  Gauge,
  FileInput,
  FileText,
  FileUp,
  Settings2,
  Lock,
  ExternalLink,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

interface EditInitiativeModalProps {
  /** null = وضع إنشاء مبادرة جديدة من الأدمن */
  initiative: Initiative | null;
  onClose: () => void;
  /** modal (افتراضي) أو page داخل مساحة المبادرة في الأدمن */
  variant?: "modal" | "page";
  initialTab?: Tab;
  onTabChange?: (t: Tab) => void;
  /** وضع الصفحة: بعد الحفظ بدل الإغلاق */
  onSaved?: () => void;
  /** إعادة تحميل أحدث نسخة من الباك (بعد تعارض 409) */
  onReloadLatest?: () => void;
}

// Sovereign offline cover library — local /covers/*.svg assets (no external URLs)
const INDUSTRIAL_IMAGE_PRESETS = [
  { id: 'solar-park', labelAr: 'محطة طاقة شمسية صناعية', labelEn: 'Industrial Solar Plant', url: resolveCoverUrl('/covers/solar-2026.jpg') },
  { id: 'factory-robots', labelAr: 'خط إنتاج روبوتي مؤتمت', labelEn: 'Automated Robotics Line', url: resolveCoverUrl('/covers/modernization-2026.jpg') },
  { id: 'heavy-industry', labelAr: 'مجمع تصنيع وتعميق محلي', labelEn: 'Heavy Manufacturing & Localization', url: resolveCoverUrl('/covers/import-substitution-2026.jpg') }
];

// قوالب المستندات الصناعية الشائعة للإضافة السريعة بنقرة واحدة
const COMMON_DOC_PRESETS = [
  { code: 'CR_COPY', titleAr: 'سجل تجاري ساري', titleEn: 'Valid Commercial Register', mandatory: true },
  { code: 'IND_LIC', titleAr: 'سجل صناعي ورخصة تشغيل سارية', titleEn: 'Industrial Register & Operating License', mandatory: true },
  { code: 'ELEC_BILLS_12', titleAr: 'فواتير الكهرباء لآخر 12 شهراً', titleEn: 'Last 12 Months Electricity Bills', mandatory: true },
  { code: 'FIN_STATEMENTS_3Y', titleAr: 'القوائم المالية المدققة لآخر 3 سنوات', titleEn: 'Audited Financial Statements (Last 3 Years)', mandatory: true },
  { code: 'STRUCT_REPORT', titleAr: 'تقرير إنشائي معتمد للمنشأة والأسطح', titleEn: 'Certified Structural Suitability Report', mandatory: false },
  { code: 'FEASIBILITY_STUDY', titleAr: 'دراسة جدوى فنية واقتصادية معتمدة', titleEn: 'Technical & Economic Feasibility Study', mandatory: false },
  { code: 'TAX_CARD', titleAr: 'البطاقة الضريبية وشهادة التسجيل بالقيمة المضافة', titleEn: 'Tax Card & VAT Registration Certificate', mandatory: true },
  { code: 'DEED_OR_LEASE', titleAr: 'إثبات الملكية أو عقد إيجار ساري للمنشأة', titleEn: 'Property Deed or Valid Lease Agreement', mandatory: true },
];

// التابات بنفس ترتيب وثيقة المبادرة الرسمية (الهدف ← المحددات المالية ← الاشتراطات ← المستندات ← المعايير ← المسار ← المؤشرات)
export type EditorTab = Tab;
type Tab = 'basic' | 'goals' | 'financial' | 'targeting' | 'requirements' | 'documents' | 'criteria' | 'execution' | 'kpis'
  | 'benefits' | 'faqs' | 'eligibility' | 'form' | 'custom';

type EligOption = { labelAr: string; labelEn: string; value: string; isEligible: boolean };

const FINANCING_TYPES: ReadonlyArray<{ value: NonNullable<FinancialTerms['financingType']>; ar: string; en: string }> = [
  { value: 'bank_loans', ar: 'قروض من الجهاز المصرفي', en: 'Bank loans' },
  { value: 'grants', ar: 'منح', en: 'Grants' },
  { value: 'subsidy', ar: 'دعم / حوافز', en: 'Subsidy / incentives' },
  { value: 'mixed', ar: 'مختلط', en: 'Mixed' },
];

const cleanItems = (items: BilingualItem[]): BilingualItem[] =>
  items.map(x => ({ textAr: x.textAr.trim(), textEn: x.textEn.trim() })).filter(x => x.textAr || x.textEn);

const splitLines = (s: string): string[] => s.split('\n').map(x => x.trim()).filter(Boolean);
const joinLines = (arr: string[]): string => (arr ?? []).join('\n');

const EditInitiativeForm: React.FC<EditInitiativeModalProps> = ({ initiative, onClose, variant = "modal", initialTab, onTabChange, onSaved, onReloadLatest }) => {
  const { toast } = useToast();
  const { language, organizations, navigate } = usePlatformStore();
  const isAr = language === 'ar';
  const isCreate = !initiative;

  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'basic');
  useEffect(() => { onTabChange?.(activeTab); }, [activeTab, onTabChange]);
  const [conflict, setConflict] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // ---- basic ----
  const [formData, setFormData] = useState({
    titleAr: initiative?.titleAr ?? '',
    titleEn: initiative?.titleEn ?? '',
    slug: initiative?.slug ?? '',
    taglineAr: initiative?.taglineAr ?? '',
    taglineEn: initiative?.taglineEn ?? '',
    category: initiative?.category ?? '',
    categoryEn: initiative?.categoryEn ?? '',
    status: (initiative?.status ?? 'draft') as InitiativeStatus,
    budgetTotalEGP: initiative?.budgetTotalEGP ?? 0,
    coverImage: initiative?.coverImage ?? '/covers/solar-2026.svg',
    badgeTextAr: initiative?.badgeTextAr ?? '',
    badgeTextEn: initiative?.badgeTextEn ?? ''
  });

  // ---- content: كل بيانات المبادرة القابلة للتحكم ----
  const [content, setContent] = useState({
    descriptionAr: initiative?.descriptionAr ?? '',
    descriptionEn: initiative?.descriptionEn ?? '',
    targetSectors: joinLines(initiative?.targetSectors ?? []),
    targetSectorsEn: joinLines(initiative?.targetSectorsEn ?? []),
    participatingOrgs: joinLines(initiative?.participatingOrgs ?? []),
    budgetAllocatedEGP: initiative?.budgetAllocatedEGP ?? 0,
    startDate: initiative?.startDate ?? '',
    endDate: initiative?.endDate ?? '',
    targetFactories: initiative?.impactMetrics?.targetFactories ?? 0,
    benefitedFactories: initiative?.impactMetrics?.benefitedFactories ?? 0,
    targetCapacityMW: initiative?.impactMetrics?.targetCapacityMW ?? 0,
    savedEnergyGWh: initiative?.impactMetrics?.savedEnergyGWh ?? 0,
    investmentStimulatedEGP: initiative?.impactMetrics?.investmentStimulatedEGP ?? 0,
    jobsCreated: initiative?.impactMetrics?.jobsCreated ?? 0,
    executionNotesAr: initiative?.executionNotesAr ?? '',
    executionNotesEn: initiative?.executionNotesEn ?? '',
  });
  const [governorates, setGovernorates] = useState<string[]>(initiative?.targetGovernorates ?? []);

  // ---- أقسام وثيقة المبادرة: المستهدفات / المحددات المالية / الاشتراطات / المعايير ----
  const [objectives, setObjectives] = useState<BilingualItem[]>(initiative?.objectives ?? []);
  const [requirements, setRequirements] = useState<BilingualItem[]>(initiative?.eligibilityRequirements ?? []);
  const [criteria, setCriteria] = useState<BilingualItem[]>(initiative?.selectionCriteria ?? []);
  const [financial, setFinancial] = useState<FinancialTerms>({ financingType: 'bank_loans', currency: 'EGP', ...(initiative?.financialTerms ?? {}) });
  const setF = (patch: Partial<FinancialTerms>) => setFinancial(prev => ({ ...prev, ...patch }));

  // ---- مؤشرات قياس الأداء: ADMIN ONLY — تُحمَّل من راوت مخصص (لا تأتي مع المبادرة العامة) ----
  const [kpis, setKpis] = useState<InitiativeKpi[]>([]);
  const [kpisState, setKpisState] = useState<'loading' | 'ready' | 'error'>(isCreate ? 'ready' : 'loading');
  useEffect(() => {
    if (isCreate) return;
    let cancelled = false;
    api.getInitiativeKpis(initiative!.id)
      .then(r => { if (!cancelled) { setKpis((r.data ?? []) as InitiativeKpi[]); setKpisState('ready'); } })
      .catch(() => { if (!cancelled) setKpisState('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- benefits / faqs / docs ----
  const [benefits, setBenefits] = useState((initiative?.benefits ?? []).map(b => ({ ...b })));
  const [faqs, setFaqs] = useState((initiative?.faqs ?? []).map(f => ({ ...f })));
  const [docs, setDocs] = useState((initiative?.requiredDocsList ?? []).map(d => ({ ...d })));

  // ---- pre-eligibility: خيارات select كصفوف منظمة (بدل صيغة labelAr|labelEn|value|1) ----
  const [eligibility, setEligibility] = useState(
    (initiative?.preEligibilityQuestions ?? []).map(q => ({
      ...q,
      _options: (q.options ?? []).map(o => ({ ...o })) as EligOption[],
      _expected: q.type === 'boolean' ? String(q.expectedValue ?? 'true') : String(q.expectedValue ?? ''),
    }))
  );
  const setQ = (i: number, patch: Record<string, unknown>) =>
    setEligibility(eligibility.map((x: any, j: number) => (j === i ? { ...x, ...patch } : x)));

  // ---- formSections: نسخة قابلة للتحرير الكامل (يحررها FormSchemaBuilder) ----
  // يدعم البنية القديمة (_optionsText كنص سطور) عبر ترحيلها لخيارات منظمة.
  const [sections, setSections] = useState<FormSection[]>(() =>
    (initiative?.formSections ?? []).map((s: any) => ({
      id: s.id || `sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      titleAr: s.titleAr ?? '',
      titleEn: s.titleEn ?? '',
      descriptionAr: s.descriptionAr ?? '',
      descriptionEn: s.descriptionEn ?? '',
      fields: (s.fields ?? []).map((f: any) => ({
        id: f.id || `fld-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        labelAr: f.labelAr ?? '',
        labelEn: f.labelEn ?? '',
        type: f.type ?? 'text',
        required: !!f.required,
        placeholderAr: f.placeholderAr,
        placeholderEn: f.placeholderEn,
        helpTextAr: f.helpTextAr,
        helpTextEn: f.helpTextEn,
        min: f.min,
        max: f.max,
        defaultValue: f.defaultValue,
        category: f.category,
        condition: f.condition,
        options: Array.isArray(f.options)
          ? f.options.map((o: any, i: number) => typeof o === 'string'
              ? { labelAr: o, labelEn: o, value: o }
              : { labelAr: o.labelAr ?? o.value ?? `opt-${i}`, labelEn: o.labelEn ?? o.value ?? `opt-${i}`, value: o.value ?? `opt-${i}` })
          : typeof f._optionsText === 'string' && f._optionsText.trim()
            ? f._optionsText.split('\n').map((v: string) => v.trim()).filter(Boolean).map((v: string) => ({ labelAr: v, labelEn: v, value: v }))
            : undefined,
      })),
    })),
  );

  const [custom, setCustom] = useState<InitiativeCustomization>({ ...DEFAULT_CUSTOMIZATION, ...(initiative?.customization || {}) });
  const setC = (patch: Partial<InitiativeCustomization>) => setCustom(prev => ({ ...prev, ...patch }));

  // ---- page design: تخصيص شكل صفحة كل مبادرة (يُدمج داخل customization.page عند الحفظ) ----
  // CustomizationShape قد يضيف لاحقاً حقل page — نتعامل مع غيابه بأمان عبر any الاختياري.
  type PageLayout = 'standard' | 'spotlight' | 'compact';
  type PageSectionKey = 'objectives' | 'stats' | 'financing' | 'benefits' | 'requirements' | 'criteria' | 'timeline' | 'faqs' | 'partners' | 'gallery' | 'documents' | 'apply';
  type PageSectionCfg = { key: PageSectionKey; visible: boolean; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };
  type PageDesignState = {
    layout: PageLayout;
    heroTitleAr: string; heroTitleEn: string;
    heroSubtitleAr: string; heroSubtitleEn: string;
    ctaPrimaryLabelAr: string; ctaPrimaryLabelEn: string;
    ctaSecondaryLabelAr: string; ctaSecondaryLabelEn: string;
    sections: PageSectionCfg[];
  };
  const PAGE_SECTION_KEYS: PageSectionKey[] = ['objectives', 'stats', 'financing', 'benefits', 'requirements', 'criteria', 'timeline', 'faqs', 'partners', 'gallery', 'documents', 'apply'];
  const PAGE_SECTION_DEFAULT_TITLES: Record<PageSectionKey, [string, string]> = {
    objectives: ['المستهدفات الرئيسية', 'Key Objectives'],
    financing: ['المحددات المالية والتمويلية', 'Financing Terms'],
    requirements: ['اشتراطات التأهيل', 'Eligibility Requirements'],
    criteria: ['معايير اختيار المصانع', 'Selection Criteria'],
    stats: ['المؤشرات', 'Stats'],
    benefits: ['المزايا', 'Benefits'],
    timeline: ['الخط الزمني', 'Timeline'],
    faqs: ['الأسئلة الشائعة', 'FAQs'],
    partners: ['الشركاء', 'Partners'],
    gallery: ['المعرض', 'Gallery'],
    documents: ['المستندات', 'Documents'],
    apply: ['التقديم', 'Apply'],
  };
  const defaultPageDesign = (): PageDesignState => ({
    layout: 'standard',
    heroTitleAr: '', heroTitleEn: '',
    heroSubtitleAr: '', heroSubtitleEn: '',
    ctaPrimaryLabelAr: '', ctaPrimaryLabelEn: '',
    ctaSecondaryLabelAr: '', ctaSecondaryLabelEn: '',
    sections: PAGE_SECTION_KEYS.map(k => ({ key: k, visible: true, titleAr: PAGE_SECTION_DEFAULT_TITLES[k][0], titleEn: PAGE_SECTION_DEFAULT_TITLES[k][1], bodyAr: '', bodyEn: '' })),
  });
  const initialPageDesign = (): PageDesignState => {
    const base = defaultPageDesign();
    const raw = (initiative?.customization as any)?.page;
    if (!raw || typeof raw !== 'object') return base;
    const secs: PageSectionCfg[] = Array.isArray(raw.sections) && raw.sections.length
      ? (raw.sections as any[])
          .map(s => {
            if (!s || typeof s !== 'object') return null;
            const k = (PAGE_SECTION_KEYS as string[]).includes(s.kind) ? s.kind
              : ((PAGE_SECTION_KEYS as string[]).includes(s.key) ? s.key
              : ((typeof s.id === 'string' && (PAGE_SECTION_KEYS as string[]).includes(s.id.replace(/^sec-/, ''))) ? s.id.replace(/^sec-/, '') : null));
            if (!k) return null;
            return {
              key: k as PageSectionKey,
              visible: s.visible !== false,
              titleAr: typeof s.titleAr === 'string' ? s.titleAr : (PAGE_SECTION_DEFAULT_TITLES[k as PageSectionKey]?.[0] ?? ''),
              titleEn: typeof s.titleEn === 'string' ? s.titleEn : (PAGE_SECTION_DEFAULT_TITLES[k as PageSectionKey]?.[1] ?? ''),
              // توافق مع بيانات بلا body + عقد قد يضيف bodyAr/bodyEn (كاست آمن)
              bodyAr: typeof s.bodyAr === 'string' ? s.bodyAr : '',
              bodyEn: typeof s.bodyEn === 'string' ? s.bodyEn : '',
            } as PageSectionCfg;
          })
          .filter((s): s is PageSectionCfg => s !== null)
      : base.sections;
    // أقسام جديدة غير محفوظة سابقاً تُضاف قبل «التقديم» (لا بعده) حتى يبقى التقديم آخر الصفحة
    for (const k of PAGE_SECTION_KEYS) {
      if (secs.some(s => s.key === k)) continue;
      const item: PageSectionCfg = { key: k, visible: true, titleAr: PAGE_SECTION_DEFAULT_TITLES[k][0], titleEn: PAGE_SECTION_DEFAULT_TITLES[k][1], bodyAr: '', bodyEn: '' };
      const applyIdx = secs.findIndex(s => s.key === 'apply');
      if (k !== 'apply' && applyIdx >= 0) secs.splice(applyIdx, 0, item); else secs.push(item);
    }
    const pick = (v: unknown, fb: string) => (typeof v === 'string' ? v : fb);
    return {
      layout: raw.layout === 'spotlight' || raw.layout === 'compact' ? raw.layout : 'standard',
      heroTitleAr: pick(raw.heroTitleAr, ''), heroTitleEn: pick(raw.heroTitleEn, ''),
      heroSubtitleAr: pick(raw.heroSubtitleAr, ''), heroSubtitleEn: pick(raw.heroSubtitleEn, ''),
      ctaPrimaryLabelAr: pick(raw.ctaPrimaryLabelAr, ''), ctaPrimaryLabelEn: pick(raw.ctaPrimaryLabelEn, ''),
      ctaSecondaryLabelAr: pick(raw.ctaSecondaryLabelAr, ''), ctaSecondaryLabelEn: pick(raw.ctaSecondaryLabelEn, ''),
      sections: secs,
    };
  };
  const [page, setPage] = useState<PageDesignState>(initialPageDesign);
  const [galleryText, setGalleryText] = useState(() => {
    const pg = (initiative?.customization as any)?.page as { galleryImages?: unknown; gallery?: unknown } | undefined;
    const arr = (Array.isArray(pg?.galleryImages) ? pg.galleryImages : (Array.isArray(pg?.gallery) ? pg.gallery : [])) as unknown[];
    return joinLines(arr.filter(x => typeof x === 'string') as string[]);
  });
  const [pageOpen, setPageOpen] = useState(true);
  const setP = (patch: Partial<PageDesignState>) => setPage(prev => ({ ...prev, ...patch }));
  const setPageSection = (key: PageSectionKey, patch: Partial<PageSectionCfg>) =>
    setPage(prev => ({ ...prev, sections: prev.sections.map(s => (s.key === key ? { ...s, ...patch } : s)) }));
  const movePageSection = (idx: number, dir: -1 | 1) => {
    setPage(prev => {
      const j = idx + dir;
      if (j < 0 || j >= prev.sections.length) return prev;
      const next = [...prev.sections];
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...prev, sections: next };
    });
  };



  const buildBody = () => ({
    titleAr: formData.titleAr.trim(),
    titleEn: formData.titleEn.trim(),
    slug: formData.slug.trim() || undefined,
    taglineAr: formData.taglineAr, taglineEn: formData.taglineEn,
    descriptionAr: content.descriptionAr, descriptionEn: content.descriptionEn,
    category: formData.category, categoryEn: formData.categoryEn,
    status: formData.status,
    targetSectors: splitLines(content.targetSectors),
    targetSectorsEn: splitLines(content.targetSectorsEn),
    targetGovernorates: governorates,
    participatingOrgs: splitLines(content.participatingOrgs),
    budgetTotalEGP: Number(formData.budgetTotalEGP) || 0,
    budgetAllocatedEGP: Number(content.budgetAllocatedEGP) || 0,
    startDate: content.startDate || undefined, endDate: content.endDate || undefined,
    coverImage: formData.coverImage,
    badgeTextAr: formData.badgeTextAr, badgeTextEn: formData.badgeTextEn,
    benefits: benefits.map(b => ({ titleAr: b.titleAr, titleEn: b.titleEn, descriptionAr: b.descriptionAr, descriptionEn: b.descriptionEn, iconName: b.iconName || 'Sparkles' })),
    faqs: faqs.map(f => ({ questionAr: f.questionAr, questionEn: f.questionEn, answerAr: f.answerAr, answerEn: f.answerEn })),
    preEligibilityQuestions: eligibility.map((q: any, qi: number) => ({
      id: q.id || `q-${Date.now().toString(36)}-${qi}`, // بلا id كانت الأسئلة تتشارك إجابة واحدة في فحص الأهلية
      questionAr: q.questionAr, questionEn: q.questionEn, type: q.type,
      explanationAr: q.explanationAr || '', explanationEn: q.explanationEn || '',
      ...(q.type === 'select'
        ? { options: ((q._options ?? []) as EligOption[])
            .filter(o => o.labelAr.trim() || o.labelEn.trim())
            .map((o, i) => ({
              labelAr: o.labelAr.trim() || o.labelEn.trim(),
              labelEn: o.labelEn.trim() || o.labelAr.trim(),
              value: o.value?.trim() || `opt-${i + 1}`,
              isEligible: !!o.isEligible,
            })) }
        : q.type === 'boolean'
          ? { expectedValue: q._expected === 'true' }
          : q._expected ? { expectedValue: q._expected } : {}),
    })),
    requiredDocsList: docs.map(d => ({ code: d.code, titleAr: d.titleAr, titleEn: d.titleEn, mandatory: !!d.mandatory })),
    formSections: sections.map(s => ({
      id: s.id,
      titleAr: s.titleAr.trim(),
      titleEn: s.titleEn.trim(),
      descriptionAr: s.descriptionAr?.trim() || '',
      descriptionEn: s.descriptionEn?.trim() || '',
      fields: s.fields.map(f => ({
        id: f.id,
        labelAr: f.labelAr.trim(),
        labelEn: f.labelEn.trim(),
        type: f.type,
        required: !!f.required,
        ...(f.placeholderAr?.trim() ? { placeholderAr: f.placeholderAr.trim() } : {}),
        ...(f.placeholderEn?.trim() ? { placeholderEn: f.placeholderEn.trim() } : {}),
        ...(f.helpTextAr?.trim() ? { helpTextAr: f.helpTextAr.trim() } : {}),
        ...(f.helpTextEn?.trim() ? { helpTextEn: f.helpTextEn.trim() } : {}),
        ...(f.min !== undefined && f.min !== null && (f.min as unknown as string) !== '' ? { min: Number(f.min) } : {}),
        ...(f.max !== undefined && f.max !== null && (f.max as unknown as string) !== '' ? { max: Number(f.max) } : {}),
        ...(f.defaultValue !== undefined && f.defaultValue !== '' ? { defaultValue: f.defaultValue } : {}),
        ...(f.category?.trim() ? { category: f.category.trim() } : {}),
        ...((['select', 'multi_select', 'radio'].includes(f.type) && f.options?.length)
          ? { options: f.options.filter(o => o.value.trim() || o.labelAr.trim() || o.labelEn.trim()).map(o => ({
              labelAr: o.labelAr.trim() || o.value.trim(),
              labelEn: o.labelEn.trim() || o.value.trim(),
              value: o.value.trim() || o.labelEn.trim() || o.labelAr.trim(),
            })) } : {}),
        ...(f.condition?.fieldId ? { condition: f.condition } : {}),
      })),
    })),
    impactMetrics: {
      targetFactories: Number(content.targetFactories) || 0,
      benefitedFactories: Number(content.benefitedFactories) || 0,
      targetCapacityMW: Number(content.targetCapacityMW) || 0,
      savedEnergyGWh: Number(content.savedEnergyGWh) || 0,
      investmentStimulatedEGP: Number(content.investmentStimulatedEGP) || 0,
      jobsCreated: Number(content.jobsCreated) || 0,
    },
    objectives: cleanItems(objectives),
    eligibilityRequirements: cleanItems(requirements),
    selectionCriteria: cleanItems(criteria),
    financialTerms: {
      ...financial,
      beneficiariesAr: financial.beneficiariesAr?.trim() ?? '', beneficiariesEn: financial.beneficiariesEn?.trim() ?? '',
      purposeAr: financial.purposeAr?.trim() ?? '', purposeEn: financial.purposeEn?.trim() ?? '',
      notesAr: financial.notesAr?.trim() ?? '', notesEn: financial.notesEn?.trim() ?? '',
    },
    executionNotesAr: content.executionNotesAr.trim(),
    executionNotesEn: content.executionNotesEn.trim(),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const body = buildBody();
      if (body.titleAr.length < 3 || body.titleEn.length < 3) throw new Error(isAr ? 'عنوان المبادرة عربي وإنجليزي مطلوب (3 أحرف على الأقل).' : 'Title AR/EN required (min 3).');
      // ── Form schema validation ──
      for (let si = 0; si < body.formSections.length; si++) {
        const s = body.formSections[si];
        if (!s.titleAr || !s.titleEn) throw new Error(isAr ? `عنوان القسم ${si + 1} عربي وإنجليزي مطلوب.` : `Section ${si + 1} title AR/EN required.`);
        for (let fi = 0; fi < s.fields.length; fi++) {
          const f = s.fields[fi] as { labelAr: string; labelEn: string; type: string; options?: { value: string }[] };
          if (!f.labelAr || !f.labelEn) throw new Error(isAr ? `تسمية الحقل ${fi + 1} في القسم ${si + 1} ناقصة (عربي وإنجليزي).` : `Field ${fi + 1} in section ${si + 1} needs AR/EN labels.`);
          if (['select', 'multi_select', 'radio'].includes(f.type) && (f.options ?? []).length < 2)
            throw new Error(isAr ? `حقل «${f.labelAr}» يحتاج خيارين على الأقل.` : `Field "${f.labelEn}" needs at least 2 options.`);
        }
      }
      // مؤشرات الأداء: اسم عربي لكل مؤشر (نفس تحقق الباك) — ننقل الأدمن للتاب بدل رسالة مبهمة
      const kpiPayload = kpis.map(k => ({ ...k, nameAr: k.nameAr.trim(), nameEn: k.nameEn.trim() }));
      const badKpi = kpiPayload.findIndex(k => !k.nameAr);
      if (badKpi >= 0) {
        setActiveTab('kpis');
        throw new Error(isAr ? `اسم المؤشر ${badKpi + 1} بالعربي مطلوب.` : `KPI ${badKpi + 1} needs an Arabic name.`);
      }
      if (isCreate) {
        const created = await api.createInitiative(body as any);
        if (kpiPayload.length) await api.updateInitiativeKpis(created.data.id, { kpis: kpiPayload });
      } else {
        // expectedUpdatedAt: الباك يرفض (409) لو المبادرة اتعدلت بعد ما المحرر فتح عليها
        await api.updateInitiative(initiative!.id, { ...body, expectedUpdatedAt: initiative!.updatedAt } as any);
        // لا نكتب فوق المؤشرات إن فشل تحميلها (حتى لا تُمسح بقائمة فارغة)
        if (kpisState === 'ready') await api.updateInitiativeKpis(initiative!.id, { kpis: kpiPayload });
        // دمج تصميم الصفحة داخل customization دون المساس بباقي الحقول
        const pagePayload = {
          layout: page.layout,
          heroTitleAr: page.heroTitleAr.trim(), heroTitleEn: page.heroTitleEn.trim(),
          heroSubtitleAr: page.heroSubtitleAr.trim(), heroSubtitleEn: page.heroSubtitleEn.trim(),
          ctaPrimaryLabelAr: page.ctaPrimaryLabelAr.trim(), ctaPrimaryLabelEn: page.ctaPrimaryLabelEn.trim(),
          ctaSecondaryLabelAr: page.ctaSecondaryLabelAr.trim(), ctaSecondaryLabelEn: page.ctaSecondaryLabelEn.trim(),
          galleryImages: splitLines(galleryText),
          sections: page.sections.map(s => ({ id: `sec-${s.key}`, kind: s.key, visible: s.visible, titleAr: s.titleAr.trim(), titleEn: s.titleEn.trim(), bodyAr: s.bodyAr.trim(), bodyEn: s.bodyEn.trim() })),
        };
        await api.updateCustomization(initiative!.id, { ...custom, page: pagePayload } as any);
      }
      await store.reloadAll();
      setSavedSuccess(true);
      if (variant === "page") {
        toast("success", isAr ? "تم حفظ كل التعديلات" : "All changes saved");
        setTimeout(() => onSaved?.(), 700);
      } else {
        setTimeout(onClose, 600);
      }
    } catch (err) {
      setConflict(err instanceof ApiException && err.http === 409);
      setFormError(err instanceof Error ? err.message : (isAr ? 'تعذر حفظ المبادرة.' : 'Save failed.'));
    }
  };

  // مجموعتان: أقسام وثيقة المبادرة بترتيبها الرسمي، ثم إعدادات التقديم والعرض. count = عدد البنود المُدخلة.
  type TabDef = { id: Tab; ar: string; en: string; Icon: LucideIcon; count?: number };
  const tabGroups: { ar: string; en: string; tabs: TabDef[] }[] = [
    {
      ar: 'وثيقة المبادرة', en: 'Initiative document', tabs: [
        { id: 'basic', ar: 'البيانات الأساسية', en: 'Basics', Icon: Info },
        { id: 'goals', ar: 'الهدف والمستهدفات', en: 'Goal & objectives', Icon: Target, count: objectives.length },
        { id: 'financial', ar: 'المحددات المالية', en: 'Financing', Icon: Banknote },
        { id: 'targeting', ar: 'الاستهداف والجهات', en: 'Targeting & partners', Icon: MapPin },
        { id: 'requirements', ar: 'اشتراطات التأهيل', en: 'Eligibility req.', Icon: ClipboardCheck, count: requirements.length },
        { id: 'documents', ar: 'المستندات المطلوبة', en: 'Required docs', Icon: FileText, count: docs.length },
        { id: 'criteria', ar: 'معايير الاختيار', en: 'Selection criteria', Icon: ListChecks, count: criteria.length },
        { id: 'execution', ar: 'مسار التنفيذ', en: 'Execution path', Icon: Route, count: initiative?.workflow?.stages?.length },
        { id: 'kpis', ar: 'مؤشرات الأداء', en: 'KPIs', Icon: BarChart3, count: kpis.length },
      ],
    },
    {
      ar: 'التقديم والعرض', en: 'Application & showcase', tabs: [
        { id: 'documents', ar: 'مستندات التقديم (PDF)', en: 'Upload docs (PDF)', Icon: FileUp, count: docs.length },
        { id: 'form', ar: 'فورم التقديم', en: 'Application form', Icon: FileInput, count: sections.length },
        { id: 'eligibility', ar: 'فحص الأهلية', en: 'Eligibility quiz', Icon: Gauge, count: eligibility.length },
        { id: 'benefits', ar: 'المزايا', en: 'Benefits', Icon: Gift, count: benefits.length },
        { id: 'faqs', ar: 'الأسئلة الشائعة', en: 'FAQs', Icon: HelpCircle, count: faqs.length },
        { id: 'custom', ar: 'التخصيص وتصميم الصفحة', en: 'Customization', Icon: Settings2 },
      ],
    },
  ];

  const inputStyle = { width: '100%' } as React.CSSProperties;

  const modalTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: 'var(--gov-primary-900)', color: 'var(--gov-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ImageIcon size={20} />
      </div>
      <div>
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--gov-primary-900)' }}>
          {isCreate ? (isAr ? 'إنشاء مبادرة جديدة' : 'Create Initiative') : (isAr ? 'تعديل كل بيانات المبادرة' : 'Edit All Initiative Data')}
        </div>
        <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
          {isAr ? 'كل حقل من الأدمن — لا شيء ثابت في الكود' : 'Everything editable from admin — nothing hard-coded'}
        </div>
      </div>
    </div>
  );

  // عنصر غلاف (وليس مكوّن داخلي) حتى لا تُعاد تهيئة الحقول مع كل رسم
  const wrap = (children: React.ReactNode) => variant === "page"
    ? <div className="card" style={{ padding: 0 }}>{children}</div>
    : <Modal onClose={onClose} maxWidth="920px" title={modalTitle}>{children}</Modal>;

  return wrap(
    <>
        <nav aria-label={isAr ? 'أقسام المبادرة' : 'Initiative sections'} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', padding: '0.75rem 1.5rem 0 1.5rem' }}>
          {tabGroups.map(g => (
            <div key={g.en} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', minWidth: '88px', letterSpacing: '0.02em' }}>{isAr ? g.ar : g.en}</span>
              {g.tabs.map(t => {
                const on = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={on ? 'page' : undefined}
                    onClick={() => setActiveTab(t.id)}
                    className={on ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    style={{ fontSize: '0.78rem', gap: '0.35rem', borderRadius: '9999px' }}
                  >
                    <t.Icon size={13} />
                    <span>{isAr ? t.ar : t.en}</span>
                    {!!t.count && (
                      <span style={{ fontSize: '0.66rem', fontWeight: 800, minWidth: '18px', padding: '0 0.3rem', borderRadius: '9999px', background: on ? 'rgba(255,255,255,0.25)' : 'var(--bg-app)', border: on ? 'none' : '1px solid var(--border-subtle)' }}>
                        {t.count.toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <form onSubmit={handleSave}>
          {activeTab === 'basic' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-medium)', position: 'relative' }}>
                <div style={{ height: '150px', position: 'relative', background: 'var(--gov-primary-950)' }}>
                  <img loading="lazy" decoding="async" src={formData.coverImage} alt="Cover Preview" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0 }} className="hero-scrim-soft" />
                  <div style={{ position: 'absolute', bottom: '0.85rem', right: '0.85rem', color: 'var(--on-dark)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gov-gold-bright)' }}>
                      {formatBillions(Number(formData.budgetTotalEGP), isAr)} {isAr ? 'مليار جنيه' : 'B EGP'}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: '0.85rem', left: '0.85rem' }}>
                    <span className="live-chip">
                      <Eye size={12} style={{ display: 'inline' }} /> {isAr ? 'معاينة فورية' : 'Live'}
                    </span>
                  </div>
                </div>
              </div>
              {/* ---- Cover Image Manager (unified on shared ImageUpload: compressed device upload + URL + gallery) ---- */}
              <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <label className="form-label">{isAr ? 'صورة الغلاف — ارفع من الجهاز أو الصق رابطاً أو اختر من المعرض:' : 'Cover image — upload, paste a URL, or pick from gallery:'}</label>

                <ImageUpload
                  value={formData.coverImage}
                  onChange={(dataUrl) => setFormData({ ...formData, coverImage: dataUrl })}
                  onClear={() => setFormData({ ...formData, coverImage: resolveCoverUrl('/covers/solar-2026.svg') })}
                />

                {/* URL input */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <input type="text" className="form-control" value={formData.coverImage} onChange={e => setFormData({ ...formData, coverImage: e.target.value })} dir="ltr"                     placeholder="/covers/image.svg أو لصق رابط خارجي" style={{ fontSize: '0.825rem' }} />
                </div>

                {/* Gallery grid */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {isAr ? 'معرض الصور المحلي' : 'Local image gallery'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                    {INDUSTRIAL_IMAGE_PRESETS.map(p => (
                      <button key={p.id} type="button" onClick={() => setFormData({ ...formData, coverImage: p.url })}
                        style={{ padding: 0, borderRadius: 'var(--radius-sm)', border: formData.coverImage === p.url ? '2px solid var(--gov-primary-800)' : '1px solid var(--border-medium)', background: 'var(--bg-surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.15s ease' }}>
                        <div style={{ height: '60px', overflow: 'hidden' }}>
                          <img loading="lazy" decoding="async" src={p.url} alt={p.labelAr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-body)', lineHeight: 1.2, textAlign: 'center', minHeight: '2.4em' }}>
                          {isAr ? p.labelAr : p.labelEn}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label className="form-label required">{isAr ? 'الاسم عربي' : 'Title AR'}</label>
                  <input className="form-control" value={formData.titleAr} onChange={e => setFormData({ ...formData, titleAr: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label required">{isAr ? 'الاسم إنجليزي' : 'Title EN'}</label>
                  <input className="form-control" value={formData.titleEn} onChange={e => setFormData({ ...formData, titleEn: e.target.value })} required dir="ltr" /></div>
              </div>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">{isAr ? 'المعرف النصي slug (فريد — يولد تلقائيا)' : 'Slug (unique, auto)'}</label>
                  <input className="form-control" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} dir="ltr" placeholder="solar-for-factories" /></div>
                <div className="form-group"><label className="form-label required">{isAr ? 'الحالة' : 'Status'}</label>
                  <select className="form-control" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as InitiativeStatus })}>
                    <option value="draft">{isAr ? 'مسودة' : 'Draft'}</option>
                    <option value="active">{isAr ? 'نشطة' : 'Active'}</option>
                    <option value="coming_soon">{isAr ? 'قريبا' : 'Coming soon'}</option>
                    <option value="closed">{isAr ? 'مغلقة' : 'Closed'}</option>
                    <option value="archived">{isAr ? 'مؤرشفة' : 'Archived'}</option>
                  </select></div>
              </div>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">{isAr ? 'الوصف المختصر عربي' : 'Tagline AR'}</label>
                  <textarea className="form-control" rows={2} value={formData.taglineAr} onChange={e => setFormData({ ...formData, taglineAr: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">{isAr ? 'الوصف المختصر إنجليزي' : 'Tagline EN'}</label>
                  <textarea className="form-control" rows={2} value={formData.taglineEn} onChange={e => setFormData({ ...formData, taglineEn: e.target.value })} dir="ltr" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">{isAr ? 'التصنيف عربي' : 'Category AR'}</label>
                  <input className="form-control" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">{isAr ? 'التصنيف إنجليزي' : 'Category EN'}</label>
                  <input className="form-control" value={formData.categoryEn} onChange={e => setFormData({ ...formData, categoryEn: e.target.value })} dir="ltr" /></div>
                <MoneyInput label={isAr ? 'القيمة الإجمالية للمبادرة' : 'Total initiative value'} value={formData.budgetTotalEGP} onChange={n => setFormData({ ...formData, budgetTotalEGP: n })} isAr={isAr} />
                <div className="form-group"><label className="form-label">{isAr ? 'الشارة عربي' : 'Badge AR'}</label>
                  <input className="form-control" value={formData.badgeTextAr} onChange={e => setFormData({ ...formData, badgeTextAr: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">{isAr ? 'الشارة إنجليزي' : 'Badge EN'}</label>
                  <input className="form-control" value={formData.badgeTextEn} onChange={e => setFormData({ ...formData, badgeTextEn: e.target.value })} dir="ltr" /></div>
              </div>



            </div>
          )}

          {activeTab === 'goals' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SectionCard title={isAr ? 'الهدف العام' : 'General goal'} hint={isAr ? 'يظهر في قسم «عن المبادرة» بصفحة العرض.' : 'Shown in "About the initiative" on the public page.'}>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group"><label className="form-label">{isAr ? 'الهدف العام (عربي)' : 'Goal (Arabic)'}</label>
                    <textarea className="form-control" rows={4} value={content.descriptionAr} onChange={e => setContent({ ...content, descriptionAr: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'الهدف العام (إنجليزي)' : 'Goal (English)'}</label>
                    <textarea className="form-control" rows={4} dir="ltr" value={content.descriptionEn} onChange={e => setContent({ ...content, descriptionEn: e.target.value })} /></div>
                </div>
              </SectionCard>
              <SectionCard title={isAr ? 'المستهدفات الرئيسية' : 'Key objectives'} count={objectives.length} hint={isAr ? 'بند لكل مستهدف — تظهر كقائمة مرقّمة في صفحة المبادرة.' : 'One item per objective — shown as a numbered list.'}>
                <BilingualListEditor items={objectives} onChange={setObjectives} isAr={isAr}
                  itemLabelAr="المستهدف" itemLabelEn="Objective" addLabelAr="إضافة مستهدف" addLabelEn="Add objective"
                  emptyAr="لا توجد مستهدفات بعد — أضف أول مستهدف." emptyEn="No objectives yet — add the first one." />
              </SectionCard>
              <SectionCard title={isAr ? 'الأرقام المستهدفة والمحققة' : 'Target & achieved figures'} hint={isAr ? 'تظهر في قسم «الإنجازات والأرقام» بصفحة المبادرة (القيم الصفرية لا تُعرض).' : 'Shown in "Achievements & key figures" (zero values are hidden).'}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <UnitInput label={isAr ? 'عدد المصانع المستهدفة' : 'Target factories'} unit={isAr ? 'مصنع' : 'factories'} value={content.targetFactories} onChange={n => setContent({ ...content, targetFactories: n })} />
                  <UnitInput label={isAr ? 'المصانع المستفيدة فعلياً' : 'Benefited factories'} unit={isAr ? 'مصنع' : 'factories'} value={content.benefitedFactories} onChange={n => setContent({ ...content, benefitedFactories: n })} />
                  <UnitInput label={isAr ? 'القدرة المستهدفة' : 'Target capacity'} unit={isAr ? 'ميجاوات' : 'MW'} value={content.targetCapacityMW} onChange={n => setContent({ ...content, targetCapacityMW: n })} />
                  <UnitInput label={isAr ? 'الطاقة الموفرة' : 'Energy saved'} unit={isAr ? 'جيجاوات ساعة' : 'GWh'} step={0.1} value={content.savedEnergyGWh} onChange={n => setContent({ ...content, savedEnergyGWh: n })} />
                  <UnitInput label={isAr ? 'فرص العمل' : 'Jobs created'} unit={isAr ? 'فرصة' : 'jobs'} value={content.jobsCreated} onChange={n => setContent({ ...content, jobsCreated: n })} />
                  <MoneyInput label={isAr ? 'الاستثمارات المحفزة' : 'Investment stimulated'} value={content.investmentStimulatedEGP} onChange={n => setContent({ ...content, investmentStimulatedEGP: n })} isAr={isAr} />
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SectionCard title={isAr ? 'القيمة والمدة' : 'Value & duration'}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <MoneyInput label={isAr ? 'الحد الأقصى لقيمة المبادرة' : 'Maximum initiative value'} value={formData.budgetTotalEGP} onChange={n => setFormData({ ...formData, budgetTotalEGP: n })} isAr={isAr} />
                  <MoneyInput label={isAr ? 'المخصص / المُستخدم حتى الآن' : 'Allocated so far'} value={content.budgetAllocatedEGP} onChange={n => setContent({ ...content, budgetAllocatedEGP: n })} isAr={isAr} />
                  <UnitInput label={isAr ? 'الحد الأقصى لمدة المبادرة' : 'Maximum duration'} unit={isAr ? 'سنوات' : 'years'} value={financial.maxDurationYears} onChange={n => setF({ maxDurationYears: n || undefined })} hint={isAr ? 'من تاريخ الإطلاق' : 'From launch date'} />
                  <div className="form-group"><label className="form-label">{isAr ? 'تاريخ الإطلاق' : 'Launch date'}</label>
                    <input type="date" className="form-control" value={content.startDate} onChange={e => setContent({ ...content, startDate: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'تاريخ الانتهاء' : 'End date'}</label>
                    <input type="date" className="form-control" value={content.endDate} onChange={e => setContent({ ...content, endDate: e.target.value })} /></div>
                </div>
              </SectionCard>
              <SectionCard title={isAr ? 'آلية التمويل وحدوده' : 'Financing mechanism & limits'}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group"><label className="form-label">{isAr ? 'صورة التمويل' : 'Financing type'}</label>
                    <select className="form-control" value={financial.financingType ?? 'bank_loans'} onChange={e => setF({ financingType: e.target.value as FinancialTerms['financingType'] })}>
                      {FINANCING_TYPES.map(t => <option key={t.value} value={t.value}>{isAr ? t.ar : t.en}</option>)}
                    </select></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'عملة التمويل' : 'Currency'}</label>
                    <select className="form-control" value={financial.currency ?? 'EGP'} onChange={e => setF({ currency: e.target.value as FinancialTerms['currency'] })}>
                      <option value="EGP">{isAr ? 'الجنيه المصري (العملة المحلية)' : 'Egyptian pound (EGP)'}</option>
                      <option value="USD">{isAr ? 'الدولار الأمريكي' : 'US dollar (USD)'}</option>
                    </select></div>
                  <MoneyInput label={isAr ? 'الحد الأقصى لتمويل العميل الواحد' : 'Max financing per client'} value={financial.maxFinancingPerClientEGP} onChange={n => setF({ maxFinancingPerClientEGP: n || undefined })} isAr={isAr} />
                  <MoneyInput label={isAr ? 'الحد الأقصى للعميل والأطراف المرتبطة به' : 'Max for client & related parties'} value={financial.maxFinancingPerGroupEGP} onChange={n => setF({ maxFinancingPerGroupEGP: n || undefined })} isAr={isAr} />
                </div>
              </SectionCard>
              <SectionCard title={isAr ? 'الفئة المستفيدة والغرض' : 'Beneficiaries & purpose'}>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label className="form-label">{isAr ? 'الفئة المستفيدة (عربي)' : 'Beneficiaries (Arabic)'}</label>
                    <textarea className="form-control" rows={2} value={financial.beneficiariesAr ?? ''} onChange={e => setF({ beneficiariesAr: e.target.value })} placeholder={isAr ? 'مثال: منشآت القطاع الصناعي الخاص المستوفية للاشتراطات' : ''} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'الفئة المستفيدة (إنجليزي)' : 'Beneficiaries (English)'}</label>
                    <textarea className="form-control" rows={2} dir="ltr" value={financial.beneficiariesEn ?? ''} onChange={e => setF({ beneficiariesEn: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'غرض التمويل (عربي)' : 'Financing purpose (Arabic)'}</label>
                    <textarea className="form-control" rows={2} value={financial.purposeAr ?? ''} onChange={e => setF({ purposeAr: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'غرض التمويل (إنجليزي)' : 'Financing purpose (English)'}</label>
                    <textarea className="form-control" rows={2} dir="ltr" value={financial.purposeEn ?? ''} onChange={e => setF({ purposeEn: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'ملاحظات مالية إضافية (عربي)' : 'Additional notes (Arabic)'}</label>
                    <textarea className="form-control" rows={2} value={financial.notesAr ?? ''} onChange={e => setF({ notesAr: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'ملاحظات مالية إضافية (إنجليزي)' : 'Additional notes (English)'}</label>
                    <textarea className="form-control" rows={2} dir="ltr" value={financial.notesEn ?? ''} onChange={e => setF({ notesEn: e.target.value })} /></div>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'targeting' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SectionCard title={isAr ? 'القطاعات المستهدفة' : 'Target sectors'} hint={isAr ? 'سطر لكل قطاع.' : 'One sector per line.'}>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label className="form-label">{isAr ? 'القطاعات (عربي)' : 'Sectors (Arabic)'}</label>
                    <textarea className="form-control" rows={4} value={content.targetSectors} onChange={e => setContent({ ...content, targetSectors: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'القطاعات (إنجليزي)' : 'Sectors (English)'}</label>
                    <textarea className="form-control" rows={4} dir="ltr" value={content.targetSectorsEn} onChange={e => setContent({ ...content, targetSectorsEn: e.target.value })} /></div>
                </div>
              </SectionCard>
              <SectionCard title={isAr ? 'المحافظات المستهدفة' : 'Target governorates'} count={governorates.length} hint={isAr ? 'اترك الاختيار فارغاً إن كانت المبادرة على مستوى الجمهورية.' : 'Leave empty for a nationwide initiative.'}>
                <GovernoratePicker value={governorates} onChange={setGovernorates} isAr={isAr} />
              </SectionCard>
              <SectionCard title={isAr ? 'الجهات المشاركة بالمبادرة' : 'Participating entities'} count={splitLines(content.participatingOrgs).length} hint={isAr ? 'سطر لكل جهة — أو أضف من الجهات المسجلة بضغطة.' : 'One per line — or quick-add registered entities.'}>
                <textarea
                  className="form-control"
                  rows={4}
                  value={content.participatingOrgs}
                  onChange={e => setContent({ ...content, participatingOrgs: e.target.value })}
                  placeholder={isAr ? 'وزارة الصناعة\nوزارة المالية\nالقطاع المصرفي' : 'Ministry of Industry\nMinistry of Finance\nBanking sector'}
                />
                {organizations.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                      {isAr ? 'إضافة سريعة من الجهات المسجلة:' : 'Quick add:'}
                    </span>
                    {organizations.map(o => {
                      const orgLabel = isAr ? o.nameAr : o.nameEn;
                      const currentList = splitLines(content.participatingOrgs);
                      const isAdded = currentList.some(x => x.toLowerCase() === orgLabel.toLowerCase() || x.toLowerCase() === o.code.toLowerCase());
                      return (
                        <button
                          key={o.id}
                          type="button"
                          aria-pressed={isAdded}
                          onClick={() => setContent(prev => ({
                            ...prev,
                            participatingOrgs: isAdded
                              ? currentList.filter(x => x.toLowerCase() !== orgLabel.toLowerCase() && x.toLowerCase() !== o.code.toLowerCase()).join('\n')
                              : [...currentList, orgLabel].join('\n'),
                          }))}
                          style={{
                            fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', cursor: 'pointer',
                            border: isAdded ? '1px solid var(--egypt-red)' : '1px solid var(--border-medium)',
                            background: isAdded ? 'var(--egypt-red-soft)' : 'var(--bg-surface)',
                            color: isAdded ? 'var(--egypt-red)' : 'var(--text-body)', fontWeight: isAdded ? 700 : 500,
                          }}
                        >
                          {isAdded ? '✓ ' : '+ '}{orgLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {activeTab === 'requirements' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SectionCard title={isAr ? 'اشتراطات تأهيل المنشأة والمشروع' : 'Facility & project eligibility requirements'} count={requirements.length} hint={isAr ? 'الشروط التي يجب أن تستوفيها المنشأة — تظهر في صفحة المبادرة.' : 'Conditions the facility must meet — shown on the public page.'}>
                <BilingualListEditor items={requirements} onChange={setRequirements} isAr={isAr}
                  itemLabelAr="الاشتراط" itemLabelEn="Requirement" addLabelAr="إضافة اشتراط" addLabelEn="Add requirement"
                  emptyAr="لا توجد اشتراطات بعد." emptyEn="No requirements yet." />
              </SectionCard>
              <div style={{
                background: 'var(--gov-primary-50)',
                border: '1px solid var(--gov-primary-200)',
                borderRadius: 'var(--radius-md)',
                padding: '0.9rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--gov-primary-900)', color: 'var(--gov-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileUp size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--gov-primary-900)' }}>
                      {isAr ? 'المستندات المطلوب من صاحب المصنع رفعها (PDF)' : 'Documents required from factory owner (PDF)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isAr
                        ? `محدد حالياً ${docs.length} مستند ليرفعها المصنع عند التقديم. يمكنك إدارتها وترتيبها وإضافة قوالب جاهزة من قسم المستندات المخصص.`
                        : `${docs.length} document(s) configured. Manage, reorder, and add presets in the dedicated Documents tab.`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveTab('documents')}
                  style={{ gap: '0.35rem', fontWeight: 700 }}
                >
                  <FileText size={14} />
                  <span>{isAr ? `إدارة المستندات المطلوبة (${docs.length})` : `Manage documents (${docs.length})`}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, var(--gov-primary-950) 0%, var(--gov-primary-900) 100%)',
                color: 'var(--on-dark)',
                borderRadius: 'var(--radius-md)',
                padding: '1.1rem 1.25rem',
                border: '1px solid var(--gov-primary-800)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', color: 'var(--gov-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileUp size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--gov-gold-bright)' }}>
                      {isAr ? 'المستندات المطلوب من صاحب المصنع رفعها عند التقديم' : 'Required Documents for Factory Owner to Upload'}
                    </h3>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                      {isAr
                        ? 'تظهر هذه المستندات لصاحب المصنع في الخطوة الأولى من نموذج التقديم ليرفعها بصيغة PDF. المستند «الإلزامي» يمنع إرسال الطلب بدونه.'
                        : 'These documents appear directly in Step 1 of the application wizard as PDF uploads. Mandatory documents block submission if missing.'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '9999px', background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                    {isAr ? `${docs.length} مستند محدد` : `${docs.length} documents`}
                  </span>
                </div>
              </div>

              {/* Quick-add presets */}
              <div style={{ background: 'var(--bg-app)', padding: '0.9rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Plus size={13} />
                  <span>{isAr ? 'إضافة سريعة من المستندات الصناعية الشائعة:' : 'Quick add common industrial documents:'}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {COMMON_DOC_PRESETS.map((p, pi) => {
                    const alreadyAdded = docs.some(d => d.code === p.code || (d.titleAr && d.titleAr.trim() === p.titleAr.trim()));
                    return (
                      <button
                        key={pi}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => setDocs([...docs, { ...p }])}
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '9999px',
                          cursor: alreadyAdded ? 'default' : 'pointer',
                          border: alreadyAdded ? '1px solid var(--border-subtle)' : '1px solid var(--gov-primary-300)',
                          background: alreadyAdded ? 'var(--bg-muted)' : 'var(--bg-surface)',
                          color: alreadyAdded ? 'var(--text-muted)' : 'var(--gov-primary-900)',
                          fontWeight: alreadyAdded ? 500 : 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          opacity: alreadyAdded ? 0.6 : 1,
                        }}
                      >
                        {alreadyAdded ? '✓ ' : '+ '}{isAr ? p.titleAr : p.titleEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List of documents */}
              <SectionCard
                title={isAr ? 'قائمة المستندات المطلوبة للمبادرة' : 'Initiative Configured Documents'}
                count={docs.length}
                hint={isAr ? 'تظهر للمصنع في نموذج التقديم بأيقون رفع (PDF). رتب المستندات أو عدّل أسماءها وحدد أي منها إلزامي.' : 'Reorder, rename, or toggle mandatory flag for applicants.'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {docs.length === 0 && (
                    <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)' }}>
                      <FileText size={24} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                      <div>{isAr ? 'لا توجد مستندات مطلوبة محددة لهذه المبادرة بعد.' : 'No required documents configured yet.'}</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>{isAr ? 'اختر من الإضافة السريعة أعلاه أو اضغط «إضافة مستند جديد» أدناه.' : 'Pick from quick-add above or click "Add document" below.'}</div>
                    </div>
                  )}

                  {docs.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem 0.85rem',
                        background: 'var(--bg-surface)',
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0,2fr) minmax(0,2fr) minmax(0,1fr) auto auto',
                        gap: '0.6rem',
                        alignItems: 'end',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Move buttons & index */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '38px', gap: '2px' }}>
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => {
                            const next = [...docs];
                            [next[i], next[i - 1]] = [next[i - 1], next[i]];
                            setDocs(next);
                          }}
                          style={{ border: 'none', background: 'transparent', padding: '0 2px', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 0.8 }}
                          title={isAr ? 'تحريك لأعلى' : 'Move up'}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' }}>{i + 1}</span>
                        <button
                          type="button"
                          disabled={i === docs.length - 1}
                          onClick={() => {
                            const next = [...docs];
                            [next[i], next[i + 1]] = [next[i + 1], next[i]];
                            setDocs(next);
                          }}
                          style={{ border: 'none', background: 'transparent', padding: '0 2px', cursor: i === docs.length - 1 ? 'default' : 'pointer', opacity: i === docs.length - 1 ? 0.3 : 0.8 }}
                          title={isAr ? 'تحريك لأسفل' : 'Move down'}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>

                      {/* Arabic Title */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'اسم المستند (عربي)' : 'Title (Arabic)'}</label>
                        <input
                          className="form-control"
                          value={d.titleAr}
                          placeholder={isAr ? 'مثال: السجل التجاري الساري' : 'Document name in Arabic'}
                          onChange={e => setDocs(docs.map((x, j) => j === i ? { ...x, titleAr: e.target.value } : x))}
                        />
                      </div>

                      {/* English Title */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'اسم المستند (إنجليزي)' : 'Title (English)'}</label>
                        <input
                          className="form-control"
                          dir="ltr"
                          value={d.titleEn}
                          placeholder="e.g. Valid Commercial Register"
                          onChange={e => setDocs(docs.map((x, j) => j === i ? { ...x, titleEn: e.target.value } : x))}
                        />
                      </div>

                      {/* Code */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'رمز الكود' : 'Code'}</label>
                        <input
                          className="form-control"
                          dir="ltr"
                          placeholder="CR_COPY"
                          value={d.code}
                          onChange={e => setDocs(docs.map((x, j) => j === i ? { ...x, code: e.target.value } : x))}
                        />
                      </div>

                      {/* Mandatory Checkbox */}
                      <label style={{ display: 'flex', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, alignItems: 'center', height: '38px', whiteSpace: 'nowrap', cursor: 'pointer', padding: '0 0.3rem' }}>
                        <input
                          type="checkbox"
                          checked={!!d.mandatory}
                          onChange={e => setDocs(docs.map((x, j) => j === i ? { ...x, mandatory: e.target.checked } : x))}
                          style={{ width: '17px', height: '17px' }}
                        />
                        <span style={{ color: d.mandatory ? 'var(--egypt-red)' : 'var(--text-muted)' }}>
                          {isAr ? 'إلزامي' : 'Mandatory'}
                        </span>
                      </label>

                      {/* Delete */}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ height: '38px', color: 'var(--gov-crimson)' }}
                        onClick={() => setDocs(docs.filter((_, j) => j !== i))}
                        aria-label={isAr ? 'حذف المستند' : 'Delete document'}
                        title={isAr ? 'حذف هذا المستند' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setDocs([...docs, { code: `DOC_${docs.length + 1}`, titleAr: '', titleEn: '', mandatory: true }])}
                    >
                      <Plus size={14} /> {isAr ? 'إضافة مستند جديد' : 'Add custom document'}
                    </button>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'criteria' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SectionCard title={isAr ? 'معايير اختيار المصانع' : 'Factory selection criteria'} count={criteria.length} hint={isAr ? 'أسس المفاضلة بين المصانع المتقدمة — تظهر في صفحة المبادرة.' : 'How applicants are prioritized — shown on the public page.'}>
                <BilingualListEditor items={criteria} onChange={setCriteria} isAr={isAr}
                  itemLabelAr="المعيار" itemLabelEn="Criterion" addLabelAr="إضافة معيار" addLabelEn="Add criterion"
                  emptyAr="لا توجد معايير بعد." emptyEn="No criteria yet." />
              </SectionCard>
            </div>
          )}

          {activeTab === 'execution' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SectionCard title={isAr ? 'مراحل التنفيذ' : 'Execution stages'} count={initiative?.workflow?.stages?.length ?? 0} hint={isAr ? 'المراحل وجهاتها ومددها تُدار من محرر المسار (تظهر للعميل بمدة كل مرحلة).' : 'Stages, owners and durations are managed in the workflow editor.'}>
                {isCreate ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{isAr ? 'احفظ المبادرة أولاً ثم عدّل مراحلها من محرر المسار.' : 'Save the initiative first, then edit its stages.'}</div>
                ) : (
                  <>
                    <ol style={{ margin: '0 0 0.75rem 0', paddingInlineStart: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {[...(initiative!.workflow?.stages ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(st => (
                        <li key={st.id} style={{ fontSize: '0.85rem', color: 'var(--text-body)' }}>
                          <strong>{(isAr ? st.nameAr : st.nameEn || st.nameAr).replace(/^\d+\.\s*/, '')}</strong>
                          <span style={{ color: 'var(--text-muted)' }}> — {st.assignedOrgNameAr} · {isAr ? `${st.slaDays} أيام عمل` : `${st.slaDays} working days`}</span>
                        </li>
                      ))}
                    </ol>
                    <button type="button" className="btn btn-secondary" onClick={() => { onClose(); navigate('admin-workflow-builder', initiative!.id); }}>
                      <ExternalLink size={14} /> {isAr ? 'تعديل المراحل في محرر المسار' : 'Edit stages in workflow editor'}
                    </button>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginInlineStart: '0.5rem' }}>{isAr ? '(احفظ تعديلاتك هنا أولاً)' : '(save your changes here first)'}</span>
                  </>
                )}
              </SectionCard>
              <SectionCard title={isAr ? 'ملاحظات مسار التنفيذ' : 'Execution path notes'} hint={isAr ? 'مثال: المسار المقترح، والمراجعات التي تتم بالتوازي. تظهر تحت المراحل في صفحة المبادرة.' : 'E.g. the proposed path and reviews done in parallel. Shown under the stages.'}>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label className="form-label">{isAr ? 'الملاحظات (عربي)' : 'Notes (Arabic)'}</label>
                    <textarea className="form-control" rows={4} value={content.executionNotesAr} onChange={e => setContent({ ...content, executionNotesAr: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'الملاحظات (إنجليزي)' : 'Notes (English)'}</label>
                    <textarea className="form-control" rows={4} dir="ltr" value={content.executionNotesEn} onChange={e => setContent({ ...content, executionNotesEn: e.target.value })} /></div>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'kpis' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SectionCard
                title={isAr ? 'مؤشرات قياس الأداء' : 'Performance indicators (KPIs)'}
                count={kpis.length}
                badge={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', fontWeight: 800, padding: '0.12rem 0.5rem', borderRadius: '9999px', background: 'var(--gov-gold-light)', color: 'var(--gov-gold-dark)', border: '1px solid var(--gov-gold-border)' }}>
                    <Lock size={11} /> {isAr ? 'للأدمن فقط' : 'Admin only'}
                  </span>
                }
                hint={isAr ? 'للمتابعة الداخلية — لا تظهر في صفحة المبادرة ولا للمصانع. أدخل المستهدف والمحقق لحساب نسبة الإنجاز.' : 'Internal monitoring — never shown publicly. Enter target and achieved to track progress.'}
              >
                {kpisState === 'loading' && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{isAr ? 'جارٍ تحميل المؤشرات…' : 'Loading KPIs…'}</div>}
                {kpisState === 'error' && (
                  <ErrorBox message={isAr ? 'تعذر تحميل المؤشرات — لن تُعدَّل عند الحفظ. أعد فتح النافذة للمحاولة مرة أخرى.' : 'Could not load KPIs — they will not be changed on save. Reopen to retry.'} />
                )}
                {kpisState === 'ready' && <KpiEditor kpis={kpis} onChange={setKpis} isAr={isAr} />}
              </SectionCard>
            </div>
          )}

          {activeTab === 'benefits' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {benefits.length === 0 && (
                <div style={{ padding: '0.9rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)' }}>
                  {isAr ? 'لا توجد مزايا بعد.' : 'No benefits yet.'}
                </div>
              )}
              {benefits.map((b, i) => (
                <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{isAr ? `الميزة ${i + 1}` : `Benefit ${i + 1}`}</strong>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--gov-crimson)' }} onClick={() => setBenefits(benefits.filter((_, j) => j !== i))} aria-label={isAr ? 'حذف الميزة' : 'Delete benefit'}><Trash2 size={14} /></button>
                  </div>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
                      <input className="form-control" value={b.titleAr} onChange={e => setBenefits(benefits.map((x, j) => j === i ? { ...x, titleAr: e.target.value } : x))} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'العنوان (إنجليزي)' : 'Title (English)'}</label>
                      <input className="form-control" dir="ltr" value={b.titleEn} onChange={e => setBenefits(benefits.map((x, j) => j === i ? { ...x, titleEn: e.target.value } : x))} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
                      <textarea className="form-control" rows={2} value={b.descriptionAr} onChange={e => setBenefits(benefits.map((x, j) => j === i ? { ...x, descriptionAr: e.target.value } : x))} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}</label>
                      <textarea className="form-control" rows={2} dir="ltr" value={b.descriptionEn} onChange={e => setBenefits(benefits.map((x, j) => j === i ? { ...x, descriptionEn: e.target.value } : x))} /></div>
                  </div>
                  <div className="form-group" style={{ margin: '0.5rem 0 0 0' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'الأيقونة' : 'Icon'}</label>
                    <div role="radiogroup" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {BENEFIT_ICONS.map(ic => {
                        const on = (b.iconName || 'Sparkles') === ic.name;
                        return (
                          <button key={ic.name} type="button" role="radio" aria-checked={on} title={isAr ? ic.ar : ic.en}
                            onClick={() => setBenefits(benefits.map((x, j) => j === i ? { ...x, iconName: ic.name } : x))}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.3rem 0.55rem', borderRadius: '8px', cursor: 'pointer',
                              border: on ? '1.5px solid var(--egypt-red)' : '1px solid var(--border-medium)', background: on ? 'var(--egypt-red-soft)' : 'var(--bg-surface)',
                              color: on ? 'var(--egypt-red)' : 'var(--text-body)', fontWeight: on ? 700 : 500 }}>
                            <ic.Icon size={14} /> {isAr ? ic.ar : ic.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setBenefits([...benefits, { titleAr: '', titleEn: '', descriptionAr: '', descriptionEn: '', iconName: 'Sparkles' }])}>
                <Plus size={14} /> {isAr ? 'إضافة ميزة' : 'Add benefit'}
              </button>
            </div>
          )}

          {activeTab === 'faqs' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {faqs.length === 0 && (
                <div style={{ padding: '0.9rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)' }}>
                  {isAr ? 'لا توجد أسئلة شائعة بعد.' : 'No FAQs yet.'}
                </div>
              )}
              {faqs.map((f, i) => (
                <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{isAr ? `السؤال ${i + 1}` : `FAQ ${i + 1}`}</strong>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--gov-crimson)' }} onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} aria-label={isAr ? 'حذف السؤال' : 'Delete FAQ'}><Trash2 size={14} /></button>
                  </div>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'السؤال (عربي)' : 'Question (Arabic)'}</label>
                      <input className="form-control" value={f.questionAr} onChange={e => setFaqs(faqs.map((x, j) => j === i ? { ...x, questionAr: e.target.value } : x))} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'السؤال (إنجليزي)' : 'Question (English)'}</label>
                      <input className="form-control" dir="ltr" value={f.questionEn} onChange={e => setFaqs(faqs.map((x, j) => j === i ? { ...x, questionEn: e.target.value } : x))} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'الإجابة (عربي)' : 'Answer (Arabic)'}</label>
                      <textarea className="form-control" rows={2} value={f.answerAr} onChange={e => setFaqs(faqs.map((x, j) => j === i ? { ...x, answerAr: e.target.value } : x))} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'الإجابة (إنجليزي)' : 'Answer (English)'}</label>
                      <textarea className="form-control" rows={2} dir="ltr" value={f.answerEn} onChange={e => setFaqs(faqs.map((x, j) => j === i ? { ...x, answerEn: e.target.value } : x))} /></div>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setFaqs([...faqs, { questionAr: '', questionEn: '', answerAr: '', answerEn: '' }])}>
                <Plus size={14} /> {isAr ? 'إضافة سؤال' : 'Add FAQ'}
              </button>
            </div>
          )}

          {activeTab === 'eligibility' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {isAr
                  ? 'أسئلة فحص الأهلية السريع قبل التقديم. المصنع يكون «مؤهلاً» فقط إذا حقق كل الشروط.'
                  : 'Quick pre-application eligibility quiz. A factory is eligible only if all conditions are met.'}
              </div>
              {eligibility.length === 0 && (
                <div style={{ padding: '0.9rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)' }}>
                  {isAr ? 'لا توجد أسئلة أهلية بعد.' : 'No eligibility questions yet.'}
                </div>
              )}
              {eligibility.map((q: any, i: number) => (
                <div key={q.id || i} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.75rem', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{isAr ? `السؤال ${i + 1}` : `Question ${i + 1}`}</strong>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--gov-crimson)' }} onClick={() => setEligibility(eligibility.filter((_, j) => j !== i))} aria-label={isAr ? 'حذف السؤال' : 'Delete question'}><Trash2 size={14} /></button>
                  </div>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'نص السؤال (عربي)' : 'Question (Arabic)'}</label>
                      <input className="form-control" value={q.questionAr} onChange={e => setQ(i, { questionAr: e.target.value })} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'نص السؤال (إنجليزي)' : 'Question (English)'}</label>
                      <input className="form-control" dir="ltr" value={q.questionEn} onChange={e => setQ(i, { questionEn: e.target.value })} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'نوع الإجابة' : 'Answer type'}</label>
                      <select className="form-control" value={q.type} onChange={e => setQ(i, { type: e.target.value })}>
                        <option value="boolean">{isAr ? 'نعم / لا' : 'Yes / No'}</option>
                        <option value="select">{isAr ? 'اختيار من قائمة' : 'Choose from list'}</option>
                        <option value="number">{isAr ? 'رقم' : 'Number'}</option>
                      </select></div>
                    {q.type === 'boolean' && (
                      <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'الإجابة المطلوبة للتأهل' : 'Answer required to qualify'}</label>
                        <select className="form-control" value={q._expected} onChange={e => setQ(i, { _expected: e.target.value })}>
                          <option value="true">{isAr ? 'نعم' : 'Yes'}</option>
                          <option value="false">{isAr ? 'لا' : 'No'}</option>
                        </select></div>
                    )}
                    {q.type === 'number' && (
                      <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'الحد الأدنى المطلوب للتأهل' : 'Minimum value to qualify'}</label>
                        <input className="form-control" inputMode="decimal" dir="ltr" value={q._expected} placeholder={isAr ? 'اتركه فارغاً لقبول أي رقم' : 'Leave empty to accept any number'} onChange={e => setQ(i, { _expected: e.target.value })} /></div>
                    )}
                    {q.type === 'select' && <div />}
                  </div>
                  {q.type === 'select' && (
                    <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{isAr ? 'الخيارات — علّم الخيارات المؤهِّلة' : 'Options — tick the qualifying ones'}</div>
                      {((q._options ?? []) as EligOption[]).map((o, oi) => (
                        <div key={oi} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.4rem', alignItems: 'center' }}>
                          <input className="form-control" placeholder={isAr ? 'الخيار (عربي)' : 'Option (Arabic)'} value={o.labelAr} onChange={e => setQ(i, { _options: (q._options as EligOption[]).map((x, k) => k === oi ? { ...x, labelAr: e.target.value } : x) })} />
                          <input className="form-control" dir="ltr" placeholder="Option (English)" value={o.labelEn} onChange={e => setQ(i, { _options: (q._options as EligOption[]).map((x, k) => k === oi ? { ...x, labelEn: e.target.value } : x) })} />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={!!o.isEligible} onChange={e => setQ(i, { _options: (q._options as EligOption[]).map((x, k) => k === oi ? { ...x, isEligible: e.target.checked } : x) })} style={{ width: '16px', height: '16px' }} />
                            {isAr ? 'مؤهِّل' : 'Qualifies'}
                          </label>
                          <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--gov-crimson)' }} onClick={() => setQ(i, { _options: (q._options as EligOption[]).filter((_, k) => k !== oi) })} aria-label={isAr ? 'حذف الخيار' : 'Delete option'}><Trash2 size={13} /></button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setQ(i, { _options: [...((q._options ?? []) as EligOption[]), { labelAr: '', labelEn: '', value: `opt-${Date.now().toString(36)}`, isEligible: false }] })}>
                        <Plus size={13} /> {isAr ? 'إضافة خيار' : 'Add option'}
                      </button>
                    </div>
                  )}
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'توضيح للمصنع (عربي — اختياري)' : 'Explanation (Arabic — optional)'}</label>
                      <textarea className="form-control" rows={2} value={q.explanationAr} onChange={e => setQ(i, { explanationAr: e.target.value })} /></div>
                    <div className="form-group" style={{ margin: 0 }}><label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'توضيح للمصنع (إنجليزي — اختياري)' : 'Explanation (English — optional)'}</label>
                      <textarea className="form-control" rows={2} dir="ltr" value={q.explanationEn} onChange={e => setQ(i, { explanationEn: e.target.value })} /></div>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setEligibility([...eligibility, { id: `q-${Date.now().toString(36)}`, questionAr: '', questionEn: '', type: 'boolean', explanationAr: '', explanationEn: '', _options: [], _expected: 'true' } as any])}>
                <Plus size={14} /> {isAr ? 'إضافة سؤال أهلية' : 'Add question'}
              </button>
            </div>
          )}

          {activeTab === 'form' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                background: 'var(--gov-primary-50)',
                border: '1px solid var(--gov-primary-200)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--gov-primary-900)', color: 'var(--gov-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileUp size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--gov-primary-900)' }}>
                      {isAr ? 'المستندات المطلوب رفعها من صاحب المصنع (الخطوة 1 في التقديم)' : 'Documents uploaded by factory owner (Step 1 of application)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isAr
                        ? `محدد حالياً ${docs.length} مستند ليرفعها المصنع (PDF) قبل ملء الفورم.`
                        : `${docs.length} document(s) configured for factory upload before filling the form.`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('documents')}
                  style={{ fontWeight: 700, gap: '0.35rem' }}
                >
                  <FileText size={14} />
                  <span>{isAr ? `تعديل المستندات المطلوبة (${docs.length})` : `Edit required documents (${docs.length})`}</span>
                </button>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isAr ? 'منشئ فورم التقديم — عدّل الأقسام والحقول والخيارات والشروط، وراجع المعاينة الحية قبل الحفظ.' : 'Application form builder — edit sections, fields, options and conditions, then review the live preview.'}
              </div>
              <FormSchemaBuilder sections={sections} onChange={setSections} isAr={isAr} />
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'var(--gov-primary-50)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontWeight: 800 }}>{isAr ? 'التحكم في أقسام صفحة المبادرة' : 'Showcase sections'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {([['showBenefits', 'المزايا'], ['showFaqs', 'الأسئلة'], ['showImpactMetrics', 'الإنجازات'], ['showTimeline', 'الخط الزمني'], ['showPartners', 'الشركاء'], ['enablePreEligibility', 'الأهلية السريعة']] as [keyof InitiativeCustomization, string][]).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.7rem 0.9rem', border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-surface)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <span>{isAr ? label : key}</span>
                    <input type="checkbox" checked={!!custom[key]} onChange={e => setC({ [key]: e.target.checked } as any)} style={{ width: '18px', height: '18px' }} />
                  </label>
                ))}
              </div>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 600 }}>
                  <span>{isAr ? 'السماح برفع PDF' : 'Allow PDF upload'}</span>
                  <input type="checkbox" checked={custom.allowFactoryFileUpload} onChange={e => setC({ allowFactoryFileUpload: e.target.checked })} />
                </label>
                <label style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 600 }}>
                  <span>{isAr ? 'PDF إجباري' : 'Require PDF'}</span>
                  <input type="checkbox" checked={custom.requireDetailsFile} onChange={e => setC({ requireDetailsFile: e.target.checked })} />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div className="form-group"><label className="form-label">{isAr ? 'أقصى حجم MB' : 'Max MB'}</label>
                    <input type="number" className="form-control" value={custom.maxFileSizeMB} onChange={e => setC({ maxFileSizeMB: Number(e.target.value) || 15 })} min={1} max={100} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'الأنواع' : 'Types'}</label>
                    <input type="text" className="form-control" value={custom.allowedFileTypes} onChange={e => setC({ allowedFileTypes: e.target.value })} dir="ltr" /></div>
                </div>
              </div>
              {!isCreate && (
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label className="form-label">{isAr ? 'رسالة ترحيبية عربي' : 'Welcome AR'}</label>
                    <textarea className="form-control" rows={2} value={custom.customWelcomeMessageAr || ''} onChange={e => setC({ customWelcomeMessageAr: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">{isAr ? 'رسالة ترحيبية إنجليزي' : 'Welcome EN'}</label>
                    <textarea className="form-control" rows={2} dir="ltr" value={custom.customWelcomeMessageEn || ''} onChange={e => setC({ customWelcomeMessageEn: e.target.value })} /></div>
                </div>
              )}
              {/* ---- تصميم صفحة المبادرة / Page design (collapsible — يُحفظ داخل customization.page) ---- */}
              {!isCreate && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setPageOpen(o => !o)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-body)' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <LayoutTemplate size={16} />
                      {isAr ? 'تصميم صفحة المبادرة / Page design' : 'Initiative page design'}
                    </span>
                    {pageOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {pageOpen && (
                    <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                      <div className="form-group">
                        <label className="form-label">{isAr ? 'التخطيط (Layout)' : 'Layout'}</label>
                        <select className="form-control" value={page.layout} onChange={e => setP({ layout: e.target.value as PageDesignState['layout'] })}>
                          <option value="standard">{isAr ? 'قياسي (Standard)' : 'Standard'}</option>
                          <option value="spotlight">{isAr ? 'تسليط (Spotlight)' : 'Spotlight'}</option>
                          <option value="compact">{isAr ? 'مضغوط (Compact)' : 'Compact'}</option>
                        </select>
                      </div>
                      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group"><label className="form-label">{isAr ? 'عنوان البطل عربي' : 'Hero title AR'}</label>
                          <input className="form-control" value={page.heroTitleAr} onChange={e => setP({ heroTitleAr: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">{isAr ? 'عنوان البطل إنجليزي' : 'Hero title EN'}</label>
                          <input className="form-control" dir="ltr" value={page.heroTitleEn} onChange={e => setP({ heroTitleEn: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">{isAr ? 'العنوان الفرعي عربي' : 'Hero subtitle AR'}</label>
                          <textarea className="form-control" rows={2} value={page.heroSubtitleAr} onChange={e => setP({ heroSubtitleAr: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">{isAr ? 'العنوان الفرعي إنجليزي' : 'Hero subtitle EN'}</label>
                          <textarea className="form-control" rows={2} dir="ltr" value={page.heroSubtitleEn} onChange={e => setP({ heroSubtitleEn: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">{isAr ? 'زر رئيسي عربي' : 'Primary CTA AR'}</label>
                          <input className="form-control" value={page.ctaPrimaryLabelAr} onChange={e => setP({ ctaPrimaryLabelAr: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">{isAr ? 'زر رئيسي إنجليزي' : 'Primary CTA EN'}</label>
                          <input className="form-control" dir="ltr" value={page.ctaPrimaryLabelEn} onChange={e => setP({ ctaPrimaryLabelEn: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">{isAr ? 'زر ثانوي عربي' : 'Secondary CTA AR'}</label>
                          <input className="form-control" value={page.ctaSecondaryLabelAr} onChange={e => setP({ ctaSecondaryLabelAr: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">{isAr ? 'زر ثانوي إنجليزي' : 'Secondary CTA EN'}</label>
                          <input className="form-control" dir="ltr" value={page.ctaSecondaryLabelEn} onChange={e => setP({ ctaSecondaryLabelEn: e.target.value })} /></div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">{isAr ? 'معرض الصور (رابط في كل سطر)' : 'Gallery (one URL per line)'}</label>
                        <textarea className="form-control" rows={3} dir="ltr" value={galleryText} onChange={e => setGalleryText(e.target.value)} placeholder="https://…/img1.jpg" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                          {isAr ? 'المقاطع: إظهار/إخفاء + عنوان مخصص + نص إضافي + ترتيب' : 'Sections: visibility + custom title + extra body + order'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {page.sections.map((s, idx) => (
                            <div key={s.key} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0.6rem', background: 'var(--bg-app)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.6rem', alignItems: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 700, minWidth: '150px' }}>
                                <input type="checkbox" checked={s.visible} onChange={e => setPageSection(s.key, { visible: e.target.checked })} style={{ width: '17px', height: '17px' }} />
                                <span>{isAr ? PAGE_SECTION_DEFAULT_TITLES[s.key][0] : PAGE_SECTION_DEFAULT_TITLES[s.key][1]}</span>
                              </label>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <input className="form-control" placeholder={isAr ? 'عنوان مخصص عربي' : 'Custom title AR'} value={s.titleAr} onChange={e => setPageSection(s.key, { titleAr: e.target.value })} style={{ fontSize: '0.8rem' }} />
                                <input className="form-control" dir="ltr" placeholder="Custom title EN" value={s.titleEn} onChange={e => setPageSection(s.key, { titleEn: e.target.value })} style={{ fontSize: '0.8rem' }} />
                              </div>
                              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <textarea className="form-control" rows={2} placeholder={isAr ? 'نص إضافي عربي (اختياري — يظهر تحت العنوان)' : 'Extra body AR (optional)'} value={s.bodyAr} onChange={e => setPageSection(s.key, { bodyAr: e.target.value })} style={{ fontSize: '0.8rem' }} />
                                <textarea className="form-control" rows={2} dir="ltr" placeholder="Extra body EN (optional)" value={s.bodyEn} onChange={e => setPageSection(s.key, { bodyEn: e.target.value })} style={{ fontSize: '0.8rem' }} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <button type="button" className="btn btn-secondary" disabled={idx === 0} onClick={() => movePageSection(idx, -1)} style={{ padding: '0.2rem 0.4rem' }} title={isAr ? 'تحريك لأعلى' : 'Move up'}>
                                  <ChevronUp size={14} />
                                </button>
                                <button type="button" className="btn btn-secondary" disabled={idx === page.sections.length - 1} onClick={() => movePageSection(idx, 1)} style={{ padding: '0.2rem 0.4rem' }} title={isAr ? 'تحريك لأسفل' : 'Move down'}>
                                  <ChevronDown size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {formError && <ErrorBox message={formError} style={{ margin: '0 1.5rem' }} />}
          {conflict && onReloadLatest && (
            <div style={{ margin: '0.5rem 1.5rem 0' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onReloadLatest}>
                <RefreshCw size={14} /> {isAr ? 'تحميل أحدث نسخة (ستُفقد تعديلاتك غير المحفوظة)' : 'Load latest version (unsaved edits will be lost)'}
              </button>
            </div>
          )}

          <div className="modal-footer" style={{ position: 'sticky', bottom: 0, zIndex: 20, boxShadow: '0 -6px 16px rgba(7,11,20,0.08)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{variant === 'page' ? (isAr ? 'تجاهل التعديلات' : 'Discard changes') : (isAr ? 'إلغاء' : 'Cancel')}</button>
            <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>
              {savedSuccess ? <><Check size={16} /><span>{isAr ? 'تم الحفظ!' : 'Saved!'}</span></> : <><Save size={16} /><span>{isCreate ? (isAr ? 'إنشاء المبادرة' : 'Create') : (isAr ? 'حفظ كل التعديلات' : 'Save all')}</span></>}
            </button>
          </div>
        </form>
    </>
  );
};

/**
 * المحرر يفتح دائماً على أحدث نسخة من الباك (لا على نسخة الـ store التي قد تكون قديمة):
 * حفظ من صفحة مفتوحة قبل تحديث البيانات كان يمسح تعديلات أحدث. + الباك يرفض الحفظ فوق نسخة أحدث (409).
 * وضع page: بعد الحفظ يعيد التحميل ويبقى على نفس التاب.
 */
export const EditInitiativeModal: React.FC<EditInitiativeModalProps> = (props) => {
  const { initiative, variant = 'modal', onClose, onSaved } = props;
  const { language } = usePlatformStore();
  const isAr = language === 'ar';
  const [fresh, setFresh] = useState<Initiative | null>(null);
  const [loadError, setLoadError] = useState('');
  const [nonce, setNonce] = useState(0);
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'basic');
  const id = initiative?.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError('');
    api.getInitiative(id)
      .then(r => { if (!cancelled) setFresh((r as { data: Initiative }).data); })
      .catch(err => { if (!cancelled) setLoadError(err instanceof Error ? err.message : (isAr ? 'تعذر تحميل المبادرة.' : 'Could not load the initiative.')); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nonce]);

  // تاب مطلوب من الخارج (مثل زر «أكمل» في قائمة الاكتمال)
  useEffect(() => { if (props.initialTab) setTab(props.initialTab); }, [props.initialTab]);

  if (!initiative) return <EditInitiativeForm {...props} initiative={null} />;

  const reload = () => { setFresh(null); setNonce(n => n + 1); };

  if (!fresh || fresh.id !== id) {
    const body = (
      <div className="modal-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', minHeight: '160px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        {loadError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
            <ErrorBox message={loadError} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={reload}><RefreshCw size={14} /> {isAr ? 'إعادة المحاولة' : 'Retry'}</button>
          </div>
        ) : (
          <><Loader2 size={18} /> {isAr ? 'جارٍ تحميل أحدث نسخة من المبادرة…' : 'Loading the latest version…'}</>
        )}
      </div>
    );
    return variant === 'page'
      ? <div className="card" style={{ padding: 0 }}>{body}</div>
      : <Modal onClose={onClose} maxWidth="920px" title={isAr ? 'تعديل المبادرة' : 'Edit initiative'}>{body}</Modal>;
  }

  return (
    <EditInitiativeForm
      key={`${fresh.id}:${fresh.updatedAt ?? ''}`}
      {...props}
      initiative={fresh}
      initialTab={tab}
      onTabChange={setTab}
      onSaved={() => { onSaved?.(); reload(); }}
      onClose={variant === 'page' ? reload : onClose}
      onReloadLatest={reload}
    />
  );
};
