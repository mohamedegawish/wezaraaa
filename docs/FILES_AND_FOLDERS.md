# خريطة الملفات والفولدرات — شرح عام لكل شيء

> المصدر الوحيد للحقيقة التقنية: `contracts/api.contracts.ts`. هذا الملف خريطة قراءة فقط.
> آخر تحديث: 2026-09-25. التشغيل: `RUN_BACKEND.bat` ثم `RUN.bat` (فرونت `:3000` ← باك `:4000`).

## الشجرة العليا

| المسار | النوع | الشرح |
|---|---|---|
| `RUN.bat` / `RUN_BACKEND.bat` | تشغيل | نقرة واحدة: الفرونت (Vite) والباك (tsx). يثبتان الحزم تلقائياً أول مرة |
| `frontend/` | تطبيق | React 18 + Vite 6 + TS. كل البيانات من الباك عبر `src/api/` فقط — ممنوع `fetch` في المكونات |
| `backend/` | خادم | Express 4 + TS + SQLite (`node:sqlite`). كل المسارات تحت `/api/v1` برد موحد `{message,status,data}` أو `ApiError` |
| `contracts/` | العقد | `api.contracts.ts` (الأنواع + `ROUTES`) + `openapi.json` (30+ مساراً). أي تغيير يبدأ هنا |
| `docs/` | توثيق | الأدلة: هذا الملف + `CREDENTIALS_AND_SEED_DATA.md` + `API_CONTRACTS.md` + الهوية + خطط النشر |
| `seed-data.json` | بذرة محمولة | نسخة JSON من البذرة للعرض/الاختبار (`seed:file`) |
| `docker-compose.yml` | نشر | `api + frontend + nginx` للإنتاج (TLS عبر certbot) |
| `DEPLOY.md` / `PRODUCTION_FIX_PLAN.md` (داخل `docs/`) | نشر | خطوات VPS وسجل مراحل الإنتاج |

## الفرونت `frontend/src/`

| المسار | الشرح |
|---|---|
| `App.tsx` | الموجّه: `home / initiatives / initiative-detail / my-initiatives / factory-portal / compare / impact / login / admin-*` + بوابة صلاحيات + فوتر + `<ChatWidget/>` |
| `main.tsx` | الدخول: `StrictMode + ErrorBoundary + globals.css` |
| `api/client.ts` | عميل `fetch` الوحيد: JWT بالذاكرة + refresh بكوكي httpOnly + `resolveCoverUrl` |
| `api/endpoints.ts` | دوال الراوتس (`api.*`) + `fetchAllPages` لتجاوز سقف 100 صف |
| `api/schemas.ts` | يعيد تصدير `contracts/api.contracts.ts` (صفر ازدواج) |
| `store/state.ts` | المخزن (Singleton): الجلسة/اللغة/الملاحة بالهاش + `selectedInitiativeId` يثبت بعد التحديث (sessionStorage) |
| `types/index.ts` | الأنواع + `ROLE_PERMISSIONS` (8 أدوار) + `DEFAULT_CUSTOMIZATION` |
| `utils/reports.ts` | تقارير CSV/Excel/طباعة + `escapeHtml` |
| `utils/theme.ts` | ألوان المراحل والدرجات (المصدر الوحيد للألوان في TS) |
| `components/showcase/` | العامة: `HomeView` (تعريفية) + `HomeHero` + `InitiativesView` (كتالوج، شمس الصناعة مثبّتة أولاً) + `InitiativeDetailPage` (صفحة منفصلة بـ3 layouts و8 مقاطع) + `HeroSlider` (قديم) + `CompareView` + `ImpactView` + `InitiativeLandingModal` + `PreEligibilityModal` |
| `components/factory/` | المصانع: `FactoryApplicationsView` (المعالج + deep-link من مبادراتي) + `MyInitiativesView` (آخر مسجلة تلقائياً + عرض حالتي + تحديث تلقائي كل دقيقة) + `DynamicApplicationWizard` (التقديم متعدد الخطوات) + `FactoryProfileView` + `InteractiveTimeline` |
| `components/admin/` | الإدارة: `AdminLayout` (+`AdminPageHeader` الموحد) + `AdminSidebar` (4 مجموعات) + `AdminDashboardView` + `MinistryOverviewView` (داشبورد مشاهدة للوزارة: قراءة فقط) + `AdminStatsView` + `ApplicationsTableView` + `ApplicationReviewModal` (فيه تبويب مراسلات الجهات) + `EditInitiativeModal` (تبويب التخصيص + قسم Page design + حفظ لاصق) + `VisualWorkflowEditor` + `FormSchemaBuilder` + `OrganizationsView` + `AuditLogsView` + `ReportsStudioView` + `HeroSlidesManager` |
| `components/auth/` | `LoginView` + `ChangePasswordModal` (إجباري عند `mustChangePassword`) |
| `components/common/` | `ToastSystem` + `ErrorBoundary` + `EgyptianEagle` + `GlobalSearch` (Ctrl+K) + `SkeletonLoader` + `MessagesPanel` (مراسلات الجهات: مستلم/موضوع/حقول مخصصة/PDF) |
| `components/layout/` | `HeaderNavbar` (الرئيسية/المبادرات/مبادراتي/المقارنة/المصانع/الإدارة/نظرة الوزارة) |
| `components/ui/` | `Card/Badge/Modal/EngBadge/EngDataTable/EngStageNode/EngSLATimer/DegreeColorPicker/ImageUpload/ErrorBox` |
| `components/chatbot/` | `ChatWidget.tsx` (زر عائم + ملء شاشة + اقتراحات لايف محلية + عزل سكرول) |
| `src/chatbot/` | **مجلد الشات المخصص**: `knowledge/` (20 سؤالاً + خريطة الموقع + مرادفات) + `contract.ts` (3 استعلامات فقط) + `safeQueries.ts` (بلا DB مباشر) + `engine.ts` (تطبيع/IDF/عتبة 8) + `engine.test.ts` (22) + `SECURITY.md` |
| `styles/` | `visual-tokens.css` (التوكنز) + `globals.css` (يستوردها + `_dccp.css`) + `theme.css` |

