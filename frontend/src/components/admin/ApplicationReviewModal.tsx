import React, { useState, useEffect } from 'react';
import { Application, Initiative } from '../../types';
import { usePlatformStore, store } from '../../store/state';
import { ProcessTracker } from './ProcessTracker';
import { ApiException } from '../../api/client';
import {
  CheckCircle2,
  RotateCcw,
  XCircle,
  AlertCircle,
  FileText,
  Building2,
  Clock,
  ShieldCheck,
  Check,
  Eye,
  Scale,
  AlertTriangle,
  Route,
  Loader2,
  Mail,
} from 'lucide-react';
import { InteractiveTimeline } from '../factory/InteractiveTimeline';
import { MessagesPanel } from '../common/MessagesPanel';
import { Badge } from '../ui/Badge';
import { printReport, escapeHtml } from '../../utils/reports';
import { api } from '../../api';
import { Modal } from '../ui/Modal';

interface ApplicationReviewModalProps {
  application: Application;
  onClose: () => void;
}

export const ApplicationReviewModal: React.FC<ApplicationReviewModalProps> = ({
  application,
  onClose
}) => {
  const {
    initiatives,
    currentUser,
    language,
  } = usePlatformStore();

  const isAr = language === 'ar';
  const initiative = initiatives.find(i => i.id === application.initiativeId) || initiatives[0];
  // Factory files come from the API (no static store data).
  const [factoryDetailsFiles, setFactoryDetailsFiles] = useState<Array<Record<string, any>>>([]);
  useEffect(() => {
    let cancelled = false;
    api.listDetailsFiles(application.factoryId, application.initiativeId)
      .then(r => { if (!cancelled) setFactoryDetailsFiles(r.data ?? []); })
      .catch(() => { if (!cancelled) setFactoryDetailsFiles([]); });
    return () => { cancelled = true; };
  }, [application.factoryId, application.initiativeId]);

  // صاحب القرار يبدأ من بيانات الطلب؛ غيره (الإدارة في وضع المتابعة / الجهات السابقة / المدقق) يبدأ من «متابعة المسار».
  const canDecide = application.viewerCanDecide === true;
  const allowed = application.allowedActions ?? [];
  const [activeTab, setActiveTab] = useState<'process' | 'details' | 'documents' | 'timeline' | 'messages'>(canDecide ? 'details' : 'process');
  const [comments, setComments] = useState('');
  const [busyAction, setBusyAction] = useState<'approve' | 'request_rework' | 'reject' | 'escalate' | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ title: string; fileName: string; fileUrl?: string } | null>(null);

  const handleExecuteDecision = async (action: 'approve' | 'request_rework' | 'reject' | 'escalate') => {
    if (!comments.trim() && (action === 'request_rework' || action === 'reject' || action === 'escalate')) {
      setDecisionError(isAr ? 'يرجى كتابة سبب القرار (أو المستندات المطلوبة / سبب التصعيد) في خانة الملاحظات.' : 'Please provide a justification comment.');
      return;
    }
    setDecisionError('');
    setBusyAction(action);
    try {
      await api.createDecision(application.id, { action, comments: comments.trim() });
      // حدّث القائمة ولوحات المتابعة فوراً (المرحلة والجهة تغيرت).
      await store.reloadAll();
      onClose();
    } catch (err) {
      setDecisionError(err instanceof ApiException
        ? (isAr ? err.apiError.messageAr : err.apiError.messageEn)
        : (isAr ? 'تعذر تسجيل القرار.' : 'Decision failed.'));
    } finally {
      setBusyAction(null);
    }
  };

  const modalTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md)', background: 'var(--gov-primary-900)', color: 'var(--gov-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Scale size={20} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gov-primary-900)' }}>
            {application.applicationNumber}
          </div>
          <Badge tone="draft">
            {isAr ? application.currentStageNameAr : application.currentStageNameEn}
          </Badge>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {isAr ? application.factoryNameAr : application.factoryNameEn} • {isAr ? application.initiativeTitleAr : application.initiativeTitleEn}
        </div>
      </div>
    </div>
  );

  const printBar = (
    <div style={{ display: 'flex', gap: '0.6rem', padding: '0.6rem 1.5rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => printReport(
        `تقرير الطلب ${application.applicationNumber}`,
        `Application Report ${application.applicationNumber}`,
        `<div><span class="kpi">${isAr ? 'المصنع' : 'Factory'}: ${escapeHtml(application.factoryNameAr)}</span><span class="kpi">${isAr ? 'المبادرة' : 'Initiative'}: ${escapeHtml(application.initiativeTitleAr)}</span><span class="kpi">${isAr ? 'المرحلة' : 'Stage'}: ${escapeHtml(application.currentStageNameAr)}</span><span class="kpi">${isAr ? 'الحالة' : 'Status'}: ${escapeHtml(application.status)}</span><span class="kpi">PDF: ${factoryDetailsFiles.length}</span></div><br/><table><thead><tr><th>${isAr ? 'البند' : 'Field'}</th><th>${isAr ? 'القيمة' : 'Value'}</th></tr></thead><tbody>${Object.entries(application.formData).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`).join('')}${(application.documents || []).map(d => `<tr><td>${escapeHtml(d.titleAr || d.fileName)}</td><td>${escapeHtml(d.fileName)} — ${escapeHtml(d.status)}</td></tr>`).join('')}${factoryDetailsFiles.map(f => `<tr><td>PDF — ${escapeHtml(f.fileName)}</td><td>${escapeHtml(f.description)} — ${escapeHtml(f.fileSize)}</td></tr>`).join('')}</tbody></table>`,
        isAr
      )}>
        <Eye size={14} />
        <span>{isAr ? 'طباعة / PDF للطلب' : 'Print / PDF'}</span>
      </button>
    </div>
  );

  const tabNav = (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)', padding: '0 1.5rem' }}>
      {[
        { id: 'process', labelAr: 'متابعة المسار', labelEn: 'Process Tracking' },
        { id: 'details', labelAr: 'بيانات الطلب والنموذج', labelEn: 'Application Data' },
        { id: 'documents', labelAr: `المستندات المرفقة (${factoryDetailsFiles.length})`, labelEn: `Documents (${factoryDetailsFiles.length})` },
        { id: 'timeline', labelAr: 'الخط الزمني وسجل الإجراءات', labelEn: 'Timeline History' },
        { id: 'messages', labelAr: 'مراسلات الجهات', labelEn: 'Entity Messages' }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          style={{
            padding: '0.85rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: activeTab === tab.id ? 700 : 500,
            color: activeTab === tab.id ? 'var(--gov-primary-900)' : 'var(--text-muted)',
            borderBottom: activeTab === tab.id ? '3px solid var(--gov-primary-800)' : 'none',
            background: 'none'
          }}
        >
          {isAr ? tab.labelAr : tab.labelEn}
        </button>
      ))}
    </div>
  );

  const detailsTab = (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,200px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'الجهة المسؤولة حالياً' : 'Assigned Entity'}</div>
          <div style={{ fontWeight: 700, color: 'var(--gov-primary-900)', marginTop: '0.2rem' }}>{application.currentAssignedOrgNameAr}</div>
        </div>

        <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'حالة مدة الخدمة (SLA)' : 'SLA Status'}</div>
          <div style={{ fontWeight: 700, color: application.isSlaViolated ? 'var(--status-rejected)' : 'var(--status-approved-text)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={14} />
            <span>{isAr
              ? `${application.daysSpentInStage ?? 0} من ${application.slaDays} يوم${application.isSlaViolated ? ' — متأخر' : ''}`
              : `${application.daysSpentInStage ?? 0} of ${application.slaDays} days${application.isSlaViolated ? ' — overdue' : ''}`}</span>
          </div>
        </div>

        {application.systemCapacityKW && (
          <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'القدرة الشمسية المطلوبة' : 'Requested PV Capacity'}</div>
            <div style={{ fontWeight: 800, color: 'var(--gov-teal)', marginTop: '0.2rem' }}>{application.systemCapacityKW} kWp</div>
          </div>
        )}

        {application.requestedFinancingAmountEGP && (
          <div style={{ background: 'var(--bg-app)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'مبلغ التمويل التقديري' : 'Estimated Loan'}</div>
            <div style={{ fontWeight: 800, color: 'var(--gov-gold-dark)', marginTop: '0.2rem' }}>
              {application.requestedFinancingAmountEGP.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}
            </div>
          </div>
        )}
      </div>

      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.85rem' }}>
        {isAr ? 'بيانات النموذج الديناميكي المستوفاة من المصنع:' : 'Submitted Dynamic Form Values:'}
      </h4>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px), 1fr))', gap: '1.5rem' }}>
        {Object.entries(application.formData).map(([key, val]) => (
          <div key={key} style={{ padding: '0.75rem 1rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {key.replace(/([A-Z])/g, ' $1')}
            </div>
            <div style={{ fontWeight: 600, color: 'var(--gov-primary-900)', marginTop: '0.2rem' }}>
              {typeof val === 'boolean' ? (val ? 'نعم' : 'لا') : String(val)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const documentsTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)' }}>
        {isAr ? 'المستندات الرسمية للطلب' : 'Application documents'}
      </h4>
      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)', marginTop: '0.5rem' }}>
        {isAr ? `ملفات التفاصيل المرفوعة من المصنع (${factoryDetailsFiles.length})` : `Factory details files (${factoryDetailsFiles.length})`}
      </h4>
      {factoryDetailsFiles.length === 0 && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
          {isAr ? 'لا توجد ملفات تفاصيل مرتبطة بهذه المبادرة.' : 'No details files linked to this initiative.'}
        </div>
      )}
      {factoryDetailsFiles.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-medium)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Building2 size={18} style={{ color: 'var(--gov-gold-dark)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--gov-primary-900)' }}>{f.fileName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.description} • {f.fileSize} • {new Date(f.uploadedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
            </div>
          </div>
          <Badge tone="pending">{isAr ? 'ملف مصنع' : f.status}</Badge>
        </div>
      ))}
    </div>
  );

  const closed = application.status === 'completed' || application.status === 'rejected';
  const isOfficial = currentUser.role === 'ministry_admin' || currentUser.role === 'initiative_manager';
  const stageNo = application.currentStageOrder && application.totalStages
    ? (isAr ? ` — المرحلة ${application.currentStageOrder} من ${application.totalStages}` : ` — stage ${application.currentStageOrder} of ${application.totalStages}`)
    : '';

  const decisionBar = (
    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '1.1rem 1.5rem 1.25rem', background: 'var(--bg-surface)' }}>
      {!canDecide ? (
        <div style={{ padding: '0.9rem 1.1rem', background: 'var(--gov-primary-50)', border: '1px solid var(--gov-primary-200)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--gov-primary-900)' }}>
          {closed ? <ShieldCheck size={20} style={{ color: 'var(--gov-primary-700)', flexShrink: 0 }} /> : <Route size={20} style={{ color: 'var(--gov-primary-700)', flexShrink: 0 }} />}
          <div style={{ fontSize: '0.85rem', lineHeight: 1.6, flex: 1 }}>
            {closed ? (
              <><b>{isAr ? 'الطلب مغلق: ' : 'Closed: '}</b>{application.status === 'completed' ? (isAr ? 'اكتمل المسار بجميع مراحله.' : 'all stages approved.') : (isAr ? 'تم رفض الطلب.' : 'the application was rejected.')}</>
            ) : isOfficial ? (
              <><b>{isAr ? 'دورك المتابعة: ' : 'You are monitoring: '}</b>{isAr
                ? `الطلب الآن لدى «${application.currentAssignedOrgNameAr}»${stageNo}. القرار في هذه المرحلة للجهة المختصة، وقرار الإدارة في «المراجعة الأولية» فقط.`
                : `the application is with ${application.currentAssignedOrgNameEn || application.currentAssignedOrgNameAr}${stageNo}. Only that organization decides this stage.`}</>
            ) : (
              <><b>{isAr ? 'اطلاع فقط: ' : 'View only: '}</b>{isAr
                ? `الطلب الآن لدى «${application.currentAssignedOrgNameAr}»${stageNo}.`
                : `the application is with ${application.currentAssignedOrgNameEn || application.currentAssignedOrgNameAr}${stageNo}.`}</>
            )}
          </div>
          {activeTab !== 'process' && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('process')}>
              <Route size={14} />
              <span>{isAr ? 'متابعة المسار' : 'Track process'}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={18} style={{ color: 'var(--gov-gold-dark)' }} />
            <span>{isAr ? `قرار جهتكم في مرحلة «${application.currentStageNameAr}»` : `Your decision — ${application.currentStageNameEn || application.currentStageNameAr}`}</span>
          </h4>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <textarea
              className="form-control"
              rows={3}
              placeholder={isAr ? 'ملاحظات القرار — إجبارية للرفض والاستيفاء والتصعيد...' : 'Decision notes (required for reject / rework / escalate)...'}
              value={comments}
              onChange={e => { setComments(e.target.value); setDecisionError(''); }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--gov-primary-700)' }}>
              <Mail size={13} />
              <span>{isAr
                ? 'ستصل هذه الملاحظات للمنشأة ضمن إشعار البريد الرسمي مع القرار (عدا التصعيد فهو داخلي) — اكتبها بصياغة موجهة للمنشأة.'
                : 'These notes are emailed to the factory with the decision (except escalations, which stay internal).'}</span>
            </div>
          </div>
          {decisionError && (
            <div className="error-box" style={{ marginBottom: '0.75rem' }}>{decisionError}</div>
          )}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {allowed.includes('escalate') && (
              <button className="btn btn-secondary" disabled={!!busyAction} onClick={() => handleExecuteDecision('escalate')}
                title={isAr ? 'تنبيه الإدارة بمشكلة — يبقى القرار لدى جهتكم' : 'Alert the officials — the decision stays with you'}>
                {busyAction === 'escalate' ? <Loader2 size={16} className="chat-spin" /> : <AlertTriangle size={16} />}
                <span>{isAr ? 'تنبيه الوزارة (تصعيد)' : 'Alert ministry (escalate)'}</span>
              </button>
            )}
            {allowed.includes('reject') && (
              <button className="btn btn-secondary" disabled={!!busyAction} style={{ color: 'var(--gov-crimson)', borderColor: 'var(--gov-crimson-border)' }} onClick={() => handleExecuteDecision('reject')}>
                {busyAction === 'reject' ? <Loader2 size={16} className="chat-spin" /> : <XCircle size={16} />}
                <span>{isAr ? 'رفض مسبب' : 'Reject'}</span>
              </button>
            )}
            {allowed.includes('request_rework') && (
              <button className="btn btn-gold" disabled={!!busyAction} onClick={() => handleExecuteDecision('request_rework')}>
                {busyAction === 'request_rework' ? <Loader2 size={16} className="chat-spin" /> : <RotateCcw size={16} />}
                <span>{isAr ? 'طلب استيفاء من المصنع' : 'Request rework'}</span>
              </button>
            )}
            {allowed.includes('approve') && (
              <button className="btn btn-primary" disabled={!!busyAction} style={{ background: 'var(--status-approved-text)', borderColor: 'var(--status-approved-text)' }} onClick={() => handleExecuteDecision('approve')}>
                {busyAction === 'approve' ? <Loader2 size={16} className="chat-spin" /> : <CheckCircle2 size={18} />}
                <span>{application.currentStageOrder && application.totalStages && application.currentStageOrder >= application.totalStages
                  ? (isAr ? 'اعتماد نهائي وإغلاق المسار' : 'Final approval')
                  : (isAr ? 'اعتماد والإحالة للمرحلة التالية' : 'Approve & route to next stage')}</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <Modal onClose={onClose} maxWidth="1050px" title={modalTitle}>
      {printBar}
      {tabNav}
      <div className="modal-body" style={{ padding: '1.5rem' }}>
        {activeTab === 'process' && <ProcessTracker application={application} />}
        {activeTab === 'details' && detailsTab}
        {activeTab === 'documents' && documentsTab}
        {activeTab === 'timeline' && (
          <InteractiveTimeline
            timeline={application.timeline}
            stages={initiative.workflow.stages}
            currentStageId={application.currentStageId}
          />
        )}
        {activeTab === 'messages' && (
          <MessagesPanel applicationId={application.id} />
        )}
      </div>
      {decisionBar}
      {previewDoc && (
        <Modal onClose={() => setPreviewDoc(null)} maxWidth="800px" title={previewDoc.title}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'start' }}>{previewDoc.fileName}</div>
            {previewDoc.fileUrl ? (
              previewDoc.fileUrl.startsWith('data:image') || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(previewDoc.fileName) ? (
                <img src={previewDoc.fileUrl} alt="" style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }} />
              ) : (
                <iframe title={previewDoc.fileName} src={previewDoc.fileUrl} style={{ width: '100%', height: '60vh', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }} />
              )
            ) : (
              <div style={{ padding: '1rem', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--text-body)' }}>
                {isAr
                  ? 'الملف الأصلي محفوظ في أرشيف المنصة (تخزين الباك إند). اربط fileUrl للمستند لعرض محتواه هنا مباشرة.'
                  : 'Original file is stored in the platform archive (backend storage). Attach a fileUrl to render its content here.'}
              </div>
            )}
          </div>
        </Modal>
      )}
    </Modal>
  );
};
