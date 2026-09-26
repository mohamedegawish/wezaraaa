import React, { useState, useEffect } from 'react';
import { usePlatformStore, store } from '../../store/state';
import { useToast } from '../common/ToastSystem';
import { FactoryProfileView } from './FactoryProfileView';
import { Badge } from '../ui/Badge';
import { statusTone } from '../../utils/theme';
import { DynamicApplicationWizard } from './DynamicApplicationWizard';
import { InteractiveTimeline } from './InteractiveTimeline';
import { FactoryProfile, WorkflowStage } from '../../types';
import { api } from '../../api';
import { 
  Building2, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  ChevronRight,
  Layers,
  MapPin,
  LogIn
} from 'lucide-react';

export const FactoryApplicationsView: React.FC = () => {
  const {
    applications,
    currentUser,
    initiatives,
    language,
    navigate,
    selectedInitiativeId
  } = usePlatformStore();

  const isAr = language === 'ar';
  const { toast } = useToast();

  // ALL hooks first (Rules of Hooks) — guards only after the last hook call.
  // Current user's factory comes from the API (no static mapping).
  const [currentFactory, setCurrentFactory] = useState<FactoryProfile | null>(null);
  const [factoryLoading, setFactoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'apps' | 'profile'>('apps');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(store.selectedApplicationId ?? null);
  const [showApplyWizard, setShowApplyWizard] = useState<boolean>(!!selectedInitiativeId);
  const [wizardInitiativeId, setWizardInitiativeId] = useState<string>(selectedInitiativeId || initiatives[0]?.id || '');

  useEffect(() => {
    let cancelled = false;
    setFactoryLoading(true);
    api.getMyFactory()
      .then(r => { if (!cancelled) { setCurrentFactory(r.data as unknown as FactoryProfile); setFactoryLoading(false); } })
      .catch(() => { if (!cancelled) { setCurrentFactory(null); setFactoryLoading(false); } });
    return () => { cancelled = true; };
  }, [currentUser.id]);

  // Applications of this factory (empty until the factory resolves).
  const factoryApps = currentFactory ? applications.filter(a => a.factoryId === currentFactory.id) : [];

  // Default-select the first application once data arrives.
  useEffect(() => {
    if (selectedAppId === null && factoryApps.length > 0) {
      setSelectedAppId(factoryApps[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryApps.length]);

  // Deep-link «عرض حالتي» من مبادراتي: افتح الطلب المحدد مباشرة.
  const linkedAppId = store.selectedApplicationId ?? null;
  useEffect(() => {
    if (linkedAppId && linkedAppId !== selectedAppId) {
      setSelectedAppId(linkedAppId);
      setShowApplyWizard(false);
      setActiveTab('apps');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedAppId]);

  // Guards (after every hook call).
  if (!currentUser || currentUser.id === 'guest') {
    return (
      <div className="container-custom" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '560px', margin: '0 auto', padding: '2.5rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
            <LogIn size={30} style={{ color: 'var(--egypt-red)' }} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
            {isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please log in first'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            {isAr
              ? 'سجّل الدخول بحساب المصنع للتقديم على المبادرات ومتابعة طلباتك.'
              : 'Sign in with your factory account to apply for initiatives and track your applications.'}
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('login')}>
              <LogIn size={16} />
              <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('initiatives')}>
              <Layers size={16} />
              <span>{isAr ? 'استعرض المبادرات' : 'Browse Initiatives'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (factoryLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{isAr ? 'جارٍ تحميل بيانات المنشأة...' : 'Loading factory profile...'}</div>;
  }
  if (!currentFactory) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{isAr ? 'لا توجد منشأة مرتبطة بحسابك.' : 'No factory is linked to your account.'}</div>;
  }

  const activeApp = applications.find(a => a.id === selectedAppId);
  // المبادرة قد لا تكون في القائمة (مؤرشفة/مسودة مخفية عن غير الإدارة) — نبني المراحل من مسار الطلب نفسه
  // بدل السقوط على أول مبادرة (كان يعرض مراحل مبادرة أخرى).
  const activeAppInitiative = initiatives.find(i => i.id === activeApp?.initiativeId);
  const activeStages: WorkflowStage[] = activeAppInitiative?.workflow?.stages
    ?? (activeApp?.stageTrack ?? []).map(t => ({
      id: t.stageId, order: t.order, code: t.code, nameAr: t.nameAr, nameEn: t.nameEn,
      assignedOrgId: t.orgId, assignedOrgNameAr: t.orgNameAr, assignedRole: 'ministry_admin' as const,
      slaDays: 0, requiredDocuments: [], canReject: false, canRequestRework: false, colorCode: '',
    }));

  const wizardInitiative = initiatives.find(i => i.id === wizardInitiativeId) || initiatives[0];

  if (showApplyWizard) {
    return (
      <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
        <DynamicApplicationWizard
          initiative={wizardInitiative}
          factory={currentFactory}
          onSuccess={async (newAppId) => {
            setShowApplyWizard(false);
            setSelectedAppId(newAppId);
            setActiveTab('apps');
            // التسجيل يضيف المبادرة لمبادراتي تلقائياً: حدّث البيانات ثم افتح الصفحة.
            try { await store.reloadAll(); } catch { /* ignore */ }
            toast('success', isAr ? 'تم تسجيل طلبك بنجاح — تجده الآن في مبادراتي، ويمكنك التسجيل في مبادرة أخرى من صفحة المبادرات.' : 'Application submitted — find it in My Initiatives. You can apply to another from Initiatives.');
            navigate('my-initiatives');
          }}
          onCancel={() => setShowApplyWizard(false)}
        />
      </div>
    );
  }

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', borderBottom: '3px solid var(--border-subtle, #e2e8f0)' }}>
        <button 
          onClick={() => setActiveTab('apps')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.85rem 1.5rem',
            fontSize: '1rem', fontWeight: activeTab === 'apps' ? 700 : 500,
            color: activeTab === 'apps' ? '#fff' : 'var(--text-secondary, #64748b)',
            background: activeTab === 'apps' ? 'linear-gradient(135deg, var(--egypt-red) 0%, var(--egypt-red-dark) 100%)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'apps' ? '3px solid var(--egypt-red-dark)' : '3px solid transparent',
            borderRadius: activeTab === 'apps' ? '10px 10px 0 0' : '10px 10px 0 0',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            marginBottom: '-3px',
            boxShadow: activeTab === 'apps' ? '0 -2px 12px rgba(200,16,46,0.2)' : 'none',
          }}
        >
          <FileText size={19} />
          <span>{isAr ? 'طلباتي ومتابعة المراحل' : 'My Applications & Tracking'} ({factoryApps.length})</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.85rem 1.5rem',
            fontSize: '1rem', fontWeight: activeTab === 'profile' ? 700 : 500,
            color: activeTab === 'profile' ? '#fff' : 'var(--text-secondary, #64748b)',
            background: activeTab === 'profile' ? 'linear-gradient(135deg, #c0392b, #e74c3c)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid #c0392b' : '3px solid transparent',
            borderRadius: activeTab === 'profile' ? '10px 10px 0 0' : '10px 10px 0 0',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            marginBottom: '-3px',
            boxShadow: activeTab === 'profile' ? '0 -2px 12px rgba(192,57,43,0.2)' : 'none',
          }}
        >
          <Building2 size={19} />
          <span>{isAr ? 'الملف الموحد للمنشأة' : 'Central Factory Profile'}</span>
        </button>
      </div>

      {/* Tab 1: Applications & Tracking */}
      {activeTab === 'apps' && (
        <div className="factory-split-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Applications List Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)' }}>
              {isAr ? 'قائمة طلبات المنشأة المقدمة:' : 'Submitted Applications:'}
            </h3>

            {factoryApps.map(app => {
              const isSelected = app.id === selectedAppId;

              return (
                <div 
                  key={app.id}
                  onClick={() => setSelectedAppId(app.id)}
                  className="card"
                  style={{
                    padding: '1.15rem',
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--gov-primary-800)' : '1px solid var(--border-subtle)',
                    background: isSelected ? 'var(--gov-primary-50)' : 'var(--bg-surface)',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {app.applicationNumber}
                    </span>
                    <Badge tone={statusTone(app.status)}>
                      {app.status === 'submitted' ? (isAr ? 'مقدم جديد' : 'Submitted') :
                       app.status === 'in_progress' || app.status === 'under_review' ? (isAr ? 'قيد المراجعة' : 'In Review') :
                       app.status === 'pending_documents' ? (isAr ? 'مطلوب تعديل' : 'Need Action') :
                       app.status === 'approved' ? (isAr ? 'معتمد' : 'Approved') : (isAr ? 'مكتمل' : 'Completed')}
                    </Badge>
                  </div>

                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.5rem', lineHeight: 1.35 }}>
                    {isAr ? app.initiativeTitleAr : app.initiativeTitleEn}
                  </h4>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--gov-primary-800)', fontWeight: 600, marginBottom: '0.35rem' }}>
                    <MapPin size={14} style={{ color: 'var(--gov-gold-dark)', flexShrink: 0 }} />
                    <span>{isAr ? app.currentStageNameAr : app.currentStageNameEn}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                    <span>{isAr ? 'الجهة المسؤولة:' : 'Assigned:'} {app.currentAssignedOrgNameAr}</span>
                    <span>{new Date(app.submittedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</span>
                  </div>
                </div>
              );
            })}

            {factoryApps.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {isAr ? 'لم تقدم هذه المنشأة أي طلبات بعد.' : 'No applications submitted yet.'}
                </p>
                <button className="btn btn-gold" onClick={() => setShowApplyWizard(true)}>
                  {isAr ? 'تقديم أول طلب الآن' : 'Submit First Application'}
                </button>
              </div>
            )}
          </div>

          {/* Active Application Detail & Interactive Timeline */}
          {activeApp ? (
            <div className="card">
              {/* Header */}
              <div className="card-header">
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isAr ? 'رقم الطلب الرسمي:' : 'Application ID:'} <span style={{ fontWeight: 700, color: 'var(--gov-primary-900)' }}>{activeApp.applicationNumber}</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gov-primary-900)', marginTop: '0.2rem' }}>
                    {isAr ? activeApp.initiativeTitleAr : activeApp.initiativeTitleEn}
                  </h3>
                </div>

                <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                  <Badge tone="gold">
                    <Clock size={12} />
                    <span>{isAr ? `مدة المرحلة الحالية: ${activeApp.slaDays} أيام عمل` : `Current stage: ${activeApp.slaDays} working days`}</span>
                  </Badge>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {isAr ? 'الجهة المعنية حالياً:' : 'Current Agency:'} <strong>{activeApp.currentAssignedOrgNameAr}</strong>
                  </div>
                </div>
              </div>

              {/* Status Alert Bar */}
              {activeApp.status === 'pending_documents' && (
                <div style={{ background: 'var(--status-rework-bg)', border: '1px solid var(--status-rework-bd)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <AlertCircle size={20} style={{ color: 'var(--status-rework-text)', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.875rem', color: 'var(--status-rework-text)' }}>
                    <strong>{isAr ? 'مطلوب إجراء من المصنع:' : 'Action Required from Factory:'}</strong> {isAr ? 'يرجى مراجعة ملاحظات لجنة التقييم وإعادة رفع المستند المطلوب لتسريع الاعتماد.' : 'Please review evaluator comments and update required files.'}
                  </div>
                </div>
              )}

              {/* Interactive Timeline */}
              <InteractiveTimeline
                timeline={activeApp.timeline}
                stages={activeStages}
                currentStageId={activeApp.currentStageId}
              />
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>{isAr ? 'اختر طلباً لعرض الخط الزمني وتفاصيل المراجعة.' : 'Select an application to view timeline.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Factory Profile */}
      {activeTab === 'profile' && (
        <FactoryProfileView factory={currentFactory} />
      )}
    </div>
  );
};
