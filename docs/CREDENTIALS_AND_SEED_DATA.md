# الباسوردات والبيانات الأساسية (تطوير/عرض فقط)

> ⚠️ كل ما هنا لبيئات التطوير والعرض. في الإنتاج: غيّر `JWT_SECRET` و`CORS_ORIGIN`، وعطّل الديمو، واطلب تغيير كلمات البذرة عند أول دخول (`mustChangePassword=true` إجباري).

## كلمة البذرة الموحدة

```
Egypt@2026
```

كل الحسابات المزروعة تعمل بهذه الكلمة، وتُجبر على تغييرها عند أول دخول ناجح (الفرونت يفتح `ChangePasswordModal` تلقائياً). من غيّر كلمته لا يُطلب منه مجدداً (backfill لمرة واحدة يفحص الهاش).

## الحسابات المزروعة (14)

المصدر: `backend/src/db/seed.ts` (`USERS`). القاعدة الفاضية بتتزرع بيهم في أول إقلاع (`SEED_ON_BOOT=1`، وده الافتراضي في الـ Dockerfile والـ compose). القواعد اللي اتزرعت قبل كده بتاخد الحسابات الجديدة تلقائياً في الإقلاع اللي بعده (`applySeedUpdates` → `seed_users_v2`)، وده بيحصل حتى مع `SEED_ON_BOOT=0`.

| البريد | الدور | الجهة | الاستخدام |
|---|---|---|---|
| `tarek.mansour@industry.gov.eg` | ministry_admin | وزارة الصناعة | أدمن عام (كل الصلاحيات) |
| `sara.adel@industry.gov.eg` | initiative_manager | وزارة الصناعة | مدير مبادرات + نظرة الوزارة |
| `a.sherif@ida.gov.eg` | ida_reviewer | IDA | مراجع تراخيص/أهلية |
| `mona.kamal@imc-egypt.org` | imc_reviewer | IMC | مراجع فني |
| `yasser.fawzy@nbe.com.eg` | bank_reviewer | البنك الأهلي | مراجع ائتماني |
| `dina.samir@nbe.com.eg` | bank_reviewer | البنك الأهلي | مراجع ائتماني ثانٍ |
| `k.nabil@apexsolar.eg` | solar_provider | أبيكس للطاقة | مقدم خدمة/منفذ |
| `h.radwan@eehc.gov.eg` | ida_reviewer | الشركة القابضة للكهرباء | مراحل «موافقة شركة الكهرباء» و«الربط والتشغيل» |
| `heba.farouk@audit.gov.eg` | auditor | وزارة الصناعة | مدقق (قراءة + سجلات) |
| `m.sewedy@elsewedy-ind.com` | factory_owner | مصنع السويدي | مالك مصنع (factory-sewedy) — جرّب به التقديم ومبادراتي |
| `factory@nile.eg` | factory_owner | مصنع النيل | مالك مصنع ثانٍ (factory-1) — لاختبار العزل |
| `karim.elshorbagy@ghazl-textile.eg` | factory_owner | غزل المحلة | مالك مصنع (factory-ghazl) |
| `hany.ramzy@suezchem.eg` | factory_owner | السويس للكيماويات | مالك مصنع (factory-chem) |
| `maged.fahmy@ceramic10.eg` | factory_owner | العاشر للسيراميك | مالك مصنع (factory-ceramic) |

## المصانع والجهات والمبادرات

- **الجهات (8):** `org-ministry, org-ida, org-imc, org-nbe, org-banque-misr, org-eehc, org-apex-solar, org-factory-1`.
- **المصانع:** السويدي (كابلات/هندسية، الجيزة، 420 موظف) + النيل للأغذية + الدلتا + تُنشأ مصانع جديدة عبر `POST /factories/register`.
- **شمس الصناعة** (`init-solar-2026`): طاقة شمسية للاستهلاك الذاتي — 1000 ميجاوات / 7000 مصنع / 12.5 مليار جنيه قروض / 5 سنوات (2026→2030) / 11 مستنداً / 8 مراحل (تسجيل→IDA→جدوى→IMC→بنك→تركيب 60 يوم→كهرباء→ربط) / صفحة `spotlight` مخصصة. المصدر: `docs/assets/احد-المبادرات/`.

## المنافذ والبيئة

| المفتاح | تطوير | إنتاج |
|---|---|---|
| فرونت | `:3000` (`VITE_API_URL=http://localhost:4000`) | يُبنى بـ `VITE_API_URL` الدومين |
| باك `PORT` | `4000` | `4000` خلف nginx |
| `DB_PATH` | `./data/app.db` (SQLite) | `/data/app.db` (مجلد مركّب) |
| `JWT_SECRET` | `dev-only-insecure-secret-change-me` | **عشوائي 48 بايت إجباري** (يرفض الإقلاع بدونه) |
| `JWT_ACCESS_TTL_SEC` / `REFRESH` | `900` / `604800` | كما هي (أو أقصر) |
| `CORS_ORIGIN` | `http://localhost:3000,...` | دومينات صريحة (يرفض `*`) |
| `SEED_ON_BOOT` | `1` | `0` (بذر يدوي أول مرة) |
| `ALLOW_DEMO_AUTH` | `1` | `0` (يحظر `x-user-id` و`switch-user`) |
| `BCRYPT_ROUNDS` | `10` | `10`+ |
| رفع الملفات | PDF فقط + magic-bytes + حد من `customization.maxFileSizeMB` (15 افتراضي) | كما هي |

## أوامر الصيانة

```bash
cd backend
npm run dev              # تطوير :4000
npm test                 # كل الاختبارات (~110)
npm run build            # tsc + نسخ السكيمة
npm run check:prod       # بوابة النشر (27 فحصاً)
npm run db:reset         # مسح وإعادة بذر (يرفض في الإنتاج)
npm run backup/restore   # نسخ ذري عبر VACUUM INTO
cd ../frontend
npm run dev              # :3000
npm run build            # tsc + vite (يُخبز VITE_API_URL)
```

## الجلسات والحدود

- Access قصير (15 دقيقة) + Refresh دوّار (httpOnly) + قفل حساب بعد 5 فشل (423 / 15 دقيقة) + تحقق بريد للتسجيل الذاتي.
- Rate-limits: عام 300/د، دخول 50/15د، قراءات عامة 120/د، تسجيل 30/15د، رفع 30/د، قرارات 60/د، مراسلات 60/د.
