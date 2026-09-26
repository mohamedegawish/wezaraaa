import type { Initiative } from '../../../types';
import type { EditorTab } from '../EditInitiativeModal';

export interface CompletenessItem {
  key: string;
  ar: string;
  en: string;
  done: boolean;
  /** التاب الذي يُكمل منه هذا البند في المحرر */
  tab: EditorTab;
}

// أسماء المراحل الافتراضية التي يضعها محرر المسار عند الإضافة — ليست مراحل حقيقية بعد
const PLACEHOLDER_STAGE = /مرحلة تقييم جديدة|new evaluation stage/i;

/**
 * اكتمال بيانات المبادرة مقابل أقسام وثيقتها الرسمية. نفس الدالة لجدول القائمة ولمساحة المبادرة.
 * (المؤشرات خارجها عمداً: تُحمَّل من راوت أدمن لكل مبادرة، وتُعرض منفصلة في التحليلات.)
 */
export function initiativeCompleteness(i: Initiative): { items: CompletenessItem[]; percent: number; missing: CompletenessItem[] } {
  const ft = i.financialTerms ?? {};
  const stages = i.workflow?.stages ?? [];
  const items: CompletenessItem[] = [
    { key: 'titles', ar: 'الاسم بالعربي والإنجليزي والوصف المختصر', en: 'Arabic & English title, tagline', tab: 'basic',
      done: (i.titleAr ?? '').trim().length >= 3 && (i.titleEn ?? '').trim().length >= 3 && !!(i.taglineAr ?? '').trim() },
    { key: 'cover', ar: 'صورة الغلاف', en: 'Cover image', tab: 'basic', done: !!(i.coverImage ?? '').trim() },
    { key: 'goal', ar: 'الهدف العام', en: 'General goal', tab: 'goals', done: !!(i.descriptionAr ?? '').trim() },
    { key: 'objectives', ar: 'المستهدفات الرئيسية', en: 'Key objectives', tab: 'goals', done: (i.objectives ?? []).length > 0 },
    { key: 'targets', ar: 'الأرقام المستهدفة (مصانع أو قدرة)', en: 'Target figures', tab: 'goals',
      done: !!(i.impactMetrics?.targetFactories || i.impactMetrics?.targetCapacityMW) },
    { key: 'financial', ar: 'المحددات المالية (القيمة وصورة التمويل والحدود)', en: 'Financing terms', tab: 'financial',
      done: i.budgetTotalEGP > 0 && !!ft.financingType && !!(ft.maxFinancingPerClientEGP || ft.maxDurationYears) },
    { key: 'dates', ar: 'تاريخ الإطلاق', en: 'Launch date', tab: 'financial', done: !!(i.startDate ?? '').trim() },
    { key: 'partners', ar: 'الجهات المشاركة', en: 'Participating entities', tab: 'targeting', done: (i.participatingOrgs ?? []).length > 0 },
    { key: 'requirements', ar: 'اشتراطات التأهيل', en: 'Eligibility requirements', tab: 'requirements', done: (i.eligibilityRequirements ?? []).length > 0 },
    { key: 'docs', ar: 'المستندات المطلوب رفعها', en: 'Documents to upload', tab: 'requirements', done: (i.requiredDocsList ?? []).length > 0 },
    { key: 'criteria', ar: 'معايير اختيار المصانع', en: 'Selection criteria', tab: 'criteria', done: (i.selectionCriteria ?? []).length > 0 },
    { key: 'stages', ar: 'مراحل تنفيذ حقيقية (بعد المراجعة الأولية)', en: 'Real execution stages', tab: 'execution',
      done: stages.length > 1 && !stages.some(s => PLACEHOLDER_STAGE.test(s.nameAr ?? '') || PLACEHOLDER_STAGE.test(s.nameEn ?? '')) },
    { key: 'quiz', ar: 'أسئلة فحص الأهلية', en: 'Eligibility quiz', tab: 'eligibility', done: (i.preEligibilityQuestions ?? []).length > 0 },
  ];
  const missing = items.filter(x => !x.done);
  return { items, missing, percent: Math.round(((items.length - missing.length) / items.length) * 100) };
}
