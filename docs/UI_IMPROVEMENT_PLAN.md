# خطة تحسين الواجهة — بناءً على نظام الألوان في `read.md`
## تحليل التناقضات وإرشادات التطبيق العملي

---

## 1. ملخص التحليل

### 1.1 نظام الألوان في `read.md` (الجزء السفلي — 1643 سطرًا)
يستخدم **أسلوب "وحدة تحكم هندسية / Blueprint Console"** بميزات مميزة:

| العنصر | القيمة | الملاحظة |
|---|---|---|
| `ink` | `#152B33` | أسود دافئ مائل للزيتوني — ليس أسود نقي |
| `paper` | `#EFEDE6` | خلفية الورق الكريمية — بديل عن الأبيض النقي |
| `panel` | `#F8F7F2` | ألواح داخلية أفتح قليلاً |
| `line` | `#D6D2C6` | خطوطBlueprint — رمادي دافئ |
| `steel` | `#7C8890` | لون النص الثانوي |
| `brass` | `#9C7A2E` | لون ذهبي صناعي — تمييز |
| `approve` / `reject` / `pending` | `#1F7A4E` / `#AE3B2E` / `#B0791E` | ألوان حالات مشبعة قليلاً |
| الخطوط | `IBM Plex Sans` + `IBM Plex Mono` | طابع هندسي تقني |

### 1.2 نظام الألوان الحالي في المشروع (`VISUAL_IDENTITY.md`)
يستخدم **هوية مؤسسية حكومية مصرية**:

| العنصر | القيمة | الفرق |
|---|---|---|
| Primary | `#0B192C` (كحلي غامق) | أغمق من `ink` بنغمة زرقاء |
| Gold accent | `#C5A059` / `#D4AF37` | ذهبي فاخر أكثر من Brass |
| Teal | `#0F766E` | أخضر مزرق للصناعة النظيفة |
| Background | `#F8FAFC` | أبيض مزرق بارد (ليس كريمي) |
| الخطوط | `Cairo` + `Inter` | خطوط حديثة غير تقنية |

### 1.3 التناقض الجوهري
| البعد | `read.md` tokens | `VISUAL_IDENTITY.md` |
|---|---|---|
| الطابع | هندسي تقني / ورشة蓝图 | مؤسسي حكومي / وطني |
| الخلفية | كريمية دافئة `#EFEDE6` | بيضاء باردة `#F8FAFC` |
| الذهبي | نحاسي صناعي `#9C7A2E` | ذهب Egyptian فاخر `#C5A059` |
| الخطوط | Monospace للأرقام والأكواد | Arial/System للعربية |
| مناسب لـ | لوحات تشغيل فنية / Status rooms | منصة وطنية عامة / Factory portal |

**التوصية:** استخدام النظامين بشكل تكميلي وليس متنافس:
- **لوحة الإدارة (Admin Dashboard):** `read.md` tokens (Blueprint console feel)
- **بوابة المصانع العامة (Factory Portal):** `VISUAL_IDENTITY.md` (Egyptian institutional feel)
- **خطوط الحالة والتشغيل (Status indicators):** توحيد على `VISUAL_IDENTITY.md` semantic tokens

---

## 2. خطة الدمج — خريطة التحديث

### 2.1 إضافة Tokens جديدة إلى `visual-tokens.css`

