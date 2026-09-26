import React from 'react';

/** رقم مع وحدة ظاهرة داخل الحقل (مصنع / ميجاوات / سنوات …). */
export const UnitInput: React.FC<{
  label: string;
  unit: string;
  value: number | undefined;
  onChange: (n: number) => void;
  hint?: string;
  step?: number;
}> = ({ label, unit, value, onChange, hint, step }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    <div dir="ltr" style={{ position: 'relative' }}>
      <input
        type="number"
        min={0}
        step={step ?? 1}
        dir="ltr"
        className="form-control"
        value={value ? value : ''}
        placeholder="0"
        onChange={e => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
        style={{ paddingInlineEnd: '5.5rem', fontVariantNumeric: 'tabular-nums' }}
      />
      <span style={{ position: 'absolute', insetInlineEnd: '0.7rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', pointerEvents: 'none' }}>
        {unit}
      </span>
    </div>
    {hint && <div className="form-helper" style={{ fontSize: '0.72rem' }}>{hint}</div>}
  </div>
);
