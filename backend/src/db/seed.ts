import { getDb, nowIso } from './sqlite.js';
import { hashPassword, verifyPassword } from '../auth/jwt.js';
import { alignWorkflowsAndAssignments } from '../store/workflow.js';

// Default demo password for seeded accounts (tests + local dev). Real users must change it.
// Never log this value. Admin-created users get a temp password with mustChangePassword=1.
export const SEED_DEFAULT_PASSWORD = 'Egypt@2026';

// ---------------------------------------------------------------------------
// Initial production seed — SQLite baseline (Arabic-first, INITIATIVE=CONFIG).
// Idempotent: INSERT OR IGNORE + meta flag, safe to run on every boot.
// ---------------------------------------------------------------------------

const ORGS = [
  { id: 'org-ministry', code: 'MINISTRY_IND', nameAr: 'وزارة الصناعة', nameEn: 'Ministry of Industry', type: 'ministry', active: 1, contactEmail: 'initiatives@industry.gov.eg' },
  { id: 'org-ida', code: 'IDA', nameAr: 'الهيئة العامة للتنمية الصناعية', nameEn: 'Industrial Development Authority (IDA)', type: 'authority', active: 1, contactEmail: 'licensing@ida.gov.eg' },
  { id: 'org-imc', code: 'IMC', nameAr: 'مركز تحديث الصناعة', nameEn: 'Industrial Modernization Center (IMC)', type: 'center', active: 1, contactEmail: 'evaluations@imc-egypt.org' },
  { id: 'org-nbe', code: 'NBE', nameAr: 'البنك الأهلي المصري', nameEn: 'National Bank of Egypt (NBE)', type: 'bank', active: 1, contactEmail: 'greenfinance@nbe.com.eg' },
  { id: 'org-banque-misr', code: 'BANQUE_MISR', nameAr: 'بنك مصر', nameEn: 'Banque Misr', type: 'bank', active: 1, contactEmail: 'industrial@banquemisr.com' },
  { id: 'org-eehc', code: 'EEHC', nameAr: 'الشركة القابضة لكهرباء مصر', nameEn: 'Egyptian Electricity Holding Company', type: 'utility', active: 1, contactEmail: 'grid-connect@eehc.gov.eg' },
  { id: 'org-apex-solar', code: 'APEX_SOLAR', nameAr: 'أبيكس لحلول الطاقة الشمسية', nameEn: 'Apex Solar Energy Solutions', type: 'provider', active: 1, contactEmail: 'projects@apexsolar.eg' },
  { id: 'org-factory-1', code: 'FACTORY_1', nameAr: 'مصنع النيل للأغذية', nameEn: 'Nile Foods', type: 'factory', active: 1, contactEmail: 'factory@nile.eg' },
  // مصانع الديمو (كانت في seed-data.json فقط) — لكل مصنع جهة + مالك.
  { id: 'org-ghazl', code: 'GHAZL_MAHALLA', nameAr: 'مصنع الغزل والنسيج بالمحلة الكبرى', nameEn: 'El-Mahalla Textiles Factory', type: 'factory', active: 1, contactEmail: 'info@ghazl-textile.eg' },
  { id: 'org-chem', code: 'SUEZ_CHEM', nameAr: 'شركة السويس للصناعات الكيماوية', nameEn: 'Suez Chemical Industries Co.', type: 'factory', active: 1, contactEmail: 'info@suezchem.eg' },
  { id: 'org-ceramic', code: 'CERAMIC_10TH', nameAr: 'شركة العاشر للسيراميك والأدوات الصحية', nameEn: '10th of Ramadan Ceramics Co.', type: 'factory', active: 1, contactEmail: 'info@ceramic10.eg' },
] as const;

type SeedUser = { id: string; name: string; nameEn: string; email: string; role: string; organizationId: string; factoryId?: string };

// One account per platform role so every persona works out of the box.
const USERS: readonly SeedUser[] = [
  { id: 'user-admin', name: 'م. طارق منصور', nameEn: 'Eng. Tarek Mansour', email: 'tarek.mansour@industry.gov.eg', role: 'ministry_admin', organizationId: 'org-ministry' },
  { id: 'user-manager', name: 'د. سارة عادل', nameEn: 'Dr. Sara Adel', email: 'sara.adel@industry.gov.eg', role: 'initiative_manager', organizationId: 'org-ministry' },
  { id: 'user-ida', name: 'د. أحمد الشريف', nameEn: 'Dr. Ahmed El-Sherif', email: 'a.sherif@ida.gov.eg', role: 'ida_reviewer', organizationId: 'org-ida' },
  { id: 'user-imc', name: 'م. منى كمال', nameEn: 'Eng. Mona Kamal', email: 'mona.kamal@imc-egypt.org', role: 'imc_reviewer', organizationId: 'org-imc' },
  { id: 'user-bank', name: 'أ. ياسر فوزي', nameEn: 'Mr. Yasser Fawzy', email: 'yasser.fawzy@nbe.com.eg', role: 'bank_reviewer', organizationId: 'org-nbe' },
  { id: 'user-solar', name: 'م. كريم نبيل', nameEn: 'Eng. Karim Nabil', email: 'k.nabil@apexsolar.eg', role: 'solar_provider', organizationId: 'org-apex-solar' },
  // مراحل «موافقة شركة الكهرباء» و«الربط والتشغيل» مسندة لـ EEHC — تحتاج حساباً يقرر فيها (assignedRole = ida_reviewer).
  { id: 'user-eehc', name: 'م. هشام رضوان', nameEn: 'Eng. Hesham Radwan', email: 'h.radwan@eehc.gov.eg', role: 'ida_reviewer', organizationId: 'org-eehc' },
  { id: 'user-factory-sewedy', name: 'م. مصطفى السويدي', nameEn: 'Eng. Mostafa El-Sewedy', email: 'm.sewedy@elsewedy-ind.com', role: 'factory_owner', organizationId: 'org-factory-1', factoryId: 'factory-sewedy' },
  { id: 'user-auditor', name: 'أ. هبة فاروق', nameEn: 'Ms. Heba Farouk', email: 'heba.farouk@audit.gov.eg', role: 'auditor', organizationId: 'org-ministry' },
  // Legacy demo ids (kept for old curl/docs compatibility)
  { id: 'user-factory-1', name: 'مصنع النيل', nameEn: 'Nile Factory', email: 'factory@nile.eg', role: 'factory_owner', organizationId: 'org-factory-1', factoryId: 'factory-1' },
  // v2 (seed_users_v2): حسابات seed-data.json — مراجع ائتمان ثانٍ + ملاك مصانع الديمو.
  { id: 'user-bank2', name: 'أ. دينا سمير', nameEn: 'Ms. Dina Samir', email: 'dina.samir@nbe.com.eg', role: 'bank_reviewer', organizationId: 'org-nbe' },
  { id: 'user-ghazl', name: 'م. كريم الشوربجي', nameEn: 'Eng. Karim El-Shorbagy', email: 'karim.elshorbagy@ghazl-textile.eg', role: 'factory_owner', organizationId: 'org-ghazl', factoryId: 'factory-ghazl' },
  { id: 'user-chem', name: 'د. هاني رمزي', nameEn: 'Dr. Hany Ramzy', email: 'hany.ramzy@suezchem.eg', role: 'factory_owner', organizationId: 'org-chem', factoryId: 'factory-chem' },
  { id: 'user-ceramic', name: 'م. ماجد فهمي', nameEn: 'Eng. Maged Fahmy', email: 'maged.fahmy@ceramic10.eg', role: 'factory_owner', organizationId: 'org-ceramic', factoryId: 'factory-ceramic' },
];

