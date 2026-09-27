# النشر على Coolify (الطريقة الموصى بها)

حاوية واحدة من `Dockerfile` اللي في جذر المشروع. الباك بيخدم الفرونت على نفس الدومين (`SERVE_FRONTEND=1`)، وCoolify (Traefik) بيعمل HTTPS لوحده. مفيش nginx ولا certbot ولا دومين تاني للـ API.

### 1) إنشاء التطبيق
**+ New → Application** → اختار الريبو من GitHub (لو الريبو private استخدم **GitHub App**). وبعدين اختار **واحد** من الـ Build Packs دول، والاتنين بيبنوا نفس الصورة:

**أ) Build Pack: `Dockerfile`**
1. Base Directory: `/` — Dockerfile Location: `/Dockerfile`.
2. **Ports Exposes:** `4000`.
3. **Domains:** `https://www.industrial.talentooo.com,https://industrial.talentooo.com` — ومن **Direction** اختار **Redirect to www**.
4. التخزين: الخطوة 2 تحت.

**ب) Build Pack: `Docker Compose`** (بيستخدم [`docker-compose.yml`](../docker-compose.yml)، وده service واحد اسمه `app`)
1. Docker Compose Location: `/docker-compose.yml`. لو الـ app كان معمول قبل كده بالـ compose القديم، دوس **Reload Compose File** عشان يظهر الـ service `app` بس.
2. **Domains** بتاعة الـ service `app`، **بالبورت 4000 في الآخر** (ده بورت الحاوية مش البورت العام):
   `https://www.industrial.talentooo.com:4000,https://industrial.talentooo.com:4000`
3. التخزين معمول تلقائياً (volume اسمه `app-data` على `/data`)، فاسكب الخطوة 2.

الـ DNS: الدومينين لازم يشاوروا بـ A record على IP سيرفر Coolify.

### 2) التخزين الدائم (Build Pack `Dockerfile` بس — إجباري، ومن غيره الداتا تتمسح مع كل deploy)
**Persistent Storage → + Add → Volume Mount**
- Destination Path: `/data`

قاعدة SQLite والمرفقات والنسخ الاحتياطية كلها جوه `/data`. استخدم **Volume Mount** مش Directory Mount، لأن الحاوية شغالة بمستخدم غير root، والـ volume بياخد الصلاحيات الصح تلقائياً.

### 3) متغيرات البيئة (Environment Variables)

| المتغير | القيمة | ملاحظة |
|---|---|---|
| `JWT_SECRET` | ناتج `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | **إجباري** — السيرفر يرفض الإقلاع بدونه |
| `CORS_ORIGIN` | `https://www.industrial.talentooo.com,https://industrial.talentooo.com` | الدومينين، من غير / في الآخر |
| `APP_URL` | `https://www.industrial.talentooo.com` | الرابط اللي بيظهر في الإيميلات |
| `SEED_ON_BOOT` | `1` في أول deploy فقط، ثم `0` | يزرع الجهات والحسابات الأساسية لو القاعدة فاضية |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | اختياري | لتفعيل الإيميلات (انظر §5-ج و§5-د) |
| `MAIL_FROM_NAME` | اختياري | اسم المُرسل |

الباقي متظبط جاهز في الـ Dockerfile (`NODE_ENV=production`، `DB_PATH=/data/app.db`، `TRUST_PROXY=1`، `ALLOW_DEMO_AUTH=0`...). متحطش `VITE_API_URL`، لأن الفرونت بيكلم `/api/v1` على نفس الدومين.

### 4) Health Check
**Configuration → Healthcheck:** Path `/api/v1/health`، Port `4000`. (الصورة فيها `HEALTHCHECK` جاهز كمان.)

### 5) Deploy
اضغط **Deploy**. في الـ Logs لازم يظهر:
```
[server] seed-on-boot=seeded
[server] listening on http://localhost:4000 — prefix /api/v1 (env=production)
```
بعد أول تشغيل ناجح: غيّر `SEED_ON_BOOT` لـ `0` واعمل **Restart**.
الدخول الأول: `tarek.mansour@industry.gov.eg` / `Egypt@2026`، **وغيّر كلمة المرور فوراً** (كل حسابات البذرة بنفس الكلمة، وهي مكتوبة في الريبو).

