import React, { useState } from 'react';
import { FormSection, FormFieldDefinition, FieldType } from '../../types';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Eye,
} from 'lucide-react';

interface Props {
  sections: FormSection[];
  onChange: (next: FormSection[]) => void;
  isAr: boolean;
}

const FIELD_TYPES: { id: FieldType; ar: string; en: string }[] = [
  { id: 'text', ar: 'نص قصير', en: 'Short text' },
  { id: 'number', ar: 'رقم', en: 'Number' },
  { id: 'email', ar: 'بريد إلكتروني', en: 'Email' },
  { id: 'phone', ar: 'هاتف', en: 'Phone' },
  { id: 'date', ar: 'تاريخ', en: 'Date' },
  { id: 'select', ar: 'قائمة منسدلة', en: 'Dropdown' },
  { id: 'multi_select', ar: 'اختيار متعدد', en: 'Multi-select' },
  { id: 'radio', ar: 'اختيار واحد (راديو)', en: 'Radio' },
  { id: 'checkbox', ar: 'مربع اختيار', en: 'Checkbox' },
  { id: 'textarea', ar: 'نص طويل', en: 'Long text' },
  { id: 'file', ar: 'رفع ملف', en: 'File upload' },
  { id: 'repeating_table', ar: 'جدول متكرر', en: 'Repeating table' },
];

const OPERATORS = [
  { id: 'equals', ar: 'يساوي', en: 'Equals' },
  { id: 'greater_than', ar: 'أكبر من', en: 'Greater than' },
  { id: 'less_than', ar: 'أصغر من', en: 'Less than' },
  { id: 'contains', ar: 'يحتوي', en: 'Contains' },
  { id: 'is_not_empty', ar: 'غير فارغ', en: 'Not empty' },
] as const;

const CHOICE_TYPES: FieldType[] = ['select', 'multi_select', 'radio'];
const uid = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const fieldTypeName = (t: string, isAr: boolean) =>
  FIELD_TYPES.find(x => x.id === t)?.[isAr ? 'ar' : 'en'] ?? t;

function fieldProblems(f: FormFieldDefinition): string[] {
  const out: string[] = [];
  if (!f.labelAr.trim() || !f.labelEn.trim()) out.push('label');
  if (CHOICE_TYPES.includes(f.type) && (f.options ?? []).length < 2) out.push('options');
  return out;
}

/**
 * منشئ النماذج الديناميكية — منطق تعديل كامل:
 * أقسام (إضافة/تعديل/تكرار/حذف/ترتيب) + حقول (كل خصائص FormFieldDefinition)
 * + خيارات منظمة (labelAr/labelEn/value) + شرط إظهار + معاينة حية.
 */
