import React from 'react';
import { usePlatformStore } from '../../store/state';
import {
  Landmark,
  Building2,
  Briefcase,
  Handshake,
  Lightbulb,
  Rocket,
  TrendingUp,
  Database,
  Tags,
  ClipboardCheck,
  Network,
  Activity,
  Target,
} from 'lucide-react';

/**
 * PlatformAbout — تعريف المنصة في الصفحة الرئيسية:
 * عن المنصة (الرؤية + شركاء المنظومة + من الفكرة إلى الأثر) · الأهداف الرئيسية.
 * كل النصوص Ar/En عبر language. التنسيق في globals.css (home-*).
 */
export const PlatformAbout: React.FC = () => {
  const { language } = usePlatformStore();
  const isAr = language === 'ar';

  const stakeholders = [
    { icon: <Landmark size={16} />, ar: 'الجهات الحكومية', en: 'Government bodies' },
    { icon: <Building2 size={16} />, ar: 'القطاع الخاص', en: 'Private sector' },
    { icon: <Briefcase size={16} />, ar: 'المستثمرون', en: 'Investors' },
    { icon: <Handshake size={16} />, ar: 'الجهات التمويلية والتنموية', en: 'Financing & development bodies' },
  ];

  const journey = [
    { icon: <Lightbulb size={18} />, ar: 'أفكار ومقترحات', en: 'Ideas & proposals' },
    { icon: <Rocket size={18} />, ar: 'مشروعات قابلة للتنفيذ', en: 'Executable projects' },
    { icon: <TrendingUp size={18} />, ar: 'أثر اقتصادي قابل للقياس', en: 'Measurable economic impact' },
  ];

  const goals = [
    {
      icon: <Database size={20} />,
      titleAr: 'الحصر والتجميع',
      titleEn: 'Catalogue',
      descAr: 'حصر وتجميع جميع المبادرات الصناعية التي تطلقها وزارة الصناعة في قاعدة بيانات وطنية موحدة.',
      descEn: 'Gather every industrial initiative launched by the Ministry of Industry into one unified national database.',
    },
    {
      icon: <Tags size={20} />,
      titleAr: 'التصنيف',
      titleEn: 'Classify',
      descAr: 'تصنيف المبادرات حسب القطاع الصناعي، والمنطقة الجغرافية، والأولوية، وحجم الاستثمار.',
      descEn: 'Classify initiatives by industrial sector, geographic region, priority and investment size.',
    },
    {
      icon: <ClipboardCheck size={20} />,
      titleAr: 'التقييم والجاهزية',
      titleEn: 'Assess readiness',
      descAr: 'تقييم المبادرات فنياً واقتصادياً وتحديد مدى جاهزيتها للتنفيذ.',
      descEn: 'Evaluate initiatives technically and economically and determine their readiness for execution.',
    },
    {
      icon: <Network size={20} />,
      titleAr: 'الربط والتنسيق',
      titleEn: 'Connect',
      descAr: 'ربط المبادرات بالجهات والوزارات المعنية والبرامج التمويلية.',
      descEn: 'Link initiatives with the relevant entities, ministries and financing programs.',
    },
    {
      icon: <Activity size={20} />,
      titleAr: 'متابعة التنفيذ والأثر',
      titleEn: 'Track execution & impact',
      descAr: 'متابعة التنفيذ ومؤشرات الأداء والأثر الاقتصادي لكل مبادرة.',
      descEn: 'Monitor execution, performance indicators and the economic impact of every initiative.',
    },
    {
      icon: <Target size={20} />,
      titleAr: 'رصد الفجوات والفرص',
      titleEn: 'Spot gaps & opportunities',
      descAr: 'تحديد الفجوات والفرص الصناعية التي تتطلب إطلاق مبادرات جديدة.',
      descEn: 'Identify industrial gaps and opportunities that call for new initiatives.',
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
    <>
      {/* عن المنصة */}
      <section aria-label={isAr ? 'عن المنصة' : 'About the platform'} className="home-section">
        <div className="section-anchor">
          <h2 style={sectionTitle}>{isAr ? 'عن المنصة' : 'About the platform'}</h2>
        </div>
        <div className="card home-about">
          <div>
            <p className="home-about-lead">
              {isAr
                ? 'في إطار حرص وزارة الصناعة على دعم الصناعة المصرية، وتماشياً مع المستهدفات الرئيسية للاستراتيجية الوطنية للصناعة، أطلقت الوزارة منصة وطنية موحدة تهدف إلى حصر وتنسيق وإدارة ومتابعة المبادرات والبرامج ذات الصلة بالتنمية الصناعية.'
                : "As part of the Ministry of Industry's commitment to Egyptian industry, and in line with the key targets of the National Industrial Strategy, the Ministry has launched a unified national platform to catalogue, coordinate, manage and monitor industrial-development initiatives and programs."}
            </p>
            <div className="home-journey" aria-label={isAr ? 'من الفكرة إلى الأثر' : 'From idea to impact'}>
              {journey.map(j => (
                <div key={j.en} className="home-journey-step">
                  <span className="home-journey-dot" aria-hidden>{j.icon}</span>
                  <span>{isAr ? j.ar : j.en}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="home-about-panel">
            <p className="home-about-label">{isAr ? 'تربط المنصة بين' : 'The platform connects'}</p>
            <div className="home-stakeholders">
              {stakeholders.map(s => (
                <span key={s.en} className="home-stakeholder">
                  {s.icon}
                  {isAr ? s.ar : s.en}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* الأهداف الرئيسية */}
      <section aria-label={isAr ? 'الأهداف الرئيسية' : 'Key objectives'} className="home-section">
        <div className="section-anchor">
          <h2 style={sectionTitle}>{isAr ? 'الأهداف الرئيسية' : 'Key objectives'}</h2>
        </div>
        <div className="home-grid home-grid-3">
          {goals.map(g => (
            <div key={g.titleEn} className="home-card">
              <span className="home-card-icon">{g.icon}</span>
              <h3 className="home-card-title">{isAr ? g.titleAr : g.titleEn}</h3>
              <p className="home-card-desc">{isAr ? g.descAr : g.descEn}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};
