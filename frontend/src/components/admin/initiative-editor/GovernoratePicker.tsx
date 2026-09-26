import React from 'react';
import { EGYPT_GOVERNORATES } from '../../../utils/egypt';

/** اختيار المحافظات المستهدفة بشرائح (القيمة المخزنة = الاسم العربي، كما كانت). */
export const GovernoratePicker: React.FC<{
  value: string[];
  onChange: (v: string[]) => void;
  isAr: boolean;
}> = ({ value, onChange, isAr }) => {
  const selected = new Set(value);
  // قيم قديمة خارج القائمة (مثل «الشرقية (العاشر من رمضان)») تبقى ظاهرة وقابلة للإزالة
  const extras = value.filter(v => !EGYPT_GOVERNORATES.some(g => g.ar === v));
  const toggle = (ar: string) => onChange(selected.has(ar) ? value.filter(v => v !== ar) : [...value, ar]);
  const chip = (on: boolean): React.CSSProperties => ({
    fontSize: '0.75rem', padding: '0.28rem 0.6rem', borderRadius: '9999px', cursor: 'pointer',
    border: on ? '1px solid var(--egypt-red)' : '1px solid var(--border-medium)',
    background: on ? 'var(--egypt-red-soft)' : 'var(--bg-surface)',
    color: on ? 'var(--egypt-red)' : 'var(--text-body)', fontWeight: on ? 700 : 500,
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          {isAr ? `المختار: ${value.length.toLocaleString('ar-EG')} من ${EGYPT_GOVERNORATES.length.toLocaleString('ar-EG')}` : `Selected: ${value.length} of ${EGYPT_GOVERNORATES.length}`}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...extras, ...EGYPT_GOVERNORATES.map(g => g.ar)])}>{isAr ? 'كل المحافظات' : 'All'}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([])}>{isAr ? 'مسح' : 'Clear'}</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {EGYPT_GOVERNORATES.map(g => (
          <button key={g.ar} type="button" aria-pressed={selected.has(g.ar)} onClick={() => toggle(g.ar)} style={chip(selected.has(g.ar))}>
            {selected.has(g.ar) ? '✓ ' : ''}{isAr ? g.ar : g.en}
          </button>
        ))}
        {extras.map(v => (
          <button key={v} type="button" aria-pressed onClick={() => toggle(v)} style={chip(true)} title={isAr ? 'قيمة سابقة — اضغط للإزالة' : 'Legacy value — click to remove'}>
            ✓ {v}
          </button>
        ))}
      </div>
    </div>
  );
};
