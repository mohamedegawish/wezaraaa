import type { Application, Initiative } from '../../../types';
import { buildGroupCounts, buildTimelineMonthly } from '../../../utils/reports';

/**
 * تحليلات مبادرة واحدة — دوال بحتة من بيانات المبادرة وطلباتها فقط (لا أرقام مفترضة).
 * كل قيمة قد تكون null عند غياب بياناتها، والواجهة تخفي ما لا بيانات له.
 */

const REVIEW = ['submitted', 'under_review', 'in_progress'];
const REWORK = ['pending_documents'];
const APPROVED = ['approved', 'completed'];
const REJECTED = ['rejected', 'cancelled'];
const DAY = 86_400_000;

export interface StageRow {
  id: string;
  name: string;
  org: string;
  slaDays: number;
  /** وصلت لهذه المرحلة أو تجاوزتها */
  reached: number;
  /** مفتوحة فيها الآن */
  openNow: number;
  avgDays: number | null;
  overdue: number;
  isBottleneck: boolean;
}

const days = (a: string | undefined, b: string | undefined): number | null => {
  const t1 = a ? Date.parse(a) : NaN;
  const t2 = b ? Date.parse(b) : NaN;
  return Number.isFinite(t1) && Number.isFinite(t2) && t2 >= t1 ? (t2 - t1) / DAY : null;
};
const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function analyzeInitiative(init: Initiative, allApps: Application[], isAr: boolean, now = Date.now()) {
  // مسودات المصانع ليست طلبات مقدمة
  const apps = allApps.filter(a => a.initiativeId === init.id && a.status !== 'draft');
  const count = (set: string[]) => apps.filter(a => set.includes(a.status)).length;

  const total = apps.length;
  const review = count(REVIEW);
  const rework = count(REWORK);
  const approved = count(APPROVED);
  const completed = count(['completed']);
  const rejected = count(REJECTED);
  const decided = approved + rejected;
  const open = review + rework;

  // ---- التقدم مقابل المستهدف ----
  const uniqueFactories = new Set(apps.map(a => a.factoryId).filter(Boolean)).size;
  const financingApps = apps.filter(a => (a.requestedFinancingAmountEGP ?? 0) > 0);
  const requestedFinancing = financingApps.reduce((s, a) => s + (a.requestedFinancingAmountEGP ?? 0), 0);
  const approvedFinancing = financingApps.filter(a => APPROVED.includes(a.status)).reduce((s, a) => s + (a.requestedFinancingAmountEGP ?? 0), 0);
  const capacityApps = apps.filter(a => (a.systemCapacityKW ?? 0) > 0);
  const requestedCapacityMW = capacityApps.reduce((s, a) => s + (a.systemCapacityKW ?? 0), 0) / 1000;
  const perClientLimit = init.financialTerms?.maxFinancingPerClientEGP ?? 0;
  const overLimit = perClientLimit > 0 ? financingApps.filter(a => (a.requestedFinancingAmountEGP ?? 0) > perClientLimit).length : 0;

  // ---- المراحل: الوصول (قمع حقيقي بالمسار) + عنق الزجاجة ----
  const stages = [...(init.workflow?.stages ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const stageIndex = (a: Application) => {
    if (APPROVED.includes(a.status)) return stages.length - 1; // اعتُمد = اجتاز المسار
    const i = stages.findIndex(s => s.id === a.currentStageId);
    return i >= 0 ? i : 0;
  };
  const stageRows: StageRow[] = stages.map((st, idx) => {
    const here = apps.filter(a => [...REVIEW, ...REWORK].includes(a.status) && a.currentStageId === st.id);
    const d = here.map(a => Number(a.daysSpentInStage)).filter(n => Number.isFinite(n) && n >= 0);
    return {
      id: st.id,
      name: ((isAr ? st.nameAr : st.nameEn || st.nameAr) || '').replace(/^\d+\.\s*/, ''),
      org: st.assignedOrgNameAr ?? '',
      slaDays: Number(st.slaDays) || 0,
      reached: apps.filter(a => stageIndex(a) >= idx).length,
      openNow: here.length,
      avgDays: avg(d),
      overdue: here.filter(a => a.isSlaViolated).length,
      isBottleneck: false,
    };
  });
  // عنق الزجاجة: أعلى نسبة (متوسط الأيام ÷ المدة المحددة) بين المراحل التي بها طلبات مفتوحة
  const ratio = (r: StageRow) => (r.avgDays !== null && r.slaDays > 0 ? r.avgDays / r.slaDays : 0);
  const worst = stageRows.filter(r => r.openNow > 0).sort((a, b) => ratio(b) - ratio(a) || b.overdue - a.overdue)[0];
  if (worst && (ratio(worst) >= 0.8 || worst.overdue > 0)) worst.isBottleneck = true;

  // ---- الزمن والـ SLA ----
  const decidedApps = apps.filter(a => [...APPROVED, ...REJECTED].includes(a.status));
  const decisionDays = decidedApps.map(a => days(a.submittedAt, a.lastUpdatedAt)).filter((n): n is number => n !== null);
  const openApps = apps.filter(a => [...REVIEW, ...REWORK].includes(a.status));
  const overdueOpen = openApps.filter(a => a.isSlaViolated).length;

  // ---- التوزيعات ----
  const byGov = buildGroupCounts(apps, a => (isAr ? a.factoryGovernorateAr : a.factoryGovernorateEn || a.factoryGovernorateAr));
  const bySector = buildGroupCounts(apps, a => (isAr ? a.factorySectorAr : a.factorySectorEn || a.factorySectorAr));
  const byBank = buildGroupCounts(apps.filter(a => a.assignedBankNameAr), a => (isAr ? a.assignedBankNameAr : a.assignedBankNameEn || a.assignedBankNameAr) ?? '');
  const monthly = buildTimelineMonthly(apps);

  // ---- المدة الزمنية للمبادرة ----
  const start = init.startDate ? Date.parse(init.startDate) : NaN;
  let end = init.endDate ? Date.parse(init.endDate) : NaN;
  const years = init.financialTerms?.maxDurationYears ?? 0;
  if (Number.isFinite(start) && years > 0 && (!Number.isFinite(end) || end <= start)) {
    const e = new Date(start);
    e.setFullYear(e.getFullYear() + years);
    end = e.getTime();
  }
  const timeline = Number.isFinite(start) && Number.isFinite(end) && end > start
    ? {
        start: new Date(start),
        end: new Date(end),
        elapsedDays: Math.max(0, Math.floor((Math.min(now, end) - start) / DAY)),
        remainingDays: Math.max(0, Math.ceil((end - now) / DAY)),
        percent: Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)),
        notStarted: now < start,
      }
    : null;

  return {
    total, review, rework, approved, completed, rejected, decided, open,
    acceptanceRate: decided ? approved / decided : null,
    uniqueFactories,
    targetFactories: init.impactMetrics?.targetFactories ?? 0,
    requestedFinancing, approvedFinancing, financingCount: financingApps.length,
    avgFinancing: financingApps.length ? requestedFinancing / financingApps.length : null,
    maxFinancing: financingApps.length ? Math.max(...financingApps.map(a => a.requestedFinancingAmountEGP ?? 0)) : null,
    perClientLimit, overLimit,
    requestedCapacityMW, capacityCount: capacityApps.length,
    targetCapacityMW: init.impactMetrics?.targetCapacityMW ?? 0,
    budgetTotal: init.budgetTotalEGP ?? 0,
    budgetAllocated: init.budgetAllocatedEGP ?? 0,
    stageRows,
    avgDecisionDays: avg(decisionDays),
    medianDecisionDays: median(decisionDays),
    decisionSample: decisionDays.length,
    openCount: openApps.length,
    overdueOpen,
    slaCompliance: openApps.length ? (openApps.length - overdueOpen) / openApps.length : null,
    escalated: apps.filter(a => a.isEscalated).length,
    byGov, bySector, byBank, monthly,
    timeline,
  };
}

export type InitiativeAnalytics = ReturnType<typeof analyzeInitiative>;
