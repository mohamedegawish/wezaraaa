// ============================================================================
// العقد الموحد بين فريقي Frontend و Backend — Single Source of Truth
// Canonical API Contracts — Egypt Industrial Initiatives Platform
// ============================================================================
// القاعدة: أي تغيير في شكل Req/Res يتم هنا أولا، ثم يطبقه الفريقان.
// Rule: change Req/Res here FIRST, then both teams implement.
//
// الأساس:
// - Base URL (dev):  http://localhost:4000
// - Base URL (prod): https://api.industry.gov.eg
// - كل المسارات تبدأ بـ /api/v1
// - اللغة عبر هيدر: Accept-Language: ar | en (الافتراضي ar)
// - المصادقة: Bearer JWT (هيدر Authorization) + Refresh دوّار عبر كوكي httpOnly.
//   هيدر x-user-id + POST /auth/switch-user للديمو والتطوير فقط (محظور في الإنتاج).
// - شكل الخطأ ثابت دائما: ApiError
// - الترقيم ثابت: ?page=1&pageSize=10
//
// مثال بالصيغة المطلوبة:
//   POST /api/v1/applications
//   Req  { initiativeId, factoryId, formData, detailsFile? }
//   Res  { message, status, data: Application }
//
// ملاحظة للفرونت: أعد التصدير من frontend/src/api/schemas.ts (نفس الأسماء).
// ملاحظة للباك: استورد هذا الملف مباشرة (backend/tsconfig يشمل ../contracts).
// ============================================================================

export const API_VERSION = 'v1' as const;
export const API_PREFIX = '/api/v1' as const;

// ----------------------------------------------------------------------------
// Base shapes
// ----------------------------------------------------------------------------

/** شكل الخطأ الموحد — كل فشل يرجع هذا الشكل مع كود HTTP مناسب */
export interface ApiError {
  /** مثال: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'INTERNAL' */
  code: string;
  /** رسالة عربية جاهزة للعرض */
  messageAr: string;
  /** رسالة إنجليزية */
  messageEn: string;
  /** تفاصيل الحقول (اختياري) — مثال: { field: 'initiativeId', issue: 'required' } */
  details?: { field: string; issue: string }[];
}

/** غلاف أي قائمة مرقمة */
export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** أدوار المنصة — نفس UserRole في src/types */
export type ContractUserRole =
  | 'ministry_admin' | 'initiative_manager' | 'ida_reviewer' | 'imc_reviewer'
  | 'bank_reviewer' | 'solar_provider' | 'factory_owner' | 'auditor';

/** حالات الطلب — نفس ApplicationStatus */
export type ContractApplicationStatus =
  | 'draft' | 'submitted' | 'under_review' | 'pending_documents'
  | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';

/** قرار المراجع */
export type DecisionAction = 'approve' | 'request_rework' | 'reject' | 'escalate';

// ----------------------------------------------------------------------------
// 0) Health
// ----------------------------------------------------------------------------
// GET /api/v1/health
export interface HealthRes {
  status: 'ok';
  version: string;
  time: string; // ISO
}

// ----------------------------------------------------------------------------
// 1) Auth / Users (JWT أساسي + switch-user للديمو فقط)
// ----------------------------------------------------------------------------
// GET /api/v1/users/me            -> المستخدم الحالي (Bearer JWT)
// POST /api/v1/auth/switch-user   -> Req { userId } (للديمو فقط — محظور في الإنتاج)
export interface UserShape {
  id: string;
  name: string;
  nameEn: string;
  email: string;
  role: ContractUserRole;
  organizationId: string;
  factoryId?: string;
  avatar?: string;
  password?: string;
  mustChangePassword?: boolean;
  initialPasswordProvided?: string;
}
export interface SwitchUserReq {
  /** مثال: 'user-admin' — مطلوب، يجب أن يكون موجودا في جدول المستخدمين */
  userId: string;
}
export interface SwitchUserRes {
  message: string; // 'تم تبديل الشخصية'
  status: 'ok';
  data: UserShape;
}

