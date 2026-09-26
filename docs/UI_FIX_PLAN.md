# مخطط إصلاح الواجهة `UI_FIX_PLAN`

> هذه الوثيقة هي المرجع الوحيد لتنسيق الواجهة. أي تعديل بصري جديد يجب أن يلتزم بها.
> القاعدة المختصرة: الألوان من `theme.css` فقط، والمنطق من `theme.ts` فقط، والعرض من `components/ui` فقط.

---

## (أ) تنقية الهوية — Identity Purge ✅ مكتمل

### خريطة الدخيل → الهوية (كلها نُقلت)
| القيمة القديمة | المتغير المعتمد | السبب |
|---|---|---|
| `#FAFCFF` | `var(--gov-primary-50)` | خلفية كانفس الاستوديو |
| `#F8FAFC` | `var(--status-draft-bg)` | صفوف مميزة/مودالات |
| `#F1F5F9` | `var(--gov-primary-50)` | شريط التمرير |
| `#1E3E62` | `var(--gov-primary-800)` | مرحلة 1 (كحلي بسيادي) |
| `#0F766E` | `var(--gov-teal)` | مرحلة 2 (تيل رسمي) |
| `#3B679B` | `var(--gov-primary-600)` | مرحلة 4 |
| `#15803D` | `var(--status-approved-text)` | مراحل 5/6 (أخضر الاعتماد) |
| `#FFFFFF` في tsx (خلفيات) | `var(--bg-surface)` | الأسطح البيضاء الرسمية |
| `#FFFFFF` في tsx (نصوص فوق داكن) | `var(--on-dark)` / `var(--text-inverse)` | النص العكسي |
| `rgba(255,255,255,0.x)` | متغيرات `--on-dark-*` في theme.css | الشفافات الرسمية |
| `#FDECEC` / `#9B1C1C` (خطأ) | `var(--danger-soft-bg/text/bd)` | حالات الرفض |

### قاعدة الهوية الصارمة
- **مسموح** hex فقط داخل `styles/visual-tokens.css` و `utils/reports.ts` (قالب طباعة).
- **ممنوع** `hex` / `rgba` مباشرة داخل `*.tsx` / `*.ts`. كل لون يُستدعى عبر `var(--...)`.
- **مسموح** `box-shadow` بـ `rgb(15,23,42)` (نفس لون النص `#0F172A` — ظل هويتي).
- **التحقق:** البحث `#[0-9A-Fa-f]{3,6}` في `src` يرد بصفر نتائج عدا التقارير وطبقة الأصول.

---

## (أ) تشخيص المشاكل الحالية

### 1. ألوان `hex` / `rgba` مبعثرة في `tsx`
- قيم مثل `#FFFFFF` و`rgba(255,255,255,...)` مكتوبة مباشرة داخل خاصية `style` في ملفات العرض (مثال: `App.tsx` — الفوتر والأغلفة).
- النتيجة: استحالة تغيير الهوية من مكان واحد، وتكسر الوضع الليلي `dark mode` لأن القيم ثابتة ولا تقرأ من المتغيرات.

### 2. خاصية `style` مكررة للتبويبات والمودالات والأغلفة
- كل نافذة منبثقة تعيد اختراع `modal-backdrop` + `modal-content` + `maxWidth` + `stopPropagation` يدويًا (مثال: `InitiativeLandingModal.tsx` و`ApplicationReviewModal.tsx` و`PreEligibilityModal.tsx`).
- أزرار التبويبات `tabs` تُبنى بـ `style` مكرر بدل الكلاس الجاهز `tab-btn` / `tab-btn.active`.
- الأغلفة الداكنة `hero covers` تكرر `background: var(--egypt-black)` + `color: #FFFFFF` بدل كلاسات `text-on-dark`.

### 3. `colorCode` يدوي
- بعض العروض تبني ألوان المراحل من حقول بيانات (`colorCode`) أو `hex` ثابت لكل مرحلة.
- البديل المعتمد موجود فعلًا: `stageColor()` + `STAGE_COLORS` في `utils/theme.ts` تقرأ من `--stage-1..6` في `styles/theme.css`.

### 4. منطق `badges` يدوي
- شروط `if status === ...` متناثرة لاختيار لون الشارة في كل جدول/بطاقة.
- البديل المعتمد موجود فعلًا: `<Badge status={...} />` الذي يستدعي `statusTone()` داخليًا ويخرج `badge-approved|pending|rework|rejected|draft|gold|teal`.

