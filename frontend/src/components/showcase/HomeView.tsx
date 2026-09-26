import React from 'react';
import { usePlatformStore } from '../../store/state';
import {
  Compass,
  ClipboardCheck,
  Send,
  Sun,
  Factory,
  Boxes,
  ArrowLeft,
  ArrowRight,
  Layers,
  LogIn,
  Briefcase,
} from 'lucide-react';
import { HomeHero } from './HomeHero';
import { PlatformAbout } from './PlatformAbout';
import { NewsTicker } from './NewsTicker';

/**
 * HomeView — الصفحة التعريفية: شريط أخبار المبادرات + هيرو تحريري + عن المنصة (الأهداف والمكونات) +
 * كيف تعمل المنصة + الفئات + دعوة ختامية. كل النصوص Ar/En عبر language.
 */
export const HomeView: React.FC = () => {
  const { language, initiatives, isLoggedIn, navigate } = usePlatformStore();
  const isAr = language === 'ar';

  const active = initiatives.filter(i => i.status === 'active' || i.status === 'coming_soon');
  const base = active.length > 0 ? active : initiatives;
  const activeCount = base.length;
  const targetFactories = base.reduce((s, i) => s + (i.impactMetrics?.targetFactories ?? 0), 0);

  const steps = [
    {
      icon: <Compass size={20} />,
      titleAr: 'استكشف',
      titleEn: 'Explore',
      descAr: 'تصفح المبادرات الوطنية وقارن المزايا وشروط الأهلية.',
      descEn: 'Browse national initiatives and compare benefits and eligibility.',
    },
    {
      icon: <ClipboardCheck size={20} />,
      titleAr: 'افحص الأهلية',
      titleEn: 'Check eligibility',
      descAr: 'أجب عن أسئلة الفحص المسبق واعرف مدى توافق مصنعك.',
      descEn: 'Answer the pre-eligibility check and see how your factory fits.',
    },
    {
      icon: <Send size={20} />,
      titleAr: 'قدّم وتابع',
      titleEn: 'Apply & track',
      descAr: 'قدّم طلبك إلكترونياً وتابع مراحله لحظة بلحظة.',
      descEn: 'Submit your application online and track every stage live.',
    },
  ];

  const tracks = [
    {
      icon: <Sun size={20} />,
      titleAr: 'شمس المصانع',
      titleEn: 'Factory Sun',
      descAr: 'محطات شمسية للمصانع تخفض فاتورة الكهرباء وتضمن استدامة التشغيل.',
      descEn: 'Factory solar plants that cut power bills and secure operations.',
      initiativeId: 'init-solar-2026',
    },
    {
      icon: <Factory size={20} />,
      titleAr: 'مصنع المستقبل',
      titleEn: 'Factory of the Future',
      descAr: 'أتمتة وتطوير المعدات لرفع الجودة والتنافسية.',
      descEn: 'Automation and equipment upgrades for quality and competitiveness.',
      initiativeId: undefined as string | undefined,
    },
    {
      icon: <Boxes size={20} />,
      titleAr: 'صُنع في مصر',
      titleEn: 'Made in Egypt',
      descAr: 'توطين الصناعات البديلة ودعم سلاسل الإمداد الوطنية.',
      descEn: 'Localize substitute industries and support national supply chains.',
      initiativeId: undefined as string | undefined,
    },
  ];

  const sectionTitle: React.CSSProperties = {
    fontFamily: isAr ? 'var(--font-display-ar)' : 'var(--font-display-en)',
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    margin: 0,
  };

  return (
    <div className="container-custom home-page reveal-stagger">
      <NewsTicker />

      <HomeHero activeCount={activeCount} targetFactories={targetFactories} />

      <PlatformAbout />

      {/* كيف تعمل المنصة */}
      <section aria-label={isAr ? 'كيف تعمل المنصة' : 'How it works'} className="home-section">
        <div className="section-anchor">
          <h2 style={sectionTitle}>{isAr ? 'كيف تعمل المنصة' : 'How the platform works'}</h2>
        </div>
        <div className="home-grid home-grid-trio">
          {steps.map((s, idx) => (
            <div key={s.titleEn} className="home-card">
              <div className="home-card-head">
                <span className="home-card-icon">{s.icon}</span>
                <span className="home-card-num num-ltr">{String(idx + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="home-card-title">{isAr ? s.titleAr : s.titleEn}</h3>
              <p className="home-card-desc">{isAr ? s.descAr : s.descEn}</p>
            </div>
          ))}
        </div>
      </section>

      {/* الفئات */}
      <section aria-label={isAr ? 'الفئات' : 'Categories'} className="home-section">
        <div className="section-anchor">
          <h2 style={sectionTitle}>{isAr ? 'الفئات' : 'Categories'}</h2>
        </div>
        <div className="home-grid home-grid-trio">
          {tracks.map(t => (
            <button
              key={t.titleEn}
              type="button"
              className="home-card"
              onClick={() => (t.initiativeId ? navigate('initiative-detail', t.initiativeId) : navigate('initiatives'))}
            >
              <span className="home-card-icon">{t.icon}</span>
              <h3 className="home-card-title">{isAr ? t.titleAr : t.titleEn}</h3>
              <p className="home-card-desc">{isAr ? t.descAr : t.descEn}</p>
              <span className="home-card-link">
                {isAr ? 'استعرض المبادرات' : 'Browse initiatives'}
                {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* دعوة ختامية */}
      <section
        aria-label={isAr ? 'ابدأ الآن' : 'Get started'}
        className="hero-shell"
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden',
          background: 'var(--bg-surface)',
          border: '1px solid rgba(226,232,240,0.95)',
          boxShadow: 'var(--shadow-lg)',
          padding: '2rem 1.75rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.9rem',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(700px 320px at 50% -10%, rgba(200,16,46,0.06) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{ height: '4px', width: '120px', borderRadius: '9999px', background: 'var(--egypt-flag-ribbon)' }}
        />
        <h2 style={{ ...sectionTitle, fontSize: 'clamp(1.15rem, 2vw, 1.5rem)', position: 'relative' }}>
          {isAr ? 'مصنعك يستحق الدعم — ابدأ رحلتك اليوم' : 'Your factory deserves support — start today'}
        </h2>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)', margin: 0, maxWidth: '60ch', position: 'relative' }}>
          {isAr
            ? 'سجل الدخول وتابع مبادراتك، أو استكشف المبادرات المتاحة وقدّم في دقائق.'
            : 'Sign in to follow your initiatives, or explore what is available and apply in minutes.'}
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', position: 'relative' }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('initiatives')}>
            <Layers size={16} />
            <span>{isAr ? 'عرض المبادرات' : 'Browse initiatives'}</span>
          </button>
          {isLoggedIn ? (
            <button className="btn btn-secondary" onClick={() => navigate('my-initiatives')} style={{ fontWeight: 700 }}>
              <Briefcase size={16} />
              <span>{isAr ? 'مبادراتي' : 'My initiatives'}</span>
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => navigate('login')} style={{ fontWeight: 700 }}>
              <LogIn size={16} />
              <span>{isAr ? 'سجل الدخول' : 'Sign in'}</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
