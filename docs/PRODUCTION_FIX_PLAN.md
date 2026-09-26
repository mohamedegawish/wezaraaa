# خطة التحويل لبروداكشن — INDUSTRIAL_INITIATIVES (تنفيذ فعلي + اختبارات حقيقية)

> تاريخ البدء: 2026-09-13 | المنهج: اصلاح قوي لا يفوت اي شيء + اختبار حقيقي لكل اصلاح
> القاعدة: لا PR بدون اختبار اخضر. لا اطلاق بدون اغلاق Blockers.
> الحالة: المراحل 0-4 منجزة + 75/75 اختبار اخضر. الباقي: Postgres/S3 + Sentry + Nginx/TLS.

## التشخيص (من 3 وكلاء فحص متوازيين)

- بروتوتايب ديمو ناضج بصريا، غير صالح للاطلاق: `npm start` مكسور + auth وهمي + CORS مفتوح + SQLite محلي + صفر tests + صفر Docker/CI
- التقييم قبل الاصلاح: Build 3/10، Env 2/10، Tests 0/10، Security 2/10، Data 2/10
- التقييم بعد الاصلاح: Build 9/10، Env 8/10، Tests 9/10، Security 8/10، Data 7/10

## مراحل التنفيذ (كل مرحلة تنتهي باختبار حقيقي)

### المرحلة 0 — تثبيت الاقلاع [S] — DONE + مختبر
- [x] 0.1 نسخ `schema.sql` لـ `dist` عبر `scripts/copy-schema.mjs` + اصلاح `sqlite.ts` candidates
- [x] 0.2 تجميد `seedIfEmpty` في prod عبر `SEED_ON_BOOT` + `ALLOW_DEMO_AUTH` + backfill كلمات المرور للقواعد القديمة
- [x] 0.3 `newId()` بـ `crypto.randomUUID` في كل stores + routes
- [x] 0.4 ازالة `storedPath` من كل الردود (public/internal + SELECT آمنة)
- [x] 0.5 `CORS_ORIGIN` localhost فقط + رفض `*` و `JWT_SECRET` الضعيف في prod + `request-id`
- [x] 0.6 `health` يفحص DB/قرص مع 503 عند التدهور

### المرحلة 1 — الامان والهوية [M/L] — DONE + مختبر (10 اختبارات JWT)
- [x] 1.1 `requireRole` + حماية `dashboard/reports/audit` + `GET /users`
- [x] 1.2 `FACTORY_EDITABLE` whitelist ضد mass-assignment
- [x] 1.3 `NOT_ASSIGNED` + `isPrivileged` + `decisionLimiter` و `authLimiter` ضد brute-force/spam
- [x] 1.4 JWT حقيقي: `bcryptjs` + `access 15m` + `refresh 7d` + httpOnly cookie + rotation + revoke + `POST /auth/login|refresh|logout|change-password` (كلمة 8+ + تحقق الحالية)
- [x] 1.5 `switch-user` ديمو فقط + `POST /users` بكلمة مؤقتة مشفرة + `mustChangePassword` + `PUT/DELETE /users/:id`
- [x] 1.6 `openapi.json` مكتمل 21 path + `GET /openapi.json` علني + `workflow` validation صارم (org-exists/sla/code-unique)

### المرحلة 2 — موتور القرارات والملفات [M] — DONE + مختبر
- [x] 2.1 `applyDecision` يتقدم عبر stages او completed + `escalate` للوزارة + `documentIdToVerify` + timeline from/to
- [x] 2.2 ترقية `multer 1.x -> 2.x` DONE + magic-bytes `%PDF-` + fileFilter + filename uuid
- [x] 2.3 `slaCompliance` محسوب + CSV بالفلاتر الكاملة cap 5000
- [x] 2.4 `audit_logs` append-only على مستوى القاعدة (triggers تمنع UPDATE/DELETE) + اعمدة `userId/ip/beforeJson/afterJson` + `reset` يرفض في prod

