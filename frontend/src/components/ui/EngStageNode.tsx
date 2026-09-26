import React from 'react';

interface EngStageNodeProps {
  code: string;
  titleAr: string;
  titleEn?: string;
  status: 'completed' | 'active' | 'pending' | 'rejected';
  slaDays?: number;
  assignedOrg?: string;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  completed: 'var(--eng-status-approve)',
  active:    'var(--eng-status-pending)',
  pending:   'var(--eng-steel)',
  rejected:  'var(--eng-status-reject)',
};

export const EngStageNode: React.FC<EngStageNodeProps> = ({
  code,
  titleAr,
  titleEn,
  status,
  slaDays,
  assignedOrg,
  onClick,
}) => {
  const color = statusColors[status] ?? statusColors.pending;
  return (
    <div
      className="stage-node-eng"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderRight: `3px solid ${color}`,
        width: '100%',
        maxWidth: '540px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span className="eng-code">{code}</span>
        {slaDays != null && (
          <span
            style={{
              fontFamily: 'var(--eng-font-mono)',
              fontSize: 11,
              color: 'var(--eng-steel)',
            }}
          >
            SLA {slaDays}d
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--eng-font-tech)',
          fontSize: 14,
          color: 'var(--eng-ink)',
          fontWeight: 600,
        }}
      >
        {titleAr}
      </div>
      {titleEn && (
        <div
          style={{
            fontFamily: 'var(--eng-font-mono)',
            fontSize: 11,
            color: 'var(--eng-steel)',
            marginTop: 2,
          }}
        >
          {titleEn}
        </div>
      )}
      {assignedOrg && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--eng-steel-dark)',
            fontFamily: 'var(--eng-font-mono)',
          }}
        >
          ▸ {assignedOrg}
        </div>
      )}
    </div>
  );
};