// ----------------------------------------------------------------------------
// 1c) Auth JWT + تسجيل المصانع (كانت معرفة محليا في الفرونت فقط — نُقلت للعقد)
// ----------------------------------------------------------------------------
// POST /api/v1/auth/login { email, password } -> { accessToken, refreshToken, mustChangePassword, user }
// POST /api/v1/auth/refresh { refreshToken? } (body أو كوكي) -> زوج جديد دوّار
// POST /api/v1/auth/logout -> إبطال الـ refresh
// POST /api/v1/auth/verify-email { token } | POST /api/v1/auth/resend-verification { email }
// POST /api/v1/auth/change-password (Bearer) { currentPassword?, newPassword }
// POST /api/v1/factories/register -> إنشاء جهة + مصنع + مالك (201)
export interface LoginReq {
  email: string;
  password: string;
}
export interface LoginRes {
  message: string;
  status: 'ok';
  data: { accessToken: string; refreshToken: string; mustChangePassword: boolean; user: UserShape };
}
export interface RegisterFactoryReq {
  name: string;
  nameEn?: string;
  email: string;
  password: string;
  factoryNameAr: string;
  factoryNameEn?: string;
  commercialRegistrationNumber?: string;
  industrialRegistrationNumber?: string;
  taxIdNumber?: string;
  sector?: string;
  sectorEn?: string;
  governorate?: string;
  governorateEn?: string;
  phone?: string;
}
export interface RegisterFactoryRes {
  message: string;
  status: 'ok';
  data: {
    user: UserShape & { factoryId: string };
    organization: { id: string; nameAr: string; nameEn: string };
    factory: { id: string; nameAr: string; nameEn: string };
    accessToken?: string;
    refreshToken?: string;
    mustChangePassword: boolean;
    requiresVerification?: boolean;
    verificationToken?: string;
  };
}
// ----------------------------------------------------------------------------
// 1b) Organizations + Accounts (إدارة الجهات المسؤولة وحساباتها — ministry_admin / initiative_manager)
// ----------------------------------------------------------------------------
// GET /api/v1/organizations?q=&type=&page=&pageSize=
// POST /api/v1/organizations            -> Req CreateOrganizationReq (201)
// PUT /api/v1/organizations/:id        -> Req UpdateOrganizationReq
// GET /api/v1/users?organizationId=&role=&q=&page=&pageSize=
// POST /api/v1/users                   -> Req CreateOrgUserReq (201)
// PUT /api/v1/users/:id                -> Req UpdateOrgUserReq
// DELETE /api/v1/users/:id
export type OrganizationType =
  | 'ministry' | 'authority' | 'center' | 'bank' | 'utility' | 'provider' | 'factory';

export interface OrganizationShape {
  id: string;
  /** مثال: 'IDA' — مطلوب وفريد */
  code: string;
  nameAr: string;
  nameEn: string;
  type: OrganizationType;
  active: boolean;
  contactEmail: string;
  /** Optional uploaded logo (compressed dataURL) — falls back to code badge */
  logoImage?: string;
}

export interface ListOrganizationsQuery {
  q?: string;
  type?: string; // OrganizationType أو ALL
  page?: number;
  pageSize?: number;
}

export interface CreateOrganizationReq {
  code: string;
  nameAr: string;
  nameEn: string;
  type: OrganizationType;
  contactEmail?: string;
  logoImage?: string;
}

export interface UpdateOrganizationReq {
  code?: string;
  nameAr?: string;
  nameEn?: string;
  type?: OrganizationType;
  active?: boolean;
  contactEmail?: string;
  logoImage?: string;
}

export interface ListUsersQuery {
  organizationId?: string;
  role?: string; // ContractUserRole أو ALL
  q?: string; // بحث بالاسم أو البريد
  page?: number;
  pageSize?: number;
}

export interface CreateOrgUserReq {
  name: string;
  nameEn: string;
  /** مطلوب وفريد */
  email: string;
  role: ContractUserRole;
  /** مثال: 'org-ida' — يجب أن تكون جهة موجودة ونشطة */
  organizationId: string;
  /** كلمة مرور مؤقتة يحددها الأدمن */
  password?: string;
  /** إلزام تغيير كلمة المرور عند أول دخول */
  mustChangePassword?: boolean;
}

export interface UpdateOrgUserReq {
  name?: string;
  nameEn?: string;
  /** مطلوب وفريد عند تغييره */
  email?: string;
  role?: ContractUserRole;
  organizationId?: string;
  password?: string;
  mustChangePassword?: boolean;
}

// ----------------------------------------------------------------------------
// 2) Initiatives
// ----------------------------------------------------------------------------
// GET /api/v1/initiatives?status=&q=&page=&pageSize=
export interface ListInitiativesQuery {
  status?: string;   // 'active' | 'draft' | ... | 'ALL'
  q?: string;        // بحث في العنوان عربي/إنجليزي
  page?: number;     // افتراضي 1
  pageSize?: number; // افتراضي 20، أقصى 100
}
// Res: Paginated<InitiativeShape> — الشكل الكامل موجود في src/types Initiative
// نعيد الحد الأدنى هنا حتى لا نكرر 200 سطر:
export interface InitiativeListItem {
  id: string;
  titleAr: string;
  titleEn: string;
  status: string;
  budgetTotalEGP: number;
  coverImage: string;
}