أي `git push` على `main` بيعمل deploy تلقائي (فعّل **Auto Deploy** في Coolify).

### 6) بيانات الديمو (اختياري)
من **Terminal** التطبيق في Coolify:
```sh
CONFIRM=YES node dist/db/seed-file-cli.js
```

### 7) النسخ الاحتياطي
**Scheduled Tasks → + Add:** الأمر `node scripts/backup.mjs`، والتوقيت `0 2 * * *`.
كل نسخة بتتحفظ في `/data/backups/<timestamp>`. النسخ دي على نفس السيرفر، فانزّل نسخة خارجية من وقت للتاني.
الاسترجاع (من Terminal): `CONFIRM=YES node scripts/restore.mjs /data/backups/<timestamp>` ثم Restart.

---

# النشر على استضافة VPS — خطوات الرفع الآن (Ubuntu + Docker)

> الهدف: `https://industry.gov.eg` (فرونت) + `https://api.industry.gov.eg` (باك) خلف nginx مع TLS.
> البديل الأحادي: `SERVE_FRONTEND=1` يخدم الفرونت من الباك مباشرة (مناسب لمنصات الحاوية الواحدة).

## 0) المتطلبات
- VPS (2GB+ RAM) + DNS: `industry.gov.eg` و `api.industry.gov.eg` يشيران للخادم
- Docker + compose plugin: `docker --version && docker compose version`
- نسخة المشروع على الخادم (git clone أو scp)، ثم من جذر المشروع:

## 1) ملف البيئة (مرة واحدة)
```bash
cp .env.example .env
# ستاك الـ VPS (api + frontend + nginx) في docker-compose.vps.yml — السطر ده بيخلي كل أوامر
# `docker compose` تحت (والكرون) تستخدمه تلقائياً. (docker-compose.yml هو نسخة Coolify.)
echo "COMPOSE_FILE=docker-compose.vps.yml" >> .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"  # ولّد مفتاحا
# ضع ناتج الأمر في .env: JWT_SECRET=...
# راجع CORS_ORIGIN (دوميناتك الصريحة) و VITE_API_URL (رابط الـ API العلني)
nano .env
```

## 2) فحص ما قبل النشر (بوابة إجبارية)
```bash
cd backend && npm ci && npm run build && cd ..
cd frontend && npm ci && npm run build && cd ..
node backend/scripts/check-prod.mjs --strict   # يجب أن يطبع PASS
```

## 3) الإقلاع الأول (بذر مرة واحدة فقط)
```bash
SEED_ON_BOOT=1 docker compose up -d --build api   # يزرع orgs/users/initiatives ثم
docker compose logs -f api                          # راقب: seed-on-boot=seeded + listening
SEED_ON_BOOT=0                                      # أعدها فورا في .env لمنع إعادة الزرع
docker compose up -d                                # api + frontend + nginx
curl -sk https://api.industry.gov.eg/api/v1/health  # {"status":"ok","checks":{"db":"ok",...}}
```

## 3-ب) بيانات الديمو الجاهزة (اختياري — لعرض تجريبي فوري)
```bash
# يحمّل seed-data.json (جهات/مستخدمون/مصانع/مبادرات + 4 طلبات ديمو بخط زمني حقيقي).
# يعمل مرة واحدة فقط (idempotent) ويرفض الإنتاج بدون تأكيد صريح:
docker cp seed-data.json $(docker compose ps -q api):/tmp/seed-data.json
docker compose exec -e CONFIRM=YES api node dist/db/seed-file-cli.js /tmp/seed-data.json
# دخول تجريبي بعدها: tarek.mansour@industry.gov.eg / Egypt@2026 (غيّرها فورا)
```

## 4) شهادات TLS (مرة واحدة + تجديد تلقائي)
```bash
mkdir -p certbot-www
docker compose stop nginx
certbot certonly --webroot -w ./certbot-www -d industry.gov.eg -d www.industry.gov.eg -d api.industry.gov.eg
docker compose up -d nginx
# تجديد تلقائي (cron يومي):
echo "0 3 * * * certbot renew --quiet --deploy-hook 'cd /srv/app && docker compose restart nginx'" | crontab -
```

