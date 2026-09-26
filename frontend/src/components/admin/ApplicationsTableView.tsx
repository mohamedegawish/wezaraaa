import React, { useEffect, useMemo, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { Application } from '../../types';
import { AdminPageHeader } from './AdminLayout';
import {
  Search,
  Download,
  Eye,
  Clock,
  Building2,
  FileText,
  AlertTriangle,
  Route,
} from 'lucide-react';
import { ApplicationReviewModal } from './ApplicationReviewModal';
import { downloadCSV, downloadExcel, printReport, applicationsToRows, APPLICATIONS_REPORT_HEADERS } from '../../utils/reports';
import { FileSpreadsheet } from 'lucide-react';

export const ApplicationsTableView: React.FC = () => {
  const { 
    applications, 
    initiatives, 
    organizations, 
    factories,
    currentUser, 
    language 
  } = usePlatformStore();

  const isAr = language === 'ar';

  const isOversight = currentUser.role === 'ministry_admin' || currentUser.role === 'initiative_manager' || currentUser.role === 'auditor';
  // الجهات تبدأ بما ينتظر قرارها؛ الإدارة/المدقق بكل الطلبات (متابعة).
  type QuickView = 'all' | 'mine' | 'escalated' | 'overdue';
  const defaultView: QuickView = isOversight ? 'all' : 'mine';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInitiative, setSelectedInitiative] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedOrg, setSelectedOrg] = useState('ALL');
  const [quickView, setQuickView] = useState<QuickView>(defaultView);

  const [activeReviewApp, setActiveReviewApp] = useState<Application | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setSelectedOrg('ALL');
    setQuickView(defaultView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedInitiative, selectedStatus, selectedOrg, quickView]);

  const isOpen = (a: Application) => a.status !== 'completed' && a.status !== 'rejected';
  const quickCounts = {
    all: applications.length,
    mine: applications.filter(a => a.viewerCanDecide).length,
    escalated: applications.filter(a => a.isEscalated).length,
    overdue: applications.filter(a => isOpen(a) && a.isSlaViolated).length,
  };

  // Filter applications
  const filteredApps = applications.filter(app => {
    const matchesSearch = 
      app.applicationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.factoryNameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.factoryNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.factorySectorAr.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesInit = selectedInitiative === 'ALL' || app.initiativeId === selectedInitiative;
    const matchesStatus = selectedStatus === 'ALL' || app.status === selectedStatus;
    const matchesOrg = selectedOrg === 'ALL' || app.currentAssignedOrgId === selectedOrg;
    const matchesQuick = quickView === 'all'
      || (quickView === 'mine' && app.viewerCanDecide === true)
      || (quickView === 'escalated' && app.isEscalated === true)
      || (quickView === 'overdue' && isOpen(app) && app.isSlaViolated === true);

    return matchesSearch && matchesInit && matchesStatus && matchesOrg && matchesQuick;
  });

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedApps = useMemo(
    () => filteredApps.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredApps, safePage]
  );

  // Export to CSV / Excel — strong report includes Details PDF count
  const handleExportCSV = () => {
    downloadCSV(
      `Egypt_Industrial_Applications_${new Date().toISOString().split('T')[0]}.csv`,
      APPLICATIONS_REPORT_HEADERS,
      applicationsToRows(filteredApps, factories)
    );
  };

  const handlePrintReport = () => {
    const rows = applicationsToRows(filteredApps, factories).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    printReport(
      `تقرير الطلبات الصناعية (${filteredApps.length})`,
      `Industrial Applications Report (${filteredApps.length})`,
      `<table><thead><tr>${APPLICATIONS_REPORT_HEADERS.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`,
      isAr
    );
  };

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      <AdminPageHeader
        title={isAr ? 'محطة إدارة ومراجعة الطلبات الصناعية' : 'Applications Review & Governance Workstation'}
        description={isAr
          ? 'متابعة وفحص وتدقيق طلبات المصانع لكافة المبادرات واعتماد المراحل وفق صلاحيات الجهة والـ SLA.'
          : 'Multi-entity governance table to review, verify documents, and approve applications.'}
        actions={(
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { void downloadExcel(`Egypt_Industrial_Applications_${new Date().toISOString().split('T')[0]}.xlsx`, APPLICATIONS_REPORT_HEADERS, applicationsToRows(filteredApps, factories), 'Applications'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <FileSpreadsheet size={16} />
              <span>{isAr ? 'تصدير Excel (شامل ملفات PDF)' : 'Export Excel (incl. PDF count)'}</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Download size={16} />
              <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
            </button>
            <button className="btn btn-gold btn-sm" onClick={handlePrintReport} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={16} />
              <span>{isAr ? 'تقرير PDF/طباعة' : 'PDF/Print Report'}</span>
            </button>
          </>
        )}
      />

      {/* Filter Bar */}
      <div className="card flag-side-accent" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
          {([
            { id: 'all', ar: 'كل الطلبات', en: 'All' },
            { id: 'mine', ar: isOversight ? 'بانتظار المراجعة الأولية' : 'بانتظار قرار جهتنا', en: 'Awaiting my decision' },
            { id: 'escalated', ar: 'مُصعَّدة للوزارة', en: 'Escalated' },
            { id: 'overdue', ar: 'متأخرة عن الـ SLA', en: 'Overdue' },
          ] as const).map(v => (
            <button key={v.id} type="button" className={`btn btn-sm ${quickView === v.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuickView(v.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {v.id === 'escalated' && <AlertTriangle size={13} />}
              {v.id === 'overdue' && <Clock size={13} />}
              <span>{isAr ? v.ar : v.en}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, minWidth: '1.25rem', padding: '0 0.35rem', borderRadius: '999px', background: quickView === v.id ? 'rgba(255,255,255,0.25)' : 'var(--bg-muted)' }}>
                {quickCounts[v.id]}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
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
              placeholder={isAr ? 'بحث برقم الطلب، اسم المصنع، أو القطاع...' : 'Search by ID, Factory, Sector...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingInlineStart: '2.5rem' }}
            />
          </div>

          {/* Initiative Dropdown */}
          <select 
            className="form-control"
            style={{ width: 'auto', minWidth: '200px' }}
            value={selectedInitiative}
            onChange={e => setSelectedInitiative(e.target.value)}
          >
            <option value="ALL">{isAr ? 'كافة المبادرات' : 'All Initiatives'}</option>
            {initiatives.map(init => (
              <option key={init.id} value={init.id}>{isAr ? init.titleAr : init.titleEn}</option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select 
            className="form-control"
            style={{ width: 'auto', minWidth: '160px' }}
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
          >
            <option value="ALL">{isAr ? 'كافة الحالات' : 'All Statuses'}</option>
            <option value="submitted">{isAr ? 'مقدم جديد' : 'Submitted'}</option>
            <option value="under_review">{isAr ? 'قيد المراجعة' : 'Under Review'}</option>
            <option value="in_progress">{isAr ? 'قيد التنفيذ' : 'In Progress'}</option>
            <option value="pending_documents">{isAr ? 'مطلوب تعديل' : 'Need Action'}</option>
            <option value="approved">{isAr ? 'معتمد' : 'Approved'}</option>
            <option value="completed">{isAr ? 'مكتمل' : 'Completed'}</option>
            <option value="rejected">{isAr ? 'مرفوض' : 'Rejected'}</option>
          </select>

          {/* Assigned Org Dropdown */}
          <select 
            className="form-control"
            style={{ width: 'auto', minWidth: '180px' }}
            value={selectedOrg}
            onChange={e => setSelectedOrg(e.target.value)}
          >
            <option value="ALL">{isAr ? 'كافة الجهات المسؤولة' : 'All Assigned Entities'}</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{isAr ? org.nameAr : org.nameEn}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced Applications Table */}
      <div className="card" style={{ padding: '1.5rem' }}>
      <div className="table-responsive timeline-scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>{isAr ? 'رقم الطلب' : 'App ID'}</th>
              <th>{isAr ? 'المنشأة الصناعية' : 'Factory Name'}</th>
              <th>{isAr ? 'المبادرة' : 'Initiative'}</th>
              <th>{isAr ? 'المرحلة والتقدم' : 'Stage & Progress'}</th>
              <th>{isAr ? 'الجهة المسؤولة' : 'Assigned Entity'}</th>
              <th>{isAr ? 'الحالة' : 'Status'}</th>
              <th>{isAr ? 'المدة في المرحلة' : 'Time in Stage'}</th>
              <th>{isAr ? 'تاريخ التقديم' : 'Date'}</th>
              <th>{isAr ? 'الإجراء' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {pagedApps.map(app => {
              const statusBadgeClass = 
                app.status === 'approved' || app.status === 'completed' ? 'badge-approved' :
                app.status === 'pending_documents' ? 'badge-rework' :
                app.status === 'rejected' ? 'badge-rejected' : 'badge-pending';

              return (
                <tr key={app.id}>
                  <td style={{ fontWeight: 700, color: 'var(--gov-primary-900)' }}>
                    {app.applicationNumber}
                  </td>

                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--gov-primary-900)' }}>{app.factoryNameAr}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.factorySectorAr} • {app.factoryGovernorateAr}</div>
                  </td>

                  <td style={{ fontSize: '0.85rem' }}>
                    {app.initiativeTitleAr}
                  </td>

                  <td style={{ minWidth: '170px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--gov-primary-800)', fontSize: '0.85rem' }}>
                      {app.currentStageNameAr}
                    </div>
                    {app.totalStages ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.3rem' }}>
                        <div style={{ flex: 1, height: '5px', background: 'var(--border-subtle)', borderRadius: '999px', overflow: 'hidden', minWidth: '70px' }}>
                          <div style={{
                            height: '100%', borderRadius: '999px',
                            width: `${Math.round(((app.stageTrack ?? []).filter(t => t.status === 'approved').length / Math.max(1, (app.stageTrack ?? []).filter(t => t.status !== 'skipped').length)) * 100)}%`,
                            background: app.status === 'rejected' ? 'var(--status-rejected)' : 'var(--status-approved)',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {app.currentStageOrder}/{app.totalStages}
                        </span>
                      </div>
                    ) : null}
                  </td>

                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.825rem', color: 'var(--text-body)' }}>
                      <Building2 size={13} style={{ color: 'var(--gov-primary-700)' }} />
                      {app.currentAssignedOrgNameAr}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                      <span className={`badge ${statusBadgeClass}`}>
                        {app.status === 'submitted' ? (isAr ? 'جديد' : 'Submitted') :
                         app.status === 'under_review' || app.status === 'in_progress' ? (isAr ? 'قيد المراجعة' : 'Review') :
                         app.status === 'pending_documents' ? (isAr ? 'مطلوب تعديل' : 'Rework') :
                         app.status === 'approved' ? (isAr ? 'معتمد' : 'Approved') :
                         app.status === 'rejected' ? (isAr ? 'مرفوض' : 'Rejected') : (isAr ? 'مكتمل' : 'Done')}
                      </span>
                      {app.isEscalated && (
                        <span className="badge badge-rejected" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} title={isAr ? 'صعّدت الجهة الطلب للوزارة — القرار ما زال لديها' : 'Escalated by the organization'}>
                          <AlertTriangle size={11} />{isAr ? 'مُصعَّد' : 'Escalated'}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    {isOpen(app) ? (
                      <span className={`badge ${app.isSlaViolated ? 'badge-rejected' : 'badge-gold'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                        <Clock size={12} />
                        {isAr ? `${app.daysSpentInStage ?? 0} / ${app.slaDays} يوم` : `${app.daysSpentInStage ?? 0} / ${app.slaDays} d`}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>—</span>
                    )}
                  </td>

                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(app.submittedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                  </td>

                  <td>
                    {(() => {
                      // الباك مصدر الحقيقة: الجهة صاحبة المرحلة فقط (الإدارة: المراجعة الأولية فقط).
                      const canReview = app.viewerCanDecide === true;
                      return (
                        <button
                          className={`btn btn-sm ${canReview ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setActiveReviewApp(app)}
                          title={canReview ? (isAr ? 'فتح الطلب واتخاذ قرار جهتكم' : 'Open & decide') : (isAr ? 'متابعة مسار الطلب وتفاصيله (اطلاع)' : 'Track the process (view only)')}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {canReview ? <Eye size={13} /> : <Route size={13} />}
                          <span>{canReview ? (isAr ? 'فحص واتخاذ القرار' : 'Review & Decide') : (isAr ? 'متابعة المسار' : 'Track')}</span>
                        </button>
                      );
                    })()}
                  </td>

                </tr>
              );
            })}

            {filteredApps.length === 0 && (
              <tr>
                <td colSpan={9} className="card-empty">
                  <div className="card-empty-icon">
                    <FileText size={22} />
                  </div>
                  {isAr ? 'لا توجد طلبات مطابقة لمعايير البحث الحالية.' : 'No applications match current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Strict Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {isAr ? `عرض ${pagedApps.length} من ${filteredApps.length} طلب — صفحة ${safePage} / ${totalPages}` : `Showing ${pagedApps.length} of ${filteredApps.length} — page ${safePage} / ${totalPages}`}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
            {isAr ? 'السابق' : 'Prev'}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map(n => (
            <button key={n} className={`btn btn-sm ${n === safePage ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentPage(n)}>
              {n}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      </div>
      </div>

      {/* Review Modal */}
      {activeReviewApp && (
        <ApplicationReviewModal
          key={activeReviewApp.id}
          application={activeReviewApp}
          onClose={() => setActiveReviewApp(null)}
        />
      )}
    </div>
  );
};