## الباك `backend/src/`

| المسار | الشرح |
|---|---|
| `index.ts` | الإقلاع: seed-on-boot + إغلاق نظيف |
| `app.ts` | helmet/CORS/rate-limits الخمسة + ترتيب الراوترات + `/openapi.json` العلني + معالج أخطاء موحد |
| `config.ts` | الإعدادات من البيئة (انظر جدول `.env` في ملف البيانات) |
| `middleware/auth.ts` | Bearer JWT أولاً ثم `x-user-id` للديمو فقط |
| `middleware/requireRole.ts` | `requireRole(...` + `ADMIN_ROLES` + `AUDIT_ROLES` |
| `middleware/error.ts` | `okMessage/apiError` (غلاف الرد الموحد) |
| `auth/jwt.ts` | توقيع/تحقق access+refresh + bcrypt + `isStrongPassword` |
| `db/sqlite.ts` | الاتصال (WAL) + `ensureMigrated` + `closeDb` |
| `db/schema.sql` | 10 جداول: السابقة + `messages` (مراسلات الجهات) |
| `db/seed.ts` | البذرة: 8 جهات + 9 مستخدمين + مصانع + مبادرات (شمس الصناعة كاملة من الوثيقة: 11 مستنداً/8 مراحل/12.5 مليار) + `customization.page` |
| `store/*.ts` | طبقة SQL: users/organizations/initiatives/factories/applications/audit/refreshTokens/messages |
| `routes/` | `health/auth/users/initiatives/factories/applications/system/messages` — thin + تحقق كامل + عزل ملكية (المالك مصنعه، المراجع جهته) |
| `tests/` | 16 حزمة (`helpers.ts` يعزل DB مؤقتة لكل ملف): auth/initiatives/applications/security/security-p0/contracts/hosting/seed-file/page-layout/shams-data/messages/authz-ownership/frontend/audit/factory-register/health |
| `scripts/` | `backup/restore` (ذرّي) + `check-prod` (27 فحصاً) + `copy-schema` + `seed-from-file` + `prune-files` |

## مسارات `/api/v1` (44)

عام: `health, openapi.json, factories/register, initiatives×2` · مصادقة (6): `login/refresh/logout/verify-email/resend-verification/change-password` · مستخدمون/جهات (9) · مبادرات (7 + customization + workflow) · مصانع (7 + ملفات PDF) · طلبات (4 + decisions) · مراسلات (2): `GET/POST applications/:id/messages` · نظام (4): `dashboard/summary, reports×2, audit-logs`.

## الصفحات (views) والأدوار (8)

`home/showcase(alias)/initiatives/initiative-detail/compare` عامة · `my-initiatives/factory-portal` مسجلة · `admin-*` (dashboard/stats/applications/workflow-builder/organizations/audit-logs/reports) + `ministry-overview` (وزارة/مدير/مدقق، مشاهدة فقط) · `impact` سيادية للأدمن. الأدوار: `ministry_admin, initiative_manager, ida_reviewer, imc_reviewer, bank_reviewer, solar_provider, factory_owner, auditor`.
