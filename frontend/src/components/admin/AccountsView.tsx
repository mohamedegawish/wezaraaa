import React, { useEffect, useState, useRef } from 'react';
import { usePlatformStore } from '../../store/state';
import { api } from '../../api';
import type { OrganizationShape, UserShape } from '../../api';
import { AdminPageHeader } from './AdminLayout';
import { ErrorBox } from '../ui/ErrorBox';
import { SkeletonTable } from '../common/SkeletonLoader';
import {
  Users,
  Plus,
  Pencil,
  X,
  Trash2,
  KeyRound,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

const ROLES = [
  { id: 'ministry_admin', ar: 'مشرف عام (وزارة)', en: 'Ministry Admin' },
  { id: 'initiative_manager', ar: 'مدير مبادرة', en: 'Initiative Manager' },
  { id: 'ida_reviewer', ar: 'مراجع IDA', en: 'IDA Reviewer' },
  { id: 'imc_reviewer', ar: 'مراجع IMC', en: 'IMC Reviewer' },
  { id: 'bank_reviewer', ar: 'مراجع بنكي', en: 'Bank Reviewer' },
  { id: 'solar_provider', ar: 'مقدم خدمة طاقة', en: 'Energy Provider' },
  { id: 'factory_owner', ar: 'مالك مصنع', en: 'Factory Owner' },
  { id: 'auditor', ar: 'مدقق', en: 'Auditor' },
];

const roleName = (r: string, isAr: boolean) =>
  ROLES.find(x => x.id === r)?.[isAr ? 'ar' : 'en'] ?? r;

/** حسابات الجهات المسؤولة — صفحة مستقلة عن إدارة الجهات نفسها (OrganizationsView). */
export const AccountsView: React.FC = () => {
  const { language } = usePlatformStore();
  const isAr = language === 'ar';

  const [orgs, setOrgs] = useState<OrganizationShape[]>([]);
  const [accounts, setAccounts] = useState<UserShape[]>([]);
  const [acctOrgFilter, setAcctOrgFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showAcctForm, setShowAcctForm] = useState(false);
  const [editingAcct, setEditingAcct] = useState<UserShape | null>(null);
  const [acctForm, setAcctForm] = useState({ name: '', nameEn: '', email: '', role: 'ida_reviewer', organizationId: '', password: 'EgyOrg#2026' });
  const acctFormErrorRef = useRef<HTMLDivElement>(null);

  const reload = async () => {
    const [o, u] = await Promise.all([
      api.listOrganizations({ page: 1, pageSize: 100 }),
      api.listUsers({ organizationId: acctOrgFilter === 'ALL' ? undefined : acctOrgFilter, page: 1, pageSize: 200 }),
    ]);
    setOrgs(o.data);
    setAccounts(u.data);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reload()
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acctOrgFilter]);

  const flash = (msg: string) => { setOkMsg(msg); setError(''); window.setTimeout(() => setOkMsg(''), 4000); };
  const fail = (e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setOkMsg(''); };

  // ── Account CRUD ────────────────────────────────────────────────────────────

  const openNewAccount = () => {
    setEditingAcct(null);
    const defaultOrg = acctOrgFilter !== 'ALL' ? acctOrgFilter : (orgs.find(o => o.active)?.id ?? '');
    setAcctForm({ name: '', nameEn: '', email: '', role: 'ida_reviewer', organizationId: defaultOrg, password: `EgyOrg#${Math.floor(1000 + Math.random() * 9000)}` });
    setShowAcctForm(true);
  };

  const openEditAccount = (u: UserShape) => {
    setEditingAcct(u);
    setAcctForm({ name: u.name, nameEn: u.nameEn, email: u.email, role: u.role, organizationId: u.organizationId, password: u.password || '' });
    setShowAcctForm(true);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = 'Egy#';
    for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    setAcctForm(prev => ({ ...prev, password: res }));
  };

  const submitAccount = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      if (editingAcct) {
        await api.updateUser(editingAcct.id, {
          name: acctForm.name, nameEn: acctForm.nameEn, email: acctForm.email,
          role: acctForm.role as UserShape['role'], organizationId: acctForm.organizationId,
          password: acctForm.password || undefined,
        } as any);
        flash(isAr ? 'تم تحديث الحساب' : 'Account updated');
      } else {
        await api.createUser({
          name: acctForm.name, nameEn: acctForm.nameEn, email: acctForm.email,
          role: acctForm.role as UserShape['role'], organizationId: acctForm.organizationId,
          password: acctForm.password || 'EgyOrg#2026',
          mustChangePassword: true,
        } as any);
        flash(isAr ? 'تم إنشاء الحساب وتعيين كلمة المرور المؤقتة' : 'Account created with temporary password');
      }
      setShowAcctForm(false);
      setAcctForm({ name: '', nameEn: '', email: '', role: 'ida_reviewer', organizationId: '', password: 'EgyOrg#2026' });
      await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const deleteAccount = async (u: UserShape) => {
    const confirmMsg = isAr ? `هل أنت متأكد من حذف حساب "${u.name}"؟` : `Delete account "${u.nameEn}"?`;
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await api.deleteUser(u.id);
      flash(isAr ? 'تم حذف الحساب' : 'Account deleted');
      await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const inputStyle: React.CSSProperties = { width: '100%' };

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      <AdminPageHeader
        title={isAr ? 'حسابات الجهات المسؤولة' : 'Organization Accounts'}
        description={isAr
          ? 'إنشاء حسابات المستخدمين التابعة لكل جهة مسؤولة وتحديد دور كل حساب وكلمة مروره المؤقتة.'
          : 'Create user accounts for each responsible organization and assign their role and temporary password.'}
      />

      <ErrorBox message={error} style={{ marginBottom: '1rem' }} />
      {okMsg && (
        <div className="card" style={{ padding: '0.9rem 1.25rem', marginBottom: '1rem', borderInlineStart: '4px solid var(--status-approved-text)', background: 'var(--status-approved-bg)', color: 'var(--status-approved-text)', fontWeight: 700 }}>
          {okMsg}
        </div>
      )}

      {/* ===== Accounts ===== */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Users size={20} /> {isAr ? `حسابات الجهات (${accounts.length})` : `Accounts (${accounts.length})`}
          </h2>
          <button className="btn btn-primary btn-sm" onClick={openNewAccount}>
            <Plus size={16} /> <span>{isAr ? 'إضافة حساب' : 'Add Account'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 'auto', minWidth: '220px' }} value={acctOrgFilter} onChange={e => setAcctOrgFilter(e.target.value)}>
            <option value="ALL">{isAr ? 'كل الجهات' : 'All organizations'}</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{isAr ? o.nameAr : o.nameEn}</option>)}
          </select>
        </div>

        {loading && accounts.length === 0 ? (
          <SkeletonTable rows={5} />
        ) : (
        <div className="table-responsive timeline-scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'البريد' : 'Email'}</th>
                <th>{isAr ? 'الدور' : 'Role'}</th>
                <th>{isAr ? 'الجهة' : 'Organization'}</th>
                <th>{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(u => {
                const org = orgs.find(o => o.id === u.organizationId);
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{isAr ? u.name : u.nameEn}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? u.nameEn : u.name}</div>
                    </td>
                    <td style={{ direction: 'ltr' }}>{u.email}</td>
                    <td>{roleName(u.role, isAr)}</td>
                    <td>{org ? (isAr ? org.nameAr : org.nameEn) : u.organizationId}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm" title={isAr ? 'تعديل' : 'Edit'} onClick={() => openEditAccount(u)}
                          style={{ border: '1px solid var(--gov-gold)', borderRadius: '6px', padding: '0.25rem 0.5rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                          <Pencil size={13} /> {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button className="btn btn-sm" title={isAr ? 'حذف' : 'Delete'} onClick={() => deleteAccount(u)}
                          style={{ border: '1px solid var(--gov-crimson)', borderRadius: '6px', padding: '0.25rem 0.5rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center', color: 'var(--gov-crimson)' }}>
                          <Trash2 size={13} /> {isAr ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {accounts.length === 0 && (
                <tr><td colSpan={5} className="card-empty">
                  <div className="card-empty-icon"><Users size={22} /></div>
                  {isAr ? 'لا توجد حسابات.' : 'No accounts.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* ===== Account form modal ===== */}
      {showAcctForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay-backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={20} style={{ color: 'var(--egypt-red)' }} />
                <h3 style={{ fontWeight: 800, margin: 0 }}>{editingAcct ? (isAr ? 'تعديل حساب مسؤول' : 'Edit Official Account') : (isAr ? 'إضافة حساب لجهة مسؤولة' : 'Add Organization Account')}</h3>
              </div>
              <button type="button" onClick={() => setShowAcctForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Security Explanation Notice */}
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '1rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start', color: '#92400E', fontSize: '0.8rem', lineHeight: 1.5 }}>
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#D97706' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '0.2rem' }}>{isAr ? 'ضوابط كلمة المرور المؤقتة والإلزامية:' : 'Temporary Password Policy:'}</strong>
                <span>
                  {isAr
                    ? 'يضع الأدمن كلمة مرور مؤقتة للحساب، ويُلزم ممثل الجهة بتغييرها فور أول تسجيل دخول للمنصة لضمان سرية وأمان الصلاحيات.'
                    : 'Admin sets a temporary password. The organization user will be required to change it on their first login for security.'}
                </span>
              </div>
            </div>

            <form onSubmit={submitAccount} noValidate style={{ display: 'grid', gap: '0.75rem' }}>
              <label>{isAr ? 'الجهة *' : 'Organization *'}
                <select className="form-control" value={acctForm.organizationId} onChange={e => setAcctForm({ ...acctForm, organizationId: e.target.value })} style={inputStyle} required aria-required="true">
                  <option value="">{isAr ? 'اختر الجهة...' : 'Select organization...'}</option>
                  {orgs.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{isAr ? o.nameAr : o.nameEn}</option>)}
                </select></label>
              <label>{isAr ? 'الاسم بالعربية *' : 'Arabic name *'}
                <input className="form-control" value={acctForm.name} onChange={e => setAcctForm({ ...acctForm, name: e.target.value })} style={inputStyle} required aria-required="true" /></label>
              <label>{isAr ? 'الاسم بالإنجليزية *' : 'English name *'}
                <input className="form-control" value={acctForm.nameEn} onChange={e => setAcctForm({ ...acctForm, nameEn: e.target.value })} style={{ ...inputStyle, direction: 'ltr' }} required aria-required="true" /></label>
              <label>{isAr ? 'البريد الإلكتروني * (فريد)' : 'Email * (unique)'}
                <input className="form-control" type="email" value={acctForm.email} onChange={e => setAcctForm({ ...acctForm, email: e.target.value })} style={{ ...inputStyle, direction: 'ltr' }} required aria-required="true" /></label>
              <label>{isAr ? 'الدور *' : 'Role *'}
                <select className="form-control" value={acctForm.role} onChange={e => setAcctForm({ ...acctForm, role: e.target.value })} style={inputStyle} required aria-required="true">
                  {ROLES.map(r => <option key={r.id} value={r.id}>{isAr ? r.ar : r.en}</option>)}
                </select></label>

              {/* Password Field */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>
                    {editingAcct ? (isAr ? 'تعيين كلمة مرور جديدة (اختياري)' : 'Reset Password (optional)') : (isAr ? 'كلمة المرور المؤقتة *' : 'Temporary Password *')}
                  </label>
                  <button type="button" onClick={generateRandomPassword} style={{ background: 'none', border: 'none', color: 'var(--egypt-red)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Sparkles size={12} /> {isAr ? 'توليد تلقائي' : 'Generate'}
                  </button>
                </div>
                <input
                  className="form-control"
                  type="text"
                  dir="ltr"
                  value={acctForm.password}
                  onChange={e => setAcctForm({ ...acctForm, password: e.target.value })}
                  placeholder="e.g. EgyOrg#2026"
                  style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 700 }}
                  {...(editingAcct ? {} : { required: true, 'aria-required': 'true' })}
                />
              </div>

              <div ref={acctFormErrorRef} aria-live="polite"><ErrorBox message={error && !okMsg ? error : null} /></div>
              <button className="btn btn-primary" type="submit"
                style={{ marginTop: '0.5rem' }}
                disabled={busy || !acctForm.organizationId || !acctForm.name.trim() || !acctForm.nameEn.trim() || !acctForm.email.trim() || (!editingAcct && !acctForm.password.trim())}>
                {editingAcct ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إنشاء الحساب وتفعيل كلمة المرور' : 'Create Account & Set Temp Password')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
