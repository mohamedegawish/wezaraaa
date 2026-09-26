import React, { useEffect, useState } from 'react';

interface EngSLATimerProps {
  dueDate: string;
  label?: string;
}

export const EngSLATimer: React.FC<EngSLATimerProps> = ({ dueDate, label = 'SLA' }) => {
  const [remaining, setRemaining] = useState<string>('--:--:--');
  const [state, setState] = useState<'ok' | 'warning' | 'overdue'>('ok');

  useEffect(() => {
    const tick = () => {
      const diff = new Date(dueDate).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('00:00:00');
        setState('overdue');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
      setState(h < 24 ? 'warning' : 'ok');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dueDate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          fontFamily: 'var(--eng-font-mono)',
          fontSize: 11,
          color: 'var(--eng-steel)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        className={`eng-sla-timer ${state === 'overdue' ? 'overdue' : state === 'warning' ? '' : 'approved'}`}
      >
        {remaining}
      </span>
    </div>
  );
};
