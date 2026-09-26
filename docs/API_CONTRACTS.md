# عقود الـ API — المرجع المشترك لفريقي الفرونت والباك
> المصدر الوحيد للحقيقة هو `contracts/api.contracts.ts` + `contracts/openapi.json`.
> هذا الملف شرح عملي بنفس الصيغة المطلوبة: `POST test.com/member` → `Req{Name,address,phone}` → `Response{message,status}`.
> أي خلاف يتحسم من العقد، وأي تغيير يبدأ من العقد أولا.

## 0) الأساس الثابت لكل الراوتس

```
Base dev : http://localhost:4000
Base prod: https://api.industry.gov.eg
Prefix   : /api/v1  (كل المسارات تحته)
```

**Headers (ترسل في كل طلب):**

```
Accept-Language: ar | en   (افتراضي ar)
Authorization: Bearer <accessToken>   (أساسي — من POST /auth/login، قصير 15 دقيقة)
Content-Type: application/json  (عدا الرفع multipart)
```

> المصادقة: JWT أساسي + Refresh دوّار عبر كوكي `httpOnly`.
> هيدر `x-user-id` + `POST /auth/switch-user` للديمو والتطوير فقط (`ALLOW_DEMO_AUTH=1` — محظور في الإنتاج).
> تدفق الدخول: `POST /auth/login {email,password}` → `{accessToken, refreshToken, mustChangePassword, user}` —
> الحسابات المزروعة بكلمة موحدة تُجبر على التغيير (`mustChangePassword=true`) عند أول دخول.

**شكل الخطأ الموحد (أي فشل):**

```json
{ "code": "VALIDATION_ERROR", "messageAr": "رسالة عربية جاهزة للعرض", "messageEn": "English message", "details": [{ "field": "initiativeId", "issue": "required" }] }
```

**الترقيم الموحد:**

```
GET /api/v1/xxx?page=1&pageSize=10
Res { data: [...], page: 1, pageSize: 10, total: 42, totalPages: 5 }
```

قواعد الحقول: `camelCase` دائما — التواريخ `ISO string` — المبالغ أرقام `EGP` — النص المزدوج `Ar/En`.

---

## 1) `GET /api/v1/health` — فحص الحياة

```
GET /api/v1/health
Req  {}
Res  { status, version, time }
```

Response `200`:

```json
{ "status": "ok", "version": "1.0.0", "time": "2026-09-09T10:00:00.000Z" }
```

---

## 2) `GET /api/v1/users/me` — المستخدم الحالي (Bearer JWT)

```
GET /api/v1/users/me
Headers { Authorization: "Bearer <accessToken>" }
Req  {}
Res  { message, status, data: User }
```

| حقل الرد | النوع | مثال |
|---|---|---|
| `data.id` | `string` | `user-admin` |
| `data.name` / `data.nameEn` | `string` | `ليلى حسن` / `Laila Hassan` |
| `data.role` | `ContractUserRole` | `ministry_admin` |
| `data.organizationId` | `string` | `org-ministry` |

Response `200`:

```json
{ "message": "ok", "status": "ok", "data": { "id": "user-admin", "name": "ليلى حسن", "nameEn": "Laila Hassan", "email": "admin@industry.gov.eg", "role": "ministry_admin", "organizationId": "org-ministry" } }
```

Error `401`: توكن ناقص/منتهي → `{ code: "UNAUTHORIZED", messageAr: "انتهت الجلسة — سجل الدخول مجددا." }`.

## 3) `POST /api/v1/auth/switch-user` — تبديل الشخصية (ديمو فقط)

```
POST /api/v1/auth/switch-user
Req  { userId }
Res  { message, status, data: User }
```

| حقل الطلب | النوع | مطلوب | تحقق |
|---|---|---|---|
| `userId` | `string` | ✅ | يجب أن يكون موجودا في جدول المستخدمين |

Req:

```json
{ "userId": "user-factory-1" }
```

Res `200`:

