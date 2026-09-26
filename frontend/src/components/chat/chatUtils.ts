import { FileText, FileSpreadsheet, FileImage, Presentation, File as FileIcon } from 'lucide-react';
import { ROLE_DEFAULT_TITLES } from '../../store/state';
import type { UserRole } from '../../types';

// مركز المراسلات — أدوات عرض مشتركة (تسميات الجهات، الوقت، أحجام وأنواع الملفات).

export const ORG_TYPE_META: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  ministry: { ar: 'وزارة', en: 'Ministry', color: '#C8102E', bg: '#FEF2F2' },
  authority: { ar: 'هيئة', en: 'Authority', color: '#1E3A5F', bg: '#EFF6FF' },
  center: { ar: 'مركز', en: 'Center', color: '#0E6B65', bg: '#ECFDF5' },
  bank: { ar: 'بنك', en: 'Bank', color: '#7C3AED', bg: '#F5F3FF' },
  utility: { ar: 'مرفق خدمي', en: 'Utility', color: '#B45309', bg: '#FFFBEB' },
  provider: { ar: 'مقدم خدمة', en: 'Provider', color: '#0369A1', bg: '#F0F9FF' },
};

export function orgTypeMeta(type: string) {
  return ORG_TYPE_META[type] ?? { ar: type, en: type, color: '#475569', bg: '#F1F5F9' };
}

/** 2–3 letter badge: org code when short (IDA, NBE…), else initials of the name. */
export function orgBadge(code: string, name: string): string {
  const c = (code || '').replace(/[^A-Za-z0-9]/g, '');
  if (c && c.length <= 4) return c.toUpperCase();
  const words = (name || code || '?').split(/[\s_-]+/).filter(Boolean);
  const letters = words.slice(0, 2).map(w => w[0]).join('');
  return (letters || '?').toUpperCase();
}

export function roleTitle(role: string, isAr: boolean): string {
  const t = ROLE_DEFAULT_TITLES[role as UserRole];
  return t ? (isAr ? t.ar : t.en) : role;
}

export const OFFICIALS_NAME = { ar: 'إدارة المنصة', en: 'Platform Officials' };

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function timeLabel(iso: string, isAr: boolean): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string, isAr: boolean): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (diff === 0) return isAr ? 'اليوم' : 'Today';
  if (diff === 1) return isAr ? 'أمس' : 'Yesterday';
  return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Compact list timestamp: time today, "أمس", weekday this week, else date. */
export function shortWhen(iso: string, isAr: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (diff === 0) return timeLabel(iso, isAr);
  if (diff === 1) return isAr ? 'أمس' : 'Yesterday';
  if (diff < 7) return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { weekday: 'long' });
  return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' });
}

export function relativeTime(iso: string, isAr: boolean): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return isAr ? 'الآن' : 'just now';
  if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return isAr ? `منذ ${hrs} س` : `${hrs}h ago`;
  return shortWhen(iso, isAr);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Mirrors the backend allow-list (backend stays authoritative — magic-bytes checked there).
export const CHAT_ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx', '.xlsx', '.pptx', '.doc', '.xls', '.txt', '.csv'];
export const CHAT_ACCEPT = CHAT_ALLOWED_EXT.join(',');
export const CHAT_MAX_FILE_MB = 20;
export const CHAT_MAX_FILES = 5;
export const CHAT_MAX_BODY = 4000;

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function fileIconFor(nameOrMime: string) {
  const s = nameOrMime.toLowerCase();
  if (s.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(s)) return { Icon: FileImage, color: '#0E6B65' };
  if (s.includes('spreadsheet') || s.includes('excel') || s.includes('csv') || /\.(xlsx?|csv)$/.test(s)) return { Icon: FileSpreadsheet, color: '#15803D' };
  if (s.includes('presentation') || /\.pptx$/.test(s)) return { Icon: Presentation, color: '#C2410C' };
  if (s.includes('pdf') || s.endsWith('.pdf')) return { Icon: FileText, color: '#C8102E' };
  if (s.includes('word') || /\.docx?$/.test(s)) return { Icon: FileText, color: '#1D4ED8' };
  return { Icon: FileIcon, color: '#475569' };
}
