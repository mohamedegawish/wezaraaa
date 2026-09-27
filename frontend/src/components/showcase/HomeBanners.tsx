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
export const BannerVisual: React.FC<{
  banner: BannerContent;
  isAr: boolean;
  showCta: boolean;
  eager?: boolean;
  /** الصورة لم تُحمَّل (رابط صفحة لا صورة، أو موقع يمنع التضمين) */
  onImageError?: () => void;
}> = ({ banner, isAr, showCta, eager, onImageError }) => {
  const title = pick(isAr, banner.titleAr, banner.titleEn);
  const sub = pick(isAr, banner.subtitleAr, banner.subtitleEn);
  const cta = showCta ? pick(isAr, banner.ctaLabelAr, banner.ctaLabelEn) : '';
  return (
    <>
      {banner.imageUrl && (
        <img
          className="home-feature-img"
          src={resolveApiAssetUrl(banner.imageUrl)}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={e => { e.currentTarget.style.visibility = 'hidden'; onImageError?.(); }}
          onLoad={e => { e.currentTarget.style.visibility = ''; }}
        />
      )}
      {(title || sub || cta) && (
        <>
          <div className="home-feature-shade" aria-hidden style={{ '--shade-dir': isAr ? '270deg' : '90deg' } as React.CSSProperties} />
          <div className="home-feature-text">
            {title && <strong className="home-feature-title">{title}</strong>}
            {sub && <p className="home-feature-sub">{sub}</p>}
            {cta && (
              <span className="home-feature-cta">
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
  // بانر صورته لا تُحمَّل يُستبعد بدل مربع رمادي فارغ في الصفحة الرئيسية.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const slides = homeBanners.filter(b => b.placement === placement && !failed.has(b.id));
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
    const className = `home-feature-slide${isActive ? ' is-active' : ''}`;
    // مبادرة مخفية عن الزائر (مسودة/مؤرشفة/محذوفة) = بانر بلا رابط بدل صفحة «غير موجودة».
    const toInitiative = b.linkType === 'initiative' && initiatives.some(x => x.id === b.linkTarget);
    const linked = b.linkType === 'url' || toInitiative;
    const content = (
      <BannerVisual banner={b} isAr={isAr} showCta={linked} eager={i === 0}
        onImageError={() => setFailed(prev => new Set(prev).add(b.id))} />
    );
    const label = bannerHasText(b, isAr) ? undefined : (isAr ? 'فتح الإعلان' : 'Open announcement');

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
      <div className={`home-feature${slides.some(b => bannerHasText(b, isAr)) ? ' has-text' : ''}`}>
        {slides.map(renderSlide)}

        {count > 1 && (
          <div className="home-feature-controls">
            <button type="button" className="home-feature-nav" onClick={() => setIndex((active - 1 + count) % count)}
              aria-label={isAr ? 'الإعلان السابق' : 'Previous ad'}>
              {isAr ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            {slides.map((b, i) => (
              <button key={b.id} type="button" className="home-feature-dot" onClick={() => setIndex(i)}
                aria-label={isAr ? `الإعلان ${i + 1}` : `Ad ${i + 1}`} aria-current={i === active} />
            ))}
            <button type="button" className="home-feature-nav" onClick={() => setIndex((active + 1) % count)}
              aria-label={isAr ? 'الإعلان التالي' : 'Next ad'}>
              {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
