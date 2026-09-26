// ==========================================================
// Types & Interfaces for Egypt Industrial Initiatives Platform
// ==========================================================

import type { StageTrackItem, DecisionAction } from '../api/schemas';
export type { StageTrackItem, DecisionAction };

export type Language = 'ar' | 'en';

export type UserRole = 
  | 'ministry_admin'
  | 'initiative_manager'
  | 'ida_reviewer'
  | 'imc_reviewer'
  | 'bank_reviewer'
  | 'solar_provider'
  | 'factory_owner'
  | 'auditor';

export interface User {
  id: string;
  name: string;
  nameEn: string;
  email: string;
  role: UserRole;
  roleTitleAr: string;
  roleTitleEn: string;
  organizationId: string;
  organizationNameAr: string;
  organizationNameEn: string;
  avatar?: string;
  factoryId?: string;
  password?: string;
  mustChangePassword?: boolean;
  initialPasswordProvided?: string;
}

export interface Organization {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: 'ministry' | 'authority' | 'center' | 'bank' | 'utility' | 'provider' | 'factory';
  active: boolean;
  contactEmail: string;
  logoBadge: string;
  /** Optional uploaded org logo (compressed dataURL) — falls back to logoBadge */
  logoImage?: string;
}

// ----------------------------------------------------------
// Factory Profile
// ----------------------------------------------------------
export interface FactoryProfile {
  id: string;
  nameAr: string;
  nameEn: string;
  legalEntity: string;
  commercialRegistrationNumber: string; // السجل التجاري
  industrialRegistrationNumber: string; // السجل الصناعي
  taxIdNumber: string; // البطاقة الضريبية
  sector: string;
  sectorEn: string;
  governorate: string;
  governorateEn: string;
  industrialZone: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  annualEnergyConsumptionMWh?: number;
  monthlyElectricityBillEGP?: number;
  roofAreaSqMeters?: number;
  installedCapacityKW?: number;
  employeesCount: number;
  isCompliant: boolean;
  documents: {
    id: string;
    type: string;
    name: string;
    url: string;
    uploadDate: string;
    verified: boolean;
  }[];
  // ملفات التفاصيل الخاصة بالمصنع (يرفعها المصنع بنفسه: كتالوجات، رسومات، ملف تفصيلي)
  detailsFiles?: FactoryDetailsFile[];
}

// ----------------------------------------------------------
// ملف التفاصيل الخاص بالمصنع — يرفعه المصنع بنفسه
// ----------------------------------------------------------
export interface FactoryDetailsFile {
  id: string;
  fileName: string;
  fileSize: string;
  description: string;
  initiativeId?: string;
  applicationId?: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'pending' | 'verified' | 'rejected';
}

// ----------------------------------------------------------
// Dynamic Form Schema Types
// ----------------------------------------------------------
export type FieldType = 
  | 'text' 
  | 'number' 
  | 'email' 
  | 'phone' 
  | 'date' 
  | 'select' 
  | 'multi_select' 
  | 'radio' 
  | 'checkbox' 
  | 'textarea' 
  | 'file' 
  | 'repeating_table';

export interface FormFieldCondition {
  fieldId: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'is_not_empty';
  value: any;
}

export interface FormFieldDefinition {
  id: string;
  labelAr: string;
  labelEn: string;
  type: FieldType;
  required: boolean;
  placeholderAr?: string;
  placeholderEn?: string;
  options?: { labelAr: string; labelEn: string; value: string }[];
  condition?: FormFieldCondition;
  min?: number;
  max?: number;
  helpTextAr?: string;
  helpTextEn?: string;
  defaultValue?: any;
  category?: string;
}

export interface FormSection {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  fields: FormFieldDefinition[];
}

// ----------------------------------------------------------
// Workflow Engine Types
// ----------------------------------------------------------
export interface WorkflowStage {
  id: string;
  order: number;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  assignedOrgId: string;
  assignedOrgNameAr: string;
  assignedRole: UserRole;
  slaDays: number;
  requiredDocuments: string[];
  canReject: boolean;
  canRequestRework: boolean;
  nextStageId?: string;
  rejectStageId?: string;
  colorCode: string;
}

