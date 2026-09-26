import React, { useMemo, useState, useRef } from 'react';
import { usePlatformStore } from '../../store/state';
import {
  FileSpreadsheet, Printer, Download, ShieldCheck, Filter, Calendar, Layers, Factory,
  Building2, TrendingUp, BarChart3, PieChart, Activity, FileText, Database, Search, X, Check,
  BookOpen, Sparkles, Sliders, CheckSquare, Edit3, Award, Sun, Banknote, Clock, AlertCircle
} from 'lucide-react';
import {
  downloadCSV, downloadExecutiveWorkbook,
  printExecutiveReport,
  filterApplications, computeReportKpis, buildTimelineMonthly, buildStatusDistribution, buildGroupCounts,
  applicationsToRows, APPLICATIONS_REPORT_HEADERS,
  initiativesToRows, INITIATIVES_REPORT_HEADERS,
  factoriesToRows, FACTORIES_REPORT_HEADERS,
  organizationsToRows, ORGANIZATIONS_REPORT_HEADERS,
  auditLogsToRows, AUDIT_LOGS_HEADERS,
  KPI_REPORT_HEADERS,
  type ReportFilters,
} from '../../utils/reports';

// Palette for chart rendering
const palette = ['#C8102E', '#0E6B65', '#1E40AF', '#D97706', '#059669', '#7C3AED', '#334155', '#94A3B8'];

const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[]; size?: number }> = ({ data, size = 170 }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const r = 64, cx = size / 2, cy = size / 2, stroke = 20;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
      {data.map((d) => {
        const frac = d.value / total;
        const dash = circ * frac;
        const gap = circ - dash;
        const rot = (acc / total) * 360 - 90;
        acc += d.value;
        return <circle key={d.label} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={stroke} strokeDasharray={`${dash} ${gap}`} transform={`rotate(${rot} ${cx} ${cy})`} strokeLinecap="round" style={{ transition: 'all 0.3s' }} />;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={20} fontWeight={800} fill="#0F172A">{total}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize={9.5} fill="#64748B" fontWeight={600}>إجمالي</text>
    </svg>
  );
};

const BarChart: React.FC<{ data: { label: string; value: number }[]; color?: string; maxBars?: number }> = ({ data, color = '#C8102E', maxBars = 6 }) => {
  const sliced = data.slice(0, maxBars);
  const max = Math.max(1, ...sliced.map(d => d.value));
  return (
    <svg viewBox="0 0 420 200" width="100%" height={200} role="img" style={{ display: 'block' }}>
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1={40} x2={400} y1={25 + i * 38} y2={25 + i * 38} stroke="#F1F5F9" strokeWidth={1} />
      ))}
      {sliced.map((d, i) => {
        const barW = Math.max(18, (340 / sliced.length) - 10);
        const x = 46 + i * (340 / sliced.length);
        const h = (d.value / max) * 135;
        const y = 160 - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={h} rx={6} fill={color} opacity={0.92} />
            <rect x={x} y={y} width={barW} height={Math.min(12, h)} rx={6} fill="white" opacity={0.2} />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#0F172A">{d.value}</text>
            <text x={x + barW / 2} y={180} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="#64748B">{d.label.length > 14 ? d.label.slice(0, 14) + '…' : d.label}</text>
          </g>
        );
      })}
      <line x1={40} x2={40} y1={14} y2={160} stroke="#E2E8F0" strokeWidth={1} />
      <line x1={40} x2={400} y1={160} y2={160} stroke="#E2E8F0" strokeWidth={1} />
    </svg>
  );
};

const AreaChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  if (data.length === 0) return <div style={{ height: 200, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد بيانات زمنية</div>;
  const max = Math.max(1, ...data.map(d => d.value));
  const W = 420, H = 180, padL = 36, padB = 30, padT = 16;
  const step = (W - padL - 12) / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => {
    const x = padL + i * step;
    const y = padT + (H - padT - padB) * (1 - d.value / max);
    return { x, y, d };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="area-rep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8102E" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#C8102E" stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map(i => <line key={i} x1={padL} x2={W - 12} y1={padT + i * ((H - padT - padB) / 3)} y2={padT + i * ((H - padT - padB) / 3)} stroke="#F1F5F9" strokeWidth={1} />)}
      <path d={areaD} fill="url(#area-rep)" stroke="none" />
      <path d={pathD} fill="none" stroke="#C8102E" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <g key={p.x}>
          <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#C8102E" strokeWidth={2} />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#0F172A">{p.d.value}</text>
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize={8} fontWeight={600} fill="#64748B">{p.d.label}</text>
        </g>
      ))}
      <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke="#E2E8F0" />
      <line x1={padL} x2={W - 12} y1={H - padB} y2={H - padB} stroke="#E2E8F0" />
    </svg>
  );
};

// ── Official Report Blueprint Presets ──────────────────────────────────────────
interface ReportTemplate {
  id: string;
  titleAr: string;
  titleEn: string;
  category: string;
  icon: any;
  summaryAr: string;
  summaryEn: string;
  recommendationsAr: string;
  recommendationsEn: string;
  defaultDatasets: { applications: boolean; initiatives: boolean; factories: boolean; organizations: boolean; auditLogs: boolean };
}