### المرحلة 3 — DevOps + فرونت انتاجي [M] — DONE
- [x] 3.1 `Dockerfile` multi-stage + `.dockerignore` + `docker-compose` (healthcheck + volume) + CI (backend build+test + frontend build)
- [x] 3.2 `.env.example` مشدد (CORS + SEED + DEMO + JWT_* + BCRYPT) + `VITE_API_URL` guard + فرونت `Bearer` اولا ثم `x-user-id` + `api.login/logout` تخزن tokens
- [x] 3.3 فرونت: `ErrorBoundary` + ازالة `console.table` + `escapeHtml` + `PersonaSwitcher` DEV فقط
- [x] 3.4 `scripts/backup.mjs` + `scripts/restore.mjs` (يرفض prod بدون CONFIRM=YES) + `npm run backup/restore` + اختبار نسخ حقيقي

### المرحلة 4 — اختبارات حقيقية — DONE 75/75
- [x] 4.1 Backend `tsx --test`: 58 (health 3 + initiatives 10 + applications 8 + security 8 + contracts 2 + auth 10 + audit 4 + frontend 6 + hosting 7 + seed-file 3 + register 5 + no-static-data 6 + public-reads 1)
- [x] 4.2 Contracts: openapi valid + ROUTES حاضرة + `/openapi.json` live 200
- [x] 4.3 Build: backend `tsc + copy-schema` + `npm start` smoke + frontend `tsc + vite build` (1630 module)
- [x] 4.4 Frontend guards: static (ErrorBoundary/Bearer/escape/no-table) + live JWT login->me

## نتائج التحقق الاخير (2026-09-13)
- backend `npm run build`: OK + copy-schema
- backend `npm test`: 61 pass / 0 fail
- backend `npm start` smoke: health checks db+uploads ok
- frontend `npm run build`: OK (تحذير chunk xlsx فقط)
- multer: 2.x + JWT: bcryptjs/jsonwebtoken/cookie-parser + triggers audit سليمة
- grep: لا storedPath في الردود + لا Date.now في IDs + لا CORS=* + لا console.table() + لا passwordHash في اي رد

## الباقي للاطلاق الكامل (مرتب بالاولوية)
1. ترحيل SQLite -> Postgres + ملفات -> S3 + روابط موقعة (الواجهات `store/*` جاهزة للتبديل)
2. Sentry + JSON logs + Uptime + نسخ ليلي مجدول (cron) + اختبار استرجاع دوري
3. Nginx + TLS على `api.industry.gov.eg` + Redis rate-limit موزع + `TRUST_PROXY` مدروس
4. `openapi.json` بالـ schemas الكاملة + Swagger UI + Playwright e2e (login/apply/approve بدون Mock)
5. SSO حكومي/NID + subsidy ledger محاسبي + اشعارات بريد/SMS

## Hosting — جاهز للرفع الآن
- check-prod PASS (19 فحص) بوابة إجبارية قبل أي رفع + CI deploy-gate جديد
- prod boot: يرفض JWT الضعيف + يعمل بالقوي + HSTS + بلا x-powered-by + الديمو 403
- compose كامل (api+frontend+nginx) + nginx TLS sample + قوالب env للإنتاج + DEPLOY.md خطوة بخطوة
- SERVE_FRONTEND=1 يخدم SPA من الباك + نسخ/استرجاع + حدود رفع/قرارات/دخول


## Hosting deep-deploy audit (2026-09-13, session 2)
- Root .dockerignore + frontend/.dockerignore added (api image builds from root context, so ROOT .dockerignore is the gate; frontend Dockerfile does COPY . . and must not ship node_modules)
- express-rate-limit v8 verified: NO per-limiter trustProxy option ? default keyGenerator uses req.ip resolved from the app trust proxy setting (app.set('trust proxy', 1) when TRUST_PROXY=1). Comments added in app.ts so nobody adds a nonexistent option.
- New prod test (hosting 7): TRUST_PROXY=1 keys authLimiter by X-Forwarded-For ? 50 logins from one forwarded IP -> 429, different forwarded IP -> 401 ? and demo switch-user stays blocked
- check-prod extended: validates root/frontend/backend .dockerignore (now 19 checks)
- backend: npm run build OK + npm test 61 pass / 0 fail | frontend: npm run build OK | check-prod PASS


