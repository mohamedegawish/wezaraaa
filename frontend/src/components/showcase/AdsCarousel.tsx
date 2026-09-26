import React, { useCallback, useEffect, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { resolveCoverUrl } from '../../api';
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Megaphone } from 'lucide-react';

const FALLBACK_COVER = '/covers/solar-2026.jpg';

/**
 * AdsCarousel — سلايدر إعلانات لصور الهيرو: شريحة لكل مبادرة نشطة/قريبة (غلافها من الباك)،
 * كل شريحة تفتح صفحة مبادرتها. تشغيل تلقائي بـ heroSliderInterval، يتوقف عند المرور
 * وعند prefers-reduced-motion (الانتقالات نفسها يلغيها globals.css).
 */
export const AdsCarousel: React.FC = () => {
  const { language, initiatives, heroSliderInterval, navigate } = usePlatformStore();
  const isAr = language === 'ar';

  const active = initiatives.filter(i => i.status === 'active' || i.status === 'coming_soon');
  const list = active.length > 0 ? active : initiatives;
  const slides = list.length > 0
    ? list.map(i => ({
        id: i.id as string | undefined,
        titleAr: i.titleAr,
        titleEn: i.titleEn,
        badgeAr: i.badgeTextAr || i.category,
        badgeEn: i.badgeTextEn || i.categoryEn,
        imageUrl: resolveCoverUrl(i.coverImage || FALLBACK_COVER),
      }))
    : [{
        id: undefined,
        titleAr: 'التمويل الميسّر لكافة المبادرات',
        titleEn: 'Concessional financing for all initiatives',
        badgeAr: 'مبادرات وطنية',
        badgeEn: 'National initiatives',
        imageUrl: resolveCoverUrl(FALLBACK_COVER),
      }];

  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });

  const safeIndex = index % count;
  const current = slides[safeIndex];

  const next = useCallback(() => setIndex(i => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex(i => (i - 1 + count) % count), [count]);

  useEffect(() => {
    if (paused || reducedMotion || count <= 1) return;
    const t = setInterval(() => setIndex(i => (i + 1) % count), heroSliderInterval || 3000);
    return () => clearInterval(t);
  }, [paused, reducedMotion, count, heroSliderInterval]);

  useEffect(() => { setIndex(0); }, [count]);

  const open = () => (current.id ? navigate('initiative-detail', current.id) : navigate('initiatives'));

  const navBtn: React.CSSProperties = {
    width: '34px',
    height: '34px',
    borderRadius: '9999px',
    border: '1px solid rgba(255,255,255,0.55)',
    background: 'rgba(15,23,42,0.45)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  };

  return (
    <div
      role="region"
      aria-roledescription={isAr ? 'سلايدر إعلانات' : 'carousel'}
      aria-label={isAr ? 'إعلانات المبادرات' : 'Initiative ads'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
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
          key={s.id ?? 'default'}
          src={s.imageUrl}
          alt={isAr ? s.titleAr : s.titleEn}
          aria-hidden={i !== safeIndex}
          loading={i === 0 ? 'eager' : 'lazy'}
          onError={e => {
            (e.currentTarget as HTMLImageElement).src = resolveCoverUrl(FALLBACK_COVER);
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

      {/* تدرج سفلي لقراءة نص الإعلان */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 'auto 0 0 0',
          height: '62%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(7,11,20,0.78) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* نص الإعلان */}
      <div
        aria-live={paused ? 'polite' : 'off'}
        style={{
          position: 'absolute',
          insetInline: 0,
          bottom: 0,
          padding: '1.1rem 1.2rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          color: '#fff',
        }}
      >
        <span
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.7rem',
            fontWeight: 750,
            background: 'rgba(255,255,255,0.94)',
            color: '#0F172A',
            borderRadius: '9999px',
            padding: '0.2rem 0.6rem',
          }}
        >
          <Megaphone size={12} style={{ color: 'var(--egypt-red)' }} />
          {isAr ? current.badgeAr : current.badgeEn}
        </span>
        <strong style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.45, textWrap: 'balance' }}>
          {isAr ? current.titleAr : current.titleEn}
        </strong>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={open} style={{ borderRadius: '9999px' }}>
            <span>{isAr ? 'اعرف المزيد' : 'Learn more'}</span>
            {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
          </button>

          {count > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginInlineStart: 'auto' }}>
              <button type="button" onClick={prev} aria-label={isAr ? 'الإعلان السابق' : 'Previous ad'} style={navBtn}>
                {isAr ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {slides.map((s, i) => (
                  <button
                    key={s.id ?? 'default'}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={isAr ? `الإعلان ${i + 1}` : `Ad ${i + 1}`}
                    aria-current={i === safeIndex}
                    style={{
                      width: i === safeIndex ? '22px' : '8px',
                      height: '8px',
                      borderRadius: '9999px',
                      background: i === safeIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                      transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                      padding: 0,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <button type="button" onClick={next} aria-label={isAr ? 'الإعلان التالي' : 'Next ad'} style={navBtn}>
                {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