```css
/* ============================================================================
   ENGINEERING CONSOLE TOKENS — مستوحى من read.md
   يُستخدم حصريًا في: Admin Dashboard, Workflow Studio, SLA Monitors
   ============================================================================ */

:root {
  /* --- Blueprint Surfaces --- */
  --eng-ink:        #152B33;     /* النص الأساسي الداكن */
  --eng-paper:      #EFEDE6;     /* خلفية الورق الرئيسية */
  --eng-panel:      #F8F7F2;     /* ألواح وأقسام داخلية */
  --eng-line:       #D6D2C6;     /* خطوط الفاصل Blueprint */
  --eng-steel:      #7C8890;     /* نص ثانوي / labels */
  --eng-steel-dark: #4B565C;     /* نص متوسط الكثافة */
  --eng-brass:      #9C7A2E;     /* تمييز ذهبي صناعي */
  --eng-brass-light:#D7C29A;     /* خلفية تمييز خفيفة */

  /* --- Blueprint Status Colors --- */
  --eng-status-approve:    #1F7A4E;
  --eng-status-approve-bg: #E5F1EA;
  --eng-status-reject:     #AE3B2E;
  --eng-status-reject-bg:  #F5E6E3;
  --eng-status-pending:    #B0791E;
  --eng-status-pending-bg: #F5EBD8;

  /* --- Engineering Accents --- */
  --eng-orange:      #D45D38;
  --eng-orange-light:#F1C68D;
  --eng-green:       #259D4F;
  --eng-green-light: #A1CDB1;
  --eng-purple:      #7552B0;
  --eng-blue:        #669CA8;
  --eng-teal:        #86C8C6;

  /* --- Monospace & Technical --- */
  --eng-font-mono: 'IBM Plex Mono', 'Consolas', monospace;
  --eng-font-tech: 'IBM Plex Sans', 'Segoe UI', Tahoma, sans-serif;

  /* --- Blueprint Decorative --- */
  --eng-hairline:   1px solid var(--eng-line);
  --eng-tick-mark:  3px solid var(--eng-ink);  /* الزوايا التقنية */
}

/* Dark mode for admin console */
[data-theme="dark"] {
  --eng-ink:         #E8E6DF;
  --eng-paper:       #1A1F24;
  --eng-panel:       #22282D;
  --eng-line:        #3A4249;
  --eng-steel:       #8A97A3;
  --eng-steel-dark:  #B0BABF;
  --eng-brass:       #C9A84C;
  --eng-brass-light: #2E2A1A;
}
```

### 2.2 تحديث `theme.css` — إضافة كلاسات مساعدة جديدة

```css
/* ============================================================================
   BLUEPRINT / ENGINEERING CONSOLE COMPONENTS
   ============================================================================ */

/* Stage node with tick-mark corners (engineering aesthetic) */
.stage-node-eng {
  background: var(--eng-paper);
  border: var(--eng-hairline);
  border-radius: 2px;  /* حواف حادة تقريباً — طابع هندسي */
  padding: 16px 20px;
  position: relative;
  font-family: var(--eng-font-tech);
}

/* Tick marks on corners */
.stage-node-eng::before,
.stage-node-eng::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
}
.stage-node-eng::before {
  top: -1px; right: -1px;
  border-top: var(--eng-tick-mark);
  border-right: var(--eng-tick-mark);
}
.stage-node-eng::after {
  bottom: -1px; left: -1px;
  border-bottom: var(--eng-tick-mark);
  border-left: var(--eng-tick-mark);
}

/* Blueprint data table */
.eng-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--eng-font-mono);
  font-size: 13px;
}
.eng-table th {
  background: var(--eng-panel);
  border-bottom: 2px solid var(--eng-ink);
  text-align: right;
  padding: 8px 12px;
  font-weight: 600;
  color: var(--eng-steel-dark);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 11px;
}
.eng-table td {
  border-bottom: var(--eng-hairline);
  padding: 8px 12px;
  color: var(--eng-ink);
}
.eng-table tr:hover td {
  background: var(--eng-panel);
}

/* Monospace ID/Code display */
.eng-code {
  font-family: var(--eng-font-mono);
  color: var(--eng-steel-dark);
  font-size: 12px;
  letter-spacing: 0.02em;
}

/* Brass highlight chip */
.eng-brass-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--eng-brass-light);
  color: var(--eng-brass);
  border: 1px solid var(--eng-brass);
  border-radius: 2px;
  padding: 2px 8px;
  font-family: var(--eng-font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* SLA timer with engineering feel */
.eng-sla-timer {
  font-family: var(--eng-font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--eng-status-pending);
  font-size: 13px;
}
.eng-sla-timer.overdue {
  color: var(--eng-status-reject);
}
.eng-sla-timer.approved {
  color: var(--eng-status-approve);
}
```

### 2.3 تحديث `utils/theme.ts` — دوال جديدة