export interface WorkflowDefinition {
  id: string;
  initiativeId: string;
  version: number;
  nameAr: string;
  nameEn: string;
  stages: WorkflowStage[];
  active: boolean;
}

// ----------------------------------------------------------
// تخصيص المبادرة — يتحكم فيه الادمن من لوحة التحكم
// ----------------------------------------------------------
export interface InitiativeCustomization {
  // إظهار / إخفاء أقسام صفحة العرض
  showBenefits: boolean;
  showFaqs: boolean;
  showImpactMetrics: boolean;
  showTimeline: boolean;
  showPartners: boolean;
  enablePreEligibility: boolean;
  // ملف تفاصيل المصنع
  allowFactoryFileUpload: boolean;
  requireDetailsFile: boolean;
  maxFileSizeMB: number;
  allowedFileTypes: string;
  // رسالة ترحيبية مخصصة تظهر للمصنع عند التقديم
  customWelcomeMessageAr?: string;
  customWelcomeMessageEn?: string;
  // لون مميز للمبادرة (يستخدم في الشارات والحدود فقط)
  accentColor?: string;
}

export const DEFAULT_CUSTOMIZATION: InitiativeCustomization = {
  showBenefits: true,
  showFaqs: true,
  showImpactMetrics: true,
  showTimeline: true,
  showPartners: true,
  enablePreEligibility: true,
  allowFactoryFileUpload: true,
  requireDetailsFile: false,
  maxFileSizeMB: 15,
  // ملف التفاصيل = PDF للمستندات الإضافية (افتراضي) — يمكن للادمن توسيعه عند الحاجة
  allowedFileTypes: '.pdf',
  customWelcomeMessageAr: '',
  customWelcomeMessageEn: '',
  accentColor: '',
};

// ----------------------------------------------------------
// Initiative & Showcase CMS
// ----------------------------------------------------------
export type InitiativeStatus = 'draft' | 'active' | 'closed' | 'coming_soon' | 'archived' | 'completed';

export interface InitiativeBenefit {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  iconName: string;
}

export interface PreEligibilityQuestion {
  id: string;
  questionAr: string;
  questionEn: string;
  type: 'boolean' | 'select' | 'number';
  options?: { labelAr: string; labelEn: string; isEligible: boolean; value: string }[];
  expectedValue?: any;
  explanationAr: string;
  explanationEn: string;
}

export interface Initiative {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  taglineAr: string;
  taglineEn: string;
  descriptionAr: string;
  descriptionEn: string;
  status: InitiativeStatus;
  category: string;
  categoryEn: string;
  targetSectors: string[];
  targetSectorsEn: string[];
  targetGovernorates: string[];
  budgetTotalEGP: number;
  budgetAllocatedEGP: number;
  startDate: string;
  endDate: string;
  coverImage: string;
  badgeTextAr: string;
  badgeTextEn: string;
  participatingOrgs: string[];
  // التحكم في تخصيص المبادرة (يضبطه الادمن — اختياري لضمان التوافق مع الداتا القديمة)
  customization?: InitiativeCustomization;
  
  // Showcase CMS Data
  benefits: InitiativeBenefit[];
  faqs: { questionAr: string; questionEn: string; answerAr: string; answerEn: string }[];
  preEligibilityQuestions: PreEligibilityQuestion[];
  requiredDocsList: { code: string; titleAr: string; titleEn: string; mandatory: boolean }[];
  
  // Form and Workflow References
  formSections: FormSection[];
  workflow: WorkflowDefinition;
  
