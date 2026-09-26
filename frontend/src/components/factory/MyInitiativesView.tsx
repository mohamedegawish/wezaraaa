import React, { useEffect, useMemo, useState } from 'react';
import { usePlatformStore, store } from '../../store/state';
import { Badge } from '../ui/Badge';
import { Application, ApplicationStatus } from '../../types';
import { Layers, LogIn, FileText, ArrowLeft, ArrowRight, Building2, Eye, RefreshCw, PlusCircle } from 'lucide-react';

function statusLabel(status: ApplicationStatus, isAr: boolean): string {  const map: Record<ApplicationStatus, { ar: string; en: string }> = {
    draft: { ar: 'مسودة', en: 'Draft' },
    submitted: { ar: 'مقدم جديد', en: 'Submitted' },
    under_review: { ar: 'قيد المراجعة', en: 'Under Review' },
    pending_documents: { ar: 'مطلوب مستندات', en: 'Pending Documents' },
    approved: { ar: 'معتمد', en: 'Approved' },
    rejected: { ar: 'مرفوض', en: 'Rejected' },
    in_progress: { ar: 'قيد التنفيذ', en: 'In Progress' },
    completed: { ar: 'مكتمل', en: 'Completed' },
    cancelled: { ar: 'ملغي', en: 'Cancelled' },
  };
  const entry = map[status] ?? { ar: status, en: status };
  return isAr ? entry.ar : entry.en;
}

/** صياغة عربية سليمة لأعداد الطلبات (طلب واحد / طلبان / طلبات). */
function appsCountLabel(count: number, isAr: boolean): string {
  if (!isAr) return `${count} app${count === 1 ? '' : 's'}`;
  if (count === 0) return 'لا توجد طلبات';
  if (count === 1) return 'طلب واحد';
  if (count === 2) return 'طلبان';
  if (count <= 10) return `${count} طلبات`;
  return `${count} طلباً`;
}

interface InitiativeGroup {
  initiativeId: string;
  titleAr: string;
  titleEn: string;
  apps: Application[];
  latestStatus: ApplicationStatus;
}

function groupByInitiative(apps: Application[]): InitiativeGroup[] {
  const map = new Map<string, Application[]>();
  for (const app of apps) {
    const list = map.get(app.initiativeId) ?? [];
    list.push(app);
    map.set(app.initiativeId, list);
  }
  return [...map.entries()].map(([initiativeId, list]) => {
    const sorted = [...list].sort((a, b) =>
      String(b.lastUpdatedAt || '').localeCompare(String(a.lastUpdatedAt || '')),
    );
    const first = list[0];
    return {
      initiativeId,
      titleAr: first.initiativeTitleAr,
      titleEn: first.initiativeTitleEn,
      apps: sorted,
      latestStatus: sorted[0]?.status ?? 'draft',
    };
  });
}

/**
 * «مبادراتي» — صفحة مسجلة فقط (isViewAllowed تحجبها عن الزائر).
 * - مالك المصنع: طلباته مجمعة حسب المبادرة.
 * - المراجع: الطلبات المسندة لجهته مجمعة حسب المبادرة.
 * - الأدمن/المدقق: كل المبادرات مع عدّادات الطلبات.
 * آمنة بعد logout (تعود لعرض دعوة تسجيل الدخول ولا تنكسر مع applications فارغة).
 */