```json
{ "message": "تم تبديل الشخصية", "status": "ok", "data": { "id": "user-factory-1", "role": "factory_owner", "organizationId": "org-factory-1", "name": "مصنع...", "nameEn": "...", "email": "..." } }
```

---

## 4) `GET /api/v1/initiatives?status=&q=&page=&pageSize=` — قائمة المبادرات

```
GET /api/v1/initiatives?status=active&q=شمس&page=1&pageSize=20
Req  { status?, q?, page?, pageSize? }
Res  Paginated<InitiativeListItem>
```

| باراميتر | النوع | افتراضي | ملاحظة |
|---|---|---|---|
| `status` | `string` | `ALL` | `active / draft / coming_soon / closed / archived / completed` |

> **الظهور:** `draft` و `archived` لا تُرجع إلا لـ `ministry_admin / initiative_manager / auditor` (هوية اختيارية: Bearer أو `x-user-id` في dev). الجمهور والأدوار الأخرى لا يرونها.
| `q` | `string` | — | بحث في `titleAr/titleEn` |
| `page` | `number` | `1` | `>= 1` |
| `pageSize` | `number` | `20` | `1..100` |

Item:

| حقل | النوع | مثال |
|---|---|---|
| `id` | `string` | `init-solar-1` |
| `titleAr` / `titleEn` | `string` | `الطاقة الشمسية للمصانع` |
| `status` | `string` | `active` |
| `budgetTotalEGP` | `number` | `500000000` |
| `coverImage` | `string` | `/covers/solar.svg` |

Res `200`:

```json
{ "data": [{ "id": "init-solar-1", "titleAr": "الطاقة الشمسية للمصانع", "titleEn": "Solar for Factories", "status": "active", "budgetTotalEGP": 500000000, "coverImage": "/covers/solar.svg" }], "page": 1, "pageSize": 20, "total": 3, "totalPages": 1 }
```

## 5) `GET /api/v1/initiatives/:id` — تفاصيل مبادرة

```
GET /api/v1/initiatives/init-solar-1
Res { message, status, data: Initiative }   (الشكل الكامل = src/types Initiative)
```

Error `404`: `{ code: "NOT_FOUND", messageAr: "المبادرة غير موجودة." }` — ويُرد أيضاً لمبادرة `draft/archived` لغير الإدارة والمدقق.

الرد الكامل يحمل `createdAt` / `updatedAt` (ISO).

## 6) `POST /api/v1/initiatives` — إنشاء (ministry_admin / initiative_manager)

```
POST /api/v1/initiatives
Req  UpsertInitiativeReq (كل بيانات المبادرة قابلة للتحكم — INITIATIVE=CONFIGURATION، لا Hard-code)
Res  { message, status, data: { id } }   (201)
```

| حقل | مطلوب | تحقق |
|---|---|---|
| `titleAr` / `titleEn` | ✅ | `min 3` |
| `slug` | — | فريد — يولد تلقائيا من `titleEn` إن غاب |
| `taglineAr/En`, `descriptionAr/En`, `category/En`, `badgeTextAr/En`, `coverImage` | — | نصوص حرة (`/covers/*.svg` أو `URL`) |
| `status` | — | `active/draft/coming_soon/closed/archived/completed` (افتراضي `draft`) |
| `targetSectors/En`, `targetGovernorates`, `participatingOrgs` | — | `array` |
| `budgetTotalEGP` / `budgetAllocatedEGP` | — | `>= 0` |
| `startDate` / `endDate` | — | `ISO date` |
| `benefits[]` | — | `{ titleAr, titleEn, descriptionAr, descriptionEn, iconName }` |
| `faqs[]` | — | `{ questionAr, questionEn, answerAr, answerEn }` |
| `preEligibilityQuestions[]` | — | `{ id?, questionAr, questionEn, type: boolean/select/number, options?, expectedValue?, explanationAr/En }` |
| `requiredDocsList[]` | — | `{ code, titleAr, titleEn, mandatory }` |
| `formSections[]` | — | `{ id?, titleAr, titleEn, descriptionAr/En?, fields[] }` — الحقل `{ id, labelAr/En, type, required?, options?, condition?, min?, max? }` |
| `impactMetrics` | — | `{ targetFactories?, benefitedFactories?, targetCapacityMW?, savedEnergyGWh?, investmentStimulatedEGP?, jobsCreated? }` |
| `objectives[]` / `eligibilityRequirements[]` / `selectionCriteria[]` | — | `array` من `{ textAr, textEn }` — المستهدفات / اشتراطات التأهيل / معايير الاختيار |
| `financialTerms` | — | `object`: `{ financingType?: bank_loans/grants/subsidy/mixed, currency?: EGP/USD, maxDurationYears?, maxFinancingPerClientEGP?, maxFinancingPerGroupEGP?, beneficiariesAr/En?, purposeAr/En?, notesAr/En? }` — الأرقام `>= 0` |
| `executionNotesAr` / `executionNotesEn` | — | نص حر — ملاحظات مسار التنفيذ |