## 5) النسخ الاحتياطي (ذري + مجدول + مجرب)
```bash
# نسخة يدوية الآن (VACUUM INTO ذري — لا فساد WAL):
docker compose exec api node scripts/backup.mjs /data/backups/manual-1
# أو عبر سكربت الكرون الجاهز (نسخ + تنظيف 14 يوم + سجل):
docker compose exec api sh /app/scripts/backup-cron.sh
# تثبيت كرون ليلي 02:00 (يستخدم backup-cron.sh داخل الحاوية):
echo "0 2 * * * docker exec $(docker compose ps -q api) sh /app/scripts/backup-cron.sh >> /var/log/industry-backup.log 2>&1" | crontab -
# تجربة استرجاع على staging أولا (CONFIRM=YES إجباري في prod + فحص سلامة):
# docker compose exec -e CONFIRM=YES api node scripts/restore.mjs /data/backups/<stamp>
```

## 5-ب) تفعيل البريد للمصانع الجديدة (مكافحة السبام)
```bash
# التسجيل ينشئ حساب غير مفعل — يرسل رابط تفعيل (في الإنتاج عبر بريد، في dev يعيد التوكن):
# POST /api/v1/factories/register  → 201 { requiresVerification: true }
# المستخدم يفتح رابط التفعيل أو ينفذ:
curl -X POST https://api.industry.gov.eg/api/v1/auth/verify-email -H 'Content-Type: application/json' -d '{"token":"<verificationToken>"}'
# إعادة الإرسال عند انتهاء 24ساعة:
curl -X POST https://api.industry.gov.eg/api/v1/auth/resend-verification -H 'Content-Type: application/json' -d '{"email":"factory@example.com"}'
```

## 5-ج) مركز المراسلات — تذكير البريد عبر Gmail

أي جهة، والوزارة من ضمنها، يوصلها بريد تذكير واحد لو الرسايل الواردة ليها من أي جهة تانية فضلت غير مقروءة 15 دقيقة (`CHAT_REMINDER_DELAY_MIN`). البريد ده بيجمع كل الجهات اللي مستنية الرد. مفيش تذكير تاني لحد ما الجهة تقرا، والبريد مش بيحتوي نص الرسائل.

1. **حساب الإرسال**: حساب Gmail مخصص للإرسال، مثلاً حساب إشعارات المنصة.
2. **التحقق بخطوتين**: فعّله على الحساب من `https://myaccount.google.com/security`.
3. **كلمة مرور التطبيق**: أنشئها من `https://myaccount.google.com/apppasswords`. الناتج 16 حرف.
4. **ملف `.env`** (الجذر لـ docker compose):
   ```bash
   GMAIL_USER=your-sender-account@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   APP_URL=https://industry.gov.eg
   ```
5. **إعادة تشغيل الـ api**: `docker compose up -d api`. اللوغ لازم يظهر `[chat-reminder] enabled …`.

ملاحظات:
- **مصدر المستلمين**: `contactEmail` الخاص بالجهة (من «الجهات والحسابات») مع إيميلات حسابات أعضائها المفعلة. لازم يكون `contactEmail` صحيحاً لكل جهة.
- **خارج الإنتاج** (`NODE_ENV≠production`) مفيش بريد بيروح لمستلمين حقيقيين:
  - مع `MAIL_REDIRECT_TO=you@example.com` كل التذكيرات بتتحول للعنوان ده عشان التجربة.
  - `MAIL_SEND_REAL=1` بيلغي الحماية دي.
- **حدود Gmail**: الحساب العادي حوالي 500 مستلم في اليوم، وحساب Google Workspace حوالي 2000. التذكير بيتبعت مرة واحدة لكل دفعة غير مقروءة، فالحد كافي لعدد الجهات الحالي.
- **المرفقات**: بتتحفظ في `UPLOAD_DIR/chat/` جوه الـ volume `/data`، فبتتنسخ مع النسخ الاحتياطي. `client_max_body_size 105m` في nginx بيكفي 5 ملفات حجم كل واحد 20 ميجا.

