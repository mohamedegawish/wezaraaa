import React from 'react';
import { formatEGP } from '../../../utils/format';

/** مبلغ بالجنيه: فواصل آلاف أثناء الكتابة + معاينة مقروءة («١٢٫٥ مليار جنيه»). */
export const MoneyInput: React.FC<{
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
  isAr: boolean;
  hint?: string;
  required?: boolean;
}> = ({ label, value, onChange, isAr, hint, required }) => {
  const n = Number(value) || 0;
  return (
    <div className="form-group">
      <label className={`form-label${required ? ' required' : ''}`}>{label}</label>
      <div dir="ltr" style={{ position: 'relative' }}>
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          className="form-control"
          value={n ? n.toLocaleString('en-US') : ''}
          placeholder="0"
          onChange={e => {
            const digits = e.target.value.replace(/[^\d]/g, '');
            onChange(digits ? Number(digits) : 0);
          }}
          style={{ paddingInlineEnd: '3.2rem', fontVariantNumeric: 'tabular-nums' }}
        />
        <span style={{ position: 'absolute', insetInlineEnd: '0.7rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', pointerEvents: 'none' }}>
          EGP
        </span>
      </div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: n ? 'var(--gov-primary-700)' : 'var(--text-light)', marginTop: '0.3rem' }}>
        {n ? formatEGP(n, isAr) : (isAr ? 'لم يُحدد بعد' : 'Not set')}
        {hint && <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> — {hint}</span>}
      </div>
    </div>
  );
};
