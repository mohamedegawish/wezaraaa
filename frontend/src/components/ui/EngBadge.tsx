import React from 'react';

type EngBadgeVariant = 'approve' | 'reject' | 'pending' | 'info' | 'brass';

// كل المتغيرات تعرض بنص ذهبي رسمي موحد — لا خلفيات ملونة (بديل البادجات الرخيصة).
// المعنى يظهر في النص نفسه (معتمد / مرفوض / قيد المراجعة).
const variantStyles: Record<EngBadgeVariant, { text: string; border: string }> = {
  approve: { text: 'var(--gold-text)', border: 'var(--gold-border)' },
  reject:  { text: 'var(--gold-text)', border: 'var(--gold-border)' },
  pending: { text: 'var(--gold-text)', border: 'var(--gold-border)' },
  info:    { text: 'var(--gold-text)', border: 'var(--gold-border)' },
  brass:   { text: 'var(--gold-bright)', border: 'var(--gold-border)' },
};

interface EngBadgeProps {
  variant?: EngBadgeVariant;
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}

export const EngBadge: React.FC<EngBadgeProps> = ({
  variant = 'info',
  children,
  mono = false,
  className = '',
}) => {
  const s = variantStyles[variant];
  return (
    <span
      className={`eng-brass-chip ${className}`}
      style={{
        background: 'transparent',
        color: s.text,
        borderColor: s.border,
        fontFamily: mono ? 'var(--eng-font-mono)' : 'var(--eng-font-tech)',
      }}
    >
      {children}
    </span>
  );
};
