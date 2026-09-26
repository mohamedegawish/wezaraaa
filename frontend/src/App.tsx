import React, { useEffect } from 'react';
import { usePlatformStore, store } from './store/state';
import { ToastProvider, useToast } from './components/common/ToastSystem';
import { HeaderNavbar } from './components/layout/HeaderNavbar';
import { HomeView } from './components/showcase/HomeView';
import { InitiativesView } from './components/showcase/InitiativesView';
import { InitiativeDetailPage } from './components/showcase/InitiativeDetailPage';
import { CompareView } from './components/showcase/CompareView';
import { ImpactView } from './components/showcase/ImpactView';
import { FactoryApplicationsView } from './components/factory/FactoryApplicationsView';
import { MyInitiativesView } from './components/factory/MyInitiativesView';
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { InitiativesAdminView } from './components/admin/initiatives/InitiativesAdminView';
import { InitiativeWorkspace } from './components/admin/initiatives/InitiativeWorkspace';
import { AdminStatsView } from './components/admin/AdminStatsView';
import { ReportsStudioView } from './components/admin/ReportsStudioView';
import { ApplicationsTableView } from './components/admin/ApplicationsTableView';
import { VisualWorkflowEditor } from './components/admin/VisualWorkflowEditor';
import { OrganizationsView } from './components/admin/OrganizationsView';
import { AccountsView } from './components/admin/AccountsView';
import { AuditLogsView } from './components/admin/AuditLogsView';
import { AdminLayout } from './components/admin/AdminLayout';
import { MinistryOverviewView } from './components/admin/MinistryOverviewView';
import { LoginView } from './components/auth/LoginView';
import { ShieldCheck, ShieldAlert, ArrowRight, ArrowLeft } from 'lucide-react';
import { EgyptianEagle } from './components/common/EgyptianEagle';
import { ChatWidget } from './components/chatbot/ChatWidget';
import { ChatCenterView } from './components/chat/ChatCenterView';
import { ChatNotifier } from './components/chat/ChatNotifier';

