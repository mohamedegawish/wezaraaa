import React, { useMemo } from 'react';
import { usePlatformStore } from '../../store/state';
import { resolveCoverUrl } from '../../api';
import { ArrowLeft, ArrowRight, BarChart3, Factory, FileText, TrendingUp, Quote } from 'lucide-react';

/**
 * ImpactView — لوحة الشفافية والأثر الوطني + قصص النجاح (Master Plan 2-د).
 * أرقام مجمعة من بيانات المبادرات والطلبات + قصص نجاح مهنية بدون بادجات مزخرفة.
 *
 * ⚠️ الصلاحيات: هذه الصفحة "للإدارة العليا فقط" (ADMIN ONLY) —
 * لا تظهر في قائمة التنقل لأي دور غير ministry_admin / initiative_manager،
 * وأي محاولة وصول مباشر (hash/URL) من دور غير مصرح له تُرفض في App.tsx
 * عبر isViewAllowed() وتُعرض شاشة "الوصول مقيد" (Access Restricted).
 */
export const ImpactView: React.FC = () => {
  const { initiatives, applications, factories, language, navigate } = usePlatformStore();
  const isAr = language === 'ar';

  const totals = useMemo(() => {
    const benefited = initiatives.reduce((s, i) => s + (i.impactMetrics?.benefitedFactories ?? 0), 0);
    const target = initiatives.reduce((s, i) => s + (i.impactMetrics?.targetFactories ?? 0), 0);
    const investment = initiatives.reduce((s, i) => s + (i.impactMetrics?.investmentStimulatedEGP ?? 0), 0);
    const jobs = initiatives.reduce((s, i) => s + (i.impactMetrics?.jobsCreated ?? 0), 0);
    const energy = initiatives.reduce((s, i) => s + (i.impactMetrics?.savedEnergyGWh ?? 0), 0);
    return { benefited, target, investment, jobs, energy };
  }, [initiatives]);

  const fmtBillion = (v: number) => `${(v / 1000000000).toFixed(1)}`;

  const metrics = [
    { labelAr: 'منشأة مستفيدة', labelEn: 'Benefited facilities', value: totals.benefited.toLocaleString(isAr ? 'ar-EG' : 'en-US'), hintAr: `المستهدف ${totals.target.toLocaleString(isAr ? 'ar-EG' : 'en-US')}`, hintEn: `Target ${totals.target}`, icon: Factory },
    { labelAr: 'استثمارات محفزة (مليار ج.م)', labelEn: 'Stimulated investment (B EGP)', value: fmtBillion(totals.investment), hintAr: `${applications.length} طلباً على المنصة`, hintEn: `${applications.length} applications`, icon: TrendingUp },
    { labelAr: 'فرص عمل', labelEn: 'Jobs created', value: totals.jobs.toLocaleString(isAr ? 'ar-EG' : 'en-US'), hintAr: 'مباشرة وغير مباشرة', hintEn: 'Direct & indirect', icon: BarChart3 },
    { labelAr: 'طلبات مسجلة', labelEn: 'Registered applications', value: String(applications.length), hintAr: `${factories.length} مصنعاً مسجلاً`, hintEn: `${factories.length} factories`, icon: FileText },
  ];

  const stories = [
    {
      nameAr: 'مصنع الدلتا للصناعات الهندسية — قويسنا',
      nameEn: 'Delta Engineering — Quesna',
      textAr: 'خفضنا استهلاك الكهرباء 31% بعد تركيب 850 ك.و طاقة شمسية عبر المبادرة، وفترة الاسترداد أقل من 4 سنوات.',
      textEn: 'Cut power use 31% with an 850 kW solar array via the initiative; payback under 4 years.',
      cover: resolveCoverUrl('/covers/solar-2026.jpg'),
      metaAr: 'طاقة شمسية • 850 ك.و',
      metaEn: 'Solar • 850 kW',
    },
    {
      nameAr: 'مجموعة النيل للغزل — المحلة',
      nameEn: 'Nile Textiles — Mahalla',
      textAr: 'أتمتة خط القص والحياكة رفعت الإنتاجية 22% وخفضت الهالك، بتمويل ميسر ومتابعة فنية من مركز تحديث الصناعة.',
      textEn: 'Automating cutting and sewing lifted output 22% with concessional finance and IMC follow-up.',
      cover: resolveCoverUrl('/covers/modernization-2026.jpg'),
      metaAr: 'تحديث صناعي • إنتاجية +22%',
      metaEn: 'Modernization • +22% output',
    },
    {
      nameAr: 'الشركة المصرية للمكونات — العاشر',
      nameEn: 'Egyptian Components — 10th of Ramadan',
      textAr: 'أحللنا 14 مكوناَ مستورداَ بمكون محلي معتمد، وارتفعت نسبة المكون المحلي إلى 58% خلال 18 شهراَ.',
      textEn: 'Localized 14 imported parts; local content reached 58% within 18 months.',
      cover: resolveCoverUrl('/covers/import-substitution-2026.jpg'),
      metaAr: 'توطين • مكون محلي 58%',
      metaEn: 'Localization • 58% local',
    },
  ];

  return (
    <div className="container-custom" style={{ padding: '1.75rem 1.5rem 3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <div className="section-anchor" style={{ marginBottom: '0.4rem' }}>
            <BarChart3 size={18} style={{ color: 'var(--egypt-red)' }} />
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {isAr ? 'الشفافية والإنجازات الوطنية' : 'Transparency & National Achievements'}
            </h1>
          </div>
          <p style={{ fontSize: '0.87rem', color: 'var(--text-muted)', margin: 0, maxWidth: '72ch' }}>
            {isAr
              ? 'مؤشرات مجمعة من بيانات المبادرات والطلبات المسجلة على المنصة — تُحدث تلقائياً مع نمو البيانات.'
              : 'Aggregated indicators from live initiatives and applications data — updated automatically.'}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('showcase')}>
          {isAr ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
          <span>{isAr ? 'عودة للكتالوج' : 'Back to catalog'}</span>
        </button>
      </div>

      {/* Metrics — أرقام مهنية بدون بادجات */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="card" style={{ padding: '1.2rem', borderTop: '3px solid var(--egypt-red)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.6rem' }}>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-hover)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <Icon size={16} />
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {isAr ? m.labelAr : m.labelEn}
                </span>
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }} className="num-ltr">
                {m.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {isAr ? m.hintAr : m.hintEn}
              </div>
            </div>
          );
        })}
      </div>

      {totals.energy > 0 && (
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1rem 1.2rem', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isAr ? 'إجمالي الطاقة الموفرة المبلغ عنها:' : 'Reported saved energy:'}
          </span>
          <strong className="num-ltr" style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
            {totals.energy.toLocaleString(isAr ? 'ar-EG' : 'en-US')} {isAr ? 'ج.و.س' : 'GWh'}
          </strong>
        </div>
      )}

      {/* Per-initiative transparency table */}
      <div className="card" style={{ marginBottom: '1.75rem', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border-subtle)', fontWeight: 750, fontSize: '0.95rem', color: 'var(--text-main)' }}>
          {isAr ? 'تفصيل الإنجازات حسب المبادرة' : 'Achievements by initiative'}
        </div>
        <div className="table-responsive" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'المبادرة' : 'Initiative'}</th>
                <th>{isAr ? 'مستفيد' : 'Benefited'}</th>
                <th>{isAr ? 'مستهدف' : 'Target'}</th>
                <th>{isAr ? 'استثمار (مليار ج.م)' : 'Investment (B)'}</th>
                <th>{isAr ? 'وظائف' : 'Jobs'}</th>
                <th>{isAr ? 'طلبات المنصة' : 'Platform apps'}</th>
              </tr>
            </thead>
            <tbody>
              {initiatives.map(init => {
                const apps = applications.filter(a => a.initiativeId === init.id).length;
                return (
                  <tr key={init.id}>
                    <td style={{ fontWeight: 600 }}>{isAr ? init.titleAr : init.titleEn}</td>
                    <td className="num-ltr">{(init.impactMetrics?.benefitedFactories ?? 0).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</td>
                    <td className="num-ltr">{(init.impactMetrics?.targetFactories ?? 0).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</td>
                    <td className="num-ltr">{fmtBillion(init.impactMetrics?.investmentStimulatedEGP ?? 0)}</td>
                    <td className="num-ltr">{(init.impactMetrics?.jobsCreated ?? 0).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</td>
                    <td className="num-ltr">{apps}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success stories */}
      <div className="section-anchor" style={{ marginBottom: '1rem' }}>
        <Quote size={17} style={{ color: 'var(--egypt-red)' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          {isAr ? 'قصص نجاح من المصانع المصرية' : 'Success stories from Egyptian factories'}
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1.2rem', marginBottom: '1.5rem' }}>
        {stories.map((s, i) => (
          <article key={i} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '150px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
              <img src={s.cover} alt="" loading="lazy"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '1.1rem 1.2rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                {isAr ? s.metaAr : s.metaEn}
              </div>
              <div style={{ fontSize: '0.94rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                {isAr ? s.nameAr : s.nameEn}
              </div>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
                {isAr ? s.textAr : s.textEn}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('showcase')}>
          <span>{isAr ? 'تصفح المبادرات' : 'Browse initiatives'}</span>
          {isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('compare')}>
          <span>{isAr ? 'مقارنة المبادرات' : 'Compare initiatives'}</span>
        </button>
      </div>
    </div>
  );
};
