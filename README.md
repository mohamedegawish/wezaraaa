# المنصة الوطنية للمبادرات الصناعية — التقسيم الظاهري `frontend / backend`

> العقد هو المصدر الوحيد: `contracts/api.contracts.ts` + `contracts/openapi.json` + `docs/API_CONTRACTS.md`.
> أي خلاف على شكل الداتا يُحسم من العقد — وأي `PR` يغير `Req/Res` بدون تحديث العقد يُرفض.

```
INDUSTRIAL_INITIATIVES/
├── RUN.bat              ← تشغيل الفرونت (Mock افتراضيا) — نقرة واحدة
├── RUN_BACKEND.bat      ← تشغيل الباك فقط (:4000)
├── frontend/            ← فريق الفرونت (React + Vite :3000)
│   ├── src/api/         ← العازل الوحيد (fetch الوحيد هنا)
│   ├── src/components/  ← كل الشاشات عبر api.* فقط
│   ├── .env.example     ← VITE_API_URL فارغ = Mock / =http://localhost:4000 للتكامل
│   ├── vite.config.ts   ← proxy /api/v1 → http://localhost:4000
│   └── package.json     ← dev/build/preview
├── backend/             ← فريق الباك (Express :4000)
│   ├── src/routes/      ← راوت نحيف لكل مجموعة
│   ├── src/db.ts        ← In-memory بنفس بذور الفرونت (تُستبدل بـ DB لاحقا بدون تغيير العقد)
│   ├── src/middleware/  ← auth (x-user-id مؤقت) + error (ApiError)
│   └── README.md        ← سويت curl الكامل
├── contracts/           ← الفريقان معا (أي تغيير = PR مشترك + مثال JSON)
│   ├── api.contracts.ts ← كل Req/Res + ROUTES
│   └── openapi.json     ← مرجع آلي
└── docs/                ← التوثيق
    └── API_CONTRACTS.md ← مرجع الحقول والأمثلة لكل راوت
```

## التشغيل السريع (من الجذر)

```bat
REM فرونت فقط (يعمل بدون باك — Mock تلقائيا)
RUN.bat                 REM → http://localhost:3000

REM باك فقط (يعمل بدون فرونت)
RUN_BACKEND.bat         REM → http://localhost:4000
```

```bash
# أو يدويا:
cd frontend && npm install && npm run dev   # :3000 Mock
cd backend && npm install && npm run dev    # :4000 API

# التكامل: في frontend/.env (انسخ من frontend/.env.example)
VITE_API_URL=http://localhost:4000
# أعد تشغيل الفرونت — صفر تغيير في المكونات
```

## قواعد ملزمة

1. الفرونت: ممنوع `fetch` خارج `frontend/src/api/` — كل الكتابات عبر `api.*`.
2. الباك: راوت نحيف → تحقق كامل (`Never Trust Frontend`) → رد `{ message, status, data }` أو `ApiError`.
3. الملفات: `multipart/form-data` بحقل `file` فقط — `PDF` + حد `maxFileSizeMB` من `customization` (افتراضي `15MB`).
4. التسمية: `camelCase` — تواريخ `ISO` — مبالغ أرقام `EGP` — نص مزدوج `Ar/En` — كل المسارات تحت `/api/v1`.

## النشر

- **Coolify (موصى به):** حاوية واحدة من [`Dockerfile`](Dockerfile) في الجذر، والباك بيخدم الفرونت على نفس الدومين. الخطوات كاملة في **[docs/DEPLOY.md](docs/DEPLOY.md#النشر-على-coolify-الطريقة-الموصى-بها)** (Volume على `/data` + `JWT_SECRET` + الدومين).
- **VPS يدوي:** `docker-compose.yml` (api + frontend + nginx/TLS)، في نفس الملف.

## الأدلة

- **[docs/FILES_AND_FOLDERS.md](docs/FILES_AND_FOLDERS.md)** — شرح عام لكل ملف وفولدر.
- **[docs/CREDENTIALS_AND_SEED_DATA.md](docs/CREDENTIALS_AND_SEED_DATA.md)** — الباسوردات والبيانات الأساسية (تطوير فقط).
- [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md) — مرجع الحقول والأمثلة. [contracts/README.md](contracts/README.md) — العقد باختصار.