## Seed data file (2026-09-13)
- seed-data.json at repo root: portable demo dataset (11 orgs / 13 users / 6 factories / 4 initiatives / 4 demo applications with real decision timelines: completed + submitted + escalated-to-ministry + in-progress-at-bank)
- Base rows dumped from a live seeded DB (byte-exact shapes); passwords NEVER in file (loader re-hashes default Egypt@2026; new factory users mustChangePassword=1)
- Loader: backend/src/db/seedFromFile.ts (INSERT OR IGNORE + seed_demo_v1 idempotency flag) + CLI scripts/seed-from-file.ts (npm run seed:file [--force-apps], refuses prod without CONFIRM=YES)
- Verified: 3 new tests (load + timelines + idempotency + malformed rejection) + real CLI run on fresh DB (created=4, rerun skipped) ? backend 61 pass / 0 fail


## Frontend API-only conversion ? no static data + DB rebuild (2026-09-13, DONE 75/75)
GOAL: single source of truth = backend SQLite (seeder). Zero hardcoded business data in frontend.
PLAN:
- BACKEND: users.factoryId column + migration + seed backfill | public GET /initiatives (list+detail) pre-auth | POST /factories/register (public, rate-limited, returns JWT) + GET /factories/mine | openapi + ROUTES | tests (public reads, register validation, mine, me.factoryId)
- FRONTEND: DELETE store/mockData.ts + api/mockAdapter.ts | endpoints.ts API-only (register/changePassword/listAuditLogs/getMyFactory + fetchAll loop past 100 cap) | client.ts no USE_MOCK (Bearer always) | state.ts rewritten API-driven (allSettled init, api login/register, dead engines + admin-snapshot overlay + hardcoded reset user + fake IP removed) | LoginView/ChangePasswordModal/ShowcaseCatalog(no demo switch)/ReviewModal(files via api)/FactoryViews(factory via api)/AuditLogsView(server data) rewired | remove 8 addAuditLog call sites | .env VITE_API_URL=localhost:4000
- DB: npm run db:reset + npm run seed:file -> 11/13/6/4/4 fresh
- VERIFY: backend build+tests | frontend tsc+vite build | check-prod | live smoke (guest showcase, JWT login, register, mine) | new no-static-data static tests


## Conversion verification (2026-09-13, final)
- BACKEND: users.factoryId + migration (index created post-column, old DBs safe) | public GET /initiatives(+full=1) | POST /factories/register (publicLimiter, JWT auto-login) + GET /factories/mine + GET /factories (audit roles) | openapi 27 paths + ROUTES | tests: register 5, public reads, mine, no-static-data 6
- FOUND+F FIXED live: test isolation (lazy config getters ? tests hit real DB before), schema index-before-migration boot crash, /register double-path 404, ShowcaseCatalog crash on partial API objects (guarded 8 components), search-pill 15px mobile overflow, toast 380px overflow
- FRONTEND: mockData.ts + mockAdapter.ts + PersonaSwitcher DELETED | endpoints/client/state API-only | JWT login + API register + API changePassword(min 8) | demo auto-login removed | files/audit/factory via API | PreEligibilityModal rebuilt with confirm button + mobile layout (verified click flow: disabled -> 2/2 -> 100% eligible -> proceed)
- DB rebuilt fresh: 11 orgs / 13 users / 6 factories / 4 initiatives / 4 demo apps (smoke residue cleaned)
- backend: build OK + 73 pass / 0 fail | frontend: tsc + vite build OK | check-prod PASS (19) | live smoke on dev servers: guest showcase 200, login 200, register 201, mine 200 | mobile 390px: zero console errors, zero horizontal overflow


## Round: mobile-dimensions audit (all views) + hosting lockdown leftovers (2026-09-13, DONE 75/75)
PLAN:
- BROWSER 390px: guest views (showcase/compare/login/landing modal) + factory login (portal/apps/profile/wizard) + admin login (dashboard/apps-table/review modal/audit/impact) ? overflow measured per view (scrollWidth vs innerWidth) + screenshots
- FIX every offender (tables via .table-responsive scroll, stacking, clamp widths) + re-measure to zero
- BACKEND TEST: GET /factories roles (admin 200, factory 403, guest 401)
- DEPLOY.md: seed-data.json first-boot step | check-prod: seed-data.json presence
- VERIFY: 73+ tests green, both builds, check-prod, plan update


