import React from 'react';

/** بطاقة قسم داخل محرر المبادرة: عنوان + وصف قصير + عدّاد اختياري + محتوى. */
export const SectionCard: React.FC<{
  title: string;
  hint?: string;
  count?: number;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, hint, count, badge, children }) => (
  <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', padding: '1rem 1.1rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: hint ? '0.2rem' : '0.8rem' }}>
      <span style={{ width: '3px', height: '16px', background: 'var(--egypt-red)', borderRadius: '9999px', flexShrink: 0 }} />
      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)', margin: 0 }}>{title}</h3>
      {count !== undefined && (
        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.1rem 0.5rem', borderRadius: '9999px', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          {count}
        </span>
      )}
      {badge}
    </div>
    {hint && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.85rem 0', lineHeight: 1.6 }}>{hint}</p>}
    {children}
  </section>
);
