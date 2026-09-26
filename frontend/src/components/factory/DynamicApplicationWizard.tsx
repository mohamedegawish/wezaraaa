import React, { useState, useEffect } from 'react';
import { Initiative, FactoryProfile, FormFieldDefinition, DEFAULT_CUSTOMIZATION } from '../../types';
import { usePlatformStore } from '../../store/state';
import { Badge } from '../ui/Badge';
import { api } from '../../api';
import { useToast } from '../common/ToastSystem';
import {
  Building2,
  Send,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileUp,
  FileText,
  AlertCircle,
  HelpCircle,
  Info,
  Clock,
  Upload,
  X
} from 'lucide-react';

/** زر أيقون رفع PDF: input مخفي + أيقون Upload، وبعد الاختيار ✓ + الاسم + حذف. */
const FileIconPicker: React.FC<{
  file?: File;
  label: string;
  isAr: boolean;
  accept: string;
  highlight?: boolean;
  formatSize: (bytes: number) => string;
  onPick: (f: File) => void;
  onClear: () => void;
}> = ({ file, label, isAr, accept, highlight, formatSize, onPick, onClear }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      {file && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--status-approved-text)', fontWeight: 700, minWidth: 0 }}>
          <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }} title={file.name}>{file.name}</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({formatSize(file.size)})</span>
        </span>
      )}
      {file && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClear} aria-label={isAr ? `حذف: ${label}` : `Remove: ${label}`} style={{ width: '30px', height: '30px', padding: 0, borderRadius: '9999px', justifyContent: 'center' }}>
          <X size={14} />
        </button>
      )}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => inputRef.current?.click()}
        title={file ? (isAr ? 'استبدال الملف' : 'Replace file') : (isAr ? 'رفع الملف' : 'Upload file')}
        aria-label={isAr ? `رفع: ${label}` : `Upload: ${label}`}
        style={{ width: '36px', height: '36px', padding: 0, borderRadius: '10px', justifyContent: 'center', flexShrink: 0, color: highlight && !file ? 'var(--egypt-red)' : 'var(--gov-primary-700)', borderColor: highlight && !file ? 'var(--egypt-red)' : undefined }}
      >
        <Upload size={16} />
      </button>
    </div>
  );
};

interface DynamicApplicationWizardProps {
  initiative: Initiative;
  factory: FactoryProfile;
  onSuccess: (newAppId: string) => void;
  onCancel: () => void;
}