> `kpis` (مؤشرات قياس الأداء) **ليست** ضمن هذا الطلب ولا ترجع في `GET /initiatives` العام — لها راوت أدمن مخصص (`§11b`).

Req:

```json
{ "titleAr": "مبادرة جديدة", "titleEn": "New Initiative", "status": "draft", "budgetTotalEGP": 1000000, "targetSectors": ["أغذية"], "benefits": [], "faqs": [], "formSections": [], "impactMetrics": {} }
```

Res `201`: `{ "message": "تم إنشاء المبادرة", "status": "ok", "data": { "id": "init-1715..." } }`.
Error `400 VALIDATION_ERROR` (`title<3` أو `slug` مكرر أو `array` خاطئ)، `403 FORBIDDEN` لغير `ministry_admin / initiative_manager`.

## 7) `PUT /api/v1/initiatives/:id` — تعديل (ministry_admin / initiative_manager)

```
PUT /api/v1/initiatives/init-solar-1
Req  UpdateInitiativeReq = Partial<UpsertInitiativeReq>  (كل الحقول اختيارية)
Res  { message: "تم حفظ المبادرة", status, data: { id } }  (200)
```

التعديل يقبل أي subset — مثال: `{ "titleAr": "اسم جديد", "budgetTotalEGP": 600000000, "faqs": [...] }`.
`customization` و `workflow` لهما راوتس مخصصة (`§8-11`) ولا يدمجان هنا.

**منع الكتابة فوق نسخة أحدث:** أرسل `expectedUpdatedAt` = قيمة `updatedAt` التي فتحت عليها. لو تغيرت المبادرة بعدها يرد `409 CONFLICT` (`messageAr`: «تم تعديل هذه المبادرة من مكان آخر…») ولا يُحفظ شيء — أعد التحميل ثم أعد التعديل.

## 7a) `POST /api/v1/initiatives/:id/duplicate` — نسخ مبادرة (ministry_admin / initiative_manager)

```
POST /api/v1/initiatives/init-solar-1/duplicate
Res  { message: "تم نسخ المبادرة كمسودة", status, data: { id } }  (201)
```

نسخة كاملة بكل الأعمدة (البيانات + `customization` + `workflow` + `kpis`) بحالة `draft`، والعنوان «نسخة من …» / `Copy of …`، و `slug` فريد بلاحقة `-copy`. Error `403`, `404`.

## 7b) `DELETE /api/v1/initiatives/:id` — حذف (ministry_admin فقط)

```
DELETE /api/v1/initiatives/init-123
Res { message: "تم حذف المبادرة", status, data: { id } }  (200)
```

Error `403 FORBIDDEN` لغير `ministry_admin`، `400 HAS_APPLICATIONS` إن وجدت طلبات مرتبطة، `404 NOT_FOUND`.

## 8) `GET /api/v1/initiatives/:id/customization` — التخصيص

```
GET /api/v1/initiatives/:id/customization
Res { message, status, data: CustomizationShape }
```

`CustomizationShape`:

