// المصدر الوحيد للألوان في TypeScript — لا hex داخل المكونات.
// لتغيير لون: عدّل CSS في styles/theme.css، وإن كان لونا منطقيا
// جديدا (حالة/مرحلة) أضفه هنا + متغير CSS مطابق.

/** لوحة مراحل مسار العمل — بديل colorCode المبعثرة. */
export const STAGE_COLORS: string[] = [
  'var(--stage-1)',
  'var(--stage-2)',
  'var(--stage-3)',
  'var(--stage-4)',
  'var(--stage-5)',
  'var(--stage-6)',
];

/** Degree → solid hex color (HSL-based warm gradient). */
export const DEGREE_COLORS: [number, string][] = [
  [1, '#0E6B65'],   // teal    – entry
  [2, '#1A8A72'],   // medium-teal
  [3, '#5BA349'],   // green   – processing
  [4, '#B0791E'],   // amber   – advanced
  [5, '#D4930A'],   // gold    – near-complete
  [6, '#C8102E'],   // crimson – final/critical
];

/** Convert HSL to #RRGGBB. */
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r=c; g=x; b=0; }
  else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; }
  else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; }
  else              { r=c; g=0; b=x; }
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Get solid hex for a stage degree (1-based). Falls back to nearest preset. */
export function degreeColor(degree: number): string {
  const d = Math.max(1, Math.min(6, Math.round(degree)));
  const match = DEGREE_COLORS.find(([deg]) => deg === d);
  return match ? match[1] : DEGREE_COLORS[DEGREE_COLORS.length - 1][1];
}

/** Parse #hex or rgb() → {h, s, l}. */
export function parseColor(hex: string): { h: number; s: number; l: number } | null {
  if (!hex) return null;
  if (hex.startsWith('#')) {
    const v = parseInt(hex.slice(1), 16);
    if (isNaN(v)) return null;
    const r = ((v >> 16) & 255) / 255;
    const g = ((v >> 8) & 255) / 255;
    const b = (v & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  return null;
}

export function stageColor(orderOrIndex: number): string {
  const i = Math.max(0, orderOrIndex - 1);
  return STAGE_COLORS[i % STAGE_COLORS.length] ?? 'var(--stage-fallback)';
}

export type StatusTone = 'approved' | 'pending' | 'rework' | 'rejected' | 'draft' | 'gold' | 'teal';

/** يحوّل أي حالة نصية (عربي/إنجليزي/كود) إلى tone موحد للشارات. */
export function statusTone(status: string | undefined | null): StatusTone {
  const s = (status ?? '').toString().trim().toLowerCase();
  if (['approved', 'completed', 'verified', 'active', 'مقبول', 'معتمد', 'مكتمل', 'نشط', 'تم'].includes(s)) return 'approved';
  if (['rejected', 'مرفوض', 'مرفوضة'].includes(s)) return 'rejected';
  if (['pending_documents', 'rework', 'pending', 'استيفاء', 'بانتظار'].includes(s)) return 'rework';
  if (['submitted', 'in_progress', 'under_review', 'قيد', 'مقدم'].includes(s)) return 'pending';
  if (['gold', 'featured', 'مميز'].includes(s)) return 'gold';
  if (['teal', 'info', 'معلومة'].includes(s)) return 'teal';
  return 'draft';
}

export const THEME_STORAGE_KEY = 'egypt_ind_theme_v1';
export type ThemeMode = 'light' | 'dark';

export function getTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return 'light';
}

/** يفعّل الوضع الليلي عبر data-theme على <html> (الخطاف جاهز في theme.css). */
export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch { /* ignore */ }
  if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

export function initTheme(): void {
  if (getTheme() === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
}

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
  const dateStr = formatEngTimestamp(new Date().toISOString()).slice(0, 6);
  return `${prefix}·${dateStr}·${String(num).padStart(3, '0')}`;
}
