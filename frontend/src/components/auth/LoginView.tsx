import React, { useEffect, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { useToast } from '../common/ToastSystem';
import {
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  Building2,
  Factory,
  ShieldCheck,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { EgyptianEagle } from '../common/EgyptianEagle';
import { ChangePasswordModal } from './ChangePasswordModal';

const INDUSTRIAL_SECTORS = [
  { ar: 'الصناعات الهندسية والإلكترونية', en: 'Engineering & Electronics' },
  { ar: 'الصناعات الكيماوية والبتروكيماويات', en: 'Chemicals & Petrochemicals' },
  { ar: 'صناعة الغزل والنسيج والملابس الجاهزة', en: 'Textiles & Garments' },
  { ar: 'الصناعات الغذائية والحاصلات الزراعية', en: 'Food & Agro-Industries' },
  { ar: 'الصناعات التعدينية والمعدنية', en: 'Mining & Metallurgical' },
  { ar: 'صناعة مواد البناء والحراريات', en: 'Building Materials & Ceramics' },
  { ar: 'صناعات الطاقة النظيفة والتكنولوجيا الخضراء', en: 'Clean Energy & Green Tech' },
  { ar: 'الصناعات الدوائية والطبية', en: 'Pharmaceuticals & Medical' },
];

const GOVERNORATES = [
  { ar: 'القاهرة', en: 'Cairo' },
  { ar: 'الجيزة', en: 'Giza' },
  { ar: 'الإسكندرية', en: 'Alexandria' },
  { ar: 'الشرقية (العاشر من رمضان)', en: 'Sharqia (10th of Ramadan)' },
  { ar: 'القليوبية (العبور والخانكة)', en: 'Qalyubia (Obour)' },
  { ar: 'المنوفية (مدينة السادات)', en: 'Menofia (Sadat City)' },
  { ar: 'السويس (المنطقة الاقتصادية)', en: 'Suez (SCZone)' },
  { ar: 'بورسعيد', en: 'Port Said' },
  { ar: 'بني سويف', en: 'Beni Suef' },
  { ar: 'المنيا', en: 'Minya' },
  { ar: 'أسيوط', en: 'Asyut' },
];

export const LoginView: React.FC = () => {
  const {
    language,
    login,
    registerFactory,
    navigate,
    getDefaultView,
  } = usePlatformStore();
  const { toast } = useToast();
  const isAr = language === 'ar';

  // Tabs: 'factory' | 'official'
  const [authTab, setAuthTab] = useState<'factory' | 'official'>('factory');
  // Subtab for factory: 'signin' | 'signup'
  const [factoryMode, setFactoryMode] = useState<'signin' | 'signup'>('signin');

  // Sign in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Forced password change modal state
  const [forcedUser, setForcedUser] = useState<any>(null);

  // Registration state
  const [regData, setRegData] = useState({
    name: '',
    nameEn: '',
    email: '',
    password: '',
    confirmPassword: '',
    factoryNameAr: '',
    factoryNameEn: '',
    commercialRegistrationNumber: '',
    industrialRegistrationNumber: '',
    taxIdNumber: '',
    sector: INDUSTRIAL_SECTORS[0].ar,
    sectorEn: INDUSTRIAL_SECTORS[0].en,
    governorate: GOVERNORATES[0].ar,
    governorateEn: GOVERNORATES[0].en,
    phone: '',
  });

  // PROD FIX: لا تطبع كلمات مرور أبداً — حتى في dev اعرض تنبيه بدون أسرار.
  // (كان console.table يعرض كل الإيميلات والباسوردات plaintext).
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info('%c[dev] LoginView ready — demo accounts are seeded in backend DB. Use backend seed emails.', 'color:#38BDF8');
    }
  }, []);

  const [resendBusy, setResendBusy] = useState(false);
  // Handle Official or Factory Login — real JWT via the API (no local lookup).
  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(isAr ? 'يرجى إدخال البريد الإلكتروني.' : 'Please enter your email.');
      return;
    }
    if (!password) {
      setError(isAr ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.');
      return;
    }

    setBusy(true);
    try {
      const user = await login(email, password);

      // Check if this user is required to change password on first login
      if (user.mustChangePassword) {
        setForcedUser(user);
        setBusy(false);
        return;
      }

      toast('success', isAr ? `مرحباً بك، ${user.name}` : `Welcome, ${user.nameEn}`);
      navigate(getDefaultView(user));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const code = (err as { apiError?: { code?: string } })?.apiError?.code ?? '';
      if (code === 'EMAIL_NOT_VERIFIED' || msg.includes('غير مؤكد') || msg.includes('not verified')) {
        setError(isAr ? 'البريد غير مؤكد — يرجى تفعيل حسابك. تحقق من بريدك أو أعد الإرسال.' : 'Email not verified — check inbox or resend.');
        return;
      }
      setError(msg || (isAr ? 'تعذر تسجيل الدخول. تحقق من البيانات.' : 'Login failed. Check credentials.'));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) { setError(isAr ? 'أدخل بريدك أولاً.' : 'Enter your email first.'); return; }
    setResendBusy(true);
    try {
      const { api } = await import('../../api');
      await api.resendVerification(email.trim());
      toast('success', isAr ? 'تم إرسال رابط التفعيل — راجع بريدك.' : 'Verification link resent — check inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : (isAr ? 'تعذر الإرسال.' : 'Resend failed.'));
    } finally { setResendBusy(false); }
  };

  // Handle Factory Registration — real API account (org + factory + owner).
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regData.factoryNameAr.trim()) {
      setError(isAr ? 'اسم المنشأة بالعربية مطلوب.' : 'Factory name in Arabic is required.');
      return;
    }
    if (!regData.name.trim()) {
      setError(isAr ? 'اسم المفوض / الممثل مطلوب.' : 'Representative name is required.');
      return;
    }
    if (!regData.email.trim()) {
      setError(isAr ? 'البريد الإلكتروني مطلوب.' : 'Email is required.');
      return;
    }
    if (regData.password.length < 8 || !/[A-Za-z]/.test(regData.password) || !/\d/.test(regData.password)) {
      setError(isAr ? 'كلمة المرور 8 أحرف على الأقل وتحتوي حرفاً ورقماً.' : 'Password must be 8+ chars with letter+digit.');
      return;
    }
    if (regData.password !== regData.confirmPassword) {
      setError(isAr ? 'تأكيد كلمة المرور غير متطابق.' : 'Password confirmation does not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await registerFactory({
        name: regData.name,
        nameEn: regData.nameEn || regData.name,
        email: regData.email,
        password: regData.password,
        factoryNameAr: regData.factoryNameAr,
        factoryNameEn: regData.factoryNameEn,
        commercialRegistrationNumber: regData.commercialRegistrationNumber,
        industrialRegistrationNumber: regData.industrialRegistrationNumber,
        taxIdNumber: regData.taxIdNumber,
        sector: regData.sector,
        sectorEn: regData.sectorEn,
        governorate: regData.governorate,
        governorateEn: regData.governorateEn,
        phone: regData.phone,
      }) as unknown as { requiresVerification?: boolean; verificationToken?: string; name?: string };

      if ((res as { requiresVerification?: boolean }).requiresVerification) {
        const vt = (res as { verificationToken?: string }).verificationToken;
        toast('success', isAr ? `تم التسجيل — يرجى تفعيل بريدك. ${vt ? `رمز التفعيل: ${vt}` : 'راجع بريدك.'}` : 'Registered — please verify your email.');
        navigate('login');
        return;
      }
      const displayName = (res as { name?: string }).name ?? regData.factoryNameAr;
      toast('success', isAr ? `تم تسجيل منشأة "${displayName}" بنجاح!` : 'Factory registered successfully!');
      navigate('factory-portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : (isAr ? 'فشل إنشاء الحساب.' : 'Registration failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-custom" style={{ padding: '2.5rem 1.5rem 4rem 1.5rem', maxWidth: '820px' }}>
      <div
        className="login-shell"
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
        }}
      >
        {/* Top Sovereign Header */}
        <div
          style={{
            padding: '2.25rem 2rem 1.75rem',
            borderBottom: '1px solid var(--border-subtle)',
            textAlign: 'center',
            background: 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 'var(--radius-lg)',
              background: '#0F172A',
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
            }}
          >
            <EgyptianEagle size={42} />
          </div>

          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.5rem' }}>
            {isAr ? 'بوابة الدخول الموحدة للمنصة الصناعية' : 'Unified Industrial Platform Portal'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, maxWidth: '520px', marginInline: 'auto' }}>
            {isAr
              ? 'المنظومة الوطنية الموحدة للمبادرات والحوافز وتمويل المصانع المصرية — وزارة الصناعة'
              : 'National Unified Portal for Egyptian Industrial Initiatives & Incentives — Ministry of Industry'}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: 'var(--egypt-red)',
              fontWeight: 700,
              marginTop: '1rem',
            }}
          >
            <ShieldCheck size={16} />
            <span>{isAr ? 'بوابة حكومية رسمية مؤمنة' : 'Official Secured Sovereign Portal'}</span>
          </div>
        </div>

        {/* Portal Selection Tabs (Factory vs Government Official) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid var(--border-subtle)',
            background: '#F8FAFC',
          }}
        >
          <button
            type="button"
            onClick={() => { setAuthTab('factory'); setError(''); }}
            style={{
              padding: '1.1rem 1rem',
              background: authTab === 'factory' ? '#FFFFFF' : 'transparent',
              border: 'none',
              borderBottom: authTab === 'factory' ? '3px solid var(--egypt-red)' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              fontWeight: authTab === 'factory' ? 800 : 600,
              color: authTab === 'factory' ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '0.92rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Factory size={18} style={{ color: authTab === 'factory' ? 'var(--egypt-red)' : 'var(--text-muted)' }} />
            <span>{isAr ? 'المنشآت الصناعية والمستثمرون' : 'Industrial Facilities & Investors'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setAuthTab('official'); setError(''); }}
            style={{
              padding: '1.1rem 1rem',
              background: authTab === 'official' ? '#FFFFFF' : 'transparent',
              border: 'none',
              borderBottom: authTab === 'official' ? '3px solid var(--egypt-red)' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              fontWeight: authTab === 'official' ? 800 : 600,
              color: authTab === 'official' ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '0.92rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Building2 size={18} style={{ color: authTab === 'official' ? 'var(--egypt-red)' : 'var(--text-muted)' }} />
            <span>{isAr ? 'المسؤولون والجهات الحكومية' : 'Government Officials & Reviewers'}</span>
          </button>
        </div>

        {/* Tab 1: Factory / Investor Portal */}
        {authTab === 'factory' && (
          <div style={{ padding: '2rem' }}>
            {/* Sub-toggle: Sign In vs Sign Up */}
            <div
              style={{
                display: 'flex',
                background: '#F1F5F9',
                padding: '0.3rem',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '1.75rem',
              }}
            >
              <button
                type="button"
                onClick={() => { setFactoryMode('signin'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: factoryMode === 'signin' ? '#FFFFFF' : 'transparent',
                  color: factoryMode === 'signin' ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: factoryMode === 'signin' ? 800 : 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: factoryMode === 'signin' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {isAr ? 'تسجيل الدخول لمنشأتك' : 'Sign In to Facility'}
              </button>

              <button
                type="button"
                onClick={() => { setFactoryMode('signup'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: factoryMode === 'signup' ? '#FFFFFF' : 'transparent',
                  color: factoryMode === 'signup' ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: factoryMode === 'signup' ? 800 : 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: factoryMode === 'signup' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {isAr ? 'تسجيل منشأة جديدة (حساب جديد)' : 'Register New Facility'}
              </button>
            </div>

            {error && (
              <div className="error-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
                {(error.includes('غير مؤكد') || error.toLowerCase().includes('not verified')) && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleResend} disabled={resendBusy} style={{ alignSelf: 'flex-start' }}>
                    {resendBusy ? (isAr ? 'جارٍ الإرسال...' : 'Sending...') : (isAr ? 'إعادة إرسال رابط التفعيل' : 'Resend verification link')}
                  </button>
                )}
              </div>
            )}

            {/* Factory Sign In Form */}
            {factoryMode === 'signin' && (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label required" htmlFor="fac-login-email">{isAr ? 'البريد الإلكتروني للمنشأة' : 'Email'}</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.75rem', color: 'var(--text-muted)' }} />
                    <input
                      id="fac-login-email"
                      type="email"
                      className="form-control"
                      dir="ltr"
                      placeholder="m.sewedy@elsewedy-ind.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{ paddingInlineStart: '2.4rem', textAlign: 'left' }}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label required" htmlFor="fac-login-pass" style={{ margin: 0 }}>{isAr ? 'كلمة المرور' : 'Password'}</label>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.75rem', color: 'var(--text-muted)' }} />
                    <input
                      id="fac-login-pass"
                      type={showPass ? 'text' : 'password'}
                      className="form-control"
                      dir="ltr"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      style={{ paddingInlineStart: '2.4rem', paddingInlineEnd: '2.5rem', textAlign: 'left' }}
                      autoComplete="current-password"
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

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '0.5rem' }} disabled={busy}>
                  <LogIn size={16} />
                  <span>{busy ? (isAr ? 'جاري التحقق...' : 'Signing in...') : (isAr ? 'دخول المنشأة' : 'Sign in')}</span>
                </button>

                <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>{isAr ? 'ليس لديك حساب منشأة مسجل؟ ' : "Don't have a registered facility? "}</span>
                  <button
                    type="button"
                    onClick={() => setFactoryMode('signup')}
                    style={{ background: 'none', border: 'none', color: 'var(--egypt-red)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    {isAr ? 'سجل منشأتك الآن' : 'Register now'}
                  </button>
                </div>
              </form>
            )}

            {/* Factory Registration Form */}
            {factoryMode === 'signup' && (
              <form onSubmit={handleRegister}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">{isAr ? 'اسم المنشأة الصناعية (عربي)' : 'Factory Name (AR)'}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={regData.factoryNameAr}
                      onChange={e => setRegData({ ...regData, factoryNameAr: e.target.value })}
                      placeholder={isAr ? 'مثال: شركة النيل للصناعات الهندسية' : 'e.g. Nile Engineering Industries'}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{isAr ? 'اسم المنشأة (إنجليزي - اختياري)' : 'Factory Name (EN)'}</label>
                    <input
                      type="text"
                      className="form-control"
                      dir="ltr"
                      value={regData.factoryNameEn}
                      onChange={e => setRegData({ ...regData, factoryNameEn: e.target.value })}
                      placeholder="e.g. Nile Engineering Industries"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">{isAr ? 'اسم المفوض / الممثل الرسمي' : 'Authorized Representative'}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={regData.name}
                      onChange={e => setRegData({ ...regData, name: e.target.value })}
                      placeholder={isAr ? 'مثال: م. أحمد عبد الله' : 'e.g. Eng. Ahmed Abdullah'}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{isAr ? 'رقم الهاتف للتواصل' : 'Phone'}</label>
                    <input
                      type="text"
                      className="form-control"
                      dir="ltr"
                      value={regData.phone}
                      onChange={e => setRegData({ ...regData, phone: e.target.value })}
                      placeholder="+20 100 123 4567"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{isAr ? 'رقم السجل التجاري' : 'Commercial Reg #'}</label>
                    <input
                      type="text"
                      className="form-control"
                      dir="ltr"
                      value={regData.commercialRegistrationNumber}
                      onChange={e => setRegData({ ...regData, commercialRegistrationNumber: e.target.value })}
                      placeholder="CR-123456"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{isAr ? 'رقم السجل الصناعي' : 'Industrial Reg #'}</label>
                    <input
                      type="text"
                      className="form-control"
                      dir="ltr"
                      value={regData.industrialRegistrationNumber}
                      onChange={e => setRegData({ ...regData, industrialRegistrationNumber: e.target.value })}
                      placeholder="IND-789012"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{isAr ? 'البطاقة الضريبية' : 'Tax ID #'}</label>
                    <input
                      type="text"
                      className="form-control"
                      dir="ltr"
                      value={regData.taxIdNumber}
                      onChange={e => setRegData({ ...regData, taxIdNumber: e.target.value })}
                      placeholder="TAX-345-678"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">{isAr ? 'القطاع الصناعي' : 'Industrial Sector'}</label>
                    <select
                      className="form-control"
                      value={regData.sector}
                      onChange={e => {
                        const sec = INDUSTRIAL_SECTORS.find(s => s.ar === e.target.value);
                        setRegData({ ...regData, sector: e.target.value, sectorEn: sec?.en || e.target.value });
                      }}
                    >
                      {INDUSTRIAL_SECTORS.map(s => (
                        <option key={s.ar} value={s.ar}>{isAr ? s.ar : s.en}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">{isAr ? 'المحافظة والمنطقة' : 'Governorate'}</label>
                    <select
                      className="form-control"
                      value={regData.governorate}
                      onChange={e => {
                        const gov = GOVERNORATES.find(g => g.ar === e.target.value);
                        setRegData({ ...regData, governorate: e.target.value, governorateEn: gov?.en || e.target.value });
                      }}
                    >
                      {GOVERNORATES.map(g => (
                        <option key={g.ar} value={g.ar}>{isAr ? g.ar : g.en}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label required">{isAr ? 'البريد الإلكتروني الرسمي للمنشأة' : 'Official Email'}</label>
                  <input
                    type="email"
                    className="form-control"
                    dir="ltr"
                    value={regData.email}
                    onChange={e => setRegData({ ...regData, email: e.target.value })}
                    placeholder="contact@myfactory.eg"
                    autoComplete="username"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">{isAr ? 'كلمة المرور' : 'Password'}</label>
                    <input
                      type="password"
                      className="form-control"
                      dir="ltr"
                      value={regData.password}
                      onChange={e => setRegData({ ...regData, password: e.target.value })}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <div className="form-helper">{isAr ? '8 أحرف على الأقل وتحتوي حرفاً ورقماً.' : '8+ chars, letter+digit.'}</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label required">{isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                    <input
                      type="password"
                      className="form-control"
                      dir="ltr"
                      value={regData.confirmPassword}
                      onChange={e => setRegData({ ...regData, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy}>
                  <UserPlus size={16} />
                  <span>{busy ? (isAr ? 'جاري التسجيل...' : 'Registering...') : (isAr ? 'إنشاء حساب المنشأة وتفعيل البوابة' : 'Create Account & Open Portal')}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Government Officials & Admin Access */}
        {authTab === 'official' && (
          <div style={{ padding: '2rem' }}>
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <ShieldCheck size={20} style={{ color: 'var(--egypt-red)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  {isAr ? 'بوابة دخول المسؤولين ومراجعي المبادرات المعتمدين' : 'Authorized Officials & Reviewers Access'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {isAr
                    ? 'دخول موحد لمسؤولي وزارة الصناعة، هيئة التنمية الصناعية (IDA)، مركز تحديث الصناعة (IMC)، البنوك الوطنية الشريكة، ومقدمي الخدمة. الحسابات تُنشأ وتُعتمد مركزياً من قبل المشرف العام للمنصة.'
                    : 'Secured access for Ministry of Industry, IDA, IMC, Banks and Service Providers. Official accounts are managed centrally by the Ministry Admin.'}
                </div>
              </div>
            </div>

            {error && (
              <div className="error-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
                {(error.includes('غير مؤكد') || error.toLowerCase().includes('not verified')) && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleResend} disabled={resendBusy} style={{ alignSelf: 'flex-start' }}>
                    {resendBusy ? (isAr ? 'جارٍ الإرسال...' : 'Sending...') : (isAr ? 'إعادة إرسال رابط التفعيل' : 'Resend verification link')}
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label required" htmlFor="off-login-email">{isAr ? 'البريد الإلكتروني الرسمي للجهة' : 'Official Government Email'}</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.75rem', color: 'var(--text-muted)' }} />
                  <input
                    id="off-login-email"
                    type="email"
                    className="form-control"
                    dir="ltr"
                    placeholder="tarek.mansour@industry.gov.eg"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ paddingInlineStart: '2.4rem', textAlign: 'left' }}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="off-login-pass">{isAr ? 'كلمة المرور' : 'Password'}</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.75rem', color: 'var(--text-muted)' }} />
                  <input
                    id="off-login-pass"
                    type={showPass ? 'text' : 'password'}
                    className="form-control"
                    dir="ltr"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ paddingInlineStart: '2.4rem', paddingInlineEnd: '2.5rem', textAlign: 'left' }}
                    autoComplete="current-password"
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

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '0.5rem' }} disabled={busy}>
                <LogIn size={16} />
                <span>{busy ? (isAr ? 'جاري التحقق...' : 'Authenticating...') : (isAr ? 'تسجيل دخول المسؤول' : 'Sign in as Official')}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Forced Change Password Modal on First Login */}
      {forcedUser && (
        <ChangePasswordModal
          isOpen={!!forcedUser}
          isForced={true}
          user={forcedUser}
          onClose={() => setForcedUser(null)}
          onSuccess={() => {
            const u = forcedUser;
            setForcedUser(null);
            navigate(getDefaultView(u));
          }}
        />
      )}
    </div>
  );
};
