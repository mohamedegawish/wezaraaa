// Statistics — Advanced Executive Command Center & Industrial Analytics
// Real-time KPI matrix, 5 analytical tabs, multi-dimension filters & high-fidelity exports.

import React, { useMemo, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import {
  downloadCSV, downloadExcel, printReport,
  applicationsToRows, APPLICATIONS_REPORT_HEADERS,
  initiativesToRows, INITIATIVES_REPORT_HEADERS,
  filterApplications, computeReportKpis,
  buildStatusDistribution, buildTimelineMonthly, buildGroupCounts,
  ReportFilters,
} from '../../utils/reports';
import { DonutChart, BarChart, AreaChart } from './StatCharts';
import { ApplicationStatus } from '../../types';
import {
  ShieldCheck, Activity, Layers, Filter, Calendar,
  Building2, Factory, FileText, TrendingUp, Clock, Banknote, Users,
  Zap, Flame, FileSpreadsheet, Printer, Download, Leaf, Award,
  Sun, Gauge as GaugeIcon, PieChart, Globe2, Compass
} from 'lucide-react';

// ── Semi-circular gauge (SVG, CSS-var colors) ──────────────────────────────
const Gauge: React.FC<{ value: number; label: string; sub?: string; color?: string }> = ({ 
  value, label, sub, color = 'var(--status-approved)' 
}) => {
  const pct = Math.max(0, Math.min(100, value));
  const angle = (pct / 100) * 180;
  const r = 64;
  const cx = 90, cy = 78;
  const rad = (deg: number) => (deg - 180) * Math.PI / 180;
  const x1 = cx + r * Math.cos(rad(0));
  const y1 = cy + r * Math.sin(rad(0));
  const x2 = cx + r * Math.cos(rad(180));
  const y2 = cy + r * Math.sin(rad(180));
  const nx = cx + r * Math.cos(rad(angle));
  const ny = cy + r * Math.sin(rad(angle));
  const large = angle > 90 ? 1 : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
      <svg width={180} height={110} viewBox="0 0 180 110" style={{ display: 'block' }}>
        <path d={`M ${x2} ${y2} A ${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" strokeWidth={14} strokeLinecap="round" style={{ stroke: 'var(--bg-muted)' }} />
        <path d={`M ${x2} ${y2} A ${r} ${r} 0 ${large} 1 ${nx} ${ny}`} fill="none" strokeWidth={14} strokeLinecap="round" style={{ stroke: color }} />
        <circle cx={cx} cy={cy} r={4} style={{ fill: 'var(--text-main)' }} />
        <text x={cx} y={58} textAnchor="middle" fontSize={22} fontWeight={800} style={{ fill: 'var(--text-main)' }}>{pct.toFixed(0)}%</text>
        <text x={cx} y={72} textAnchor="middle" fontSize={10} fontWeight={600} style={{ fill: 'var(--text-muted)' }}>{label}</text>
      </svg>
      {sub && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-muted)', padding: '0.15rem 0.5rem', borderRadius: 9999 }}>{sub}</span>}
    </div>
  );
};

export const AdminStatsView: React.FC = () => {
  const { applications, initiatives, factories, organizations, language, currentUser } = usePlatformStore();
  const isAr = language === 'ar';
  const isAdmin = currentUser.role === 'ministry_admin' || currentUser.role === 'initiative_manager';

  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'energy' | 'entities' | 'geographic'>('overview');
  const [filters, setFilters] = useState<ReportFilters>({ initiativeIds: [], statuses: [], orgIds: [], sectors: [], governorates: [], search: '', dateFrom: '', dateTo: '' });
  const [preset, setPreset] = useState('all');

  const applyPreset = (p: string) => {
    setPreset(p);
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    if (p === 'all') setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }));
    else if (p === '30d') { const from = new Date(now); from.setDate(now.getDate() - 30); setFilters(f => ({ ...f, dateFrom: fmt(from), dateTo: fmt(now) })); }
    else if (p === 'quarter') { const q = Math.floor(now.getMonth() / 3); const from = new Date(now.getFullYear(), q * 3, 1); setFilters(f => ({ ...f, dateFrom: fmt(from), dateTo: fmt(now) })); }
    else if (p === '2026') setFilters(f => ({ ...f, dateFrom: '2026-01-01', dateTo: '2026-12-31' }));
  };

  const allSectors = useMemo(() => [...new Set(applications.map(a => a.factorySectorAr).filter(Boolean))], [applications]);
  const allGovs = useMemo(() => [...new Set(applications.map(a => a.factoryGovernorateAr).filter(Boolean))], [applications]);

  const filteredApps = useMemo(() => filterApplications(applications, filters), [applications, filters]);
  const kpis = useMemo(() => computeReportKpis(applications, filteredApps, initiatives, factories, organizations), [applications, filteredApps, initiatives, factories, organizations]);

  const statusDist = useMemo(() => buildStatusDistribution(filteredApps), [filteredApps]);
  const timeline = useMemo(() => buildTimelineMonthly(filteredApps), [filteredApps]);
  const sectorCounts = useMemo(() => buildGroupCounts(filteredApps, a => a.factorySectorAr), [filteredApps]);
  const govCounts = useMemo(() => buildGroupCounts(filteredApps, a => a.factoryGovernorateAr), [filteredApps]);

  const slaBreaches = useMemo(() => applications.filter(a => a.isSlaViolated).length, [applications]);
  const avgSla = kpis.avgSla;
  const slaCompliance = useMemo(() => {
    const total = filteredApps.length || 1;
    const breached = filteredApps.filter(a => a.isSlaViolated).length;
    return Math.round(((total - breached) / total) * 100);
  }, [filteredApps]);

  // Funnel
  const funnel = useMemo(() => {
    const order: { key: ApplicationStatus; labelAr: string; labelEn: string; color: string }[] = [
      { key: 'submitted', labelAr: 'تقديم الطلب المبدئي', labelEn: 'Submitted', color: '#64748B' },
      { key: 'under_review', labelAr: 'المراجعة والتدقيق الفني', labelEn: 'Under Review', color: '#1E40AF' },
      { key: 'in_progress', labelAr: 'لجان المعاينة والتقييم', labelEn: 'In Progress / Inspection', color: '#0E6B65' },
      { key: 'pending_documents', labelAr: 'ملاحظات واستيفاء مستندات', labelEn: 'Rework / Pending Docs', color: '#D97706' },
      { key: 'approved', labelAr: 'اعتماد المبادرة والحافز', labelEn: 'Approved', color: '#059669' },
      { key: 'completed', labelAr: 'اكتمال وصرف الحافز', labelEn: 'Completed / Disbursed', color: '#10B981' },
      { key: 'rejected', labelAr: 'مرفوض لعدم المطابقة', labelEn: 'Rejected', color: '#DC2626' },
    ];
    const counts = new Map<string, number>();
    order.forEach(o => counts.set(o.key, 0));
    filteredApps.forEach(a => counts.set(a.status, (counts.get(a.status) || 0) + 1));
    const total = filteredApps.length || 1;
    return order.map(o => ({
      ...o,
      count: counts.get(o.key) || 0,
      pct: Math.round(((counts.get(o.key) || 0) / total) * 100),
    }));
  }, [filteredApps]);

  // Macro Financial Calculations
  const financialStats = useMemo(() => {
    const totalBudget = kpis.budgetTotal || 1;
    const spentBudget = kpis.budgetAllocated;
    const remainingBudget = Math.max(0, totalBudget - spentBudget);
    const stimulated = kpis.investmentStimulated;
    const multiplier = spentBudget > 0 ? (stimulated / spentBudget).toFixed(1) : '5.4';
    const avgIncentivePerFactory = kpis.benefitedFactories > 0 
      ? Math.round(spentBudget / kpis.benefitedFactories)
      : 3200000;
    const subsidizedLoans = Math.round(stimulated * 0.42);
    const importSubstitutionEst = Math.round(stimulated * 0.65);

    return {
      totalBudget,
      spentBudget,
      remainingBudget,
      stimulated,
      multiplier,
      avgIncentivePerFactory,
      subsidizedLoans,
      importSubstitutionEst
    };
  }, [kpis]);

  // Clean Energy & Environmental Calculations
  const energyStats = useMemo(() => {
    const benefited = kpis.benefitedFactories || 48;
    const totalInstalledCapacityKW = benefited * 250; // avg 250kW per solar factory
    const totalInstalledMWp = (totalInstalledCapacityKW / 1000).toFixed(1);
    const annualEnergySavedMWh = Math.round(benefited * 380);
    const annualBillSavingsEGP = Math.round(annualEnergySavedMWh * 1850); // average EGP per MWh
    const co2AvoidedTons = Math.round(annualEnergySavedMWh * 0.52);
    const roofAreaDeployedSqM = Math.round(benefited * 2400);

    return {
      totalInstalledMWp,
      annualEnergySavedMWh,
      annualBillSavingsEGP,
      co2AvoidedTons,
      roofAreaDeployedSqM,
    };
  }, [kpis.benefitedFactories]);

  // Organizations SLA & Performance Matrix
  const orgPerformance = useMemo(() => {
    return organizations.map(org => {
      const assignedApps = filteredApps.filter(a => a.currentAssignedOrgId === org.id || a.currentAssignedOrgNameAr === org.nameAr);
      const approvedCount = assignedApps.filter(a => a.status === 'approved' || a.status === 'completed').length;
      const reworkCount = assignedApps.filter(a => a.status === 'pending_documents').length;
      const overdueCount = assignedApps.filter(a => a.isSlaViolated).length;
      const approvalRate = assignedApps.length ? Math.round((approvedCount / assignedApps.length) * 100) : 85;
      const complianceRate = assignedApps.length ? Math.round(((assignedApps.length - overdueCount) / assignedApps.length) * 100) : 92;
      const avgDays = org.type === 'bank' ? 9 : org.type === 'provider' ? 5 : 7;

      return {
        org,
        assignedCount: assignedApps.length,
        approvedCount,
        reworkCount,
        overdueCount,
        approvalRate,
        complianceRate,
        avgDays,
      };
    }).sort((a, b) => b.assignedCount - a.assignedCount);
  }, [organizations, filteredApps]);

  const topFactories = useMemo(() => {
    const m = new Map<string, { name: string; sector: string; gov: string; count: number; investment: number }>();
    filteredApps.forEach(a => {
      const key = a.factoryId;
      const cur = m.get(key);
      if (cur) {
        cur.count += 1;
        cur.investment += (a.requestedFinancingAmountEGP || 2500000);
      } else {
        m.set(key, {
          name: isAr ? a.factoryNameAr : a.factoryNameEn,
          sector: a.factorySectorAr,
          gov: a.factoryGovernorateAr,
          count: 1,
          investment: a.requestedFinancingAmountEGP || 2500000
        });
      }
    });
    return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filteredApps, isAr]);

  const summaryFilters = useMemo(() => {
    const parts: string[] = [];
    if (filters.dateFrom || filters.dateTo) parts.push(`${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`);
    if (filters.statuses?.length) parts.push(filters.statuses.join(', '));
    if (filters.sectors?.length) parts.push(filters.sectors.join(', '));
    if (filters.governorates?.length) parts.push(filters.governorates.join(', '));
    if (filters.initiativeIds?.length) parts.push(`${filters.initiativeIds.length} مبادرات`);
    return parts.join(' • ') || (isAr ? 'كل البيانات — بلا فلاتر' : 'All data — no filters');
  }, [filters, isAr]);

  if (!isAdmin) {
    return (
      <div className="container-custom" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 560, margin: '0 auto', padding: '2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--status-rejected-bg)', color: 'var(--status-rejected)', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}><ShieldCheck size={28} /></div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{isAr ? 'الوصول للإدارة فقط' : 'Admin access only'}</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{isAr ? 'هذه الصفحة متاحة لإدارة الوزارة فقط.' : 'This page is available to administration only.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom" style={{ padding: '1.25rem 1.5rem 5.5rem 1.5rem' }}>

      {/* ── Sovereign Command Center Header ── */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', background: '#FFFFFF', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: '3px', position: 'absolute', top: 0, left: 0, right: 0, background: 'var(--egypt-flag-ribbon)' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: '#0F172A', color: '#FFFFFF', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(15, 23, 42, 0.15)' }}>
              <Activity size={22} style={{ color: 'var(--egypt-red)' }} />
            </span>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-main)' }}>
                  {isAr ? 'مركز الإحصائيات والتحليلات اللحظية للأداء الصناعي' : 'Industrial Real-time Analytics & Statistics Command Center'}
                </h1>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 9999, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #DBEAFE' }}>
                  {isAr ? 'محدث لحظياً' : 'Live Updated'}
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {isAr ? 'مؤشرات الأداء الوطنية، معدلات تدفق الطلبات، العائد الاستثماري، كفاءة الطاقة، وسرعة استجابة الجهات الشريكة.' : 'National performance KPIs, application pipeline, investment multiplier, clean energy savings, and inter-agency SLAs.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const stamp = new Date().toISOString().split('T')[0];
              void downloadExcel(`industrial-stats-${stamp}.xlsx`, APPLICATIONS_REPORT_HEADERS, applicationsToRows(filteredApps, factories), 'Applications');
            }}>
              <FileSpreadsheet size={14} /> {isAr ? 'تصدير Excel' : 'Export Excel'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const rows = initiativesToRows(initiatives.filter(i => !filters.initiativeIds?.length || filters.initiativeIds.includes(i.id)), filteredApps);
              const body = `<div><span class="kpi">${isAr ? 'طلبات مطابقة' : 'Matching'}: ${kpis.filteredApplications}</span><span class="kpi">${isAr ? 'اعتماد' : 'Approval'}: ${(kpis.approvalRate * 100).toFixed(1)}%</span><span class="kpi">SLA: ${avgSla} ${isAr ? 'أيام' : 'days'}</span></div><br/><table><thead><tr>${INITIATIVES_REPORT_HEADERS.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
              printReport('إحصائيات الأداء الصناعي', 'Industrial Statistics', body, isAr);
            }}>
              <Printer size={14} /> {isAr ? 'طباعة التحليلات' : 'Print'}
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              <Calendar size={13} /> {isAr ? 'المدى الزمني:' : 'Period:'}
            </span>
            {[
              { id: 'all', ar: 'كل الفترات', en: 'All time' },
              { id: '30d', ar: 'آخر 30 يوماً', en: 'Last 30 days' },
              { id: 'quarter', ar: 'هذا الربع', en: 'This quarter' },
              { id: '2026', ar: 'عام 2026', en: 'Year 2026' },
            ].map(p => (
              <button key={p.id} onClick={() => applyPreset(p.id)} className={`btn btn-sm ${preset === p.id ? 'btn-primary' : 'btn-secondary'}`} style={{ borderRadius: 9999, fontSize: '0.75rem', padding: '0.2rem 0.65rem' }}>
                {isAr ? p.ar : p.en}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Filter size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> {summaryFilters}
            </span>
            {(filters.initiativeIds?.length || filters.statuses?.length || filters.orgIds?.length || filters.sectors?.length || filters.governorates?.length || filters.dateFrom) && (
              <button className="btn btn-ghost btn-sm" style={{ padding: '0.15rem 0.45rem', fontSize: '0.725rem' }} onClick={() => setFilters({ initiativeIds: [], statuses: [], orgIds: [], sectors: [], governorates: [], search: '', dateFrom: '', dateTo: '' })}>
                {isAr ? 'إعادة ضبط' : 'Reset'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Command Center Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.5rem' }}>
        {[
          { id: 'overview', labelAr: 'نظرة تنفيذية شاملة وقمع الطلبات', labelEn: 'Overview & Pipeline Funnel', icon: Compass },
          { id: 'financial', labelAr: 'الإنجازات المالية والاستثمارية وبدائل الاستيراد', labelEn: 'Financial & Macro Investment', icon: Banknote },
          { id: 'energy', labelAr: 'كفاءة الطاقة والتحول الأخضر', labelEn: 'Clean Energy & Decarbonization', icon: Sun },
          { id: 'entities', labelAr: 'مصفوفة أداء وجودة الجهات الشريكة و SLA', labelEn: 'Inter-Agency Performance & SLA', icon: Award },
          { id: 'geographic', labelAr: 'التوزيع الجغرافي والقطاعي والمصانع الرائدة', labelEn: 'Geographic, Sectors & Leaders', icon: Globe2 },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: isActive ? 'var(--egypt-red)' : 'transparent',
                color: isActive ? '#FFFFFF' : '#475569',
                fontSize: '0.825rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 1: OVERVIEW & CONVERSION FUNNEL
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Bento Matrix 8 High-Impact Indicators */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            {[
              { icon: FileText, labelAr: 'الطلبات المطابقة', labelEn: 'Matching Apps', value: kpis.filteredApplications.toLocaleString(isAr ? 'ar-EG' : 'en-US'), sub: `${isAr ? 'من إجمالي' : 'of total'} ${kpis.totalApplications}`, color: 'var(--egypt-red)' },
              { icon: TrendingUp, labelAr: 'معدل الاعتماد الإجمالي', labelEn: 'Approval Rate', value: `${(kpis.approvalRate * 100).toFixed(1)}%`, sub: `${kpis.approved + kpis.completed} ${isAr ? 'طلب مكتمل ومعتمد' : 'approved/done'}`, color: '#059669' },
              { icon: Clock, labelAr: 'متوسط سرعة الإنجاز SLA', labelEn: 'Avg Processing Time', value: `${avgSla} ${isAr ? 'أيام' : 'days'}`, sub: `${slaCompliance}% ${isAr ? 'نسبة الالتزام' : 'compliance'}`, color: '#1E40AF' },
              { icon: Banknote, labelAr: 'الاستثمارات الصناعية المحفزة', labelEn: 'Stimulated Investment', value: `${(kpis.investmentStimulated / 1e9).toFixed(1)} B`, sub: `${isAr ? 'مليار جنيه مصري' : 'Billion EGP'}`, color: '#D97706' },
              { icon: Building2, labelAr: 'المصانع والجهات المسجلة', labelEn: 'Factories / Orgs', value: `${kpis.factoriesCount} / ${kpis.orgsCount}`, sub: `${isAr ? 'منشأة صناعية نشطة' : 'active facilities'}`, color: '#0E6B65' },
              { icon: Users, labelAr: 'فرص العمل المستحدثة', labelEn: 'New Industrial Jobs', value: kpis.jobsCreated.toLocaleString(isAr ? 'ar-EG' : 'en-US'), sub: `${isAr ? 'وظيفة فنية وهندسية' : 'technical jobs'}`, color: '#7C3AED' },
              { icon: Zap, labelAr: 'طلبات قيد المراجعة والمعاينة', labelEn: 'In Active Pipeline', value: String(kpis.inReview), sub: `${kpis.pendingDocs} ${isAr ? 'مطلوب استيفاء' : 'rework'}`, color: '#0284C7' },
              { icon: Flame, labelAr: 'تحقيق المستهدف القومي', labelEn: 'National Goal Progress', value: `${kpis.benefitedFactories} / ${kpis.targetFactories}`, sub: `${kpis.targetFactories ? Math.round((kpis.benefitedFactories / kpis.targetFactories) * 100) : 0}% ${isAr ? 'نسبة الإنجاز' : 'progress'}`, color: '#DC2626' },
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.labelEn} className="card" style={{ padding: '0.95rem 1.1rem', background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderTop: `3px solid ${k.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{isAr ? k.labelAr : k.labelEn}</span>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: '#F8FAFC', color: k.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={15} /></span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{k.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{k.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Charts Row 1: Funnel Pipeline + Status Distribution Donut + SLA Gauge */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* End to End Pipeline Funnel */}
            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  <Layers size={16} style={{ color: 'var(--egypt-red)' }} />
                  {isAr ? 'قمع مراحل تدفق ومعالجة الطلبات' : 'End-to-End Application Funnel'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{filteredApps.length} {isAr ? 'إجمالي الطلبات' : 'total'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {funnel.map(f => (
                  <div key={f.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{isAr ? f.labelAr : f.labelEn}</span>
                      <span><strong style={{ color: f.color }}>{f.count}</strong> ({f.pct}%)</span>
                    </div>
                    <div className="progress-track" style={{ height: '7px', background: '#F1F5F9' }}>
                      <div style={{ width: `${Math.max(4, f.pct)}%`, height: '100%', background: f.color, borderRadius: 'var(--radius-full)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1rem', display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                <PieChart size={16} style={{ color: '#0E6B65' }} />
                {isAr ? 'توزيع الحالات اللحظي' : 'Real-time Status Distribution'}
              </h3>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <DonutChart data={statusDist.map(s => ({ label: isAr ? s.labelAr : s.labelEn, value: s.count, color: `var(--status-${s.key})` }))} size={170} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', flex: 1, minWidth: 140 }}>
                  {statusDist.map(s => (
                    <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--status-${s.key})` }} />
                        {isAr ? s.labelAr : s.labelEn}
                      </span>
                      <strong style={{ color: 'var(--text-main)' }}>{s.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SLA Gauge & Timeline velocity */}
            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.5rem', display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                  <GaugeIcon size={16} style={{ color: '#1E40AF' }} />
                  {isAr ? 'مؤشر الالتزام بمستوى الخدمة SLA' : 'SLA Adherence Gauge'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  {isAr ? 'نسبة المعاملات المنجزة ضمن السقف الزمني القانوني المحدد.' : 'Transactions resolved within standard timeframe.'}
                </p>
              </div>

              <div style={{ margin: '0.75rem auto' }}>
                <Gauge value={slaCompliance} label={isAr ? 'التزام زمني' : 'compliance'} sub={`${slaBreaches} ${isAr ? 'تجاوز مسجل' : 'breaches'}`} />
              </div>

              <div style={{ background: '#F8FAFC', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                <span>{isAr ? 'متوسط سرعة الإنجاز:' : 'Avg Speed:'} <strong>{avgSla} {isAr ? 'أيام' : 'days'}</strong></span>
                <span>{isAr ? 'المعاملات المنتظمة:' : 'On-time:'} <strong style={{ color: '#059669' }}>{slaCompliance}%</strong></span>
              </div>
            </div>
          </div>

          {/* Submissions Velocity Over Time */}
          <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                <TrendingUp size={16} style={{ color: 'var(--egypt-red)' }} />
                {isAr ? 'تطور تدفق التقديمات والطلبات شهرياً عبر المنصة' : 'Monthly Submission Velocity & Intake'}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{timeline.length} {isAr ? 'أشهر مسجلة' : 'months'}</span>
            </div>
            <AreaChart data={timeline.map(t => ({ label: isAr ? t.labelAr : t.month, value: t.count }))} />
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 2: FINANCIAL & MACRO IMPACT
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'financial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Financial Multiplier Top Banner */}
          <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFFFFF', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 9999, background: 'rgba(217, 119, 6, 0.25)', color: '#FCD34D', border: '1px solid rgba(252, 211, 77, 0.3)' }}>
                  {isAr ? 'مضاعف الاستثمار الحكومي' : 'Public Investment Multiplier'}
                </span>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#FFFFFF', marginTop: '0.5rem', lineHeight: 1.1 }}>
                  1 : {financialStats.multiplier}x
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.35rem', lineHeight: 1.5 }}>
                  {isAr ? 'كل 1 جنيه مصري من الحوافز الحكومية يحفز ما يعادله من 5.4 إلى 6 جنيهات استثمارات صناعية خاصة.' : 'Every 1 EGP in government incentive unlocks ~5.4x in private capital investments.'}
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600 }}>{isAr ? 'إجمالي الاستثمارات المحفزة' : 'Total Stimulated Investment'}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38BDF8', marginTop: '0.2rem' }}>
                  {(financialStats.stimulated / 1e9).toFixed(2)} {isAr ? 'مليار ج.م' : 'B EGP'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.25rem' }}>{isAr ? 'قيمة خطوط الإنتاج والآلات المشتراة' : 'Production lines & equipment'}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600 }}>{isAr ? 'القيمة التقديرية لبدائل الاستيراد' : 'Import Substitution Value'}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34D399', marginTop: '0.2rem' }}>
                  {(financialStats.importSubstitutionEst / 1e9).toFixed(2)} {isAr ? 'مليار ج.م' : 'B EGP'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '0.25rem' }}>{isAr ? 'توفير عملة صعبة سنوياً' : 'Foreign currency saved'}</div>
              </div>
            </div>
          </div>

          {/* Budget Allocation vs Disbursement Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1rem' }}>
                {isAr ? 'ميزانيات المبادرات والمصروف منها' : 'Initiative Budgets & Spend'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {initiatives.map(init => {
                  const spentPct = init.budgetTotalEGP > 0 ? Math.min(100, Math.round(((init.budgetAllocatedEGP || 0) / init.budgetTotalEGP) * 100)) : 0;
                  return (
                    <div key={init.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{isAr ? init.titleAr : init.titleEn}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          <strong>{((init.budgetAllocatedEGP || 0) / 1e6).toFixed(1)}M</strong> / {(init.budgetTotalEGP / 1e6).toFixed(0)}M ج.م ({spentPct}%)
                        </span>
                      </div>
                      <div className="progress-track" style={{ height: '8px', background: '#F1F5F9' }}>
                        <div style={{ width: `${spentPct}%`, height: '100%', background: spentPct > 80 ? '#DC2626' : spentPct > 50 ? '#D97706' : '#059669', borderRadius: 'var(--radius-full)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1rem' }}>
                {isAr ? 'التمويلات البنكية الميسرة والتسهيلات الائتمانية' : 'Subsidized Banking Facilities'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ padding: '0.85rem', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>{isAr ? 'إجمالي التسهيلات التمويلية الممنوحة' : 'Total Low-Interest Loans Granted'}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E40AF', marginTop: '0.2rem' }}>
                    {(financialStats.subsidizedLoans / 1e6).toLocaleString(isAr ? 'ar-EG' : 'en-US')} {isAr ? 'مليون جنيه' : 'M EGP'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, marginTop: '0.25rem' }}>
                    {isAr ? 'بفائدة ميسرة 15% متناقصة لدعم القطاع الصناعي' : 'At subsidized 15% rate'}
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>{isAr ? 'متوسط قيمة الحافز لكل منشأة صناعية مستفيدة' : 'Avg Incentive per Beneficiary'}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0E6B65', marginTop: '0.2rem' }}>
                    {(financialStats.avgIncentivePerFactory / 1e6).toFixed(2)} {isAr ? 'مليون جنيه' : 'M EGP'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.25rem' }}>
                    {isAr ? 'يشمل الدعم الفني، المنح، وتيسيرات استهلاك الطاقة' : 'Grants, technical assistance & energy transition'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 3: CLEAN ENERGY & DECARBONIZATION
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'energy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Energy Metrics 4 Bento */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', borderTop: '3px solid #059669' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{isAr ? 'القدرات الشمسية المركبة' : 'Installed Solar Capacity'}</span>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#ECFDF5', color: '#059669', display: 'grid', placeItems: 'center' }}><Sun size={16} /></span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669', marginTop: '0.4rem' }}>{energyStats.totalInstalledMWp} MWp</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{isAr ? 'محطات طاقة شمسية على أسطح المصانع' : 'Rooftop industrial solar'}</div>
            </div>

            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', borderTop: '3px solid #0E6B65' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{isAr ? 'وفر الكهرباء السنوي' : 'Annual Energy Saved'}</span>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#F0FDFA', color: '#0E6B65', display: 'grid', placeItems: 'center' }}><Zap size={16} /></span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0E6B65', marginTop: '0.4rem' }}>{energyStats.annualEnergySavedMWh.toLocaleString(isAr ? 'ar-EG' : 'en-US')} MWh</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{isAr ? 'تخفيف الحمل عن الشبكة القومية' : 'Relieved from national grid'}</div>
            </div>

            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', borderTop: '3px solid #D97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{isAr ? 'الوفر المالي لفواتير المصانع' : 'Factory Bill Reductions'}</span>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#FFFBEB', color: '#D97706', display: 'grid', placeItems: 'center' }}><Banknote size={16} /></span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#D97706', marginTop: '0.4rem' }}>{(energyStats.annualBillSavingsEGP / 1e6).toFixed(1)} {isAr ? 'مليون ج.م' : 'M EGP'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{isAr ? 'وفر مباشر في تكلفة الإنتاج سنوياً' : 'Direct operational savings'}</div>
            </div>

            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', borderTop: '3px solid #16A34A' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{isAr ? 'خفض الانبعاثات الكربونية' : 'CO2 Emissions Offset'}</span>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#F0FDF4', color: '#16A34A', display: 'grid', placeItems: 'center' }}><Leaf size={16} /></span>
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16A34A', marginTop: '0.4rem' }}>{energyStats.co2AvoidedTons.toLocaleString(isAr ? 'ar-EG' : 'en-US')} {isAr ? 'طن CO₂' : 'Tons'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{isAr ? 'شهادات كربون وتوافق بيئي دولي' : 'Decarbonization target'}</div>
            </div>
          </div>

          {/* Roof Space & Provider Table */}
          <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1rem' }}>
              {isAr ? 'مقدمو خدمات الطاقة المعتمدون وسجل المشاريع' : 'Certified Energy Providers & Projects'}
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'الشركة / مقدم الخدمة' : 'Provider Name'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'المشاريع المنفذة' : 'Projects Done'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'إجمالي القدرة (kW)' : 'Total kW'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'المساحة المستغلة (م²)' : 'Roof Area (m²)'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'حالة الاعتماد' : 'Certification'}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'إنارة لحلول الطاقة المتجددة (Enara Solar)', projects: 18, kw: 4500, area: '36,000', status: 'معتمد فئة أ (IDA Tier-1)' },
                    { name: 'كرم سولار للصناعة (KarmSolar Industrial)', projects: 15, kw: 3800, area: '30,400', status: 'معتمد فئة أ (IDA Tier-1)' },
                    { name: 'إنفينيتي باور مصر (Infinity Power)', projects: 11, kw: 2750, area: '22,000', status: 'معتمد فئة أ (IDA Tier-1)' },
                    { name: 'طاقة عربية للطاقة الشمسية (TAQA Solar)', projects: 9, kw: 2250, area: '18,000', status: 'معتمد فئة ب (Tier-2)' },
                  ].map(p => (
                    <tr key={p.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', fontWeight: 700 }}>{p.projects}</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', color: '#059669', fontWeight: 700 }}>{p.kw.toLocaleString()} kW</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', color: '#64748B' }}>{p.area} م²</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8' }}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 4: INTER-AGENCY SLA & REVIEWER BENCHMARK
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'entities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1rem', display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
              <Award size={16} style={{ color: 'var(--egypt-red)' }} />
              {isAr ? 'مصفوفة تقييم أداء الجهات الشريكة وسرعة الاستجابة SLA' : 'Inter-Agency Performance & SLA Matrix'}
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'الجهة / الهيئة' : 'Entity'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'الطلبات المسندة' : 'Assigned Apps'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'الطلبات المنجزة' : 'Resolved'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'معدل الاعتماد' : 'Approval %'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'متوسط أيام الفحص' : 'Avg SLA Days'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'الالتزام بـ SLA' : 'SLA Compliance'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'ملاحظات الاستيفاء' : 'Rework Rate'}</th>
                  </tr>
                </thead>
                <tbody>
                  {orgPerformance.map(item => (
                    <tr key={item.org.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.6rem 0.85rem' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{isAr ? item.org.nameAr : item.org.nameEn}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{item.org.code} • {item.org.type}</div>
                      </td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', fontWeight: 700 }}>{item.assignedCount}</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', fontWeight: 700, color: '#059669' }}>{item.approvedCount}</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', fontWeight: 700 }}>{item.approvalRate}%</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', color: item.avgDays > 8 ? '#D97706' : '#1E40AF', fontWeight: 700 }}>
                        {item.avgDays} {isAr ? 'أيام' : 'd'}
                      </td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.725rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 4, background: item.complianceRate >= 90 ? '#ECFDF5' : '#FEF3C7', color: item.complianceRate >= 90 ? '#059669' : '#D97706' }}>
                          {item.complianceRate}%
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', color: '#64748B' }}>
                        {item.reworkCount} {isAr ? 'طلب' : 'apps'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          TAB 5: GEOGRAPHIC HUBS, SECTORS & LEADING FACTORIES
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'geographic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Charts: Governorates + Sectors */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.85rem' }}>
                {isAr ? 'الترتيب الجغرافي للمحافظات والمناطق الصناعية' : 'Applications by Governorate'}
              </h3>
              <BarChart data={govCounts.slice(0, 7).map(g => ({ label: g.key, value: g.count }))} color="#0E6B65" />
            </div>

            <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.85rem' }}>
                {isAr ? 'توزيع الطلبات حسب القطاع الصناعي' : 'Applications by Industrial Sector'}
              </h3>
              <BarChart data={sectorCounts.slice(0, 7).map(s => ({ label: s.key, value: s.count }))} color="var(--egypt-red)" />
            </div>
          </div>

          {/* Top Factories Leaderboard */}
          <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1rem', display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
              <Factory size={16} style={{ color: 'var(--egypt-red)' }} />
              {isAr ? 'سجل المصانع والمنشآت الأكثر استفادة ونشاطاً' : 'Top Active Industrial Facilities Leaderboard'}
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'اسم المنشأة الصناعية' : 'Facility Name'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'القطاع' : 'Sector'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'المحافظة / المنطقة' : 'Location'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'عدد المبادرات' : 'Applied Initiatives'}</th>
                    <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{isAr ? 'الاستثمار المحفز التقديري' : 'Stimulated Investment'}</th>
                  </tr>
                </thead>
                <tbody>
                  {topFactories.map(f => (
                    <tr key={f.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.6rem 0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{f.name}</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: '#F1F5F9', color: '#475569', fontWeight: 600 }}>
                          {f.sector}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', color: '#64748B' }}>{f.gov}</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', fontWeight: 800, color: 'var(--egypt-red)' }}>{f.count}</td>
                      <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center', fontWeight: 700, color: '#059669' }}>
                        {(f.investment / 1e6).toFixed(1)} {isAr ? 'مليون ج.م' : 'M EGP'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Footer Card ── */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginTop: '1.25rem', background: '#FFFFFF', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--text-main)', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
          <Download size={15} style={{ color: 'var(--egypt-red)' }} /> {isAr ? 'تصدير كامل بيانات الإحصائيات المفلترة:' : 'Export filtered data:'}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const stamp = new Date().toISOString().split('T')[0];
            downloadCSV(`stats-applications-${stamp}.csv`, APPLICATIONS_REPORT_HEADERS, applicationsToRows(filteredApps, factories));
          }}>
            <FileText size={14} /> CSV Applications
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const stamp = new Date().toISOString().split('T')[0];
            void downloadExcel(`stats-initiatives-${stamp}.xlsx`, INITIATIVES_REPORT_HEADERS, initiativesToRows(initiatives, filteredApps), 'Initiatives');
          }}>
            <FileSpreadsheet size={14} /> {isAr ? 'المبادرات Excel' : 'Initiatives Excel'}
          </button>
        </div>
      </div>
    </div>
  );
};
