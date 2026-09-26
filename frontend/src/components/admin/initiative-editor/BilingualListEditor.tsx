import React from 'react';
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import type { BilingualItem } from '../../../types';

/** قائمة بنود مرقّمة (عربي + إنجليزي) مع إضافة/حذف/ترتيب — للمستهدفات والاشتراطات والمعايير. */
export const BilingualListEditor: React.FC<{
  items: BilingualItem[];
  onChange: (items: BilingualItem[]) => void;
  isAr: boolean;
  itemLabelAr: string;
  itemLabelEn: string;
  addLabelAr: string;
  addLabelEn: string;
  emptyAr: string;
  emptyEn: string;
}> = ({ items, onChange, isAr, itemLabelAr, itemLabelEn, addLabelAr, addLabelEn, emptyAr, emptyEn }) => {
  const update = (i: number, patch: Partial<BilingualItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const iconBtn: React.CSSProperties = { width: '30px', height: '30px', padding: 0, justifyContent: 'center', borderRadius: '8px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {items.length === 0 && (
        <div style={{ padding: '0.9rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)' }}>
          {isAr ? emptyAr : emptyEn}
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.7rem', background: 'var(--bg-app)' }}>
          <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--gov-primary-900)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1.55rem' }}>
            {i + 1}
          </span>
          <div className="form-grid-2" style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? `${itemLabelAr} (عربي)` : `${itemLabelEn} (Arabic)`}</label>
              <textarea className="form-control" rows={2} value={item.textAr} onChange={e => update(i, { textAr: e.target.value })} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>{isAr ? `${itemLabelAr} (إنجليزي)` : `${itemLabelEn} (English)`}</label>
              <textarea className="form-control" rows={2} dir="ltr" value={item.textEn} onChange={e => update(i, { textEn: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1.4rem', flexShrink: 0 }}>
            <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={isAr ? 'تحريك لأعلى' : 'Move up'}><ChevronUp size={14} /></button>
            <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={isAr ? 'تحريك لأسفل' : 'Move down'}><ChevronDown size={14} /></button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ ...iconBtn, color: 'var(--gov-crimson)' }} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={isAr ? 'حذف' : 'Delete'}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...items, { textAr: '', textEn: '' }])}>
        <Plus size={14} /> {isAr ? addLabelAr : addLabelEn}
      </button>
    </div>
  );
};
