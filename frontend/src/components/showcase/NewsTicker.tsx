import React from 'react';
import { usePlatformStore } from '../../store/state';
import { formatEGP } from '../../utils/format';
import { Radio } from 'lucide-react';

/** أقل عدد عناصر في النسخة الواحدة حتى لا تظهر فجوة عند التكرار مع مبادرات قليلة. */
const MIN_ITEMS_PER_LOOP = 6;
/** ثوانٍ لكل عنصر — تضبط سرعة القراءة بغض النظر عن عدد المبادرات. */
const SECONDS_PER_ITEM = 7;

/**
 * NewsTicker — شريط أخبار المبادرات أعلى الرئيسية: يمرّر المبادرات المعلنة (نشطة/قريباً) بلا توقف،
 * يتوقف عند المرور أو التركيز، وكل عنصر يفتح صفحة مبادرته. الاتجاه يتبع اللغة
 * (العربية تتحرك يساراً→يميناً ليُقرأ أول العنوان أولاً). مع prefers-reduced-motion يصبح شريطاً قابلاً للتمرير.
 */
export const NewsTicker: React.FC = () => {
  const { language, initiatives, navigate } = usePlatformStore();
  const isAr = language === 'ar';

  const announced = initiatives.filter(i => i.status === 'active' || i.status === 'coming_soon');
  const items = announced.length > 0 ? announced : initiatives;
  if (items.length === 0) return null;

  // نسخة واحدة = العناصر مكررة حتى الحد الأدنى، ثم نسختان متطابقتان ليكون الالتفاف بلا قفزة
  const repeats = Math.ceil(MIN_ITEMS_PER_LOOP / items.length);
  const loop = Array.from({ length: repeats }, () => items).flat();
  const track = [...loop, ...loop];
  const duration = `${loop.length * SECONDS_PER_ITEM}s`;

  return (
    <section
      className="news-ticker"
      aria-label={isAr ? 'شريط أخبار المبادرات' : 'Initiatives news ticker'}
    >
      <span className="news-ticker-label">
        <span className="news-ticker-dot" aria-hidden />
        <Radio size={15} aria-hidden />
        {isAr ? 'أحدث المبادرات' : 'Latest initiatives'}
      </span>

      <div className="news-ticker-viewport">
        <div
          className={`news-ticker-track${isAr ? ' is-rtl' : ''}`}
          style={{ '--ticker-duration': duration } as React.CSSProperties}
        >
          {track.map((i, idx) => {
            // العناصر المكررة للحركة فقط — تُخفى عن قارئ الشاشة ولوحة المفاتيح
            const isEcho = idx >= items.length;
            const soon = i.status === 'coming_soon';
            const extra = isAr ? i.badgeTextAr : i.badgeTextEn;
            return (
              <button
                key={`${i.id}-${idx}`}
                type="button"
                className="news-ticker-item"
                onClick={() => navigate('initiative-detail', i.id)}
                aria-hidden={isEcho || undefined}
                tabIndex={isEcho ? -1 : undefined}
              >
                <span className={`news-ticker-status${soon ? ' is-soon' : ''}`}>
                  {soon ? (isAr ? 'قريباً' : 'Coming soon') : (isAr ? 'متاحة للتقديم' : 'Open now')}
                </span>
                <span className="news-ticker-title">{isAr ? i.titleAr : i.titleEn}</span>
                {extra ? (
                  <span className="news-ticker-meta">{extra}</span>
                ) : i.budgetTotalEGP > 0 ? (
                  <span className="news-ticker-meta">
                    {isAr ? `بتمويل ${formatEGP(i.budgetTotalEGP, true)}` : `${formatEGP(i.budgetTotalEGP, false)} funding`}
                  </span>
                ) : null}
                <span className="news-ticker-sep" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
