import React, { useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { api } from '../../api';
import { WorkflowStage, Initiative, FormFieldDefinition } from '../../types';
import { Badge } from '../ui/Badge';
import { stageColor, engStageColor, formatEngTimestamp, degreeColor } from '../../utils/theme';
import { EngStageNode } from '../ui/EngStageNode';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowDown, 
  Clock, 
  Building2, 
  CheckCircle2, 
  Save, 
  Workflow,
  ShieldCheck,
  AlertCircle,
  FileText,
  Settings,
  Check,
  ClipboardList,
  Palette
} from 'lucide-react';

const STAGE_THEME_SWATCHES = [
  { id: 'teal', labelAr: 'أخضر بترولي (مراجعة أولية)', labelEn: 'Teal (Initial Review)', color: '#0E6B65' },
  { id: 'blue', labelAr: 'أزرق ملكي (تقييم فني)', labelEn: 'Royal Blue (Technical)', color: '#1D4ED8' },
  { id: 'emerald', labelAr: 'أخضر زمردي (فحص ميداني)', labelEn: 'Emerald (Field Inspection)', color: '#059669' },
  { id: 'amber', labelAr: 'عنبري وذهبي (دراسة مالية)', labelEn: 'Amber (Financial Study)', color: '#D97706' },
  { id: 'purple', labelAr: 'بنفسجي سيادي (ائتمان بنكي)', labelEn: 'Purple (Banking Credit)', color: '#7C3AED' },
  { id: 'crimson', labelAr: 'قرمزي وطني (اعتماد نهائي)', labelEn: 'Crimson (Final Approval)', color: '#C8102E' },
  { id: 'slate', labelAr: 'رمادي داكن (تدقيق ومطابقة)', labelEn: 'Slate (Auditing)', color: '#334155' },
];

// «المراجعة الأولية — الوزارة»: مرحلة ثابتة أول كل مسار (الإدارة تقرر فيها فقط ثم تتابع).
const INTAKE_STAGE_ID = 'stage-intake';
const MINISTRY_ORG_ID = 'org-ministry';
const isIntake = (s?: { id?: string } | null) => s?.id === INTAKE_STAGE_ID;

function resolveStageColor(code?: string, order: number = 1): string {
  if (!code) return degreeColor(order);
  if (code.startsWith('var(--stage-')) {
    const num = parseInt(code.replace(/\D/g, ''), 10) || order;
    return degreeColor(num);
  }
  if (code.startsWith('var(')) return '#0E6B65';
  return code;
}

