import React, { useMemo } from 'react';
import { usePlatformStore } from '../../store/state';
import type { Application } from '../../types';
import {
  Landmark,
  FileText,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Zap,
  Gauge,
  AlertTriangle,
  Eye,
  Layers,
} from 'lucide-react';

// ------------------------------------------------------------------
// MinistryOverviewView — داشبورد مشاهدة مبسطة خاصة بالوزارة.
// قراءة فقط (read-only): صفر mutations، صفر أزرار تعديل/حذف/قرارات.
// كل الاشتقاقات آمنة ضد المصفوفات الفارغة والقيم الناقصة.
// ------------------------------------------------------------------

/** قدرة النظام kWp: الحقل الصريح أولاً ثم مسح آمن لمفاتيح formData. */
function capacityOf(app: Application): number {
  const direct = Number(app.systemCapacityKW ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const fd = app.formData ?? {};
  for (const key of Object.keys(fd)) {
    if (/capac|قدرة|kwp?/i.test(key)) {
      const v = Number(fd[key]);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return 0;
}

/** حجم التمويل EGP: الحقل الصريح أولاً ثم مسح آمن لمفاتيح formData. */
function financingOf(app: Application): number {
  const direct = Number(app.requestedFinancingAmountEGP ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const fd = app.formData ?? {};
  for (const key of Object.keys(fd)) {
    if (/financ|amount|loan|fund|تمويل|مبلغ|قرض/i.test(key)) {
      const v = Number(fd[key]);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return 0;
}

/** تجاوز SLA بالأيام (0 إن لم يوجد تجاوز). */
function slaOverrunDays(app: Application): number {
  if (app.isSlaViolated) {
    const over = (Number(app.daysSpentInStage) || 0) - (Number(app.slaDays) || 0);
    return Math.max(over, 0);
  }
  const sla = Number(app.slaDays) || 0;
  const spent = Number(app.daysSpentInStage) || 0;
  return sla > 0 && spent > sla ? spent - sla : 0;
}

function formatEGP(value: number, isAr: boolean): string {
  const loc = isAr ? 'ar-EG' : 'en-US';
  const unit = isAr ? 'ج.م' : 'EGP';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} ${isAr ? 'مليار' : 'B'} ${unit}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} ${isAr ? 'مليون' : 'M'} ${unit}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} ${isAr ? 'ألف' : 'K'} ${unit}`;
  return `${value.toLocaleString(loc)} ${unit}`;
}

export const MinistryOverviewView: React.FC = () => {
  const { applications, initiatives, language, navigate } = usePlatformStore();
  const isAr = language === 'ar';
  const loc = isAr ? 'ar-EG' : 'en-US';

  const apps: Application[] = useMemo(
    () => (Array.isArray(applications) ? applications : []),
    [applications]
  );
  const inits = useMemo(
    () => (Array.isArray(initiatives) ? initiatives : []),
    [initiatives]
  );

  // ── البطاقات الوطنية العليا (مشتقة من حالات الطلبات) ─────────────
  const national = useMemo(() => {
    const live = apps.filter(a => a.status !== 'draft' && a.status !== 'cancelled');
    const qualified = apps.filter(a => a.status === 'approved' || a.status === 'in_progress' || a.status === 'completed');
    const financed = qualified.filter(a => financingOf(a) > 0);
    const operating = apps.filter(a => a.status === 'completed');
    const totalCapacityKWp = apps.reduce((s, a) => s + capacityOf(a), 0);
    const totalFinancingEGP = apps.reduce((s, a) => s + financingOf(a), 0);
    const completionRate = live.length ? (operating.length / live.length) * 100 : 0;
    return { live, qualified, financed, operating, totalCapacityKWp, totalFinancingEGP, completionRate };
  }, [apps]);

  // ── شريط تقدم مراحل المسار (counts حسب currentStageId) ───────────
  const stageStrip = useMemo(() => {
    const map = new Map<string, { id: string; nameAr: string; nameEn: string; count: number }>();
    for (const a of apps) {
      const id = a.currentStageId || a.currentStageCode || 'unknown';
      const entry = map.get(id) ?? {
        id,
        nameAr: a.currentStageNameAr || a.currentStageCode || '—',
        nameEn: a.currentStageNameEn || a.currentStageCode || '—',
        count: 0,
      };
      entry.count += 1;
      map.set(id, entry);
    }
    const total = apps.length || 1;
    return [...map.values()]
      .sort((x, y) => y.count - x.count)
      .map(s => ({ ...s, share: (s.count / total) * 100 }));
  }, [apps]);

  // ── جدول المبادرات المصغر ─────────────────────────────────────────
  const initiativeRows = useMemo(() => {
    return inits.map(init => {
      const rel = apps.filter(a => a.initiativeId === init.id);
      const done = rel.filter(a => a.status === 'completed').length;
      return {
        id: init.id,
        title: isAr ? init.titleAr : init.titleEn,
        total: rel.length,
        done,
      };
    });
  }, [inits, apps, isAr]);

  // ── تنبيهات SLA (عرض فقط) ─────────────────────────────────────────
  const slaAlerts = useMemo(() => {
    return apps
      .filter(a => slaOverrunDays(a) > 0)
      .sort((a, b) => slaOverrunDays(b) - slaOverrunDays(a))
      .slice(0, 8);
  }, [apps]);

  const topCards = [
    {
      key: 'applied',
      labelAr: 'مصانع متقدمة', labelEn: 'Applied Factories',
      value: national.live.length.toLocaleString(loc),
      subAr: 'طلبات حية (باستثناء المسودات والملغاة)',
      subEn: 'Live applications (excl. drafts/cancelled)',
      icon: FileText, bg: 'var(--gov-teal)',
    },
    {
      key: 'qualified',
      labelAr: 'مصانع مؤهلة', labelEn: 'Qualified Factories',
      value: national.qualified.length.toLocaleString(loc),
      subAr: 'معتمدة / جارٍ التنفيذ / مكتملة',
      subEn: 'Approved / in progress / completed',
      icon: BadgeCheck, bg: 'var(--gov-primary-800)',
    },
    {
      key: 'financed',
      labelAr: 'مصانع ممولة', labelEn: 'Financed Factories',
      value: national.financed.length.toLocaleString(loc),
      subAr: 'مؤهلة ولها مبلغ تمويل مسجل',
      subEn: 'Qualified with recorded financing',
      icon: Banknote, bg: 'var(--egypt-gold)',
    },
    {
      key: 'operating',
      labelAr: 'مصانع مشغلة', labelEn: 'Operating Factories',
      value: national.operating.length.toLocaleString(loc),
      subAr: 'طلبات مكتملة التشغيل',
      subEn: 'Fully completed applications',
      icon: CheckCircle2, bg: 'var(--status-approved)',
    },
    {
      key: 'capacity',
      labelAr: 'إجمالي القدرات', labelEn: 'Total Capacity',
      value: `${national.totalCapacityKWp.toLocaleString(loc)} kWp`,
      subAr: 'مشتقة من بيانات الطلبات (formData)',
      subEn: 'Derived from application form data',
      icon: Zap, bg: 'var(--egypt-red)',
    },
    {
      key: 'financing',
      labelAr: 'حجم التمويلات', labelEn: 'Financing Volume',
      value: formatEGP(national.totalFinancingEGP, isAr),
      subAr: 'إجمالي المبالغ المسجلة على الطلبات',
      subEn: 'Total recorded financing amounts',
      icon: Landmark, bg: 'var(--gov-primary-700)',
    },
    {
      key: 'completion',
      labelAr: 'نسبة الإنجاز الوطنية', labelEn: 'National Completion',
      value: `${national.completionRate.toFixed(1)}%`,
      subAr: 'المكتملة ÷ الطلبات الحية',
      subEn: 'Completed ÷ live applications',
      icon: Gauge, bg: 'var(--status-pending)',
    },
  ];

  const stagePalette = [
    'var(--gov-primary-800)', 'var(--gov-teal)', 'var(--egypt-gold)',
    'var(--egypt-red)', 'var(--status-approved)', 'var(--status-pending)',
    'var(--text-muted)',
  ];

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      {/* العنوان */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Landmark size={22} style={{ color: 'var(--egypt-red)' }} />
          <span>{isAr ? 'نظرة الوزارة' : 'Ministry Overview'}</span>
        </h1>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {isAr
            ? 'لوحة مشاهدة مبسطة للقيادة — قراءة فقط بدون أي إجراءات تعديل.'
            : 'Simplified read-only overview for leadership — no editing actions.'}
        </p>
      </div>

      {/* البطاقات الوطنية العليا */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {topCards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="card card-elevated" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.45rem' }}>
              <div className="stat-icon" style={{ background: c.bg, color: 'var(--text-inverse)' }}>
                <Icon size={20} />
              </div>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 600 }}>{isAr ? c.labelAr : c.labelEn}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gov-primary-900)', lineHeight: 1.1 }} className="num-ltr">{c.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{isAr ? c.subAr : c.subEn}</div>
            </div>
          );
        })}
      </div>

      {/* شريط تقدم مراحل المسار */}
      <div className="card flag-side-accent" style={{ padding: '1.15rem', marginBottom: '1rem' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
          <Layers size={18} style={{ color: 'var(--gov-primary-700)' }} />
          <span>{isAr ? 'توزيع الطلبات على مراحل المسار' : 'Applications by Workflow Stage'}</span>
        </h3>
        {stageStrip.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {isAr ? 'لا توجد طلبات بعد' : 'No applications yet'}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', height: 14, borderRadius: 9999, overflow: 'hidden', background: 'var(--bg-muted)', marginBottom: '0.9rem' }} dir="ltr">
              {stageStrip.map((s, i) => (
                <div
                  key={s.id}
                  title={`${isAr ? s.nameAr : s.nameEn}: ${s.count}`}
                  style={{ width: `${s.share}%`, background: stagePalette[i % stagePalette.length], minWidth: s.count > 0 ? 4 : 0 }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {stageStrip.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: stagePalette[i % stagePalette.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{isAr ? s.nameAr : s.nameEn}</span>
                  <span style={{ marginInlineStart: 'auto', fontWeight: 800, color: 'var(--text-main)' }} className="num-ltr">
                    {s.count} • {s.share.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* جدول المبادرات المصغر + تنبيهات SLA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1rem' }}>
        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
            <Landmark size={18} style={{ color: 'var(--egypt-red)' }} />
            <span>{isAr ? 'المبادرات' : 'Initiatives'}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-muted)', padding: '0.15rem 0.5rem', borderRadius: 9999, color: 'var(--text-muted)' }}>
              {initiativeRows.length}
            </span>
          </h3>
          {initiativeRows.length === 0 ? (
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
                    <th>{isAr ? 'المكتملة' : 'Done'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {initiativeRows.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, color: 'var(--gov-primary-900)' }}>{r.title}</td>
                      <td style={{ fontWeight: 700 }} className="num-ltr">{r.total}</td>
                      <td className="num-ltr">{r.done}</td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate('initiative-detail', r.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                        >
                          <Eye size={14} />
                          <span>{isAr ? 'عرض الصفحة' : 'View page'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card flag-side-accent" style={{ padding: '1.15rem' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <AlertTriangle size={18} style={{ color: slaAlerts.length ? 'var(--status-rejected)' : 'var(--status-approved)' }} />
            <span>{isAr ? 'تنبيهات تجاوز SLA' : 'SLA Breach Alerts'}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-muted)', padding: '0.15rem 0.5rem', borderRadius: 9999, color: 'var(--text-muted)' }}>
              {slaAlerts.length}
            </span>
          </h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.9rem' }}>
            {isAr ? 'للمراقبة والعرض فقط — لا تتضمن أي إجراء.' : 'Monitoring display only — no actions attached.'}
          </p>
          {slaAlerts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'var(--status-approved-bg)', border: '1px solid var(--status-approved-border)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--status-approved-text)', fontWeight: 600 }}>
              <CheckCircle2 size={16} />
              {isAr ? 'لا توجد تجاوزات — الالتزام كامل' : 'No breaches — full compliance'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {slaAlerts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', background: 'var(--status-rejected-bg)', border: '1px solid var(--status-rejected-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                  <AlertTriangle size={15} style={{ color: 'var(--status-rejected)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }} className="num-ltr">{a.applicationNumber}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(isAr ? a.factoryNameAr : a.factoryNameEn) || a.factoryNameAr} • {(isAr ? a.currentStageNameAr : a.currentStageNameEn) || a.currentStageNameAr}
                    </div>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--status-rejected)', whiteSpace: 'nowrap' }} className="num-ltr">
                    +{slaOverrunDays(a)} {isAr ? 'يوم' : 'd'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
