# خطة معمارية وتصميم الواجهة الأمامية (Frontend Architecture & UI Blueprint)
## المنصة الوطنية لعرض وإدارة المبادرات الصناعية — جمهورية مصر العربية

---

## 1. الركائز المعمارية والتصميمية (Core Architectural Pillars)

```
+========================================================================================================+
|                                    FRONTEND ARCHITECTURE LAYOUT                                        |
+========================================================================================================+
|                                                                                                        |
|  [ 1. PRESENTATION LAYER ]                                                                             |
|  ├── Public Showcase & Discovery Hub (Marketplace, Filters, Hero Counters, Pre-Eligibility Quiz)       |
|  ├── Factory Portal (Profile Management, Smart Dynamic Wizard, Interactive Timeline, Document Locker)  |
|  ├── Admin & Agency Workstation (Multi-Entity Approvals, Table Management, SLA Monitors, Excel Export)  |
|  └── Initiative & Workflow Studio (Dynamic Landing CMS, Form Schema Builder, Visual Workflow Graph)    |
|                                                                                                        |
|  [ 2. STATE & ENGINE LAYER (Reactive Store & Mock Backend API) ]                                       |
|  ├── Workflow State Machine (Transitions, Roles, SLAs, Versioning, Dynamic Assignments)                |
|  ├── Form Validation Engine (JSON Schema, Conditional Fields, Repeating Tables)                       |
|  ├── RBAC & Multi-Entity Scope Guard (Agency Data Scopes, Field-Level Visibility)                     |
|  └── Unified Data Store (Reactive LocalStorage Persistence + Seed Data for Instant Live Demo)          |
|                                                                                                        |
|  [ 3. DESIGN SYSTEM & CORE FOUNDATION ]                                                                |
|  ├── CSS Variables & Semantic Tokens (Egyptian Industrial Deep Navy, Gold, Teal, Status Accents)       |
|  ├── Native Bilingual & RTL Engine (Arabic Primary / English Secondary)                               |
|  └── Reusable Atomic Components (DataTables, Badges, Timelines, Modals, Dynamic Inputs)                |
|                                                                                                        |
+========================================================================================================+
```

---

## 2. خريطة المسارات والشاشات (Navigation & Screen Hierarchy)

### المسار العام وبوابة الاستكشاف (Public Showcase)
1. **`/` (الصفحة الرئيسية وبوابة استكشاف المبادرات):**
   * شريط التنقل العلوي (الهوية المؤسسية، محول اللغة، تسجيل الدخول، ومبدل الأدوار التجريبي السريع).
   * قسم الأثر الوطني (National Impact Counters): عدادات حية للمصانع والتمويل والطاقة الموفرة.
   * شريط التصفية الذكي (Smart Filter Bar): بالقطاع الصناعي، المحافظة، نوع الدعم، والحالة.
   * شبكة بطاقات المبادرات (Initiative Cards Grid): بطاقات غنية مع وسم الدعم، نسبة التغطية، وزر استكشاف.
2. **`/initiative/:id` (صفحة الهبوط التعريفية للمبادرة):**
   * بانر المبادرة وأهدافها وميزانيتها.
   * كتل المزايا والحوافز (Benefits & Incentives Matrix).
   * **حاسبة وفحص الأهلية المسبق الفوري (Interactive Pre-Eligibility Modal):** أسئلة فورية توضح للمصنع مدى مطابقته قبل التقديم.
   * الدليل الإرشادي وقائمة المستندات المطلوبة (Downloadable PDF Guides).
   * الخط الزمني المتوقع للطلب والجهات المشاركة.
   * قسم الأسئلة الشائعة (FAQ Accordion).

---

### مسار بوابة المصانع (Factory Portal)
3. **`/factory/profile` (الملف الموحد للمصنع - Single Factory Profile):**
   * بيانات السجل التجاري والصناعي، الضرائب، الموقع، والقطاع.
   * استهلاك الطاقة وبيانات القدرة الإنتاجية.
   * محفظة المستندات المركزية (Document Locker).
4. **`/factory/apply/:initiativeId` (معالج التقديم الذكي - Dynamic Application Wizard):**
   * استدعاء بيانات الملف الموحد تلقائياً.
   * عرض الحقول الديناميكية الخاصة بالمبادرة وفق الشروط المنطقية (Conditional Display).
   * منطقة رفع الملفات مع التحقق الفوري من الصيغة والحجم.
