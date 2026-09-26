import React from 'react';
import { statusTone, StatusTone } from '../../utils/theme';

type Props = {
  status?: string | null;
  tone?: StatusTone;
  children: React.ReactNode;
};

/** شارة حالة موحدة — HOW TO USE: <Badge status={app.status} /> أو <Badge tone="gold"> */
export const Badge: React.FC<Props> = ({ status, tone, children }) => {
  const t = tone ?? statusTone(status);
  return (
    <span className={`badge badge-${t}`}>
      {children}
    </span>
  );
};
