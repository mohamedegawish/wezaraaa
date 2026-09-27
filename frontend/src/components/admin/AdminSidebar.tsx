import React, { useState } from 'react';
import { usePlatformStore } from '../../store/state';
import {
  TrendingUp,
  Activity,
  Crown,
  FileText,
  GitBranch,
  Building2,
  Users,
  ShieldAlert,
  ChevronsRight,
  ChevronsLeft,
  LayoutDashboard,
  MessagesSquare,
  Layers,
  Megaphone,
} from 'lucide-react';

interface Item {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ElementType;
  badge?: number;
}

const GROUPS: { titleAr: string; titleEn: string; items: Item[] }[] = [
  {
    titleAr: 'إدارة المبادرات', titleEn: 'Initiatives',
    items: [
      { id: 'admin-initiatives', labelAr: 'المبادرات', labelEn: 'Initiatives', icon: Layers },
      { id: 'admin-dashboard', labelAr: 'لوحة القيادة', labelEn: 'Dashboard', icon: TrendingUp },
      { id: 'admin-workflow-builder', labelAr: 'سير العمل', labelEn: 'Workflow', icon: GitBranch },
    ],
  },
  {
    titleAr: 'الطلبات والمراجعة', titleEn: 'Review',
    items: [
      { id: 'admin-applications', labelAr: 'الطلبات', labelEn: 'Applications', icon: FileText },
    ],
  },
  {
    titleAr: 'التواصل', titleEn: 'Communication',
    items: [
      { id: 'chat', labelAr: 'مركز المراسلات', labelEn: 'Message Center', icon: MessagesSquare },
    ],
  },
  {
    titleAr: 'واجهة المنصة', titleEn: 'Site content',
    items: [
      { id: 'admin-banners', labelAr: 'بانرات الرئيسية', labelEn: 'Home banners', icon: Megaphone },
    ],
  },
  {
    titleAr: 'الجهات والحسابات', titleEn: 'Directory',
    items: [
      { id: 'admin-organizations', labelAr: 'الجهات المسؤولة', labelEn: 'Organizations', icon: Building2 },
      { id: 'admin-accounts', labelAr: 'حسابات الجهات', labelEn: 'Accounts', icon: Users },
    ],
  },
  {
    titleAr: 'التقارير والتدقيق', titleEn: 'Oversight',
    items: [
      { id: 'admin-stats', labelAr: 'الإحصائيات', labelEn: 'Statistics', icon: Activity },
      { id: 'admin-reports', labelAr: 'التقارير', labelEn: 'Reports', icon: Crown },
      { id: 'admin-audit-logs', labelAr: 'سجل التدقيق', labelEn: 'Audit Log', icon: ShieldAlert },
    ],
  },
];

const STORAGE_KEY = 'egypt_ind_admin_sidebar_v1';

/** الشريط الجانبي للأدمن — تنقل عمودي مجمع بدل الزحام العلوي */
export const AdminSidebar: React.FC = () => {
  const { language, activeView, navigate, applications, initiatives, organizations, currentUser, chatUnread, isViewAllowed } = usePlatformStore();
  const isAr = language === 'ar';

  // كل جهة ترى الصفحات المسموحة لدورها فقط (ROLE_PERMISSIONS) — والمجموعة الفارغة تختفي.
  const groups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => isViewAllowed(item.id, currentUser)) }))
    .filter(g => g.items.length > 0);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed(c => {
      try { localStorage.setItem(STORAGE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  const counts: Record<string, number | undefined> = {
    'admin-applications': applications.length || undefined,
    'admin-initiatives': initiatives.length || undefined,
    'admin-organizations': organizations.length || undefined,
    chat: chatUnread?.total || undefined,
  };

  const CollapseIcon = collapsed
    ? (isAr ? ChevronsLeft : ChevronsRight)
    : (isAr ? ChevronsRight : ChevronsLeft);

  return (
    <aside className={`admin-sidebar${collapsed ? ' collapsed' : ''}`} aria-label={isAr ? 'القائمة الجانبية للإدارة' : 'Admin sidebar'}>
      <div className="admin-side-head">
        <span className="admin-side-brand">
          <LayoutDashboard size={16} />
          {!collapsed && <span>{isAr ? 'الإدارة' : 'Admin'}</span>}
        </span>
        <button type="button" className="btn btn-secondary btn-sm admin-side-toggle" onClick={toggle}
          title={collapsed ? (isAr ? 'توسيع' : 'Expand') : (isAr ? 'طي' : 'Collapse')} aria-label={isAr ? 'طي/توسيع القائمة' : 'Collapse/expand'}>
          <CollapseIcon size={14} />
        </button>
      </div>

      {!collapsed && (
        <div className="admin-side-user">
          <span className="admin-side-avatar">{currentUser.avatar || 'AM'}</span>
          <span className="admin-side-user-meta">
            <strong>{isAr ? currentUser.name : currentUser.nameEn}</strong>
            <small>{isAr ? currentUser.roleTitleAr : currentUser.roleTitleEn}</small>
          </span>
        </div>
      )}

      <nav className="admin-side-nav">
        {groups.map(g => (
          <div key={g.titleEn} className="admin-side-group">
            {!collapsed && <div className="admin-side-group-title">{isAr ? g.titleAr : g.titleEn}</div>}
            {g.items.map(item => {
              const Icon = item.icon;
              // مساحة مبادرة واحدة تتبع صفحة «المبادرات» في التمييز
              const isActive = activeView === item.id || (item.id === 'admin-initiatives' && activeView === 'admin-initiative');
              const badge = counts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-side-item${isActive ? ' active' : ''}`}
                  onClick={() => navigate(item.id)}
                  title={isAr ? item.labelAr : item.labelEn}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={17} />
                  {!collapsed && <span className="admin-side-label">{isAr ? item.labelAr : item.labelEn}</span>}
                  {badge !== undefined && (
                    <span className={`admin-side-badge${item.id === 'chat' ? ' is-alert' : ''}`}>{item.id === 'chat' && badge > 99 ? '99+' : badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="admin-side-foot">
          {isAr ? 'تظهر هنا الصفحات المتاحة لدورك فقط.' : 'Only pages your role can access appear here.'}
        </div>
      )}
    </aside>
  );
};
