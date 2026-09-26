import React from 'react';
import { AdminSidebar } from './AdminSidebar';

/** غلاف صفحات الإدارة: سايد بار مثبت في الجانب بطول الشاشة + محتوى */
export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">{children}</div>
    </div>
  );
};

/** ترويسة موحدة لصفحات الإدارة: عنوان + وصف + إجراءات (RTL-safe، هوية مصرية عبر gov tokens) */
export const AdminPageHeader: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--gov-primary-900)', margin: 0 }}>
          {title}
        </h1>
        {description && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0' }}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  );
};
