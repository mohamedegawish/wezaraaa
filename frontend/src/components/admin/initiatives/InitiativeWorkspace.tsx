import React, { useEffect, useMemo, useState } from 'react';
import { usePlatformStore, store, mapServerAudit } from '../../../store/state';
import { api, resolveCoverUrl } from '../../../api';
import type { Application, AuditLogEntry, Initiative, InitiativeKpi } from '../../../types';
import { EditInitiativeModal, type EditorTab } from '../EditInitiativeModal';
import { ApplicationReviewModal } from '../ApplicationReviewModal';
import { AreaChart, HBarList } from '../StatCharts';
import { KPI_UNITS } from '../initiative-editor/KpiEditor';
import { Badge } from '../../ui/Badge';
import { useToast } from '../../common/ToastSystem';
import { formatEGP } from '../../../utils/format';
import { StatusSelect, statusMeta, OPEN_APP_STATUSES } from './initiativeStatus';
import { initiativeCompleteness } from './initiativeCompleteness';
import { analyzeInitiative, type InitiativeAnalytics } from './initiativeAnalytics';
import {
  ArrowRight, ArrowLeft, Eye, Copy, Trash2, EyeOff, BarChart3, PencilLine, FileText, History,
  CheckCircle2, XCircle, AlertTriangle, Clock, Search, Lock, Route, Inbox, RefreshCw,
} from 'lucide-react';

type WsTab = 'overview' | 'edit' | 'applications' | 'history';

const APP_STATUS_LABELS: Record<string, [string, string]> = {
  submitted: ['مقدم جديد', 'Submitted'],
  under_review: ['قيد المراجعة', 'Under review'],
  in_progress: ['قيد التنفيذ', 'In progress'],
  pending_documents: ['مطلوب استيفاء', 'Rework'],
  approved: ['معتمد', 'Approved'],
  completed: ['مكتمل', 'Completed'],
  rejected: ['مرفوض', 'Rejected'],
  cancelled: ['ملغي', 'Cancelled'],
};

// ---------- عناصر عرض صغيرة (نص بألوان النص، اللون للعلامة فقط) ----------

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, hint, children, action }) => (
  <section className="card" style={{ padding: '1.1rem 1.2rem', borderRadius: 'var(--radius-lg)' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.85rem' }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)' }}>{title}</h3>
        {hint && <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{hint}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Tile: React.FC<{ label: string; value: string; sub?: string; icon?: React.ReactNode }> = ({ label, value, sub, icon }) => (
  <div className="card" style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{icon}{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25, marginTop: '0.15rem' }}>{value}</div>
    {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{sub}</div>}
  </div>
);

/** مقياس نسبة مقابل حد: مسار بنفس الدرجة — يتحول للتحذير (بأيقونة ونص) فقط عند تجاوز الحد. */
const Meter: React.FC<{ label: string; valueText: string; maxText: string; ratio: number; over?: boolean; overText?: string }> = ({ label, valueText, maxText, ratio, over, overText }) => {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          <strong style={{ color: 'var(--text-main)' }}>{valueText}</strong> / {maxText}
        </span>
      </div>
      <div role="meter" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} style={{ height: '8px', background: 'var(--bg-muted)', borderRadius: '9999px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '9999px', background: over ? 'var(--status-rework-text)' : 'var(--gov-primary-700)' }} />
      </div>
      {over && overText && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
          <AlertTriangle size={12} style={{ color: 'var(--status-rework-text)' }} /> {overText}
        </div>
      )}
    </div>
  );
};

/**
 * توزيع الحالات: شريط مكدس أفقي بأربع فئات حالة (ألوان الحالة محجوزة) + فجوة 2px بين المقاطع
 * + وسيلة إيضاح بالاسم والعدد والنسبة والأيقونة (الترتيب مُتحقق منه بمدقق الألوان: CVD بين المتجاورات).
 */
