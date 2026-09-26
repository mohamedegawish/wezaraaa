import React from 'react';
import { TimelineEvent, WorkflowStage, UserRole } from '../../types';
import { usePlatformStore, ROLE_DEFAULT_TITLES } from '../../store/state';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  User, 
  Building2, 
  Send, 
  RotateCcw,
  MessageSquare
} from 'lucide-react';

interface InteractiveTimelineProps {
  timeline: TimelineEvent[];
  stages: WorkflowStage[];
  currentStageId: string;
}

const ACTION_TITLES: Record<string, { ar: string; en: string }> = {
  submit: { ar: 'تقديم الطلب', en: 'Application submitted' },
  approve: { ar: 'اعتماد المرحلة', en: 'Stage approved' },
  request_rework: { ar: 'طلب استيفاء', en: 'Rework requested' },
  reject: { ar: 'رفض الطلب', en: 'Application rejected' },
  escalate: { ar: 'تصعيد الطلب', en: 'Application escalated' },
};

export const InteractiveTimeline: React.FC<InteractiveTimelineProps> = ({
  timeline,
  stages,
  currentStageId
}) => {
  const { language } = usePlatformStore();
  const isAr = language === 'ar';

  const currentStageIndex = stages.findIndex(s => s.id === currentStageId);

  // المدد المتوقعة للعميل: إجمالي كل المراحل + المتبقي من المرحلة الحالية حتى النهاية
  const fmtNum = (n: number) => n.toLocaleString(isAr ? 'ar-EG' : 'en-US');
  const days = (s: WorkflowStage) => Math.max(0, Number(s.slaDays) || 0);
  const totalDays = stages.reduce((sum, s) => sum + days(s), 0);
  const currentStage = currentStageIndex >= 0 ? stages[currentStageIndex] : undefined;
  const remainingDays = currentStageIndex >= 0 ? stages.slice(currentStageIndex).reduce((sum, s) => sum + days(s), 0) : 0;
  const stageName = (s: WorkflowStage) => (isAr ? s.nameAr.split('.')[1] || s.nameAr : s.nameEn.split('.')[1] || s.nameEn).trim();

  return (
    <div className="timeline-scroll-x" style={{ padding: '0.5rem 0' }}>
      {/* 0. ملخص المدة المتوقعة */}
      {totalDays > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--text-body)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: 'var(--gov-primary-900)' }}>
            <Clock size={14} style={{ color: 'var(--gov-gold-dark)' }} />
            {isAr ? `المدة المتوقعة الإجمالية: ${fmtNum(totalDays)} يوم عمل` : `Expected total duration: ${fmtNum(totalDays)} working days`}
          </span>
          {currentStage && (
            <span>
              {isAr
                ? `المرحلة الحالية «${stageName(currentStage)}»: حتى ${fmtNum(days(currentStage))} أيام عمل — المتبقي تقريباً ${fmtNum(remainingDays)} يوم عمل`
                : `Current stage "${stageName(currentStage)}": up to ${fmtNum(days(currentStage))} working days — about ${fmtNum(remainingDays)} days remaining`}
            </span>
          )}
        </div>
      )}

      {/* 1. Stage Steps Progress Bar */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${stages.length}, minmax(120px, 1fr))`, 
          gap: '0.5rem',
          marginBottom: '2rem',
          background: 'var(--bg-app)',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;
          const isPending = idx > currentStageIndex;

          return (
            <div 
              key={stage.id} 
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative'
              }}
            >
              {/* Circle Indicator */}
              <div 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: isCompleted ? 'var(--status-approved-text)' : isCurrent ? 'var(--gov-primary-800)' : 'var(--border-subtle)',
                  color: isCompleted || isCurrent ? 'var(--on-dark)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: isCurrent ? '2px solid var(--gov-primary-700)' : 'none',
                  marginBottom: '0.4rem',
                  zIndex: 2
                }}
              >
                {isCompleted ? <CheckCircle2 size={20} /> : idx + 1}
              </div>

              <div style={{ fontSize: '0.775rem', fontWeight: isCurrent ? 700 : 600, color: isCurrent ? 'var(--gov-primary-900)' : 'var(--text-body)', lineHeight: 1.25 }}>
                {stageName(stage)}
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {stage.assignedOrgNameAr}
              </div>

              {days(stage) > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.3rem', padding: '0.1rem 0.45rem', borderRadius: '9999px', background: isCurrent ? 'var(--gov-gold-light)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: isCurrent ? 'var(--gov-gold-dark)' : 'var(--text-muted)' }}>
                  <Clock size={11} />
                  <span>{isAr ? `${fmtNum(days(stage))} أيام عمل` : `${fmtNum(days(stage))} working days`}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Detailed History Timeline Log */}
      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '1rem' }}>
        {isAr ? 'سجل القرارات والخط الزمني الموثق (Audit Timeline):' : 'Documented Action & Decision History:'}
      </h4>

      <div style={{ position: 'relative', paddingInlineStart: '2rem' }}>
        {/* Timeline vertical bar line */}
        <div 
          style={{ 
            position: 'absolute', 
            top: '8px', 
            bottom: '8px', 
            [isAr ? 'right' : 'left']: '11px', 
            width: '2px', 
            background: 'var(--border-medium)' 
          }} 
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {timeline.map((event, idx) => {
            const isApproved = event.action === 'approve';
            const isRework = event.action === 'request_rework';
            const isReject = event.action === 'reject';
            const isSubmit = event.action === 'submit';

            // Backend entries: { at, action, by + performer snapshot }. Normalize + fallbacks.
            const titles = ACTION_TITLES[event.action] ?? {
              ar: event.actionTitleAr ?? event.action,
              en: event.actionTitleEn ?? event.action,
            };
            const whenRaw = event.at ?? event.timestamp ?? '';
            const whenDate = whenRaw ? new Date(whenRaw) : null;
            const whenOk = whenDate !== null && !Number.isNaN(whenDate.getTime());
            const roleTitles = event.byRole ? ROLE_DEFAULT_TITLES[event.byRole as UserRole] : undefined;
            const performer = event.byName ?? event.performerName ?? (isSubmit ? (isAr ? 'مقدم الطلب' : 'Applicant') : (event.by || '—'));
            const performerRole = roleTitles ? (isAr ? roleTitles.ar : roleTitles.en) : (event.performerRoleAr ?? event.byRole ?? '');
            const performerOrg = event.byOrgNameAr ?? event.performerOrgAr ?? '';
            const performerOrgEn = event.byOrgNameEn ?? event.performerOrgEn ?? performerOrg;

            const iconColor = isApproved ? 'var(--status-approved-text)' : isRework ? 'var(--status-rework-text)' : isReject ? 'var(--gov-crimson)' : 'var(--gov-primary-700)';

            return (
              <div key={event.id || idx} style={{ position: 'relative' }}>
                {/* Node Dot */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '2px', 
                    [isAr ? 'right' : 'left']: '-2rem', 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    background: 'var(--bg-surface)', 
                    border: `2px solid ${iconColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: iconColor,
                    zIndex: 2
                  }}
                >
                  {isApproved ? <CheckCircle2 size={14} /> : isRework ? <RotateCcw size={14} /> : isSubmit ? <Send size={12} /> : <AlertCircle size={14} />}
                </div>

                {/* Event Card */}
                <div 
                  style={{ 
                    background: 'var(--bg-app)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '0.85rem 1.15rem',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--gov-primary-900)' }}>
                      {isAr ? titles.ar : titles.en}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} />
                      {whenOk && whenDate ? whenDate.toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--gov-primary-800)', fontWeight: 600 }}>
                      <User size={13} />
                      {performer}{performerRole ? ` (${performerRole})` : ''}
                    </span>
                    {!!performerOrg && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Building2 size={13} />
                        {isAr ? performerOrg : performerOrgEn}
                      </span>
                    )}
                  </div>

                  {event.comments && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-body)', background: 'var(--bg-surface)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', lineHeight: 1.5 }}>
                      <MessageSquare size={14} style={{ color: 'var(--gov-gold-dark)', marginTop: '0.2rem', flexShrink: 0 }} />
                      <span>{event.comments}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
