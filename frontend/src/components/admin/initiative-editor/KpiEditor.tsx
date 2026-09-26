import React from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import type { InitiativeKpi, KpiUnit } from '../../../types';

export const KPI_UNITS: ReadonlyArray<{ value: KpiUnit; ar: string; en: string }> = [
  { value: 'count', ar: 'عدد', en: 'Count' },
  { value: 'MW', ar: 'ميجاوات', en: 'MW' },
  { value: 'MWh', ar: 'ميجاوات ساعة', en: 'MWh' },
  { value: 'EGP', ar: 'جنيه', en: 'EGP' },
  { value: 'tCO2', ar: 'طن CO₂', en: 'tCO₂' },
  { value: 'toe', ar: 'طن مكافئ نفط', en: 'Tonnes of oil eq.' },
  { value: 'percent', ar: '٪ نسبة', en: '% Percent' },
  { value: 'days', ar: 'يوم', en: 'Days' },
];

const numOrUndef = (s: string): number | undefined => {
  const t = s.replace(/[^\d.]/g, '');
  return t === '' ? undefined : Number(t);
};

/** مؤشرات قياس الأداء — ADMIN ONLY: الاسم + الوحدة + المستهدف + المحقق + نسبة الإنجاز. */
export const KpiEditor: React.FC<{
  kpis: InitiativeKpi[];
  onChange: (k: InitiativeKpi[]) => void;
  isAr: boolean;
}> = ({ kpis, onChange, isAr }) => {
  const update = (i: number, patch: Partial<InitiativeKpi>) => onChange(kpis.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= kpis.length) return;
    const next = [...kpis];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const iconBtn: React.CSSProperties = { width: '30px', height: '30px', padding: 0, justifyContent: 'center', borderRadius: '8px' };
  const fmt = (n: number) => n.toLocaleString(isAr ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {kpis.length === 0 && (
        <div style={{ padding: '0.9rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)' }}>
          {isAr ? 'لا توجد مؤشرات بعد — أضف أول مؤشر.' : 'No KPIs yet — add the first one.'}
        </div>
      )}
      {kpis.map((k, i) => {
        const pct = k.targetValue && k.targetValue > 0 && k.currentValue !== undefined
          ? Math.min(100, Math.round((k.currentValue / k.targetValue) * 100)) : null;
        return (
          <div key={k.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem', background: 'var(--bg-app)' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--gov-primary-900)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1.55rem' }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                  <label className="form-label required" style={{ fontSize: '0.75rem' }}>{isAr ? 'اسم المؤشر (عربي)' : 'KPI name (Arabic)'}</label>
                  <input className="form-control" value={k.nameAr} onChange={e => update(i, { nameAr: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'اسم المؤشر (إنجليزي)' : 'KPI name (English)'}</label>
                  <input className="form-control" dir="ltr" value={k.nameEn} onChange={e => update(i, { nameEn: e.target.value })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'وحدة القياس' : 'Unit'}</label>
                  <select className="form-control" value={k.unit} onChange={e => update(i, { unit: e.target.value as KpiUnit })}>
                    {KPI_UNITS.map(u => <option key={u.value} value={u.value}>{isAr ? u.ar : u.en}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'المستهدف' : 'Target'}</label>
                  <input className="form-control" inputMode="decimal" dir="ltr" value={k.targetValue ?? ''} placeholder="—" onChange={e => update(i, { targetValue: numOrUndef(e.target.value) })} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? 'المحقق حتى الآن' : 'Achieved'}</label>
                  <input className="form-control" inputMode="decimal" dir="ltr" value={k.currentValue ?? ''} placeholder="—" onChange={e => update(i, { currentValue: numOrUndef(e.target.value) })} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1.4rem', flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}><ChevronUp size={14} /></button>
                <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} disabled={i === kpis.length - 1} onClick={() => move(i, 1)} aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}><ChevronDown size={14} /></button>
                <button type="button" className="btn btn-secondary btn-sm" style={{ ...iconBtn, color: 'var(--gov-crimson)' }} onClick={() => onChange(kpis.filter((_, j) => j !== i))} aria-label={isAr ? 'حذف' : 'Delete'}><Trash2 size={14} /></button>
              </div>
            </div>
            {pct !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', paddingInlineStart: '2.1rem' }}>
                <div style={{ flex: 1, height: '6px', background: 'var(--border-subtle)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--status-approved-text)' : 'var(--gov-primary-700)' }} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {isAr ? `${fmt(pct)}٪ — ${fmt(k.currentValue ?? 0)} من ${fmt(k.targetValue ?? 0)}` : `${pct}% — ${fmt(k.currentValue ?? 0)} of ${fmt(k.targetValue ?? 0)}`}
                </span>
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="btn btn-secondary"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange([...kpis, { id: `kpi-${Date.now().toString(36)}`, nameAr: '', nameEn: '', unit: 'count' }])}
      >
        <Plus size={14} /> {isAr ? 'إضافة مؤشر' : 'Add KPI'}
      </button>
    </div>
  );
};