const FACTORIES = [
  {
    id: 'factory-1',
    data: {
      id: 'factory-1', nameAr: 'مصنع النيل للأغذية', nameEn: 'Nile Foods',
      sector: 'الصناعات الغذائية', sectorEn: 'Food & Agro Industries',
      governorate: 'الجيزة', governorateEn: 'Giza',
      commercialRegistrationNumber: 'CR-1001-GZ', industrialRegistrationNumber: 'IND-1001-EGY',
      taxIdNumber: 'TAX-100-100-100', employeesCount: 120,
      roofAreaSqMeters: 3000, annualEnergyConsumptionMWh: 900, monthlyElectricityBillEGP: 170000,
    },
  },
  {
    id: 'factory-sewedy',
    data: {
      id: 'factory-sewedy', nameAr: 'مصنع السويدي للكابلات والأنظمة الهندسية', nameEn: 'El Sewedy Cables & Engineering Systems',
      sector: 'الصناعات الهندسية والإلكترونية', sectorEn: 'Engineering & Electrical Industries',
      governorate: 'الجيزة', governorateEn: 'Giza', industrialZone: 'المنطقة الصناعية بالسادس من أكتوبر',
      commercialRegistrationNumber: 'CR-104928-GZ', industrialRegistrationNumber: 'IND-88472-EGY',
      taxIdNumber: 'TAX-920-114-883', employeesCount: 420,
      roofAreaSqMeters: 14000, annualEnergyConsumptionMWh: 4500, monthlyElectricityBillEGP: 850000,
      contactPerson: 'م. مصطفى السويدي', contactPhone: '+20 100 123 4567', contactEmail: 'm.sewedy@elsewedy-ind.com',
    },
  },
  {
    id: 'factory-delta',
    data: {
      id: 'factory-delta', nameAr: 'شركة الدلتا للصناعات الغذائية والتعبئة', nameEn: 'Delta Food Industries & Packaging Co.',
      sector: 'الصناعات الغذائية والحاصلات الزراعية', sectorEn: 'Food & Agro Industries',
      governorate: 'الدقهلية', governorateEn: 'Dakahlia', industrialZone: 'المنطقة الصناعية بجمصة',
      commercialRegistrationNumber: 'CR-448201-DK', industrialRegistrationNumber: 'IND-33921-EGY',
      taxIdNumber: 'TAX-441-902-120', employeesCount: 165,
      roofAreaSqMeters: 6500, annualEnergyConsumptionMWh: 1800, monthlyElectricityBillEGP: 340000,
    },
  },
  {
    id: 'factory-ghazl',
    data: {
      id: 'factory-ghazl', nameAr: 'مصنع الغزل والنسيج بالمحلة الكبرى', nameEn: 'El-Mahalla Textiles Factory',
      sector: 'الغزل والنسيج', sectorEn: 'Textiles & Spinning',
      governorate: 'الغربية', governorateEn: 'Gharbia', industrialZone: 'المنطقة الصناعية بالمحلة الكبرى',
      commercialRegistrationNumber: 'CR-771204-GH', industrialRegistrationNumber: 'IND-55210-EGY',
      taxIdNumber: 'TAX-771-204-556', employeesCount: 860,
      roofAreaSqMeters: 22000, annualEnergyConsumptionMWh: 6100, monthlyElectricityBillEGP: 1150000,
      contactPerson: 'م. كريم الشوربجي', contactPhone: '+20 122 345 6789', contactEmail: 'karim.elshorbagy@ghazl-textile.eg',
    },
  },
  {
    id: 'factory-chem',
    data: {
      id: 'factory-chem', nameAr: 'شركة السويس للصناعات الكيماوية', nameEn: 'Suez Chemical Industries Co.',
      sector: 'الصناعات الكيماوية', sectorEn: 'Chemical Industries',
      governorate: 'السويس', governorateEn: 'Suez', industrialZone: 'المنطقة الصناعية بالعين السخنة',
      commercialRegistrationNumber: 'CR-309977-SU', industrialRegistrationNumber: 'IND-78113-EGY',
      taxIdNumber: 'TAX-309-977-410', employeesCount: 340,
      roofAreaSqMeters: 9500, annualEnergyConsumptionMWh: 3900, monthlyElectricityBillEGP: 740000,
      contactPerson: 'د. هاني رمزي', contactPhone: '+20 100 987 6543', contactEmail: 'hany.ramzy@suezchem.eg',
    },
  },
  {
    id: 'factory-ceramic',
    data: {
      id: 'factory-ceramic', nameAr: 'شركة العاشر للسيراميك والأدوات الصحية', nameEn: '10th of Ramadan Ceramics Co.',
      sector: 'صناعات مواد البناء والخزف', sectorEn: 'Building Materials & Ceramics',
      governorate: 'الشرقية', governorateEn: 'Sharqia', industrialZone: 'المنطقة الصناعية C4 بالعاشر من رمضان',
      commercialRegistrationNumber: 'CR-512830-SH', industrialRegistrationNumber: 'IND-66402-EGY',
      taxIdNumber: 'TAX-512-830-209', employeesCount: 510,
      roofAreaSqMeters: 17500, annualEnergyConsumptionMWh: 5200, monthlyElectricityBillEGP: 985000,
      contactPerson: 'م. ماجد فهمي', contactPhone: '+20 128 112 3344', contactEmail: 'maged.fahmy@ceramic10.eg',
    },
  },
] as const;

const DEFAULT_CUSTOMIZATION = {
  showBenefits: true, showFaqs: true, showImpactMetrics: true, showTimeline: true,
  showPartners: true, enablePreEligibility: true, allowFactoryFileUpload: true,
  requireDetailsFile: false, maxFileSizeMB: 15, allowedFileTypes: '.pdf',
  customWelcomeMessageAr: '', customWelcomeMessageEn: '', accentColor: '',
};

function solarWorkflow() {
  return {
    id: 'wf-solar-v1', initiativeId: 'init-solar-2026', version: 1,
    nameAr: 'مسار مبادرة شمس الصناعة v1.0 — من التسجيل حتى الربط والتشغيل',
    nameEn: 'Shams El-Senaa Workflow v1.0 — Registration to Grid Connection',
    active: true,
    stages: [
      { id: 'stage-sh1', order: 1, code: 'REG_SUBMIT', nameAr: '1. تسجيل المصنع', nameEn: '1. Factory Registration', assignedOrgId: 'org-ida', assignedOrgNameAr: 'الهيئة العامة للتنمية الصناعية (IDA)', assignedRole: 'ida_reviewer', slaDays: 1, requiredDocuments: ['CR_COPY', 'IND_LIC'], canReject: true, canRequestRework: true, colorCode: '#1E3E62' },
      { id: 'stage-sh2', order: 2, code: 'IDA_REVIEW', nameAr: '2. مراجعة الهيئة العامة للتنمية الصناعية', nameEn: '2. IDA Review', assignedOrgId: 'org-ida', assignedOrgNameAr: 'الهيئة العامة للتنمية الصناعية (IDA)', assignedRole: 'ida_reviewer', slaDays: 2, requiredDocuments: ['ELEC_BILLS_12', 'LOAD_PROFILE'], canReject: true, canRequestRework: true, colorCode: '#1E3E62' },
      { id: 'stage-sh3', order: 3, code: 'PREFEAS', nameAr: '3. دراسة ما قبل الجدوى', nameEn: '3. Pre-feasibility Study', assignedOrgId: 'org-apex-solar', assignedOrgNameAr: 'أبيكس لحلول الطاقة الشمسية', assignedRole: 'solar_provider', slaDays: 7, requiredDocuments: ['ROOF_DEED', 'STRUCT_REPORT'], canReject: true, canRequestRework: true, colorCode: '#C5A059' },
      { id: 'stage-sh4', order: 4, code: 'TECH_REVIEW', nameAr: '4. مراجعة الملف الفني (IMC)', nameEn: '4. Technical File Review (IMC)', assignedOrgId: 'org-imc', assignedOrgNameAr: 'مركز تحديث الصناعة (IMC)', assignedRole: 'imc_reviewer', slaDays: 2, requiredDocuments: ['FEASIBILITY', 'SPECS'], canReject: true, canRequestRework: true, colorCode: '#0F766E' },
      { id: 'stage-sh5', order: 5, code: 'BANK_CREDIT', nameAr: '5. التقييم الائتماني', nameEn: '5. Credit Assessment', assignedOrgId: 'org-nbe', assignedOrgNameAr: 'البنك الأهلي المصري', assignedRole: 'bank_reviewer', slaDays: 14, requiredDocuments: ['CREDIT'], canReject: true, canRequestRework: true, colorCode: '#3B679B' },
      { id: 'stage-sh6', order: 6, code: 'CONTRACT_INSTALL', nameAr: '6. التعاقد والتركيب', nameEn: '6. Contracting & Installation', assignedOrgId: 'org-apex-solar', assignedOrgNameAr: 'أبيكس لحلول الطاقة الشمسية', assignedRole: 'solar_provider', slaDays: 60, requiredDocuments: ['PROVIDER'], canReject: true, canRequestRework: true, colorCode: '#3B679B' },
      { id: 'stage-sh7', order: 7, code: 'UTILITY_APPROVAL', nameAr: '7. موافقة شركة الكهرباء', nameEn: '7. Utility Approval', assignedOrgId: 'org-eehc', assignedOrgNameAr: 'الشركة القابضة لكهرباء مصر', assignedRole: 'ida_reviewer', slaDays: 7, requiredDocuments: ['GRID_DATA'], canReject: true, canRequestRework: true, colorCode: '#15803D' },
      { id: 'stage-sh8', order: 8, code: 'GRID_CONNECT', nameAr: '8. الربط والتشغيل', nameEn: '8. Grid Connection & Commissioning', assignedOrgId: 'org-eehc', assignedOrgNameAr: 'الشركة القابضة لكهرباء مصر', assignedRole: 'ida_reviewer', slaDays: 14, requiredDocuments: [], canReject: false, canRequestRework: false, colorCode: '#15803D' },
    ],
  };
}