| حقل | النوع | افتراضي | وظيفته |
|---|---|---|---|
| `showBenefits/showFaqs/showImpactMetrics/showTimeline/showPartners/enablePreEligibility` | `boolean` | `true` | إظهار أقسام صفحة العرض |
| `allowFactoryFileUpload` | `boolean` | `true` | السماح برفع ملف التفاصيل |
| `requireDetailsFile` | `boolean` | `false` | إجبار `PDF` عند التقديم |
| `maxFileSizeMB` | `number` | `15` | `1..100` |
| `allowedFileTypes` | `string` | `".pdf"` | امتدادات مقبولة |
| `customWelcomeMessageAr/En` | `string?` | `""` | رسالة التقديم |
| `accentColor` | `string?` | `""` | لون الشارات فقط |

## 9) `PUT /api/v1/initiatives/:id/customization` — تحديث التخصيص

```
PUT /api/v1/initiatives/:id/customization
Req  { showBenefits?, requireDetailsFile?, maxFileSizeMB?, allowedFileTypes?, ... }  (كلها اختيارية — Partial)
Res  { message, status, data: CustomizationShape }
```

Req مثال:

```json
{ "requireDetailsFile": true, "maxFileSizeMB": 15, "allowedFileTypes": ".pdf" }
```

تحقق: `maxFileSizeMB` بين `1..100` وإلا `400 VALIDATION_ERROR`.

## 10) `GET /api/v1/initiatives/:id/workflow` — موتور المراحل

```
GET /api/v1/initiatives/:id/workflow
Res { message, status, data: { version, stages: WorkflowStageShape[] } }
```

`WorkflowStageShape`: `{ id, order, code*, nameAr*, nameEn*, assignedOrgId*, slaDays* (>=1), canReject, canRequestRework }` — `code` فريد داخل المبادرة.

## 11) `PUT /api/v1/initiatives/:id/workflow` — تحديث المراحل

```
PUT /api/v1/initiatives/:id/workflow
Req  { stages: WorkflowStageShape[] }   (مرتبة حسب order، >= 1)
Res  { message, status, data: { version } }
```

`version` يزيد `+1` مع كل حفظ (يستخدمه الفرونت لكشف التعارض لاحقا).

## 11b) `GET|PUT /api/v1/initiatives/:id/kpis` — مؤشرات قياس الأداء (ministry_admin / initiative_manager فقط)

```
GET /api/v1/initiatives/:id/kpis
Res { message, status, data: KpiShape[] }

PUT /api/v1/initiatives/:id/kpis
Req { kpis: KpiShape[] }   (استبدال كامل)
Res { message: "تم حفظ مؤشرات الأداء", status, data: { id, count } }
```

`KpiShape`: `{ id, nameAr*, nameEn, unit: count/MW/MWh/EGP/tCO2/toe/percent/days, targetValue?, currentValue? }` — القيم `>= 0`.
للأدمن فقط: لا تظهر في صفحة المبادرة ولا في `GET /initiatives` العام. Error `403 FORBIDDEN` لغير الأدوار المسموحة، `400 VALIDATION_ERROR` (اسم ناقص/وحدة غير معروفة/قيمة سالبة)، `404 NOT_FOUND`.

## 11c) `POST /api/v1/audit-logs/export` — تسجيل تصدير (ministry_admin / initiative_manager / auditor)

```
POST /api/v1/audit-logs/export
Req  { summaryAr: string }   (1..300 حرف)
Res  { message: "تم تسجيل التصدير", status, data: { ok: true } }  (201)
```

ملفات Excel تُولَّد في المتصفح فلا تمر بالباك — هذا الراوت يوثقها في سجل التدقيق (`actionType: export`).

## 12) `GET /api/v1/factories/:id` — الملف الموحد للمصنع

```
GET /api/v1/factories/factory-1
Res { message, status, data: FactoryProfile }  (الشكل الكامل = src/types FactoryProfile)
```

## 13) `PUT /api/v1/factories/:id` — تحديث الملف الموحد