---

## (ب) قاعدة التعديل الذهبية

| تريد تغيير... | عدّل هنا فقط | ممنوع |
|---|---|---|
| أي لون / ظل / حد | `styles/theme.css` و`styles/visual-tokens.css` | أي `hex` أو `rgba` جديد داخل `tsx` |
| لون منطقي (حالة/مرحلة جديدة) | `utils/theme.ts` (`statusTone` / `STAGE_COLORS`) + متغير `CSS` مطابق | `if` لوني جديد داخل المكونات |
| شكل مكرر (مودال/بطاقة/شارة/خطأ) | `components/ui` (`Badge` / `ErrorBox` / `Modal` / `Card`) | نسخ `div` الغلاف يدويًا من جديد |
| بنية صفحة | ملف الـ `view` الخاص بها فقط | تعديل `globals.css` لصفحة واحدة |

```tsx
// ✅ صح — لون دلالي + مكون مشترك
import { Modal, Card, Badge } from '../components/ui';
<Card><Badge status={app.status}>{app.status}</Badge></Card>
<Modal onClose={onClose} title="مراجعة">...</Modal>

// ❌ خطأ — hex مباشر ومنطق يدوي
<div style={{ background: '#FFFFFF', color: '#B91C1C' }}>...</div>
```

---

## (ج) خريطة الملفات (`tokens` ← `theme` ← `globals` ← `ui` ← `views`)

```
styles/visual-tokens.css   ← الخامة الثابتة (علم مصر/الذهب/الحالات/الخطوط/الأبعاد)
        ↓
styles/theme.css            ← الأسماء الدلالية (surface/text/overlay/stage) + الوضع الليلي + كلاسات tab-btn/modal/error-box
        ↓
styles/globals.css          ← يستورد الاثنين + reset + مكونات card/badge/modal/table/btn/persona
        ↓
utils/theme.ts              ← الجسر المنطقي (stageColor/statusTone/getTheme/setTheme) — لا hex في المكونات
        ↓
components/ui/              ← العرض الموحد (Badge/ErrorBox/Modal/Card + index.ts)
        ↓
components/*views*          ← الصفحات (showcase/factory/admin/layout) — تستهلك فقط، لا تعرّف ألوانًا
```

- ملفات الطباعة `print` مستثناة من حظر `hex` (تحتاج ألوانًا ثابتة للورق).
- ملفات `glassmorphism` القديمة **لا تُحذف** — تُترك كما هي ويُوثق البديل هنا.

---

## (د) قائمة المراحل `checklist`

### المرحلة `P0` — توحيد الألوان ✅ مكتمل
- [x] استبدال كل `hex`/`rgba` في `tsx` بمتغيرات (`var(--...)`) أو كلاسات (`text-on-dark` / `box-white` / `overlay-chip`).
- [x] نقل أي لون جديد إلى `visual-tokens.css` + اسم دلالي في `theme.css`.
- [x] التحقق: بحث `grep` عن `#[0-9a-fA-F]{3,6}` في `src` يرد صفر نتائج (عدا `reports.ts`).
- [x] تم إصلاح `green` hardcoded في OrganizationsView → `var(--status-approved-text/bg)`.

### المرحلة `P1` — مكونات مشتركة
- [x] `Badge` + `ErrorBox` موجودان.
- [x] `Modal` (`modal-backdrop` + `modal-content` + `onClose`/`title`/`children`/`footer`/`maxWidth` + منع الانتشار) موجود.
- [x] `Card` (`card` + `interactive?`/`style`/`children`/`onClick`) موجود.
- [x] `index.ts` يعيد تصدير الأربعة.
- [x] ترحيل المودالات القائمة (`InitiativeLandingModal` / `ApplicationReviewModal` / `PreEligibilityModal` / `EditInitiativeModal`) لاستخدام `<Modal>`. ✅ 4/4 مكتمل
- [~] ترحيل البطاقات لاستخدام `<Card>` — القائمة الحالية تستخدم `.card` CSS class مباشرة (متوافق مع globals.css). الـ `<Card>` wrapper اختياري لتحسين الـ API.

