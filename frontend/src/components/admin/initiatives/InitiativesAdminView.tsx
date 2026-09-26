import React, { useMemo, useState } from 'react';
import { usePlatformStore, store } from '../../../store/state';
import { api, resolveCoverUrl } from '../../../api';
import type { Initiative } from '../../../types';
import { AdminPageHeader } from '../AdminLayout';
import { EditInitiativeModal } from '../EditInitiativeModal';
import { Badge } from '../../ui/Badge';
import { useToast } from '../../common/ToastSystem';
import { downloadExcel } from '../../../utils/reports';
import { formatEGP } from '../../../utils/format';
import { INITIATIVE_STATUS_META, OPEN_APP_STATUSES, StatusSelect, statusMeta } from './initiativeStatus';
import { initiativeCompleteness } from './initiativeCompleteness';
import { Plus, FileSpreadsheet, Search, Settings2, Eye, Copy, Trash2, EyeOff, CheckCircle2, Layers } from 'lucide-react';

type SortKey = 'updated' | 'apps' | 'budget' | 'completeness';

/**
 * «المبادرات» في الأدمن — كل المبادرات بكل حالاتها (بما فيها المسودة/المؤرشفة المخفية عن الجمهور):
 * فلترة بالحالة والتصنيف، ترتيب، تغيير حالة سريع، نسخ، حذف، تصدير Excel، والدخول لمساحة كل مبادرة.
 */
