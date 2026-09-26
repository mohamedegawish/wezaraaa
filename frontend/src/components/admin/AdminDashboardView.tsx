import React, { useMemo } from 'react';
import { usePlatformStore } from '../../store/state';
import { useToast } from '../common/ToastSystem';
import { api } from '../../api';
import {
  downloadCSV, downloadExcel, printReport,
  applicationsToRows, APPLICATIONS_REPORT_HEADERS,
  initiativesToRows, INITIATIVES_REPORT_HEADERS,
  computeReportKpis, buildStatusDistribution, buildTimelineMonthly, buildGroupCounts,
} from '../../utils/reports';
import { DonutChart, AreaChart, HBarList } from './StatCharts';
import { HeroSlidesManager } from './HeroSlidesManager';
import {
  Building2,
  Layers,
  TrendingUp,
  Clock,
  CheckCircle2,
  Factory,
  ShieldCheck,
  Landmark,
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  PieChart,
  Activity,
  Crown,
  AlertCircle,
} from 'lucide-react';

// Status → identity token colors (CSS vars, no hard-coded hex in tsx)
const STATUS_COLORS: Record<string, string> = {
  submitted: 'var(--text-muted)',
  under_review: 'var(--status-pending)',
  in_progress: 'var(--gov-teal)',
  pending_documents: 'var(--status-rework-text)',
  approved: 'var(--status-approved)',
  completed: 'var(--gov-primary-800)',
  rejected: 'var(--status-rejected)',
  draft: 'var(--status-draft)',
};