const bi = (textAr: string, textEn: string) => ({ textAr, textEn });

/**
 * مبادرة شمس الصناعة — بقية بيانات الوثيقة الرسمية (docs/assets/احد-المبادرات/مبادرة شمس الصناعة.docx):
 * المستهدفات، المحددات المالية، اشتراطات التأهيل (13)، معايير الاختيار (10)، مسار التنفيذ، مؤشرات الأداء (16).
 * يُطبَّق عبر applySeedUpdates (seed_shams_content_v1) — يملأ الحقول الفارغة فقط.
 */
const SHAMS_CONTENT = {
  objectives: [
    bi('إضافة قدرات تصل إلى نحو 1000 ميجاوات من الطاقة الشمسية لخدمة نحو 7000 مصنع وفق الجاهزية الفنية والتمويلية.', 'Add up to about 1,000 MW of solar capacity serving about 7,000 factories, according to technical and financing readiness.'),
    bi('خفض تكلفة الكهرباء وتقليل الكهرباء المسحوبة من الشبكة خلال ساعات النهار.', 'Cut electricity costs and reduce power drawn from the grid during daylight hours.'),
    bi('تقليل الطلب على الكهرباء المنتجة باستخدام الوقود الأحفوري وخفض البصمة الكربونية.', 'Reduce demand for fossil-fuel-generated electricity and cut the carbon footprint.'),
    bi('رفع تنافسية المنتجات المصرية، خاصة المنتجات الموجهة للتصدير.', 'Raise the competitiveness of Egyptian products, especially export-oriented ones.'),
    bi('دعم توطين صناعة الألواح الشمسية والمعدات والمكونات المرتبطة بالطاقة الشمسية.', 'Support localizing the manufacture of solar panels and related equipment and components.'),
    bi('خلق طلب مستدام على المنتج المحلي المطابق للمواصفات الدولية.', 'Create sustained demand for local products that meet international specifications.'),
    bi('دعم نقل التكنولوجيا والاستثمار في صناعات الطاقة المتجددة.', 'Support technology transfer and investment in renewable energy industries.'),
  ],
  eligibilityRequirements: [
    bi('سجل تجاري وسجل صناعي ورخصة تشغيل سارية.', 'Valid commercial register, industrial register, and operating license.'),
    bi('فواتير الكهرباء لآخر 12 شهرًا.', 'Electricity bills for the last 12 months.'),
    bi('القدرة التعاقدية وأقصى حمل.', 'Contracted capacity and peak load.'),
    bi('بيانات الاستهلاك وملف الأحمال متى كان متاحًا.', 'Consumption data and load profile, where available.'),
    bi('ساعات وأيام التشغيل.', 'Operating hours and days.'),
    bi('بيان المساحات المتاحة.', 'Statement of available areas.'),
    bi('إثبات حق الملكية أو الاستخدام طوال مدة التمويل والتشغيل.', 'Proof of ownership or right of use for the full financing and operation period.'),
    bi('تقرير إنشائي معتمد بصلاحية الأسطح والمنشآت لتحمل الألواح والهياكل وأحمال الرياح.', 'Certified structural report confirming roofs and structures can bear the panels, mounting structures, and wind loads.'),
    bi('بيانات المحولات ولوحات التوزيع ونقاط الربط ومتطلبات الحماية والقياس.', 'Data on transformers, distribution panels, connection points, and protection and metering requirements.'),
    bi('دراسة فنية واقتصادية توضح قدرة المحطة والإنتاج السنوي ونسبة الاستهلاك الذاتي والتكلفة والوفر وفترة الاسترداد.', 'Technical and economic study showing plant capacity, annual output, self-consumption share, cost, savings, and payback period.'),
    bi('استخدام معدات مطابقة للمواصفات.', 'Use of equipment that complies with specifications.'),
    bi('التنفيذ من خلال شركات متخصصة ومؤهلة وفق القواعد المعتمدة.', 'Implementation through specialized, qualified companies under the approved rules.'),
    bi('اجتياز التقييم الائتماني لدى البنك الممول.', 'Passing the credit assessment at the financing bank.'),
  ],
  selectionCriteria: [
    bi('الجاهزية الفنية والإنشائية.', 'Technical and structural readiness.'),
    bi('توافر التراخيص والسجلات السارية.', 'Valid licenses and registers in place.'),
    bi('انتظام الوضع الائتماني والمصرفي.', 'A sound credit and banking standing.'),
    bi('ارتفاع أحمال التشغيل النهارية بما يحقق أكبر نسبة من الاستهلاك الذاتي.', 'High daytime operating loads that maximize self-consumption.'),
    bi('توافر المساحات المناسبة.', 'Availability of suitable space.'),
    bi('تناسب قدرة المحطة مع الاستهلاك الفعلي.', 'Plant capacity matched to actual consumption.'),
    bi('المصانع المصدرة أو المستهدفة للتصدير.', 'Exporting factories or factories targeting export.'),
    bi('المصانع التي يحقق خفض البصمة الكربونية بها أثرًا على القدرة التنافسية والتصديرية.', 'Factories where cutting the carbon footprint improves competitiveness and exports.'),
    bi('الالتزام بمعايير المكون المحلي.', 'Commitment to local-component standards.'),
    bi('مراعاة التوزيع القطاعي والجغرافي للمشروعات.', 'Balanced sectoral and geographic distribution of projects.'),
  ],
  financialTerms: {
    financingType: 'bank_loans', currency: 'EGP', maxDurationYears: 5,
    maxFinancingPerClientEGP: 100_000_000, maxFinancingPerGroupEGP: 200_000_000,
    beneficiariesAr: 'منشآت القطاع الصناعي الخاص المستوفية للاشتراطات والمعايير المصرفية.',
    beneficiariesEn: 'Private-sector industrial facilities that meet the banking requirements and standards.',
    purposeAr: 'تمويل إنشاء وتركيب محطات طاقة شمسية للمصانع المستفيدة.',
    purposeEn: 'Financing the construction and installation of solar power plants for beneficiary factories.',
    notesAr: 'الحد الأقصى لقيمة المبادرة 12.5 مليار جنيه تُتاح في صورة قروض من الجهاز المصرفي، ويوجَّه التمويل بالعملة المحلية وفقًا للقواعد المصرفية المنظمة.',
    notesEn: 'The initiative is capped at EGP 12.5 billion, made available as loans from the banking sector and extended in local currency under the governing banking rules.',
  },
  executionNotesAr: 'المسار المقترح: التقديم ← استكمال المستندات ← التقييم الفني ← موافقة جهة الكهرباء المختصة ← التقييم الائتماني ← التعاقد ← التنفيذ ← الفحص والاختبارات ← الربط والتشغيل. وتتم المراجعة الفنية والائتمانية بالتوازي كلما أمكن، مع إنشاء لوحة متابعة مركزية إلكترونية تسمح بمتابعة تقدم المبادرة والمشروعات ومؤشرات الأداء بصورة منتظمة.',
  executionNotesEn: 'Proposed path: application → document completion → technical evaluation → approval by the competent electricity authority → credit assessment → contracting → implementation → inspection and testing → grid connection and commissioning. Technical and credit reviews run in parallel whenever possible, and a central electronic monitoring dashboard tracks the progress of the initiative, its projects, and its performance indicators on a regular basis.',
  // ADMIN ONLY (GET /initiatives/:id/kpis). المستهدف مذكور في الوثيقة للقدرة (1000 ميجاوات) وقيمة التمويل (12.5 مليار) فقط.
  kpis: [
    { id: 'kpi-sh-01', nameAr: 'عدد المصانع المتقدمة', nameEn: 'Factories applied', unit: 'count' },
    { id: 'kpi-sh-02', nameAr: 'عدد المصانع المؤهلة', nameEn: 'Factories qualified', unit: 'count' },
    { id: 'kpi-sh-03', nameAr: 'عدد المصانع الممولة', nameEn: 'Factories financed', unit: 'count' },
    { id: 'kpi-sh-04', nameAr: 'عدد المشروعات التي دخلت التشغيل', nameEn: 'Projects in operation', unit: 'count' },
    { id: 'kpi-sh-05', nameAr: 'إجمالي القدرات الشمسية المركبة والمشغلة', nameEn: 'Installed and operating solar capacity', unit: 'MW', targetValue: 1000 },
    { id: 'kpi-sh-06', nameAr: 'الطاقة الشمسية المنتجة والمستهلكة ذاتيًا', nameEn: 'Solar energy produced and self-consumed', unit: 'MWh' },
    { id: 'kpi-sh-07', nameAr: 'خفض الكهرباء المسحوبة من الشبكة', nameEn: 'Reduction in power drawn from the grid', unit: 'MWh' },
    { id: 'kpi-sh-08', nameAr: 'خفض فواتير الكهرباء', nameEn: 'Reduction in electricity bills', unit: 'EGP' },
    { id: 'kpi-sh-09', nameAr: 'الوفر المالي المحقق للمصانع', nameEn: 'Financial savings for factories', unit: 'EGP' },
    { id: 'kpi-sh-10', nameAr: 'الوفر في الوقود التقليدي المستخدم في توليد الكهرباء', nameEn: 'Conventional fuel saved in power generation', unit: 'toe' },
    { id: 'kpi-sh-11', nameAr: 'خفض الانبعاثات الكربونية', nameEn: 'Carbon emissions reduction', unit: 'tCO2' },
    { id: 'kpi-sh-12', nameAr: 'حجم التمويلات المنفذة', nameEn: 'Financing disbursed', unit: 'EGP', targetValue: 12_500_000_000 },
    { id: 'kpi-sh-13', nameAr: 'انتظام السداد', nameEn: 'Repayment regularity', unit: 'percent' },
    { id: 'kpi-sh-14', nameAr: 'نسبة المكون المحلي', nameEn: 'Local-component share', unit: 'percent' },
    { id: 'kpi-sh-15', nameAr: 'متوسط مدة تنفيذ المشروع', nameEn: 'Average project implementation time', unit: 'days' },
    { id: 'kpi-sh-16', nameAr: 'التوزيع الجغرافي والقطاعي للمشروعات', nameEn: 'Geographic and sectoral distribution of projects', unit: 'count' },
  ],
};

