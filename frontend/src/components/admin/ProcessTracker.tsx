import React from 'react';
import { AlertTriangle, Check, Clock, MessagesSquare, RotateCcw, X, Building2, CornerDownLeft } from 'lucide-react';
import type { Application, StageTrackItem } from '../../types';
import { ROLE_DEFAULT_TITLES, usePlatformStore } from '../../store/state';
import type { UserRole } from '../../types';

// «متابعة المسار» — كل مرحلة: الجهة، الحالة، من قرر ومتى، التعليق، والمدة مقابل الـ SLA.
// البيانات محسوبة في الباك (stageTrack) من سجل الطلب + تعريف المسار؛ هذا المكون عرض فقط.

const STATUS_META: Record<StageTrackItem['status'], { ar: string; en: string; badge: string; color: string }> = {
  approved: { ar: 'معتمدة', en: 'Approved', badge: 'badge-approved', color: 'var(--status-approved)' },
  current: { ar: 'قيد المراجعة', en: 'In review', badge: 'badge-info', color: 'var(--gov-primary-600)' },
  rework: { ar: 'مطلوب استيفاء', en: 'Rework requested', badge: 'badge-rework', color: '#B45309' },
  rejected: { ar: 'مرفوضة', en: 'Rejected', badge: 'badge-rejected', color: 'var(--status-rejected)' },
  pending: { ar: 'لم تبدأ', en: 'Not started', badge: 'badge-draft', color: 'var(--text-light)' },
  skipped: { ar: 'تم تخطيها', en: 'Skipped', badge: 'badge-draft', color: 'var(--text-light)' },
};

const ACTION_AR: Record<string, { ar: string; en: string }> = {
  approve: { ar: 'اعتماد', en: 'Approved' },
  reject: { ar: 'رفض', en: 'Rejected' },
  request_rework: { ar: 'طلب استيفاء', en: 'Rework requested' },
  escalate: { ar: 'تصعيد للوزارة', en: 'Escalated to ministry' },
};

const stripNo = (s: string) => s.replace(/^\s*\d+\s*[.\-–]\s*/, '');