export const FormSchemaBuilder: React.FC<Props> = ({ sections, onChange, isAr }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const allFields: { id: string; label: string }[] = sections.flatMap(s =>
    s.fields.map(f => ({ id: f.id, label: isAr ? (f.labelAr || f.id) : (f.labelEn || f.id) })),
  );

  // ── Sections ──
  const patchSection = (si: number, patch: Partial<FormSection>) =>
    onChange(sections.map((s, j) => (j === si ? { ...s, ...patch } : s)));
  const moveSection = (si: number, dir: -1 | 1) => {
    const j = si + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(si, 1);
    next.splice(j, 0, item);
    onChange(next);
  };
  const duplicateSection = (si: number) => {
    const src = sections[si];
    const copy: FormSection = {
      ...src,
      id: uid('sec'),
      titleAr: `${src.titleAr} (${isAr ? 'نسخة' : 'copy'})`,
      titleEn: `${src.titleEn} (copy)`,
      fields: src.fields.map(f => ({
        ...f,
        id: uid('fld'),
        options: f.options?.map(o => ({ ...o })),
        condition: f.condition ? { ...f.condition } : undefined,
      })),
    };
    const next = [...sections];
    next.splice(si + 1, 0, copy);
    onChange(next);
  };
  const addSection = () =>
    onChange([...sections, { id: uid('sec'), titleAr: '', titleEn: '', descriptionAr: '', descriptionEn: '', fields: [] }]);

  // ── Fields ──
  const patchField = (si: number, fi: number, patch: Partial<FormFieldDefinition>) =>
    onChange(sections.map((s, j) => (j !== si ? s : {
      ...s,
      fields: s.fields.map((f, k) => (k === fi ? { ...f, ...patch } : f)),
    })));
  const moveField = (si: number, fi: number, dir: -1 | 1) => {
    const fields = sections[si].fields;
    const j = fi + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(fi, 1);
    next.splice(j, 0, item);
    patchSection(si, { fields: next });
  };
  const duplicateField = (si: number, fi: number) => {
    const src = sections[si].fields[fi];
    const copy: FormFieldDefinition = {
      ...src,
      id: uid('fld'),
      labelAr: `${src.labelAr} (${isAr ? 'نسخة' : 'copy'})`,
      options: src.options?.map(o => ({ ...o })),
      condition: src.condition ? { ...src.condition } : undefined,
    };
    const fields = [...sections[si].fields];
    fields.splice(fi + 1, 0, copy);
    patchSection(si, { fields });
  };
  const deleteField = (si: number, fi: number) =>
    patchSection(si, { fields: sections[si].fields.filter((_, k) => k !== fi) });
  const addField = (si: number) =>
    patchSection(si, {
      fields: [...sections[si].fields, { id: uid('fld'), labelAr: '', labelEn: '', type: 'text', required: true } as FormFieldDefinition],
    });

  const toggleExpand = (id: string) => setExpanded(cur => (cur === id ? null : id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {isAr
            ? `الأقسام: ${sections.length} — الحقول: ${sections.reduce((n, s) => n + s.fields.length, 0)}. التعديل ينعكس فوراً على معالج التقديم.`
            : `Sections: ${sections.length} — Fields: ${sections.reduce((n, s) => n + s.fields.length, 0)}. Edits apply live to the wizard.`}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreview(p => !p)}>
          <Eye size={13} />
          <span>{preview ? (isAr ? 'إخفاء المعاينة' : 'Hide preview') : (isAr ? 'معاينة النموذج' : 'Preview form')}</span>
        </button>
      </div>

      {sections.map((s, si) => (
        <div key={s.id} style={{ border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
          {/* Section header */}
          <div style={{ padding: '0.75rem', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.875rem' }}>{isAr ? `قسم ${si + 1}` : `Section ${si + 1}`}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.fields.length} {isAr ? 'حقل' : 'fields'}</span>
            <span style={{ marginInlineStart: 'auto', display: 'flex', gap: '0.3rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" title={isAr ? 'لأعلى' : 'Up'} disabled={si === 0} onClick={() => moveSection(si, -1)}><ArrowUp size={13} /></button>
              <button type="button" className="btn btn-secondary btn-sm" title={isAr ? 'لأسفل' : 'Down'} disabled={si === sections.length - 1} onClick={() => moveSection(si, 1)}><ArrowDown size={13} /></button>
              <button type="button" className="btn btn-secondary btn-sm" title={isAr ? 'تكرار القسم' : 'Duplicate'} onClick={() => duplicateSection(si)}><Copy size={13} /></button>
              <button type="button" className="btn btn-secondary btn-sm" title={isAr ? 'حذف القسم' : 'Delete'} onClick={() => onChange(sections.filter((_, j) => j !== si))}><Trash2 size={13} /></button>
            </span>
          </div>

          <div style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input className="form-control" placeholder={isAr ? 'عنوان القسم عربي *' : 'Section title AR *'} value={s.titleAr}
              onChange={e => patchSection(si, { titleAr: e.target.value })} />
            <input className="form-control" placeholder="Section title EN *" dir="ltr" value={s.titleEn}
              onChange={e => patchSection(si, { titleEn: e.target.value })} />
            <textarea className="form-control" rows={1} placeholder={isAr ? 'وصف القسم عربي (اختياري)' : 'Section description AR (optional)'} value={s.descriptionAr ?? ''}
              onChange={e => patchSection(si, { descriptionAr: e.target.value })} />
            <textarea className="form-control" rows={1} placeholder="Section description EN (optional)" dir="ltr" value={s.descriptionEn ?? ''}
              onChange={e => patchSection(si, { descriptionEn: e.target.value })} />
            {(!s.titleAr.trim() || !s.titleEn.trim()) && (
              <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--status-pending-text)', fontWeight: 700, display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <AlertTriangle size={13} /> {isAr ? 'عنوان القسم عربي وإنجليزي مطلوب.' : 'Section title AR/EN required.'}
              </div>
            )}
          </div>

          {/* Fields */}
          <div style={{ padding: '0 0.75rem 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {s.fields.map((f, fi) => {
              const problems = fieldProblems(f);
              const open = expanded === f.id;
              return (
                <div key={f.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.6rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => toggleExpand(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.825rem', color: 'var(--text-main)' }}>
                      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{(isAr ? f.labelAr : f.labelEn) || (isAr ? `حقل ${fi + 1} (بدون عنوان)` : `Field ${fi + 1} (untitled)`)}</span>
                    </button>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '999px', padding: '0.1rem 0.5rem' }}>
                      {fieldTypeName(f.type, isAr)}{f.required ? (isAr ? ' • إجباري' : ' • required') : ''}
                    </span>
                    {problems.length > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--status-pending-text)', fontWeight: 700, display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                        <AlertTriangle size={12} />
                        {problems.includes('label')
                          ? (isAr ? 'التسمية ناقصة' : 'Label missing')
                          : (isAr ? 'الخيارات أقل من 2' : 'Need ≥ 2 options')}
                      </span>
                    )}
                    <span style={{ marginInlineStart: 'auto', display: 'flex', gap: '0.25rem' }}>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={fi === 0} onClick={() => moveField(si, fi, -1)}><ArrowUp size={12} /></button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={fi === s.fields.length - 1} onClick={() => moveField(si, fi, 1)}><ArrowDown size={12} /></button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => duplicateField(si, fi)}><Copy size={12} /></button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => deleteField(si, fi)}><Trash2 size={12} /></button>
                    </span>
                  </div>

                  {open && (
                    <div style={{ padding: '0.6rem', borderTop: '1px dashed var(--border-medium)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <input className="form-control" placeholder={isAr ? 'التسمية عربي *' : 'Label AR *'} value={f.labelAr}
                          onChange={e => patchField(si, fi, { labelAr: e.target.value })} />
                        <input className="form-control" placeholder="Label EN *" dir="ltr" value={f.labelEn}
                          onChange={e => patchField(si, fi, { labelEn: e.target.value })} />
                        <select className="form-control" value={f.type}
                          onChange={e => patchField(si, fi, { type: e.target.value as FieldType })}>
                          {FIELD_TYPES.map(t => <option key={t.id} value={t.id}>{isAr ? t.ar : t.en} ({t.id})</option>)}
                        </select>
                        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                          <input type="checkbox" checked={!!f.required}
                            onChange={e => patchField(si, fi, { required: e.target.checked })} />
                          {isAr ? 'حقل إجباري' : 'Required'}
                        </label>
                      </div>

                      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <input className="form-control" placeholder={isAr ? 'مثال داخل الحقل عربي' : 'Placeholder AR'} value={f.placeholderAr ?? ''}
                          onChange={e => patchField(si, fi, { placeholderAr: e.target.value })} />
                        <input className="form-control" placeholder="Placeholder EN" dir="ltr" value={f.placeholderEn ?? ''}
                          onChange={e => patchField(si, fi, { placeholderEn: e.target.value })} />
                        <input className="form-control" placeholder={isAr ? 'نص مساعد عربي' : 'Help text AR'} value={f.helpTextAr ?? ''}
                          onChange={e => patchField(si, fi, { helpTextAr: e.target.value })} />
                        <input className="form-control" placeholder="Help text EN" dir="ltr" value={f.helpTextEn ?? ''}
                          onChange={e => patchField(si, fi, { helpTextEn: e.target.value })} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                        {f.type === 'number' && (
                          <>
                            <label style={{ fontSize: '0.75rem' }}>{isAr ? 'أدنى قيمة' : 'Min'}
                              <input type="number" className="form-control" value={f.min ?? ''} onChange={e => patchField(si, fi, { min: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                            <label style={{ fontSize: '0.75rem' }}>{isAr ? 'أقصى قيمة' : 'Max'}
                              <input type="number" className="form-control" value={f.max ?? ''} onChange={e => patchField(si, fi, { max: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                          </>
                        )}
                        <label style={{ fontSize: '0.75rem' }}>{isAr ? 'قيمة افتراضية' : 'Default value'}
                          <input className="form-control" dir="ltr" value={f.defaultValue ?? ''} onChange={e => patchField(si, fi, { defaultValue: e.target.value === '' ? undefined : e.target.value })} /></label>
                        <label style={{ fontSize: '0.75rem' }}>{isAr ? 'تصنيف (اختياري)' : 'Category (optional)'}
                          <input className="form-control" dir="ltr" value={f.category ?? ''} onChange={e => patchField(si, fi, { category: e.target.value || undefined })} /></label>
                      </div>

                      {/* Options */}
                      {CHOICE_TYPES.includes(f.type) && (
                        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.6rem', background: 'var(--bg-surface)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                            {isAr ? `الخيارات (${(f.options ?? []).length}) — كل خيار: عربي + إنجليزي + قيمة` : `Options (${(f.options ?? []).length}) — each: AR + EN + value`}
                          </div>
                          {(f.options ?? []).map((o, oi) => (
                            <div key={oi} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.4rem', marginBottom: '0.4rem' }}>
                              <input className="form-control" placeholder="تسمية عربي" value={o.labelAr}
                                onChange={e => patchField(si, fi, { options: (f.options ?? []).map((x, k) => (k === oi ? { ...x, labelAr: e.target.value } : x)) })} />
                              <input className="form-control" placeholder="Label EN" dir="ltr" value={o.labelEn}
                                onChange={e => patchField(si, fi, { options: (f.options ?? []).map((x, k) => (k === oi ? { ...x, labelEn: e.target.value } : x)) })} />
                              <input className="form-control" placeholder="value" dir="ltr" value={o.value}
                                onChange={e => patchField(si, fi, { options: (f.options ?? []).map((x, k) => (k === oi ? { ...x, value: e.target.value } : x)) })} />
                              <button type="button" className="btn btn-secondary btn-sm"
                                onClick={() => patchField(si, fi, { options: (f.options ?? []).filter((_, k) => k !== oi) })}><Trash2 size={12} /></button>
                            </div>
                          ))}
                          <button type="button" className="btn btn-secondary btn-sm"
                            onClick={() => patchField(si, fi, { options: [...(f.options ?? []), { labelAr: '', labelEn: '', value: `opt-${(f.options ?? []).length + 1}` }] })}>
                            <Plus size={12} /> {isAr ? 'إضافة خيار' : 'Add option'}
                          </button>
                        </div>
                      )}

                      {/* Condition */}
                      <div style={{ border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '0.6rem' }}>
                        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                          <input type="checkbox" checked={!!f.condition}
                            onChange={e => patchField(si, fi, e.target.checked
                              ? { condition: { fieldId: allFields.find(x => x.id !== f.id)?.id ?? '', operator: 'equals', value: '' } }
                              : { condition: undefined })} />
                          {isAr ? 'إظهار مشروط (يعتمد على حقل آخر)' : 'Conditional display (depends on another field)'}
                        </label>
                        {f.condition && (
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.4rem', marginTop: '0.5rem' }}>
                            <select className="form-control" value={f.condition.fieldId}
                              onChange={e => patchField(si, fi, { condition: { ...f.condition!, fieldId: e.target.value } })}>
                              <option value="">{isAr ? 'اختر الحقل...' : 'Select field...'}</option>
                              {allFields.filter(x => x.id !== f.id).map(x => <option key={x.id} value={x.id}>{x.label} ({x.id})</option>)}
                            </select>
                            <select className="form-control" value={f.condition.operator}
                              onChange={e => patchField(si, fi, { condition: { ...f.condition!, operator: e.target.value as never } })}>
                              {OPERATORS.map(o => <option key={o.id} value={o.id}>{isAr ? o.ar : o.en}</option>)}
                            </select>
                            <input className="form-control" dir="ltr" placeholder="value" value={String(f.condition.value ?? '')}
                              disabled={f.condition.operator === 'is_not_empty'}
                              onChange={e => patchField(si, fi, { condition: { ...f.condition!, value: e.target.value } })} />
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'start' }}>id: {f.id}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {s.fields.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.6rem' }}>
                {isAr ? 'لا توجد حقول — أضف أول حقل.' : 'No fields yet — add the first one.'}
              </div>
            )}
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => addField(si)}>
              <Plus size={13} /> {isAr ? 'إضافة حقل' : 'Add field'}
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-secondary" onClick={addSection}>
        <Plus size={14} /> {isAr ? 'إضافة قسم' : 'Add section'}
      </button>

      {/* Live preview */}
      {preview && (
        <div style={{ border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'var(--bg-app)' }}>
          <div style={{ fontWeight: 800, marginBottom: '0.75rem' }}>{isAr ? 'معاينة حية للنموذج' : 'Live form preview'}</div>
          {sections.length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{isAr ? 'لا توجد أقسام.' : 'No sections.'}</div>}
          {sections.map(s => (
            <div key={s.id} style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--gov-primary-900)' }}>{isAr ? s.titleAr || '—' : s.titleEn || '—'}</div>
              {(isAr ? s.descriptionAr : s.descriptionEn) && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{isAr ? s.descriptionAr : s.descriptionEn}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                {s.fields.map(f => (
                  <div key={f.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.6rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                      {isAr ? f.labelAr || f.id : f.labelEn || f.id}
                      {f.required && <span style={{ color: 'var(--gov-crimson)' }}> *</span>}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> ({fieldTypeName(f.type, isAr)})</span>
                    </div>
                    {f.type === 'select' ? (
                      <select className="form-control" style={{ marginTop: '0.35rem' }} disabled>
                        {(f.options ?? []).map((o, i) => <option key={i}>{isAr ? o.labelAr || o.value : o.labelEn || o.value}</option>)}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea className="form-control" rows={2} style={{ marginTop: '0.35rem' }} placeholder={isAr ? f.placeholderAr : f.placeholderEn} disabled />
                    ) : (
                      <input className="form-control" style={{ marginTop: '0.35rem' }} placeholder={isAr ? f.placeholderAr : f.placeholderEn} disabled />
                    )}
                    {(f.helpTextAr || f.helpTextEn) && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{isAr ? f.helpTextAr : f.helpTextEn}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