// Inner app content (needs toasts from context)
const AppContent: React.FC = () => {
  const { toast } = useToast();
  const { activeView, language, isViewAllowed, currentUser, navigate, getDefaultView } = usePlatformStore();
  const isAr = language === 'ar';

  // Bootstrap store from the API on first render
  useEffect(() => { void store.init(); }, []);

  // Show a welcome toast on first load
  useEffect(() => {
    if (!localStorage.getItem('egypt_ind_welcomed')) {
      localStorage.setItem('egypt_ind_welcomed', '1');
      setTimeout(() => {
        toast('info', isAr ? 'مرحباً بك في المنصة الوطنية للتمويل والمبادرات الصناعية — جمهورية مصر العربية' : 'Welcome to the National Platform for Industrial Financing & Initiatives — Arab Republic of Egypt');
      }, 800);
    }
  }, [toast, isAr]);

  const isCurrentViewAllowed = isViewAllowed(activeView, currentUser);
  // مركز المراسلات (chat) يعيش داخل AdminLayout أيضاً — نفس وضع الإدارة (بلا فوتر).
  const isAdminView = activeView.startsWith('admin-') || activeView === 'chat';

  return (
    <div className={`app-container${isAdminView ? ' admin-mode' : ''}`}>
      {/* 1. Official Government Header */}
      <HeaderNavbar />

      {/* 2. Main View Router with Access Control Guard */}
      <main className="main-content">
        {!isCurrentViewAllowed ? (
          <div className="container-custom" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
            <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2.5rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--status-rejected-bg)', color: 'var(--status-rejected)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                <ShieldAlert size={32} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                {isAr ? 'الوصول مقيد' : 'Access Restricted'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {isAr 
                  ? `الدور الحالي الخاص بك (${currentUser.roleTitleAr} - ${currentUser.organizationNameAr}) لا يملك صلاحية للوصول إلى هذا القسم.`
                  : `Your current role (${currentUser.roleTitleEn}) does not have permission to access this view.`}
              </p>
              <button 
                className="btn btn-primary"
                onClick={() => navigate(getDefaultView(currentUser))}
              >
                <span>{isAr ? 'الانتقال إلى مساحة العمل المصرح لك بها' : 'Go to Authorized Workspace'}</span>
                {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeView === 'login' && <LoginView />}
            {/* home/showcase = الصفحة التعريفية العامة (showcase alias قديم لـhome) */}
            {(activeView === 'home' || activeView === 'showcase') && <HomeView />}
            {activeView === 'initiatives' && <InitiativesView />}
            {activeView === 'initiative-detail' && <InitiativeDetailPage />}
            {activeView === 'my-initiatives' && <MyInitiativesView />}
            {activeView === 'compare' && <CompareView />}
            {/* impact = "الأثر الوطني" صفحة سيادية ADMIN ONLY — محمية ببوابة
                isCurrentViewAllowed (سطر 39) التي تستخدم isViewAllowed()
                من store/state.ts ولا تسمح بالوصول سوى للأدمن */}
            {activeView === 'impact' && <ImpactView />}
            {activeView === 'factory-portal' && <FactoryApplicationsView />}
            {activeView === 'admin-dashboard' && <AdminLayout><AdminDashboardView /></AdminLayout>}
            {activeView === 'admin-initiatives' && <AdminLayout><InitiativesAdminView /></AdminLayout>}
            {activeView === 'admin-initiative' && <AdminLayout><InitiativeWorkspace /></AdminLayout>}
            {activeView === 'admin-stats' && <AdminLayout><AdminStatsView /></AdminLayout>}
            {activeView === 'admin-applications' && <AdminLayout><ApplicationsTableView /></AdminLayout>}
            {activeView === 'admin-workflow-builder' && <AdminLayout><VisualWorkflowEditor /></AdminLayout>}
            {activeView === 'admin-organizations' && <AdminLayout><OrganizationsView /></AdminLayout>}
            {activeView === 'admin-accounts' && <AdminLayout><AccountsView /></AdminLayout>}
            {activeView === 'admin-audit-logs' && <AdminLayout><AuditLogsView /></AdminLayout>}
            {activeView === 'admin-reports' && <AdminLayout><ReportsStudioView /></AdminLayout>}
            {activeView === 'ministry-overview' && <AdminLayout><MinistryOverviewView /></AdminLayout>}
            {/* مركز المراسلات: المسؤولون ↔ الجهات (المصانع ممنوعة عبر ROLE_PERMISSIONS + الباك) */}
            {activeView === 'chat' && <AdminLayout><ChatCenterView /></AdminLayout>}
          </>
        )}
      </main>

      {/* 3. Official Government Footer — مخفي في وضع الإدارة لتوفير المساحة */}
      {!isAdminView && (
        <footer style={{ background: '#070B14', color: '#94A3B8', padding: '2.5rem 0 1.5rem 0', position: 'relative', borderTop: '1px solid #1E293B' }}>
        {/* Top flag ribbon */}
        <div style={{ height: '4px', width: '100%', background: 'var(--egypt-flag-ribbon)' }} />
        <div style={{ padding: '1.25rem 0 1.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="container-custom">
            <div className="footer-brand-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <EgyptianEagle size={34} />
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {isAr ? 'المنصة الوطنية للتمويل والمبادرات الصناعية' : 'National Platform for Industrial Financing & Initiatives'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    {isAr ? 'وزارة الصناعة — جمهورية مصر العربية' : 'Ministry of Industry — Arab Republic of Egypt'}
                  </div>
                </div>
              </div>

              <div className="footer-links-row" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#CBD5E1' }}>
                  <span>{isAr ? 'هيئة التنمية الصناعية (IDA)' : 'IDA Authority'}</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span>{isAr ? 'مركز تحديث الصناعة (IMC)' : 'IMC Center'}</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span>{isAr ? 'القطاع المصرفي المصري' : 'Egyptian Banking Sector'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container-custom">
          <div className="footer-copyright-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748B', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '1rem' }}>
            <div>
              © 2026 {isAr ? 'جميع الحقوق محفوظة لوزارة الصناعة المصرية.' : 'All rights reserved to the Egyptian Ministry of Industry.'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94A3B8' }}>
              <ShieldCheck size={14} style={{ color: '#C8102E' }} />
              <span>{isAr ? 'جمهورية مصر العربية' : 'Arab Republic of Egypt'}</span>
            </div>
          </div>
        </div>
      </footer>
      )}

      {/* إشعارات مركز المراسلات (polling + toast + desktop + عداد العنوان) */}
      <ChatNotifier />

      {/* 4. Floating platform assistant — every page except the message center (avoids two «chats» + covering the composer) */}
      {activeView !== 'chat' && <ChatWidget />}
    </div>
  );
};

// Root app wraps content in ToastProvider so every component can call useToast()
export const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);
