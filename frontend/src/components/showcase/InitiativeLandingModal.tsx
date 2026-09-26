import React, { useState } from 'react';
import { Initiative, DEFAULT_CUSTOMIZATION } from '../../types';
import { usePlatformStore } from '../../store/state';
import {
  X,
  Landmark,
  Gauge,
  CheckCircle2,
  HelpCircle,
  FileText,
  Layers,
  ArrowLeft,
  ArrowRight,
  Clock,
  ShieldCheck,
  Building2,
  Percent,
  Download
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { STAGE_COLORS } from '../../utils/theme';
import { formatBillions } from '../../utils/format';

interface InitiativeLandingModalProps {
  initiative: Initiative;
  onClose: () => void;
  onOpenPreEligibility: () => void;
  onApplyDirect: () => void;
}

export const InitiativeLandingModal: React.FC<InitiativeLandingModalProps> = ({
  initiative,
  onClose,
  onOpenPreEligibility,
  onApplyDirect
}) => {
  const { language } = usePlatformStore();
  const isAr = language === 'ar';
  const custom = { ...DEFAULT_CUSTOMIZATION, ...(initiative.customization || {}) };
  const visibleTabs = ([
    { id: 'overview', labelAr: 'نظرة عامة والجهات', labelEn: 'Overview & Partners' },
    ...(custom.showBenefits ? [{ id: 'benefits', labelAr: 'الحوافز والمزايا', labelEn: 'Incentives & Benefits' }] : []),
    ...(custom.showTimeline ? [{ id: 'workflow', labelAr: 'خريطة مسار العمل (Roadmap)', labelEn: 'Workflow Roadmap' }] : []),
    { id: 'docs', labelAr: 'المستندات المطلوبة', labelEn: 'Required Documents' },
    ...(custom.showFaqs ? [{ id: 'faqs', labelAr: 'الأسئلة الشائعة', labelEn: 'FAQs' }] : []),
  ] as { id: 'overview' | 'benefits' | 'workflow' | 'docs' | 'faqs'; labelAr: string; labelEn: string }[]);
  const [activeTab, setActiveTab] = useState<'overview' | 'benefits' | 'workflow' | 'docs' | 'faqs'>('overview');
  const safeTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : 'overview';

  const modalHeader = (
    <div style={{ background: 'var(--egypt-black)', color: 'var(--on-dark)', padding: '1.25rem 1.5rem', position: 'relative' }}>
      <button
        onClick={onClose}
        className="btn-ghost-on-dark"
        style={{
          position: 'absolute',
          top: '0.75rem',
          left: isAr ? '0.75rem' : 'auto',
          right: isAr ? 'auto' : '0.75rem',
          borderRadius: '50%',
          padding: '0.4rem'
        }}
      >
        <X size={20} />
      </button>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--gov-gold-light)', color: 'var(--egypt-gold-deep)', border: '1px solid var(--gov-gold-border)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
        <Landmark size={14} />
        <span>{isAr ? initiative.badgeTextAr : initiative.badgeTextEn}</span>
      </div>

      <div style={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.4rem' }}>
        {isAr ? initiative.titleAr : initiative.titleEn}
      </div>

      <p style={{ color: 'var(--on-dark-softer)', fontSize: '0.925rem', lineHeight: 1.6, maxWidth: '780px' }}>
        {isAr ? initiative.taglineAr : initiative.taglineEn}
      </p>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        {custom.enablePreEligibility && (
          <button
            className="btn btn-gold"
            onClick={() => { onClose(); onOpenPreEligibility(); }}
          >
            <Gauge size={16} />
            <span>{isAr ? 'فحص الأهلية الفوري (حاسبة سريعة)' : 'Instant Pre-Eligibility Quiz'}</span>
          </button>
        )}

        <button
          className="btn btn-primary"
          style={{ background: 'var(--on-dark-ghost-2)', border: '1px solid var(--on-dark-border-3)' }}
          onClick={() => { onClose(); onApplyDirect(); }}
        >
          <span>{isAr ? 'التقديم المباشر للطلب' : 'Direct Apply'}</span>
          {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );

  const tabNav = (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)', padding: '0 1.5rem', overflowX: 'auto' }}>
      {visibleTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          className={`tab-btn ${safeTab === tab.id ? 'active' : ''}`}
          style={{ background: 'none', whiteSpace: 'nowrap' }}
        >
          {isAr ? tab.labelAr : tab.labelEn}
        </button>
      ))}
    </div>
  );

  const overviewTab = (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.5rem' }}>
          {isAr ? 'عن المبادرة والأهداف الوطنية' : 'About the National Initiative'}
        </h4>
        <p style={{ color: 'var(--text-body)', fontSize: '0.925rem', lineHeight: 1.7 }}>
          {isAr ? initiative.descriptionAr : initiative.descriptionEn}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div className="emblem-accent" style={{ marginBottom: '0.5rem' }}>
            <Percent size={12} />
            <span>{isAr ? 'إجمالي المخصصات المالية' : 'Total Budget'}</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--gov-gold-bright)', marginTop: '0.25rem', fontFamily: 'var(--eng-font-mono)' }}>
            {formatBillions(initiative.budgetTotalEGP, isAr)} {isAr ? 'مليار جنيه' : 'Billion EGP'}
          </div>
        </div>

        <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>{isAr ? 'القطاعات الصناعية المستهدفة' : 'Target Sectors'}</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--gov-primary-800)', marginTop: '0.25rem' }}>
            {isAr ? (initiative.targetSectors ?? []).join('، ') : (initiative.targetSectorsEn ?? []).join(', ')}
          </div>
        </div>

      </div>

      {custom.showPartners && (
        <div>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.75rem' }}>
            {isAr ? 'الجهات الشريكة والمسؤولة' : 'Participating Agencies & Partners'}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {initiative.participatingOrgs?.map((org, i) => (
              <span key={i} style={{ background: 'var(--gov-primary-100)', color: 'var(--gov-primary-900)', padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Building2 size={14} />
                {org}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const benefitsTab = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px), 1fr))', gap: '1.5rem' }}>
      {initiative.benefits?.map((benefit, i) => (
        <div key={i} style={{ padding: '1.25rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'var(--gov-primary-900)', color: 'var(--gov-gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <Percent size={20} />
          </div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.35rem' }}>
            {isAr ? benefit.titleAr : benefit.titleEn}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: 1.6 }}>
            {isAr ? benefit.descriptionAr : benefit.descriptionEn}
          </p>
        </div>
      ))}
    </div>
  );

  const workflowTab = (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        {isAr
          ? 'يمر طلب الانضمام بالمراحل المعتمدة التالية ويتم إسناد كل مرحلة لجهة حكومية أو بنك محدد وفق SLA زمني صارم:'
          : 'Applications flow through the following defined stages under strict SLAs:'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {initiative.workflow.stages.map((stage, idx) => {
          const stageColor = STAGE_COLORS[idx % STAGE_COLORS.length] ?? 'var(--stage-fallback)';
          const showConnector = idx < initiative.workflow.stages.length - 1;
          return (
            <div key={stage.id}>
              <div
                className="stage-node-eng"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: stageColor,
                      color: 'var(--on-dark)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1rem',
                      flexShrink: 0,
                      boxShadow: `0 0 0 3px var(--eng-paper), 0 0 0 4px ${stageColor}`
                    }}
                  >
                    {idx + 1}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--eng-ink)' }}>
                      {isAr ? stage.nameAr : stage.nameEn}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--eng-steel)', lineHeight: 1.5 }}>
                      {isAr ? stage.descriptionAr : stage.descriptionEn}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: isAr ? 'left' : 'right', flexShrink: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    <Clock size={12} />
                    <span className="num-ltr">{stage.slaDays} {isAr ? 'أيام عمل' : 'days'}</span>
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gov-primary-700)', fontWeight: 600, marginTop: '0.2rem' }}>
                    {stage.assignedOrgNameAr}
                  </div>
                </div>
              </div>
              {showConnector && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '0.25rem 0' }}>
                  <div style={{ width: '2px', height: '20px', background: 'var(--eng-line)', borderLeft: '1px dashed var(--eng-steel)' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const docsTab = (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {initiative.requiredDocsList?.map((doc, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderLeftWidth: '3px',
              borderLeftColor: doc.mandatory ? 'var(--egypt-gold)' : 'var(--text-muted)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <FileText size={18} style={{ color: 'var(--gov-primary-700)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gov-primary-900)' }}>
                {((isAr ? doc.titleAr : doc.titleEn) || doc.titleAr || '').trim()}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>#{idx + 1}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: doc.mandatory ? 'var(--text-main)' : 'var(--text-muted)' }}>
                {doc.mandatory ? (isAr ? 'إلزامي' : 'Mandatory') : (isAr ? 'اختياري' : 'Optional')}
              </span>
              {doc.mandatory && <CheckCircle2 size={14} style={{ color: 'var(--egypt-gold)' }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const faqsTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {initiative.faqs?.map((faq, idx) => (
        <div key={idx} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--gov-primary-900)', fontSize: '0.95rem', marginBottom: '0.4rem' }}>
            <HelpCircle size={16} style={{ color: 'var(--gov-gold-dark)' }} />
            <span>{isAr ? faq.questionAr : faq.questionEn}</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-body)', lineHeight: 1.6, paddingInlineStart: '1.4rem' }}>
            {isAr ? faq.answerAr : faq.answerEn}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <Modal onClose={onClose} maxWidth="950px" title={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--gov-primary-900)' }}>
            {isAr ? initiative.titleAr : initiative.titleEn}
          </div>
        </div>
      </div>
    }>
      <div className="flag-header-card" style={{ background: 'transparent' }}>
      {modalHeader}
      {tabNav}
      <div className="modal-body" style={{ padding: '1.75rem' }}>
        {safeTab === 'overview' && overviewTab}
        {safeTab === 'benefits' && benefitsTab}
        {safeTab === 'workflow' && workflowTab}
        {safeTab === 'docs' && docsTab}
        {safeTab === 'faqs' && faqsTab}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>
          {isAr ? 'إغلاق' : 'Close'}
        </button>
        {custom.enablePreEligibility && (
          <button
            className="btn btn-gold"
            onClick={() => { onClose(); onOpenPreEligibility(); }}
          >
            <Gauge size={16} />
            <span>{isAr ? 'فحص الأهلية' : 'Pre-Eligibility Check'}</span>
          </button>
        )}
        <button
          className="btn btn-sovereign btn-lg"
          style={{ flex: 1, background: 'var(--egypt-black)', color: 'var(--gov-gold-bright)' }}
          onClick={() => { onClose(); onApplyDirect(); }}
        >
          <span>{isAr ? 'التقديم الآن' : 'Apply Now'}</span>
          {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
        </button>
      </div>
      </div>
    </Modal>
  );
};
