import React from 'react';

interface EgyptianEagleProps {
  size?: number;
  className?: string;
  variant?: 'gold' | 'monochrome' | 'white';
  style?: React.CSSProperties;
}

/**
 * شعار جمهورية مصر العربية — نسر صلاح الدين الأيوبي الرسمي
 * Official Coat of Arms of the Arab Republic of Egypt (Eagle of Saladin)
 * Uses the official vector from Wikimedia Commons for authentic government representation.
 */
export const EgyptianEagle: React.FC<EgyptianEagleProps> = ({
  size = 36,
  className = '',
  variant = 'gold',
  style
}) => {
  // For the 'white' variant (watermark), use CSS filter to make it white
  // For 'monochrome' use grayscale
  const filterStyle: React.CSSProperties = variant === 'white' 
    ? { filter: 'brightness(0) invert(1)', opacity: 1 }
    : variant === 'monochrome' 
      ? { filter: 'grayscale(1)' }
      : {};

  return (
    <img
      src="/egypt-coat-of-arms.svg"
      alt="شعار جمهورية مصر العربية"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        maxWidth: size,
        maxHeight: size,
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        objectFit: 'contain',
        ...filterStyle,
        ...style
      }}
      role="img"
      aria-label="شعار جمهورية مصر العربية"
    />
  );
};