5. **`/factory/applications` و `/factory/applications/:id` (لوحة المتابعة والخط الزمني):**
   * قائمة بطلبات المصنع وحالتها الحالية ومؤقت الـ SLA.
   * **الخط الزمني المرئي التفاعلي (Interactive Progress Timeline):** يوضح المرحلة الحالية، من راجع الطلب، وما هو الإجراء المطلوب (مثال: "مطلوب تعديل دراسة الجدوى من البنك").

---

### مسار لوحة تحكم الوزارة والجهات الشريكة (Admin & Agency Workstation)
6. **`/admin/dashboard` (لوحة القيادة والمؤشرات التشغيلية):**
   * بطاقات إحصائيات الأداء (إجمالي الطلبات، المعتمد، المرفوض، قيد المراجعة).
   * مؤشرات اختناقات مسارات العمل (Bottleneck Analyzer).
   * مراقبة تجاوزات اتفاقيات مستوى الخدمة (SLA Overdue Monitor).
7. **`/admin/applications` (جدول إدارة الطلبات المركزي):**
   * جدول بيانات متطور مع الفرز والبحث الفوري والتصفية المتعددة.
   * تصدير البيانات إلى تقارير Excel متكاملة.
   * إسناد المهام الفردي والجماعي للجهات والمراجعين.
8. **`/admin/applications/:id` (محطة مراجعة واعتماد الطلب متعددة الجهات):**
   * استعراض بيانات الطلب وحقول النموذج الديناميكي مع مراعاة صلاحيات الجهة (Field-level visibility).
   * نافذة معاينة المستندات المرفقة وتدقيقها (Document Inspector).
   * شريط اتخاذ القرارات: (اعتماد المرحلة `Approve`، طلب استكمال/تعديل `Request Rework`، رفض مسبب `Reject`، تصعيد `Escalate`).

---

### مسار محرك إنشاء وتخصيص المبادرات (Initiative & Workflow Studio)
9. **`/admin/initiatives/builder` (منشئ المبادرات الشامل):**
   * **التبويب 1 - محتوى العرض (Landing Page CMS):** تخصيص الغلاف، المزايا، الأسئلة الشائعة، والشعار.
   * **التبويب 2 - منشئ النماذج الديناميكي (Dynamic Form Builder):** سحب وإفلات أو إضافة الحقول (نصوص، أرقام، قوائم، جداول) مع شروط الظهور.
   * **التبويب 3 - مصمم مسارات العمل المرئي (Visual Workflow Graph Editor):** تحديد مراحل المبادرة، الجهات المسؤولة، شروط التفرع، والمدد الزمنية (SLA).
   * **التبويب 4 - محرك قواعد الأهلية (Pre-Eligibility Ruleset):** ضبط أسئلة الحاسبة السريعة.

---

## 3. هيكل المكونات ونظام التصميم (Component Hierarchy & Atomic Design)

```
src/
├── components/
│   ├── ui/                         # العناصر الأساسية (Atoms)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── StatusBadge.tsx         # شارة الحالة مع النقطة الملونة
│   │   ├── SLATimerBadge.tsx       # وسم حساب الوقت المتبقي
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Tabs.tsx
│   │   └── ProgressBar.tsx
│   │
│   ├── showcase/                   # مكونات بوابة العرض والاستكشاف
│   │   ├── HeroImpactBar.tsx       # عدادات الأثر الوطني
│   │   ├── InitiativeCard.tsx      # بطاقة المبادرة الغنية
│   │   ├── SmartFilterBar.tsx      # فلاتر القطاعات والمحافظات
│   │   ├── PreEligibilityModal.tsx # حاسبة الأهلية التفاعلية
│   │   ├── InitiativeBenefits.tsx  # كتل المزايا والحوافز
│   │   └── FAQAccordion.tsx
│   │
│   ├── workflow/                   # مكونات محرك مسارات العمل
│   │   ├── VisualWorkflowGraph.tsx # المخطط المرئي لعقد المسار
│   │   ├── StageNodeCard.tsx       # بطاقة عقدة المرحلة
│   │   ├── ApplicationTimeline.tsx # الخط الزمني التفاعلي للطلب
│   │   └── ApprovalActionDialog.tsx# نافذة اتخاذ القرار والتعليق
│   │
│   ├── forms/                      # مكونات النماذج الديناميكية
│   │   ├── DynamicFormRenderer.tsx # عارض النموذج وفق الـ JSON Schema
│   │   ├── DynamicFieldEditor.tsx  # أداة بناء الحقل في لوحة التحكم
│   │   └── DocumentUploader.tsx    # منطقة رفع وتدقيق الوثائق
│   │
│   ├── tables/                     # مكونات الجداول والتقارير
│   │   ├── ApplicationTable.tsx    # جدول الطلبات المتقدم
│   │   ├── AuditLogTable.tsx       # جدول سجل التدقيق
│   │   └── ExcelExportButton.tsx   # زر تصدير Excel الفوري
│   │
│   └── layout/                     # الهياكل العامة والقوائم
│       ├── HeaderNavbar.tsx        # الهيدر المؤسسي مع محول اللغة
│       ├── SidebarNav.tsx          # القائمة الجانبية للوحة الإدارة
│       └── PersonaSwitcher.tsx     # شريط تبديل الأدوار السريع للتجربة
│
├── store/                          # إدارة الحالة ومحرك البيانات التفاعلي
│   ├── useAuthStore.ts             # بيانات المستخدم الحالي والجهة
│   ├── useInitiativesStore.ts      # بيانات المبادرات وإعدادات العرض
│   ├── useApplicationsStore.ts     # إدارة الطلبات والمراحل والقرارات
│   ├── useWorkflowStore.ts         # محرك مسار العمل والـ SLA
│   └── seedData.ts                 # البيانات الافتراضية المتكاملة لمبادرة الطاقة الشمسية
│
└── styles/
    ├── visual-tokens.css           # متغيرات الألوان والهوية المؤسسية
    └── globals.css                 # الأنماط العامة وقواعد الـ RTL
```

