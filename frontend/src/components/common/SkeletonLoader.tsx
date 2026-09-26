import React from 'react';

export const SkeletonBlock: React.FC<{
  width?: string;
  height?: string;
  rounded?: boolean;
  style?: React.CSSProperties;
}> = ({ width, height, rounded = true, style }) => (
  <div
    className={`skeleton ${rounded ? 'skeleton--round' : ''}`}
    style={{ width, height, ...style }}
    aria-hidden="true"
  />
);

export const SkeletonCard: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card skeleton-card" style={{ padding: '1.25rem' }}>
        <SkeletonBlock width="60%" height="14px" />
        <div style={{ height: '8px', marginTop: '0.5rem' }} />
        <SkeletonBlock width="40%" height="32px" style={{ marginTop: '0.75rem' }} />
        <div style={{ height: '8px', marginTop: '0.75rem' }} />
      </div>
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="table-responsive">
    <table className="table">
      <thead>
        <tr>
          {['العنوان', 'الحالة', 'التاريخ'].map(h => (
            <th key={h}><SkeletonBlock width="80px" height="12px" /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {[1, 2, 3].map(c => (
              <td key={c}><SkeletonBlock width={`${60 + Math.random() * 30}%`} height="12px" /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