## 5-د) بريد المنشآت الرسمي (تحديثات مراحل الطلب)

كل منشأة يوصلها بريد رسمي بشعار الوزارة مع كل تحديث في طلبها:
- استلام الطلب.
- اعتماد مرحلة وإحالته للجهة التالية.
- طلب استيفاء.
- رفض.
- الاعتماد النهائي.

ملاحظات الجهة بتتبعت في البريد زي ما اتكتبت. التصعيد داخلي ومبيتبعتش.

- **الإعداد:** نفس إعداد Gmail اللي في القسم 5-ج (`GMAIL_USER` و `GMAIL_APP_PASSWORD` و `APP_URL`). اللوغ لازم يظهر `[mail-queue] enabled`.
- **المستلمون:** `contactEmail` الخاص بالمنشأة، مع إيميلات حسابات مالكيها المفعّلة، من غير تكرار.
- **الموثوقية:**
  - الرسائل بتتسجل في جدول `email_outbox`، وعامل بيبعتها في الخلفية.
  - لو الإرسال فشل بيعيد المحاولة بعد 1، ثم 5، ثم 15، ثم 60 دقيقة، وبعد 5 محاولات الرسالة بتبقى `failed`. الرسائل الأقدم من 48 ساعة مش بتتبعت.
  - القرار نفسه عمره ما يتأخر أو يفشل بسبب البريد.
  - لو البريد مش متظبط أو المنشأة مالهاش إيميل، الرسالة بتتسجل `skipped` للتدقيق ومش بتتبعت بعدين.
- **خارج الإنتاج:** نفس حماية `MAIL_REDIRECT_TO` و `MAIL_SEND_REAL` بتاعة القسم 5-ج.
- **الشعار:** `backend/assets/email/ministry-logo.png`، وبيتنسخ جوه صورة Docker.
- **حدود Gmail:** كل تحديث عبارة عن رسالة لمنشأة واحدة. الحساب العادي حدّه حوالي 500 مستلم في اليوم، وحساب Google Workspace حوالي 2000. لو الحجم هيعدّي كده، اعتمدوا حساب Workspace أو SMTP مؤسسي.

## 6) الدخول الأول
- البريد: `tarek.mansour@industry.gov.eg` — كلمة: `Egypt@2026` (بذرة الديمو)
- غيّرها فورا: `POST /api/v1/auth/change-password` ثم أنشئ حسابات حقيقية من `/users` (كل حساب جديد يُجبر على التغيير)
- عطّل الديمو نهائيا: `ALLOW_DEMO_AUTH=0` (الافتراضي في compose) وتحقق أن `POST /auth/switch-user` يرد 403

## 7) التشغيل اليومي
```bash
docker compose ps                    # الحالة
docker compose logs -f api           # السجلات (stdout)
curl -sk https://api.industry.gov.eg/api/v1/health
cd backend && npm run backup         # نسخة عند الطلب (خارج docker)
```

## 8) التحديث والتراجع
```bash
git pull
cd frontend && npm ci && npm run build && cd ..
docker compose up -d --build         # يعيد بناء api (contracts تُنسخ داخل الصورة) + frontend
node backend/scripts/check-prod.mjs --strict
# تراجع: docker compose up -d --build مع الوسم/الكوميت السابق + استرجاع آخر نسخة عند الحاجة
```

## ملاحظات إنتاج
- `TRUST_PROXY=1` إجباري خلف nginx (ملفات تعريف الارتباط الآمنة + IP الحقيقي للتدقيق)
- الرفع: سقف nginx `105m` يتماشى مع multer (100m) وحدود المبادرات (حتى 100m)
- `data/` كاملة (DB + uploads + backups) تعيش في volume `api-data` — لا تُفقد مع إعادة البناء
- لا تشحن `VITE_API_URL` فارغا للإنتاج: التطبيق يصرخ `[PROD-GUARD]` ويعمل Mock (مرفوض في الإطلاق)