```
PUT /api/v1/factories/:id
Req  { nameAr?, nameEn?, commercialRegistrationNumber?, industrialRegistrationNumber?, taxIdNumber?, sector?, governorate?, industrialZone?, roofAreaSqMeters?, annualEnergyConsumptionMWh?, monthlyElectricityBillEGP?, employeesCount? }
Res  { message, status, data: { id } }
```

كل الحقول اختيارية — الباك يتحقق من الأرقام `>= 0` فقط.

## 14) `GET /api/v1/factories/:id/details-files?initiativeId=` — ملفات التفاصيل PDF

```
GET /api/v1/factories/factory-1/details-files?initiativeId=init-solar-1
Res { message, status, data: DetailsFileShape[] }
```

`DetailsFileShape`: `{ id, fileName (*.pdf), fileSize ("2.1 MB"), description, initiativeId?, applicationId?, uploadedAt (ISO), status (pending/verified/rejected) }`.

## 15) `POST /api/v1/factories/:id/details-files` — رفع PDF (multipart)

```
POST /api/v1/factories/:id/details-files
Content-Type: multipart/form-data
Fields { file* (PDF), description?, initiativeId?, applicationId? }
Res  { message, status, data: DetailsFileShape }  (201)
```

تحقق الباك: الامتداد `PDF` فقط → وإلا `400 INVALID_FILE_TYPE`، الحجم `<= maxFileSizeMB` للمبادرة (أو `15` افتراضي) → وإلا `400 FILE_TOO_LARGE`.

## 16) `DELETE /api/v1/factories/:id/details-files/:fileId` — حذف ملف

```
DELETE /api/v1/factories/factory-1/details-files/fdet-123
Res { message: "تم حذف الملف", status: "ok" }
```

## 17) `GET /api/v1/applications?initiativeId=&status=&orgId=&q=&page=&pageSize=` — قائمة الطلبات

```
GET /api/v1/applications?initiativeId=init-solar-1&status=under_review&orgId=org-ida&q=SOL&page=1&pageSize=10
Res Paginated<ApplicationListItem>
```

`ApplicationListItem`: `{ id, applicationNumber (EGY-SOL-2026-0001), initiativeId, initiativeTitleAr, factoryId, factoryNameAr, factorySectorAr, factoryGovernorateAr, currentStageId, currentStageNameAr, status, currentAssignedOrgId, currentAssignedOrgNameAr, slaDays, detailsPdfCount, submittedAt }`.

## 18) `POST /api/v1/applications` — تقديم طلب

```
POST /api/v1/applications
Req  { initiativeId*, factoryId*, formData*, detailsFileId? }
Res  { message, status, data: { id, applicationNumber } }  (201)
```

| حقل | مطلوب | تحقق الباك |
|---|---|---|
| `initiativeId` | ✅ | المبادرة موجودة وحالتها `active` |
| `factoryId` | ✅ | المصنع موجود |
| `formData` | ✅ | مفاتيح حسب `formSections` للمبادرة |
| `detailsFileId` | — | إن كانت `requireDetailsFile=true` للمبادرة فهو إجباري + يجب أن يكون `PDF` مرفوعا لنفس المصنع |

Req:

```json
{ "initiativeId": "init-solar-1", "factoryId": "factory-1", "formData": { "requestedCapacityKW": 500, "financingAmountEGP": 2000000 }, "detailsFileId": "fdet-123" }
```

Res `201`: `{ "message": "تم تقديم الطلب بنجاح", "status": "ok", "data": { "id": "app-...", "applicationNumber": "EGY-SOL-2026-0042" } }`.

## 19) `GET /api/v1/applications/:id` — تفاصيل طلب (formData + documents + timeline)

```
GET /api/v1/applications/app-123
Res { message, status, data: Application }  (الشكل الكامل = src/types Application)
```

يستخدمه مودال المراجعة + زر `طباعة / PDF للطلب`.

## 20) `POST /api/v1/applications/:id/decisions` — قرار المراجع

```
POST /api/v1/applications/:id/decisions
Req  { action*, comments?, documentIdToVerify? }
Res  { message, status, data: { newStatus, newStageId } }
```