const INITIATIVES = [
  // Legacy minimal id kept for old curl/docs + contract examples.
  {
    id: 'init-solar-1', slug: 'solar-for-factories',
    titleAr: 'الطاقة الشمسية للمصانع', titleEn: 'Solar for Factories',
    taglineAr: 'تمويل ميسر لمحطات شمسية على أسطح المصانع', taglineEn: 'Soft financing for rooftop solar',
    descriptionAr: 'بيانات تجريبية متوافقة مع أمثلة العقد.', descriptionEn: 'Seed data matching contract examples.',
    category: 'الطاقة النظيفة والاستدامة', categoryEn: 'Clean Energy & Sustainability',
    status: 'active', targetSectors: ['الصناعات الغذائية'], targetSectorsEn: ['Food'],
    targetGovernorates: ['الجيزة'], budgetTotalEGP: 500000000, budgetAllocatedEGP: 0,
    startDate: '2026-01-01', endDate: '2026-12-31', coverImage: '/covers/solar.svg',
    badgeTextAr: 'تمويل ميسر', badgeTextEn: 'Soft loan', participatingOrgs: ['وزارة الصناعة'],
    benefits: [], faqs: [], preEligibilityQuestions: [], requiredDocsList: [], formSections: [],
    impactMetrics: {}, customization: { requireDetailsFile: false, maxFileSizeMB: 15, allowedFileTypes: '.pdf' },
    workflow: { version: 1, stages: [] },
  },
  {
    id: 'init-solar-2026', slug: 'solar-energy-industrial-zones',
    titleAr: 'شمس الصناعة', titleEn: 'Shams El-Senaa',
    taglineAr: 'دعم التحول للطاقة الشمسية للاستهلاك الذاتي صناعياً', taglineEn: 'Powering industry with self-consumption solar',
    descriptionAr: 'تهدف مبادرة شمس الصناعة إلى التوسع في استخدام الطاقة الجديدة والمتجددة وخفض تكلفة الطاقة على القطاع الصناعي وتنويع مصادر الطاقة للقطاع الصناعي وتعزيز تنافسية الصناعة المصرية وتوطين صناعات الطاقة الشمسية. تستهدف المبادرة إضافة قدرات تصل إلى نحو 1000 ميجاوات من الطاقة الشمسية للاستهلاك الذاتي لخدمة نحو 7000 مصنع وفق الجاهزية الفنية والتمويلية، بتمويل يصل إلى 12.5 مليار جنيه في صورة قروض من الجهاز المصرفي.',
    descriptionEn: 'Shams El-Senaa expands renewable energy use, cuts industrial energy costs, diversifies energy sources, boosts Egyptian industry competitiveness, and localizes solar manufacturing. It targets about 1,000 MW of self-consumption solar capacity serving about 7,000 factories per technical and financing readiness, funded by up to EGP 12.5B in bank loans.',
    category: 'الطاقة النظيفة والاستدامة', categoryEn: 'Clean Energy & Sustainability',
    status: 'active',
    targetSectors: ['الصناعات الهندسية', 'الغزل والنسيج', 'الصناعات الكيماوية', 'الصناعات الغذائية'],
    targetSectorsEn: ['Engineering', 'Textiles', 'Chemicals', 'Food & Agro'],
    targetGovernorates: ['كافة المحافظات', 'السادس من أكتوبر', 'العاشر من رمضان'],
    budgetTotalEGP: 12500000000, budgetAllocatedEGP: 0,
    startDate: '2026-01-01', endDate: '2030-12-31', coverImage: '/covers/solar-2026.svg',
    badgeTextAr: 'تمويل مصرفي يصل إلى 12.5 مليار جنيه', badgeTextEn: 'Bank Financing up to EGP 12.5B',
    participatingOrgs: ['وزارة الصناعة', 'وزارة المالية', 'وزارة الكهرباء والطاقة المتجددة', 'الهيئة العامة للتنمية الصناعية (IDA)', 'مركز تحديث الصناعة (IMC)', 'البنك الأهلي المصري', 'الشركة القابضة لكهرباء مصر', 'مقدمو خدمات الطاقة الشمسية المؤهلون'],
    benefits: [
      { titleAr: 'خفض فاتورة الكهرباء نهاراً', titleEn: 'Lower Daytime Electricity Bills', descriptionAr: 'خفض تكلفة الكهرباء وتقليل الكهرباء المسحوبة من الشبكة خلال ساعات النهار.', descriptionEn: 'Cut energy costs and reduce grid draw during daylight hours.', iconName: 'Percent' },
      { titleAr: 'خفض البصمة الكربونية وتنافسية الصادرات', titleEn: 'Lower Carbon Footprint, Stronger Exports', descriptionAr: 'تقليل الطلب على الكهرباء المنتجة بالوقود الأحفوري وخفض الانبعاثات بما يرفع تنافسية المنتجات المصرية خاصة الموجهة للتصدير.', descriptionEn: 'Cut fossil-fuel power demand and emissions, lifting export competitiveness.', iconName: 'Leaf' },
      { titleAr: 'توطين الألواح والمعدات', titleEn: 'Localizing Panels & Equipment', descriptionAr: 'دعم توطين صناعة الألواح الشمسية والمعدات والمكونات المرتبطة بالطاقة الشمسية.', descriptionEn: 'Localize manufacturing of solar panels, equipment, and components.', iconName: 'Factory' },
      { titleAr: 'طلب مستدام على المنتج المحلي', titleEn: 'Sustained Demand for Local Products', descriptionAr: 'خلق طلب مستدام على المنتج المحلي المطابق للمواصفات الدولية عبر مشروعات المبادرة.', descriptionEn: 'Create lasting demand for spec-compliant local products.', iconName: 'FileCheck' },
      { titleAr: 'نقل التكنولوجيا وجذب الاستثمار', titleEn: 'Technology Transfer & Investment', descriptionAr: 'دعم نقل التكنولوجيا والاستثمار في صناعات الطاقة المتجددة.', descriptionEn: 'Advance technology transfer and investment in renewables.', iconName: 'Cpu' },
    ],
    faqs: [
      { questionAr: 'ما الحد الأقصى للتمويل؟', questionEn: 'What is the maximum financing?', answerAr: 'الحد الأقصى لتمويل العميل الواحد 100 مليون جنيه، والعميل والأطراف المرتبطة به 200 مليون جنيه وفقاً للقواعد المصرفية المنظمة.', answerEn: 'Up to EGP 100M per client and EGP 200M per client plus related parties, per banking rules.' },
      { questionAr: 'ما مدة المبادرة؟', questionEn: 'How long does the initiative run?', answerAr: 'خمس سنوات من تاريخ إطلاقها (2026 حتى 2030).', answerEn: 'Five years from launch (2026 to 2030).' },
      { questionAr: 'ما شروط التأهيل الأساسية؟', questionEn: 'What are the basic eligibility requirements?', answerAr: 'سجل تجاري وسجل صناعي ورخصة تشغيل سارية، فواتير الكهرباء لآخر 12 شهراً، مساحات متاحة مع إثبات الملكية، تقرير إنشائي معتمد، دراسة فنية واقتصادية، معدات مطابقة للمواصفات، التنفيذ عبر شركات مؤهلة، واجتياز التقييم الائتماني.', answerEn: 'Valid commercial and industrial registers plus operating license, 12 months of electricity bills, available space with ownership proof, certified structural report, technical and economic study, compliant equipment, qualified contractors, and passing the credit assessment.' },
      { questionAr: 'هل تتم المراجعة الفنية والائتمانية معاً؟', questionEn: 'Do technical and credit reviews run together?', answerAr: 'نعم — تتم المراجعة الفنية والائتمانية بالتوازي كلما أمكن لتقصير مدة التنفيذ.', answerEn: 'Yes — technical and credit reviews run in parallel whenever possible.' },
      { questionAr: 'لماذا تُعطى الأولوية للأحمال النهارية؟', questionEn: 'Why are daytime loads prioritized?', answerAr: 'لأن ارتفاع أحمال التشغيل النهارية يحقق أكبر نسبة من الاستهلاك الذاتي للطاقة المنتجة من المحطة الشمسية.', answerEn: 'High daytime loads achieve the largest self-consumption share.' },
      { questionAr: 'ما اشتراطات المكون المحلي؟', questionEn: 'What are the local-component requirements?', answerAr: 'الالتزام بمعايير المكون المحلي واستخدام معدات مطابقة للمواصفات والتنفيذ من خلال شركات متخصصة ومؤهلة وفق القواعد المعتمدة.', answerEn: 'Comply with local-component standards, spec-compliant equipment, and qualified specialist firms.' },
    ],
    preEligibilityQuestions: [
      { id: 'q-sh1', questionAr: 'هل يمتلك المصنع سجلاً تجارياً وسجلاً صناعياً ورخصة تشغيل سارية؟', questionEn: 'Valid commercial register, industrial register, and operating license?', type: 'boolean', expectedValue: true, explanationAr: 'السجلات والرخصة السارية شرط أساسي للتأهيل.', explanationEn: 'Valid registers and license are mandatory.' },
      { id: 'q-sh2', questionAr: 'هل تتوفر فواتير الكهرباء لآخر 12 شهراً؟', questionEn: 'Are electricity bills for the last 12 months available?', type: 'boolean', expectedValue: true, explanationAr: 'فواتير 12 شهراً مطلوبة لدراسة الأحمال والجدوى.', explanationEn: 'Twelve months of bills are required for load studies.' },
      { id: 'q-sh3', questionAr: 'هل تتوفر مساحات مناسبة مع إثبات حق الملكية أو الاستخدام طوال مدة التمويل والتشغيل؟', questionEn: 'Suitable space with ownership or usage proof for the financing term?', type: 'boolean', expectedValue: true, explanationAr: 'المساحة وإثبات الحق شرطان للتركيب.', explanationEn: 'Space and proof of right are required.' },
      { id: 'q-sh4', questionAr: 'ما مستوى أحمال التشغيل النهارية؟', questionEn: 'Daytime operating load level?', type: 'select', options: [{ labelAr: 'مرتفعة (تشغيل نهاري كثيف)', labelEn: 'High (intensive daytime operation)', isEligible: true, value: 'high' }, { labelAr: 'متوسطة', labelEn: 'Medium', isEligible: true, value: 'medium' }, { labelAr: 'منخفضة (تشغيل ليلي غالباً)', labelEn: 'Low (mostly night operation)', isEligible: false, value: 'low' }], explanationAr: 'الأحمال النهارية المرتفعة تحقق أكبر استهلاك ذاتي.', explanationEn: 'High daytime loads maximize self-consumption.' },
      { id: 'q-sh5', questionAr: 'هل يلتزم المصنع بمعايير المكون المحلي والمعدات المطابقة؟', questionEn: 'Commitment to local-component standards and compliant equipment?', type: 'boolean', expectedValue: true, explanationAr: 'المكون المحلي معيار اختيار أساسي.', explanationEn: 'Local component is a core selection criterion.' },
    ],
    requiredDocsList: [
      { code: 'CR_COPY', titleAr: 'سجل تجاري ساري', titleEn: 'Valid Commercial Register', mandatory: true },
      { code: 'IND_LIC', titleAr: 'سجل صناعي ورخصة تشغيل سارية', titleEn: 'Industrial Register & Operating License', mandatory: true },
      { code: 'ELEC_BILLS_12', titleAr: 'فواتير الكهرباء لآخر 12 شهراً', titleEn: 'Last 12 Months Electricity Bills', mandatory: true },
      { code: 'LOAD_PROFILE', titleAr: 'بيانات الاستهلاك وملف الأحمال والقدرة التعاقدية وأقصى حمل', titleEn: 'Consumption Data, Load Profile, Contracted Capacity & Peak Load', mandatory: true },
      { code: 'ROOF_DEED', titleAr: 'بيان المساحات المتاحة وإثبات حق الملكية أو الاستخدام', titleEn: 'Available Areas & Ownership/Usage Proof', mandatory: true },
      { code: 'STRUCT_REPORT', titleAr: 'تقرير إنشائي معتمد بصلاحية الأسطح لتحمل الألواح والهياكل وأحمال الرياح', titleEn: 'Certified Structural Suitability Report', mandatory: true },
      { code: 'GRID_DATA', titleAr: 'بيانات المحولات ولوحات التوزيع ونقاط الربط ومتطلبات الحماية والقياس', titleEn: 'Transformers, Panels, Connection Points & Protection/Metering', mandatory: true },
      { code: 'FEASIBILITY', titleAr: 'دراسة فنية واقتصادية (القدرة والإنتاج السنوي ونسبة الاستهلاك الذاتي والتكلفة والوفر وفترة الاسترداد)', titleEn: 'Technical & Economic Feasibility Study', mandatory: true },
      { code: 'SPECS', titleAr: 'شهادات مطابقة المعدات للمواصفات', titleEn: 'Equipment Compliance Certificates', mandatory: true },
      { code: 'PROVIDER', titleAr: 'تعاقد مع شركة متخصصة ومؤهلة', titleEn: 'Qualified Specialist Contractor Agreement', mandatory: true },
      { code: 'CREDIT', titleAr: 'مستندات التقييم الائتماني لدى البنك الممول', titleEn: 'Bank Credit Assessment Documents', mandatory: true },
    ],
    formSections: [
      {
        id: 'sec-sh-facility', titleAr: 'بيانات المنشأة', titleEn: 'Facility Information',
        descriptionAr: 'السجلات والتراخيص والبيانات الأساسية للمصنع.', descriptionEn: 'Registers, licenses, and basic factory data.',
        fields: [
          { id: 'commercialRegNo', labelAr: 'رقم السجل التجاري', labelEn: 'Commercial Register No.', type: 'text', required: true },
          { id: 'industrialRegNo', labelAr: 'رقم السجل الصناعي', labelEn: 'Industrial Register No.', type: 'text', required: true },
          { id: 'operatingLicenseNo', labelAr: 'رقم رخصة التشغيل', labelEn: 'Operating License No.', type: 'text', required: true },
          { id: 'sector', labelAr: 'القطاع الصناعي', labelEn: 'Industrial Sector', type: 'text', required: true },
          { id: 'governorate', labelAr: 'المحافظة', labelEn: 'Governorate', type: 'text', required: true },
        ],
      },
      {
        id: 'sec-sh-load', titleAr: 'الكهرباء والأحمال', titleEn: 'Electricity & Loads',
        descriptionAr: 'فواتير 12 شهراً والقدرة التعاقدية والأحمال وساعات التشغيل.', descriptionEn: 'Twelve-month bills, contracted capacity, loads, and operating hours.',
        fields: [
          { id: 'avgMonthlyBillEGP', labelAr: 'متوسط الفاتورة الشهرية (جنيه) — آخر 12 شهراً', labelEn: 'Average Monthly Bill (EGP) — Last 12 Months', type: 'number', required: true, min: 0 },
          { id: 'contractedCapacityKW', labelAr: 'القدرة التعاقدية (كيلووات)', labelEn: 'Contracted Capacity (kW)', type: 'number', required: true, min: 0 },
          { id: 'peakLoadKW', labelAr: 'أقصى حمل (كيلووات)', labelEn: 'Peak Load (kW)', type: 'number', required: true, min: 0 },
          { id: 'dailyOperatingHours', labelAr: 'ساعات التشغيل اليومية', labelEn: 'Daily Operating Hours', type: 'number', required: true, min: 1, max: 24 },
        ],
      },
      {
        id: 'sec-sh-site', titleAr: 'المساحات والملكية', titleEn: 'Space & Ownership',
        descriptionAr: 'المساحات المتاحة وإثبات حق الملكية أو الاستخدام.', descriptionEn: 'Available space and ownership or usage proof.',
        fields: [
          { id: 'availableAreaM2', labelAr: 'المساحة المتاحة (م²)', labelEn: 'Available Area (m²)', type: 'number', required: true, min: 0 },
          { id: 'roofType', labelAr: 'نوع السطح', labelEn: 'Roof Type', type: 'select', required: true, options: [{ labelAr: 'خرسانة', labelEn: 'Concrete', value: 'concrete' }, { labelAr: 'معدني', labelEn: 'Metal', value: 'metal' }, { labelAr: 'أرض مجاورة', labelEn: 'Adjacent Ground', value: 'ground_mounted' }] },
          { id: 'ownershipProof', labelAr: 'إثبات الملكية أو الاستخدام', labelEn: 'Ownership or Usage Proof', type: 'select', required: true, options: [{ labelAr: 'ملكية', labelEn: 'Owned', value: 'owned' }, { labelAr: 'حق انتفاع / إيجار طويل يغطي مدة التمويل', labelEn: 'Usufruct / Long Lease Covering Financing Term', value: 'long_lease' }] },
        ],
      },
      {
        id: 'sec-sh-study', titleAr: 'الدراسة الفنية', titleEn: 'Technical Study',
        descriptionAr: 'قدرة المحطة والإنتاج السنوي ونسبة الاستهلاك الذاتي وفترة الاسترداد.', descriptionEn: 'Plant capacity, annual output, self-consumption share, and payback.',
        fields: [
          { id: 'plantCapacityKWp', labelAr: 'قدرة المحطة (كيلووات ذروة)', labelEn: 'Plant Capacity (kWp)', type: 'number', required: true, min: 0 },
          { id: 'annualProductionMWh', labelAr: 'الإنتاج السنوي المتوقع (ميجاوات ساعة)', labelEn: 'Expected Annual Production (MWh)', type: 'number', required: true, min: 0 },
          { id: 'selfConsumptionPct', labelAr: 'نسبة الاستهلاك الذاتي (%)', labelEn: 'Self-Consumption Share (%)', type: 'number', required: true, min: 0, max: 100 },
          { id: 'paybackYears', labelAr: 'فترة الاسترداد (سنوات)', labelEn: 'Payback Period (Years)', type: 'number', required: true, min: 0 },
        ],
      },
    ],
    impactMetrics: { targetFactories: 7000, targetCapacityMW: 1000, benefitedFactories: 0, savedEnergyGWh: 0, investmentStimulatedEGP: 0, jobsCreated: 0 },
    customization: {
      ...DEFAULT_CUSTOMIZATION,
      page: {
        layout: 'spotlight',
        heroTitleAr: 'شمس الصناعة: طاقة مصانعنا من أرضنا',
        heroTitleEn: 'Industry Sun: our factories powered by our land',
        heroSubtitleAr: 'قدرات شمسية تصل إلى 1000 ميجاوات لنحو 7000 مصنع بتمويل مصرفي يصل إلى 12.5 مليار جنيه',
        heroSubtitleEn: 'Up to 1,000 MW of solar for about 7,000 factories with bank financing of up to EGP 12.5B',
        ctaPrimaryLabelAr: 'قدّم الآن',
        ctaPrimaryLabelEn: 'Apply now',
        ctaSecondaryLabelAr: 'افحص الأهلية',
        ctaSecondaryLabelEn: 'Check eligibility',
        galleryImages: ['/covers/solar-2026.jpg'],
        sections: [
          { id: 'sec-stats', kind: 'stats', titleAr: 'مؤشرات الأثر', titleEn: 'Impact metrics', visible: true },
          { id: 'sec-benefits', kind: 'benefits', titleAr: 'المزايا', titleEn: 'Benefits', visible: true },
          { id: 'sec-timeline', kind: 'timeline', titleAr: 'المراحل', titleEn: 'Timeline', visible: true },
          { id: 'sec-faqs', kind: 'faqs', titleAr: 'الأسئلة الشائعة', titleEn: 'FAQs', visible: true },
          { id: 'sec-partners', kind: 'partners', titleAr: 'الشركاء', titleEn: 'Partners', visible: true },
          { id: 'sec-apply', kind: 'apply', titleAr: 'التقديم', titleEn: 'Apply', visible: true },
        ],
      },
    },
    workflow: solarWorkflow(),
  },
  {
    id: 'init-modernization-2026', slug: 'factory-modernization-fund',
    titleAr: 'صندوق تحديث الصناعة وتطوير خطوط الإنتاج', titleEn: 'Factory Modernization Fund',
    taglineAr: 'منح وتمويلات لتحديث الآلات وخطوط الإنتاج', taglineEn: 'Grants for machinery upgrades',
    descriptionAr: 'دعم مالي وفني لإحلال الماكينات القديمة بمعدات آلية حديثة.', descriptionEn: 'Financial and technical support to modernize legacy lines.',
    category: 'التحديث التكنولوجي والجودة', categoryEn: 'Tech Modernization & Quality',
    status: 'active',
    targetSectors: ['الغزل والنسيج', 'الصناعات الغذائية'], targetSectorsEn: ['Textiles', 'Food'],
    targetGovernorates: ['كافة المحافظات الصناعية'],
    budgetTotalEGP: 3000000000, budgetAllocatedEGP: 1200000000,
    startDate: '2026-02-01', endDate: '2026-11-30', coverImage: '/covers/modernization-2026.svg',
    badgeTextAr: 'دعم يصل إلى 70%', badgeTextEn: 'Up to 70% Support',
    participatingOrgs: ['وزارة الصناعة', 'مركز تحديث الصناعة (IMC)'],
    benefits: [{ titleAr: 'تمويل الماكينات الحديثة', titleEn: 'Machinery Financing', descriptionAr: 'تسهيلات طويلة الأجل.', descriptionEn: 'Long-term facilities.', iconName: 'Cpu' }],
    faqs: [{ questionAr: 'هل يشمل التحول الرقمي؟', questionEn: 'Include digital?', answerAr: 'نعم — ERP وSCADA.', answerEn: 'Yes — ERP and SCADA.' }],
    preEligibilityQuestions: [{ id: 'qm1', questionAr: 'هل المنشأة تعمل منذ سنتين؟', questionEn: 'Active for 2+ years?', type: 'boolean', expectedValue: true, explanationAr: 'للمصانع القائمة.', explanationEn: 'Established factories.' }],
    requiredDocsList: [{ code: 'CR_COPY', titleAr: 'السجل التجاري', titleEn: 'Commercial Register', mandatory: true }],
    formSections: [{ id: 'sec-mod-1', titleAr: 'بيانات خط الإنتاج', titleEn: 'Line Details', fields: [{ id: 'currentLineAgeYears', labelAr: 'عمر الخط (سنوات)', labelEn: 'Line Age', type: 'number', required: true }] }],
    impactMetrics: { targetFactories: 800, benefitedFactories: 195, investmentStimulatedEGP: 1200000000, jobsCreated: 920 },
    customization: DEFAULT_CUSTOMIZATION,
    workflow: { id: 'wf-mod-v1', initiativeId: 'init-modernization-2026', version: 1, nameAr: 'مسار التحديث', nameEn: 'Modernization Workflow', active: true, stages: [{ id: 'sm-1', order: 1, code: 'MOD_ELIGIBILITY', nameAr: '1. مراجعة الأهلية', nameEn: '1. Eligibility', assignedOrgId: 'org-imc', assignedOrgNameAr: 'مركز تحديث الصناعة', assignedRole: 'imc_reviewer', slaDays: 4, requiredDocuments: ['CR_COPY'], canReject: true, canRequestRework: true }] },
  },
  {
    id: 'init-import-sub-2026', slug: 'local-manufacturing-innovation',
    titleAr: 'المبادرة الوطنية لتعميق التصنيع المحلي', titleEn: 'Local Manufacturing Deepening',
    taglineAr: 'حوافز وأراضٍ مجهزة للمكون المحلي', taglineEn: 'Incentives for local components',
    descriptionAr: '152 فرصة استثمارية لإنتاج مستلزمات الإنتاج محلياً.', descriptionEn: '152 opportunities for local components.',
    category: 'تعميق التصنيع المحلي', categoryEn: 'Localization',
    status: 'coming_soon',
    targetSectors: ['الصناعات الكيماوية'], targetSectorsEn: ['Chemicals'],
    targetGovernorates: ['العين السخنة'],
    budgetTotalEGP: 10000000000, budgetAllocatedEGP: 0,
    startDate: '2026-05-01', endDate: '2027-04-30', coverImage: '/covers/import-substitution-2026.svg',
    badgeTextAr: 'قريباً — مايو 2026', badgeTextEn: 'Coming Soon',
    participatingOrgs: ['وزارة الصناعة', 'هيئة التنمية الصناعية (IDA)'],
    benefits: [], faqs: [], preEligibilityQuestions: [], requiredDocsList: [], formSections: [],
    impactMetrics: { targetFactories: 500, benefitedFactories: 0, investmentStimulatedEGP: 0, jobsCreated: 0 },
    customization: { ...DEFAULT_CUSTOMIZATION, enablePreEligibility: false },
    workflow: { id: 'wf-imp-v1', initiativeId: 'init-import-sub-2026', version: 1, nameAr: 'مسار التعميق', nameEn: 'Deepening Workflow', active: true, stages: [] },
  },
] as const;

