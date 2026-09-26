import React from 'react';

// Shared pure-SVG chart primitives for admin statistics & reports.
// No external chart deps — inline SVG prints perfectly and needs no canvas.
// Colors come from CSS variables (identity-safe, no hard-coded hex in tsx).

export interface DonutDatum { label: string; value: number; color: string }

export const DonutChart: React.FC<{ data: DonutDatum[]; size?: number }> = ({ data, size = 180 }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const r = 68, cx = size / 2, cy = size / 2, stroke = 22;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--bg-muted)' }} />
      {data.map((d) => {
        const frac = d.value / total;
        const dash = circ * frac;
        const gap = circ - dash;
        const rot = (acc / total) * 360 - 90;
        acc += d.value;
        return (
          <circle
            key={d.label}
            cx={cx} cy={cy} r={r} fill="none"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rot} ${cx} ${cy})`}
            strokeLinecap="round"
            style={{ stroke: d.color, transition: 'all 0.3s' }}
          />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={800} style={{ fill: 'var(--text-main)' }}>{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fontWeight={600} style={{ fill: 'var(--text-muted)' }}>إجمالي</text>
    </svg>
  );
};

export interface BarDatum { label: string; value: number }

export const BarChart: React.FC<{ data: BarDatum[]; color?: string; maxBars?: number }> = ({
  data, color = 'var(--egypt-red)', maxBars = 6,
}) => {
  const sliced = data.slice(0, maxBars);
  const max = Math.max(1, ...sliced.map(d => d.value));
  if (sliced.length === 0) {
    return <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد بيانات</div>;
  }
  return (
    <svg viewBox="0 0 420 220" width="100%" height={220} role="img" style={{ display: 'block' }}>
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1={40} x2={400} y1={28 + i * 42} y2={28 + i * 42} strokeWidth={1} style={{ stroke: 'var(--bg-muted)' }} />
      ))}
      {sliced.map((d, i) => {
        const barW = Math.max(18, (340 / sliced.length) - 10);
        const x = 46 + i * (340 / sliced.length);
        const h = (d.value / max) * 150;
        const y = 176 - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={h} rx={7} opacity={0.92} style={{ fill: color }} />
            <rect x={x} y={y} width={barW} height={Math.min(14, h)} rx={7} fill="white" opacity={0.18} />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--text-main)' }}>{d.value}</text>
            <text x={x + barW / 2} y={196} textAnchor="middle" fontSize={9} fontWeight={600} style={{ fill: 'var(--text-muted)' }}>{d.label.length > 14 ? d.label.slice(0, 14) + '…' : d.label}</text>
          </g>
        );
      })}
      <line x1={40} x2={40} y1={14} y2={176} strokeWidth={1} style={{ stroke: 'var(--border-subtle)' }} />
      <line x1={40} x2={400} y1={176} y2={176} strokeWidth={1} style={{ stroke: 'var(--border-subtle)' }} />
    </svg>
  );
};

export const AreaChart: React.FC<{ data: BarDatum[]; emptyLabel?: string }> = ({ data, emptyLabel = 'لا توجد بيانات زمنية' }) => {
  const gid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  if (data.length === 0) {
    return <div style={{ height: 190, display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emptyLabel}</div>;
  }
  const max = Math.max(1, ...data.map(d => d.value));
  const W = 420, H = 190, padL = 36, padB = 32, padT = 16;
  const step = (W - padL - 12) / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => {
    const x = padL + i * step;
    const y = padT + (H - padT - padB) * (1 - d.value / max);
    return { x, y, d };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopOpacity={0.22} style={{ stopColor: 'var(--egypt-red)' }} />
          <stop offset="100%" stopOpacity={0} style={{ stopColor: 'var(--egypt-red)' }} />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1={padL} x2={W - 12} y1={padT + i * ((H - padT - padB) / 3)} y2={padT + i * ((H - padT - padB) / 3)} strokeWidth={1} style={{ stroke: 'var(--bg-muted)' }} />
      ))}
      <path d={areaD} fill={`url(#area-${gid})`} stroke="none" />
      <path d={pathD} fill="none" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: 'var(--egypt-red)' }} />
      {pts.map((p) => (
        <g key={p.x}>
          <circle cx={p.x} cy={p.y} r={4.5} strokeWidth={2} style={{ fill: 'var(--bg-surface)', stroke: 'var(--egypt-red)' }} />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={10} fontWeight={700} style={{ fill: 'var(--text-main)' }}>{p.d.value}</text>
          <text x={p.x} y={H - 10} textAnchor="middle" fontSize={8.5} fontWeight={600} style={{ fill: 'var(--text-muted)' }}>{p.d.label}</text>
        </g>
      ))}
      <line x1={padL} x2={padL} y1={padT} y2={H - padB} style={{ stroke: 'var(--border-subtle)' }} />
      <line x1={padL} x2={W - 12} y1={H - padB} y2={H - padB} style={{ stroke: 'var(--border-subtle)' }} />
    </svg>
  );
};

// Horizontal progress-bar list — for workload / distribution rankings.
export interface HBarDatum { label: string; count: number; sub?: string; color?: string }

export const HBarList: React.FC<{ data: HBarDatum[]; max?: number; emptyLabel?: string }> = ({ data, max, emptyLabel = 'لا توجد بيانات' }) => {
  const peak = max ?? Math.max(1, ...data.map(d => d.count));
  if (data.length === 0) {
    return <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emptyLabel}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {data.map((d) => (
        <div key={d.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexShrink: 0 }}>
              <span style={{ fontWeight: 800 }}>{d.count}</span>
              {d.sub && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{d.sub}</span>}
            </span>
          </div>
          <div className="progress-track">
            <div
              style={{
                width: `${Math.min(100, (d.count / peak) * 100)}%`,
                height: '100%',
                background: d.color ?? 'var(--egypt-red)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