  // Public Impact Counter
  impactMetrics: {
    targetFactories: number;
    benefitedFactories: number;
    /** القدرة المستهدفة بالميجاوات */
    targetCapacityMW?: number;
    savedEnergyGWh?: number;
    investmentStimulatedEGP: number;
    jobsCreated: number;
  };
  /** المستهدفات الرئيسية */
  objectives?: BilingualItem[];
  /** اشتراطات تأهيل المنشأة والمشروع */
  eligibilityRequirements?: BilingualItem[];
  /** معايير اختيار المصانع */
  selectionCriteria?: BilingualItem[];
  financialTerms?: FinancialTerms;
  /** ملاحظات مسار التنفيذ */
  executionNotesAr?: string;
  executionNotesEn?: string;
  /** ISO — يُرسل كـ expectedUpdatedAt عند الحفظ لمنع الكتابة فوق نسخة أحدث */
  createdAt?: string;
  updatedAt?: string;
  // kpis لا تأتي هنا — ADMIN ONLY عبر api.getInitiativeKpis
}

/** بند نصي مزدوج اللغة (المستهدفات / الاشتراطات / المعايير) */
export interface BilingualItem {
  textAr: string;
  textEn: string;
}

export type FinancingType = 'bank_loans' | 'grants' | 'subsidy' | 'mixed';

/** المحددات المالية والتمويلية للمبادرة */
export interface FinancialTerms {
  financingType?: FinancingType;
  currency?: 'EGP' | 'USD';
  maxDurationYears?: number;
  maxFinancingPerClientEGP?: number;
  /** الحد الأقصى للعميل والأطراف المرتبطة به */
  maxFinancingPerGroupEGP?: number;
  beneficiariesAr?: string;
  beneficiariesEn?: string;
  purposeAr?: string;
  purposeEn?: string;
  notesAr?: string;
  notesEn?: string;
}

export type KpiUnit = 'count' | 'MW' | 'MWh' | 'EGP' | 'tCO2' | 'toe' | 'percent' | 'days';

/** مؤشر قياس أداء — للأدمن فقط */
export interface InitiativeKpi {
  id: string;
  nameAr: string;
  nameEn: string;
  unit: KpiUnit;
  targetValue?: number;
  currentValue?: number;
}

// ----------------------------------------------------------
// Applications & Decisions
// ----------------------------------------------------------
export type ApplicationStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'pending_documents'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface TimelineEvent {
  id?: string;
  /** Backend canonical timestamp (ISO). Legacy mock field: `timestamp`. */
  at?: string;
  timestamp?: string;
  stageCode?: string;
  stageNameAr?: string;
  stageNameEn?: string;
  action: string;
  actionTitleAr?: string;
  actionTitleEn?: string;
  comments?: string;
  by?: string;
  /** Immutable performer snapshot (backend-enriched; survives renames). */
  byName?: string;
  byNameEn?: string;
  byRole?: string;
  byOrgId?: string;
  byOrgNameAr?: string;
  byOrgNameEn?: string;
  performerName?: string;
  performerRoleAr?: string;
  performerRoleEn?: string;
  performerOrgAr?: string;
  performerOrgEn?: string;
  fromStage?: string;
  toStage?: string;
  metadata?: Record<string, any>;
}

export interface ApplicationDocument {
  id: string;
  documentType: string;
  titleAr: string;
  titleEn: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  /** Optional direct file URL/dataURL — when present the preview modal renders content */
  fileUrl?: string;
}

export interface Application {
  id: string;
  applicationNumber: string; // e.g. EGY-IND-2026-0042
  initiativeId: string;
  initiativeTitleAr: string;
  initiativeTitleEn: string;
  factoryId: string;
  factoryNameAr: string;
  factoryNameEn: string;
  factorySectorAr: string;
  factorySectorEn: string;
  factoryGovernorateAr: string;
  factoryGovernorateEn: string;
  
  currentStageId: string;
  currentStageCode: string;
  currentStageNameAr: string;
  currentStageNameEn: string;
  
  status: ApplicationStatus;
  currentAssignedOrgId: string;
  currentAssignedOrgNameAr: string;
  currentAssignedOrgNameEn: string;
  currentAssignedUser?: string;
  
  submittedAt: string;
  lastUpdatedAt: string;
  
  // SLA Tracking
  stageStartedAt: string;
  slaDays: number;
  slaDueDate: string;
  isSlaViolated: boolean;
  daysSpentInStage: number;
  
  formData: Record<string, any>;
  documents: ApplicationDocument[];
  timeline: TimelineEvent[];
  
