# باك المنصة — التشغيل والتحقق المستقل (فريق الباك يعمل بدون فرونت)

> العقد هو المصدر الوحيد: `../contracts/api.contracts.ts` + `../docs/API_CONTRACTS.md`.
> أي `Req/Res` جديد يبدأ من العقد أولا.

## التشغيل

```bash
npm install
cp .env.example .env   # ثم عدل DB_PATH / UPLOAD_DIR / CORS_ORIGIN
npm run db:migrate  # إنشاء السكيمة (idempotent)
npm run db:seed     # بذر أولي (idempotent — آمن عند كل إقلاع، يعمل تلقائيا في start/dev)
npm run dev    # http://localhost:4000 (tsx watch)
npm run build  # tsc -> dist/
npm start      # node dist/index.js (production — helmet + rate-limit + morgan)
npm run db:reset    # خطر: مسح كل البيانات وإعادة البذر (تطوير فقط)
```

> التخزين: `SQLite (node:sqlite)` في `DB_PATH` (افتراضي `./data/app.db` + `WAL`)، والملفات على قرص `UPLOAD_DIR`.
> الإقلاع يزرع تلقائيا إن كانت القاعدة فارغة: 8 جهات + 9 حسابات + 3 مصانع + 4 مبادرات.

## سويت curl — كل الراوتس إيجابا وسلبا

```bash
BASE=http://localhost:4000/api/v1
U='-H x-user-id:user-admin'

# 0) صحة
curl $BASE/health

# 1) المستخدم الحالي + تبديل شخصية
curl $BASE/users/me $U
curl -X POST $BASE/auth/switch-user -H 'Content-Type: application/json' $U -d '{"userId":"user-admin"}'
# سلبي: بدون هيدر -> 401 UNAUTHORIZED
curl $BASE/users/me

# 2) مبادرات
curl "$BASE/initiatives?page=1&pageSize=5" $U
curl $BASE/initiatives/init-solar-1 $U
curl -X PUT $BASE/initiatives/init-solar-1 -H 'Content-Type: application/json' $U -d '{"titleAr":"مبادرة محدثة","budgetTotalEGP":1000000}'

# 3) تخصيص المبادرة
curl $BASE/initiatives/init-solar-1/customization $U
curl -X PUT $BASE/initiatives/init-solar-1/customization -H 'Content-Type: application/json' $U -d '{"maxFileSizeMB":15,"allowFactoryFileUpload":true}'

# 4) مسار العمل
curl $BASE/initiatives/init-solar-1/workflow $U
curl -X PUT $BASE/initiatives/init-solar-1/workflow -H 'Content-Type: application/json' $U -d '{"stages":[{"id":"stage-1","order":1,"code":"ELIGIBILITY","nameAr":"الأهلية","nameEn":"Eligibility","assignedOrgId":"org-ida","slaDays":3,"canReject":true,"canRequestRework":true}]}'

# 5) مصنع + ملفات PDF
curl $BASE/factories/factory-1 $U
curl -X PUT $BASE/factories/factory-1 -H 'Content-Type: application/json' $U -d '{"governorate":"القاهرة"}'
curl "$BASE/factories/factory-1/details-files?initiativeId=init-solar-1" $U
# رفع PDF ناجح
curl -X POST $BASE/factories/factory-1/details-files $U -F 'file=@./test.pdf' -F 'description=كتالوج' -F 'initiativeId=init-solar-1'
# سلبي: ملف غير PDF -> 400 INVALID_FILE_TYPE
curl -X POST $BASE/factories/factory-1/details-files $U -F 'file=@./test.exe'
# مسح
curl -X DELETE $BASE/factories/factory-1/details-files/fdet-1 $U

# 6) طلبات
curl "$BASE/applications?status=under_review&page=1&pageSize=10" $U
curl -X POST $BASE/applications -H 'Content-Type: application/json' $U -d '{"initiativeId":"init-solar-1","factoryId":"factory-1","formData":{"requestedCapacityKW":500}}'
# سلبي: مبادرة غير نشطة -> 400 INITIATIVE_NOT_ACTIVE
curl $BASE/applications/app-1 $U

# 7) قرار مراجع
curl -X POST $BASE/applications/app-1/decisions -H 'Content-Type: application/json' $U -d '{"action":"approve","comments":"مستوفى"}'
# سلبي: رفض بدون تعليق -> 400 COMMENTS_REQUIRED
curl -X POST $BASE/applications/app-1/decisions -H 'Content-Type: application/json' $U -d '{"action":"reject"}'

# 8) لوحة + تقارير + تدقيق
curl $BASE/dashboard/summary $U
curl "$BASE/reports/applications.csv?page=1&pageSize=10" $U -o apps.csv
curl $BASE/reports/initiatives.csv $U -o inits.csv
curl "$BASE/audit-logs?page=1&pageSize=20" $U
```

## قواعد الباك (ملزمة)

1. راوت نحيف -> `store/*.ts` فوق `SQLite` (طبقة المستودعات)، لا `db.ts` القديم (In-memory — محذوف الاستخدام).
2. كل فشل = `ApiError { code, messageAr, messageEn, details? }` + كود HTTP مناسب.
3. الرفع `multipart/form-data` بحقل `file` فقط — التحقق `PDF + maxFileSizeMB` من `customization` (افتراضي `15MB`).
4. لا ثقة بالفرونت: كل تحقق يعاد في الباك (`INITIATIVE_NOT_ACTIVE / INVALID_FILE_TYPE / FILE_TOO_LARGE / COMMENTS_REQUIRED / NOT_ASSIGNED`).