const OFFICIAL_TEMPLATES: ReportTemplate[] = [
  {
    id: 'ministerial_executive',
    titleAr: 'مذكرة العرض التنفيذي الشامل لمعالي وزير الصناعة',
    titleEn: 'Comprehensive Ministerial Executive Briefing',
    category: 'إحاطة وزارية',
    icon: BookOpen,
    summaryAr: 'تستعرض هذه المذكرة التنفيذية الموقف الكلي للمبادرات الصناعية القومية ومعدلات التدفق والإنجاز، مع حصر حجم الاستثمارات المحفزة وفرص العمل المستحدثة، ورصد معدلات التزام الجهات ومراجعي الهيئات بالمدد الزمنية المحددة.',
    summaryEn: 'Executive briefing on national industrial initiatives performance, investment multiplier, job creation, and inter-agency SLA resolution velocity.',
    recommendationsAr: '1. التوجيه بتسريع لجان المعاينة الميدانية بهيئة التنمية الصناعية.\n2. التنسيق مع القطاع المصرفي لزيادة سقف التمويلات الميسرة بفائدة 15%.\n3. تفعيل المرحلة الثانية من حوافز الطاقة الشمسية للمناطق الصناعية بالصعيد.',
    recommendationsEn: '1. Accelerate IDA field inspection committees.\n2. Coordinate with banking partners to increase soft loan caps.\n3. Expand solar incentive phase 2 to Upper Egypt zones.',
    defaultDatasets: { applications: true, initiatives: true, factories: true, organizations: true, auditLogs: false }
  },
  {
    id: 'solar_energy',
    titleAr: 'تقرير المبادرة القومية للتحول للطاقة الشمسية وكفاءة الطاقة',
    titleEn: 'National Solar Transition & Energy Efficiency Dossier',
    category: 'طاقة واستدامة',
    icon: Sun,
    summaryAr: 'حصر شامل للمصانع المستفيدة من تركيب الخلايا الشمسية على أسطح المنشآت الصناعية، وإجمالي القدرات المركبة (MWp) مع حساب الوفر في فواتير الكهرباء وخفض الانبعاثات الكربونية المحققة.',
    summaryEn: 'Comprehensive report on solar rooftop installations, installed MWp capacity, factory electricity bill savings and carbon offset.',
    recommendationsAr: '1. اعتماد 4 مقدمي خدمة جدد لرفع التنافسية وخفض تكلفة التركيبات.\n2. إتاحة حوافز إضافية للمصانع كثيفة استهلاك الطاقة لتحقيق وفر 30% سنوياً.',
    recommendationsEn: '1. Certify 4 new service providers to boost competition.\n2. Provide extra incentives for energy-intensive factories.',
    defaultDatasets: { applications: true, initiatives: true, factories: true, organizations: false, auditLogs: false }
  },
  {
    id: 'financial_impact',
    titleAr: 'تقرير الإنجازات المالية وتعميق التصنيع المحلي وبدائل الاستيراد',
    titleEn: 'Financial Stimulus & Import Substitution Dossier',
    category: 'تمويل واقتصاد',
    icon: Banknote,
    summaryAr: 'تحليل دقيق لكفاءة الإنفاق الحكومي والميزانيات المنصرفة ومضاعف رأس المال المحفز، وتقدير القيمة المضافة لتقليل الواردات وتوفير العملة الصعبة من خلال تعميق المكون الصناعي المحلي.',
    summaryEn: 'Analysis of public stimulus spend efficiency, capital multiplier, and hard currency saved through local component deepening.',
    recommendationsAr: '1. زيادة نسبة المكون المحلي المشترط في مبادرات الإحلال إلى 60% كحد أدنى.\n2. تسهيل خطابات الضمان البنكية للشركات الموردة للمكونات المحلية.',
    recommendationsEn: '1. Raise local content minimum threshold to 60%.\n2. Streamline bank guarantees for local component suppliers.',
    defaultDatasets: { applications: true, initiatives: true, factories: true, organizations: true, auditLogs: false }
  },
  {
    id: 'sla_audit',
    titleAr: 'تقرير تدقيق الأداء ومستوى الخدمة SLA بين الهيئات الشريكة',
    titleEn: 'Inter-Agency SLA Compliance & Reviewer Audit',
    category: 'حوكمة ورقابة',
    icon: Clock,
    summaryAr: 'مصفوفة تدقيق زمني شاملة ترصد أداء هيئة التنمية الصناعية (IDA)، مركز تحديث الصناعة (IMC)، والبنوك الشريكة، وتحدد مواطن التأخير ونسب المعاملات المتجاوزة للسقف الزمني.',
    summaryEn: 'Detailed SLA audit scorecard tracking response times, bottlenecks, and compliance rates across IDA, IMC, and partner banks.',
    recommendationsAr: '1. تقليص مرحلة الاستيفاء وتحديد مدة 5 أيام عمل كحد أقصى لإعادة الرفع.\n2. الربط الإلكتروني اللحظي بين لجان التقييم الفني وإدارات الائتمان البنكية.',
    recommendationsEn: '1. Cap rework resubmission period at 5 working days.\n2. Implement real-time integration between technical review and bank credit teams.',
    defaultDatasets: { applications: true, initiatives: false, factories: false, organizations: true, auditLogs: true }
  },
  {
    id: 'industrial_census',
    titleAr: 'السجل الصناعي والتعداد الجغرافي للمنشآت والمحافظات',
    titleEn: 'Industrial Census & Geographic Directory Dossier',
    category: 'تعداد وسجل',
    icon: Factory,
    summaryAr: 'تعداد وتحليل جغرافي للمنشآت الصناعية المسجلة ومواقعها في المناطق الصناعية والمحافظات، مع تصنيفها حسب القطاع وحجم العمالة والطاقة الإنتاجية.',
    summaryEn: 'Geographic and sectoral census of registered industrial facilities, industrial zones clustering, and workforce metrics.',
    recommendationsAr: '1. توجيه المبادرات الترويجية للمناطق الصناعية ذات الكثافة الأقل في الصعيد والدلتا.\n2. استكمال أرشفة السجلات الصناعية الإلكترونية لجميع المصانع.',
    recommendationsEn: '1. Target promotional campaigns toward underserved zones in Upper Egypt.\n2. Complete digital industrial registry archiving.',
    defaultDatasets: { applications: false, initiatives: true, factories: true, organizations: true, auditLogs: false }
  }
];