```typescript
// === Engineering Token Mappings ===

export const ENG_STAGE_COLORS = [
  '#1F7A4E', // approved
  '#B0791E', // pending/in-review
  '#AE3B2E', // rejected
  '#669CA8', // in-progress
  '#7C8890', // draft
  '#9C7A2E', // gold-highlighted
] as const;

export function engStageColor(index: number): string {
  return ENG_STAGE_COLORS[index % ENG_STAGE_COLORS.length];
}

export function formatEngTimestamp(isoString: string): string {
  // Outputs: "2026-09-10T14:30:00Z" → "260910-143000Z" (military-style)
  const d = new Date(isoString);
  const yy  = String(d.getFullYear()).slice(2);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss  = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}-${hh}${min}${ss}Z`;
}

export function formatEngId(prefix: string, num: number): string {
  // "EGY-SOL-2026-0042" → "EGY·SOL·260910·042" (dot-separated compact)
  const dateStr = formatEngTimestamp(new Date().toISOString()).slice(0, 6);
  return `${prefix}·${dateStr}·${String(num).padStart(3, '0')}`;
}
```

---

## 3. خريطة الملفات المطلوبة للتحديث

```
/styles/
  ├── visual-tokens.css   ← أضف قسم "ENGINEERING CONSOLE TOKENS" (فقرة 2.1)
  └── theme.css           ← أضف كلاسات .stage-node-eng, .eng-table, إلخ (فقرة 2.2)

/utils/
  └── theme.ts            ← أضف engStageColor(), formatEngTimestamp(), formatEngId() (فقرة 2.3)

/components/
  ├── ui/
  │   ├── EngBadge.tsx       ← شارة بالطابع الهندسي (monospace + brass chip)
  │   ├── EngDataTable.tsx   ← جدول blueprint مع خطوط hairline
  │   ├── EngSLATimer.tsx    ← مؤقت SLA بنمط عسكري/هندسي
  │   └── EngStageNode.tsx   ← عقدة مرحلة بزوايا tick-mark
  └── workflow/
      └── VisualWorkflowGraph.tsx  ← أضف prop `engineerStyle?: boolean`
```

---

## 4. طريقة التطبيق — خطوات عملية مرتبة

### الخطوة 1: إضافة الـ Tokens (5 دقائق)
```bash
# افتح styles/visual-tokens.css
# أضف القسم التالي قبل نهاية :root
```
انسخ محتوى **فقرة 2.1** بالكامل وألصقه. احفظ الملف.

### الخطوة 2: إضافة الكلاسات (10 دقائق)
```bash
# افتح styles/theme.css
# أضف القسم بعد نهاية الوضع الفاتح (قبل @mediaprefers-color-scheme: dark)
```
انسخ محتوى **فقرة 2.2** بالكامل. احفظ الملف.

### الخطوة 3: تحديث `utils/theme.ts` (5 دقائق)
```bash
# افتح utils/theme.ts
# أضف الدوال الجديدة في نهاية الملف
```
انسخ محتوى **فقرة 2.3**. احفظ الملف.

### الخطوة 4: إنشاء المكونات الأربعة (45 دقيقة)

#### `components/ui/EngBadge.tsx`
```tsx
import React from 'react';

type EngBadgeVariant = 'approve' | 'reject' | 'pending' | 'info' | 'brass';

const variantStyles: Record<EngBadgeVariant, { bg: string; text: string; border: string }> = {
  approve: { bg: '#E5F1EA', text: '#1F7A4E', border: '#1F7A4E' },
  reject:  { bg: '#F5E6E3', text: '#AE3B2E', border: '#AE3B2E' },
  pending: { bg: '#F5EBD8', text: '#B0791E', border: '#B0791E' },
  info:    { bg: '#E5EEF0', text: '#4B7B8A', border: '#669CA8' },
  brass:   { bg: '#D7C29A', text: '#615139', border: '#9C7A2E' },
};

interface EngBadgeProps {
  variant?: EngBadgeVariant;
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}

