import React, { useState, useEffect } from 'react';
import { FactoryProfile } from '../../types';
import { usePlatformStore } from '../../store/state';
import { Badge } from '../ui/Badge';
import { api } from '../../api';
import { 
  Building2, 
  FileText, 
  MapPin, 
  Zap, 
  Users, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  Upload, 
  Trash2,
  ExternalLink 
} from 'lucide-react';

interface FactoryProfileViewProps {
  factory: FactoryProfile;
}

export const FactoryProfileView: React.FC<FactoryProfileViewProps> = ({ factory }) => {
  const { language } = usePlatformStore();
  const isAr = language === 'ar';

  const [formData, setFormData] = useState<FactoryProfile>(factory);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [detailsDesc, setDetailsDesc] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // مزامنة النموذج عند تبديل المصنع + قراءة ملفات التفاصيل الحية من الـ API
  useEffect(() => {
    setFormData(factory);
  }, [factory.id]);

  const [detailsFiles, setDetailsFiles] = useState<Array<Record<string, any>>>([]);
  const refreshFiles = async (fid: string) => {
    try {
      const r = await api.listDetailsFiles(fid);
      setDetailsFiles(r.data ?? []);
    } catch { setDetailsFiles([]); }
  };
  useEffect(() => {
    void refreshFiles(factory.id);
  }, [factory.id]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDetailsUpload = async () => {
    if (!pendingFile) return;
    // ملف التفاصيل = PDF للمستندات الإضافية — التحقق النهائي في الباك + تحقق شكلي هنا
    const isPdf = pendingFile.type.includes('pdf') || pendingFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      alert(isAr ? 'ملف التفاصيل يجب أن يكون PDF فقط.' : 'Details file must be PDF only.');
      return;
    }
    if (pendingFile.size > 15 * 1024 * 1024) {
      alert(isAr ? 'تجاوز الحجم الأقصى (15 MB).' : 'File exceeds max size (15 MB).');
      return;
    }
    try {
      await api.uploadDetailsFile(factory.id, pendingFile, {
        description: detailsDesc || (isAr ? 'ملف تفاصيل المصنع' : 'Factory details file'),
      });
      setPendingFile(null);
      setDetailsDesc('');
      void refreshFiles(factory.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : (isAr ? 'تعذر رفع الملف.' : 'Upload failed.'));
    }
  };

  const handleChange = (field: keyof FactoryProfile, val: any) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    setSavedSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateFactory(factory.id, {
        nameAr: formData.nameAr,
        nameEn: formData.nameEn,
        commercialRegistrationNumber: formData.commercialRegistrationNumber,
        industrialRegistrationNumber: formData.industrialRegistrationNumber,
        taxIdNumber: formData.taxIdNumber,
        sector: formData.sector,
        governorate: formData.governorate,
        industrialZone: formData.industrialZone,
        roofAreaSqMeters: formData.roofAreaSqMeters,
        annualEnergyConsumptionMWh: formData.annualEnergyConsumptionMWh,
        monthlyElectricityBillEGP: formData.monthlyElectricityBillEGP,
        employeesCount: formData.employeesCount,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : (isAr ? 'تعذر حفظ الملف الموحد.' : 'Save failed.'));
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            {isAr ? 'الملف الموحد للمنشأة الصناعية (Central Factory Profile)' : 'Central Factory Profile'}
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            {isAr 
              ? 'يتم تسجيل وتوثيق بيانات المنشأة مرة واحدة وإعادة استخدامها في كافة المبادرات دون تكرار الإدخال.'
              : 'Factory data registered once and securely reused across all initiatives.'}
          </p>
        </div>

        {savedSuccess && (
          <Badge tone="approved">
            <CheckCircle2 size={16} />
            {isAr ? 'تم حفظ التعديلات بنجاح' : 'Changes Saved Successfully'}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSave}>
        {/* Section 1: Official & Legal Data */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Building2 size={18} style={{ color: 'var(--gov-primary-700)' }} />
            <span>{isAr ? '1. البيانات الأساسية والقانونية' : '1. Legal & Identity Information'}</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px), 1fr))', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label required">{isAr ? 'اسم المنشأة الصناعية (بالعربية)' : 'Factory Name (Arabic)'}</label>
              <input 
                type="text" 
                className="form-control" 
                value={formData.nameAr}
                onChange={e => handleChange('nameAr', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">{isAr ? 'اسم المنشأة الصناعية (بالإنجليزية)' : 'Factory Name (English)'}</label>
              <input 
                type="text" 
                className="form-control" 
                value={formData.nameEn}
                onChange={e => handleChange('nameEn', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">{isAr ? 'رقم السجل التجاري' : 'Commercial Registration No.'}</label>
              <input 
                type="text" 
                className="form-control" 
                value={formData.commercialRegistrationNumber}
                onChange={e => handleChange('commercialRegistrationNumber', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">{isAr ? 'رقم السجل الصناعي المعتمد (IDA)' : 'Industrial Registration (IDA)'}</label>
              <input 
                type="text" 
                className="form-control" 
                value={formData.industrialRegistrationNumber}
                onChange={e => handleChange('industrialRegistrationNumber', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">{isAr ? 'الرقم الضريبي' : 'Tax ID'}</label>
              <input 
                type="text" 
                className="form-control" 
                value={formData.taxIdNumber}
                onChange={e => handleChange('taxIdNumber', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">{isAr ? 'القطاع الصناعي' : 'Industrial Sector'}</label>
              <input 
                type="text" 
                className="form-control" 
                value={formData.sector}
                onChange={e => handleChange('sector', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Location & Energy Infrastructure */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={18} style={{ color: 'var(--gov-gold-dark)' }} />
            <span>{isAr ? '2. الموقع الجغرافي والبيانات الطاقية' : '2. Location & Energy Infrastructure'}</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px), 1fr))', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label required">{isAr ? 'المحافظة' : 'Governorate'}</label>
              <input 
                type="text" 
                className="form-control" 
                value={formData.governorate}
                onChange={e => handleChange('governorate', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label required">{isAr ? 'المنطقة الصناعية / العنوان التفصيلي' : 'Industrial Zone / Address'}</label>
              <input 
                type="text" 
                className="form-control" 
                value={formData.industrialZone}
                onChange={e => handleChange('industrialZone', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{isAr ? 'مساحة سطح المصنع الإجمالية (متر مربع)' : 'Total Roof Area (Sq. Meters)'}</label>
              <input 
                type="number" 
                className="form-control" 
                value={formData.roofAreaSqMeters || ''}
                onChange={e => handleChange('roofAreaSqMeters', Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{isAr ? 'متوسط الاستهلاك السنوي للكهرباء (ميجاوات ساعة)' : 'Annual Energy Consumption (MWh)'}</label>
              <input 
                type="number" 
                className="form-control" 
                value={formData.annualEnergyConsumptionMWh || ''}
                onChange={e => handleChange('annualEnergyConsumptionMWh', Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{isAr ? 'متوسط الفاتورة الشهرية (بالجنيه المصري)' : 'Monthly Electricity Bill (EGP)'}</label>
              <input 
                type="number" 
                className="form-control" 
                value={formData.monthlyElectricityBillEGP || ''}
                onChange={e => handleChange('monthlyElectricityBillEGP', Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{isAr ? 'عدد العمال والموظفين' : 'Employees Count'}</label>
              <input 
                type="number" 
                className="form-control" 
                value={formData.employeesCount || ''}
                onChange={e => handleChange('employeesCount', Number(e.target.value))}
              />
            </div>
          </div>
        </div>

         {/* Section 4: Factory Details Files — يرفعها المصنع بنفسه */}
        <div style={{ marginBottom: '2rem', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '1.25rem', background: 'var(--bg-surface)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Upload size={18} style={{ color: 'var(--gov-gold-dark)' }} />
            <span>{isAr ? '4. ملف تفاصيل المصنع PDF (مستندات إضافية: كتالوجات / رسومات / ملف تفصيلي)' : '4. Factory Details PDF File'}</span>
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {isAr ? 'ارفع ملف PDF تفصيلي بنفسك (مستندات إضافية) وسيظهر تلقائيا للمراجعين عند التقديم على أي مبادرة.' : 'Upload your own details PDF (extra docs) — reviewers will see it with your applications.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{isAr ? 'وصف الملف' : 'File description'}</label>
              <input type="text" className="form-control" value={detailsDesc} onChange={e => setDetailsDesc(e.target.value)} placeholder={isAr ? 'مثال: كتالوج خط الإنتاج + القدرة المطلوبة' : 'e.g. Line catalog'} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{isAr ? 'اختر الملف' : 'Choose file'}</label>
              <input type="file" className="form-control" accept=".pdf,application/pdf" onChange={e => setPendingFile(e.target.files?.[0] || null)} />
            </div>
            <button type="button" className="btn btn-secondary" disabled={!pendingFile} onClick={handleDetailsUpload}>
              <Upload size={16} />
              <span>{isAr ? 'رفع الملف' : 'Upload'}</span>
            </button>
          </div>
          {pendingFile && (
            <div style={{ fontSize: '0.8rem', color: 'var(--gov-primary-800)', marginBottom: '0.75rem' }}>
              {isAr ? 'الملف الجاهز للرفع:' : 'Ready:'} {pendingFile.name} ({formatSize(pendingFile.size)})
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {detailsFiles.length === 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem' }}>
                {isAr ? 'لا توجد ملفات تفاصيل مرفوعة بعد.' : 'No details files uploaded yet.'}
              </div>
            )}
            {detailsFiles.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <FileText size={18} style={{ color: 'var(--gov-primary-800)' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--gov-primary-900)' }}>{f.fileName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.description} • {f.fileSize} • {new Date(f.uploadedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge tone="pending">{isAr ? 'قيد التدقيق' : f.status}</Badge>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { void api.deleteDetailsFile(factory.id, f.id).then(() => refreshFiles(factory.id)).catch((err: unknown) => alert(err instanceof Error ? err.message : 'Delete failed.')); }} title={isAr ? 'مسح الملف' : 'Delete'}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-lg">
            <Save size={18} />
            <span>{isAr ? 'حفظ وتحديث الملف الموحد' : 'Save Central Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