// GET /api/v1/initiatives/:id -> Res { message, status, data: InitiativeShape }
// POST /api/v1/initiatives        -> إنشاء (ministry_admin / initiative_manager)
// PUT /api/v1/initiatives/:id     -> تعديل (ministry_admin / initiative_manager)
// DELETE /api/v1/initiatives/:id  -> حذف (ministry_admin فقط — يرفض إن وجدت طلبات مرتبطة)
// القاعدة: INITIATIVE = CONFIGURATION — كل حقل في Initiative قابل للإنشاء/التعديل من الأدمن، لا شيء Hard-code.
// PUT يقبل Partial من نفس حقول الإنشاء (كلها اختيارية عند التعديل).
export interface InitiativeBenefitShape {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  iconName: string;
}
export interface InitiativeFaqShape {
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
}
export interface PreEligibilityOptionShape {
  labelAr: string;
  labelEn: string;
  isEligible: boolean;
  value: string;
}
export interface PreEligibilityQuestionShape {
  /** اختياري عند الإرسال — يولده الباك/الستور إن غاب */
  id?: string;
  questionAr: string;
  questionEn: string;
  type: 'boolean' | 'select' | 'number';
  options?: PreEligibilityOptionShape[];
  expectedValue?: unknown;
  explanationAr: string;
  explanationEn: string;
}
export interface RequiredDocShape {
  code: string;
  titleAr: string;
  titleEn: string;
  mandatory: boolean;
}
export interface InitiativeFormFieldOptionShape {
  labelAr: string;
  labelEn: string;
  value: string;
}
export interface InitiativeFormFieldShape {
  id: string;
  labelAr: string;
  labelEn: string;
  type: string; // text | number | email | phone | date | select | multi_select | radio | checkbox | textarea | file | repeating_table
  required?: boolean;
  placeholderAr?: string;
  placeholderEn?: string;
  options?: InitiativeFormFieldOptionShape[];
  condition?: { fieldId: string; operator: string; value: unknown };
  min?: number;
  max?: number;
  helpTextAr?: string;
  helpTextEn?: string;
  defaultValue?: unknown;
  category?: string;
}
export interface InitiativeFormSectionShape {
  /** اختياري عند الإرسال — يولده الباك/الستور إن غاب */
  id?: string;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  fields: InitiativeFormFieldShape[];
}
export interface ImpactMetricsShape {
  targetFactories?: number;
  benefitedFactories?: number;
  /** القدرة المستهدفة بالميجاوات (مثال: 1000) */
  targetCapacityMW?: number;
  savedEnergyGWh?: number;
  investmentStimulatedEGP?: number;
  jobsCreated?: number;
}
/** بند نصي مزدوج — المستهدفات / اشتراطات التأهيل / معايير الاختيار */
export interface BilingualItemShape {
  textAr: string;
  textEn: string;
}
export type FinancingType = 'bank_loans' | 'grants' | 'subsidy' | 'mixed';
/** المحددات المالية والتمويلية — كل الأرقام >= 0 */
export interface FinancialTermsShape {
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
/** مؤشر قياس أداء — ADMIN ONLY (لا يرجع في GET /initiatives العام) */
export interface KpiShape {
  id: string;
  nameAr: string;
  nameEn: string;
  unit: KpiUnit;
  targetValue?: number;
  currentValue?: number;
}
// GET /api/v1/initiatives/:id/kpis  -> { message, status, data: KpiShape[] }   (ministry_admin | initiative_manager)
// PUT /api/v1/initiatives/:id/kpis  -> Req { kpis: KpiShape[] }
export interface UpdateKpisReq {
  kpis: KpiShape[];
}
export interface GetKpisRes {
  message: string;
  status: 'ok';
  data: KpiShape[];
}
export interface UpdateKpisRes {
  message: string;
  status: 'ok';
  data: { id: string; count: number };
}
export interface UpsertInitiativeReq {
  /** مطلوب عند الإنشاء، اختياري عند التعديل */
  titleAr: string;
  titleEn: string;
  /** يولد تلقائيا من titleEn إن غاب عند الإنشاء — فريد */
  slug?: string;
  taglineAr?: string;
  taglineEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  category?: string;
  categoryEn?: string;
  status?: string;             // active | draft | coming_soon | closed | archived (افتراضي draft)
  targetSectors?: string[];
  targetSectorsEn?: string[];
  targetGovernorates?: string[];
  budgetTotalEGP?: number;     // >= 0
  budgetAllocatedEGP?: number; // >= 0
  startDate?: string;          // ISO date
  endDate?: string;            // ISO date
  coverImage?: string;         // مسار /covers/*.svg أو URL
  badgeTextAr?: string;
  badgeTextEn?: string;
  participatingOrgs?: string[];
  benefits?: InitiativeBenefitShape[];
  faqs?: InitiativeFaqShape[];
  preEligibilityQuestions?: PreEligibilityQuestionShape[];
  requiredDocsList?: RequiredDocShape[];
  formSections?: InitiativeFormSectionShape[];
  impactMetrics?: ImpactMetricsShape;
  /** المستهدفات الرئيسية */
  objectives?: BilingualItemShape[];
  /** اشتراطات تأهيل المنشأة والمشروع */
  eligibilityRequirements?: BilingualItemShape[];
  /** معايير اختيار المصانع */
  selectionCriteria?: BilingualItemShape[];
  financialTerms?: FinancialTermsShape;
  /** ملاحظات مسار التنفيذ (مثل: المراجعة الفنية والائتمانية بالتوازي) */
  executionNotesAr?: string;
  executionNotesEn?: string;
}
/**
 * التعديل = نفس حقول الإنشاء لكن كلها اختيارية.
 * expectedUpdatedAt (اختياري): updatedAt الذي فتح عليه المحرر — لو المبادرة تغيرت بعده يرد 409 CONFLICT
 * بدل أن تمسح نسخة قديمة تعديلات أحدث.
 */
export type UpdateInitiativeReq = Partial<UpsertInitiativeReq> & { expectedUpdatedAt?: string };
/** الردود الكاملة للمبادرة (GET /initiatives[/:id]) تحمل createdAt/updatedAt (ISO) */
export interface InitiativeTimestamps {
  createdAt: string;
  updatedAt: string;
}
// POST /api/v1/initiatives/:id/duplicate -> نسخة كاملة كمسودة (البيانات + التخصيص + المراحل + المؤشرات)
export interface DuplicateInitiativeRes {
  message: string;
  status: 'ok';
  data: { id: string };
}
// POST /api/v1/audit-logs/export -> تسجيل تصدير تم في المتصفح (AUDIT_ROLES)
export interface LogExportReq {
  summaryAr: string;
}
export interface UpsertInitiativeRes {
  message: string;
  status: 'ok';
  data: { id: string };
}

// GET /api/v1/initiatives/:id/customization
// PUT /api/v1/initiatives/:id/customization
export type InitiativePageLayout = 'standard' | 'spotlight' | 'compact';
export interface PageSectionShape {
  id: string;
  kind: 'stats' | 'benefits' | 'timeline' | 'faqs' | 'partners' | 'gallery' | 'documents' | 'apply' | 'custom'
    | 'objectives' | 'financing' | 'requirements' | 'criteria';
  titleAr: string;
  titleEn: string;
  visible: boolean;
  /** نص حر اختياري أعلى القسم (حتى 2000 حرف) */
  bodyAr?: string;
  /** Optional free text above the section (max 2000 chars) */
  bodyEn?: string;
}
export interface InitiativePageConfigShape {
  layout?: InitiativePageLayout;
  heroTitleAr?: string;
  heroTitleEn?: string;
  heroSubtitleAr?: string;
  heroSubtitleEn?: string;
  ctaPrimaryLabelAr?: string;
  ctaPrimaryLabelEn?: string;
  ctaSecondaryLabelAr?: string;
  ctaSecondaryLabelEn?: string;
  galleryImages?: string[];
  sections?: PageSectionShape[];
}
export interface CustomizationShape {
  showBenefits: boolean;
  showFaqs: boolean;
  showImpactMetrics: boolean;
  showTimeline: boolean;
  showPartners: boolean;
  enablePreEligibility: boolean;
  allowFactoryFileUpload: boolean;
  requireDetailsFile: boolean;
  /** بالميجابايت 1..100 */
  maxFileSizeMB: number;
  /** مثال: '.pdf' — الافتراضي PDF للمستندات الإضافية */
  allowedFileTypes: string;
  customWelcomeMessageAr?: string;
  customWelcomeMessageEn?: string;
  accentColor?: string;
  page?: InitiativePageConfigShape;
}
export type UpdateCustomizationReq = Partial<CustomizationShape>;
export interface UpdateCustomizationRes {
  message: string;
  status: 'ok';
  data: CustomizationShape;
}

// ----------------------------------------------------------------------------
// 3) Workflow (موتور المراحل — INITIATIVE = CONFIGURATION)
// ----------------------------------------------------------------------------
// GET /api/v1/initiatives/:id/workflow
// PUT /api/v1/initiatives/:id/workflow  -> Req { stages: WorkflowStageShape[] }
export interface WorkflowStageShape {
  id: string;
  order: number;
  code: string;               // مثال: 'ELIGIBILITY' — فريد داخل المبادرة
  nameAr: string;
  nameEn: string;
  assignedOrgId: string;      // مثال: 'org-ida' — يجب أن يكون موجودا
  slaDays: number;            // >= 1
  canReject: boolean;
  canRequestRework: boolean;
}
export interface UpdateWorkflowReq {
  stages: WorkflowStageShape[]; // مرتبة حسب order، >= 1
}
export interface UpdateWorkflowRes {
  message: string;
  status: 'ok';
  data: { version: number };
}

// ----------------------------------------------------------------------------
// 4) Factories + ملف التفاصيل PDF
// ----------------------------------------------------------------------------
// GET /api/v1/factories/:id
// PUT /api/v1/factories/:id -> Req: حقول الملف الموحد (كلها اختيارية عدا id في المسار)
export interface UpdateFactoryReq {
  nameAr?: string;
  nameEn?: string;
  commercialRegistrationNumber?: string;
  industrialRegistrationNumber?: string;
  taxIdNumber?: string;
  sector?: string;
  governorate?: string;
  industrialZone?: string;
  roofAreaSqMeters?: number;
  annualEnergyConsumptionMWh?: number;
  monthlyElectricityBillEGP?: number;
  employeesCount?: number;
}
export interface UpdateFactoryRes {
  message: string;
  status: 'ok';
  data: { id: string };
}

// GET /api/v1/factories/:id/details-files?initiativeId=
export interface DetailsFileShape {
  id: string;
  fileName: string;      // يجب أن ينتهي بـ .pdf
  fileSize: string;      // نص جاهز للعرض: '2.1 MB'
  description: string;
  initiativeId?: string;
  applicationId?: string;
  uploadedAt: string;    // ISO
  status: 'pending' | 'verified' | 'rejected';
}
export interface ListDetailsFilesRes {
  message: string;
  status: 'ok';
  data: DetailsFileShape[];
}

// POST /api/v1/factories/:id/details-files (multipart/form-data)
//   Fields: file (PDF فقط، <= maxFileSizeMB للمبادرة أو 15 افتراضي)
//           description?: string | initiativeId?: string | applicationId?: string
//   Res: { message, status, data: DetailsFileShape }
// DELETE /api/v1/factories/:id/details-files/:fileId -> Res { message, status }
export interface UploadDetailsFileRes {
  message: string;
  status: 'ok';
  data: DetailsFileShape;
}

// ----------------------------------------------------------------------------
// 5) Applications (الطلبات)
// ----------------------------------------------------------------------------
// GET /api/v1/applications?initiativeId=&status=&orgId=&factoryId=&q=&page=&pageSize=
// ملاحظة عزل: factory_owner يرى مصنعه فقط، الجهة ترى المسند لها الآن + ما شاركت فيه سابقاً (اطلاع)،
// الأدمن/المدقق يرون الكل (الأدمن يقرر «المراجعة الأولية» فقط ثم يتابع).
export interface ListApplicationsQuery {
  initiativeId?: string;
  status?: ContractApplicationStatus | 'ALL';
  orgId?: string;        // الجهة المسند لها حاليا
  factoryId?: string;    // فلترة حسب المصنع (يُجبر لمصنع المالك عند factory_owner)
  q?: string;            // رقم الطلب / اسم المصنع / القطاع
  page?: number;
  pageSize?: number;     // افتراضي 10
}
export interface ApplicationListItem {
  id: string;
  applicationNumber: string; // EGY-SOL-2026-0001
  initiativeId: string;
  initiativeTitleAr: string;
  factoryId: string;
  factoryNameAr: string;
  factorySectorAr: string;
  factoryGovernorateAr: string;
  currentStageId: string;
  currentStageNameAr: string;
  status: ContractApplicationStatus;
  currentAssignedOrgId: string;
  currentAssignedOrgNameAr: string;
  slaDays: number;
  detailsPdfCount: number; // عدد ملفات PDF المرتبطة — للتقارير
  submittedAt: string;
  // ---- متابعة المسار (محسوبة في الباك من timeline + workflow) ----
  stageTrack: StageTrackItem[];
  currentStageOrder: number;   // 1-based (0 = المرحلة غير موجودة في المسار)
  totalStages: number;
  stageStartedAt: string;      // دخول المرحلة الحالية
  daysSpentInStage: number;
  slaDueDate: string;
  isSlaViolated: boolean;
  /** تصعيد مفتوح على المرحلة الحالية — تنبيه للإدارة، الطلب يبقى لدى الجهة */
  isEscalated: boolean;
  // ---- خاص بالمستخدم الحالي (مصدر الحقيقة للأزرار في الفرونت) ----
  viewerCanDecide: boolean;
  allowedActions: DecisionAction[];
}

// «المراجعة الأولية — الوزارة» (id: stage-intake, code: MINISTRY_INTAKE) أول كل مسار دائماً.
export type StageTrackStatus = 'approved' | 'current' | 'rework' | 'rejected' | 'pending' | 'skipped';
export interface StageTrackEvent {
  at: string;
  action: string; // approve | request_rework | reject | escalate
  byName: string;
  byRole: string;
  byOrgNameAr: string;
  byOrgNameEn: string;
  comments: string;
}
export interface StageTrackItem {
  stageId: string;
  order: number;
  code: string;
  nameAr: string;
  nameEn: string;
  orgId: string;
  orgNameAr: string;
  /** skipped = المراجعة الأولية لطلب قُدِّم قبل إضافتها */
  status: StageTrackStatus;
  enteredAt: string | null;
  decidedAt: string | null;
  decision: string | null;
  decidedBy: StageTrackEvent | null;
  /** كل أحداث المرحلة (استيفاء، تصعيد، اعتماد/رفض) */
  events: StageTrackEvent[];
  daysSpent: number | null;
  slaDays: number;
  slaBreached: boolean;
  escalation: StageTrackEvent | null;
}

// POST /api/v1/applications
//   Req { initiativeId*, factoryId*, formData*, detailsFileId? }
//   Res { message, status, data: { id, applicationNumber } }
export interface CreateApplicationReq {
  /** مطلوب — يجب أن تكون المبادرة active */
  initiativeId: string;
  /** مطلوب — المصنع مقدم الطلب */
  factoryId: string;
  /** مطلوب — قيم الفورم الديناميكي (مفاتيح حسب formSections للمبادرة) */
  formData: Record<string, unknown>;
  /** اختياري — id ملف PDF مرفوع مسبقا لربطه بالطلب */
  detailsFileId?: string;
}
export interface CreateApplicationRes {
  message: string;
  status: 'ok';
  data: { id: string; applicationNumber: string };
}

// GET /api/v1/applications/:id -> التفاصيل الكاملة (formData + documents + timeline)
// POST /api/v1/applications/:id/decisions
//   Req { action*, comments?, documentIdToVerify? }
//   Res { message, status, data: { newStatus, newStageId } }
// الصلاحية: الجهة صاحبة المرحلة الحالية فقط (أدوار المراجعين أو الأدمن لمرحلة الوزارة الأولى).
//   403 NOT_ASSIGNED   — ليست جهتك / الإدارة في وضع المتابعة / المدقق
//   409 APPLICATION_CLOSED — الطلب مكتمل أو مرفوض
//   400 ACTION_NOT_ALLOWED — المرحلة لا تسمح (canReject/canRequestRework=false، أو تصعيد في مرحلة الوزارة)
// escalate = تنبيه للإدارة فقط (لا ينقل الطلب ولا يغير حالته).
// بريد المنشأة: كل قرار عدا escalate (وكذلك POST /applications) يرسل للمنشأة بريداً رسمياً عبر email_outbox،
// ويتضمن comments كما كُتبت — اكتبها بصياغة موجهة للمنشأة.
export interface CreateDecisionReq {
  /** مطلوب */
  action: DecisionAction;
  /** مطلوب عند request_rework و reject و escalate — وإلا 400 COMMENTS_REQUIRED */
  comments?: string;
  documentIdToVerify?: string;
}
export interface CreateDecisionRes {
  message: string;
  status: 'ok';
  data: { newStatus: ContractApplicationStatus; newStageId: string };
}

// ----------------------------------------------------------------------------
// 5b) Messages — تواصل الجهات حول طلب + ملفات/حقول مخصصة
// ----------------------------------------------------------------------------
// GET /api/v1/applications/:id/messages?page=&pageSize=
// POST /api/v1/applications/:id/messages
//   Req SendMessageReq -> Res { message, status, data: MessageShape }
export interface MessageShape {
  id: string;
  applicationId: string;
  fromUserId: string;
  fromUserName: string;
  fromOrgId: string;
  toOrgId: string;
  subject: string;
  body: string;
  customFields: Record<string, string>;
  detailsFileId?: string;
  /** بيانات الملف الأساسية (بدون storedPath) — تُرجع عند وجود detailsFileId */
  detailsFile?: DetailsFileShape;
  createdAt: string; // ISO
}
export interface SendMessageReq {
  /** مطلوب — جهة مستلمة نشطة ≠ جهة المرسل */
  toOrgId: string;
  subject?: string;
  /** مطلوب — 1..2000 حرف */
  body: string;
  /** اختياري — كائن ≤10 مفاتيح، قيم نصية ≤500 حرف */
  customFields?: Record<string, string>;
  /** اختياري — id ملف تفاصيل يخص نفس مصنع الطلب */
  detailsFileId?: string;
}
export interface ListMessagesQuery {
  page?: number;
  pageSize?: number; // افتراضي 20
}

// ----------------------------------------------------------------------------
// 5c) Chat — مركز المراسلات: محادثات ثنائية بين أي جهتين (الوزارة جهة مثل غيرها)
// ----------------------------------------------------------------------------
// المشاركون: أي مستخدم في جهة نشطة نوعها ≠ factory. يتحدث باسم جهته:
//   ministry_admin / initiative_manager باسم الوزارة، والمراجعون باسم جهاتهم.
//   auditor: اطلاع فقط (canSend=false). factory_owner → 403 على الكل.
// الاطلاع (canOversee): الإدارة والمدقق يقرؤون محادثات الجهات الأخرى فيما بينها — قراءة فقط.
// :orgId في المسارات = «الجهة الأخرى» (الطرف المقابل) من منظور المستخدم الحالي.
// GET  /api/v1/chat/conversations                      -> ChatConversationsRes (دليل الجهات + ملخص كل محادثة)
// GET  /api/v1/chat/unread                             -> ChatUnreadSummary (poll ~20s)
// GET  /api/v1/chat/conversations/:orgId/messages?before=&after=&limit=  -> ChatMessagesRes
// POST /api/v1/chat/conversations/:orgId/messages      multipart (body + files[] ≤5) أو JSON { body }
//   -> 201 { message, status, data: ChatMessageShape }       (403 READ_ONLY للمدقق، 400 لجهتك نفسها)
// POST /api/v1/chat/conversations/:orgId/read          -> { message, status, data: ChatReadMarkers }
// GET  /api/v1/chat/oversight                          -> { data: ChatOversightItem[] } (canOversee فقط)
// GET  /api/v1/chat/oversight/:conversationId/messages -> ChatOversightMessagesRes (قراءة فقط)
// GET  /api/v1/chat/attachments/:id[?inline=1]         -> ملف (طرفا المحادثة أو canOversee)
export interface ChatAttachmentShape {
  id: string;
  fileName: string;
  /** MIME من الخادم حسب الامتداد المسموح (لا يُوثق بنوع العميل) */
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
  createdAt: string;
}

export interface ChatMessageShape {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderNameEn: string;
  senderRole: string;
  /** الجهة المرسلة — «رسالتي» = senderOrgId === جهتي */
  senderOrgId: string;
  senderOrgNameAr: string;
  body: string;
  attachments: ChatAttachmentShape[];
  createdAt: string; // ISO — متزايد تماماً داخل المحادثة
}

export interface ChatReadMarkers {
  /** آخر ما قرأته جهتي (ISO أو '') */
  myLastReadAt: string;
  /** آخر ما قرأته الجهة الأخرى — للـ ✓✓ */
  peerLastReadAt: string;
}

/** صف في دليل الجهات: الجهة الأخرى + ملخص المحادثة الثنائية معها. */
export interface ChatConversationSummary extends ChatReadMarkers {
  /** الجهة الأخرى (الطرف المقابل) */
  orgId: string;
  orgCode: string;
  orgNameAr: string;
  orgNameEn: string;
  orgType: string;
  contactEmail: string;
  /** null = لم تبدأ محادثة بعد */
  conversationId: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageFromMe: boolean;
  /** غير المقروء لجهتي */
  unread: number;
}

export interface ChatConversationsRes {
  /** جهتي */
  orgId: string;
  canSend: boolean;
  canOversee: boolean;
  data: ChatConversationSummary[];
}

export interface ChatMessagesRes extends ChatReadMarkers {
  /** تصاعدي زمنياً */
  data: ChatMessageShape[];
  /** توجد رسائل أقدم (للـ before=) */
  hasMore: boolean;
}

export interface ChatUnreadSummary {
  total: number;
  /** أحدث ≤10 محادثات بها غير مقروء — orgId = الجهة الأخرى */
  items: Array<Pick<ChatConversationSummary, 'orgId' | 'orgCode' | 'orgNameAr' | 'orgNameEn' | 'orgType' | 'unread' | 'lastMessagePreview' | 'lastMessageAt'>>;
}

export interface ChatOrgRef {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: string;
}

/** محادثة بين جهتين أخريين (اطلاع الإدارة/المدقق). */
export interface ChatOversightItem {
  conversationId: string;
  orgA: ChatOrgRef;
  orgB: ChatOrgRef;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderOrgId: string;
  messageCount: number;
}

export interface ChatOversightMessagesRes {
  data: ChatMessageShape[];
  hasMore: boolean;
  orgA: string;
  orgB: string;
  readA: string;
  readB: string;
}

export interface SendChatMessageReq {
  /** 0..4000 حرف — مطلوب إن لم يوجد ملف */
  body?: string;
  /** multipart فقط: ≤5 ملفات، كل ملف ≤ CHAT_MAX_FILE_MB (افتراضي 20)،
   *  pdf png jpg jpeg webp docx xlsx pptx doc xls txt csv — مع فحص magic-bytes */
  files?: unknown[];
}

// ----------------------------------------------------------------------------
// 6) Dashboard + Reports + Audit
// ----------------------------------------------------------------------------
// GET /api/v1/dashboard/summary
export interface DashboardSummaryRes {
  message: string;
  status: 'ok';
  data: {
    totalApps: number;
    approvedApps: number;
    inReviewApps: number;
    reworkApps: number;
    slaCompliance: number; // نسبة 0..100
  };
}
// GET /api/v1/reports/applications.csv? + نفس فلاتر القائمة -> ملف CSV
// GET /api/v1/reports/initiatives.csv -> ملف CSV
// GET /api/v1/audit-logs?page=&pageSize= -> Paginated<AuditShape>
export interface AuditShape {
  id: string;
  timestamp: string;
  userName: string;
  actionType: string;
  entityType: string;
  entityId: string;
  summaryAr: string;
}

// ----------------------------------------------------------------------------
// 7) بانرات الإعلانات في الصفحة الرئيسية
// ----------------------------------------------------------------------------
// GET /api/v1/highlights → { data: HomeBannerShape[] } المعروض الآن (عام، بدون مصادقة)
// GET /api/v1/highlights?scope=all → كل البانرات بما فيها المخفية/المجدولة/المنتهية (المسؤولون فقط)
// GET /api/v1/highlights/:id/image → الصورة المرفوعة ثنائياً (كاش طويل؛ الرابط يحمل ?v=updatedAt)
export type BannerPlacement = 'before_about' | 'before_steps' | 'before_cta';
export type BannerLinkType = 'none' | 'initiative' | 'url';

export interface HomeBannerShape {
  id: string;
  /** صورة مرفوعة → '/api/v1/highlights/:id/image?v=…' (أضف API_BASE)؛ أو https://… أو مسار نسبي /… */
  imageUrl: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaLabelAr: string;
  ctaLabelEn: string;
  linkType: BannerLinkType;
  /** initiative → معرف المبادرة، url → رابط http(s)، none → '' */
  linkTarget: string;
  placement: BannerPlacement;
  sortOrder: number;
  active: boolean;
  /** ISO أو '' = بلا حد */
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

// POST /api/v1/highlights (imageUrl مطلوب، الحد 12 بانراً) · PUT /api/v1/highlights/:id (جزئي)
export interface UpsertHomeBannerReq {
  /** data:image/(png|jpeg|webp|gif);base64,… ≤ 1.5M حرف، أو https://…، أو /مسار. في التعديل: أرسلها فقط عند التغيير. */
  imageUrl?: string;
  titleAr?: string;
  titleEn?: string;
  subtitleAr?: string;
  subtitleEn?: string;
  ctaLabelAr?: string;
  ctaLabelEn?: string;
  linkType?: BannerLinkType;
  linkTarget?: string;
  placement?: BannerPlacement;
  active?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface HomeBannerRes {
  message: string;
  status: 'ok';
  data: HomeBannerShape;
}

export interface ListHomeBannersRes {
  message: string;
  status: 'ok';
  data: HomeBannerShape[];
}

// POST /api/v1/highlights/reorder — كل المعرفات بالترتيب الجديد → ListHomeBannersRes
export interface ReorderHomeBannersReq {
  ids: string[];
}

// ----------------------------------------------------------------------------
// ROUTES — جدول واحد يقرأه الفريقان (مصدر أسماء المسارات)
// ----------------------------------------------------------------------------
export const ROUTES = {
  health: 'GET /api/v1/health',
  me: 'GET /api/v1/users/me',
  login: 'POST /api/v1/auth/login',
  refresh: 'POST /api/v1/auth/refresh',
  logout: 'POST /api/v1/auth/logout',
  changePassword: 'POST /api/v1/auth/change-password',
  switchUser: 'POST /api/v1/auth/switch-user (demo only)',
  listUsers: 'GET /api/v1/users',
  createUser: 'POST /api/v1/users',
  updateUser: 'PUT /api/v1/users/:id',
  deleteUser: 'DELETE /api/v1/users/:id',
  listOrganizations: 'GET /api/v1/organizations',
  createOrganization: 'POST /api/v1/organizations',
  updateOrganization: 'PUT /api/v1/organizations/:id',
  listInitiatives: 'GET /api/v1/initiatives',
  getInitiative: 'GET /api/v1/initiatives/:id',
  createInitiative: 'POST /api/v1/initiatives',
  updateInitiative: 'PUT /api/v1/initiatives/:id',
  deleteInitiative: 'DELETE /api/v1/initiatives/:id',
  getCustomization: 'GET /api/v1/initiatives/:id/customization',
  updateCustomization: 'PUT /api/v1/initiatives/:id/customization',
  getWorkflow: 'GET /api/v1/initiatives/:id/workflow',
  updateWorkflow: 'PUT /api/v1/initiatives/:id/workflow',
  getInitiativeKpis: 'GET /api/v1/initiatives/:id/kpis',
  updateInitiativeKpis: 'PUT /api/v1/initiatives/:id/kpis',
  duplicateInitiative: 'POST /api/v1/initiatives/:id/duplicate',
  logExport: 'POST /api/v1/audit-logs/export',
  getFactory: 'GET /api/v1/factories/:id',
  listFactories: 'GET /api/v1/factories',
  getMyFactory: 'GET /api/v1/factories/mine',
  registerFactory: 'POST /api/v1/factories/register',
  verifyEmail: 'POST /api/v1/auth/verify-email',
  resendVerification: 'POST /api/v1/auth/resend-verification',
  updateFactory: 'PUT /api/v1/factories/:id',
  listDetailsFiles: 'GET /api/v1/factories/:id/details-files',
  uploadDetailsFile: 'POST /api/v1/factories/:id/details-files',
  deleteDetailsFile: 'DELETE /api/v1/factories/:id/details-files/:fileId',
  listApplications: 'GET /api/v1/applications',
  createApplication: 'POST /api/v1/applications',
  getApplication: 'GET /api/v1/applications/:id',
  createDecision: 'POST /api/v1/applications/:id/decisions',
  listMessages: 'GET /api/v1/applications/:id/messages',
  sendMessage: 'POST /api/v1/applications/:id/messages',
  chatConversations: 'GET /api/v1/chat/conversations',
  chatUnread: 'GET /api/v1/chat/unread',
  chatMessages: 'GET /api/v1/chat/conversations/:orgId/messages',
  sendChatMessage: 'POST /api/v1/chat/conversations/:orgId/messages',
  markChatRead: 'POST /api/v1/chat/conversations/:orgId/read',
  downloadChatAttachment: 'GET /api/v1/chat/attachments/:id',
  chatOversight: 'GET /api/v1/chat/oversight',
  chatOversightMessages: 'GET /api/v1/chat/oversight/:conversationId/messages',
  dashboardSummary: 'GET /api/v1/dashboard/summary',
  reportsApplicationsCsv: 'GET /api/v1/reports/applications.csv',
  reportsInitiativesCsv: 'GET /api/v1/reports/initiatives.csv',
  auditLogs: 'GET /api/v1/audit-logs',
  listBanners: 'GET /api/v1/highlights',
  bannerImage: 'GET /api/v1/highlights/:id/image',
  createBanner: 'POST /api/v1/highlights',
  updateBanner: 'PUT /api/v1/highlights/:id',
  deleteBanner: 'DELETE /api/v1/highlights/:id',
  reorderBanners: 'POST /api/v1/highlights/reorder',
} as const;