## Round verification: mobile audit + lockdown leftovers (2026-09-13, final)
- BROWSER 390px verified: guest (showcase/compare+table/login/landing/eligibility), factory (portal+timeline/profile/wizard), admin (dashboard/apps-table/review+timeline/audit/orgs/impact) ? zero console errors, zero page overflow everywhere
- FOUND+FIXED live: FactoryApplicationsView hooks-order crash | FactoryProfileView documents crash (mock locker section removed) | wizard + review-modal documents rewired to API files | timeline Invalid Date + blank names (backend performer snapshots + ACTION_TITLES + at/timestamp normalization) | factory-split-grid 1173px overflow (stack + min-width:0) | timeline strip scroll container | 11 form-grid-2 stacked on phones | search-pill 15px + toast overflow | silent JWT rotation (mid-session 401 retry + boot restore ? verified live by deleting access token)
- BACKEND: GET /factories (audit roles) + roles test | timeline snapshot fields + test | src/db/seed-file-cli.ts compiled prod seeder (deploy command tested literally in NODE_ENV=production, incl. CONFIRM refusal)
- DEPLOY.md: seed-data.json first-boot step (docker cp + dist runner) | check-prod 21 checks (seed-data.json + compiled CLI)
- backend: build OK + 75 pass / 0 fail | frontend: tsc + vite OK | check-prod PASS (21) | dev DB pristine 11/13/6/4/4

## Phase 1 ? Hardening (2026-09-13, DONE 84/84)
- P0-3 atomic backup: VACUUM INTO + WAL checkpoint (fallback file copy) + integrity_check on restore (verified live: vacuum_into)
- P1-8 CSP: helmet contentSecurityPolicy (default-src self, frame-ancestors none) + P1-9 morgan redaction [REDACTED]
- P1-2/3 password strength (8+ letter+digit) + per-account lockout 5 fails ? 423 15min + frontend hints updated
- P0-2/5/6/P1-1/P1-7 (Phase 0) verified live + P1-1 scoped correctly to /initiatives only (was global)
- New tests: P0-2 spoof, P0-6 orphan, P1-1 limiter, P0-5 escape, P1-8/9 headers, lockout+weak
- backend: build OK + 83 pass / 0 fail | frontend: tsc + vite OK | check-prod PASS (21) | backup/restore verified

## Phase 2 ? Verification & Hardening (2026-09-13, DONE 84/84)
- P0-4 email verification: users.isVerified + token/expires + POST /auth/verify-email + /resend-verification (24h) + login 403 until verified; factory register creates unverified (auto-verified in test), returns verificationToken in dev
- Frontend: register shows verification message + resend button on 403 + auto-verify in dev (token returned) + resend UI
- Nginx: frontend image + proxy hardened (server_tokens off, gzip_vary, X-Frame-Options, X-Content-Type-Options, splitter scope fix for publicReadLimiter)
- Backup: atomic VACUUM INTO + verified restore + backup-cron.sh (prune 14d) + Dockerfile copies scripts to runtime
- Contracts: openapi 30 paths + ROUTES verifyEmail/resendVerification
- backend: 84 pass / 0 fail | frontend: tsc + vite OK | check-prod PASS (21)

## Phase 3 ? Lifecycle & Polish (2026-09-13, DONE 84/84)
- File lifecycle: scripts/prune-files.mjs (dry-run + --delete) + health files check (db:disk) + mime already strict
- Perf: vite manualChunks xlsx + img loading="lazy" decoding="async" (cover + admin)
- Check-prod: 24 checks (prune + backup-cron + nginx SPA + openapi 30)
- Frontend: tsc + vite OK | backend: 84 pass | health ok | nginx hardened (server_tokens off, security headers)


## Phase 4 ? A11y + Data Unification Fixes (2026-09-13, DONE)
GOAL: إغلاق F-1, F-7, F-8, F-11 المتبقية مع اختبار حقيقي لكل إصلاح.

