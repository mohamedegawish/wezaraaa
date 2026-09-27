import React, { useEffect, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { resolveApiAssetUrl } from '../../api';
import type { BannerPlacement, HomeBannerShape } from '../../api';
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from 'lucide-react';

const ROTATE_MS = 6000;

type BannerContent = Pick<HomeBannerShape, 'imageUrl' | 'titleAr' | 'titleEn' | 'subtitleAr' | 'subtitleEn' | 'ctaLabelAr' | 'ctaLabelEn'>;

/** نص اللغة الحالية، ويرجع للغة الأخرى إن كان فارغاً. */
const pick = (isAr: boolean, ar: string, en: string) => (isAr ? ar || en : en || ar).trim();

export const bannerHasText = (b: BannerContent, isAr: boolean) =>
  Boolean(pick(isAr, b.titleAr, b.titleEn) || pick(isAr, b.subtitleAr, b.subtitleEn));

/** محتوى بانر واحد (صورة + نص + زر) — مشترك بين الصفحة الرئيسية ومعاينة الإدارة. */
export const BannerVisual: React.FC<{ banner: BannerContent; isAr: boolean; showCta: boolean; eager?: boolean }> = ({ banner, isAr, showCta, eager }) => {
  const title = pick(isAr, banner.titleAr, banner.titleEn);
  const sub = pick(isAr, banner.subtitleAr, banner.subtitleEn);
  const cta = showCta ? pick(isAr, banner.ctaLabelAr, banner.ctaLabelEn) : '';
  return (
    <>
      {banner.imageUrl && (
        <img
          className="home-banner-img"
          src={resolveApiAssetUrl(banner.imageUrl)}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
        />
      )}
      {(title || sub || cta) && (
        <>
          <div className="home-banner-shade" aria-hidden style={{ '--shade-dir': isAr ? '270deg' : '90deg' } as React.CSSProperties} />
          <div className="home-banner-text">
            {title && <strong className="home-banner-title">{title}</strong>}
            {sub && <p className="home-banner-sub">{sub}</p>}
            {cta && (
              <span className="home-banner-cta">
                {cta}
                {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
};

/**
 * HomeBanners — بانرات الإعلانات لمكان واحد في الصفحة الرئيسية (تُدار من «بانرات الرئيسية» في الإدارة).
 * لا شيء إن لم توجد بانرات؛ أكثر من بانر = سلايدر يتقلب تلقائياً (يتوقف عند المرور/التركيز وعند prefers-reduced-motion).
 */
export const HomeBanners: React.FC<{ placement: BannerPlacement }> = ({ placement }) => {
  const { language, homeBanners, initiatives, navigate } = usePlatformStore();
  const isAr = language === 'ar';
  const slides = homeBanners.filter(b => b.placement === placement);
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });

  useEffect(() => {
    if (paused || reducedMotion || count <= 1) return;
    const t = window.setInterval(() => setIndex(i => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [paused, reducedMotion, count]);

  if (count === 0) return null;
  const active = index % count;

  const renderSlide = (b: HomeBannerShape, i: number) => {
    const isActive = i === active;
    const className = `home-banner-slide${isActive ? ' is-active' : ''}`;
    // مبادرة مخفية عن الزائر (مسودة/مؤرشفة/محذوفة) = بانر بلا رابط بدل صفحة «غير موجودة».
    const toInitiative = b.linkType === 'initiative' && initiatives.some(x => x.id === b.linkTarget);
    const linked = b.linkType === 'url' || toInitiative;
    const content = <BannerVisual banner={b} isAr={isAr} showCta={linked} eager={i === 0} />;
    const label = bannerHasText(b, isAr) ? undefined : (isAr ? 'فتح الإعلان' : 'Open advertisement');

    if (b.linkType === 'url') {
      return (
        <a key={b.id} className={className} aria-hidden={!isActive || undefined} aria-label={label}
          href={b.linkTarget} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }
    if (toInitiative) {
      return (
        <a key={b.id} className={className} aria-hidden={!isActive || undefined} aria-label={label}
          href="#initiative-detail"
          onClick={e => { e.preventDefault(); navigate('initiative-detail', b.linkTarget); }}>
          {content}
        </a>
      );
    }
    return <div key={b.id} className={className} aria-hidden={!isActive || undefined}>{content}</div>;
  };

  return (
    <section
      className="home-section"
      aria-label={isAr ? 'إعلانات' : 'Announcements'}
      aria-roledescription={count > 1 ? (isAr ? 'سلايدر إعلانات' : 'carousel') : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
    >
      <div className={`home-banner${slides.some(b => bannerHasText(b, isAr)) ? ' has-text' : ''}`}>
        {slides.map(renderSlide)}

        {count > 1 && (
          <div className="home-banner-controls">
            <button type="button" className="home-banner-nav" onClick={() => setIndex((active - 1 + count) % count)}
              aria-label={isAr ? 'الإعلان السابق' : 'Previous ad'}>
              {isAr ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            {slides.map((b, i) => (
              <button key={b.id} type="button" className="home-banner-dot" onClick={() => setIndex(i)}
                aria-label={isAr ? `الإعلان ${i + 1}` : `Ad ${i + 1}`} aria-current={i === active} />
            ))}
            <button type="button" className="home-banner-nav" onClick={() => setIndex((active + 1) % count)}
              aria-label={isAr ? 'الإعلان التالي' : 'Next ad'}>
              {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