  // ---- متابعة المسار (محسوبة في الباك) + صلاحية المستخدم الحالي ----
  stageTrack?: StageTrackItem[];
  currentStageOrder?: number;
  totalStages?: number;
  isEscalated?: boolean;
  /** الجهة صاحبة المرحلة الحالية فقط (الإدارة: المراجعة الأولية فقط) */
  viewerCanDecide?: boolean;
  allowedActions?: DecisionAction[];

  assignedBankId?: string;
  assignedBankNameAr?: string;
  assignedBankNameEn?: string;
  requestedFinancingAmountEGP?: number;
  systemCapacityKW?: number;
}

// ----------------------------------------------------------
// Role-Based Access Control (RBAC) Permissions Matrix
// ----------------------------------------------------------
// ⚠️ قاعدة هامة — صفحة "الأثر الوطني" (impact):
// صفحة سيادية مخصصة للإدارة العليا فقط (ministry_admin + initiative_manager).
// الأدوار الأخرى (reviewers / auditor / مصانع / مزودي الطاقة) لا تملك هذه الصلاحية
// إطلاقاً — أي محاولة وصول (روابط مباشرة، hash/URL، أو زر) تُرفض عبر
// isViewAllowed() في store/state.ts وتُظهر شاشة "الوصول مقيد" تلقائياً.
export interface RolePermissionConfig {
  allowedViews: string[];
  defaultView: string;
  canReviewApplications: boolean;
  canBuildWorkflows: boolean;
  canViewExecutiveDashboard: boolean;
  canViewAuditLogs: boolean;
  canApplyDirectly: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissionConfig> = {
  factory_owner: {
    allowedViews: ['home', 'showcase', 'initiatives', 'initiative-detail', 'compare', 'my-initiatives', 'factory-portal'],
    defaultView: 'my-initiatives',
    canReviewApplications: false,
    canBuildWorkflows: false,
    canViewExecutiveDashboard: false,
    canViewAuditLogs: false,
    canApplyDirectly: true,
  },
  ministry_admin: {
    // ✅ 'impact' (الأثر الوطني) مسموح هنا — هذه إحدى الصلاحيتين الوحيدتين
    // المصرح لهما بهذه الصفحة السيادية (ADMIN ONLY)
    // ✅ 'ministry-overview' (نظرة الوزارة — قراءة فقط): ministry_admin + initiative_manager + auditor
    allowedViews: ['home', 'showcase', 'initiatives', 'initiative-detail', 'compare', 'my-initiatives', 'admin-dashboard', 'admin-initiatives', 'admin-initiative', 'admin-stats', 'admin-reports', 'admin-applications', 'admin-workflow-builder', 'admin-organizations', 'admin-accounts', 'admin-audit-logs', 'admin-banners', 'impact', 'ministry-overview', 'chat'],
    defaultView: 'admin-dashboard',
    canReviewApplications: true,
    canBuildWorkflows: true,
    canViewExecutiveDashboard: true,
    canViewAuditLogs: true,
    canApplyDirectly: false,
  },
  initiative_manager: {
    // ✅ 'impact' (الأثر الوطني) مسموح هنا — هذه إحدى الصلاحيتين الوحيدتين
    // المصرح لهما بهذه الصفحة السيادية (ADMIN ONLY)
    // ✅ 'ministry-overview' (نظرة الوزارة — قراءة فقط): ministry_admin + initiative_manager + auditor
    allowedViews: ['home', 'showcase', 'initiatives', 'initiative-detail', 'compare', 'my-initiatives', 'admin-dashboard', 'admin-initiatives', 'admin-initiative', 'admin-stats', 'admin-reports', 'admin-applications', 'admin-workflow-builder', 'admin-organizations', 'admin-accounts', 'admin-audit-logs', 'admin-banners', 'impact', 'ministry-overview', 'chat'],
    defaultView: 'admin-dashboard',
    canReviewApplications: true,
    canBuildWorkflows: true,
    canViewExecutiveDashboard: true,
    canViewAuditLogs: true,
    canApplyDirectly: false,
  },
  ida_reviewer: {
    // 🚫 لا 'impact' هنا — الأثر الوطني للأدمن فقط
    // 🚫 لا 'admin-audit-logs' — الباك يقصر GET /audit-logs على AUDIT_ROLES (403 للمراجعين)
    allowedViews: ['home', 'showcase', 'initiatives', 'initiative-detail', 'compare', 'my-initiatives', 'admin-applications', 'admin-dashboard', 'chat'],
    defaultView: 'admin-applications',
    canReviewApplications: true,
    canBuildWorkflows: false,
    canViewExecutiveDashboard: true,
    canViewAuditLogs: false,
    canApplyDirectly: false,
  },
  imc_reviewer: {
    // 🚫 لا 'impact' هنا — الأثر الوطني للأدمن فقط
    // 🚫 لا 'admin-audit-logs' — الباك يقصر GET /audit-logs على AUDIT_ROLES (403 للمراجعين)
    allowedViews: ['home', 'showcase', 'initiatives', 'initiative-detail', 'compare', 'my-initiatives', 'admin-applications', 'admin-dashboard', 'chat'],
    defaultView: 'admin-applications',
    canReviewApplications: true,
    canBuildWorkflows: false,
    canViewExecutiveDashboard: true,
    canViewAuditLogs: false,
    canApplyDirectly: false,
  },
  bank_reviewer: {
    // 🚫 لا 'impact' هنا — الأثر الوطني للأدمن فقط
    // 🚫 لا 'admin-audit-logs' — الباك يقصر GET /audit-logs على AUDIT_ROLES (403 للمراجعين)
    allowedViews: ['home', 'showcase', 'initiatives', 'initiative-detail', 'compare', 'my-initiatives', 'admin-applications', 'admin-dashboard', 'chat'],
    defaultView: 'admin-applications',
    canReviewApplications: true,
    canBuildWorkflows: false,
    canViewExecutiveDashboard: true,
    canViewAuditLogs: false,
    canApplyDirectly: false,
  },
  auditor: {
    // 🚫 لا 'impact' هنا — الأثر الوطني للأدمن فقط
    // ✅ 'ministry-overview' (نظرة الوزارة — قراءة فقط): ministry_admin + initiative_manager + auditor
    allowedViews: ['home', 'showcase', 'initiatives', 'initiative-detail', 'compare', 'my-initiatives', 'admin-audit-logs', 'admin-dashboard', 'admin-applications', 'ministry-overview', 'chat'],
    defaultView: 'admin-audit-logs',
    canReviewApplications: false,
    canBuildWorkflows: false,
    canViewExecutiveDashboard: true,
    canViewAuditLogs: true,
    canApplyDirectly: false,
  },
  solar_provider: {
    allowedViews: ['home', 'showcase', 'initiatives', 'initiative-detail', 'compare', 'my-initiatives', 'admin-applications', 'chat'],
    defaultView: 'admin-applications',
    canReviewApplications: true,
    canBuildWorkflows: false,
    canViewExecutiveDashboard: false,
    canViewAuditLogs: false,
    canApplyDirectly: false,
  }
};

// ----------------------------------------------------------
// Audit Log
// ----------------------------------------------------------
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRoleAr: string;
  userRoleEn: string;
  userOrgAr: string;
  userOrgEn: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'REWORK' | 'ASSIGN' | 'EXPORT' | 'LOGIN';
  entityType: 'APPLICATION' | 'INITIATIVE' | 'WORKFLOW' | 'ORGANIZATION' | 'FACTORY';
  entityId: string;
  summaryAr: string;
  summaryEn: string;
  ipAddress: string;
}

export interface DegreeOption {
  id: string;
  labelAr: string;
  labelEn: string;
  color: string;
  order: number;
}

// ----------------------------------------------------------
// Hero Slider — صور الهيرو المتغيرة من الأدمن
// ----------------------------------------------------------
export interface HeroSlide {
  id: string;
  imageUrl: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaLabelAr?: string;
  ctaLabelEn?: string;
  initiativeId?: string;
  order: number;
  active: boolean;
}