export const VisualWorkflowEditor: React.FC<{ engineerStyle?: boolean }> = ({ engineerStyle = false }) => {
  const { 
    initiatives,
    organizations,
    language,
    selectedInitiativeId,
  } = usePlatformStore();

  const isAr = language === 'ar';

  // يفتح على المبادرة القادم منها (زر «تعديل المراحل» في محرر المبادرة) وإلا أول مبادرة
  const [selectedInitId, setSelectedInitId] = useState<string>(
    (selectedInitiativeId && initiatives.some(i => i.id === selectedInitiativeId) ? selectedInitiativeId : initiatives[0]?.id) ?? '',
  );
  const activeInitiative = initiatives.find(i => i.id === selectedInitId) || initiatives[0];

  const [activeTab, setActiveTab] = useState<'workflow' | 'forms' | 'landing_cms'>('workflow');
  const [stages, setStages] = useState<WorkflowStage[]>(activeInitiative?.workflow?.stages ?? []);
  const [selectedStage, setSelectedStage] = useState<WorkflowStage | null>(stages[0] || null);

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Empty API state (no initiatives loaded) — avoid crashes on undefined.
  if (!activeInitiative) {
    return (
      <div className="container-custom" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        {isAr ? 'لا توجد مبادرات بعد — أنشئ مبادرة أولاً من الكتالوج.' : 'No initiatives yet — create one from the catalog first.'}
      </div>
    );
  }

  // Sync state when selected initiative changes
  const handleInitiativeChange = (id: string) => {
    setSelectedInitId(id);
    const init = initiatives.find(i => i.id === id) || initiatives[0];
    if (!init) return;
    setStages(init.workflow?.stages ?? []);
    setSelectedStage((init.workflow?.stages ?? [])[0] || null);
    setSaveSuccess(false);
  };

  // الجهات المسموح إسنادها للمراحل بعد الأولى: كل الجهات عدا الوزارة والمصانع.
  const entityOrgs = organizations.filter(o => o.id !== MINISTRY_ORG_ID && o.type !== 'factory');

  // Add new stage
  const handleAddStage = () => {
    const newStageNumber = stages.length + 1;
    const newStage: WorkflowStage = {
      id: `stage-${Date.now()}`,
      order: newStageNumber,
      code: `STAGE_${newStageNumber}`,
      nameAr: `${newStageNumber}. مرحلة تقييم جديدة`,
      nameEn: `${newStageNumber}. New Evaluation Stage`,
      descriptionAr: 'وصف المرحلة والمهام الموكلة للجهة',
      descriptionEn: 'Stage description and assigned tasks',
      assignedOrgId: entityOrgs[0]?.id || 'org-ida',
      assignedOrgNameAr: entityOrgs[0]?.nameAr || 'هيئة التنمية الصناعية',
      assignedRole: 'ida_reviewer',
      slaDays: 5,
      requiredDocuments: [],
      canReject: true,
      canRequestRework: true,
      colorCode: degreeColor(newStageNumber)
    };

    const updated = [...stages, newStage];
    setStages(updated);
    setSelectedStage(newStage);
  };

  // Delete stage
  const handleDeleteStage = (stageId: string) => {
    if (stageId === INTAKE_STAGE_ID) {
      alert(isAr ? 'المراجعة الأولية للوزارة مرحلة ثابتة ولا يمكن حذفها.' : 'The ministry intake stage is fixed and cannot be deleted.');
      return;
    }
    if (stages.length <= 1) {
      alert(isAr ? 'يجب أن يحتوي مسار العمل على مرحلة واحدة على الأقل.' : 'Workflow must have at least one stage.');
      return;
    }
    const updated = stages.filter(s => s.id !== stageId).map((s, idx) => ({ ...s, order: idx + 1 }));
    setStages(updated);
    setSelectedStage(updated[0] || null);
  };

  // Save workflow — عبر العقد PUT /api/v1/initiatives/:id/workflow
  const handleSaveWorkflow = async () => {
    try {
      await api.updateWorkflow(activeInitiative.id, {
        // المرحلة كاملة (اسم الجهة، الدور، الوصف، اللون...) — الباك يثبت المراجعة الأولية ويعيد الترقيم.
        stages: stages.map((s) => ({ ...s })) as never,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : (isAr ? 'تعذر حفظ مسار العمل.' : 'Save workflow failed.'));
    }
  };

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gov-gold-dark)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>
            <Workflow size={14} />
            <span>{isAr ? 'استوديو بناء ومحاكاة محرك المبادرات' : 'Initiative Engine Studio'}</span>
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--gov-primary-900)' }}>
            {isAr ? 'مصمم مسارات العمل والنماذج الديناميكية' : 'Visual Workflow & Dynamic Form Studio'}
          </h1>
        </div>

        {/* Initiative Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{isAr ? 'المبادرة:' : 'Initiative:'}</span>
          <select 
            className="form-control"
            style={{ width: 'auto', minWidth: '240px', fontWeight: 700 }}
            value={selectedInitId}
            onChange={e => handleInitiativeChange(e.target.value)}
          >
            {initiatives.map(init => (
              <option key={init.id} value={init.id}>
                {isAr ? init.titleAr : init.titleEn} (v{init.workflow.version})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Studio Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-subtle)' }}>
        <button 
          onClick={() => setActiveTab('workflow')}
          className={`tab-btn${activeTab === 'workflow' ? ' active' : ''}`}
        >
          <Layers size={18} />
          <span>{isAr ? 'مخطط مسار العمل المرئي (Visual Workflow Graph)' : 'Visual Workflow'}</span>
        </button>

        <button 
          onClick={() => setActiveTab('forms')}
          className={`tab-btn${activeTab === 'forms' ? ' active' : ''}`}
        >
          <FileText size={18} />
          <span>{isAr ? 'منشئ النماذج الديناميكية (Form Schema)' : 'Dynamic Form Builder'}</span>
        </button>
      </div>

      {/* Tab 1: Visual Workflow Builder */}
      {activeTab === 'workflow' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(320px, 380px)', gap: '1.5rem', alignItems: 'start' }}>
          {/* Visual Canvas Node Flow */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--surface-canvas)', border: '1px solid var(--border-medium)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gov-primary-900)' }}>
                  {isAr ? 'مخطط تسلسل المراحل والاعتمادات' : 'Workflow Stage Sequence'}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isAr ? `إصدار المسار الحالي: v${activeInitiative.workflow.version}.0 (دعم إصدارات المسار Versioning)` : `Workflow Version: v${activeInitiative.workflow.version}.0`}
                </span>
              </div>

              <button className="btn btn-primary btn-sm" onClick={handleAddStage}>
                <Plus size={16} />
                <span>{isAr ? 'إضافة مرحلة جديدة' : 'Add Stage'}</span>
              </button>
            </div>

            {/* Visual Flow Nodes */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1rem 0' }}>
              {stages.map((stage, idx) => {
                const isSelected = selectedStage?.id === stage.id;
                return (
                  <React.Fragment key={stage.id}>
                    {engineerStyle ? (
                      <EngStageNode
                        code={stage.code}
                        titleAr={stage.nameAr}
                        titleEn={stage.nameEn}
                        status={isSelected ? 'active' : 'pending'}
                        slaDays={stage.slaDays}
                        assignedOrg={stage.assignedOrgNameAr}
                        onClick={() => setSelectedStage(stage)}
                      />
                    ) : (
                      /* Node Card */
                      <div
                        onClick={() => setSelectedStage(stage)}
                        style={{
                          width: '100%',
                          maxWidth: '540px',
                          padding: '1.15rem 1.25rem',
                          borderRadius: 'var(--radius-lg)',
                          background: 'var(--bg-surface)',
                          border: isSelected ? '2px solid var(--gov-primary-800)' : '1px solid var(--border-subtle)',
                          borderRight: `4px solid ${resolveStageColor(stage.colorCode, stage.order)}`,
                          boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: resolveStageColor(stage.colorCode, stage.order),
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.8rem',
                                fontWeight: 700
                              }}
                            >
                              {idx + 1}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--gov-primary-900)' }}>
                                {isAr ? stage.nameAr : stage.nameEn}
                              </div>
                              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                                {isAr ? stage.descriptionAr : stage.descriptionEn}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {isIntake(stage) && (
                              <Badge tone="rejected">{isAr ? 'ثابتة — الوزارة' : 'Fixed — Ministry'}</Badge>
                            )}
                            <Badge tone="gold">
                              <Clock size={11} />
                              {stage.slaDays} {isAr ? 'أيام SLA' : 'Days'}
                            </Badge>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, color: 'var(--gov-primary-700)' }}>
                            <Building2 size={13} />
                            {stage.assignedOrgNameAr}
                          </span>
                          {stage.canReject ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--gov-gold-dark)' }}>
                              <Check size={12} />
                              {isAr ? 'تدعم الرفض' : 'Can Reject'}
                            </span>
                          ) : <span />}
                        </div>
                      </div>
                    )}

                    {/* Connector Arrow */}
                    {idx < stages.length - 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--gov-primary-600)', margin: '-0.2rem 0' }}>
                        <div style={{ width: '2px', height: '14px', background: 'var(--gov-primary-600)' }} />
                        <ArrowDown size={16} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Node Inspector & Configuration Sidebar */}
          {selectedStage ? (
            <div className="card" style={{ position: 'sticky', top: '5rem' }}>
              <div className="card-header">
                <h3 className="card-title" style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Settings size={18} style={{ color: 'var(--gov-primary-700)' }} />
                  <span>{isAr ? 'خصائص وصلاحيات المرحلة' : 'Stage Properties'}</span>
                </h3>
                {!isIntake(selectedStage) && (
                  <button
                    onClick={() => handleDeleteStage(selectedStage.id)}
                    style={{ color: 'var(--gov-crimson)' }}
                    title={isAr ? 'حذف هذه المرحلة' : 'Delete stage'}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              {isIntake(selectedStage) && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem 0.9rem', background: 'var(--egypt-red-soft)', border: '1px solid var(--gov-gold-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.7 }}>
                  {isAr
                    ? 'مرحلة ثابتة: «المراجعة الأولية — الوزارة». يقرر فيها المسؤولون (المشرف العام ومدير المبادرة) فقط، ثم يتابعون باقي المسار. لا يمكن حذفها أو تغيير جهتها — يمكن تعديل مدة الـ SLA فقط.'
                    : 'Fixed stage: Ministry Initial Review. Only officials decide it, then they monitor the rest of the flow. It cannot be deleted or reassigned — only its SLA can change.'}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{isAr ? 'اسم المرحلة (بالعربية)' : 'Stage Name (Ar)'}</label>
                  <input 
                    type="text" 
                    className="form-control"
                    disabled={isIntake(selectedStage)}
                    value={selectedStage.nameAr}
                    onChange={e => {
                      const updated = stages.map(s => s.id === selectedStage.id ? { ...s, nameAr: e.target.value } : s);
                      setStages(updated);
                      setSelectedStage(prev => prev ? { ...prev, nameAr: e.target.value } : null);
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{isAr ? 'الجهة المسؤولة والمكلفة بالمراجعة' : 'Assigned Entity'}</label>
                  <select
                    className="form-control"
                    disabled={isIntake(selectedStage)}
                    value={selectedStage.assignedOrgId}
                    onChange={e => {
                      const org = organizations.find(o => o.id === e.target.value);
                      const updated = stages.map(s => s.id === selectedStage.id ? { 
                        ...s, 
                        assignedOrgId: e.target.value,
                        assignedOrgNameAr: org?.nameAr || ''
                      } : s);
                      setStages(updated);
                      setSelectedStage(prev => prev ? { ...prev, assignedOrgId: e.target.value, assignedOrgNameAr: org?.nameAr || '' } : null);
                    }}
                  >
                    {(isIntake(selectedStage) ? organizations.filter(o => o.id === MINISTRY_ORG_ID) : entityOrgs).map(org => (
                      <option key={org.id} value={org.id}>{isAr ? org.nameAr : org.nameEn}</option>
                    ))}
                  </select>
                  {!isIntake(selectedStage) && (
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {isAr ? 'هذه الجهة فقط تعتمد أو ترفض في هذه المرحلة — الإدارة تتابع.' : 'Only this organization decides this stage — officials monitor.'}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">{isAr ? 'الحد الزمني لاتفاقية مستوى الخدمة (SLA بالأيام)' : 'SLA (Days)'}</label>
                  <input 
                    type="number" 
                    className="form-control"
                    min={1}
                    max={60}
                    value={selectedStage.slaDays}
                    onChange={e => {
                      const val = Number(e.target.value);
                      const updated = stages.map(s => s.id === selectedStage.id ? { ...s, slaDays: val } : s);
                      setStages(updated);
                      setSelectedStage(prev => prev ? { ...prev, slaDays: val } : null);
                    }}
                  />
                </div>

                {/* --- Stage color & theme selection --- */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Palette size={15} style={{ color: 'var(--egypt-red)' }} />
                      <span>{isAr ? 'لون وتمييز المرحلة' : 'Stage Theme Color'}</span>
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isAr ? `المرحلة ${selectedStage.order}` : `Stage ${selectedStage.order}`}
                    </span>
                  </label>

                  {/* Swatches Grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                    {STAGE_THEME_SWATCHES.map((swatch) => {
                      const activeColor = resolveStageColor(selectedStage.colorCode, selectedStage.order);
                      const isSelected = activeColor.toLowerCase() === swatch.color.toLowerCase();
                      return (
                        <button
                          key={swatch.id}
                          type="button"
                          onClick={() => {
                            const updated = stages.map(s => s.id === selectedStage.id ? { ...s, colorCode: swatch.color } : s);
                            setStages(updated);
                            setSelectedStage(prev => prev ? { ...prev, colorCode: swatch.color } : null);
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: swatch.color,
                            border: isSelected ? '2px solid #0F172A' : '1px solid rgba(0,0,0,0.1)',
                            boxShadow: isSelected ? '0 0 0 2px #FFFFFF, 0 2px 6px rgba(0,0,0,0.25)' : 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                            transition: 'all 0.15s ease',
                            transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                          }}
                          title={isAr ? swatch.labelAr : swatch.labelEn}
                        >
                          {isSelected && <Check size={16} strokeWidth={3} />}
                        </button>
                      );
                    })}

                    {/* Custom Color Input */}
                    <label
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: '#F1F5F9',
                        border: '1px dashed #94A3B8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        color: '#475569',
                        fontWeight: 700,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      title={isAr ? 'اختيار لون مخصص' : 'Custom color'}
                    >
                      <span>+</span>
                      <input
                        type="color"
                        value={resolveStageColor(selectedStage.colorCode, selectedStage.order)}
                        onChange={e => {
                          const val = e.target.value;
                          const updated = stages.map(s => s.id === selectedStage.id ? { ...s, colorCode: val } : s);
                          setStages(updated);
                          setSelectedStage(prev => prev ? { ...prev, colorCode: val } : null);
                        }}
                        style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }}
                      />
                    </label>
                  </div>

                  {/* Visual Stage Badge Preview */}
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: resolveStageColor(selectedStage.colorCode, selectedStage.order),
                          color: '#FFFFFF',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                        }}
                      >
                        {selectedStage.order}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {isAr ? selectedStage.nameAr : selectedStage.nameEn}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {selectedStage.assignedOrgNameAr}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: '#FEF3C7',
                        color: '#92400E',
                        border: '1px solid #FDE68A',
                      }}
                    >
                      {selectedStage.slaDays} {isAr ? 'أيام عمل' : 'days SLA'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={selectedStage.canReject}
                      onChange={e => {
                        const updated = stages.map(s => s.id === selectedStage.id ? { ...s, canReject: e.target.checked } : s);
                        setStages(updated);
                        setSelectedStage(prev => prev ? { ...prev, canReject: e.target.checked } : null);
                      }}
                    />
                    <span>{isAr ? 'إتاحة قرار الرفض' : 'Allow Reject'}</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={selectedStage.canRequestRework}
                      onChange={e => {
                        const updated = stages.map(s => s.id === selectedStage.id ? { ...s, canRequestRework: e.target.checked } : s);
                        setStages(updated);
                        setSelectedStage(prev => prev ? { ...prev, canRequestRework: e.target.checked } : null);
                      }}
                    />
                    <span>{isAr ? 'إتاحة طلب التعديل' : 'Allow Rework'}</span>
                  </label>
                </div>

                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ width: '100%' }}
                    onClick={handleSaveWorkflow}
                  >
                    <Save size={16} />
                    <span>{isAr ? 'حفظ وتحديث مسار المبادرة' : 'Save Workflow Version'}</span>
                  </button>

                  {saveSuccess && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--status-approved-text)', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.5rem' }}>
                      <CheckCircle2 size={15} />
                      <span>{isAr ? 'تم حفظ مسار العمل بنجاح' : 'Workflow updated successfully'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>{isAr ? 'اختر مرحلة لتعديل إعداداتها.' : 'Select a stage node.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Dynamic Form Builder */}
      {activeTab === 'forms' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                {isAr ? 'منشئ حقول النماذج الديناميكية (Form Schema Builder)' : 'Dynamic Form Schema'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isAr ? 'تخصيص الحقول والشروط المنطقية لنماذج التقديم بدون كود.' : 'Configure dynamic form inputs and conditional logic without code.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {(activeInitiative?.formSections ?? []).map(section => (
              <div key={section.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem', background: 'var(--bg-app)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--gov-primary-900)', marginBottom: '0.85rem' }}>
                  <ClipboardList size={18} style={{ color: 'var(--gov-gold-dark)' }} />
                  <span>{isAr ? section.titleAr : section.titleEn}</span>
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
                  {section.fields.map(field => (
                    <div key={field.id} style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--gov-primary-900)' }}>
                          {isAr ? field.labelAr : field.labelEn}
                        </span>
                        <Badge tone="gold">{field.type}</Badge>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {field.required ? (isAr ? 'حقل إلزامي' : 'Required') : (isAr ? 'اختياري' : 'Optional')}
                        {field.condition && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: 'var(--gov-teal)', marginInlineStart: '0.5rem' }}>
                            <Settings size={12} />
                            <span>{isAr ? 'مشروط بـ: ' : 'Condition: '}{field.condition.fieldId}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