/**
 * مركز المراسلات: محادثات ثنائية تجريبية (fresh seed only) — الوزارة↔IDA، البنك↔الوزارة، IDA↔IMC.
 * reminderSent* is pre-set so seed addresses (real-looking gov domains) are never emailed.
 */
function seedDemoChat(db: ReturnType<typeof getDb>): void {
  const at = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
  const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]) as [string, string];
  const conv = db.prepare(
    `INSERT OR IGNORE INTO chat_conversations
     (id, orgA, orgB, lastMessageAt, lastMessagePreview, lastSenderOrgId, readA, readB, reminderSentA, reminderSentB, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const msg = db.prepare(
    'INSERT OR IGNORE INTO chat_messages (id, conversationId, senderUserId, senderOrgId, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
  );
  type M = { id: string; user: string; org: string; at: string; body: string };
  /** reads: last-read timestamp per org of the pair. */
  const thread = (id: string, x: string, y: string, msgs: M[], reads: Record<string, string>) => {
    const [a, b] = pair(x, y);
    const last = msgs[msgs.length - 1];
    conv.run(id, a, b, last.at, last.body, last.org, reads[a] ?? '', reads[b] ?? '', last.at, last.at, msgs[0].at);
    for (const m of msgs) msg.run(m.id, id, m.user, m.org, m.body, m.at);
  };

  const ida: M[] = [
    { id: 'cmsg-demo-ida-1', user: 'user-admin', org: 'org-ministry', at: at(2 * 24 * 60), body: 'السادة الهيئة العامة للتنمية الصناعية، نرجو موافاتنا بآخر تحديث لأعداد المصانع المسجلة في مبادرة «شمس الصناعة».' },
    { id: 'cmsg-demo-ida-2', user: 'user-ida', org: 'org-ida', at: at(2 * 24 * 60 - 180), body: 'تم الاطلاع، وسيتم إرسال التقرير المحدث خلال يومي عمل.' },
    { id: 'cmsg-demo-ida-3', user: 'user-manager', org: 'org-ministry', at: at(60), body: 'شكراً لكم. برجاء التأكد من تضمين مصانع المناطق الصناعية الجديدة في التقرير.' },
  ];
  thread('chat-demo-ida', 'org-ministry', 'org-ida', ida, { 'org-ministry': ida[2].at, 'org-ida': ida[1].at });

  const nbe: M[] = [
    { id: 'cmsg-demo-nbe-1', user: 'user-bank', org: 'org-nbe', at: at(30), body: 'نود الاستفسار عن آلية إرسال ملفات التقييم الائتماني للمصانع المتقدمة للمبادرة.' },
  ];
  thread('chat-demo-nbe', 'org-ministry', 'org-nbe', nbe, { 'org-nbe': nbe[0].at });

  // محادثة مباشرة بين جهتين (تظهر للوزارة في «محادثات الجهات» للاطلاع فقط).
  const idaImc: M[] = [
    { id: 'cmsg-demo-idaimc-1', user: 'user-ida', org: 'org-ida', at: at(5 * 60), body: 'زملاءنا في مركز تحديث الصناعة، هل يمكن مشاركة نموذج تقييم الملف الفني المعتمد لديكم لتوحيد متطلبات المصانع؟' },
    { id: 'cmsg-demo-idaimc-2', user: 'user-imc', org: 'org-imc', at: at(4 * 60), body: 'بالتأكيد، سنرسل النموذج المحدث اليوم مع دليل الاستيفاء.' },
  ];
  thread('chat-demo-ida-imc', 'org-ida', 'org-imc', idaImc, { 'org-ida': idaImc[1].at, 'org-imc': idaImc[1].at });
}

/**
 * الجهات + الحسابات + المصانع (INSERT OR IGNORE — لا يلمس صفاً موجوداً ولا كلمة مرور غيّرها صاحبها).
 * كل حساب مزروع بكلمة البذرة ومُجبر على تغييرها عند أول دخول. يعيد هاش كلمة البذرة.
 */
function insertBaseRows(db: ReturnType<typeof getDb>, now: string): string {
  const orgStmt = db.prepare(
    'INSERT OR IGNORE INTO organizations (id, code, nameAr, nameEn, type, active, contactEmail, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const o of ORGS) orgStmt.run(o.id, o.code, o.nameAr, o.nameEn, o.type, o.active, o.contactEmail, now, now);

  const facStmt = db.prepare(
    'INSERT OR IGNORE INTO factories (id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
  );
  for (const f of FACTORIES) facStmt.run(f.id, JSON.stringify(f.data), now, now);

  const defaultHash = hashPassword(SEED_DEFAULT_PASSWORD);
  const userStmt = db.prepare(
    'INSERT OR IGNORE INTO users (id, name, nameEn, email, role, organizationId, factoryId, passwordHash, mustChangePassword, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
  );
  for (const u of USERS) userStmt.run(u.id, u.name, u.nameEn, u.email, u.role, u.organizationId, u.factoryId ?? '', defaultHash, now, now);
  // مالكو المصانع في قواعد قديمة زُرعوا بلا factoryId — اربطهم (لا يغيّر ربطاً موجوداً).
  const linkStmt = db.prepare("UPDATE users SET factoryId = ? WHERE id = ? AND (factoryId IS NULL OR factoryId = '')");
  for (const u of USERS) if (u.factoryId) linkStmt.run(u.factoryId, u.id);
  return defaultHash;
}

/**
 * تحديثات البذرة المرقّمة لقواعد أنشأتها هذه البذرة (seeded_v1) — تعمل مع كل إقلاع حتى مع
 * SEED_ON_BOOT=0، فتصل البيانات الجديدة للقاعدة الحية تلقائياً مع كل deploy. كل نسخة تُطبَّق مرة
 * واحدة (علم في meta) وتضيف الناقص/تملأ الفارغ فقط: لا تكتب فوق تعديل أدمن، ولا تعيد حساباً حُذف.
 * قاعدة فارغة (إنتاج نظيف بلا بذرة) لا تُلمس. يعيد أسماء التحديثات المطبقة الآن.
 */
export function applySeedUpdates(): string[] {
  const db = getDb();
  const has = (key: string) => (db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value?: string } | undefined)?.value === '1';
  if (!has('seeded_v1')) return [];
  const now = nowIso();
  const applied: string[] = [];
  const mark = (key: string) => {
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, '1')").run(key);
    applied.push(key);
  };

  // v2: حسابات seed-data.json (مراجع ائتمان ثانٍ + 3 مصانع ديمو بجهاتها وملّاكها).
  if (!has('seed_users_v2')) {
    db.exec('BEGIN IMMEDIATE');
    try {
      insertBaseRows(db, now);
      mark('seed_users_v2');
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* noop */ }
      throw e;
    }
  }

  // شمس الصناعة: بقية بيانات الوثيقة الرسمية — تملأ الحقول الفارغة فقط.
  if (!has('seed_shams_content_v1')) {
    const cols = Object.keys(SHAMS_CONTENT) as Array<keyof typeof SHAMS_CONTENT>;
    const row = db.prepare(`SELECT ${cols.join(', ')} FROM initiatives WHERE id = ?`).get('init-solar-2026') as Record<string, string | null> | undefined;
    if (row) {
      const isEmpty = (v: string | null) => !v || !v.trim() || v === '[]' || v === '{}';
      const fill = cols.filter((c) => isEmpty(row[c]));
      if (fill.length) {
        const vals = fill.map((c) => { const v = SHAMS_CONTENT[c]; return typeof v === 'string' ? v : JSON.stringify(v); });
        db.prepare(`UPDATE initiatives SET ${fill.map((c) => `${c} = ?`).join(', ')}, updatedAt = ? WHERE id = ?`).run(...vals, now, 'init-solar-2026');
      }
    }
    mark('seed_shams_content_v1');
  }
  return applied;
}

export function seedIfEmpty(): { seeded: boolean; updates: string[] } {
  const db = getDb();
  const now = nowIso();
  // PROD FIX: backfill كلمات المرور للقواعد القديمة حتى لو مزروعة من قبل (لا تعتمد على seeded flag).
  try {
    const need = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE passwordHash IS NULL OR passwordHash = ''").get() as { c: number }).c;
    if (need > 0) {
      const h = hashPassword(SEED_DEFAULT_PASSWORD);
      db.prepare("UPDATE users SET passwordHash = ? WHERE passwordHash IS NULL OR passwordHash = ''").run(h);
    }
  } catch { /* pre-migration DB — ensureMigrated creates columns first */ }
  // API-only frontend: factory owners resolve their factory via users.factoryId (no static mapping).
  try {
    const factoryOwners: Array<[string, string]> = [
      ['user-factory-sewedy', 'factory-sewedy'],
      ['user-factory-1', 'factory-1'],
      ['user-ghazl', 'factory-ghazl'],
      ['user-chem', 'factory-chem'],
      ['user-ceramic', 'factory-ceramic'],
    ];
    const linkStmt = db.prepare("UPDATE users SET factoryId = ? WHERE id = ? AND (factoryId IS NULL OR factoryId = '')");
    for (const [uid, fid] of factoryOwners) linkStmt.run(fid, uid);
  } catch { /* pre-migration DB — ensureMigrated creates the column first */ }
  // P0-SEC (مرة واحدة): أي حساب مزروع ما زال بكلمة البذرة الموحدة يُجبر على التغيير.
  // دقيق: من غيّر كلمته لا تطابقه verifyPassword فيُترك وشأنه.
  try {
    const forced = db.prepare("SELECT value FROM meta WHERE key = 'seed_pwforce_v1'").get() as { value?: string } | undefined;
    if (forced?.value !== '1') {
      const rowStmt = db.prepare('SELECT passwordHash, mustChangePassword FROM users WHERE id = ?');
      const forceStmt = db.prepare('UPDATE users SET mustChangePassword = 1 WHERE id = ?');
      for (const u of USERS) {
        try {
          const row = rowStmt.get(u.id) as { passwordHash?: string; mustChangePassword?: number } | undefined;
          if (row?.passwordHash && !row.mustChangePassword && verifyPassword(SEED_DEFAULT_PASSWORD, row.passwordHash)) {
            forceStmt.run(u.id);
          }
        } catch { /* ignore per-user */ }
      }
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_pwforce_v1', '1')").run();
    }
  } catch { /* pre-migration DB */ }
  const seededFlag = db.prepare("SELECT value FROM meta WHERE key = 'seeded_v1'").get() as { value?: string } | undefined;
  const orgCount = (db.prepare('SELECT COUNT(*) AS c FROM organizations').get() as { c: number }).c;
  // Backfill: قواعد مزروعة قديما بلا customization.page — ادمج مثال الصفحة إن غاب (مرة واحدة).
  try {
    const row = db.prepare('SELECT customization FROM initiatives WHERE id = ?').get('init-solar-2026') as { customization?: string } | undefined;
    if (row?.customization) {
      const cust = JSON.parse(row.customization as string) as Record<string, unknown>;
      if (!cust.page) {
        (cust as Record<string, unknown>).page = {
          layout: 'spotlight',
          heroTitleAr: 'شمس الصناعة: طاقة مصانعنا من أرضنا',
          heroTitleEn: 'Industry Sun: our factories powered by our land',
          heroSubtitleAr: 'قدرات شمسية تصل إلى 1000 ميجاوات لنحو 7000 مصنع بتمويل مصرفي يصل إلى 12.5 مليار جنيه',
          heroSubtitleEn: 'Up to 1,000 MW of solar for about 7,000 factories with bank financing of up to EGP 12.5B',
          ctaPrimaryLabelAr: 'قدّم الآن',
          ctaPrimaryLabelEn: 'Apply now',
          ctaSecondaryLabelAr: 'افحص الأهلية',
          ctaSecondaryLabelEn: 'Check eligibility',
          galleryImages: ['/covers/solar-2026.jpg'],
          sections: [
            { id: 'sec-stats', kind: 'stats', titleAr: 'مؤشرات الأثر', titleEn: 'Impact metrics', visible: true },
            { id: 'sec-benefits', kind: 'benefits', titleAr: 'المزايا', titleEn: 'Benefits', visible: true },
            { id: 'sec-timeline', kind: 'timeline', titleAr: 'المراحل', titleEn: 'Timeline', visible: true },
            { id: 'sec-faqs', kind: 'faqs', titleAr: 'الأسئلة الشائعة', titleEn: 'FAQs', visible: true },
            { id: 'sec-partners', kind: 'partners', titleAr: 'الشركاء', titleEn: 'Partners', visible: true },
            { id: 'sec-apply', kind: 'apply', titleAr: 'التقديم', titleEn: 'Apply', visible: true },
          ],
        };
        db.prepare('UPDATE initiatives SET customization = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(cust), now, 'init-solar-2026');
      }
    }
  } catch { /* pre-migration DB — ignore */ }
  // الحوكمة: «المراجعة الأولية — الوزارة» أول كل مسار + إعادة الطلبات المصعّدة قديماً لجهة مرحلتها (idempotent).
  try { alignWorkflowsAndAssignments(); } catch { /* pre-migration DB */ }
  if (seededFlag?.value === '1' && orgCount > 0) return { seeded: false, updates: applySeedUpdates() };

  db.exec('BEGIN IMMEDIATE');
  try {
    const defaultHash = insertBaseRows(db, now);
    // Backfill: existing DBs created before passwordHash column — set default hash where empty.
    try {
      db.prepare("UPDATE users SET passwordHash = ? WHERE passwordHash IS NULL OR passwordHash = ''").run(defaultHash);
    } catch { /* column may not exist on very old DB before migration — ensureMigrated handles */ }

    const initStmt = db.prepare(
      `INSERT OR IGNORE INTO initiatives
       (id, slug, titleAr, titleEn, taglineAr, taglineEn, descriptionAr, descriptionEn, category, categoryEn, status,
        targetSectors, targetSectorsEn, targetGovernorates, budgetTotalEGP, budgetAllocatedEGP, startDate, endDate,
        coverImage, badgeTextAr, badgeTextEn, participatingOrgs, benefits, faqs, preEligibilityQuestions,
        requiredDocsList, formSections, impactMetrics, customization, workflow, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const i of INITIATIVES) {
      initStmt.run(
        i.id, i.slug, i.titleAr, i.titleEn, i.taglineAr, i.taglineEn, i.descriptionAr, i.descriptionEn,
        i.category, i.categoryEn, i.status,
        JSON.stringify(i.targetSectors), JSON.stringify(i.targetSectorsEn), JSON.stringify(i.targetGovernorates),
        i.budgetTotalEGP, i.budgetAllocatedEGP, i.startDate, i.endDate, i.coverImage,
        i.badgeTextAr, i.badgeTextEn, JSON.stringify(i.participatingOrgs), JSON.stringify(i.benefits),
        JSON.stringify(i.faqs), JSON.stringify(i.preEligibilityQuestions), JSON.stringify(i.requiredDocsList),
        JSON.stringify(i.formSections), JSON.stringify(i.impactMetrics), JSON.stringify(i.customization),
        JSON.stringify(i.workflow), now, now,
      );
    }
    seedDemoChat(db);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('app_seq', '41')").run();
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded_v1', '1')").run();
    db.exec('COMMIT');
    alignWorkflowsAndAssignments();
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* noop */ }
    throw e;
  }
  return { seeded: true, updates: applySeedUpdates() };
}

/** Dangerous: wipes all data and reseeds (used by db:reset script only — REFUSES in production). */
export function resetAndSeed(): void {
  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    throw new Error('[db:reset] REFUSED in production — audit_logs is append-only.');
  }
  const db = getDb();
  // Temporarily drop append-only guards (dev only), wipe, then restore via schema re-exec.
  try { db.exec('DROP TRIGGER IF EXISTS audit_no_delete; DROP TRIGGER IF EXISTS audit_no_update;'); } catch { /* noop */ }
  db.exec(
    'DELETE FROM refresh_tokens; DELETE FROM audit_logs; DELETE FROM details_files; DELETE FROM applications; DELETE FROM factories; DELETE FROM initiatives; DELETE FROM users; DELETE FROM organizations; DELETE FROM meta;',
  );
  seedIfEmpty();
  // Re-enable append-only guards (dev reset dropped them)
  try {
    db.exec(`CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;`);
    db.exec(`CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;`);
  } catch { /* noop */ }
}
