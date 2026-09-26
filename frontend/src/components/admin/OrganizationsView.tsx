import React, { useEffect, useState, useRef } from 'react';
import { usePlatformStore } from '../../store/state';
import { api } from '../../api';
import type { OrganizationShape } from '../../api';
import { AdminPageHeader } from './AdminLayout';
import { ErrorBox } from '../ui/ErrorBox';
import { SkeletonTable } from '../common/SkeletonLoader';
import {
  Building2,
  Search,
  Plus,
  Pencil,
  Power,
  X,
  Trash2,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

const ORG_TYPES = [
  { id: 'ministry', ar: 'وزارة', en: 'Ministry' },
  { id: 'authority', ar: 'هيئة', en: 'Authority' },
  { id: 'center', ar: 'مركز', en: 'Center' },
  { id: 'bank', ar: 'بنك', en: 'Bank' },
  { id: 'utility', ar: 'مرفق خدمي', en: 'Utility' },
  { id: 'provider', ar: 'مقدم خدمة', en: 'Provider' },
  { id: 'factory', ar: 'مصنع', en: 'Factory' },
];

const typeName = (t: string, isAr: boolean) =>
  ORG_TYPES.find(x => x.id === t)?.[isAr ? 'ar' : 'en'] ?? t;

function readAsDataUrl(file: File, maxMB = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) { reject(new Error(`Image too large (max ${maxMB}MB)`)); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** الجهات المسؤولة — حساباتها في صفحة مستقلة (AccountsView). */
export const OrganizationsView: React.FC = () => {
  const { language } = usePlatformStore();
  const isAr = language === 'ar';

  const [orgs, setOrgs] = useState<OrganizationShape[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgTypeFilter, setOrgTypeFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationShape | null>(null);
  const [orgForm, setOrgForm] = useState({ code: '', nameAr: '', nameEn: '', type: 'authority', contactEmail: '', logoImage: '' });
  const orgFileRef = useRef<HTMLInputElement>(null);
  const orgFormErrorRef = useRef<HTMLDivElement>(null);

  const reload = async () => {
    const o = await api.listOrganizations({ q: orgSearch || undefined, type: orgTypeFilter === 'ALL' ? undefined : orgTypeFilter, page: 1, pageSize: 100 });
    setOrgs(o.data);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reload()
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSearch, orgTypeFilter]);

  const flash = (msg: string) => { setOkMsg(msg); setError(''); window.setTimeout(() => setOkMsg(''), 4000); };
  const fail = (e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setOkMsg(''); };

  // ── Org CRUD ────────────────────────────────────────────────────────────────

  const openNewOrg = () => {
    setEditingOrg(null);
    setOrgForm({ code: '', nameAr: '', nameEn: '', type: 'authority', contactEmail: '', logoImage: '' });
    setShowOrgForm(true);
  };

  const openEditOrg = (o: OrganizationShape) => {
    setEditingOrg(o);
    setOrgForm({ code: o.code, nameAr: o.nameAr, nameEn: o.nameEn, type: o.type, contactEmail: o.contactEmail, logoImage: (o as any).logoImage || '' });
    setShowOrgForm(true);
  };

  const handleOrgLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      setOrgForm(prev => ({ ...prev, logoImage: dataUrl }));
    } catch (err) { fail(err); }
    e.target.value = '';
  };

  const submitOrg = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      if (editingOrg) {
        await api.updateOrganization(editingOrg.id, {
          code: orgForm.code, nameAr: orgForm.nameAr, nameEn: orgForm.nameEn,
          type: orgForm.type as OrganizationShape['type'], contactEmail: orgForm.contactEmail,
          logoImage: orgForm.logoImage || undefined,
        } as any);
        flash(isAr ? 'تم حفظ الجهة' : 'Organization saved');
      } else {
        await api.createOrganization({
          code: orgForm.code, nameAr: orgForm.nameAr, nameEn: orgForm.nameEn,
          type: orgForm.type as OrganizationShape['type'], contactEmail: orgForm.contactEmail || undefined,
        });
        flash(isAr ? 'تم إنشاء الجهة' : 'Organization created');
      }
      setShowOrgForm(false);
      await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const toggleOrg = async (o: OrganizationShape) => {
    setBusy(true);
    try {
      await api.updateOrganization(o.id, { active: !o.active });
      flash(o.active
        ? (isAr ? `تم إيقاف ${o.nameAr}` : `${o.nameEn} deactivated`)
        : (isAr ? `تم تفعيل ${o.nameAr}` : `${o.nameEn} activated`));
      await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const inputStyle: React.CSSProperties = { width: '100%' };

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      <AdminPageHeader
        title={isAr ? 'إدارة الجهات المسؤولة' : 'Responsible Organizations'}
        description={isAr
          ? 'إضافة جهة مسؤولة جديدة (هيئة، بنك، مركز، مقدم خدمة) وتعديل بياناتها وتفعيلها أو إيقافها. حسابات مستخدمي الجهات في صفحة «حسابات الجهات».'
          : 'Add, edit and activate/deactivate responsible organizations. Their user accounts are managed on the «Accounts» page.'}
      />

      <ErrorBox message={error} style={{ marginBottom: '1rem' }} />
      {okMsg && (
        <div className="card" style={{ padding: '0.9rem 1.25rem', marginBottom: '1rem', borderInlineStart: '4px solid var(--status-approved-text)', background: 'var(--status-approved-bg)', color: 'var(--status-approved-text)', fontWeight: 700 }}>
          {okMsg}
        </div>
      )}

      {/* ===== Organizations ===== */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Building2 size={20} /> {isAr ? `الجهات المسؤولة (${orgs.length})` : `Organizations (${orgs.length})`}
          </h2>
          <button className="btn btn-primary btn-sm" onClick={openNewOrg}>
            <Plus size={16} /> <span>{isAr ? 'إضافة جهة' : 'Add Organization'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.85rem', color: 'var(--text-muted)' }} />
            <input type="text" className="form-control" placeholder={isAr ? 'بحث بالاسم أو الكود...' : 'Search name or code...'}
              value={orgSearch} onChange={e => setOrgSearch(e.target.value)} style={{ paddingInlineStart: '2.5rem', width: '100%' }} />
          </div>
          <select className="form-control" style={{ width: 'auto', minWidth: '170px' }} value={orgTypeFilter} onChange={e => setOrgTypeFilter(e.target.value)}>
            <option value="ALL">{isAr ? 'كل الأنواع' : 'All types'}</option>
            {ORG_TYPES.map(t => <option key={t.id} value={t.id}>{isAr ? t.ar : t.en}</option>)}
          </select>
        </div>

        {loading && orgs.length === 0 ? (
          <SkeletonTable rows={5} />
        ) : (
        <div className="table-responsive timeline-scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الشعار' : 'Logo'}</th>
                <th>{isAr ? 'الكود' : 'Code'}</th>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'النوع' : 'Type'}</th>
                <th>{isAr ? 'البريد' : 'Email'}</th>
                <th>{isAr ? 'الحالة' : 'Status'}</th>
                <th>{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => {
                const logo = (o as any).logoImage as string | undefined;
                return (
                  <tr key={o.id}>
                    <td>
                      {logo ? (
                        <img loading="lazy" decoding="async" src={logo} alt="" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          {o.code.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 800, direction: 'ltr' }}>{o.code}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{isAr ? o.nameAr : o.nameEn}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? o.nameEn : o.nameAr}</div>
                    </td>
                    <td>{typeName(o.type, isAr)}</td>
                    <td style={{ direction: 'ltr' }}>{o.contactEmail || '—'}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: o.active ? 'var(--status-approved-text)' : 'var(--status-pending-text)' }}>
                        {o.active ? (isAr ? 'نشطة' : 'Active') : (isAr ? 'موقوفة' : 'Inactive')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm" title={isAr ? 'تعديل' : 'Edit'} onClick={() => openEditOrg(o)}
                          style={{ border: '1px solid var(--gov-gold)', borderRadius: '6px', padding: '0.25rem 0.5rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                          <Pencil size={13} /> {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button className="btn btn-sm" title={o.active ? (isAr ? 'إيقاف' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate')} onClick={() => toggleOrg(o)}
                          style={{ border: '1px solid var(--status-pending-text)', borderRadius: '6px', padding: '0.25rem 0.5rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center', color: 'var(--status-pending-text)' }}>
                          <Power size={13} /> {o.active ? (isAr ? 'إيقاف' : 'Stop') : (isAr ? 'تفعيل' : 'Enable')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orgs.length === 0 && (
                <tr><td colSpan={7} className="card-empty">
                  <div className="card-empty-icon"><Building2 size={22} /></div>
                  {isAr ? 'لا توجد جهات مطابقة.' : 'No organizations found.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* ===== Org form modal ===== */}
      {showOrgForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800 }}>{editingOrg ? (isAr ? 'تعديل جهة' : 'Edit Organization') : (isAr ? 'إضافة جهة مسؤولة' : 'Add Organization')}</h3>
              <button type="button" onClick={() => setShowOrgForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Logo upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {orgForm.logoImage ? (
                <img loading="lazy" decoding="async" src={orgForm.logoImage} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <ImageIcon size={20} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  {isAr ? 'شعار الجهة' : 'Organization Logo'}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Upload size={13} /> {isAr ? 'رفع من الجهاز' : 'Upload'}
                    <input ref={orgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOrgLogoUpload} />
                  </label>
                  {orgForm.logoImage && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOrgForm(prev => ({ ...prev, logoImage: '' }))} style={{ color: 'var(--gov-crimson)' }}>
                      <Trash2 size={13} /> {isAr ? 'إزالة' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={submitOrg} noValidate style={{ display: 'grid', gap: '0.75rem' }}>
              <label>{isAr ? 'الكود (فريد، مثال: IDA)' : 'Code (unique, e.g. IDA)'}
                <input className="form-control" value={orgForm.code} onChange={e => setOrgForm({ ...orgForm, code: e.target.value })} style={{ ...inputStyle, direction: 'ltr' }} disabled={!!editingOrg} required={!editingOrg} aria-required="true" /></label>
              <label>{isAr ? 'الاسم بالعربية *' : 'Arabic name *'}
                <input className="form-control" value={orgForm.nameAr} onChange={e => setOrgForm({ ...orgForm, nameAr: e.target.value })} style={inputStyle} required aria-required="true" /></label>
              <label>{isAr ? 'الاسم بالإنجليزية *' : 'English name *'}
                <input className="form-control" value={orgForm.nameEn} onChange={e => setOrgForm({ ...orgForm, nameEn: e.target.value })} style={{ ...inputStyle, direction: 'ltr' }} required aria-required="true" /></label>
              <label>{isAr ? 'النوع' : 'Type'}
                <select className="form-control" value={orgForm.type} onChange={e => setOrgForm({ ...orgForm, type: e.target.value })} style={inputStyle}>
                  {ORG_TYPES.map(t => <option key={t.id} value={t.id}>{isAr ? t.ar : t.en}</option>)}
                </select></label>
              <label>{isAr ? 'البريد الرسمي' : 'Contact email'}
                <input className="form-control" type="email" value={orgForm.contactEmail} onChange={e => setOrgForm({ ...orgForm, contactEmail: e.target.value })} style={{ ...inputStyle, direction: 'ltr' }} /></label>
              <div ref={orgFormErrorRef} aria-live="polite"><ErrorBox message={error && !okMsg ? error : null} /></div>
              <button className="btn btn-primary" type="submit" disabled={busy || !orgForm.nameAr.trim() || !orgForm.nameEn.trim() || (!editingOrg && !orgForm.code.trim())}>
                {isAr ? 'حفظ الجهة' : 'Save Organization'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
