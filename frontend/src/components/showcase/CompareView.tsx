import React, { useMemo, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { Scale, ArrowLeft, ArrowRight, Eye, Trash2 } from 'lucide-react';
import { InitiativeLandingModal } from './InitiativeLandingModal';
import { PreEligibilityModal } from './PreEligibilityModal';
import { Initiative } from '../../types';
import { formatBillions } from '../../utils/format';

const COMPARE_KEY = 'egypt_ind_compare_v1';

function loadCompare(): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
  } catch { return []; }
}

/**
 * CompareView — مقارنة جنباً إلى جنب (Master Plan 2-ج).
 * اختيار 2-3 مبادرات ومقارنة الشروط والتمويل والمستندات ومدة SLA.
 */
export const CompareView: React.FC = () => {
  const { initiatives, language, navigate, currentUser, isViewAllowed } = usePlatformStore();
  const isAr = language === 'ar';
  // زر "الأثر الوطني" يظهر فقط للأدمن — نفس بوابة الصلاحيات (isViewAllowed)
  // التي تحمي المسار في App.tsx؛ أي دور غير admin لن يرى الزر أصلاً.
  const canViewImpact = isViewAllowed('impact', currentUser);
  const [ids, setIds] = useState<string[]>(() => loadCompare());
  const [detailInit, setDetailInit] = useState<Initiative | null>(null);
  const [eligInit, setEligInit] = useState<Initiative | null>(null);

  const selected = useMemo(
    () => ids.map(id => initiatives.find(i => i.id === id)).filter(Boolean) as Initiative[],
    [ids, initiatives]
  );

  const toggle = (id: string) => {
    setIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : (prev.length >= 3 ? prev : [...prev, id]);
      try { localStorage.setItem(COMPARE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const clear = () => {
    setIds([]);
    try { localStorage.setItem(COMPARE_KEY, '[]'); } catch { /* ignore */ }
  };

  const rows: { labelAr: string; labelEn: string; render: (i: Initiative) => React.ReactNode }[] = [
    { labelAr: 'الحالة', labelEn: 'Status', render: i => (isAr ? i.badgeTextAr : i.badgeTextEn) || (isAr ? i.status : i.status) },
    { labelAr: 'التصنيف', labelEn: 'Category', render: i => (isAr ? i.category : i.categoryEn) },
    {
      labelAr: 'إجمالي المخصصات', labelEn: 'Total budget',
      render: i => <span className="num-ltr">{formatBillions(i.budgetTotalEGP, isAr)} {isAr ? 'مليار ج.م' : 'B EGP'}</span>,
    },
    {
      labelAr: 'القطاعات المستهدفة', labelEn: 'Sectors',
      render: i => <span style={{ fontSize: '0.8rem' }}>{((isAr ? i.targetSectors : i.targetSectorsEn) ?? []).slice(0, 3).join(isAr ? '، ' : ', ')}</span>,
    },
    {
      labelAr: 'عدد المراحل', labelEn: 'Stages',
      render: i => <span className="num-ltr">{i.workflow?.stages?.length ?? 0}</span>,
    },
    {
      labelAr: 'متوسط SLA / مرحلة', labelEn: 'Avg SLA',
      render: i => {
        const st = i.workflow?.stages ?? [];
        const avg = st.length ? Math.round(st.reduce((s, x) => s + (x.slaDays || 0), 0) / st.length) : 0;
        return <span className="num-ltr">{avg} {isAr ? 'أيام' : 'days'}</span>;
      },
    },
    {
      labelAr: 'المستندات المطلوبة', labelEn: 'Required docs',
      render: i => <span className="num-ltr">{i.requiredDocsList?.length ?? 0}</span>,
    },
    {
      labelAr: 'الحوافز', labelEn: 'Benefits',
      render: i => <span className="num-ltr">{i.benefits?.length ?? 0}</span>,
    },
    {
      labelAr: 'فحص الأهلية', labelEn: 'Pre-check',
      render: i => (i.preEligibilityQuestions?.length ?? 0) > 0 ? (isAr ? 'متاح' : 'Available') : (isAr ? 'غير متاح' : 'N/A'),
    },
  ];

  return (
    <div className="container-custom" style={{ padding: '1.75rem 1.5rem 3rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <div className="section-anchor" style={{ marginBottom: '0.4rem' }}>
            <Scale size={18} style={{ color: 'var(--egypt-red)' }} />
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {isAr ? 'مقارنة المبادرات' : 'Compare Initiatives'}
            </h1>
          </div>
          <p style={{ fontSize: '0.87rem', color: 'var(--text-muted)', margin: 0, maxWidth: '70ch' }}>
            {isAr
              ? 'اختر مبادرتين أو ثلاثاً للمقارنة المباشرة في الشروط والتمويل والمستندات ومدد الخدمة قبل التقديم.'
              : 'Pick two or three initiatives to compare terms, funding, documents and SLAs side by side.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('showcase')}>
            {isAr ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
            <span>{isAr ? 'عودة للكتالوج' : 'Back to catalog'}</span>
          </button>
          {ids.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clear} style={{ color: 'var(--egypt-red)' }}>
              <Trash2 size={13} />
              <span>{isAr ? 'مسح الاختيار' : 'Clear'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Selector */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.2rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.7rem' }}>
          {isAr ? 'اختيار المبادرات (بحد أقصى 3)' : 'Select initiatives (max 3)'}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {initiatives.map(init => {
            const active = ids.includes(init.id);
            return (
              <button key={init.id} onClick={() => toggle(init.id)}
                style={{
                  fontSize: '0.8rem', fontWeight: active ? 700 : 500, padding: '0.4rem 0.8rem',
                  borderRadius: '9999px', cursor: 'pointer',
                  background: active ? 'var(--text-main)' : 'var(--bg-hover)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--text-main)' : 'var(--border-subtle)'}`,
                }}>
                {isAr ? init.titleAr.slice(0, 30) : init.titleEn.slice(0, 34)}
              </button>
            );
          })}
        </div>
      </div>

      {selected.length < 2 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <Scale size={30} style={{ color: 'var(--text-light)', marginBottom: '0.6rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isAr ? 'اختر مبادرتين على الأقل لعرض جدول المقارنة.' : 'Select at least two initiatives to show the comparison table.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table" style={{ minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '160px' }}>{isAr ? 'وجه المقارنة' : 'Dimension'}</th>
                {selected.map(init => (
                  <th key={init.id} style={{ minWidth: '210px' }}>
                    <div style={{ fontWeight: 750, color: 'var(--text-main)', textTransform: 'none', letterSpacing: 0, fontSize: '0.87rem', whiteSpace: 'normal' }}>
                      {isAr ? init.titleAr : init.titleEn}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDetailInit(init)}>
                        <Eye size={12} />
                        <span>{isAr ? 'التفاصيل' : 'Details'}</span>
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(init.id)} style={{ color: 'var(--egypt-red)' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <td style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {isAr ? row.labelAr : row.labelEn}
                  </td>
                  {selected.map(init => (
                    <td key={init.id} style={{ fontSize: '0.85rem' }}>{row.render(init)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailInit && (
        <InitiativeLandingModal
          initiative={detailInit}
          onClose={() => setDetailInit(null)}
          onOpenPreEligibility={() => setEligInit(detailInit)}
          onApplyDirect={() => navigate('factory-portal', detailInit.id)}
        />
      )}
      {eligInit && (
        <PreEligibilityModal
          initiative={eligInit}
          onClose={() => setEligInit(null)}
          onProceedToApply={() => navigate('factory-portal', eligInit.id)}
        />
      )}

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {canViewImpact && (
        <button className="btn btn-secondary" onClick={() => navigate('impact')}>
          <span>{isAr ? 'عرض الإنجازات الوطنية وقصص النجاح' : 'View national achievements'}</span>
          {isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
        </button>
        )}
      </div>
    </div>
  );
};