| حقل | مطلوب | تحقق |
|---|---|---|
| `action` | ✅ | `approve / request_rework / reject / escalate` |
| `comments` | شرطي | إجباري عند `request_rework` و `reject` و `escalate` وإلا `400 COMMENTS_REQUIRED` |
| `documentIdToVerify` | — | إن وجد يعلم المستند `verified` |

صلاحية (حوكمة المسار):
- كل مسار يبدأ بمرحلة ثابتة «المراجعة الأولية — الوزارة» (`stage-intake`). يقرر فيها `ministry_admin` و `initiative_manager` فقط.
- كل مرحلة بعدها يقرر فيها **الجهة المسندة لها فقط**. الدور لازم يكون مراجعاً: `ida_reviewer` أو `imc_reviewer` أو `bank_reviewer` أو `solar_provider`. غير كده الرد `403 NOT_ASSIGNED`.
- الإدارة في المراحل اللاحقة **متابعة فقط**، ونفس الـ 403 برسالة «المتابعة فقط».
- المدقق والمصنع لا يقررون أبداً.
- الطلب المكتمل أو المرفوض يرد `409 APPLICATION_CLOSED`.
- الإجراء اللي المرحلة مش بتسمح بيه يرد `400 ACTION_NOT_ALLOWED`. ده بيشمل `canReject` و `canRequestRework`، والتصعيد في مرحلة الوزارة.
- `escalate` تنبيه للإدارة: الطلب يبقى لدى الجهة وحالته لا تتغير، ويظهر `isEscalated=true`.
- التعليق إجباري للرفض والاستيفاء والتصعيد.
- كل طلب في القائمة والتفاصيل بيرجع معاه:
  - `stageTrack[]`: لكل مرحلة الحالة، ومن قرر، ومتى، والتعليق، والأيام مقابل الـ SLA.
  - `viewerCanDecide` و `allowedActions` للمستخدم الحالي.
- الجهة ترى الطلبات المسندة لها الآن، وأيضاً ما شاركت فيه سابقاً للاطلاع فقط.
- **إخطار المنشأة بالبريد:**
  - بعد كل قرار (اعتماد، أو استيفاء، أو رفض، أو اعتماد نهائي) يُسجَّل بريد رسمي للمنشأة في `email_outbox` ويُرسل في الخلفية. البريد بيحتوي `comments` زي ما اتكتبت.
  - `escalate` داخلي، ومبيتبعتش بسببه بريد.
  - تقديم الطلب نفسه (`POST /applications`) بيبعت كمان بريد «تم استلام طلبكم».

انتقالات `approve`: إن لم تكن المرحلة الأخيرة → `newStatus=in_progress` والمرحلة التالية، وإلا `newStatus=completed`. `request_rework` → `pending_documents`. `reject` → `rejected`.

## 21) `GET /api/v1/dashboard/summary` — مؤشرات تنفيذية

```
GET /api/v1/dashboard/summary
Res { message, status, data: { totalApps, approvedApps, inReviewApps, reworkApps, slaCompliance } }
```

Res:

```json
{ "message": "ok", "status": "ok", "data": { "totalApps": 42, "approvedApps": 10, "inReviewApps": 20, "reworkApps": 5, "slaCompliance": 87 } }
```

## 22) `GET /api/v1/reports/applications.csv?...` + `GET /api/v1/reports/initiatives.csv` — التقارير

نفس فلاتر القائمة كـ `query`. الرد ملف `CSV` (`Content-Type: text/csv`) بنفس أعمدة `src/utils/reports.ts` (`APPLICATIONS_REPORT_HEADERS / INITIATIVES_REPORT_HEADERS`) + عمود `detailsPdfCount`.

## 23) `GET /api/v1/audit-logs?page=&pageSize=` — سجل التدقيق

```
GET /api/v1/audit-logs?page=1&pageSize=20
Res Paginated<AuditShape>   { id, timestamp, userName, actionType, entityType, entityId, summaryAr }
```