export const MyInitiativesView: React.FC = () => {
  const {
    language, navigate, isViewAllowed,
    currentUser, isLoggedIn,
    applications, initiatives,
  } = usePlatformStore();
  const isAr = language === 'ar';
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  // تحديث حالة الطلبات تلقائياً: عند الفتح + كل دقيقة + عند العودة للتبويب.
  useEffect(() => {
    if (!isLoggedIn) return;
    void store.reloadAll().catch(() => undefined);
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void store.reloadAll().catch(() => undefined);
    }, 60000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void store.reloadAll().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [isLoggedIn]);

  const role = currentUser.role;
  const isReviewer = role === 'ida_reviewer' || role === 'imc_reviewer' || role === 'bank_reviewer' || role === 'solar_provider';
  const isOversight = role === 'ministry_admin' || role === 'initiative_manager' || role === 'auditor';

  // اشتقاق آمن من الـstore — يعمل حتى مع applications فارغة (بعد logout).
  const scopedApps: Application[] = useMemo(() => {
    const all = applications ?? [];
    if (role === 'factory_owner') {
      const fid = currentUser.factoryId;
      if (!fid) return all; // الـAPI يعيد نطاق المصنع أصلاً
      const mine = all.filter(a => a.factoryId === fid);
      return mine.length > 0 || all.length === 0 ? mine : all;
    }
    if (isReviewer) {
      if (!currentUser.organizationId) return [];
      return all.filter(a => a.currentAssignedOrgId === currentUser.organizationId);
    }
    return all;
  }, [applications, role, currentUser.factoryId, currentUser.organizationId, isReviewer]);

  const groups: InitiativeGroup[] = useMemo(
    () => groupByInitiative(scopedApps),
    [scopedApps],
  );

  // آخر طلب مسجل عبر كل النطاق — تُفتح مبادرته تلقائياً.
  const latestApp: Application | null = useMemo(() => {
    let best: Application | null = null;
    let bestKey = '';
    for (const a of scopedApps) {
      const k = String(a.lastUpdatedAt || a.submittedAt || '');
      if (!best || k > bestKey) { best = a; bestKey = k; }
    }
    return best;
  }, [scopedApps]);

  // المبادرة المختارة: الأحدث تلقائياً، وتبقى باختيار المستخدم بعدها.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId && groups.some((g) => g.initiativeId === selectedId)) return;
    const auto = latestApp?.initiativeId ?? groups[0]?.initiativeId ?? null;
    if (auto !== selectedId) setSelectedId(auto);
  }, [groups, latestApp, selectedId]);
  const selected: InitiativeGroup | null = groups.find((g) => g.initiativeId === selectedId) ?? null;

  const [refreshing, setRefreshing] = useState(false);
  const manualRefresh = async () => {
    setRefreshing(true);
    try { await store.reloadAll(); } catch { /* ignore */ }
    setRefreshing(false);
  };

  // عدّادات الأدمن/المدقق: كل المبادرات (حتى الصفرية) مع عدد الطلبات.
  const oversightRows = useMemo(() => {
    if (!isOversight) return [];
    const counts = new Map<string, number>();
    for (const app of scopedApps) {
      counts.set(app.initiativeId, (counts.get(app.initiativeId) ?? 0) + 1);
    }
    return (initiatives ?? []).map(init => ({
      id: init.id,
      titleAr: init.titleAr,
      titleEn: init.titleEn,
      count: counts.get(init.id) ?? 0,
    }));
  }, [isOversight, initiatives, scopedApps]);

  // 1) الزائر: دعوة تسجيل دخول.
  if (!isLoggedIn || !currentUser || currentUser.id === 'guest') {
    return (
      <div className="container-custom" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '560px', margin: '0 auto', padding: '2.5rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
            <Layers size={30} style={{ color: 'var(--egypt-red)' }} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
            {isAr ? 'مبادراتي' : 'My Initiatives'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            {isAr
              ? 'سجل الدخول لعرض المبادرات المرتبطة بحسابك ومتابعة طلباتك وحالاتها.'
              : 'Sign in to see the initiatives linked to your account and track your applications.'}
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('login')}>
              <LogIn size={16} />
              <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('initiatives')}>
              <span>{isAr ? 'استعرض المبادرات' : 'Browse Initiatives'}</span>
              <Arrow size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canSeeFactoryPortal = isViewAllowed('factory-portal', currentUser);
  const canSeeAdminApps = isViewAllowed('admin-applications', currentUser);

  const subtitle = isAr
    ? (role === 'factory_owner'
        ? 'المبادرات التي قدمت عليها طلبات من منشأتك'
        : isReviewer
          ? 'المبادرات التي لديك طلبات مسندة لجهتك فيها'
          : 'نظرة شاملة على المبادرات وحجم الطلبات عليها')
    : (role === 'factory_owner'
        ? 'Initiatives your facility applied to'
        : isReviewer
          ? 'Initiatives with applications assigned to your organization'
          : 'Overview of initiatives and application volumes');

  // 2) قائمة فارغة: رسالة + زر استعراض المبادرات.
  const isEmpty = isOversight ? groups.length === 0 && oversightRows.length === 0 : groups.length === 0;
  if (isEmpty) {
    return (
      <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
        <PageHeader isAr={isAr} subtitle={subtitle} />
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <FileText size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
            {isAr ? 'لا توجد مبادرات مرتبطة بحسابك بعد.' : 'No initiatives linked to your account yet.'}
          </p>
          <button className="btn btn-gold" onClick={() => navigate('initiatives')}>
            <span>{isAr ? 'استعرض المبادرات' : 'Browse Initiatives'}</span>
            <Arrow size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
        <PageHeader isAr={isAr} subtitle={subtitle} />
        {!isOversight && (
          <button className="btn btn-secondary btn-sm" onClick={manualRefresh} disabled={refreshing} title={isAr ? 'تحديث الحالات الآن' : 'Refresh statuses now'} style={{ marginBottom: '1.5rem', flexShrink: 0 }}>
            <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
            <span>{isAr ? (refreshing ? 'جارٍ التحديث…' : 'تحديث الحالات') : (refreshing ? 'Refreshing…' : 'Refresh')}</span>
          </button>
        )}
      </div>

      {/* آخر تسجيل: يُفتح تلقائياً مع زر عرض حالتي (بدل الأهلية/التقديم — تم التسجيل فعلاً) */}
      {!isOversight && selected && latestApp && (
        <section className="card" style={{ padding: '1.35rem 1.5rem', marginBottom: '1.25rem', borderInlineStart: '4px solid var(--egypt-red)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--egypt-red)', marginBottom: '0.25rem' }}>
                {isAr ? 'آخر مبادرة سجلت فيها' : 'Your latest registration'}
              </div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.35rem 0', lineHeight: 1.4 }}>
                {isAr ? selected.titleAr : selected.titleEn}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <Badge status={latestApp.status}>{statusLabel(latestApp.status, isAr)}</Badge>
                <span className="num-ltr">{latestApp.applicationNumber}</span>
                {(latestApp.currentStageNameAr || latestApp.currentStageNameEn) && (
                  <span>· {isAr ? latestApp.currentStageNameAr : latestApp.currentStageNameEn}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('factory-portal', undefined, latestApp.id)}>
                <Eye size={15} />
                <span>{isAr ? 'عرض حالتي' : 'View My Status'}</span>
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('initiatives')}>
                <PlusCircle size={15} />
                <span>{isAr ? 'التسجيل في مبادرة أخرى' : 'Apply to Another'}</span>
              </button>
            </div>
          </div>
          {selected.apps.length > 1 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
              {selected.apps.slice(1, 4).map((a) => (
                <button key={a.id} className="btn btn-ghost btn-sm" onClick={() => navigate('factory-portal', undefined, a.id)} title={a.applicationNumber}>
                  <span className="num-ltr">{a.applicationNumber}</span>
                  <span>· {statusLabel(a.status, isAr)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* الأدمن/المدقق: كل المبادرات مع عدّادات */}
      {isOversight && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: groups.length > 0 ? '2rem' : undefined }}>
          {oversightRows.map(row => (
            <div key={row.id} className="card" style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>
                  {isAr ? row.titleAr : row.titleEn}
                </h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--egypt-red)', whiteSpace: 'nowrap' }}>
                  {appsCountLabel(row.count, isAr)}
                </span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('initiative-detail', row.id)}>
                <span>{isAr ? 'عرض صفحة المبادرة' : 'View Initiative'}</span>
                <Arrow size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* مالك المصنع / المراجع: بطاقة لكل مبادرة */}
      {!isOversight && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {groups.map(g => (
            <div
              key={g.initiativeId}
              className="card"
              onClick={() => setSelectedId(g.initiativeId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(g.initiativeId); } }}
              title={isAr ? 'اضغط لعرض هذه المبادرة كآخر تسجيل' : 'Click to preview as latest'}
              style={{
                padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer',
                borderColor: g.initiativeId === selectedId ? 'var(--egypt-red)' : undefined,
                boxShadow: g.initiativeId === selectedId ? '0 0 0 2px var(--egypt-red-soft)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>
                  {isAr ? g.titleAr : g.titleEn}
                </h3>
                <Badge status={g.latestStatus}>{statusLabel(g.latestStatus, isAr)}</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Building2 size={14} />
                <span>
                  {isAr
                    ? `طلباتي في هذه المبادرة: ${g.apps.length} — آخر حالة: ${statusLabel(g.latestStatus, true)}`
                    : `My applications: ${g.apps.length} — latest: ${statusLabel(g.latestStatus, false)}`}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {g.apps.slice(0, 3).map(a => a.applicationNumber).join(' · ')}
                {g.apps.length > 3 ? (isAr ? ` · +${g.apps.length - 3} أخرى` : ` · +${g.apps.length - 3} more`) : ''}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('initiative-detail', g.initiativeId)}>
                  <span>{isAr ? 'عرض صفحة المبادرة' : 'View Initiative'}</span>
                  <Arrow size={14} />
                </button>
                {role === 'factory_owner' && canSeeFactoryPortal && (
                  <button className="btn btn-gold btn-sm" onClick={() => navigate('factory-portal')}>
                    <span>{isAr ? 'طلباتي' : 'My Applications'}</span>
                  </button>
                )}
                {isReviewer && canSeeAdminApps && (
                  <button className="btn btn-gold btn-sm" onClick={() => navigate('admin-applications')}>
                    <span>{isAr ? 'متابعة الطلبات' : 'Review Applications'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PageHeader: React.FC<{ isAr: boolean; subtitle: string }> = ({ isAr, subtitle }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
      {isAr ? 'مبادراتي' : 'My Initiatives'}
    </h1>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{subtitle}</p>
  </div>
);