---

## 4. نموذج محاكاة البيانات وتغيير الأدوار الفوري (Interactive Persona Switcher)

لضمان إمكانية تجربة واستعراض المنصة بالكامل من قبل أي مستخدم دون الحاجة لربط خادم خارجي معقد مبدئياً:
* يتم تزويد الواجهة بـ **شريط تبديل أدوار عائم (Floating Role Switcher)** يتيح التنقل بنقرة واحدة بين:
  1. 👑 **مسؤول وزارة الصناعة (Ministry Super Admin):** كامل الصلاحيات لإنشاء المبادرات وتخصيص المسارات ومتابعة الإحصائيات.
  2. 🏢 **مراجع هيئة التنمية الصناعية (IDA Reviewer):** فحص الأهلية والتراخيص والسجلات الصناعية.
  3. 🔬 **استشاري مركز تحديث الصناعة (IMC Technical Reviewer):** مراجعة الدراسات الفنية والمواصفات الهندسية.
  4. 🏦 **مسؤول الائتمان بالبنك (National Bank Officer):** مراجعة الملاءة المالية والموافقة على خطة التمويل.
  5. 🏭 **ممثل المصنع (Factory Representative - السويدي للصناعات / مصر للغزل):** التقديم واستكمال الوثائق ومتابعة الخط الزمني.

---

## 5. خطة التنفيذ المرحلية لبناء الفرونت إند (Implementation Roadmap)

| الخطوة | المرحلة | المخرجات المستهدفة |
| :---: | :--- | :--- |
| **1** | **تأسيس نظام التصميم والمتغيرات (Design System Setup)** | استيراد متغيرات الألوان المؤسسية، الخطوط العربية، ودعم الـ RTL في ملفات الـ CSS الأساسية. |
| **2** | **بناء بوابة العرض واستكشاف المبادرات (Showcase Portal)** | تطوير الهيدر المؤسسي، شريط الأثر الوطني، فلاتر القطاعات، بطاقات المبادرات، وحاسبة الأهلية التفاعلية. |
| **3** | **بناء بوابة المصانع ومعالج التقديم (Factory Portal & Dynamic Form)** | شاشة الملف الموحد، معالج التقديم الذكي للحقول الديناميكية، وشاشة الخط الزمني للطلب. |
| **4** | **بناء لوحة تحكم الإدارة ومحطة مراجعة الطلبات (Admin Workstation)** | جدول الطلبات، فلاتر التوزيع الجغرافي والقطاعي، نافذة تدقيق المستندات، وشريط اتخاذ القرارات. |
| **5** | **بناء استوديو المبادرات ومصمم مسارات العمل المرئي (Workflow Studio)** | محرر صفحات الهبوط للمبادرات، منشئ النماذج، ومخطط مسار العمل المرئي للربط بين المراحل والـ SLA. |
| **6** | **إدماج البيانات التجريبية والتصدير للـ Excel (Seed Data & Export)** | شحن النظام ببيانات واقعية لمبادرة الطاقة الشمسية ومصانع مصرية وتفعيل التصدير الفوري. |