---

## 24) `GET /api/v1/organizations?q=&type=&page=&pageSize=` — قائمة الجهات

```
GET /api/v1/organizations?q=IDA&type=authority&page=1&pageSize=20
Req  { q?, type?, page?, pageSize? }
Res  Paginated<OrganizationShape>
```

| باراميتر | النوع | ملاحظة |
|---|---|---|
| `q` | `string` | بحث في `nameAr/nameEn/code` |
| `type` | `string` | `ministry/authority/center/bank/utility/provider/factory` أو `ALL` |

`OrganizationShape`: `{ id, code (فريد بالأحرف الكبيرة), nameAr, nameEn, type, active, contactEmail }`.

## 25) `POST /api/v1/organizations` — إنشاء جهة (ministry_admin / initiative_manager)

```
POST /api/v1/organizations
Req  { code*, nameAr*, nameEn*, type*, contactEmail? }
Res  { message, status, data: { id } }   (201)
```

Req:

```json
{ "code": "IDA", "nameAr": "هيئة التنمية الصناعية", "nameEn": "IDA", "type": "authority", "contactEmail": "info@ida.gov.eg" }
```

تحقق: `code` فريد (`400 VALIDATION_ERROR` عند التكرار)، `type` ضمن الأنواع السبعة. Error `403 FORBIDDEN` لغير `ministry_admin / initiative_manager`.

## 26) `PUT /api/v1/organizations/:id` — تعديل جهة (إيقاف/تفعيل)

```
PUT /api/v1/organizations/org-ida
Req  { code?, nameAr?, nameEn?, type?, active?, contactEmail? }
Res  { message: "تم حفظ الجهة", status, data: { id } }
```

مثال الإيقاف: `{ "active": false }` — بعدها يرفض `POST /users` لنفس الجهة بـ `400`.

## 27) `GET /api/v1/users?organizationId=&role=&q=&page=&pageSize=` — قائمة الحسابات

```
GET /api/v1/users?organizationId=org-ida&role=ida_reviewer&q=أحمد&page=1&pageSize=20
Res  Paginated<UserShape>
```

`UserShape`: `{ id, name, nameEn, email, role (الأدوار الثمانية), organizationId }`.

## 28) `POST /api/v1/users` — إنشاء حساب لجهة (ministry_admin / initiative_manager)

```
POST /api/v1/users
Req  { name*, nameEn*, email*, role*, organizationId* }
Res  { message: "تم إنشاء الحساب", status, data: { id } }   (201)
```

Req:

```json
{ "name": "أحمد المراجع", "nameEn": "Ahmed Reviewer", "email": "ahmed@ida.gov.eg", "role": "ida_reviewer", "organizationId": "org-ida" }
```

تحقق: `email` فريد (`400`)، الجهة موجودة (`404`) ونشطة (`400` عند `active=false`)، `role` ضمن الأدوار الثمانية. Error `403` لغير الأدمن.

---

## 29) مركز المراسلات `/api/v1/chat/*` — محادثات ثنائية بين أي جهتين (5c)

**الأطراف:**
- **أي جهة نشطة نوعها ≠ `factory`** تقدر تراسل أي جهة تانية مباشرة. كل جهتين ليهم محادثة واحدة، زي واتساب.
- **الوزارة جهة زي غيرها:** بيتكلم باسمها `ministry_admin` و `initiative_manager`، والمراجعون بيتكلموا باسم جهاتهم.
- **`auditor`:** اطلاع فقط (`canSend=false`). الإرسال بيرجع `403 READ_ONLY`، ومش بيستهلك غير المقروء بتاع جهته.
- **`factory_owner`:** `403` على كل المسارات.
- **الاطلاع:** الإدارة والمدقق (`canOversee`) يقدروا يقروا المحادثات بين الجهات التانية مع بعضها، من غير ما يشاركوا فيها.

**التنظيم:**
- الزوج مخزّن مرتّب (`orgA < orgB`) وفريد.
- حالة القراءة وتذكير البريد متسجلين لكل طرف.
- `:orgId` في المسارات = **الجهة الأخرى** من منظور المستخدم الحالي.