const StatusStack: React.FC<{ a: InitiativeAnalytics; isAr: boolean; fmt: (n: number) => string }> = ({ a, isAr, fmt }) => {
  const parts = [
    { key: 'approved', ar: 'معتمدة / مكتملة', en: 'Approved / completed', n: a.approved, color: 'var(--status-approved-text)', Icon: CheckCircle2 },
    { key: 'rework', ar: 'مطلوب استيفاء', en: 'Needs documents', n: a.rework, color: 'var(--status-rework-text)', Icon: AlertTriangle },
    { key: 'review', ar: 'قيد المراجعة', en: 'In review', n: a.review, color: 'var(--gov-primary-700)', Icon: Clock },
    { key: 'rejected', ar: 'مرفوضة / ملغاة', en: 'Rejected / cancelled', n: a.rejected, color: 'var(--gov-crimson)', Icon: XCircle },
  ].filter(p => p.n > 0);
  const total = parts.reduce((s, p) => s + p.n, 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', gap: '2px', height: '14px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-surface)' }}>
        {parts.map(p => (
          <div key={p.key} title={`${isAr ? p.ar : p.en}: ${fmt(p.n)} (${fmt(Math.round((p.n / total) * 100))}٪)`} style={{ flex: p.n, background: p.color, minWidth: '4px' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
        {parts.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>
            <p.Icon size={14} style={{ color: p.color, flexShrink: 0 }} />
            <span>{isAr ? p.ar : p.en}</span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.n)}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({fmt(Math.round((p.n / total) * 100))}٪)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- مساحة المبادرة ----------

export const InitiativeWorkspace: React.FC = () => {
  const { initiatives, applications, selectedInitiativeId, language, navigate, currentUser } = usePlatformStore();
  const { toast } = useToast();
  const isAr = language === 'ar';
  const fmt = (n: number, digits = 0) => n.toLocaleString(isAr ? 'ar-EG' : 'en-US', { maximumFractionDigits: digits });
  const init = initiatives.find(i => i.id === selectedInitiativeId) ?? null;

  const [tab, setTab] = useState<WsTab>('overview');
  const [editTab, setEditTab] = useState<EditorTab>('basic');
  const [busy, setBusy] = useState(false);

  // مؤشرات الأداء (ADMIN ONLY) — تُعاد عند كل حفظ (updatedAt يتغير)
  const [kpis, setKpis] = useState<InitiativeKpi[] | null>(null);
  useEffect(() => {
    if (!init) return;
    let cancelled = false;
    setKpis(null);
    api.getInitiativeKpis(init.id).then(r => { if (!cancelled) setKpis((r.data ?? []) as InitiativeKpi[]); }).catch(() => { if (!cancelled) setKpis([]); });
    return () => { cancelled = true; };
  }, [init?.id, init?.updatedAt]);

  const a = useMemo(() => (init ? analyzeInitiative(init, applications, isAr) : null), [init, applications, isAr]);
  const completeness = useMemo(() => (init ? initiativeCompleteness(init) : null), [init]);

  if (!init || !a || !completeness) {
    return (
      <div className="container-custom" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '520px', margin: '0 auto', padding: '2rem' }}>
          <Inbox size={28} style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0.6rem 0' }}>{isAr ? 'المبادرة غير موجودة' : 'Initiative not found'}</h2>
          <button type="button" className="btn btn-primary" onClick={() => navigate('admin-initiatives')}>{isAr ? 'العودة لقائمة المبادرات' : 'Back to initiatives'}</button>
        </div>
      </div>
    );
  }

  const meta = statusMeta(init.status);
  const openEditor = (t: EditorTab) => { setEditTab(t); setTab('edit'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const duplicate = async () => {
    setBusy(true);
    try {
      const r = await api.duplicateInitiative(init.id);
      await store.reloadAll();
      toast('success', isAr ? 'تم نسخ المبادرة كمسودة — أنت الآن على النسخة' : 'Duplicated as draft — now viewing the copy');
      setTab('overview');
      navigate('admin-initiative', r.data.id);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : (isAr ? 'تعذر النسخ.' : 'Duplicate failed.'));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(isAr ? `حذف مبادرة «${init.titleAr}» نهائياً؟ لا يمكن التراجع.` : `Delete "${init.titleEn}" permanently?`)) return;
    setBusy(true);
    try {
      await api.deleteInitiative(init.id);
      await store.reloadAll();
      toast('success', isAr ? 'تم حذف المبادرة' : 'Initiative deleted');
      navigate('admin-initiatives');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : (isAr ? 'تعذر الحذف.' : 'Delete failed.'));
    } finally { setBusy(false); }
  };

  const tabs: Array<{ id: WsTab; ar: string; en: string; Icon: typeof BarChart3; count?: number }> = [
    { id: 'overview', ar: 'التحليلات والمتابعة', en: 'Analytics', Icon: BarChart3 },
    { id: 'edit', ar: 'تعديل البيانات', en: 'Edit data', Icon: PencilLine, count: completeness.missing.length || undefined },
    { id: 'applications', ar: 'الطلبات', en: 'Applications', Icon: FileText, count: a.total || undefined },
    { id: 'history', ar: 'سجل التعديلات', en: 'History', Icon: History },
  ];

  return (
    <div className="container-custom" style={{ padding: '1.5rem 1.5rem 3rem 1.5rem' }}>
      {/* ---- الترويسة ---- */}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('admin-initiatives')} style={{ marginBottom: '0.9rem' }}>
        {isAr ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}<span>{isAr ? 'كل المبادرات' : 'All initiatives'}</span>
      </button>
      <div className="card" style={{ padding: '1rem 1.1rem', borderRadius: 'var(--radius-lg)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <img src={resolveCoverUrl(init.coverImage)} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} style={{ width: '96px', height: '68px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0, background: 'var(--bg-muted)' }} />
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <Badge tone={meta.tone}>{isAr ? meta.ar : meta.en}</Badge>
            {!meta.isPublic && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}><EyeOff size={12} /> {isAr ? 'مخفية عن الجمهور' : 'Hidden from public'}</span>}
            {(isAr ? init.category : init.categoryEn) && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>· {isAr ? init.category : init.categoryEn}</span>}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--gov-primary-900)', lineHeight: 1.45 }}>{isAr ? init.titleAr : init.titleEn}</h1>
          {init.updatedAt && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{isAr ? 'آخر تعديل:' : 'Last updated:'} {new Date(init.updatedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusSelect initiative={init} openApps={a.open} isAr={isAr} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('initiative-detail', init.id)}><Eye size={14} /><span>{isAr ? 'معاينة الصفحة' : 'Preview'}</span></button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { void duplicate(); }} disabled={busy}><Copy size={14} /><span>{isAr ? 'نسخ كمسودة' : 'Duplicate'}</span></button>
          {currentUser.role === 'ministry_admin' && (
            <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--gov-crimson)' }} onClick={() => { void remove(); }} disabled={busy || a.total > 0}
              title={a.total > 0 ? (isAr ? 'لا يمكن حذف مبادرة عليها طلبات — أرشفها بدلاً من ذلك.' : 'Has applications — archive instead.') : undefined}>
              <Trash2 size={14} /><span>{isAr ? 'حذف' : 'Delete'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ---- التابات ---- */}
      <div role="tablist" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} style={{ borderRadius: '9999px' }}>
            <t.Icon size={14} /><span>{isAr ? t.ar : t.en}</span>
            {t.count !== undefined && <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '0 0.35rem', borderRadius: '9999px', background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--bg-muted)' }}>{fmt(t.count)}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview init={init} a={a} kpis={kpis} completeness={completeness} isAr={isAr} fmt={fmt} openEditor={openEditor} navigate={navigate} />}
      {tab === 'edit' && <EditInitiativeModal initiative={init} onClose={() => undefined} variant="page" initialTab={editTab} />}
      {tab === 'applications' && <ApplicationsTab init={init} apps={applications} isAr={isAr} fmt={fmt} />}
      {tab === 'history' && <HistoryTab init={init} apps={applications} isAr={isAr} />}
    </div>
  );
};

// ---------- التحليلات ----------

const Overview: React.FC<{
  init: Initiative; a: InitiativeAnalytics; kpis: InitiativeKpi[] | null;
  completeness: ReturnType<typeof initiativeCompleteness>;
  isAr: boolean; fmt: (n: number, d?: number) => string;
  openEditor: (t: EditorTab) => void; navigate: (v: string, id?: string) => void;
}> = ({ init, a, kpis, completeness, isAr, fmt, openEditor, navigate }) => {
  const pct = (x: number) => `${fmt(Math.round(x * 100))}٪`;
  const mw = (x: number) => (isAr ? `${fmt(x, 1)} ميجاوات` : `${fmt(x, 1)} MW`);
  const unitLabel = (u: string) => KPI_UNITS.find(k => k.value === u)?.[isAr ? 'ar' : 'en'] ?? u;
  const kpiValue = (n: number, u: string) => (u === 'EGP' ? formatEGP(n, isAr) : u === 'percent' ? `${fmt(n, 1)}٪` : u === 'count' ? fmt(n) : `${fmt(n, 1)} ${unitLabel(u)}`);
  const top = (xs: { key: string; count: number }[], n = 8) => {
    const head = xs.slice(0, n).map(x => ({ label: x.key, count: x.count }));
    const rest = xs.slice(n).reduce((s, x) => s + x.count, 0);
    return rest ? [...head, { label: isAr ? 'أخرى' : 'Other', count: rest, color: 'var(--text-light)' }] : head;
  };

  const meters = [
    a.targetFactories > 0 && { label: isAr ? 'المصانع المتقدمة مقابل المستهدف' : 'Applicant factories vs target', valueText: fmt(a.uniqueFactories), maxText: fmt(a.targetFactories), ratio: a.uniqueFactories / a.targetFactories },
    a.budgetTotal > 0 && a.requestedFinancing > 0 && {
      label: isAr ? 'التمويل المطلوب مقابل قيمة المبادرة' : 'Requested financing vs initiative value',
      valueText: formatEGP(a.requestedFinancing, isAr), maxText: formatEGP(a.budgetTotal, isAr), ratio: a.requestedFinancing / a.budgetTotal,
      over: a.requestedFinancing > a.budgetTotal, overText: isAr ? 'الطلبات تجاوزت قيمة المبادرة' : 'Requests exceed the initiative value',
    },
    a.targetCapacityMW > 0 && a.requestedCapacityMW > 0 && { label: isAr ? 'القدرة المطلوبة مقابل المستهدفة' : 'Requested capacity vs target', valueText: mw(a.requestedCapacityMW), maxText: mw(a.targetCapacityMW), ratio: a.requestedCapacityMW / a.targetCapacityMW },
    a.budgetTotal > 0 && a.budgetAllocated > 0 && { label: isAr ? 'المخصص مقابل الإجمالي' : 'Allocated vs total', valueText: formatEGP(a.budgetAllocated, isAr), maxText: formatEGP(a.budgetTotal, isAr), ratio: a.budgetAllocated / a.budgetTotal },
    a.timeline && {
      label: a.timeline.notStarted ? (isAr ? 'لم تبدأ بعد' : 'Not started yet') : (isAr ? 'المدة المنقضية من عمر المبادرة' : 'Initiative time elapsed'),
      valueText: isAr ? `${fmt(a.timeline.elapsedDays)} يوم` : `${a.timeline.elapsedDays} days`,
      maxText: isAr ? `متبقي ${fmt(a.timeline.remainingDays)} يوم (حتى ${a.timeline.end.toLocaleDateString('ar-EG')})` : `${a.timeline.remainingDays} days left (until ${a.timeline.end.toLocaleDateString('en-US')})`,
      ratio: a.timeline.percent / 100,
    },
  ].filter(Boolean) as Array<{ label: string; valueText: string; maxText: string; ratio: number; over?: boolean; overText?: string }>;

  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '1rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* أرقام رئيسية */}
      {a.total === 0 ? (
        <div className="card" style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          <Inbox size={18} /> {isAr ? 'لا توجد طلبات مقدمة على هذه المبادرة بعد — التحليلات التشغيلية ستظهر مع أول طلب.' : 'No applications yet — operational analytics appear with the first application.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          <Tile label={isAr ? 'إجمالي الطلبات' : 'Applications'} value={fmt(a.total)} sub={isAr ? `${fmt(a.uniqueFactories)} مصنع` : `${a.uniqueFactories} factories`} />
          <Tile label={isAr ? 'مفتوحة للمراجعة' : 'Open'} value={fmt(a.open)} sub={a.rework ? (isAr ? `منها ${fmt(a.rework)} مطلوب استيفاء` : `${a.rework} need documents`) : undefined} icon={<Clock size={12} />} />
          <Tile label={isAr ? 'معتمدة / مكتملة' : 'Approved'} value={fmt(a.approved)} icon={<CheckCircle2 size={12} style={{ color: 'var(--status-approved-text)' }} />} />
          <Tile label={isAr ? 'مرفوضة' : 'Rejected'} value={fmt(a.rejected)} icon={<XCircle size={12} style={{ color: 'var(--gov-crimson)' }} />} />
          {a.acceptanceRate !== null && <Tile label={isAr ? 'نسبة القبول' : 'Acceptance rate'} value={pct(a.acceptanceRate)} sub={isAr ? `من ${fmt(a.decided)} طلب تم البت فيه` : `of ${a.decided} decided`} />}
          {a.openCount > 0 && <Tile label={isAr ? 'متأخرة عن المدة' : 'Overdue'} value={fmt(a.overdueOpen)} sub={a.slaCompliance !== null ? (isAr ? `الالتزام بالمدة ${pct(a.slaCompliance)}` : `${pct(a.slaCompliance)} on time`) : undefined} icon={<AlertTriangle size={12} style={{ color: 'var(--status-rework-text)' }} />} />}
        </div>
      )}

      <div style={grid2}>
        {meters.length > 0 && (
          <Card title={isAr ? 'التقدم مقابل المستهدف' : 'Progress vs targets'} hint={isAr ? 'من طلبات المصانع الفعلية مقابل أرقام وثيقة المبادرة.' : 'Actual applications vs the initiative document targets.'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>{meters.map(m => <Meter key={m.label} {...m} />)}</div>
          </Card>
        )}
        {a.total > 0 && (
          <Card title={isAr ? 'أين تقف الطلبات الآن' : 'Where applications stand'}>
            <StatusStack a={a} isAr={isAr} fmt={n => fmt(n)} />
            {(a.avgDecisionDays !== null || a.escalated > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', marginTop: '1rem' }}>
                {a.avgDecisionDays !== null && <Tile label={isAr ? 'متوسط زمن البت' : 'Avg time to decision'} value={isAr ? `${fmt(a.avgDecisionDays, 1)} يوم` : `${fmt(a.avgDecisionDays, 1)} d`} sub={a.medianDecisionDays !== null ? (isAr ? `الوسيط ${fmt(a.medianDecisionDays, 1)} يوم · ${fmt(a.decisionSample)} طلب` : `median ${fmt(a.medianDecisionDays, 1)} d · n=${a.decisionSample}`) : undefined} />}
                {a.escalated > 0 && <Tile label={isAr ? 'مُصعَّدة للوزارة' : 'Escalated'} value={fmt(a.escalated)} icon={<AlertTriangle size={12} style={{ color: 'var(--status-rework-text)' }} />} />}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* المسار: الوصول لكل مرحلة + عنق الزجاجة */}
      {a.stageRows.length > 0 && (
        <Card
          title={isAr ? 'المسار: الوصول لكل مرحلة وعنق الزجاجة' : 'Pipeline: stage reach & bottleneck'}
          hint={isAr ? 'وصلت = طلبات بلغت المرحلة أو تجاوزتها. متوسط الأيام للطلبات المفتوحة فيها الآن مقابل المدة المحددة.' : 'Reached = applications at or beyond the stage. Avg days for open applications vs the stage SLA.'}
          action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('admin-workflow-builder', init.id)}><Route size={14} /><span>{isAr ? 'تعديل المراحل' : 'Edit stages'}</span></button>}
        >
          <div className="table-responsive timeline-scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? 'المرحلة' : 'Stage'}</th>
                  <th>{isAr ? 'وصلت' : 'Reached'}</th>
                  <th>{isAr ? 'مفتوحة الآن' : 'Open now'}</th>
                  <th>{isAr ? 'متوسط الأيام / المحددة' : 'Avg days / SLA'}</th>
                  <th>{isAr ? 'متأخرة' : 'Overdue'}</th>
                </tr>
              </thead>
              <tbody>
                {a.stageRows.map((r, idx) => (
                  <tr key={r.id}>
                    <td style={{ minWidth: '200px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{fmt(idx + 1)}. {r.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.org}</div>
                      {r.isBottleneck && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                          <AlertTriangle size={12} style={{ color: 'var(--status-rework-text)' }} /> {isAr ? 'عنق الزجاجة الحالي' : 'Current bottleneck'}
                        </div>
                      )}
                    </td>
                    <td style={{ minWidth: '140px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--bg-muted)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ width: `${a.total ? (r.reached / a.total) * 100 : 0}%`, height: '100%', background: 'var(--gov-primary-700)', borderRadius: '9999px' }} />
                        </div>
                        <strong style={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.reached)}</strong>
                      </div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmt(r.openNow)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {r.avgDays !== null ? <strong>{fmt(r.avgDays, 1)}</strong> : '—'} <span style={{ color: 'var(--text-muted)' }}>/ {fmt(r.slaDays)} {isAr ? 'يوم' : 'd'}</span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.overdue > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 800 }}><AlertTriangle size={12} style={{ color: 'var(--status-rework-text)' }} />{fmt(r.overdue)}</span> : fmt(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div style={grid2}>
        {a.monthly.length >= 2 && (
          <Card title={isAr ? 'الطلبات المقدمة شهرياً' : 'Applications per month'}>
            <AreaChart data={a.monthly.map(m => ({ label: isAr ? m.labelAr : m.month, value: m.count }))} />
          </Card>
        )}
        {a.byGov.length > 0 && (
          <Card title={isAr ? 'التوزيع الجغرافي (المحافظات)' : 'By governorate'}>
            <HBarList data={top(a.byGov)} />
          </Card>
        )}
        {a.bySector.length > 0 && (
          <Card title={isAr ? 'التوزيع القطاعي' : 'By sector'}>
            <HBarList data={top(a.bySector)} />
          </Card>
        )}
        {a.byBank.length > 0 && (
          <Card title={isAr ? 'البنوك المُسندة إليها الطلبات' : 'By assigned bank'}>
            <HBarList data={top(a.byBank)} />
          </Card>
        )}
        {a.financingCount > 0 && (
          <Card title={isAr ? 'طلبات التمويل والامتثال للحدود' : 'Financing requests & limits'}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
              <Tile label={isAr ? 'إجمالي المطلوب' : 'Total requested'} value={formatEGP(a.requestedFinancing, isAr)} sub={isAr ? `${fmt(a.financingCount)} طلب` : `${a.financingCount} requests`} />
              {a.approvedFinancing > 0 && <Tile label={isAr ? 'المعتمد منه' : 'Approved'} value={formatEGP(a.approvedFinancing, isAr)} />}
              {a.avgFinancing !== null && <Tile label={isAr ? 'متوسط الطلب' : 'Average request'} value={formatEGP(a.avgFinancing, isAr)} />}
              {a.maxFinancing !== null && <Tile label={isAr ? 'أكبر طلب' : 'Largest request'} value={formatEGP(a.maxFinancing, isAr)} />}
            </div>
            {a.perClientLimit > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                {a.overLimit > 0
                  ? <><AlertTriangle size={14} style={{ color: 'var(--status-rework-text)' }} /> {isAr ? `${fmt(a.overLimit)} طلب يتجاوز الحد الأقصى للعميل الواحد (${formatEGP(a.perClientLimit, true)})` : `${a.overLimit} request(s) exceed the per-client limit`}</>
                  : <><CheckCircle2 size={14} style={{ color: 'var(--status-approved-text)' }} /> {isAr ? `كل الطلبات داخل الحد الأقصى للعميل الواحد (${formatEGP(a.perClientLimit, true)})` : 'All requests are within the per-client limit'}</>}
              </div>
            )}
          </Card>
        )}
      </div>

      <div style={grid2}>
        {/* مؤشرات الأداء — ADMIN ONLY */}
        <Card
          title={isAr ? 'مؤشرات قياس الأداء' : 'KPIs'}
          hint={isAr ? 'للإدارة فقط — تُحدَّث قيمها المحققة من تاب المؤشرات.' : 'Admin only — update achieved values in the KPIs tab.'}
          action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditor('kpis')}><Lock size={13} /><span>{isAr ? 'تحديث المؤشرات' : 'Update KPIs'}</span></button>}
        >
          {kpis === null ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>
          ) : kpis.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{isAr ? 'لم تُحدد مؤشرات بعد.' : 'No KPIs defined yet.'}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {kpis.map(k => {
                const name = (isAr ? k.nameAr : k.nameEn || k.nameAr) || '';
                const hasCur = k.currentValue !== undefined && k.currentValue !== null;
                // مقياس فقط حين يوجد مستهدف ومحقق — «لم يُسجَّل» ليس صفراً
                if (k.targetValue && k.targetValue > 0 && hasCur) {
                  return <Meter key={k.id} label={name} valueText={kpiValue(k.currentValue!, k.unit)} maxText={kpiValue(k.targetValue, k.unit)} ratio={k.currentValue! / k.targetValue} />;
                }
                return (
                  <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{name}</span>
                    <span style={{ color: hasCur ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: hasCur ? 800 : 500, whiteSpace: 'nowrap' }}>
                      {hasCur ? kpiValue(k.currentValue!, k.unit) : (isAr ? 'لم يُسجَّل بعد' : 'not recorded')}
                      {k.targetValue ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {isAr ? 'المستهدف' : 'target'} {kpiValue(k.targetValue, k.unit)}</span> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* اكتمال بيانات المبادرة */}
        <Card title={isAr ? `اكتمال بيانات المبادرة — ${fmt(completeness.percent)}٪` : `Data completeness — ${completeness.percent}%`} hint={isAr ? 'مقابل أقسام وثيقة المبادرة. «أكمل» يفتح القسم مباشرة في المحرر.' : 'Against the initiative document sections.'}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {completeness.items.map(it => (
              <li key={it.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-main)' }}>
                {it.done ? <CheckCircle2 size={15} style={{ color: 'var(--status-approved-text)', flexShrink: 0 }} /> : <XCircle size={15} style={{ color: 'var(--text-light)', flexShrink: 0 }} />}
                <span style={{ flex: 1, color: it.done ? 'var(--text-main)' : 'var(--text-muted)' }}>{isAr ? it.ar : it.en}</span>
                {!it.done && <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem' }} onClick={() => openEditor(it.tab)}>{isAr ? 'أكمل' : 'Fill in'}</button>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};

// ---------- طلبات المبادرة ----------

const ApplicationsTab: React.FC<{ init: Initiative; apps: Application[]; isAr: boolean; fmt: (n: number, d?: number) => string }> = ({ init, apps, isAr, fmt }) => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [open, setOpen] = useState<Application | null>(null);
  const mine = apps.filter(x => x.initiativeId === init.id && x.status !== 'draft');
  const needle = q.trim().toLowerCase();
  const rows = mine
    .filter(x => (status === 'ALL' || (status === 'OPEN' ? OPEN_APP_STATUSES.includes(x.status) : x.status === status))
      && (!needle || [x.applicationNumber, x.factoryNameAr, x.factoryNameEn, x.factoryGovernorateAr].some(v => (v ?? '').toLowerCase().includes(needle))))
    .sort((p, n) => (n.submittedAt ?? '').localeCompare(p.submittedAt ?? ''));

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.75rem', color: 'var(--text-muted)' }} />
          <input className="form-control" value={q} onChange={e => setQ(e.target.value)} placeholder={isAr ? 'رقم الطلب أو اسم المصنع أو المحافظة…' : 'Number, factory or governorate…'} style={{ paddingInlineStart: '2.2rem' }} aria-label={isAr ? 'بحث' : 'Search'} />
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: '170px' }} value={status} onChange={e => setStatus(e.target.value)} aria-label={isAr ? 'الحالة' : 'Status'}>
          <option value="ALL">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          <option value="OPEN">{isAr ? 'المفتوحة فقط' : 'Open only'}</option>
          {Object.entries(APP_STATUS_LABELS).map(([k, [ar, en]]) => <option key={k} value={k}>{isAr ? ar : en}</option>)}
        </select>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          {mine.length === 0 ? (isAr ? 'لا توجد طلبات على هذه المبادرة بعد.' : 'No applications yet.') : (isAr ? 'لا توجد طلبات مطابقة.' : 'No matching applications.')}
        </div>
      ) : (
        <div className="table-responsive timeline-scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'رقم الطلب' : 'Number'}</th>
                <th>{isAr ? 'المصنع' : 'Factory'}</th>
                <th>{isAr ? 'المرحلة الحالية' : 'Current stage'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'في المرحلة' : 'In stage'}</th>
                <th>{isAr ? 'التمويل المطلوب' : 'Financing'}</th>
                <th>{isAr ? 'تاريخ التقديم' : 'Submitted'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(x => {
                const [ar, en] = APP_STATUS_LABELS[x.status] ?? [x.status, x.status];
                const isOpen = OPEN_APP_STATUSES.includes(x.status);
                return (
                  <tr key={x.id} onClick={() => setOpen(x)} style={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpen(x); }}>
                    <td style={{ fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{x.applicationNumber}</td>
                    <td style={{ minWidth: '180px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.83rem' }}>{isAr ? x.factoryNameAr : x.factoryNameEn || x.factoryNameAr}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{isAr ? x.factoryGovernorateAr : x.factoryGovernorateEn || x.factoryGovernorateAr}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', minWidth: '160px' }}>{((isAr ? x.currentStageNameAr : x.currentStageNameEn) || '—').replace(/^\d+\.\s*/, '')}</td>
                    <td><Badge status={x.status}>{isAr ? ar : en}</Badge></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                      {isOpen ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: x.isSlaViolated ? 800 : 500 }}>
                          {x.isSlaViolated && <AlertTriangle size={12} style={{ color: 'var(--status-rework-text)' }} />}
                          {fmt(Number(x.daysSpentInStage) || 0)} / {fmt(x.slaDays)} {isAr ? 'يوم' : 'd'}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{x.requestedFinancingAmountEGP ? formatEGP(x.requestedFinancingAmountEGP, isAr) : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{x.submittedAt ? new Date(x.submittedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && <ApplicationReviewModal application={open} onClose={() => setOpen(null)} />}
    </div>
  );
};

// ---------- سجل التعديلات ----------

const AUDIT_PAGES = 5; // حتى 500 حدث أخير في المنصة

const HistoryTab: React.FC<{ init: Initiative; apps: Application[]; isAr: boolean }> = ({ init, apps, isAr }) => {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [scanned, setScanned] = useState(0);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  const appIds = useMemo(() => new Set(apps.filter(x => x.initiativeId === init.id).map(x => x.id)), [apps, init.id]);

  useEffect(() => {
    let cancelled = false;
    setEntries(null); setError('');
    (async () => {
      const rows: Array<Record<string, unknown>> = [];
      for (let page = 1; page <= AUDIT_PAGES; page++) {
        const r = await api.listAuditLogs({ page, pageSize: 100 }) as { data?: Array<Record<string, unknown>>; totalPages?: number };
        rows.push(...(r.data ?? []));
        if (!r.data?.length || (r.totalPages ?? 1) <= page) break;
      }
      if (cancelled) return;
      setScanned(rows.length);
      setEntries(rows.map(mapServerAudit).filter(e => e.entityId === init.id || appIds.has(e.entityId)));
    })().catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : (isAr ? 'تعذر تحميل السجل.' : 'Could not load history.')); });
    return () => { cancelled = true; };
  }, [init.id, appIds, nonce, isAr]);

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          {isAr ? `تعديلات المبادرة وقرارات طلباتها — ضمن آخر ${scanned.toLocaleString('ar-EG')} حدث في سجل التدقيق.` : `Initiative edits and its applications' decisions — within the last ${scanned} audit events.`}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNonce(n => n + 1)}><RefreshCw size={13} /><span>{isAr ? 'تحديث' : 'Refresh'}</span></button>
      </div>
      {error ? <div style={{ color: 'var(--gov-crimson)', fontSize: '0.85rem' }}>{error}</div>
        : entries === null ? <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>
        : entries.length === 0 ? <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{isAr ? 'لا توجد أحداث مسجلة لهذه المبادرة ضمن الفترة المحملة.' : 'No events in the loaded range.'}</div>
        : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {entries.map((e, i) => (
              <li key={e.id || i} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: '118px', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(e.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.6 }}>{isAr ? e.summaryAr : e.summaryEn || e.summaryAr}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.userName}{e.entityId !== init.id ? (isAr ? ' · على طلب' : ' · on an application') : ''}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
};