### المرحلة `P2` — ربط `store` بـ `api/endpoints` وإسقاط `mockData` / `LocalStorage`
- [ ] كل قراءة بيانات تمر عبر `store/state` ← `api/endpoints` فقط.
- [ ] حذف استيرادات `mockData` من العروض (تبقى نسخة مرجعية واحدة إن لزمت للتجربة المعزولة).
- [ ] إبقاء `LocalStorage` لمفتاح الثيم `THEME_STORAGE_KEY` فقط؛ بيانات الأعمال تأتي من الـ `API`.

### المرحلة `P3` — تبويبات/مودالات/استجابة
- [x] كل التبويبات تستخدم `tab-btn` / `tab-btn.active`.
- [x] كل المودالات الأربع تستخدم `<Modal>` (إغلاق بالخلفية + `stopPropagation` للداخل + `footer` للأزرار). ✅ مكتمل
- [x] الاستجابة: `factory-split-grid` عمود واحد تحت `900px` + `timeline-scroll-x` بتمرير أفقي (موجود في `globals.css`).
- [x] إضافة `:focus-visible` ring للنصوص والصفوف والأزرار (إمكانية الوصول).
- [x] إضافة `.divider-gold` و `.section-label` و `.card-empty` كلاسات مساعدة.
- [x] `card:hover` يحمل `translateY(-1px)` مع ظل أقوى — حركة خفيفة رسمية.

---

## (هـ) معايير القبول

1. **لا `hex` في `tsx`** عدا ملفات الطباعة — يتحقق عبر البحث عن `#[0-9a-fA-F]{3,6}` في `frontend/src`.
2. **`tsc` نظيف** — `npx tsc --noEmit` من جذر `frontend` بدون أخطاء.
3. **`vite build` ناجح** — `npm run build` (أو `vite build` حسب `package.json`) يكتمل ويخرج `dist/`.
4. **لا حذف لملفات قديمة** — `glassmorphism` وأي ملف تراثي يبقى في مكانه.

---

## (و) سجل الجلسات

### جلسة 2026-09-10 — Modal Migration + Build Verification
- [x] ترحيل `PreEligibilityModal` → `<Modal>`
- [x] ترحيل `ApplicationReviewModal` → `<Modal>` (إعادة كتابة كاملة)
- [x] ترحيل `InitiativeLandingModal` → `<Modal>` (إعادة كتابة كاملة)
- [x] ترحيل `EditInitiativeModal` → `<Modal>` (تعديل import + wrapper)
- [x] `npx tsc --noEmit` → exit 0 (صفر أخطاء)
- [x] `npm run build` → `dist/` ناجح (1611 module, CSS 16.25 kB, JS 414 kB)
- [x] Backend health check: `/api/v1/health` → `{status: "ok", version: "1.0.0"}` ✅
- [x] جميع ملفات `tsx` خالية من `hex`/`rgba` دخيل (عدا `reports.ts` المسموح به)
### جلسة 2026-09-10 — P2: ربط store بالـ API وإسقاط mockData/LocalStorage
- [x] إضافة `fullListInitiatives`, `fullListOrganizations`, `fullListUsers`, `fullListApplications` إلى `api/endpoints.ts`.
- [x] إضافة نظرائها في `api/mockAdapter.ts` (تعيد المصفوفات كاملة بدون Pagination).
- [x] إعادة كتابة `state.ts`:
  - `constructor` يهيّئ بمصفوفات فارغة + default ministry_admin.
  - `loadAll()` يجلب من `api.*` (أو `mockAdapter`) ويغذي المصفوفات.
  - `init()` async يستدعي `loadAll()` مرة واحدة عند الإقلاع.
  - `notify()` أزيل منه `saveToStorage()` — لم يعد يُكتب في `localStorage`.
  - `resetToDefault()` يعيد `loadAll()` بدلاً من `mockData`.
  - `nextApplicationNumber()` أزيل منه `localStorage.setItem`.
- [x] `HeaderNavbar.tsx`: استبدال `mockUsers` بـ `storeUsers` من `usePlatformStore`.
- [x] `App.tsx`: `useEffect(() => { void store.init(); }, [])`.
- [x] `npx tsc --noEmit` → exit 0 (صفر أخطاء).
- [x] `npm run build` → ناجح (1610 module, CSS 16.25 kB, JS 370 kB).
- [x] صفر استيرادات `mockData` متبقية في `src/**/*.tsx` أو `.ts` عدا الملف المرجعي.