function when(iso: string | null | undefined, isAr: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function daysLabel(n: number | null | undefined, isAr: boolean): string {
  if (n === null || n === undefined) return '—';
  if (n < 1) {
    const h = Math.max(1, Math.round(n * 24));
    return isAr ? `${h} ساعة` : `${h}h`;
  }
  return isAr ? `${n} يوم` : `${n} d`;
}

function roleTitle(role: string, isAr: boolean): string {
  const t = ROLE_DEFAULT_TITLES[role as UserRole];
  return t ? (isAr ? t.ar : t.en) : role;
}

export const ProcessTracker: React.FC<{ application: Application }> = ({ application }) => {
  const { language, openChat, canUseChat } = usePlatformStore();
  const isAr = language === 'ar';
  const track = application.stageTrack ?? [];

  if (track.length === 0) {
    return (
      <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {isAr ? 'لا يوجد مسار عمل معرّف لهذه المبادرة.' : 'No workflow is defined for this initiative.'}
      </div>
    );
  }

  const approved = track.filter(s => s.status === 'approved').length;
  const countable = track.filter(s => s.status !== 'skipped').length || 1;
  const pct = Math.round((approved / countable) * 100);
  const closed = application.status === 'completed' || application.status === 'rejected';
  const current = track.find(s => s.status === 'current' || s.status === 'rework') ?? null;
  const firstEnter = track.find(s => s.enteredAt)?.enteredAt ?? application.submittedAt;
  const lastDecided = [...track].reverse().find(s => s.decidedAt)?.decidedAt;
  const totalDays = Math.round((((closed && lastDecided ? new Date(lastDecided).getTime() : Date.now()) - new Date(firstEnter).getTime()) / 86400000) * 10) / 10;
  const escalation = application.isEscalated ? current?.escalation ?? null : null;

  const cell = (label: string, value: React.ReactNode, tone?: string) => (
    <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', minWidth: 0 }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontWeight: 800, color: tone ?? 'var(--gov-primary-900)', marginTop: '0.25rem', fontSize: '0.92rem' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* الملخص */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '0.85rem' }}>
        {cell(
          isAr ? 'التقدم في المسار' : 'Progress',
          <>
            <div>{application.status === 'completed'
              ? (isAr ? 'اكتمل المسار' : 'Completed')
              : (isAr ? `المرحلة ${application.currentStageOrder ?? '—'} من ${application.totalStages ?? track.length}` : `Stage ${application.currentStageOrder ?? '—'} of ${application.totalStages ?? track.length}`)}</div>
            <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '999px', marginTop: '0.45rem', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: application.status === 'rejected' ? 'var(--status-rejected)' : 'var(--status-approved)', borderRadius: '999px' }} />
            </div>
          </>,
        )}
        {cell(
          isAr ? 'لدى الجهة حالياً' : 'Currently with',
          closed ? (application.status === 'completed' ? (isAr ? '— (مكتمل)' : '— (completed)') : (isAr ? '— (مرفوض)' : '— (rejected)')) : (current?.orgNameAr || application.currentAssignedOrgNameAr),
        )}
        {cell(
          isAr ? 'المدة في المرحلة الحالية' : 'Time in current stage',
          closed || !current ? '—' : (isAr ? `${daysLabel(current.daysSpent, true)} من ${current.slaDays} يوم` : `${daysLabel(current.daysSpent, false)} of ${current.slaDays} d`),
          current?.slaBreached && !closed ? 'var(--status-rejected)' : undefined,
        )}
        {cell(isAr ? 'إجمالي مدة الطلب' : 'Total duration', daysLabel(totalDays, isAr))}
      </div>

      {/* تنبيه التصعيد */}
      {escalation && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.9rem 1.1rem', background: 'var(--status-rejected-bg)', border: '1px solid var(--status-rejected-border)', borderRadius: 'var(--radius-md)', color: 'var(--status-rejected)' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>
              {isAr ? `صعّدت ${escalation.byOrgNameAr || current?.orgNameAr} الطلب للوزارة` : `${escalation.byOrgNameEn || current?.orgNameAr} escalated this application`}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '0.3rem', lineHeight: 1.7 }}>«{escalation.comments}»</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {escalation.byName} · {roleTitle(escalation.byRole, isAr)} · {when(escalation.at, isAr)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              {isAr ? 'القرار يبقى لدى الجهة — يمكنكم التواصل معها لتوجيهها.' : 'The decision stays with the organization — you can message them.'}
            </div>
          </div>
          {canUseChat() && current && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openChat(current.orgId)} style={{ flexShrink: 0 }}>
              <MessagesSquare size={14} />
              <span>{isAr ? 'مراسلة الجهة' : 'Message'}</span>
            </button>
          )}
        </div>
      )}

      {/* المراحل */}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {track.map((s, idx) => {
          const meta = STATUS_META[s.status];
          const isLive = s.status === 'current' || s.status === 'rework';
          const Icon = s.status === 'approved' ? Check : s.status === 'rejected' ? X : s.status === 'rework' ? RotateCcw : null;
          const extraEvents = s.events.filter(e => e !== undefined && !(s.decidedBy && e.at === s.decidedBy.at && e.action === s.decidedBy.action));
          const muted = s.status === 'pending' || s.status === 'skipped';
          return (
            <li key={s.stageId} style={{ display: 'flex', gap: '0.85rem' }}>
              {/* rail */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{
                  width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 800,
                  background: s.status === 'approved' ? 'var(--status-approved)' : s.status === 'rejected' ? 'var(--status-rejected)' : isLive ? '#FFFFFF' : 'var(--bg-muted)',
                  color: s.status === 'approved' || s.status === 'rejected' ? '#FFFFFF' : meta.color,
                  border: isLive ? `2px solid ${meta.color}` : '1px solid var(--border-subtle)',
                  boxShadow: isLive ? '0 0 0 4px rgba(37,99,235,0.08)' : 'none',
                }}>
                  {Icon ? <Icon size={15} /> : s.order}
                </span>
                {idx < track.length - 1 && (
                  <span style={{ width: '2px', flex: 1, minHeight: '18px', background: s.status === 'approved' ? 'var(--status-approved-border)' : 'var(--border-subtle)', margin: '0.2rem 0' }} />
                )}
              </div>

              {/* card */}
              <div style={{
                flex: 1, minWidth: 0, marginBottom: '0.75rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
                background: isLive ? 'var(--bg-surface)' : muted ? 'var(--bg-app)' : 'var(--bg-surface)',
                border: isLive ? `1px solid ${meta.color}` : '1px solid var(--border-subtle)',
                boxShadow: isLive ? 'var(--shadow-sm)' : 'none', opacity: muted ? 0.85 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: muted ? 'var(--text-muted)' : 'var(--gov-primary-900)', fontSize: '0.9rem' }}>
                      {stripNo(isAr ? s.nameAr : (s.nameEn || s.nameAr))}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      <Building2 size={12} />{s.orgNameAr}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {s.escalation && (
                      <span className="badge badge-rejected" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertTriangle size={11} />{isAr ? 'مُصعَّدة' : 'Escalated'}
                      </span>
                    )}
                    {s.daysSpent !== null && (
                      <span className={`badge ${s.slaBreached ? 'badge-rejected' : 'badge-draft'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={11} />
                        {isAr ? `${daysLabel(s.daysSpent, true)} / ${s.slaDays} يوم` : `${daysLabel(s.daysSpent, false)} / ${s.slaDays} d`}
                      </span>
                    )}
                    <span className={`badge ${meta.badge}`}>{isAr ? meta.ar : meta.en}</span>
                  </div>
                </div>

                {s.decidedBy && (
                  <div style={{ marginTop: '0.65rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <b style={{ color: s.decision === 'reject' ? 'var(--status-rejected)' : 'var(--status-approved)' }}>
                        {(ACTION_AR[s.decision ?? ''] ?? { ar: s.decision, en: s.decision })[isAr ? 'ar' : 'en']}
                      </b>
                      {' — '}{s.decidedBy.byName}
                      <span style={{ color: 'var(--text-muted)' }}> · {roleTitle(s.decidedBy.byRole, isAr)} · {s.decidedBy.byOrgNameAr}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{when(s.decidedAt, isAr)}</div>
                    {s.decidedBy.comments && (
                      <div style={{ marginTop: '0.45rem', padding: '0.5rem 0.75rem', background: 'var(--bg-app)', borderInlineStart: '3px solid var(--border-strong)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.7 }}>
                        {s.decidedBy.comments}
                      </div>
                    )}
                  </div>
                )}

                {extraEvents.length > 0 && (
                  <ul style={{ listStyle: 'none', margin: '0.6rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {extraEvents.map((e, i) => (
                      <li key={`${e.at}-${i}`} style={{ display: 'flex', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                        <CornerDownLeft size={12} style={{ marginTop: '0.25rem', color: e.action === 'escalate' ? 'var(--status-rejected)' : '#B45309', flexShrink: 0 }} />
                        <span>
                          <b>{(ACTION_AR[e.action] ?? { ar: e.action, en: e.action })[isAr ? 'ar' : 'en']}</b>
                          {' — '}{e.byName}
                          <span style={{ color: 'var(--text-muted)' }}> · {when(e.at, isAr)}</span>
                          {e.comments && <span style={{ display: 'block', color: 'var(--text-main)' }}>«{e.comments}»</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {isLive && !s.decidedBy && (
                  <div style={{ marginTop: '0.55rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {isAr ? `بانتظار قرار ${s.orgNameAr} — منذ ${when(s.enteredAt, true)}` : `Awaiting ${s.orgNameAr} since ${when(s.enteredAt, false)}`}
                  </div>
                )}
                {s.status === 'skipped' && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {isAr ? 'قُدِّم الطلب قبل تفعيل هذه المرحلة.' : 'Submitted before this stage existed.'}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
