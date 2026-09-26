import React from 'react';

// بطاقة سطح موحدة — HOW TO USE:
// <Card>...محتوى...</Card>
// <Card interactive onClick={...}>...قابلة للنقر...</Card>
// - الألوان/الظلال من globals.css عبر card/card-interactive — لا تضع hex هنا.

type Props = {
  interactive?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
};

export const Card: React.FC<Props> = ({ interactive, style, children, onClick }) => {
  return (
    <div
      className={interactive ? 'card card-interactive' : 'card'}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