export const AdminDashboardView: React.FC = () => {
  const { applications, initiatives, factories, organizations, auditLogs, language, navigate, currentUser, isViewAllowed } = usePlatformStore();
  const { toast } = useToast();
  const isAr = language === 'ar';
  const isAdmin = currentUser.role === 'ministry_admin' || currentUser.role === 'initiative_manager';

  // ── Real KPIs from live store data ─────────────────────────────────────────
  const kpis = useMemo(
    () => computeReportKpis(applications, applications, initiatives, factories, organizations),
    [applications, initiatives, factories, organizations]
  );
  const statusDist = useMemo(() => buildStatusDistribution(applications), [applications]);
  const timeline = useMemo(() => buildTimelineMonthly(applications), [applications]);
  const sectorCounts = useMemo(() => buildGroupCounts(applications, a => a.factorySectorAr), [applications]);
  const govCounts = useMemo(() => buildGroupCounts(applications, a => a.factoryGovernorateAr), [applications]);
  const orgCounts = useMemo(() => buildGroupCounts(applications, a => a.currentAssignedOrgNameAr), [applications]);

  const slaViolations = useMemo(() => applications.filter(a => a.isSlaViolated), [applications]);
  const slaCompliance = applications.length
    ? ((applications.length - slaViolations.length) / applications.length) * 100
    : 100;
  const overdueTop = useMemo(
    () => [...slaViolations].sort((a, b) => b.daysSpentInStage - a.daysSpentInStage).slice(0, 5),
    [slaViolations]
  );

  const funnel = useMemo(() => {
    const count = (s: string[]) => applications.filter(a => s.includes(a.status)).length;
    return [
      { key: isAr ? 'مقدم' : 'Submitted', value: count(['submitted', 'draft']) },
      { key: isAr ? 'قيد المراجعة' : 'In review', value: count(['under_review', 'in_progress']) },
      { key: isAr ? 'استيفاء' : 'Rework', value: count(['pending_documents']) },
      { key: isAr ? 'معتمد' : 'Approved', value: count(['approved']) },
      { key: isAr ? 'مكتمل' : 'Completed', value: count(['completed']) },
      { key: isAr ? 'مرفوض' : 'Rejected', value: count(['rejected']) },
    ];
  }, [applications, isAr]);

  const initiativePerf = useMemo(() => {
    return initiatives.map(init => {
      const rel = applications.filter(a => a.initiativeId === init.id);
      const done = rel.filter(a => a.status === 'approved' || a.status === 'completed').length;
      const rate = rel.length ? (done / rel.length) * 100 : 0;
      const budgetUse = init.budgetTotalEGP ? (init.budgetAllocatedEGP / init.budgetTotalEGP) * 100 : 0;
      return {
        id: init.id,
        title: isAr ? init.titleAr : init.titleEn,
        apps: rel.length,
        done,
        rate,
        budgetUse,
        status: init.status,
      };
    }).sort((a, b) => b.apps - a.apps).slice(0, 5);
  }, [initiatives, applications, isAr]);

  const recentActivity = useMemo(() => auditLogs.slice(0, 6), [auditLogs]);
  const activeInitiatives = initiatives.filter(i => i.status === 'active').length;

  const exportStamp = () => new Date().toISOString().split('T')[0];

  // كانت تعرض «تم التوثيق» دون تسجيل فعلي — الآن تسجل في سجل التدقيق عبر الباك
  const logExport = (_kind: string, detailAr: string, _detailEn: string) => {
    api.logExport({ summaryAr: detailAr })
      .then(() => toast('success', isAr ? 'تم التصدير وتوثيقه في سجل التدقيق' : 'Exported and audit-logged'))
      .catch(() => toast('warning', isAr ? 'تم التصدير لكن تعذر توثيقه في سجل التدقيق' : 'Exported, but audit logging failed'));
  };

  const handleExportInitExcel = () => {
    void downloadExcel(`initiatives-report-${exportStamp()}.xlsx`, INITIATIVES_REPORT_HEADERS, initiativesToRows(initiatives, applications), 'Initiatives');
    logExport('dash-init-xlsx', `تصدير Excel للمبادرات (${initiatives.length}) من لوحة الإحصائيات`, `Exported initiatives Excel (${initiatives.length}) from statistics dashboard`);
  };
  const handleExportAppsExcel = () => {
    void downloadExcel(`applications-report-${exportStamp()}.xlsx`, APPLICATIONS_REPORT_HEADERS, applicationsToRows(applications, factories), 'Applications');
    logExport('dash-apps-xlsx', `تصدير Excel للطلبات (${applications.length}) من لوحة الإحصائيات`, `Exported applications Excel (${applications.length}) from statistics dashboard`);
  };
  const handleExportInitCsv = () => {
    downloadCSV(`initiatives-report-${exportStamp()}.csv`, INITIATIVES_REPORT_HEADERS, initiativesToRows(initiatives, applications));
    logExport('dash-init-csv', `تصدير CSV للمبادرات من لوحة الإحصائيات`, `Exported initiatives CSV from statistics dashboard`);
  };
  const handleExportAppsCsv = () => {
    downloadCSV(`applications-report-${exportStamp()}.csv`, APPLICATIONS_REPORT_HEADERS, applicationsToRows(applications, factories));
    logExport('dash-apps-csv', `تصدير CSV للطلبات من لوحة الإحصائيات`, `Exported applications CSV from statistics dashboard`);
  };
  const handlePrint = () => {
    const rows = initiativesToRows(initiatives, applications).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    printReport(
      `التقرير التنفيذي للمبادرات (${initiatives.length})`,
      `Executive Initiatives Report (${initiatives.length})`,
      `<div><span class="kpi">${isAr ? 'إجمالي الطلبات' : 'Total'}: ${kpis.totalApplications}</span><span class="kpi">${isAr ? 'معدل الاعتماد' : 'Approval rate'}: ${(kpis.approvalRate * 100).toFixed(1)}%</span><span class="kpi">SLA: ${kpis.avgSla} ${isAr ? 'أيام' : 'days'}</span><span class="kpi">${isAr ? 'مخالفات' : 'Violations'}: ${slaViolations.length}</span></div><br/><table><thead><tr>${INITIATIVES_REPORT_HEADERS.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`,
      isAr
    );
    logExport('dash-print', `طباعة التقرير التنفيذي من لوحة الإحصائيات`, `Printed executive report from statistics dashboard`);
  };

  const kpiCards = [
    {
      labelAr: 'إجمالي الطلبات المقدمة', labelEn: 'Total Applications',
      value: kpis.totalApplications.toLocaleString(isAr ? 'ar-EG' : 'en-US'),
      sub: `${(kpis.approvalRate * 100).toFixed(1)}% ${isAr ? 'معدل اعتماد' : 'approval rate'}`,
      icon: FileText, bg: 'var(--gov-teal)',
    },
    {
      labelAr: 'المصانع المسجلة', labelEn: 'Registered Factories',
      value: kpis.factoriesCount.toLocaleString(isAr ? 'ar-EG' : 'en-US'),
      sub: `${kpis.orgsCount} ${isAr ? 'جهة شريكة' : 'partner orgs'}`,
      icon: Building2, bg: 'var(--egypt-gold)',
    },
    {
      labelAr: 'المبادرات النشطة', labelEn: 'Active Initiatives',
      value: `${activeInitiatives} / ${initiatives.length}`,
      sub: isAr ? 'نشطة من إجمالي المبادرات' : 'active of all initiatives',
      icon: Landmark, bg: 'var(--egypt-red)',
    },
    {
      labelAr: 'الالتزام بالـ SLA', labelEn: 'SLA Compliance',
      value: `${slaCompliance.toFixed(1)}%`,
      sub: `${isAr ? 'متوسط' : 'avg'} ${kpis.avgSla} ${isAr ? 'أيام' : 'days'} • ${slaViolations.length} ${isAr ? 'مخالفة' : 'violations'}`,
      icon: ShieldCheck, bg: 'var(--status-approved)',
    },
    {
      labelAr: 'الاستثمار المحفز', labelEn: 'Investment Stimulated',
      value: `${(kpis.investmentStimulated / 1e9).toFixed(1)} B`,
      sub: `EGP • ${kpis.jobsCreated.toLocaleString(isAr ? 'ar-EG' : 'en-US')} ${isAr ? 'وظيفة' : 'jobs'}`,
      icon: TrendingUp, bg: 'var(--gov-primary-800)',
    },
    {
      labelAr: 'المصانع المستفيدة', labelEn: 'Benefited Factories',
      value: `${kpis.benefitedFactories} / ${kpis.targetFactories}`,
      sub: isAr ? 'مستفيد من المستهدف' : 'benefited of target',
      icon: Factory, bg: 'var(--status-pending)',
    },
  ];

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      {/* Title + exports */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.3, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
            {isAr ? 'لوحة القيادة' : 'Dashboard'}
          </h1>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {isAr
              ? 'مؤشرات حية من بيانات المنصة — المبادرات والـ SLA والجهات.'
              : 'Live indicators from platform data — initiatives, SLA and entities.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportInitExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileSpreadsheet size={16} />
            <span>{isAr ? 'تقرير المبادرات Excel' : 'Initiatives Excel'}</span>
          </button>
          <button className="btn btn-secondary" onClick={handleExportAppsExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileSpreadsheet size={16} />
            <span>{isAr ? 'تقرير الطلبات Excel' : 'Applications Excel'}</span>
          </button>
          <button className="btn btn-secondary" onClick={handleExportInitCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={16} />
            <span>{isAr ? 'المبادرات CSV' : 'Initiatives CSV'}</span>
          </button>
          <button className="btn btn-secondary" onClick={handleExportAppsCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={16} />
            <span>{isAr ? 'الطلبات CSV' : 'Applications CSV'}</span>
          </button>
          <button className="btn btn-gold" onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Printer size={16} />
            <span>{isAr ? 'تقرير تنفيذي PDF/طباعة' : 'Executive PDF/Print'}</span>
          </button>
          {isViewAllowed('admin-reports') && (
            <button className="btn btn-primary" onClick={() => navigate('admin-reports')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Crown size={16} />
              <span>{isAr ? 'التقارير' : 'Reports'}</span>
            </button>
          )}
        </div>
      </div>

      {isAdmin && <HeroSlidesManager />}

      {/* Summary strip — live */}
      <div className="summary-strip" style={{ marginBottom: '1.5rem' }}>
        <span>{isAr ? 'قيد المراجعة الآن' : 'In review now'}: <strong style={{ color: 'var(--status-pending-text)' }}>{kpis.inReview}</strong></span>
        <span className="sep">|</span>
        <span>{isAr ? 'معتمد / مكتمل' : 'Approved / completed'}: <strong style={{ color: 'var(--status-approved-text)' }}>{kpis.approved + kpis.completed}</strong></span>
        <span className="sep">|</span>
        <span>{isAr ? 'مطلوب استيفاء' : 'Rework'}: <strong style={{ color: 'var(--status-rework-text)' }}>{kpis.pendingDocs}</strong></span>
        <span className="sep">|</span>
        <span>{isAr ? 'مخالفات SLA' : 'SLA breaches'}: <strong style={{ color: slaViolations.length ? 'var(--status-rejected)' : 'var(--status-approved-text)' }}>{slaViolations.length}</strong></span>
      </div>

      {/* KPI cards — 6 live indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.labelEn} className="card card-elevated" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.45rem' }}>
              <div className="stat-icon" style={{ background: k.bg, color: 'var(--text-inverse)' }}>
                <Icon size={20} />
              </div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 600 }}>{isAr ? k.labelAr : k.labelEn}</div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--gov-primary-900)', lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Charts row 1: status donut + monthly timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <PieChart size={18} style={{ color: 'var(--egypt-red)' }} />
            <span>{isAr ? 'توزيع الطلبات حسب الحالة' : 'Applications by Status'}</span>
          </h3>
          {statusDist.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {isAr ? 'لا توجد طلبات بعد' : 'No applications yet'}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <DonutChart data={statusDist.map(d => ({ label: isAr ? d.labelAr : d.labelEn, value: d.count, color: STATUS_COLORS[d.key] ?? 'var(--text-muted)' }))} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 150 }}>
                {statusDist.map((d) => (
                  <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[d.key] ?? 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{isAr ? d.labelAr : d.labelEn}</span>
                    <span style={{ marginInlineStart: 'auto', fontWeight: 700, color: 'var(--text-main)' }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <Activity size={18} style={{ color: 'var(--gov-teal)' }} />
            <span>{isAr ? 'تطور التقديمات شهريًا' : 'Monthly Submissions Trend'}</span>
          </h3>
          <AreaChart data={timeline.map(t => ({ label: t.month.slice(5), value: t.count }))} />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.3rem' }}>
            {isAr ? 'آخر 8 شهور' : 'Last 8 months'} • {timeline.reduce((s, t) => s + t.count, 0)} {isAr ? 'تقديم' : 'submissions'}
          </div>
        </div>
      </div>

      {/* Charts row 2: funnel + workload */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <Layers size={18} style={{ color: 'var(--gov-primary-700)' }} />
            <span>{isAr ? 'قمع مراحل الطلبات' : 'Applications Funnel'}</span>
          </h3>
          <HBarList
            data={funnel.map((f, i) => ({
              label: f.key,
              count: f.value,
              sub: applications.length ? `${((f.value / applications.length) * 100).toFixed(0)}%` : '0%',
              color: ['var(--text-muted)', 'var(--status-pending)', 'var(--status-rework-text)', 'var(--status-approved)', 'var(--gov-primary-800)', 'var(--status-rejected)'][i],
            }))}
            max={Math.max(1, applications.length)}
          />
        </div>

        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <Building2 size={18} style={{ color: 'var(--gov-primary-700)' }} />
            <span>{isAr ? 'عبء الجهات' : 'Workload by Entity'}</span>
          </h3>
          <HBarList
            data={orgCounts.slice(0, 6).map((o, i) => ({
              label: o.key,
              count: o.count,
              sub: isAr ? 'طلب نشط' : 'apps',
              color: ['var(--gov-primary-800)', 'var(--gov-primary-700)', 'var(--gov-teal)', 'var(--egypt-gold)', 'var(--status-pending)', 'var(--text-muted)'][i % 6],
            }))}
            emptyLabel={isAr ? 'لا توجد طلبات موزعة بعد' : 'No distributed applications yet'}
          />
        </div>
      </div>

      {/* Charts row 3: sectors + governorates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <Factory size={18} style={{ color: 'var(--gov-gold-dark)' }} />
            <span>{isAr ? 'التوزيع القطاعي' : 'By Sector'}</span>
          </h3>
          <HBarList
            data={sectorCounts.slice(0, 6).map((s, i) => ({
              label: s.key,
              count: s.count,
              sub: applications.length ? `${((s.count / applications.length) * 100).toFixed(0)}%` : '0%',
              color: ['var(--egypt-red)', 'var(--gov-teal)', 'var(--egypt-gold)', 'var(--gov-primary-700)', 'var(--status-pending)', 'var(--text-muted)'][i % 6],
            }))}
            emptyLabel={isAr ? 'لا توجد بيانات قطاعية بعد' : 'No sector data yet'}
          />
        </div>

        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--status-approved)' }} />
            <span>{isAr ? 'التوزيع الجغرافي' : 'By Governorate'}</span>
          </h3>
          <HBarList
            data={govCounts.slice(0, 6).map((g, i) => ({
              label: g.key,
              count: g.count,
              sub: applications.length ? `${((g.count / applications.length) * 100).toFixed(0)}%` : '0%',
              color: ['var(--gov-primary-800)', 'var(--gov-teal)', 'var(--egypt-gold)', 'var(--egypt-red)', 'var(--status-pending)', 'var(--text-muted)'][i % 6],
            }))}
            emptyLabel={isAr ? 'لا توجد بيانات جغرافية بعد' : 'No geographic data yet'}
          />
        </div>
      </div>

      {/* Initiative performance ranking */}
      <div className="card flag-side-accent" style={{ padding: '1.15rem', marginBottom: '1rem' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
          <TrendingUp size={18} style={{ color: 'var(--egypt-red)' }} />
          <span>{isAr ? 'ترتيب أداء المبادرات' : 'Initiative Performance Ranking'}</span>
        </h3>
        {initiativePerf.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {isAr ? 'لا توجد مبادرات بعد' : 'No initiatives yet'}
          </div>
        ) : (
          <div className="table-responsive" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? 'المبادرة' : 'Initiative'}</th>
                  <th>{isAr ? 'الطلبات' : 'Apps'}</th>
                  <th>{isAr ? 'معتمد/مكتمل' : 'Done'}</th>
                  <th>{isAr ? 'معدل الإنجاز' : 'Success rate'}</th>
                  <th style={{ minWidth: 140 }}>{isAr ? 'استخدام الميزانية' : 'Budget use'}</th>
                </tr>
              </thead>
              <tbody>
                {initiativePerf.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: 'var(--gov-primary-900)' }}>{p.title}</td>
                    <td style={{ fontWeight: 700 }}>{p.apps}</td>
                    <td>{p.done}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="progress-track" style={{ flex: 1, minWidth: 80 }}>
                          <div style={{ width: `${p.rate.toFixed(0)}%`, height: '100%', background: 'var(--status-approved)', borderRadius: 'var(--radius-full)' }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700 }} className="num-ltr">{p.rate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="progress-track" style={{ flex: 1, minWidth: 80 }}>
                          <div style={{ width: `${Math.min(100, p.budgetUse).toFixed(0)}%`, height: '100%', background: 'var(--egypt-gold)', borderRadius: 'var(--radius-full)' }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700 }} className="num-ltr">{p.budgetUse.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SLA violations + recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1rem' }}>
        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <Clock size={18} style={{ color: slaViolations.length ? 'var(--status-rejected)' : 'var(--status-approved)' }} />
            <span>{isAr ? 'طلبات متجاوزة للـ SLA' : 'SLA-Violating Applications'}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-muted)', padding: '0.15rem 0.5rem', borderRadius: 9999, color: 'var(--text-muted)' }}>
              {slaViolations.length}
            </span>
          </h3>
          {overdueTop.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'var(--status-approved-bg)', border: '1px solid var(--status-approved-border)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--status-approved-text)', fontWeight: 600 }}>
              <CheckCircle2 size={16} />
              {isAr ? 'لا توجد مخالفات — الالتزام كامل' : 'Zero violations — full compliance'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {overdueTop.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', background: 'var(--status-rejected-bg)', border: '1px solid var(--status-rejected-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                  <AlertCircle size={15} style={{ color: 'var(--status-rejected)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{a.applicationNumber}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.factoryNameAr} • {a.currentStageNameAr}
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--status-rejected)', whiteSpace: 'nowrap' }} className="num-ltr">
                    {a.daysSpentInStage}/{a.slaDays} {isAr ? 'يوم' : 'd'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <Activity size={18} style={{ color: 'var(--gov-teal)' }} />
            <span>{isAr ? 'أحدث النشاطات' : 'Latest Activity'}</span>
          </h3>
          {recentActivity.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {isAr ? 'لا يوجد نشاط مسجل بعد' : 'No activity recorded yet'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {recentActivity.map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.55rem 0.7rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                  <span className="badge badge-gold" style={{ flexShrink: 0, fontSize: '0.68rem' }}>{log.actionType}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-body)', lineHeight: 1.5 }}>{isAr ? log.summaryAr : log.summaryEn}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                      {log.userName} • {new Date(log.timestamp).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
