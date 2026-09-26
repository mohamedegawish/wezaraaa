# chatbot/ — مجلد الشات بوت المخصص (عربي، للمستخدم العادي)

| الملف | الدور |
|---|---|
| `knowledge/faqs.ar.json` | 20 سؤالاً بصيغ عامية + إجابات مؤرضة على صفحات حقيقية |
| `knowledge/site-map.json` | 7 صفحات بصلاحياتها وطريقة الوصول |
| `knowledge/keywords.json` | 12 نية بمرادفات (عايز/ازاي/فين…) |
| `contract.ts` | 3 استعلامات فقط: `listInitiatives/getInitiative/myApps` |
| `safeQueries.ts` | التنفيذ عبر عميل api بجلسة المستخدم — **بلا DB مباشر** |
| `engine.ts` | تطبيع عربي + IDF + عتبة ثقة 8 (تحتها توضيح بلا هلوسة) |
| `engine.test.ts` | 22 اختباراً |
| `SECURITY.md` | نموذج التهديد والضوابط |

الواجهة: `../components/chatbot/ChatWidget.tsx` (زر عائم + ملء شاشة + اقتراحات لايف محلية + عزل سكرول). التفاصيل الكاملة في `SECURITY.md` و`knowledge/README.md`.
