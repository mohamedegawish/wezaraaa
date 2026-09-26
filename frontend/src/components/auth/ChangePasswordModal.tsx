import React, { useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { api } from '../../api';
import { useToast } from '../common/ToastSystem';
import { Lock, KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
import { User } from '../../types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  isForced?: boolean;
  user: User;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  isForced = false,
  user,
  onClose,
  onSuccess,
}) => {
  const { language } = usePlatformStore();
  const { toast } = useToast();
  const isAr = language === 'ar';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError(isAr ? 'يرجى إدخال كلمة المرور الحالية / المؤقتة.' : 'Please enter current / temporary password.');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(isAr ? 'كلمة المرور 8 أحرف على الأقل وتحتوي حرفاً ورقماً.' : 'Password must be 8+ chars with letter+digit.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isAr ? 'تأكيد كلمة المرور غير متطابق.' : 'Password confirmation does not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError(isAr ? 'يجب اختيار كلمة مرور جديدة تختلف عن كلمة المرور المؤقتة.' : 'New password must be different from current password.');
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      // Refresh session so mustChangePassword clears without re-login.
      try { await api.me(); } catch { /* session verified by password change itself */ }
      toast('success', isAr ? 'تم تحديث كلمة المرور بنجاح وبدء تفعيل الحساب' : 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isAr ? 'فشل تحديث كلمة المرور.' : 'Failed to change password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.25rem',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => {
        if (!isForced) onClose();
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          background: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-medium)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isForced ? '#FFFBEB' : '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: isForced ? '#F59E0B' : 'var(--egypt-red)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KeyRound size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {isForced
                  ? (isAr ? 'تغيير كلمة المرور الإلزامي' : 'Mandatory Password Change')
                  : (isAr ? 'تغيير كلمة المرور' : 'Change Password')}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? user.name : user.nameEn} ({user.email})
              </div>
            </div>
          </div>

          {!isForced && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {isForced && (
            <div
              style={{
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                marginBottom: '1.25rem',
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'flex-start',
                color: '#92400E',
                fontSize: '0.8rem',
                lineHeight: 1.5,
              }}
            >
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#D97706' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '0.2rem' }}>
                  {isAr ? 'تسجيل دخول أول مرة للمنصة:' : 'First-time Login Notice:'}
                </strong>
                <span>
                  {isAr
                    ? 'تم إنشاء حسابك بكلمة مرور مؤقتة من قبل الإدارة. لضمان أمان النظام وحماية بيانات منشأتك/جهتك، يلزم تعيين كلمة مرور سرية جديدة خاصة بك للمتابعة.'
                    : 'Your account was initialized with a temporary password. You must set a private password to proceed.'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="error-box" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label required">
              {isForced
                ? (isAr ? 'كلمة المرور المؤقتة الحالية' : 'Current Temporary Password')
                : (isAr ? 'كلمة المرور الحالية' : 'Current Password')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                className="form-control"
                dir="ltr"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ paddingInlineEnd: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  insetInlineEnd: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label required">{isAr ? 'كلمة المرور الجديدة' : 'New Password'}</label>
            <input
              type={showPass ? 'text' : 'password'}
              className="form-control"
              dir="ltr"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <div className="form-helper">{isAr ? '8 أحرف على الأقل وتحتوي حرفاً ورقماً.' : '8+ chars, letter+digit.'}</div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label required">{isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</label>
            <input
              type={showPass ? 'text' : 'password'}
              className="form-control"
              dir="ltr"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {!isForced && (
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !currentPassword || !newPassword || !confirmPassword}
              style={{ flex: isForced ? 1 : undefined }}
            >
              <CheckCircle2 size={16} />
              <span>{isAr ? 'حفظ وتأكيد كلمة المرور' : 'Save & Confirm Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