export const EngBadge: React.FC<EngBadgeProps> = ({
  variant = 'info',
  children,
  mono = false,
  className = '',
}) => {
  const s = variantStyles[variant];
  return (
    <span
      className={`eng-brass-chip ${className}`}
      style={{
        background: s.bg,
        color: s.text,
        borderColor: s.border,
        fontFamily: mono ? 'var(--eng-font-mono)' : 'var(--eng-font-tech)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.text,
          display: 'inline-block',
        }}
      />
      {children}
    </span>
  );
};
```

#### `components/ui/EngDataTable.tsx`
```tsx
import React, { ReactNode } from 'react';

interface EngDataTableProps {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
}

export const EngDataTable: React.FC<EngDataTableProps> = ({ headers, rows, className = '' }) => (
  <table className={`eng-table ${className}`}>
    <thead>
      <tr>
        {headers.map((h, i) => (
          <th key={i} style={{ fontFamily: 'var(--eng-font-mono)' }}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri}>
          {row.map((cell, ci) => (
            <td key={ci} style={{ fontFamily: 'var(--eng-font-mono)' }}>{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
```

#### `components/ui/EngSLATimer.tsx`
```tsx
import React, { useEffect, useState } from 'react';

interface EngSLATimerProps {
  dueDate: string;       // ISO string
  label?: string;
}

export const EngSLATimer: React.FC<EngSLATimerProps> = ({ dueDate, label = 'SLA' }) => {
  const [remaining, setRemaining] = useState<string>('--:--:--');
  const [state, setState] = useState<'ok' | 'warning' | 'overdue'>('ok');

  useEffect(() => {
    const tick = () => {
      const diff = new Date(dueDate).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('00:00:00');
        setState('overdue');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      );
      setState(h < 24 ? 'warning' : 'ok');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dueDate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'var(--eng-font-mono)', fontSize: 11, color: 'var(--eng-steel)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span className={`eng-sla-timer ${state === 'overdue' ? 'overdue' : state === 'warning' ? '' : 'approved'}`}>
        {remaining}
      </span>
    </div>
  );
};
```

#### `components/ui/EngStageNode.tsx`
```tsx
import React from 'react';

interface EngStageNodeProps {
  code: string;
  titleAr: string;
  titleEn?: string;
  status: 'completed' | 'active' | 'pending' | 'rejected';
  slaDays?: number;
  assignedOrg?: string;
  onClick?: () => void;
}

const statusColors = {
  completed: '#1F7A4E',
  active:    '#B0791E',
  pending:   '#7C8890',
  rejected:  '#AE3B2E',
};

export const EngStageNode: React.FC<EngStageNodeProps> = ({
  code, titleAr, titleEn, status, slaDays, assignedOrg, onClick,
}) => {
  const color = statusColors[status];
  return (
    <div
      className="stage-node-eng"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', borderRight: `3px solid ${color}` }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="eng-code">{code}</span>
        {slaDays != null && (
          <span style={{ fontFamily: 'var(--eng-font-mono)', fontSize: 11, color: 'var(--eng-steel)' }}>
            SLA {slaDays}d
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--eng-font-tech)', fontSize: 14, color: 'var(--eng-ink)', fontWeight: 600 }}>
        {titleAr}
      </div>
      {titleEn && (
        <div style={{ fontFamily: 'var(--eng-font-mono)', fontSize: 11, color: 'var(--eng-steel)', marginTop: 2 }}>
          {titleEn}
        </div>
      )}
      {assignedOrg && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--eng-steel-dark)', fontFamily: 'var(--eng-font-mono)' }}>
          ▸ {assignedOrg}
        </div>
      )}
    </div>
  );
};
```

### الخطوة 5: تحديث المكونات الموجودة (30 دقيقة)

#### `VisualWorkflowGraph.tsx` — أضف `engineerStyle` prop
```tsx
// في نهاية الـ props interface:
interface VisualWorkflowGraphProps {
  stages: WorkflowStage[];
  currentStageId?: string;
  engineerStyle?: boolean;  // ← أضف هذا السطر
  // ... باقي الـ props
}

// عند رسم العقدة:
{engineerStyle ? (
  <EngStageNode
    code={stage.code}
    titleAr={stage.nameAr}
    titleEn={stage.nameEn}
    status={getStageStatus(stage.id)}
    slaDays={stage.slaDays}
    assignedOrg={orgName}
    onClick={() => onStageClick?.(stage.id)}
  />
) : (
  <div className="stage-node">{/* الكود القديم */}</div>
)}
```

### الخطوة 6: التحقق من البناء
```bash
cd C:\Downloads\INDUSTRIAL_INITIATIVES\frontend
npx tsc --noEmit
npm run build
```

---

## 5. خريطة الاستخدام — متى تُستخدم أي هوية

| الشاشة / المكوّن | الهوية المعتمدة | السبب |
|---|---|---|
| `/admin/dashboard` | **Engineering Console** (`read.md` tokens) | شاشة تشغيل تحتاج قراءة سريعة للبيانات والأرقام |
| `/admin/workflow-builder` | **Engineering Console** | محرر مسارات يحتاج دقة هندسية |
| `/admin/applications/:id` | **Engineering Console** | محطة مراجعة تحتاج تواريخ/أرقام بالأسلوب العسكري |
| `/` (بوابة الاستكشاف العامة) | **Egyptian Institutional** (`VISUAL_IDENTITY.md`) |面向 المصانع والمستثمرين — هوية وطنية |
| `/initiative/:id` (صفحة هبوط) | **Egyptian Institutional** | عرض عام — احترام الهوية الحكومية |
| `/factory/...` (بوابة المصانع) | **Egyptian Institutional** | المستخدم العام يفضل البساطة والوضوح |
| جداول البيانات المعمّمة | كلاهما حسب السياق | اختر حسب نوع المستخدم |

---

## 6. قائمة التحقق النهائية (Checklist)

- [x] تم إضافة `--eng-*` tokens إلى `visual-tokens.css`
- [x] تم إضافة `.stage-node-eng`, `.eng-table`, `.eng-brass-chip` إلى `theme.css`
- [x] تم إضافة `engStageColor()`, `formatEngTimestamp()`, `formatEngId()` إلى `theme.ts`
- [x] تم إنشاء `EngBadge.tsx` في `components/ui/`
- [x] تم إنشاء `EngDataTable.tsx` في `components/ui/`
- [x] تم إنشاء `EngSLATimer.tsx` في `components/ui/`
- [x] تم إنشاء `EngStageNode.tsx` في `components/ui/`
- [x] تم تحديث `VisualWorkflowEditor.tsx` بإضافة `engineerStyle` prop
- [x] `npx tsc --noEmit` → exit 0
- [x] `npm run build` → ناجح (1613 modules)
- [x] إزالة اللون الأزرق (#1E40AF) من `--status-pending-text` وتحويله إلى كهرماني (#B0791E)
- [x] لا توجد `hex` values جديدة في `.tsx` خارج `visual-tokens.css` و `reports.ts`
- [x] تم اختبار RTL في الوضع الهندسي (الجدول والعُقَد)

---

**تم التنفيذ الكامل بتاريخ 2026-09-10**

---

## 7. طريقة التحديث (Update Method Summary)

### لأهداف التصميم البسيط (Color swap only)
```bash
# عدّل فقط visual-tokens.css:
# غير قيم --eng-* tokens دون تغيير هيكل الكود
```

### لإضافة مود جديد (New component)
```bash
# 1. أضف token جديد في visual-tokens.css
# 2. أضف كلاسه في theme.css
# 3. أنشئ مكونه في components/ui/
# 4. استورده في الصفحة المستهدفة
```

### لتفعيل النمط الهندسي في لوحة إدارة موجودة
```tsx
// في أي view page:
<VisualWorkflowGraph
  stages={stages}
  engineerStyle={true}   // ← مفتاح التشغيل
/>
```

### لإعادة العودة للهوية المصرية المؤسسية
```tsx
// فقط احذف أو اجعل engineerStyle=false
<VisualWorkflowGraph
  stages={stages}
  engineerStyle={false}
/>
```

---

**✅ تم التنفيذ الكامل بتاريخ 2026-09-10**
