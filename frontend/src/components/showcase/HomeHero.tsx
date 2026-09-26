import React from 'react';
import { usePlatformStore } from '../../store/state';
import { Layers, LogIn, ArrowLeft, ArrowRight, Briefcase } from 'lucide-react';
import { AdsCarousel } from './AdsCarousel';

export interface HomeHeroProps {
  /** عدد المبادرات النشطة — من الصفحة الأم */
  activeCount?: number;
  /** إجمالي المصانع المستهدفة — من الصفحة الأم */
  targetFactories?: number;
}

/**
 * HomeHero — هيرو تحريري عريض للصفحة التعريفية (منفصل عن HeroSlider).
 * split: نص + سلايدر إعلانات (AdsCarousel) · شريط علم · توهج ناعم · دخول fadeUp · شارات الجهات.
 */
export const HomeHero: React.FC<HomeHeroProps> = ({
  activeCount = 0,
  targetFactories = 0,
}) => {
  const { language, isLoggedIn, navigate } = usePlatformStore();
  const isAr = language === 'ar';
  const fmt = (n: number) => n.toLocaleString(isAr ? 'ar-EG' : 'en-US');

  const stats = [
    {
      value: fmt(activeCount),
      labelAr: 'مبادرة نشطة',
      labelEn: 'Active initiatives',
    },
    {
      value: fmt(targetFactories),
      labelAr: 'مصنع مستهدف',
      labelEn: 'Target factories',
    },
  ];

  const partners = ['IDA', 'IMC', 'NBE'];

  return (
    <section
      aria-label={isAr ? 'مقدمة المنصة' : 'Platform intro'}
      className="hero-shell"
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-2xl)',
        overflow: 'hidden',
        background: 'var(--bg-surface)',
        border: '1px solid rgba(226,232,240,0.95)',
        boxShadow: 'var(--shadow-lg)',
        marginBottom: '1.75rem',
      }}
    >
      {/* شريط علم مصر */}
      <div
        aria-hidden
        style={{ height: '4px', width: '100%', background: 'var(--egypt-flag-ribbon)' }}
      />
      {/* توهج خلفي ناعم */}
      <div className="hero-glow-orb" aria-hidden />

      <div
        className="hero-slider-grid reveal-stagger"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.02fr 0.98fr',
          minHeight: '380px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* النص التحريري */}
        <div
          style={{
            padding: '2.4rem 2rem 1.6rem 2.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '1.05rem',
          }}
        >
          <span
            className="badge badge-gold"
            style={{ alignSelf: 'flex-start', letterSpacing: '0.02em' }}
          >
            {isAr ? 'المنصة الوطنية للتمويل والمبادرات الصناعية' : 'National Platform for Industrial Financing & Initiatives'}
          </span>

          <h1
            style={{
              fontFamily: isAr ? 'var(--font-display-ar)' : 'var(--font-display-en)',
              fontSize: 'clamp(1.7rem, 2.6vw, 2.35rem)',
              fontWeight: 800,
              lineHeight: 1.35,
              color: 'var(--text-main)',
              margin: 0,
              textWrap: 'balance',
              letterSpacing: '-0.02em',
            }}
          >
            {isAr
              ? 'بوابة التمويل الميسّر لكافة المبادرات'
              : 'Concessional financing for all initiatives'}
          </h1>

          <p
            style={{
              fontSize: '0.94rem',
              lineHeight: 1.8,
              color: 'var(--text-secondary)',
              margin: 0,
              maxWidth: '54ch',
            }}
          >
            {isAr
              ? 'منصة موحدة تجمع المبادرات الوطنية: تمويل ميسّر للمصانع، حلول طاقة شمسية تخفض التكلفة، وبرامج تحديث لخطوط الإنتاج وتعميق المكوّن المحلي.'
              : 'One national portal for concessional factory financing, cost-cutting solar programs, and production-line modernization with deeper local content.'}
          </p>

          {/* شارات الجهات */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.70rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.03em',
              }}
            >
              {isAr ? 'بشراكة:' : 'In partnership:'}
            </span>
            {partners.map(k => (
              <span
                key={k}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 750,
                  letterSpacing: '0.02em',
                  padding: '0.18rem 0.5rem',
                  borderRadius: '9999px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  color: '#334155',
                }}
              >
                {k}
              </span>
            ))}
          </div>

          {/* الزرّان */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('initiatives')}
              style={{ boxShadow: '0 6px 18px rgba(200,16,46,0.16)' }}
            >
              <Layers size={16} />
              <span>{isAr ? 'عرض المبادرات' : 'Browse initiatives'}</span>
              <span className="btn-arrow">
                {isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
              </span>
            </button>
            {isLoggedIn ? (
              <button
                className="btn btn-secondary"
                onClick={() => navigate('my-initiatives')}
                style={{ fontWeight: 700 }}
              >
                <Briefcase size={16} />
                <span>{isAr ? 'مبادراتي' : 'My initiatives'}</span>
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={() => navigate('login')}
                style={{ fontWeight: 700 }}
              >
                <LogIn size={16} />
                <span>{isAr ? 'سجل الدخول' : 'Sign in'}</span>
              </button>
            )}
          </div>

          {/* شريط الإحصاءات */}
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              flexWrap: 'wrap',
              marginTop: '0.6rem',
            }}
          >
            {stats.map(s => (
              <div
                key={isAr ? s.labelAr : s.labelEn}
                className="metric-bento"
                style={{
                  flex: '1 1 120px',
                  padding: '0.7rem 0.9rem',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.1rem',
                }}
              >
                <strong
                  className="num-ltr"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: 'var(--egypt-red)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.2,
                  }}
                >
                  {s.value}
                </strong>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {isAr ? s.labelAr : s.labelEn}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* الصور — سلايدر إعلانات المبادرات */}
        <div
          style={{
            position: 'relative',
            padding: '1.15rem 1.15rem 1.15rem 0.75rem',
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          <AdsCarousel />
        </div>
      </div>
    </section>
  );
};