```
GET  /api/v1/chat/conversations
Res  { orgId (جهتي), canSend, canOversee, data: ChatConversationSummary[] }   (دليل كل الجهات — غير المقروء أولاً ثم الأحدث)

GET  /api/v1/chat/unread
Res  { total, items[≤10] }                              (للجرس — poll كل ~20 ثانية؛ orgId = الجهة الأخرى)

GET  /api/v1/chat/conversations/:orgId/messages?before=<msgId>&after=<msgId>&limit=30
Res  { data: ChatMessageShape[] (تصاعدي), hasMore, myLastReadAt, peerLastReadAt }

POST /api/v1/chat/conversations/:orgId/messages       multipart: body + files[] (≤5)  أو JSON { body }
Res  { message: "تم إرسال الرسالة", status, data: ChatMessageShape }   (201)

POST /api/v1/chat/conversations/:orgId/read
Res  { message, status, data: { myLastReadAt, peerLastReadAt } }

GET  /api/v1/chat/oversight                            (canOversee فقط)
Res  { data: ChatOversightItem[] }                     (محادثات بين جهات أخرى — الأحدث أولاً)

GET  /api/v1/chat/oversight/:conversationId/messages   (canOversee فقط — قراءة)
Res  { data, hasMore, orgA, orgB, readA, readB }

GET  /api/v1/chat/attachments/:id[?inline=1]           ملف لطرفي المحادثة أو canOversee + Content-Disposition (UTF-8) + nosniff
```

**التحقق:**
- `body` لا يتجاوز 4000 حرف، ولازم يوجد نص أو ملف واحد على الأقل (`400`).
- مراسلة جهتك نفسها تعطي `400`. الجهة غير الموجودة أو غير النشطة أو من نوع `factory` تعطي `404`.
- الملفات المسموحة: `pdf png jpg jpeg webp docx xlsx pptx doc xls txt csv`. كل ملف يُفحص بالـ magic-bytes وإلا `400 INVALID_FILE_TYPE`.
- حجم الملف لا يتجاوز `CHAT_MAX_FILE_MB` (الافتراضي 20)، وإلا `400 FILE_TOO_LARGE`.
- حد الإرسال 30 رسالة في الدقيقة (`429`).

**تذكير البريد (Gmail):**
- **لكل جهة مستلمة، والوزارة من ضمنها:** لو فيه رسايل واردة فضلت غير مقروءة لمدة `CHAT_REMINDER_DELAY_MIN` (الافتراضي 15 دقيقة)، بيتبعت **بريد واحد** لـ `contactEmail` الجهة ولحسابات أعضائها. البريد ده بيجمع كل الجهات اللي مستنية الرد.
- لا يُرسل بريد آخر لنفس المحادثة حتى تقرأها الجهة.
- البريد **لا يحتوي** نص الرسائل، فقط عددها ومصدرها ورابط `APP_URL/#chat`.
- الإعداد موضح في `docs/DEPLOY.md`.

**الترحيل:**
- المحادثات القديمة «مسؤولون ↔ جهة» اتحولت تلقائي وقت الإقلاع لأزواج «الوزارة ↔ الجهة» من غير فقد، في `ensureMigrated` → `migrateChatToPairs`.
- مؤشرات القراءة وحالة التذكير اتنقلت لطرفها الصح.

---

## كيف يختبر كل فريق؟

```bash
# صحة الباك
curl http://localhost:4000/api/v1/health

# دخول (يخزن التوكن)
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tarek.mansour@industry.gov.eg","password":"Egypt@2026"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.accessToken))")

# قائمة الطلبات
curl "http://localhost:4000/api/v1/applications?status=under_review&page=1&pageSize=10" -H "Authorization: Bearer $TOKEN"

# قرار مراجع
curl -X POST http://localhost:4000/api/v1/applications/app-1/decisions \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"action":"approve","comments":"مستوفى"}'
```