export const InitiativesAdminView: React.FC = () => {
  const { initiatives, applications, language, navigate, currentUser } = usePlatformStore();
  const { toast } = useToast();
  const isAr = language === 'ar';
  const canDelete = currentUser.role === 'ministry_admin';
  const fmtN = (n: number) => n.toLocaleString(isAr ? 'ar-EG' : 'en-US');

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [category, setCategory] = useState('ALL');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // لكل مبادرة: طلباتها (بدون مسودات المصانع) + اكتمال بياناتها — تُحسب مرة لكل تغيير في البيانات
  const rows = useMemo(() => initiatives.map(i => {
    const apps = applications.filter(a => a.initiativeId === i.id && a.status !== 'draft');
    return {
      init: i,
      total: apps.length,
      open: apps.filter(a => OPEN_APP_STATUSES.includes(a.status)).length,
      approved: apps.filter(a => a.status === 'approved' || a.status === 'completed').length,
      rejected: apps.filter(a => a.status === 'rejected' || a.status === 'cancelled').length,
      completeness: initiativeCompleteness(i),
    };
  }), [initiatives, applications]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { ALL: initiatives.length };
    for (const i of initiatives) m[i.status] = (m[i.status] ?? 0) + 1;
    return m;
  }, [initiatives]);

  const categories = useMemo(() => [...new Set(initiatives.map(i => (isAr ? i.category : i.categoryEn || i.category)).filter(Boolean))], [initiatives, isAr]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter(r => {
      const i = r.init;
      if (statusFilter !== 'ALL' && i.status !== statusFilter) return false;
      if (category !== 'ALL' && (isAr ? i.category : i.categoryEn || i.category) !== category) return false;
      if (!needle) return true;
      return [i.titleAr, i.titleEn, i.slug, i.category, i.categoryEn].some(v => (v ?? '').toLowerCase().includes(needle));
    });
    const by: Record<SortKey, (a: typeof rows[number], b: typeof rows[number]) => number> = {
      updated: (a, b) => (b.init.updatedAt ?? '').localeCompare(a.init.updatedAt ?? ''),
      apps: (a, b) => b.total - a.total,
      budget: (a, b) => (b.init.budgetTotalEGP ?? 0) - (a.init.budgetTotalEGP ?? 0),
      completeness: (a, b) => a.completeness.percent - b.completeness.percent,
    };
    return [...list].sort(by[sort]);
  }, [rows, statusFilter, category, q, sort, isAr]);

  const handleDuplicate = async (i: Initiative) => {
    setBusyId(i.id);
    try {
      const r = await api.duplicateInitiative(i.id);
      await store.reloadAll();
      toast('success', isAr ? 'تم نسخ المبادرة كمسودة — يمكنك تعديلها الآن' : 'Duplicated as draft — you can edit it now');
      navigate('admin-initiative', r.data.id);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : (isAr ? 'تعذر نسخ المبادرة.' : 'Duplicate failed.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (i: Initiative) => {
    if (!window.confirm(isAr ? `حذف مبادرة «${i.titleAr}» نهائياً؟ لا يمكن التراجع.` : `Delete "${i.titleEn}" permanently? This cannot be undone.`)) return;
    setBusyId(i.id);
    try {
      await api.deleteInitiative(i.id);
      await store.reloadAll();
      toast('success', isAr ? 'تم حذف المبادرة' : 'Initiative deleted');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : (isAr ? 'تعذر حذف المبادرة.' : 'Delete failed.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    const headers = isAr
      ? ['المبادرة', 'الحالة', 'التصنيف', 'القيمة (جنيه)', 'الطلبات', 'مفتوحة', 'معتمدة/مكتملة', 'مرفوضة', 'اكتمال البيانات %', 'البنود الناقصة', 'آخر تحديث']
      : ['Initiative', 'Status', 'Category', 'Value (EGP)', 'Applications', 'Open', 'Approved/Completed', 'Rejected', 'Data completeness %', 'Missing items', 'Last updated'];
    const data = visible.map(r => [
      isAr ? r.init.titleAr : r.init.titleEn,
      isAr ? statusMeta(r.init.status).ar : statusMeta(r.init.status).en,
      isAr ? r.init.category : r.init.categoryEn,
      r.init.budgetTotalEGP ?? 0,
      r.total, r.open, r.approved, r.rejected,
      r.completeness.percent,
      r.completeness.missing.map(m => (isAr ? m.ar : m.en)).join('، '),
      r.init.updatedAt ? new Date(r.init.updatedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '',
    ]);
    void downloadExcel(`initiatives-${new Date().toISOString().slice(0, 10)}.xlsx`, headers, data, isAr ? 'المبادرات' : 'Initiatives');
    api.logExport({ summaryAr: `تصدير Excel لقائمة المبادرات (${visible.length}) من صفحة إدارة المبادرات` })
      .then(() => toast('success', isAr ? 'تم التصدير وتوثيقه في سجل التدقيق' : 'Exported and audit-logged'))
      .catch(() => toast('warning', isAr ? 'تم التصدير لكن تعذر توثيقه في سجل التدقيق' : 'Exported, but audit logging failed'));
  };

  const iconBtn: React.CSSProperties = { width: '32px', height: '32px', padding: 0, justifyContent: 'center', borderRadius: '8px' };

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      <AdminPageHeader
        title={isAr ? 'إدارة المبادرات' : 'Initiatives Management'}
        description={isAr
          ? 'كل المبادرات بكل حالاتها — المسودة والمؤرشفة مخفية عن الجمهور وتظهر هنا فقط.'
          : 'All initiatives in every status — drafts and archived ones are hidden from the public and appear only here.'}
        actions={(
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport} disabled={!visible.length}>
              <FileSpreadsheet size={16} /><span>{isAr ? 'تصدير Excel' : 'Export Excel'}</span>
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              <Plus size={16} /><span>{isAr ? 'مبادرة جديدة' : 'New initiative'}</span>
            </button>
          </>
        )}
      />

      {/* بطاقات الحالات — كل بطاقة فلتر */}
      <div role="tablist" aria-label={isAr ? 'تصفية بالحالة' : 'Filter by status'} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[{ value: 'ALL', ar: 'كل المبادرات', en: 'All', isPublic: true }, ...INITIATIVE_STATUS_META].map(m => {
          const on = statusFilter === m.value;
          return (
            <button key={m.value} type="button" role="tab" aria-selected={on} onClick={() => setStatusFilter(m.value)} className="card"
              style={{ padding: '0.75rem 0.9rem', textAlign: 'start', cursor: 'pointer', borderRadius: 'var(--radius-md)', border: on ? '1.5px solid var(--egypt-red)' : '1px solid var(--border-subtle)', background: on ? 'var(--egypt-red-soft)' : 'var(--bg-surface)' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {m.value === 'ALL' ? <Layers size={12} /> : !m.isPublic ? <EyeOff size={12} /> : null}
                {isAr ? m.ar : m.en}
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', marginTop: '0.15rem' }}>{fmtN(statusCounts[m.value] ?? 0)}</div>
            </button>
          );
        })}
      </div>

      {/* بحث + تصنيف + ترتيب */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.8rem', color: 'var(--text-muted)' }} />
          <input className="form-control" value={q} onChange={e => setQ(e.target.value)} placeholder={isAr ? 'بحث بالاسم أو المعرف أو التصنيف…' : 'Search by name, slug or category…'} style={{ paddingInlineStart: '2.3rem' }} aria-label={isAr ? 'بحث' : 'Search'} />
        </div>
        <select className="form-control" style={{ width: 'auto', minWidth: '170px' }} value={category} onChange={e => setCategory(e.target.value)} aria-label={isAr ? 'التصنيف' : 'Category'}>
          <option value="ALL">{isAr ? 'كل التصنيفات' : 'All categories'}</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth: '170px' }} value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label={isAr ? 'الترتيب' : 'Sort'}>
          <option value="updated">{isAr ? 'الأحدث تعديلاً' : 'Recently updated'}</option>
          <option value="apps">{isAr ? 'الأكثر طلبات' : 'Most applications'}</option>
          <option value="budget">{isAr ? 'الأعلى قيمة' : 'Highest value'}</option>
          <option value="completeness">{isAr ? 'الأقل اكتمالاً أولاً' : 'Least complete first'}</option>
        </select>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>{isAr ? `${fmtN(visible.length)} نتيجة` : `${visible.length} results`}</span>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {initiatives.length === 0 ? (isAr ? 'لا توجد مبادرات بعد — أنشئ أول مبادرة.' : 'No initiatives yet — create the first one.') : (isAr ? 'لا توجد نتائج مطابقة للفلاتر.' : 'No initiatives match the filters.')}
          </div>
        ) : (
          <div className="table-responsive timeline-scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? 'المبادرة' : 'Initiative'}</th>
                  <th>{isAr ? 'الحالة' : 'Status'}</th>
                  <th>{isAr ? 'القيمة' : 'Value'}</th>
                  <th>{isAr ? 'الطلبات' : 'Applications'}</th>
                  <th>{isAr ? 'اكتمال البيانات' : 'Data completeness'}</th>
                  <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  const i = r.init;
                  const meta = statusMeta(i.status);
                  const pct = r.completeness.percent;
                  const busy = busyId === i.id;
                  return (
                    <tr key={i.id}>
                      <td style={{ minWidth: '200px' }}>
                        <button type="button" onClick={() => navigate('admin-initiative', i.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'start' }}>
                          <img src={resolveCoverUrl(i.coverImage)} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} style={{ width: '52px', height: '38px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, background: 'var(--bg-muted)' }} />
                          <span style={{ minWidth: 0 }}>
                            <span title={isAr ? i.titleAr : i.titleEn} style={{ display: 'block', fontWeight: 800, fontSize: '0.86rem', color: 'var(--gov-primary-900)', lineHeight: 1.4, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isAr ? i.titleAr : i.titleEn}</span>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {(isAr ? i.category : i.categoryEn) || '—'}
                              {i.updatedAt && <> · {isAr ? 'عُدّلت' : 'updated'} {new Date(i.updatedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}</>}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                          <Badge tone={meta.tone}>{isAr ? meta.ar : meta.en}</Badge>
                          {!meta.isPublic && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              <EyeOff size={11} /> {isAr ? 'مخفية عن الجمهور' : 'Hidden from public'}
                            </span>
                          )}
                          <StatusSelect initiative={i} openApps={r.open} isAr={isAr} compact />
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.82rem' }}>{i.budgetTotalEGP ? formatEGP(i.budgetTotalEGP, isAr) : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>{fmtN(r.total)}</div>
                        {r.total > 0 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {isAr ? `${fmtN(r.open)} مفتوحة · ${fmtN(r.approved)} معتمدة` : `${r.open} open · ${r.approved} approved`}
                          </div>
                        )}
                      </td>
                      <td style={{ minWidth: '120px' }} title={r.completeness.missing.length ? `${isAr ? 'ناقص' : 'Missing'}: ${r.completeness.missing.map(m => (isAr ? m.ar : m.en)).join('، ')}` : undefined}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <div role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={isAr ? 'اكتمال البيانات' : 'Data completeness'} style={{ flex: 1, height: '6px', background: 'var(--bg-muted)', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '9999px', background: pct === 100 ? 'var(--status-approved-text)' : 'var(--gov-primary-700)' }} />
                          </div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                            {pct === 100 && <CheckCircle2 size={12} style={{ color: 'var(--status-approved-text)' }} />}
                            {fmtN(pct)}٪
                          </span>
                        </div>
                        {r.completeness.missing.length > 0 && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {isAr ? `${fmtN(r.completeness.missing.length)} بنود ناقصة` : `${r.completeness.missing.length} missing`}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', maxWidth: '120px' }}>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('admin-initiative', i.id)} style={{ whiteSpace: 'nowrap', width: '100%', justifyContent: 'center' }}>
                            <Settings2 size={14} /><span>{isAr ? 'إدارة' : 'Manage'}</span>
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} onClick={() => navigate('initiative-detail', i.id)} title={isAr ? 'معاينة صفحة المبادرة' : 'Preview page'} aria-label={isAr ? 'معاينة' : 'Preview'}><Eye size={15} /></button>
                          <button type="button" className="btn btn-secondary btn-sm" style={iconBtn} disabled={busy} onClick={() => { void handleDuplicate(i); }} title={isAr ? 'نسخ كمسودة' : 'Duplicate as draft'} aria-label={isAr ? 'نسخ' : 'Duplicate'}><Copy size={15} /></button>
                          {canDelete && (
                            <button type="button" className="btn btn-secondary btn-sm" style={{ ...iconBtn, color: 'var(--gov-crimson)' }}
                              disabled={busy || r.total > 0}
                              onClick={() => { void handleDelete(i); }}
                              title={r.total > 0 ? (isAr ? `لا يمكن الحذف — عليها ${r.total} طلب. أرشفها بدلاً من ذلك.` : `Cannot delete — has ${r.total} application(s). Archive it instead.`) : (isAr ? 'حذف نهائي' : 'Delete permanently')}
                              aria-label={isAr ? 'حذف' : 'Delete'}><Trash2 size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <EditInitiativeModal initiative={null} onClose={() => setCreating(false)} />}
    </div>
  );
};