export const DynamicApplicationWizard: React.FC<DynamicApplicationWizardProps> = ({
  initiative,
  factory,
  onSuccess,
  onCancel
}) => {
  const { language } = usePlatformStore();
  const { toast } = useToast();
  const isAr = language === 'ar';
  const custom = { ...DEFAULT_CUSTOMIZATION, ...(initiative.customization || {}) };

  // المستندات المطلوبة للمبادرة — كل إلزامي يجب إرفاقه (PDF) قبل الانتقال/الإرسال
  const requiredDocs = initiative.requiredDocsList ?? [];
  const docKey = (doc: { code?: string }, i: number) => doc.code || `doc-${i}`;
  const docTitle = (doc: { titleAr: string; titleEn?: string }) => ((isAr ? doc.titleAr : doc.titleEn || doc.titleAr) || '').trim();
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const [docsError, setDocsError] = useState('');

  // Existing details files (for requireDetailsFile check) come from the API.
  const [existingFiles, setExistingFiles] = useState<Array<Record<string, any>>>([]);
  useEffect(() => {
    let cancelled = false;
    api.listDetailsFiles(factory.id, initiative.id)
      .then(r => { if (!cancelled) setExistingFiles(r.data ?? []); })
      .catch(() => { if (!cancelled) setExistingFiles([]); });
    return () => { cancelled = true; };
  }, [factory.id, initiative.id]);

  const sections = initiative.formSections || [];
  const totalSteps = sections.length + 1; // Step 0: Factory profile confirmation, Step 1..N: Form sections

  // Build initial formData from defaultValue + legacy defaults, so FormSchema fields render prefilled
  const buildInitial = (): Record<string, any> => {
    const init: Record<string, any> = {
      requestedCapacityKW: 500,
      roofType: 'concrete',
      preferredBank: 'org-nbe',
      financingAmountEGP: 6000000,
      repaymentPeriodYears: '7',
      hasDieselGenerators: 'no',
    };
    for (const s of sections) for (const f of s.fields) {
      if (f.defaultValue !== undefined && f.defaultValue !== '' && init[f.id] === undefined) init[f.id] = f.defaultValue;
      if (f.type === 'checkbox' && init[f.id] === undefined) init[f.id] = !!f.defaultValue;
      if (f.type === 'multi_select' && init[f.id] === undefined && f.defaultValue) init[f.id] = Array.isArray(f.defaultValue) ? f.defaultValue : [f.defaultValue];
    }
    return init;
  };
  const [formData, setFormData] = useState<Record<string, any>>(() => buildInitial());
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [detailsFile, setDetailsFile] = useState<File | null>(null);
  const [detailsDesc, setDetailsDesc] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [stepError, setStepError] = useState('');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    setStepError('');
  };

  // الباك يقبل PDF حقيقي فقط وبحد maxFileSizeMB — نرفض مبكراً بدل فشل الرفع بعد إنشاء الطلب
  const fileProblem = (f: File, label: string): string => {
    const isPdf = f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return isAr ? `«${label}» يجب أن يكون ملف PDF.` : `"${label}" must be a PDF file.`;
    if (f.size > custom.maxFileSizeMB * 1024 * 1024) {
      return isAr ? `«${label}» تجاوز الحد الأقصى (${custom.maxFileSizeMB} MB).` : `"${label}" exceeds ${custom.maxFileSizeMB} MB.`;
    }
    return '';
  };

  const missingDocError = (): string => {
    for (let i = 0; i < requiredDocs.length; i++) {
      const doc = requiredDocs[i];
      if (doc.mandatory && !docFiles[docKey(doc, i)]) {
        return isAr ? `المستند الإلزامي «${docTitle(doc)}» غير مرفق.` : `Mandatory document "${docTitle(doc)}" is missing.`;
      }
    }
    return '';
  };

  const pickDoc = (key: string, label: string, f: File) => {
    const problem = fileProblem(f, label);
    setDocsError(problem);
    if (!problem) setDocFiles(prev => ({ ...prev, [key]: f }));
  };

  // Full conditional visibility engine — matches FormSchemaBuilder OPERATORS
  const isFieldVisible = (field: FormFieldDefinition) => {
    const c = field.condition;
    if (!c || !c.fieldId) return true;
    const parentVal = formData[c.fieldId];
    const cmp = String(c.value ?? '').trim();
    const pv = parentVal === undefined || parentVal === null ? '' : String(parentVal);
    switch (c.operator) {
      case 'equals': return pv === cmp;
      case 'greater_than': return Number(parentVal) > Number(c.value);
      case 'less_than': return Number(parentVal) < Number(c.value);
      case 'contains': return pv.includes(cmp);
      case 'is_not_empty': return pv.trim().length > 0 && parentVal !== '' && parentVal !== undefined && parentVal !== null && !(Array.isArray(parentVal) && parentVal.length === 0);
      default: return true;
    }
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 0) {
      const err = missingDocError();
      setDocsError(err);
      return !err;
    }
    const sec = sections[currentStep - 1];
    if (!sec) return true;
    for (const f of sec.fields) {
      if (!isFieldVisible(f)) continue;
      if (!f.required) continue;
      const v = formData[f.id];
      const empty = v === undefined || v === null || String(v).trim() === '' || (Array.isArray(v) && v.length === 0) || (f.type === 'checkbox' && !v);
      if (empty) {
        setStepError(isAr ? `الحقل «${f.labelAr || f.id}» إجباري.` : `Field "${f.labelEn || f.id}" is required.`);
        return false;
      }
      if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
        setStepError(isAr ? `البريد في «${f.labelAr}» غير صالح.` : `Invalid email in "${f.labelEn}".`);
        return false;
      }
      if (f.type === 'number' && v !== '' && v !== undefined) {
        const n = Number(v);
        if (Number.isNaN(n)) { setStepError(isAr ? `قيمة رقمية غير صالحة في «${f.labelAr}».` : `Invalid number in "${f.labelEn}".`); return false; }
        if (f.min !== undefined && n < f.min) { setStepError(isAr ? `القيمة في «${f.labelAr}» أقل من الحد الأدنى (${f.min}).` : `Value in "${f.labelEn}" below minimum (${f.min}).`); return false; }
        if (f.max !== undefined && n > f.max) { setStepError(isAr ? `القيمة في «${f.labelAr}» أعلى من الحد الأقصى (${f.max}).` : `Value in "${f.labelEn}" above maximum (${f.max}).`); return false; }
      }
    }
    setStepError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate every visible required field across all sections before submit
    for (let si = 0; si < sections.length; si++) {
      for (const f of sections[si].fields) {
        if (!isFieldVisible(f) || !f.required) continue;
        const v = formData[f.id];
        const empty = v === undefined || v === null || String(v).trim() === '' || (Array.isArray(v) && v.length === 0) || (f.type === 'checkbox' && !v);
        if (empty) {
          setDetailsError(isAr ? `الحقل «${f.labelAr || f.id}» إجباري (القسم ${si + 1}).` : `Field "${f.labelEn || f.id}" is required (section ${si + 1}).`);
          setCurrentStep(si + 1);
          return;
        }
      }
    }
    const docErr = missingDocError();
    if (docErr) {
      setDocsError(docErr);
      setCurrentStep(0);
      return;
    }
    // تحقق من ملف التفاصيل حسب تخصيص المبادرة
    const existingCount = existingFiles.filter(f => !f.initiativeId || f.initiativeId === initiative.id).length;
    if (custom.allowFactoryFileUpload && custom.requireDetailsFile && existingCount === 0 && !detailsFile) {
      setDetailsError(isAr ? 'ملف تفاصيل المصنع إجباري لهذه المبادرة — يرجى إرفاق الملف قبل الإرسال.' : 'Factory details file is required for this initiative.');
      setCurrentStep(0);
      return;
    }
    if (detailsFile && detailsFile.size > custom.maxFileSizeMB * 1024 * 1024) {
      setDetailsError(isAr ? `تجاوز الحجم الأقصى (${custom.maxFileSizeMB} MB).` : `File exceeds max size (${custom.maxFileSizeMB} MB).`);
      return;
    }
    if (detailsFile) {
      const isPdf = detailsFile.type.includes('pdf') || detailsFile.name.toLowerCase().endsWith('.pdf');
      const allowsPdfOnly = (custom.allowedFileTypes || '.pdf').toLowerCase().includes('.pdf');
      if (allowsPdfOnly && !isPdf) {
        setDetailsError(isAr ? 'ملف التفاصيل يجب أن يكون PDF فقط (مستندات إضافية).' : 'Details file must be PDF only.');
        return;
      }
    }
    setDetailsError('');
    setSubmitting(true);
    try {
      const created = await api.createApplication({ initiativeId: initiative.id, factoryId: factory.id, formData });
      // كل الملفات تُرفع بعد إنشاء الطلب (تحتاج applicationId): المستندات المطلوبة + حقول file + ملف التفاصيل
      const uploads: Array<{ file: File; description: string }> = [
        ...requiredDocs.flatMap((doc, i) => {
          const f = docFiles[docKey(doc, i)];
          return f ? [{ file: f, description: doc.titleAr.trim() }] : [];
        }),
        ...sections.flatMap(s => s.fields
          .filter(f => f.type === 'file' && uploadedFiles[f.id] && isFieldVisible(f))
          .map(f => ({ file: uploadedFiles[f.id], description: f.labelAr || f.labelEn || f.id }))),
        ...(custom.allowFactoryFileUpload && detailsFile
          ? [{ file: detailsFile, description: detailsDesc || (isAr ? 'ملف تفاصيل مرفق مع الطلب' : 'Details file attached with application') }]
          : []),
      ];
      const failed: string[] = [];
      for (const u of uploads) {
        try {
          await api.uploadDetailsFile(factory.id, u.file, { description: u.description, initiativeId: initiative.id, applicationId: created.data.id });
        } catch {
          failed.push(u.description);
        }
      }
      // الطلب أُنشئ بالفعل — لا نوقف المستخدم هنا (إعادة الإرسال تكرر الطلب)، فقط ننبه بما لم يُرفع
      if (failed.length > 0) {
        toast('warning', isAr
          ? `تم إرسال الطلب، لكن تعذّر رفع: ${failed.join('، ')}`
          : `Application submitted, but these files failed to upload: ${failed.join(', ')}`, 10000);
      }
      onSuccess(created.data.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (isAr ? 'تعذر إرسال الطلب.' : 'Submit failed.');
      setDetailsError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Wizard Header */}
      <div className="card-header">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--gov-gold-dark)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            <ClipboardList size={14} />
            <span>{isAr ? 'نموذج التقديم الذكي' : 'Smart Application Wizard'}</span>
          </div>
          <h2 className="card-title">
            {isAr ? initiative.titleAr : initiative.titleEn}
          </h2>
        </div>

        <div style={{ textAlign: isAr ? 'left' : 'right' }}>
          <Badge tone="draft">
            {isAr ? `الخطوة ${currentStep + 1} من ${totalSteps}` : `Step ${currentStep + 1} of ${totalSteps}`}
          </Badge>
        </div>
      </div>

      {/* Progress Line */}
      <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', marginBottom: '1.25rem', overflow: 'hidden' }}>
        <div 
          style={{ 
            width: `${((currentStep + 1) / totalSteps) * 100}%`, 
            height: '100%', 
            background: 'var(--gov-primary-800)', 
            transition: 'width 0.3s ease' 
          }} 
        />
      </div>

      {(custom.customWelcomeMessageAr || custom.customWelcomeMessageEn) && (
        <div style={{ background: 'var(--gov-gold-light)', border: '1px solid var(--gov-gold-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.1rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--gov-primary-900)' }}>
          {isAr ? (custom.customWelcomeMessageAr || custom.customWelcomeMessageEn) : (custom.customWelcomeMessageEn || custom.customWelcomeMessageAr)}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 0: Central Factory Profile Verification (Zero-redundancy) */}
        {currentStep === 0 && (
          <div>
            <div style={{ background: 'var(--gov-primary-50)', border: '1px solid var(--gov-primary-200)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--gov-primary-900)', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--status-approved-text)' }} />
                <span>{isAr ? 'استدعاء تلقائي لبيانات المصنع الموحدة' : 'Auto-Loaded Central Factory Profile'}</span>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
                {isAr 
                  ? 'تم استرداد السجلات والتراخيص وبيانات الموقع تلقائياً من ملفك الموحد. لا داعي لإعادة إدخال هذه البيانات.' 
                  : 'Registrations, licenses, and location data loaded from your verified central profile.'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px), 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'اسم المنشأة' : 'Factory Name'}</div>
                <div style={{ fontWeight: 700, color: 'var(--gov-primary-900)', marginTop: '0.2rem' }}>{factory.nameAr}</div>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'السجل التجاري' : 'Commercial Register'}</div>
                <div style={{ fontWeight: 700, color: 'var(--gov-primary-900)', marginTop: '0.2rem' }}>{factory.commercialRegistrationNumber}</div>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'السجل الصناعي (IDA)' : 'Industrial Registration'}</div>
                <div style={{ fontWeight: 700, color: 'var(--gov-primary-900)', marginTop: '0.2rem' }}>{factory.industrialRegistrationNumber}</div>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'القطاع والمحافظة' : 'Sector & Governorate'}</div>
                <div style={{ fontWeight: 700, color: 'var(--gov-primary-900)', marginTop: '0.2rem' }}>{factory.sector} — {factory.governorate}</div>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.75rem' }}>
              {isAr ? 'المستندات الرسمية المرفقة من الملف الموحد:' : 'Attached Certified Documents:'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {(existingFiles.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{isAr ? 'لا توجد ملفات مرفوعة بعد — يمكنك الإرفاق أدناه.' : 'No files uploaded yet — you can attach below.'}</div>
              ) : existingFiles.map((f: any) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.875rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--gov-primary-900)' }}>
                    <FileText size={16} style={{ color: 'var(--gov-gold-dark)' }} />
                    {f.fileName}
                  </span>
                  <Badge tone={f.status === 'verified' ? 'approved' : 'pending'}>{f.status === 'verified' ? (isAr ? 'معتمد' : 'Verified') : (isAr ? 'قيد التدقيق' : 'Pending')}</Badge>
                </div>
              )))}
            </div>

            {requiredDocs.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.3rem' }}>
                  {isAr ? 'المستندات المطلوبة للمبادرة:' : 'Required documents:'}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {isAr
                    ? `اضغط أيقون الرفع بجوار كل مستند — PDF فقط، حتى ${custom.maxFileSizeMB} MB. المستندات الإلزامية شرط للمتابعة.`
                    : `Use the upload icon next to each document — PDF only, up to ${custom.maxFileSizeMB} MB. Mandatory documents are required to continue.`}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {requiredDocs.map((doc, i) => {
                    const key = docKey(doc, i);
                    const file = docFiles[key];
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap',
                          padding: '0.65rem 0.9rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          borderInlineStart: `3px solid ${file ? 'var(--status-approved-text)' : doc.mandatory ? 'var(--egypt-gold)' : 'var(--border-subtle)'}`,
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--gov-primary-900)', minWidth: 0, flex: '1 1 220px' }}>
                          <FileText size={16} style={{ color: 'var(--gov-gold-dark)', flexShrink: 0 }} />
                          <span>{docTitle(doc)}</span>
                          <Badge tone={doc.mandatory ? 'gold' : 'draft'}>{doc.mandatory ? (isAr ? 'إلزامي' : 'Mandatory') : (isAr ? 'اختياري' : 'Optional')}</Badge>
                        </span>
                        <FileIconPicker
                          file={file}
                          label={docTitle(doc)}
                          isAr={isAr}
                          accept=".pdf,application/pdf"
                          highlight={doc.mandatory}
                          formatSize={formatSize}
                          onPick={f => pickDoc(key, docTitle(doc), f)}
                          onClear={() => setDocFiles(prev => { const n = { ...prev }; delete n[key]; return n; })}
                        />
                      </div>
                    );
                  })}
                </div>
                {docsError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--gov-crimson)', marginTop: '0.6rem' }}>
                    <AlertCircle size={14} />
                    <span>{docsError}</span>
                  </div>
                )}
              </div>
            )}

            {custom.allowFactoryFileUpload && (
              <div style={{ border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '1rem 1.1rem', background: 'var(--bg-surface)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileUp size={16} style={{ color: 'var(--gov-gold-dark)' }} />
                  <span>{isAr ? `ملف تفاصيل المصنع PDF ${custom.requireDetailsFile ? '(إجباري)' : '(اختياري)'}` : `Factory details PDF ${custom.requireDetailsFile ? '(required)' : '(optional)'}`}</span>
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {isAr ? `ملف PDF للمستندات الإضافية — الأنواع: ${custom.allowedFileTypes} — الحد الأقصى: ${custom.maxFileSizeMB} MB` : `Extra-docs PDF — Allowed: ${custom.allowedFileTypes} — Max: ${custom.maxFileSizeMB} MB`}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <input type="text" className="form-control" value={detailsDesc} onChange={e => setDetailsDesc(e.target.value)} placeholder={isAr ? 'وصف الملف التفصيلي' : 'File description'} />
                  <input type="file" className="form-control" accept={custom.allowedFileTypes} onChange={e => { setDetailsFile(e.target.files?.[0] || null); setDetailsError(''); }} />
                </div>
                {detailsFile && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--gov-primary-800)', marginTop: '0.5rem' }}>
                    {isAr ? 'المرفق:' : 'Attached:'} {detailsFile.name} ({formatSize(detailsFile.size)})
                  </div>
                )}
                {detailsError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--gov-crimson)', marginTop: '0.6rem' }}>
                    <AlertCircle size={14} />
                    <span>{detailsError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Form Sections (Steps 1..N) */}
        {currentStep > 0 && currentStep <= sections.length && (
          <div>
            {(() => {
              const currentSection = sections[currentStep - 1];
              return (
                <div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--gov-primary-900)' }}>
                      {isAr ? currentSection.titleAr : currentSection.titleEn}
                    </h3>
                    {currentSection.descriptionAr && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {isAr ? currentSection.descriptionAr : currentSection.descriptionEn}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {currentSection.fields.filter(isFieldVisible).map(field => (
                      <div key={field.id} className="form-group">
                        <label className={`form-label ${field.required ? 'required' : ''}`}>
                          {isAr ? field.labelAr : field.labelEn}
                          {field.condition && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.7rem', marginInlineStart: '0.4rem' }}>{isAr ? '(مشروط)' : '(conditional)'}</span>}
                        </label>

                        {/* text */}
                        {field.type === 'text' && (
                          <input type="text" className="form-control" value={formData[field.id] ?? ''} placeholder={isAr ? field.placeholderAr : field.placeholderEn} onChange={e => handleFieldChange(field.id, e.target.value)} />
                        )}
                        {/* textarea */}
                        {field.type === 'textarea' && (
                          <textarea className="form-control" rows={3} value={formData[field.id] ?? ''} placeholder={isAr ? field.placeholderAr : field.placeholderEn} onChange={e => handleFieldChange(field.id, e.target.value)} />
                        )}
                        {/* number */}
                        {field.type === 'number' && (
                          <input type="number" className="form-control" value={formData[field.id] ?? ''} placeholder={isAr ? field.placeholderAr : field.placeholderEn} onChange={e => handleFieldChange(field.id, e.target.value)} min={field.min} max={field.max} />
                        )}
                        {/* email */}
                        {field.type === 'email' && (
                          <input type="email" className="form-control" dir="ltr" value={formData[field.id] ?? ''} placeholder={isAr ? field.placeholderEn ?? 'name@example.com' : field.placeholderEn ?? 'name@example.com'} onChange={e => handleFieldChange(field.id, e.target.value)} />
                        )}
                        {/* phone */}
                        {field.type === 'phone' && (
                          <input type="tel" className="form-control" dir="ltr" value={formData[field.id] ?? ''} placeholder={isAr ? field.placeholderEn ?? '+20 1xx xxx xxxx' : field.placeholderEn ?? '+20 1xx xxx xxxx'} onChange={e => handleFieldChange(field.id, e.target.value)} />
                        )}
                        {/* date */}
                        {field.type === 'date' && (
                          <input type="date" className="form-control" value={formData[field.id] ?? ''} onChange={e => handleFieldChange(field.id, e.target.value)} />
                        )}
                        {/* select */}
                        {field.type === 'select' && (
                          <select className="form-control" value={formData[field.id] ?? ''} onChange={e => handleFieldChange(field.id, e.target.value)}>
                            <option value="">{isAr ? '-- اختر --' : '-- Select --'}</option>
                            {field.options?.map(opt => <option key={opt.value} value={opt.value}>{isAr ? opt.labelAr : opt.labelEn}</option>)}
                          </select>
                        )}
                        {/* multi_select */}
                        {field.type === 'multi_select' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.3rem' }}>
                            {(field.options ?? []).map(opt => {
                              const arr: string[] = Array.isArray(formData[field.id]) ? formData[field.id] : [];
                              const checked = arr.includes(opt.value);
                              return (
                                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                  <input type="checkbox" checked={checked} onChange={e => {
                                    const next = e.target.checked ? [...arr, opt.value] : arr.filter((v: string) => v !== opt.value);
                                    handleFieldChange(field.id, next);
                                  }} />
                                  <span>{isAr ? opt.labelAr : opt.labelEn}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {/* radio */}
                        {field.type === 'radio' && (
                          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                            {field.options?.map(opt => (
                              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                <input type="radio" name={field.id} value={opt.value} checked={formData[field.id] === opt.value} onChange={e => handleFieldChange(field.id, e.target.value)} />
                                <span>{isAr ? opt.labelAr : opt.labelEn}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        {/* checkbox (single) */}
                        {field.type === 'checkbox' && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', marginTop: '0.3rem' }}>
                            <input type="checkbox" checked={!!formData[field.id]} onChange={e => handleFieldChange(field.id, e.target.checked)} />
                            <span>{isAr ? (field.placeholderAr || field.helpTextAr || 'موافق') : (field.placeholderEn || field.helpTextEn || 'Agree')}</span>
                          </label>
                        )}
                        {/* file */}
                        {field.type === 'file' && (
                          <div style={{ marginTop: '0.3rem' }}>
                            <FileIconPicker
                              file={uploadedFiles[field.id]}
                              label={(isAr ? field.labelAr : field.labelEn) || field.id}
                              isAr={isAr}
                              accept=".pdf,application/pdf"
                              highlight={field.required}
                              formatSize={formatSize}
                              onPick={f => {
                                const problem = fileProblem(f, (isAr ? field.labelAr : field.labelEn) || field.id);
                                if (problem) { setStepError(problem); return; }
                                setUploadedFiles(prev => ({ ...prev, [field.id]: f }));
                                handleFieldChange(field.id, f.name);
                              }}
                              onClear={() => {
                                const n = { ...uploadedFiles }; delete n[field.id]; setUploadedFiles(n);
                                handleFieldChange(field.id, '');
                              }}
                            />
                          </div>
                        )}
                        {/* repeating_table — simple textarea JSON placeholder until dedicated table UI lands */}
                        {field.type === 'repeating_table' && (
                          <div>
                            <textarea className="form-control" rows={3} dir="ltr" value={formData[field.id] ?? ''} placeholder={isAr ? 'صف لكل سجل — افصل الأعمدة بـ |' : 'One row per record — separate columns with |'} onChange={e => handleFieldChange(field.id, e.target.value)} />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{isAr ? 'مثال: الاسم | الكمية | الملاحظات' : 'Example: Name | Qty | Notes'}</div>
                          </div>
                        )}

                        {(field.helpTextAr || field.helpTextEn) && field.type !== 'checkbox' && (
                          <div className="form-helper" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Info size={13} style={{ color: 'var(--gov-gold-dark)', flexShrink: 0 }} />
                            <span>{isAr ? field.helpTextAr : field.helpTextEn}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {stepError && (
                    <div style={{ marginTop: '0.75rem', background: 'var(--status-rejected-bg)', color: 'var(--status-rejected)', border: '1px solid var(--status-rejected-border)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.85rem', fontSize: '0.82rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <AlertCircle size={14} /> {stepError}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Wizard Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
          {currentStep === 0 ? (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(prev => prev - 1)}>
              {isAr ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
              <span>{isAr ? 'السابق' : 'Previous'}</span>
            </button>
          )}

          {currentStep < totalSteps - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => { if (validateCurrentStep()) setCurrentStep(prev => prev + 1); }}>
              <span>{isAr ? 'التالي: استكمال النموذج' : 'Next Step'}</span>
              {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
            </button>
          ) : (
            <button type="submit" className="btn btn-gold btn-lg" disabled={submitting}>
              <Send size={18} />
              <span>{submitting ? (isAr ? 'جارٍ إرسال الطلب...' : 'Submitting...') : (isAr ? 'إرسال الطلب واعتماده للبدء' : 'Submit Application')}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
