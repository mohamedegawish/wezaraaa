import React, { useMemo, useState } from 'react';
import { usePlatformStore, store } from '../../store/state';
import { Initiative, DEFAULT_CUSTOMIZATION } from '../../types';
import { resolveCoverUrl } from '../../api';
import {
  Search,
  Filter,
  Layers,
  ArrowLeft,
  ArrowRight,
  Edit3,
  Plus,
  Trash2,
  Factory,
  LayoutGrid,
} from 'lucide-react';
import { api } from '../../api';
import { PreEligibilityModal } from './PreEligibilityModal';
import { EditInitiativeModal } from '../admin/EditInitiativeModal';
import { PUBLIC_INITIATIVE_STATUSES } from '../admin/initiatives/initiativeStatus';
import { formatBillions } from '../../utils/format';

/**
 * InitiativesView — الكتالوج الخفيف: شبكة المبادرات فقط (بحث + تصنيف + بطاقات + مقاييس مختصرة).
 * بدون الهيرو (HeroSlider يبقى في صفحة العرض العام إن لزم، لا هنا).
 * زر «عرض الصفحة» ينقل لصفحة المبادرة المنفصلة عبر navigate('initiative-detail', id) بدل المودال.
 */
export const InitiativesView: React.FC = () => {
  const { initiatives, language, navigate, currentUser } = usePlatformStore();
  const isAr = language === 'ar';
  const isAdmin = currentUser.role === 'ministry_admin' || currentUser.role === 'initiative_manager';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Build categories dynamically from live initiatives data
  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    initiatives.forEach(init => {
      if (init.category) categories.add(init.category);
      if (init.categoryEn) categories.add(init.categoryEn);
    });
    return [
      { v: 'ALL', ar: 'الكل', en: 'All' },
      ...Array.from(categories).map(cat => ({ v: cat, ar: cat, en: cat }))
    ];
  }, [initiatives]);

  const [selectedEligibilityInit, setSelectedEligibilityInit] = useState<Initiative | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const filteredInitiatives = initiatives.filter(init => PUBLIC_INITIATIVE_STATUSES.includes(init.status)).filter(init => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      init.titleAr.toLowerCase().includes(q) ||
      init.titleEn.toLowerCase().includes(q) ||
      init.taglineAr.toLowerCase().includes(q) ||
      init.taglineEn.toLowerCase().includes(q);
    const matchesCat = selectedCategory === 'ALL' || init.category === selectedCategory || init.categoryEn === selectedCategory;
    return matchesSearch && matchesCat;
  }).sort((a, b) => {
    // Pin: المبادرة النشطة init-solar-2026 أولاً دائماً.
    const aPinned = a.id === 'init-solar-2026' ? 0 : 1;
    const bPinned = b.id === 'init-solar-2026' ? 0 : 1;
    return aPinned - bPinned;
  });

  const metrics = useMemo(() => {
    const pub = initiatives.filter(i => PUBLIC_INITIATIVE_STATUSES.includes(i.status));
    const active = pub.filter(i => i.status === 'active').length;
    const targetFactories = pub.reduce((s, i) => s + (i.impactMetrics?.targetFactories ?? 0), 0);
    return { active, targetFactories, total: pub.length };
  }, [initiatives]);

  const handleInitiateApply = (initId: string) => {
    if (currentUser.role === 'factory_owner') {
      navigate('factory-portal', initId);
    } else {
      // No demo persona switching — applying requires a real factory account.
      navigate('login');
    }
  };

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      {/* Trust / Metrics Bento — مختصر */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.85rem' }}>
          {[
            { icon: Layers, labelAr: 'مبادرات نشطة', labelEn: 'Active', value: String(metrics.active), subAr: `من ${metrics.total} مبادرة`, subEn: `of ${metrics.total}` },
            { icon: Factory, labelAr: 'مصانع مستهدفة', labelEn: 'Target Factories', value: metrics.targetFactories.toLocaleString(isAr ? 'ar-EG' : 'en-US'), subAr: 'حتى 2027', subEn: 'by 2027' },
          ].map(stat => (
            <div key={stat.labelEn} className="card metric-bento" style={{ padding: '0.95rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--egypt-red-soft)', border: '1px solid rgba(200,16,46,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--egypt-red)' }}>
                <stat.icon size={18} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{isAr ? stat.labelAr : stat.labelEn}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginTop: '0.15rem' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{stat.value}</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '0.1rem' }}>{isAr ? stat.subAr : stat.subEn}</div>
              </div>
            </div>
          ))}
        </div>
        <style>{`@media (max-width: 480px){ section div[style*="repeat(2"]{ grid-template-columns: 1fr !important; } }`}</style>
      </section>

      {/* Search & Filter */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-pill" style={{ flex: '1 1 420px', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.45rem 0.35rem 0.55rem', minHeight: '44px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9999px', background: 'var(--bg-muted)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder={isAr ? 'ابحث عن مبادرة — طاقة شمسية، تحديث، غزل، تمويل 5%...' : 'Search — solar, modernization, textiles, 5%...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-main)', minWidth: 0 }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '9999px' }}>{isAr ? 'مسح' : 'Clear'}</button>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.70rem', fontWeight: 700, color: 'var(--gov-teal)', background: '#F0FDFA', border: '1px solid #CCFBF1', padding: '0.22rem 0.5rem', borderRadius: '9999px', flexShrink: 0 }}>
              <Layers size={11} /> {isAr ? `${filteredInitiatives.length} نتيجة` : `${filteredInitiatives.length} results`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '0.45rem 0.7rem', borderRadius: '9999px' }}>
              <Filter size={14} /> {isAr ? 'التصنيف' : 'Category'}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {categoryOptions.map(opt => {
                const active = selectedCategory === opt.v;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setSelectedCategory(opt.v)}
                    style={{
                      padding: '0.42rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: '1px solid',
                      cursor: 'pointer',
                      transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
                      background: active ? 'var(--egypt-red)' : 'var(--bg-surface)',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      borderColor: active ? 'var(--egypt-red)' : 'var(--border-subtle)',
                      boxShadow: active ? '0 4px 14px rgba(200,16,46,0.14)' : 'none',
                    }}
                  >
                    {isAr ? opt.ar : opt.en}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {isAr ? 'التصفية لا تغيّر العدّاد العلوي — البحث بالنص والتصنيف فقط.' : 'Filter by text + category only.'}
          </span>
        </div>
      </section>

      {/* Initiatives Grid */}
      <section id="initiatives-grid">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ width: '3px', height: '20px', background: 'var(--egypt-red)', borderRadius: '9999px', display: 'inline-block', flexShrink: 0 }} />
              {isAr ? 'المبادرات المتاحة للتقديم' : 'Available Initiatives'}
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--egypt-red)', background: 'var(--egypt-red-soft)', border: '1px solid rgba(200,16,46,0.08)', padding: '0.18rem 0.5rem', borderRadius: '9999px' }}>{filteredInitiatives.length}</span>
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0', lineHeight: 1.5 }}>
              {isAr ? 'اختر مبادرة لاستعراض صفحتها، فحص الأهلية، ثم التقديم الإلكتروني.' : 'Pick an initiative to open its page, check eligibility, then apply.'}
            </p>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setCreatingNew(true)} style={{ fontSize: '0.85rem', boxShadow: '0 4px 14px rgba(200,16,46,0.14)' }}>
              <Plus size={15} />
              <span>{isAr ? 'إنشاء مبادرة جديدة' : 'New Initiative'}</span>
            </button>
          )}
        </div>

        <div className="reveal-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap: '1.15rem' }}>
          {filteredInitiatives.map(initiative => {
            const isComingSoon = initiative.status === 'coming_soon';
            const custom = { ...DEFAULT_CUSTOMIZATION, ...(initiative.customization || {}) };
            return (
              <div
                key={initiative.id}
                className="card card-interactive initiative-card"
                style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)' }}
              >
                <div
                  className="card-cover initiative-cover"
                  style={{ height: '168px', position: 'relative', background: 'var(--egypt-black)', flexShrink: 0, overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => navigate('initiative-detail', initiative.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('initiative-detail', initiative.id); } }}
                  role="link"
                  tabIndex={0}
                  aria-label={isAr ? `فتح صفحة مبادرة ${initiative.titleAr}` : `Open ${initiative.titleEn} page`}
                  title={isAr ? initiative.titleAr : initiative.titleEn}
                >
                  <img
                    src={resolveCoverUrl(initiative.coverImage)}
                    alt={isAr ? initiative.titleAr : initiative.titleEn}
                    loading="lazy"
                    decoding="async"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,23,42,0.08) 0%, rgba(15,23,42,0.42) 82%)' }} />
                  <div style={{ position: 'absolute', top: '0.75rem', right: isAr ? '0.75rem' : 'auto', left: isAr ? 'auto' : '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.01em', background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.8)', padding: '0.26rem 0.65rem', borderRadius: '9999px', color: '#0F172A', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      {isAr ? initiative.category : initiative.categoryEn}
                    </span>
                  </div>
                  {isComingSoon && (
                    <div style={{ position: 'absolute', top: '0.75rem', left: isAr ? '0.75rem' : 'auto', right: isAr ? 'auto' : '0.75rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 750, color: '#92400E', background: 'rgba(255, 251, 235, 0.95)', backdropFilter: 'blur(8px)', border: '1px solid #FDE68A', borderRadius: '9999px', padding: '0.26rem 0.65rem', boxShadow: '0 2px 8px rgba(146,64,14,0.12)' }}>
                        {isAr ? initiative.badgeTextAr : initiative.badgeTextEn}
                      </span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: '0.75rem', right: isAr ? '0.75rem' : 'auto', left: isAr ? 'auto' : '0.75rem', display: 'flex', alignItems: 'end', gap: '0.6rem' }}>
                    <div style={{ color: '#fff' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 700, opacity: 0.9, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{isAr ? 'المخصصات' : 'Allocation'}</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 10px rgba(0,0,0,0.22)' }}>
                        {formatBillions(initiative.budgetTotalEGP, isAr)} <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.92 }}>{isAr ? 'مليار ج.م' : 'B EGP'}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', padding: '0.22rem 0.45rem', borderRadius: '9999px' }}>
                      {isAr ? `${(initiative.impactMetrics?.targetFactories ?? 0).toLocaleString('ar-EG')} مصنع مستهدف` : `${(initiative.impactMetrics?.targetFactories ?? 0).toLocaleString('en-US')} factories`}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '1.1rem 1.15rem 1rem 1.15rem', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <h3
                    style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.35, margin: 0, letterSpacing: '-0.015em', cursor: 'pointer' }}
                    onClick={() => navigate('initiative-detail', initiative.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('initiative-detail', initiative.id); } }}
                    role="link"
                    tabIndex={0}
                    title={isAr ? initiative.titleAr : initiative.titleEn}
                  >
                    {isAr ? initiative.titleAr : initiative.titleEn}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0.45rem 0 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.7em' }}>
                    {isAr ? initiative.taglineAr : initiative.taglineEn}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.32rem', marginTop: '0.75rem' }}>
                    {((initiative.targetSectors ?? []).slice(0, 3)).map((sec, i) => (
                      <span key={i} style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)', fontSize: '0.70rem', fontWeight: 600, padding: '0.22rem 0.5rem', borderRadius: '9999px', border: '1px solid var(--border-subtle)', maxWidth: '14ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sec}
                      </span>
                    ))}
                    {(initiative.targetSectors ?? []).length > 3 && (
                      <span style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '0.18rem 0.45rem', borderRadius: '9999px' }}>
                        +{(initiative.targetSectors ?? []).length - 3}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', marginTop: '0.9rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '0.55rem 0.7rem', fontSize: '0.82rem', borderRadius: '9999px' }} onClick={e => { e.stopPropagation(); navigate('initiative-detail', initiative.id); }}>
                      <LayoutGrid size={14} />
                      <span>{isAr ? 'عرض الصفحة' : 'View Page'}</span>
                    </button>
                    {custom.enablePreEligibility && (
                      <button className="btn btn-outline" style={{ padding: '0.55rem 0.7rem', fontSize: '0.82rem', borderRadius: '9999px' }} onClick={e => { e.stopPropagation(); setSelectedEligibilityInit(initiative); }} title={isAr ? 'فحص الأهلية' : 'Quiz'}>
                        <span>{isAr ? 'الأهلية' : 'Quiz'}</span>
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1.15, padding: '0.55rem 0.85rem', fontSize: '0.82rem', borderRadius: '9999px' }}
                      onClick={e => { e.stopPropagation(); handleInitiateApply(initiative.id); }}
                      disabled={isComingSoon}
                    >
                      <span>{isAr ? 'التقديم' : 'Apply'}</span>
                      <span className="btn-arrow">{isAr ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}</span>
                    </button>
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.55rem' }}>
                      {/* الإدارة الكاملة (تعديل/حالة/نسخ/حذف/تحليلات) في مساحة المبادرة بالأدمن */}
                      <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.78rem', padding: '0.42rem', borderRadius: '9999px' }} onClick={() => navigate('admin-initiative', initiative.id)}>
                        <Edit3 size={12} />
                        <span>{isAr ? 'إدارة' : 'Manage'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredInitiatives.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.25rem', gridColumn: '1 / -1', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--bg-muted)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto', color: 'var(--text-muted)' }}>
                <Search size={20} />
              </div>
              <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>{isAr ? 'لا توجد نتائج مطابقة' : 'No matching results'}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 1rem 0' }}>{isAr ? 'جرّب كلمات مختلفة أو غيّر التصنيف إلى "الكل".' : 'Try different keywords or switch category to All.'}</p>
              <button className="btn btn-secondary" style={{ borderRadius: '9999px' }} onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}>
                {isAr ? 'إعادة الضبط' : 'Reset'}
              </button>
            </div>
          )}
        </div>
      </section>

      {selectedEligibilityInit && (
        <PreEligibilityModal
          initiative={selectedEligibilityInit}
          onClose={() => setSelectedEligibilityInit(null)}
          onProceedToApply={() => navigate('factory-portal', selectedEligibilityInit.id)}
        />
      )}
      {creatingNew && <EditInitiativeModal initiative={null} onClose={() => setCreatingNew(false)} />}
    </div>
  );
};
