import React, { useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { 
  ShieldAlert, 
  Search, 
  Download, 
  Clock, 
  User, 
  Building2, 
  FileText,
  FileSpreadsheet,
  Filter 
} from 'lucide-react';
import { downloadExcel, AUDIT_LOGS_HEADERS, auditLogsToRows } from '../../utils/reports';

export const AuditLogsView: React.FC = () => {
  const { auditLogs, language } = usePlatformStore();
  const isAr = language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.summaryAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.summaryEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = filterAction === 'ALL' || log.actionType === filterAction;

    return matchesSearch && matchesAction;
  });

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--gov-primary-900)' }}>
            {isAr ? 'سجل التدقيق الرقمي غير القابل للتعديل (Immutable Audit Trail)' : 'Official Immutable Audit Trail'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isAr 
              ? 'توثيق كامل لكافة القرارات، التعديلات، اعتمادات المراحل، وعمليات النظام مع اسم المستخدم وعنوان IP.' 
              : 'Complete immutable log of all workflow actions, decisions, and security events.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => { void downloadExcel(`Audit_Log_Export_${new Date().toISOString().split('T')[0]}.xlsx`, AUDIT_LOGS_HEADERS, auditLogsToRows(filteredLogs), 'Audit Logs'); }}
          >
            <FileSpreadsheet size={16} />
            <span>{isAr ? 'تصدير Excel' : 'Export Excel'}</span>
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              const content = JSON.stringify(filteredLogs, null, 2);
              const blob = new Blob([content], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Audit_Log_Export_${Date.now()}.json`;
              a.click();
            }}
          >
            <Download size={16} />
            <span>{isAr ? 'تصدير JSON' : 'Export JSON'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                left: isAr ? 'auto' : '0.85rem', 
                right: isAr ? '0.85rem' : 'auto',
                color: 'var(--text-muted)' 
              }} 
            />
            <input 
              type="text" 
              className="form-control"
              placeholder={isAr ? 'بحث في سجل العمليات واسم المستخدم...' : 'Search logs and actors...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingInlineStart: '2.5rem' }}
            />
          </div>

          <select 
            className="form-control"
            style={{ width: 'auto', minWidth: '180px' }}
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            <option value="ALL">{isAr ? 'كافة العمليات' : 'All Action Types'}</option>
            <option value="APPROVE">{isAr ? 'قرارات الاعتماد (APPROVE)' : 'Approvals'}</option>
            <option value="CREATE">{isAr ? 'إنشاء طلبات ومبادرات (CREATE)' : 'Creations'}</option>
            <option value="UPDATE">{isAr ? 'تحديث وتعديل (UPDATE)' : 'Updates'}</option>
            <option value="REWORK">{isAr ? 'طلبات استيفاء (REWORK)' : 'Rework Requests'}</option>
            <option value="REJECT">{isAr ? 'قرارات الرفض (REJECT)' : 'Rejections'}</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>{isAr ? 'التاريخ والوقت' : 'Timestamp'}</th>
              <th>{isAr ? 'المستخدم المنفذ' : 'User / Actor'}</th>
              <th>{isAr ? 'الجهة' : 'Organization'}</th>
              <th>{isAr ? 'نوع العملية' : 'Action Type'}</th>
              <th>{isAr ? 'بيان العملية والكيان' : 'Summary & Target Entity'}</th>
              <th>{isAr ? 'عنوان IP' : 'IP Address'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => {
              const actionBadge = 
                log.actionType === 'APPROVE' ? 'badge-approved' :
                log.actionType === 'REJECT' ? 'badge-rejected' :
                log.actionType === 'REWORK' ? 'badge-rework' :
                log.actionType === 'CREATE' ? 'badge-teal' : 'badge-gold';

              return (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600, color: 'var(--gov-primary-900)' }}>
                      {new Date(log.timestamp).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                    </div>
                    <div>{new Date(log.timestamp).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                  </td>

                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--gov-primary-900)' }}>{log.userName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? log.userRoleAr : log.userRoleEn}</div>
                  </td>

                  <td style={{ fontSize: '0.85rem' }}>
                    {isAr ? log.userOrgAr : log.userOrgEn}
                  </td>

                  <td>
                    <span className={`badge ${actionBadge}`}>
                      {log.actionType}
                    </span>
                  </td>

                  <td style={{ fontSize: '0.875rem', color: 'var(--text-body)', lineHeight: 1.4, maxWidth: '420px' }}>
                    {isAr ? log.summaryAr : log.summaryEn}
                  </td>

                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {log.ipAddress}
                  </td>
                </tr>
              );
            })}

            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={6} className="card-empty">
                  <div className="card-empty-icon">
                    <ShieldAlert size={22} />
                  </div>
                  {isAr ? 'لا توجد سجلات مطابقة للبحث.' : 'No audit records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