export const ReportsStudioView: React.FC = () => {
  const { applications, initiatives, factories, organizations, auditLogs, language, currentUser } = usePlatformStore();
  const isAr = language === 'ar';
  const isAdmin = currentUser.role === 'ministry_admin' || currentUser.role === 'initiative_manager';

  // Selected Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ministerial_executive');
  const activeTemplate = OFFICIAL_TEMPLATES.find(t => t.id === selectedTemplateId) || OFFICIAL_TEMPLATES[0];

  // Custom Report Content state
  const [customTitle, setCustomTitle] = useState(activeTemplate.titleAr);
  const [customSummary, setCustomSummary] = useState(activeTemplate.summaryAr);
  const [customDirectives, setCustomDirectives] = useState(activeTemplate.recommendationsAr);
  const [reportSerial] = useState(`EGY-REP-2026-${Math.floor(1000 + Math.random() * 9000)}`);

  // Sections Checklist
  const [sections, setSections] = useState({
    header: true,
    summary: true,
    kpis: true,
    charts: true,
    tables: true,
    directives: true,
    signoff: true
  });

  // Filters state
  const [filters, setFilters] = useState<ReportFilters>({ initiativeIds: [], statuses: [], orgIds: [], sectors: [], governorates: [], search: '', dateFrom: '', dateTo: '' });
  const [datasets, setDatasets] = useState(activeTemplate.defaultDatasets);
  const [activeTab, setActiveTab] = useState<'apps' | 'inits' | 'factories' | 'orgs' | 'logs'>('apps');
  const [preset, setPreset] = useState<string>('all');
  const [templateMode, setTemplateMode] = useState<'blueprints' | 'auto' | 'custom'>('blueprints');

  // Chart refs to grab SVG HTML for print
  const donutRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const sectorRef = useRef<HTMLDivElement>(null);
  const govRef = useRef<HTMLDivElement>(null);
  const orgRef = useRef<HTMLDivElement>(null);
  const initRef = useRef<HTMLDivElement>(null);
  // Ref to the live report preview canvas — used for direct print
  const reportPreviewRef = useRef<HTMLDivElement>(null);

  // Derived distinct values
  const allSectors = useMemo(() => [...new Set(applications.map(a => a.factorySectorAr).filter(Boolean))], [applications]);
  const allGovs = useMemo(() => [...new Set(applications.map(a => a.factoryGovernorateAr).filter(Boolean))], [applications]);

  // When switching templates, refresh title & notes
  const handleSelectTemplate = (tpl: ReportTemplate) => {
    setSelectedTemplateId(tpl.id);
    setCustomTitle(isAr ? tpl.titleAr : tpl.titleEn);
    setCustomSummary(isAr ? tpl.summaryAr : tpl.summaryEn);
    setCustomDirectives(isAr ? tpl.recommendationsAr : tpl.recommendationsEn);
    setDatasets(tpl.defaultDatasets);
  };

  const applyPreset = (p: string) => {
    setPreset(p);
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    if (p === 'all') setFilters(f => ({ ...f, dateFrom: '', dateTo: '' }));
    else if (p === '30d') {
      const from = new Date(now); from.setDate(now.getDate() - 30);
      setFilters(f => ({ ...f, dateFrom: fmt(from), dateTo: fmt(now) }));
    } else if (p === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1);
      setFilters(f => ({ ...f, dateFrom: fmt(from), dateTo: fmt(now) }));
    } else if (p === '2026') {
      setFilters(f => ({ ...f, dateFrom: '2026-01-01', dateTo: '2026-12-31' }));
    }
  };

  // Filtered applications
  const filteredApps = useMemo(() => filterApplications(applications, filters), [applications, filters]);
  const kpis = useMemo(() => computeReportKpis(applications, filteredApps, initiatives, factories, organizations), [applications, filteredApps, initiatives, factories, organizations]);

  // Chart datasets
  const statusDist = useMemo(() => buildStatusDistribution(filteredApps), [filteredApps]);
  const timeline = useMemo(() => buildTimelineMonthly(filteredApps), [filteredApps]);
  const sectorCounts = useMemo(() => buildGroupCounts(filteredApps, a => a.factorySectorAr), [filteredApps]);
  const govCounts = useMemo(() => buildGroupCounts(filteredApps, a => a.factoryGovernorateAr), [filteredApps]);
  const orgCounts = useMemo(() => buildGroupCounts(filteredApps, a => a.currentAssignedOrgNameAr), [filteredApps]);
  const initPerf = useMemo(() => {
    return initiatives.map(init => {
      const rel = filteredApps.filter(a => a.initiativeId === init.id);
      const done = rel.filter(a => a.status === 'approved' || a.status === 'completed').length;
      return { key: isAr ? init.titleAr : init.titleEn, count: rel.length, done };
    }).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [initiatives, filteredApps, isAr]);

  const filteredInits = useMemo(() => {
    if (!filters.initiativeIds?.length) return initiatives;
    return initiatives.filter(i => filters.initiativeIds!.includes(i.id));
  }, [initiatives, filters.initiativeIds]);

  const filteredFactories = useMemo(() => {
    if (!filters.sectors?.length && !filters.governorates?.length && !filters.search) return factories.slice(0, 80);
    const s = (filters.search || '').toLowerCase();
    return factories.filter(f => {
      if (s && !`${f.nameAr} ${f.nameEn} ${f.sector}`.toLowerCase().includes(s)) return false;
      if (filters.sectors?.length && !filters.sectors.includes(f.sector) && !filters.sectors.includes(f.sectorEn)) return false;
      if (filters.governorates?.length && !filters.governorates.includes(f.governorate) && !filters.governorates.includes(f.governorateEn)) return false;
      return true;
    }).slice(0, 80);
  }, [factories, filters]);

  const filteredLogs = useMemo(() => {
    const s = (filters.search || '').toLowerCase();
    const from = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00').getTime() : -Infinity;
    const to = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59').getTime() : Infinity;
    let rows = auditLogs;
    if (s) rows = rows.filter(l => `${l.summaryAr} ${l.summaryEn} ${l.userName}`.toLowerCase().includes(s));
    rows = rows.filter(l => { const t = new Date(l.timestamp).getTime(); return t >= from && t <= to; });
    return rows.slice(0, 120);
  }, [auditLogs, filters]);

  const filtersSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.dateFrom || filters.dateTo) parts.push(`${filters.dateFrom || '…'} → ${filters.dateTo || '…'} `);
    if (filters.initiativeIds?.length) parts.push(`${isAr ? 'مبادرات:' : 'Initiatives:'} ${filters.initiativeIds.length}`);
    if (filters.statuses?.length) parts.push(`${isAr ? 'حالات:' : 'Statuses:'} ${filters.statuses.join(', ')}`);
    if (filters.orgIds?.length) parts.push(`${isAr ? 'جهات:' : 'Orgs:'} ${filters.orgIds.length}`);
    if (filters.sectors?.length) parts.push(`${isAr ? 'قطاعات:' : 'Sectors:'} ${filters.sectors.join(', ')}`);
    if (filters.governorates?.length) parts.push(filters.governorates.join(', '));
    if (filters.search) parts.push(`“${filters.search}”`);
    return parts.join(' • ') || '';
  }, [filters, isAr]);

  const toggleArray = (key: keyof ReportFilters, value: string) => {
    setFilters(prev => {
      const arr = (prev[key] as string[] | undefined) || [];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  // Export handlers
  const handleExecutiveExcel = () => {
    const kpiRows = [
      [isAr ? 'عنوان التقرير الرسمي' : 'Report Title', customTitle, '', ''],
      [isAr ? 'رقم الوثيقة' : 'Serial', reportSerial, '', ''],
      [isAr ? 'الطلبات المفلترة' : 'Filtered applications', kpis.filteredApplications, '', `${isAr ? 'من إجمالي' : 'of total'} ${kpis.totalApplications}`],
      [isAr ? 'معدل الاعتماد' : 'Approval rate', `${(kpis.approvalRate * 100).toFixed(1)}%`, '', `${kpis.approved + kpis.completed} approved/completed`],
      [isAr ? 'قيد المراجعة' : 'In review', kpis.inReview, '', 'submitted/under_review/in_progress'],
      [isAr ? 'مطلوب استيفاء' : 'Rework', kpis.pendingDocs, '', 'pending_documents'],
      [isAr ? 'مرفوض' : 'Rejected', kpis.rejected, '', ''],
      ['SLA avg', kpis.avgSla, isAr ? 'أيام' : 'days', ''],
      [isAr ? 'المصانع المسجلة' : 'Factories', kpis.factoriesCount, '', ''],
      [isAr ? 'الجهات المشاركة' : 'Organizations', kpis.orgsCount, '', ''],
      [isAr ? 'الميزانية الإجمالية' : 'Budget total', (kpis.budgetTotal / 1e9).toFixed(2), 'B EGP'],
      [isAr ? 'الاستثمار المحفز' : 'Investment stimulated', (kpis.investmentStimulated / 1e9).toFixed(2), 'B EGP'],
      [isAr ? 'فرص العمل' : 'Jobs created', kpis.jobsCreated, '', ''],
      [isAr ? 'مستفيد / مستهدف' : 'Benefited / Target', `${kpis.benefitedFactories} / ${kpis.targetFactories}`, '', ''],
    ];
    const statusRows = statusDist.map(d => [isAr ? d.labelAr : d.labelEn, d.count, `${((d.count / Math.max(1, filteredApps.length)) * 100).toFixed(1)}%`]);
    const timelineRows = timeline.map(t => [t.month, t.count]);
    const sectorRows = sectorCounts.map(s => [s.key, s.count]);
    const govRows = govCounts.map(g => [g.key, g.count]);

    const sheets: any = {
      kpiRows,
      appHeaders: datasets.applications ? APPLICATIONS_REPORT_HEADERS : [],
      appRows: datasets.applications ? applicationsToRows(filteredApps, factories) : [],
      initHeaders: datasets.initiatives ? INITIATIVES_REPORT_HEADERS : [],
      initRows: datasets.initiatives ? initiativesToRows(filteredInits, filteredApps) : [],
      factoryHeaders: datasets.factories ? FACTORIES_REPORT_HEADERS : [],
      factoryRows: datasets.factories ? factoriesToRows(filteredFactories) : [],
      orgHeaders: datasets.organizations ? ORGANIZATIONS_REPORT_HEADERS : [],
      orgRows: datasets.organizations ? organizationsToRows(organizations) : [],
      auditHeaders: datasets.auditLogs ? AUDIT_LOGS_HEADERS : [],
      auditRows: datasets.auditLogs ? auditLogsToRows(filteredLogs) : [],
      chartStatusRows: statusRows,
      chartTimelineRows: timelineRows,
      chartSectorRows: sectorRows,
      chartGovRows: govRows,
    };

    void downloadExecutiveWorkbook(sheets, `${customTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`, {
      titleAr: customTitle,
      titleEn: customTitle,
      generatedBy: `${currentUser.name} — ${currentUser.roleTitleAr}`,
      filtersSummary,
      isAr,
    });
  };

  const handleCsvBundle = () => {
    const stamp = new Date().toISOString().split('T')[0];
    if (datasets.applications) downloadCSV(`Applications_${stamp}.csv`, APPLICATIONS_REPORT_HEADERS, applicationsToRows(filteredApps, factories));
    if (datasets.initiatives) setTimeout(() => downloadCSV(`Initiatives_${stamp}.csv`, INITIATIVES_REPORT_HEADERS, initiativesToRows(filteredInits, filteredApps)), 350);
    if (datasets.factories) setTimeout(() => downloadCSV(`Factories_${stamp}.csv`, FACTORIES_REPORT_HEADERS, factoriesToRows(filteredFactories)), 700);
    if (datasets.organizations) setTimeout(() => downloadCSV(`Organizations_${stamp}.csv`, ORGANIZATIONS_REPORT_HEADERS, organizationsToRows(organizations)), 1050);
    if (datasets.auditLogs) setTimeout(() => downloadCSV(`AuditLogs_${stamp}.csv`, AUDIT_LOGS_HEADERS, auditLogsToRows(filteredLogs)), 1400);
  };

  const handleExecutivePrint = () => {
    // Print the live preview panel directly (not the full executive-report window)
    const container = reportPreviewRef.current;
    if (!container) return;
    // Clone the DOM to avoid mutating the live view
    const clone = container.cloneNode(true) as HTMLElement;
    // Strip interactive elements that shouldn't appear in print (buttons, hover effects)
    clone.querySelectorAll('button').forEach(b => b.remove());
    clone.style.boxShadow = 'none';
    clone.style.border = '1px solid #CBD5E1';

    const html = `<!doctype html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head><meta charset="utf-8"><title>${customTitle}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #0F172A; padding: 0; margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
  img { max-width: 100%; }
  svg { max-width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #CBD5E1; padding: 6px 8px; text-align: ${isAr ? 'right' : 'left'}; vertical-align: top; }
  th { background: #0F172A; color: #fff; font-size: 10.5px; }
  tr:nth-child(even) td { background: #F8FAFC; }
  @media print { body { padding: 0; } .report-wrap { padding: 0; } }
</style></head>
<body>
<div class="report-wrap">${clone.innerHTML}</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=960,height=720');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = () => { setTimeout(() => w.print(), 300); };
  };

  if (!isAdmin) {
    return (
      <div className="container-custom" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 560, margin: '0 auto', padding: '2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--status-rejected-bg)', color: 'var(--status-rejected)', display: 'grid', placeItems: 'center', margin: '0 auto 1rem' }}><ShieldCheck size={28} /></div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{isAr ? 'الوصول للإدارة فقط' : 'Admin access only'}</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{isAr ? 'التقارير متاحة لإدارة الوزارة فقط.' : 'Reports are available to administration only.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom" style={{ padding: '1.25rem 1.5rem 5.5rem 1.5rem' }}>

      {/* ── Studio Header ── */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', background: '#FFFFFF', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--egypt-red)', color: '#FFFFFF', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(200, 16, 46, 0.25)' }}>
              <FileText size={22} />
            </span>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {isAr ? 'استوديو صياغة الوثائق والتقارير التنفيذية الرسمية' : 'Executive Official Report & Dossier Studio'}
                </h1>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                {isAr ? 'اختر قالب التقرير الرسمي، خصص بنود المذكرة والتوجيهات الوزارية، وصدر مباشرة إلى صيغة Excel معتمدة أو طباعة PDF رسمية.' : 'Select formal report blueprint, customize ministerial narrative & directives, and export executive workbook or PDF.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={handleExecutiveExcel} style={{ boxShadow: 'var(--shadow-glow-red)' }}>
              <FileSpreadsheet size={15} /> {isAr ? 'تصدير وثيقة Excel' : 'Export Excel'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExecutivePrint}>
              <Printer size={15} /> {isAr ? 'طباعة / PDF رسمي' : 'Print PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 1. Template Mode Selector ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '1rem', borderBottom: '2px solid #E2E8F0' }}>
          {[
            { id: 'blueprints' as const, labelAr: 'قوالب جاهزة', labelEn: 'Ready Blueprints', icon: BookOpen },
            { id: 'auto' as const, labelAr: 'تلقائي حسب المبادرة', labelEn: 'Auto per Initiative', icon: Sparkles },
            { id: 'custom' as const, labelAr: 'تخصيص كامل', labelEn: 'Full Custom', icon: Sliders },
          ].map(mode => {
            const MIcon = mode.icon;
            const isActive = templateMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setTemplateMode(mode.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.45rem',
                  padding: '0.7rem 1.2rem',
                  fontSize: '0.85rem', fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#fff' : '#64748B',
                  background: isActive ? 'linear-gradient(135deg, #c0392b, #e74c3c)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #c0392b' : '2px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '-2px',
                }}
              >
                <MIcon size={15} />
                {isAr ? mode.labelAr : mode.labelEn}
              </button>
            );
          })}
        </div>

        {/* Mode 1: Official Blueprints */}
        {templateMode === 'blueprints' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {isAr ? 'القوالب التنفيذية الرسمية:' : 'Official Report Blueprints:'}
              </span>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                {OFFICIAL_TEMPLATES.length} {isAr ? 'قوالب' : 'templates'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {OFFICIAL_TEMPLATES.map(tpl => {
                const Icon = tpl.icon;
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? '#FEF2F2' : '#FFFFFF',
                      border: `1.5px solid ${isSelected ? 'var(--egypt-red)' : '#E2E8F0'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(200, 16, 46, 0.1)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: isSelected ? 'var(--egypt-red)' : '#F1F5F9', color: isSelected ? '#FFFFFF' : '#475569' }}>
                        {tpl.category}
                      </span>
                      <Icon size={16} style={{ color: isSelected ? 'var(--egypt-red)' : '#64748B' }} />
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: isSelected ? 'var(--egypt-red)' : 'var(--text-main)', lineHeight: 1.3 }}>
                      {isAr ? tpl.titleAr : tpl.titleEn}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode 2: Auto per Initiative */}
        {templateMode === 'auto' && (
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              {isAr ? 'يتم إنشاء تقرير تلقائي لكل مبادرة بناءً على بياناتها الفعلية — اختر المبادرة:' : 'Auto-generate a report for each initiative from its live data — select one:'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {initiatives.map(init => {
                const relApps = applications.filter(a => a.initiativeId === init.id);
                const approved = relApps.filter(a => a.status === 'approved' || a.status === 'completed').length;
                const isSelected = selectedTemplateId === `auto_${init.id}`;
                return (
                  <div
                    key={init.id}
                    onClick={() => {
                      setSelectedTemplateId(`auto_${init.id}`);
                      setCustomTitle(isAr ? `تقرير أداء مبادرة: ${init.titleAr}` : `Initiative Report: ${init.titleEn}`);
                      setCustomSummary(isAr
                        ? `تقرير تلقائي شامل عن مبادرة "${init.titleAr}" يتضمن ${relApps.length} طلب، منها ${approved} معتمد. الميزانية: ${(init.budgetTotalEGP / 1e9).toFixed(2)} مليار جنيه. المستهدف: ${init.impactMetrics?.targetFactories ?? 0} منشأة.`
                         : `Automatic report for "${init.titleEn}" — ${relApps.length} applications, ${approved} approved. Budget: ${(init.budgetTotalEGP / 1e9).toFixed(2)}B EGP. Target: ${init.impactMetrics?.targetFactories ?? 0} factories.`);
                      setCustomDirectives(isAr
                        ? `1. متابعة الطلبات المعلقة (${relApps.filter(a => a.status === 'pending_documents').length} طلب بحاجة لاستيفاء).\n2. تسريع المعاينة الميدانية للطلبات قيد المراجعة (${relApps.filter(a => a.status === 'under_review' || a.status === 'in_progress').length} طلب).\n3. مراجعة أسباب الرفض (${relApps.filter(a => a.status === 'rejected').length} طلب مرفوض).`
                        : `1. Follow up on pending applications (${relApps.filter(a => a.status === 'pending_documents').length}).\n2. Expedite field inspection for in-review apps (${relApps.filter(a => a.status === 'under_review' || a.status === 'in_progress').length}).\n3. Review rejection reasons (${relApps.filter(a => a.status === 'rejected').length}).`);
                      setDatasets({ applications: true, initiatives: true, factories: true, organizations: true, auditLogs: false });
                    }}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? '#FEF2F2' : '#FFFFFF',
                      border: `1.5px solid ${isSelected ? 'var(--egypt-red)' : '#E2E8F0'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(200, 16, 46, 0.1)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.4rem', borderRadius: 4, background: isSelected ? 'var(--egypt-red)' : '#F1F5F9', color: isSelected ? '#fff' : '#475569' }}>
                        {isAr ? 'تلقائي' : 'Auto'}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isSelected ? 'var(--egypt-red)' : '#64748B' }}>
                        {relApps.length} {isAr ? 'طلب' : 'apps'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: isSelected ? 'var(--egypt-red)' : 'var(--text-main)', lineHeight: 1.3, marginBottom: '0.3rem' }}>
                      {isAr ? init.titleAr : init.titleEn}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: '#64748B' }}>
                      <span>✓ {approved}</span>
                      <span>⏳ {relApps.filter(a => a.status === 'under_review' || a.status === 'in_progress').length}</span>
                      <span>✗ {relApps.filter(a => a.status === 'rejected').length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode 3: Full Custom */}
        {templateMode === 'custom' && (
          <div className="card" style={{ padding: '1.2rem', background: '#FAFAFA', border: '1px dashed #CBD5E1' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <Sliders size={16} style={{ color: 'var(--egypt-red)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {isAr ? 'تخصيص كامل — أنشئ تقريرك من الصفر' : 'Full Custom — Build your report from scratch'}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
              {isAr ? 'اكتب العنوان والملخص والتوصيات يدوياً، واختر الأقسام والبيانات المراد تضمينها بحرية كاملة.' : 'Write your own title, summary, and directives manually. Choose which sections and datasets to include with full control.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  {isAr ? 'عنوان التقرير:' : 'Report Title:'}
                </label>
                <input
                  className="form-control"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  placeholder={isAr ? 'أدخل عنوان التقرير المخصص...' : 'Enter custom report title...'}
                  style={{ fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  {isAr ? 'الملخص التنفيذي:' : 'Executive Summary:'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={customSummary}
                  onChange={e => setCustomSummary(e.target.value)}
                  placeholder={isAr ? 'اكتب الملخص التنفيذي...' : 'Write executive summary...'}
                  style={{ fontSize: '0.8rem', lineHeight: 1.5 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  {isAr ? 'التوصيات والتوجيهات:' : 'Directives:'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={customDirectives}
                  onChange={e => setCustomDirectives(e.target.value)}
                  placeholder={isAr ? 'أدخل التوصيات والتوجيهات...' : 'Enter recommendations...'}
                  style={{ fontSize: '0.8rem', lineHeight: 1.5 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Report Customization & Narrative Studio Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.4fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        {/* Left Column: Customization Controls & Checklists */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Custom Details & Directives Form */}
          <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <Edit3 size={15} style={{ color: 'var(--egypt-red)' }} />
              {isAr ? 'تخصيص بيانات ونصوص المذكرة' : 'Customize Title & Directives'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  {isAr ? 'عنوان التقرير / المذكرة الرسمية:' : 'Report Title:'}
                </label>
                <input
                  className="form-control"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  style={{ fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  {isAr ? 'الملخص التنفيذي والسياق الاستراتيجي:' : 'Executive Narrative:'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={customSummary}
                  onChange={e => setCustomSummary(e.target.value)}
                  style={{ fontSize: '0.8rem', lineHeight: 1.5 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  {isAr ? 'التوجيهات والقرارات الوزارية المقترحة:' : 'Ministerial Directives:'}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={customDirectives}
                  onChange={e => setCustomDirectives(e.target.value)}
                  style={{ fontSize: '0.8rem', lineHeight: 1.5 }}
                />
              </div>
            </div>
          </div>

          {/* Section Inclusion Checklist */}
          <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <CheckSquare size={15} style={{ color: 'var(--egypt-red)' }} />
              {isAr ? 'أقسام ومكونات الوثيقة المضمنة:' : 'Document Sections Checklist:'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {[
                { k: 'header', labelAr: 'الترويسة والشعار السيادي' },
                { k: 'summary', labelAr: 'الملخص التنفيذي' },
                { k: 'kpis', labelAr: 'مصفوفة المؤشرات الكلية' },
                { k: 'charts', labelAr: 'الرسوم البيانية المعتمدة' },
                { k: 'tables', labelAr: 'جداول البيانات التفصيلية' },
                { k: 'directives', labelAr: 'التوجيهات والتوصيات' },
                { k: 'signoff', labelAr: 'خانة التوقيع والاعتماد' },
              ].map(sec => {
                const on = (sections as any)[sec.k];
                return (
                  <label
                    key={sec.k}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.78rem',
                      color: on ? '#0F172A' : '#94A3B8',
                      cursor: 'pointer',
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={e => setSections(prev => ({ ...prev, [sec.k]: e.target.checked }))}
                    />
                    <span>{sec.labelAr}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Dataset Inclusions */}
          <div className="card" style={{ padding: '1.2rem', background: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <Database size={15} style={{ color: 'var(--egypt-red)' }} />
              {isAr ? 'الجداول وقواعد البيانات المشمولة:' : 'Datasets in Workbook:'}
            </h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {[
                { k: 'applications', labelAr: 'الطلبات' },
                { k: 'initiatives', labelAr: 'المبادرات' },
                { k: 'factories', labelAr: 'المصانع' },
                { k: 'organizations', labelAr: 'الجهات' },
                { k: 'auditLogs', labelAr: 'سجل التدقيق' },
              ].map(ds => {
                const on = (datasets as any)[ds.k];
                return (
                  <button
                    key={ds.k}
                    onClick={() => setDatasets(prev => ({ ...prev, [ds.k]: !on }))}
                    className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ borderRadius: 9999, fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                  >
                    {ds.labelAr} {on ? '✓' : '○'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Sovereign Live Document Paper Canvas Preview */}
        <div style={{ position: 'relative' }}>
          <div ref={reportPreviewRef} style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
              padding: '2rem',
              position: 'sticky',
              top: '1rem',
              minHeight: '600px',
              overflow: 'visible',
              paddingTop: '3.2rem',
           }}>
            {/* Sovereign Top Bar & Watermark */}
            <div style={{ height: '4px', background: 'var(--egypt-flag-ribbon)', margin: '-2rem -2rem 1.5rem -2rem', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />

            {/* Print Button */}
            <button
              onClick={handleExecutivePrint}
              title={isAr ? 'طباعة التقرير' : 'Print Report'}
              style={{
                position: 'absolute', top: 10, insetInlineEnd: 12, zIndex: 10,
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '0.35rem 0.7rem',
                fontSize: 11, fontWeight: 700,
                color: '#0F172A',
                background: '#fff',
                border: '1px solid #CBD5E1',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0F172A'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#0F172A'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            >
              <Printer size={13} /> {isAr ? 'طباعة' : 'Print'}
            </button>
            
            {/* Header Lockup */}
            {sections.header && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0F172A', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A' }}>جمهورية مصر العربية</div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>وزارة الصناعة — الأمانة العامة للمبادرات الوطنية</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.2rem' }}>التاريخ: {new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 36, height: 36, margin: '0 auto', background: '#0F172A', borderRadius: 8, display: 'grid', placeItems: 'center' }}>
                    <img src="/ministry-industry-logo.png" alt="وزارة الصناعة" width={24} height={24} style={{ borderRadius: 4 }} onError={e => ((e.currentTarget.style.display = 'none'))} />
                  </div>
                </div>

                <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>رقم القيد: {reportSerial}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>المُعد: {currentUser.name}</div>
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>{currentUser.roleTitleAr}</div>
                </div>
              </div>
            )}

            {/* Document Title */}
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: '0 0 0.4rem' }}>
                {customTitle}
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                نطاق البيانات: {filtersSummary || 'شامل لكافة المبادرات والمنشآت المسجلة'}
              </div>
            </div>

            {/* Executive Summary */}
            {sections.summary && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.3rem' }}>
                  أولاً: الملخص التنفيذي
                </div>
                <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {customSummary}
                </div>
              </div>
            )}

            {/* Macro KPIs */}
            {sections.kpis && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
                  ثانياً: مصفوفة المؤشرات الإحصائية المعتمدة
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  <div style={{ padding: '0.6rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B' }}>الطلبات المطابقة</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{kpis.filteredApplications}</div>
                  </div>
                  <div style={{ padding: '0.6rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B' }}>معدل الاعتماد</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{(kpis.approvalRate * 100).toFixed(1)}%</div>
                  </div>
                  <div style={{ padding: '0.6rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B' }}>الاستثمار المحفز</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1E40AF' }}>{(kpis.investmentStimulated / 1e9).toFixed(1)}B</div>
                  </div>
                  <div style={{ padding: '0.6rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748B' }}>فرص العمل</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#D97706' }}>{kpis.jobsCreated}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Directives & Decisions */}
            {sections.directives && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#92400E', marginBottom: '0.3rem' }}>
                  ثالثاً: التوجيهات والقرارات الوزارية المقترحة
                </div>
                <div style={{ fontSize: '0.78rem', color: '#78350F', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {customDirectives}
                </div>
              </div>
            )}

            {/* Sign-off Block */}
            {sections.signoff && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '1.5rem', borderTop: '1px dashed #CBD5E1', marginTop: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>المشرف العام على المنصة</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '1.5rem' }}>............................................</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>{isAr ? 'التوقيع والاعتماد' : 'Signature'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '1.5rem' }}>............................................</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>يعتمد،، معالي وزير الصناعة</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '1.5rem' }}>............................................</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Visual Charts Snapshots Studio ── */}
      {sections.charts && (
        <div className="card" style={{ padding: '1.2rem', marginBottom: '1.25rem', background: '#FFFFFF', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <BarChart3 size={16} style={{ color: 'var(--egypt-red)' }} />
            {isAr ? 'الرسومات والتحليلات البيانية المعتمدة في التقرير' : 'Approved Analytical Chart Snapshots'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>توزيع الحالات</div>
              <div ref={donutRef} style={{ display: 'flex', justifyContent: 'center' }}>
                <DonutChart data={statusDist.map((d, i) => ({ label: isAr ? d.labelAr : d.labelEn, value: d.count, color: d.color || palette[i % palette.length] }))} />
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>تطور التقديمات عبر الزمن</div>
              <div ref={timelineRef}>
                <AreaChart data={timeline.map(t => ({ label: t.month.slice(5), value: t.count }))} />
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>التوزيع القطاعي</div>
              <div ref={sectorRef}>
                <BarChart data={sectorCounts.map(s => ({ label: s.key, value: s.count }))} color="#D97706" />
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>التوزيع الجغرافي للمحافظات</div>
              <div ref={govRef}>
                <BarChart data={govCounts.map(g => ({ label: g.key, value: g.count }))} color="#0E6B65" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Detailed Data Tables Preview ── */}
      {sections.tables && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#FFFFFF', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', alignItems: 'center', background: '#F8FAFC' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <Database size={15} style={{ color: 'var(--egypt-red)' }} />
              {isAr ? 'معاينة جداول البيانات المضمنة في التصدير' : 'Preview included tables'}
            </span>
            <div style={{ display: 'flex', gap: '0.3rem', marginInlineStart: 'auto', flexWrap: 'wrap' }}>
              {[
                { id: 'apps' as const, ar: 'الطلبات', en: `Apps (${filteredApps.length})` },
                { id: 'inits' as const, ar: 'المبادرات', en: `Initiatives (${filteredInits.length})` },
                { id: 'factories' as const, ar: 'المصانع', en: `Factories (${filteredFactories.length})` },
                { id: 'orgs' as const, ar: 'الجهات', en: `Orgs (${organizations.length})` },
                { id: 'logs' as const, ar: 'التدقيق', en: `Logs (${filteredLogs.length})` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: 9999, padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                >
                  {isAr ? t.ar : t.en}
                </button>
              ))}
            </div>
          </div>

          <div className="table-responsive" style={{ maxHeight: 320, overflow: 'auto' }}>
            {activeTab === 'apps' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead><tr style={{ background: '#F8FAFC' }}>{APPLICATIONS_REPORT_HEADERS.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {applicationsToRows(filteredApps.slice(0, 8), factories).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>{row.map((c, j) => <td key={j} style={{ whiteSpace: 'nowrap' }}>{String(c)}</td>)}</tr>
                  ))}
                  {filteredApps.length === 0 && <tr><td colSpan={APPLICATIONS_REPORT_HEADERS.length} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.2rem' }}>{isAr ? 'لا توجد طلبات مطابقة' : 'No matching applications'}</td></tr>}
                </tbody>
              </table>
            )}
            {activeTab === 'inits' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead><tr style={{ background: '#F8FAFC' }}>{INITIATIVES_REPORT_HEADERS.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {initiativesToRows(filteredInits, filteredApps).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>{row.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
            {activeTab === 'factories' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead><tr style={{ background: '#F8FAFC' }}>{FACTORIES_REPORT_HEADERS.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {factoriesToRows(filteredFactories.slice(0, 10)).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>{row.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
            {activeTab === 'orgs' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead><tr style={{ background: '#F8FAFC' }}>{ORGANIZATIONS_REPORT_HEADERS.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {organizationsToRows(organizations).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>{row.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
            {activeTab === 'logs' && (
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead><tr style={{ background: '#F8FAFC' }}>{AUDIT_LOGS_HEADERS.map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {auditLogsToRows(filteredLogs.slice(0, 10)).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>{row.map((c, j) => <td key={j} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(c)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      <div style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 40, display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', border: '1px solid var(--border-subtle)', borderRadius: 9999, padding: '0.5rem 0.75rem', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxWidth: 'min(96vw, 650px)' }}>
        <button className="btn btn-primary btn-sm" onClick={handleExecutiveExcel} style={{ borderRadius: 9999, padding: '0.35rem 0.9rem' }}>
          <FileSpreadsheet size={15} /> {isAr ? 'تصدير وثيقة Excel' : 'Export Excel'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleCsvBundle} style={{ borderRadius: 9999 }}>
          <Download size={15} /> {isAr ? 'حزمة CSV' : 'CSV Bundle'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleExecutivePrint} style={{ borderRadius: 9999 }}>
          <Printer size={15} /> {isAr ? 'طباعة / PDF' : 'Print PDF'}
        </button>
      </div>
    </div>
  );
};
