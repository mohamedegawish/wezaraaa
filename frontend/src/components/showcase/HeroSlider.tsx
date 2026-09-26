import React, { useCallback, useEffect, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { resolveCoverUrl } from '../../api';
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, LogIn, Layers, Sparkles } from 'lucide-react';

/**
 * HeroSlider — يستعرض المبادرات المسجلة في النظام تلقائياً
 * صور الغلاف مطابقة للمبادرات الفعلية وبنفس عددها
 * في حالة عدم وجود مبادرات، يعرض شريحة افتراضية مع صورة غلاف قياسية
 */
export const HeroSlider: React.FC = () => {
  const { language, initiatives, heroSliderInterval, navigate } = usePlatformStore();
  const isAr = language === 'ar';

  // تصفية المبادرات النشطة أو المعروضة
  const activeInitiatives = initiatives.filter(i => i.status === 'active' || i.status === 'coming_soon');
  const listToUse = activeInitiatives.length > 0 ? activeInitiatives : (initiatives.length > 0 ? initiatives : []);

  const slides = listToUse.length > 0
    ? listToUse.map((init, idx) => ({
        id: init.id,
        order: idx + 1,
        titleAr: init.titleAr,
        titleEn: init.titleEn,
        subtitleAr: init.taglineAr || init.descriptionAr,
        subtitleEn: init.taglineEn || init.descriptionEn,
        categoryAr: init.category,
        categoryEn: init.categoryEn,
        badgeTextAr: init.badgeTextAr,
        badgeTextEn: init.badgeTextEn,
        imageUrl: resolveCoverUrl(init.coverImage || '/covers/solar-2026.jpg'),
        participatingOrgs: init.participatingOrgs?.slice(0, 3) || ['IDA', 'IMC', 'NBE'],
        isComingSoon: init.status === 'coming_soon',
      }))
    : [
        {
          id: 'default-init',
          order: 1,
          titleAr: 'دليل المبادرات والحوافز الصناعية القومية',
          titleEn: 'National Industrial Initiatives & Incentives',
          subtitleAr: 'بوابة موحدة للتمويلات الميسرة وبرامج الطاقة النظيفة وتحديث خطوط الإنتاج ودعم وتوطين الصناعة المصرية.',
          subtitleEn: 'Unified national portal for concessional financing, clean energy and modernization programs.',
          categoryAr: 'مبادرات وطنية',
          categoryEn: 'National Initiatives',
          badgeTextAr: 'رؤية 2030',
          badgeTextEn: 'Vision 2030',
           imageUrl: resolveCoverUrl('/covers/solar-2026.jpg'),
          participatingOrgs: ['IDA', 'IMC', 'NBE'],
          isComingSoon: false,
        }
      ];

  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const safeIndex = count > 0 ? index % count : 0;
  const current = slides[safeIndex];

  const next = useCallback(() => setIndex(i => (i + 1) % Math.max(count, 1)), [count]);
  const prev = useCallback(() => setIndex(i => (i - 1 + Math.max(count, 1)) % Math.max(count, 1)), [count]);

  const intervalMs = heroSliderInterval || 3000;

  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setInterval(() => setIndex(i => (i + 1) % count), intervalMs);
    return () => clearInterval(t);
  }, [paused, count, intervalMs]);

  useEffect(() => { setIndex(0); }, [count]);

  if (!current) return null;

  const scrollToGrid = () => {
    document.getElementById('initiatives-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      aria-label={isAr ? 'الواجهة الرئيسية للمبادرات' : 'Initiatives Hero Slider'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
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
      {/* توهج خلفي ناعم */}
      <div className="hero-glow-orb" aria-hidden />

      <div
        className="hero-slider-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.02fr 0.98fr',
          minHeight: '380px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* تفاصيل الشريحة */}
        <div style={{ padding: '2.4rem 2rem 1.6rem 2.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.05rem' }}>
          <h1
            style={{
              fontFamily: isAr ? 'var(--font-display-ar)' : 'var(--font-display-en)',
              fontSize: 'clamp(1.65rem, 2.5vw, 2.25rem)',
              fontWeight: 800,
              lineHeight: 1.32,
              color: 'var(--text-main)',
              margin: 0,
              textWrap: 'balance',
              letterSpacing: '-0.02em',
            }}
          >
            {isAr ? current.titleAr : current.titleEn}
          </h1>

          <p style={{ fontSize: '0.94rem', lineHeight: 1.8, color: 'var(--text-secondary)', margin: 0, maxWidth: '54ch' }}>
            {isAr ? current.subtitleAr : current.subtitleEn}
          </p>

          {/* الجهات الشريكة */}
          {current.participatingOrgs && current.participatingOrgs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                {isAr ? 'الجهات المشاركة:' : 'Partners:'}
              </span>
              {current.participatingOrgs.map((k: string, idx: number) => (
                <span key={idx} style={{ fontSize: '0.68rem', fontWeight: 750, letterSpacing: '0.02em', padding: '0.18rem 0.5rem', borderRadius: '9999px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155' }}>
                  {k}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
            <button className="btn btn-primary btn-lg" onClick={scrollToGrid} style={{ boxShadow: '0 6px 18px rgba(200,16,46,0.16)' }}>
              <Layers size={16} />
              <span>{isAr ? 'استعرض المبادرات' : 'Browse Initiatives'}</span>
              <span className="btn-arrow">{isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}</span>
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('login')} style={{ fontWeight: 700 }}>
              <LogIn size={16} />
              <span>{isAr ? 'سجل الدخول' : 'Login'}</span>
            </button>
          </div>

          {/* عناصر تحكم التنقل */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginTop: '0.75rem' }}>
            <button
              onClick={prev}
              aria-label="Previous Slide"
              className="btn btn-secondary btn-sm"
              style={{ width: '32px', height: '32px', padding: 0, borderRadius: '9999px', flexShrink: 0 }}
            >
              {isAr ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.28rem 0.45rem', borderRadius: '9999px' }}>
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Slide ${i + 1}`}
                  style={{
                    width: i === safeIndex ? '26px' : '8px',
                    height: '8px',
                    borderRadius: '9999px',
                    background: i === safeIndex ? 'var(--egypt-red)' : '#CBD5E1',
                    transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                    padding: 0,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: i === safeIndex ? '0 0 0 4px var(--egypt-red-glow)' : 'none',
                  }}
                />
              ))}
            </div>

            <button
              onClick={next}
              aria-label="Next Slide"
              className="btn btn-secondary btn-sm"
              style={{ width: '32px', height: '32px', padding: 0, borderRadius: '9999px', flexShrink: 0 }}
            >
              {isAr ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginInlineStart: '0.35rem', fontVariantNumeric: 'tabular-nums', fontWeight: 700, letterSpacing: '0.04em' }} className="num-ltr">
              {String(safeIndex + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </span>

            {paused && (
              <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', border: '1px solid var(--border-subtle)', padding: '0.15rem 0.4rem', borderRadius: '9999px', marginInlineStart: '0.25rem' }}>
                {isAr ? 'متوقف' : 'Paused'}
              </span>
            )}
          </div>
        </div>

        {/* الصورة — مؤطرة ومطابقة لغلاف المبادرة */}
        <div style={{ position: 'relative', padding: '1.15rem 1.15rem 1.15rem 0.75rem', display: 'flex', alignItems: 'stretch' }}>
          <div
            style={{
              position: 'relative',
              flex: 1,
              borderRadius: '16px',
              overflow: 'hidden',
              background: 'var(--bg-muted)',
              border: '1px solid rgba(226,232,240,0.9)',
              boxShadow: 'var(--shadow-xl)',
              minHeight: '320px',
            }}
          >
            {slides.map((s, i) => (
              <img
                key={s.id}
                src={s.imageUrl}
                alt={isAr ? s.titleAr : s.titleEn}
                loading={i === 0 ? 'eager' : 'lazy'}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = resolveCoverUrl('/covers/solar-2026.jpg');
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: i === safeIndex ? 1 : 0,
                  transform: i === safeIndex ? 'scale(1)' : 'scale(1.03)',
                  transition: 'opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            ))}
            {/* تدرج سفلي ناعم وجميل */}
            <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: '35%', background: 'linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.18) 100%)', pointerEvents: 'none' }} />
          </div>
        </div>
      </div>
    </section>
  );
};
