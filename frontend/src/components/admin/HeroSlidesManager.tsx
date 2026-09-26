import React, { useRef, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { HeroSlide } from '../../types';
import { resolveCoverUrl } from '../../api';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Upload,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  Layers,
  Clock,
  Gauge
} from 'lucide-react';

const PRESET_COVERS = [
  { id: 'solar', labelAr: 'محطة طاقة شمسية', labelEn: 'Solar Energy Plant', url: resolveCoverUrl('/covers/solar-2026.jpg') },
  { id: 'modern', labelAr: 'أتمتة وتحديث 4.0', labelEn: 'Industry 4.0 & Automation', url: resolveCoverUrl('/covers/modernization-2026.jpg') },
  { id: 'heavy', labelAr: 'تصنيع وتعميق محلي', labelEn: 'Heavy Manufacturing', url: resolveCoverUrl('/covers/import-substitution-2026.jpg') },
];

function readAsDataUrl(file: File, maxMB = 8): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxMB * 1024 * 1024) { reject(new Error(`حجم الصورة كبير جداً (الحد الأقصى ${maxMB} ميجابايت)`)); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
    reader.readAsDataURL(file);
  });
}

export const HeroSlidesManager: React.FC = () => {
  const { language, heroSlides, heroSliderInterval, setHeroSliderInterval, saveHeroSlides, deleteHeroSlide, addHeroSlide, updateHeroSlide } = usePlatformStore();
  const isAr = language === 'ar';

  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState({
    titleAr: '',
    titleEn: '',
    subtitleAr: '',
    subtitleEn: '',
    imageUrl: PRESET_COVERS[0].url
  });
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [activeLangTab, setActiveLangTab] = useState<Record<string, 'ar' | 'en'>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 2500);
  };

  const handleIntervalChange = (val: number) => {
    setHeroSliderInterval(val);
    showToast(isAr ? `تم ضبط سرعة التقليب إلى ${val / 1000} ثوانٍ` : `Interval set to ${val / 1000}s`);
  };

  const currentSeconds = (heroSliderInterval || 3000) / 1000;

  const handleAdd = () => {
    setError('');
    if (!draft.titleAr.trim() || !draft.titleEn.trim()) {
      setError(isAr ? 'يرجى إدخال عنوان الشريحة باللغتين العربية والإنجليزية.' : 'Slide title is required in both Arabic and English.');
      return;
    }
    if (heroSlides.length >= 6) {
      setError(isAr ? 'الحد الأقصى للشرائح هو 6 شرائح.' : 'Maximum 6 slides allowed.');
      return;
    }
    try {
      addHeroSlide({
        ...draft,
        titleAr: draft.titleAr.trim(),
        titleEn: draft.titleEn.trim(),
        active: true
      });
      setDraft({
        titleAr: '',
        titleEn: '',
        subtitleAr: '',
        subtitleEn: '',
        imageUrl: PRESET_COVERS[0].url
      });
      setShowAddForm(false);
      showToast(isAr ? 'تمت إضافة الشريحة بنجاح' : 'Slide added successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    }
  };

  const handleDraftFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      setDraft(prev => ({ ...prev, imageUrl: dataUrl }));
      showToast(isAr ? 'تم تحميل الصورة' : 'Image uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    }
    e.target.value = '';
  };

  const handleEditFileUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      updateHeroSlide(id, { imageUrl: dataUrl });
      showToast(isAr ? 'تم تحديث الصورة بنجاح' : 'Image updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    }
    e.target.value = '';
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = heroSlides.findIndex(s => s.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= heroSlides.length) return;
    const next = [...heroSlides];
    const [item] = next.splice(idx, 1);
    next.splice(j, 0, item);
    try {
      saveHeroSlides(next);
      showToast(isAr ? 'تم تغيير الترتيب' : 'Order updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : '');
    }
  };

  const getEditInputRef = (id: string) => {
    if (!editFileRefs.current.has(id)) {
      editFileRefs.current.set(id, null as any);
    }
    return {
      ref: (el: HTMLInputElement | null) => { if (el) editFileRefs.current.set(id, el); },
      trigger: () => editFileRefs.current.get(id)?.click()
    };
  };

  const toggleCardLang = (id: string, lang: 'ar' | 'en') => {
    setActiveLangTab(prev => ({ ...prev, [id]: lang }));
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} style={{ color: 'var(--egypt-red)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {isAr ? 'إدارة صور وشرائح الواجهة الرئيسية (السلايدر)' : 'Hero Slider Management'}
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            {isAr
              ? 'تخصيص كامل للشرائح المعروضة في الصفحة الرئيسية: العناوين، الأوصاف، الصور، ترتيب العرض وسرعة التقليب.'
              : 'Full customization of hero slides: titles, descriptions, images, order and auto-transition interval.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--text-secondary)', background: 'var(--bg-muted)', padding: '0.3rem 0.65rem', borderRadius: '9999px', border: '1px solid var(--border-subtle)' }}>
            {isAr ? `${heroSlides.length} من 6 شرائح` : `${heroSlides.length} / 6 slides`}
          </span>

          <button
            type="button"
            className={`btn ${showAddForm ? 'btn-secondary' : 'btn-primary'} btn-sm`}
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={heroSlides.length >= 6 && !showAddForm}
          >
            <Plus size={15} />
            <span>{showAddForm ? (isAr ? 'إلغاء الإضافة' : 'Cancel') : (isAr ? 'إضافة شريحة جديدة' : 'Add New Slide')}</span>
          </button>
        </div>
      </div>

      {/* Slider Interval Controller */}
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} style={{ color: 'var(--egypt-red)' }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isAr ? 'التحكم في سرعة التقليب التلقائي للسلايدر' : 'Auto-Transition Interval'}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '6px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
              {isAr ? `حالياً: ${currentSeconds} ثوانٍ (${heroSliderInterval || 3000}ms)` : `Current: ${currentSeconds}s`}
            </span>
          </div>

          {/* Quick presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{isAr ? 'خيارات سريعة:' : 'Presets:'}</span>
            {[3000, 5000, 6000, 8000, 10000, 12000].map(ms => {
              const sec = ms / 1000;
              const isSelected = (heroSliderInterval || 3000) === ms;
              return (
                <button
                  key={ms}
                  type="button"
                  onClick={() => handleIntervalChange(ms)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 800 : 600,
                    borderRadius: '6px',
                    border: isSelected ? '1px solid var(--egypt-red)' : '1px solid #CBD5E1',
                    background: isSelected ? 'var(--egypt-red)' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sec}{isAr ? ' ث' : 's'}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Gauge size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="range"
            min={2000}
            max={15000}
            step={1000}
            value={heroSliderInterval || 3000}
            onChange={e => handleIntervalChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--egypt-red)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', minWidth: '48px', textAlign: 'center' }}>
            {currentSeconds}{isAr ? ' ث' : 's'}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="error-box" style={{ marginBottom: '1.25rem' }}>
          {error}
        </div>
      )}

      {successToast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '0.825rem', fontWeight: 700, marginBottom: '1.25rem' }}>
          <CheckCircle2 size={16} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Add New Slide Accordion / Form */}
      {showAddForm && (
        <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem' }}>
            <Sparkles size={16} style={{ color: 'var(--egypt-red)' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {isAr ? 'إنشاء شريحة جديدة للواجهة' : 'Create New Hero Slide'}
            </h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {/* Arabic Fields */}
            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                {isAr ? 'البيانات باللغة العربية' : 'Arabic Information'}
              </div>
              <div className="form-group" style={{ marginBottom: '0.65rem' }}>
                <label className="form-label required">{isAr ? 'عنوان الشريحة (عربي)' : 'Title (AR)'}</label>
                <input
                  type="text"
                  className="form-control"
                  value={draft.titleAr}
                  onChange={e => setDraft({ ...draft, titleAr: e.target.value })}
                  placeholder={isAr ? 'مثال: المبادرة القومية للطاقة النظيفة' : 'e.g. National Clean Energy'}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{isAr ? 'الوصف الفرعي (عربي)' : 'Subtitle (AR)'}</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={draft.subtitleAr}
                  onChange={e => setDraft({ ...draft, subtitleAr: e.target.value })}
                  placeholder={isAr ? 'مثال: تمويل ميسر 5% مع فترة سماح كاملة للمصانع المصرية...' : 'e.g. 5% concessional loan with grace period...'}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            {/* English Fields */}
            <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 750, color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                {isAr ? 'البيانات باللغة الإنجليزية' : 'English Information'}
              </div>
              <div className="form-group" style={{ marginBottom: '0.65rem' }}>
                <label className="form-label required">{isAr ? 'عنوان الشريحة (إنجليزي)' : 'Title (EN)'}</label>
                <input
                  type="text"
                  className="form-control"
                  dir="ltr"
                  value={draft.titleEn}
                  onChange={e => setDraft({ ...draft, titleEn: e.target.value })}
                  placeholder="e.g. National Clean Energy Initiative"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{isAr ? 'الوصف الفرعي (إنجليزي)' : 'Subtitle (EN)'}</label>
                <textarea
                  className="form-control"
                  rows={2}
                  dir="ltr"
                  value={draft.subtitleEn}
                  onChange={e => setDraft({ ...draft, subtitleEn: e.target.value })}
                  placeholder="e.g. 5% soft financing with 1-year grace period for factories..."
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Image Selection for Draft */}
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
            <label className="form-label" style={{ marginBottom: '0.6rem' }}>
              {isAr ? 'صورة الغلاف للشريحة' : 'Slide Cover Image'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {PRESET_COVERS.map(p => {
                const isSelected = draft.imageUrl === p.url;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, imageUrl: p.url })}
                    style={{
                      border: isSelected ? '2px solid var(--egypt-red)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      padding: 0,
                      background: isSelected ? 'var(--egypt-red-soft)' : 'var(--bg-app)',
                      cursor: 'pointer',
                      textAlign: 'start',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ height: '70px', overflow: 'hidden' }}>
                      <img loading="lazy" decoding="async" src={p.url} alt={p.labelAr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: isSelected ? 'var(--egypt-red)' : 'var(--text-main)' }}>
                      {isAr ? p.labelAr : p.labelEn}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Upload size={14} />
                <span>{isAr ? 'رفع صورة من جهازك' : 'Upload custom image'}</span>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleDraftFileUpload} />
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAr ? 'يدعم الصور عالية الدقة (JPG / PNG)' : 'Supports HD images (JPG / PNG)'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAdd}>
              <Plus size={16} />
              <span>{isAr ? 'إضافة الشريحة إلى الواجهة' : 'Add Slide to Hero'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Slide Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1.25rem' }}>
        {heroSlides.map((s: HeroSlide, i: number) => {
          const editRef = getEditInputRef(s.id);
          const lang = activeLangTab[s.id] || 'ar';
          return (
            <div
              key={s.id}
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: 'var(--bg-surface)',
                boxShadow: 'var(--shadow-xs)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'box-shadow var(--transition-normal), border-color var(--transition-normal)',
              }}
            >
              {/* Card Top: Order & Actions Bar */}
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--egypt-red)', color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 750, color: s.active ? '#065F46' : '#6B7280', background: s.active ? '#ECFDF5' : '#F3F4F6', border: `1px solid ${s.active ? '#A7F3D0' : '#E5E7EB'}`, padding: '0.15rem 0.45rem', borderRadius: '9999px' }}>
                    {s.active ? (isAr ? 'معروضة' : 'Active') : (isAr ? 'مخفية' : 'Hidden')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '28px', height: '28px', padding: 0 }}
                    onClick={() => move(s.id, -1)}
                    disabled={i === 0}
                    title={isAr ? 'تحريك لأعلى' : 'Move Up'}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '28px', height: '28px', padding: 0 }}
                    onClick={() => move(s.id, 1)}
                    disabled={i === heroSlides.length - 1}
                    title={isAr ? 'تحريك لأسفل' : 'Move Down'}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '28px', height: '28px', padding: 0, color: '#DC2626' }}
                    onClick={() => {
                      if (window.confirm(isAr ? 'هل أنت متأكد من حذف هذه الشريحة؟' : 'Delete this slide?')) {
                        try {
                          deleteHeroSlide(s.id);
                          showToast(isAr ? 'تم حذف الشريحة' : 'Slide deleted');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : '');
                        }
                      }
                    }}
                    title={isAr ? 'حذف الشريحة' : 'Delete Slide'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Cover Image Preview with Change Overlay */}
              <div style={{ height: '145px', background: '#0F172A', overflow: 'hidden', position: 'relative' }}>
                <img loading="lazy" decoding="async"
                  src={s.imageUrl}
                  alt={isAr ? s.titleAr : s.titleEn}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = resolveCoverUrl('/covers/solar-2026.jpg'); }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)' }} />

                <button
                  type="button"
                  onClick={editRef.trigger}
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    insetInlineEnd: '8px',
                    background: 'rgba(255, 255, 255, 0.92)',
                    backdropFilter: 'blur(6px)',
                    color: '#0F172A',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderRadius: '9999px',
                    padding: '4px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 750,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                  }}
                >
                  <Upload size={12} /> {isAr ? 'تغيير الصورة' : 'Change Image'}
                </button>
                <input
                  ref={editRef.ref}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleEditFileUpload(s.id, e)}
                />
              </div>

              {/* Form Content */}
              <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Language Switch Tabs for Card */}
                <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-muted)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
                  <button
                    type="button"
                    onClick={() => toggleCardLang(s.id, 'ar')}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: lang === 'ar' ? 800 : 500,
                      borderRadius: 'var(--radius-sm)',
                      background: lang === 'ar' ? 'var(--bg-surface)' : 'transparent',
                      color: lang === 'ar' ? 'var(--text-main)' : 'var(--text-muted)',
                      boxShadow: lang === 'ar' ? 'var(--shadow-xs)' : 'none',
                    }}
                  >
                    العربية
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCardLang(s.id, 'en')}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: lang === 'en' ? 800 : 500,
                      borderRadius: 'var(--radius-sm)',
                      background: lang === 'en' ? 'var(--bg-surface)' : 'transparent',
                      color: lang === 'en' ? 'var(--text-main)' : 'var(--text-muted)',
                      boxShadow: lang === 'en' ? 'var(--shadow-xs)' : 'none',
                    }}
                  >
                    English
                  </button>
                </div>

                {lang === 'ar' ? (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        {isAr ? 'العنوان الرئيسي (عربي)' : 'Main Title (AR)'}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={s.titleAr}
                        onChange={e => updateHeroSlide(s.id, { titleAr: e.target.value })}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        {isAr ? 'الوصف الفرعي (عربي)' : 'Subtitle (AR)'}
                      </label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={s.subtitleAr}
                        onChange={e => updateHeroSlide(s.id, { subtitleAr: e.target.value })}
                        style={{ fontSize: '0.82rem', resize: 'vertical' }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        Title (EN)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        dir="ltr"
                        value={s.titleEn}
                        onChange={e => updateHeroSlide(s.id, { titleEn: e.target.value })}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        Subtitle (EN)
                      </label>
                      <textarea
                        className="form-control"
                        rows={2}
                        dir="ltr"
                        value={s.subtitleEn}
                        onChange={e => updateHeroSlide(s.id, { subtitleEn: e.target.value })}
                        style={{ fontSize: '0.82rem', resize: 'vertical' }}
                      />
                    </div>
                  </>
                )}

                {/* Preset image selector */}
                <div style={{ marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${s.active ? 'btn-secondary' : 'btn-outline'}`}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                      onClick={() => updateHeroSlide(s.id, { active: !s.active })}
                    >
                      {s.active ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{s.active ? (isAr ? 'إخفاء الشريحة' : 'Hide Slide') : (isAr ? 'إظهار في الواجهة' : 'Show in Hero')}</span>
                    </button>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {isAr ? 'يُحفظ تلقائياً' : 'Auto-saved'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