### الفروض المنجزة
- [x] **F-8 Modal.tsx**: `role="dialog"` + `aria-modal="true"` + `useFocusTrap` (Tab/Shift+Tab trapping) + Escape key handler
- [x] **F-7 Organizations modals**: تغليف `<form onSubmit={submitOrg/onSubmit}>` + `required` على inputs الأساسية (`nameAr`, `nameEn`, `email`, `code`, `organizationId`, `role`, `password`) + `type="button"` لأزرار الإغلاق
- [x] **F-11 coverImage unify**: إضافة `resolveCoverUrl(path)` إلى `client.ts` + تصديرها عبر `api/index.ts` + تحديث all consumers:
  - `ShowcaseCatalog.tsx` — img src
  - `HeroSlider.tsx` — slides array + fallback onError
  - `ImpactView.tsx` — stories cover URLs (mock data, prefixed correctly)
  - `EditInitiativeModal.tsx` — preset covers + onClear fallback
  - `HeroSlidesManager.tsx` — PRESET_COVERS + onError fallback
- [x] `resolveCoverUrl` exported from `src/api/index.ts`
- [x] Build: frontend `npm run build` → tsc clean + vite build (6.3s, 1628 modules)
- [x] Backend: `npm test` → 84 pass / 0 fail

### حالة F-1 (القصة الافتتاحية كـ API endpoint)
- **المشكلة**: Frontend calls `GET /api/v1/stories` which doesn't exist in backend
- **القرار**: Bypass — leave mock data in ImpactView (stories are editorial content, not transactional). Added comment + TODO in ImpactView.tsx. Backend would need new stories table + routes if real API desired later.
- **الحالة**: Known limitation, tracked as TODO comment

### التحقق النهائي (2026-09-13)
- frontend: `npm run build` → tsc clean ✓ | vite build 6.3s, 1628 modules ✓
- backend: `npm test` → 84 pass / 0 fail ✓
- F-1, F-7, F-8, F-11: جميعها مغلقة أو مسجلة كـ known limitation مع تعليق TODO

## Phase 5 — Deployment Readiness Gate (2026-09-13, DONE)

### الإصلاحات
- [x] **`.env` JWT_SECRET**: كان فارغاً → تم توليد secret 128-hex-char قوي وكتابته
- [x] **`.env` CORS_ORIGIN**: `http://localhost:3000` → `https://industry.gov.eg,https://www.industry.gov.eg`
- [x] **`.env` VITE_API_URL**: `http://localhost:4000` → `https://api.industry.gov.eg`
- [x] **check-prod --strict**: 27/27 checks PASS (قبل: 2 failures — JWT + VITE_API_URL)

### حالة الرفع النهائية
```bash
# 1. Verify locally
node backend/scripts/check-prod.mjs --strict          # ✅ 27/27
cd backend && npm test                                  # ✅ 84/84 pass
npm run build                                           # ✅ frontend + backend OK

# 2. Deploy
git push origin main
docker compose up -d --build api                       # SEED_ON_BOOT=0 (already seeded)
docker compose logs -f api                             # health → db ok + uploads ok
```

### SEED_ON_BOOT workflow
```bash
# First boot on EMPTY DB:
SEED_ON_BOOT=1 docker compose up -d --build api
docker compose logs -f api    # seed-on-boot=seeded + listening
SEED_ON_BOOT=0                # update .env, then restart
```

### الملفات المتبقية قبل الرفع النهائي
| الملف | الحالة |
|-------|--------|
| `.env` | ✅ JWT_SECRET + CORS + VITE_API_URL كلها https |
| `backend/dist/` | ✅ index.js + schema.sql موجودين |
| `frontend/dist/` | ✅ index.html موجود |
| `seed-data.json` | ✅ 11 orgs / 13 users / 6 factories / 4 initiatives / 4 apps |
| Dockerfiles | ✅ كلاهما يحتوي scripts copy |
| nginx.conf.sample | ✅ server_tokens off + security headers |
| deploy script (prune + backup cron) | ✅ موجود في backend/scripts/ |

**الاستضافة جاهزة للرفع.**
