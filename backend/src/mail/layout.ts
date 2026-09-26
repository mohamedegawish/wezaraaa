import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

// ============================================================================
// القالب الرسمي الموحد لكل رسائل المنصة (بريد المنشآت + تذكيرات مركز المراسلات).
// جداول + ستايل inline فقط (Gmail / Outlook / الموبايل)، RTL، ألوان صريحة تتحمل الوضع الداكن.
// كل قيمة ديناميكية يجب أن تمر عبر escapeHtml قبل وضعها في bodyHtml.
// ============================================================================

export const LOGO_CID = 'platform-logo';

export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Multi-line user text (comments) → escaped HTML with <br>. */
export function escapeMultiline(s: unknown): string {
  return escapeHtml(s).replace(/\r?\n/g, '<br>');
}

let logoPathCache: string | null | undefined;

/** Ministry logo embedded as CID (null when the asset is missing — the email still renders). */
export function logoAttachment(): { filename: string; path: string; cid: string } | null {
  if (logoPathCache === undefined) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.join(process.cwd(), 'assets', 'email', 'ministry-logo.png'),       // backend/ (dev + docker /app)
      path.join(here, '..', '..', 'assets', 'email', 'ministry-logo.png'),    // src/mail or dist/mail
      path.join(process.cwd(), 'backend', 'assets', 'email', 'ministry-logo.png'),
    ];
    logoPathCache = candidates.find((p) => fs.existsSync(p)) ?? null;
  }
  return logoPathCache ? { filename: 'ministry-logo.png', path: logoPathCache, cid: LOGO_CID } : null;
}

export type EmailTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export const TONES: Record<EmailTone, { fg: string; bg: string; border: string; bar: string }> = {
  info: { fg: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', bar: '#2563EB' },
  success: { fg: '#047857', bg: '#ECFDF5', border: '#A7F3D0', bar: '#059669' },
  warning: { fg: '#B45309', bg: '#FFFBEB', border: '#FDE68A', bar: '#D97706' },
  danger: { fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', bar: '#DC2626' },
  neutral: { fg: '#334155', bg: '#F8FAFC', border: '#E2E8F0', bar: '#64748B' },
};

const NAVY = '#0B2545';
const RED = '#C8102E';
const FONT = "Tahoma, 'Segoe UI', Arial, sans-serif";

export interface RenderEmailInput {
  /** Hidden inbox-preview line. */
  preheader: string;
  /** Title shown under the header (already plain text — escaped here). */
  heading: string;
  /** Pre-escaped body HTML (use the helpers below). */
  bodyHtml: string;
  cta?: { label: string; href: string };
  /** Short English line under the body (escaped here). */
  englishSummary?: string;
}

export function renderEmail(input: RenderEmailInput): string {
  const logo = logoAttachment();
  const year = new Date().getFullYear();
  const appUrl = escapeHtml(config.appUrl);
  const logoCell = logo
    ? `<img src="cid:${LOGO_CID}" width="56" height="56" alt="وزارة الصناعة" style="display:block;width:56px;height:56px;border:0;border-radius:50%;background:#FFFFFF;">`
    : `<div style="width:56px;height:56px;border-radius:50%;background:#FFFFFF;"></div>`;
  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px 0;">
        <tr><td bgcolor="${RED}" style="background:${RED};border-radius:10px;">
          <a href="${escapeHtml(input.cta.href)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(input.cta.label)}</a>
        </td></tr>
      </table>`
    : '';
  const english = input.englishSummary
    ? `<tr><td dir="ltr" style="padding:14px 32px;border-top:1px solid #EEF2F7;font-family:${FONT};font-size:12px;line-height:1.7;color:#64748B;text-align:left;">${escapeHtml(input.englishSummary)}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#EEF1F5;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEF1F5" style="background:#EEF1F5;">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;">
    <!-- علم مصر -->
    <tr><td style="font-size:0;line-height:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="33%" height="5" bgcolor="${RED}" style="background:${RED};height:5px;"></td>
        <td width="34%" height="5" bgcolor="#FFFFFF" style="background:#FFFFFF;height:5px;"></td>
        <td width="33%" height="5" bgcolor="#111111" style="background:#111111;height:5px;"></td>
      </tr></table>
    </td></tr>
    <!-- الترويسة -->
    <tr><td bgcolor="${NAVY}" style="background:${NAVY};padding:20px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="64" valign="middle" style="width:64px;">${logoCell}</td>
        <td valign="middle" style="padding-right:14px;text-align:right;font-family:${FONT};">
          <div style="font-size:12px;color:#D4B26A;letter-spacing:.3px;">جمهورية مصر العربية — وزارة الصناعة</div>
          <div style="font-size:18px;font-weight:bold;color:#FFFFFF;margin-top:4px;">المنصة الوطنية للتمويل والمبادرات الصناعية</div>
        </td>
      </tr></table>
    </td></tr>
    <!-- العنوان -->
    <tr><td style="padding:26px 32px 6px 32px;text-align:right;font-family:${FONT};">
      <div style="font-size:20px;font-weight:bold;color:${NAVY};line-height:1.5;">${escapeHtml(input.heading)}</div>
      <div style="width:44px;height:3px;background:${RED};margin-top:10px;border-radius:2px;"></div>
    </td></tr>
    <!-- المحتوى -->
    <tr><td style="padding:14px 32px 28px 32px;text-align:right;font-family:${FONT};font-size:15px;line-height:1.9;color:#1F2937;">
      ${input.bodyHtml}
      ${cta}
    </td></tr>
    ${english}
    <!-- التذييل -->
    <tr><td bgcolor="#F8FAFC" style="background:#F8FAFC;padding:18px 32px;border-top:1px solid #EEF2F7;text-align:center;font-family:${FONT};font-size:11.5px;line-height:1.9;color:#94A3B8;">
      هذه رسالة آلية من المنصة الوطنية للتمويل والمبادرات الصناعية — يرجى عدم الرد عليها.<br>
      للاستفسار استخدم المنصة: <a href="${appUrl}" target="_blank" style="color:#475569;text-decoration:underline;">${appUrl}</a><br>
      © ${year} وزارة الصناعة — جمهورية مصر العربية
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Body building blocks (all return pre-escaped HTML)
// ---------------------------------------------------------------------------

export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px 0;">${html}</p>`;
}

/** Coloured status panel. `title`/`text` are plain (escaped here). */
export function statusPanel(tone: EmailTone, title: string, text: string): string {
  const t = TONES[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px 0;">
    <tr><td bgcolor="${t.bg}" style="background:${t.bg};border:1px solid ${t.border};border-right:5px solid ${t.bar};border-radius:10px;padding:14px 18px;text-align:right;">
      <div style="font-size:16px;font-weight:bold;color:${t.fg};">${escapeHtml(title)}</div>
      <div style="font-size:14px;color:#334155;margin-top:4px;line-height:1.8;">${escapeHtml(text)}</div>
    </td></tr>
  </table>`;
}

/** Two-column details table. Values are plain (escaped here). */
export function detailsTable(rows: Array<[string, string]>): string {
  const body = rows.map(([k, v], i) => `<tr>
      <td width="38%" style="padding:10px 14px;background:${i % 2 ? '#FFFFFF' : '#F8FAFC'};border-bottom:1px solid #EEF2F7;font-size:13px;color:#64748B;text-align:right;">${escapeHtml(k)}</td>
      <td style="padding:10px 14px;background:${i % 2 ? '#FFFFFF' : '#F8FAFC'};border-bottom:1px solid #EEF2F7;font-size:14px;font-weight:bold;color:#0F172A;text-align:right;">${escapeHtml(v)}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px 0;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;border-collapse:separate;">${body}</table>`;
}

/** Stage progress bar built from table cells (renders everywhere, no CSS width tricks). */
export function progressBar(done: number, total: number, label: string, tone: EmailTone = 'success'): string {
  const safeTotal = Math.max(1, total);
  const pct = Math.min(100, Math.max(0, Math.round((done / safeTotal) * 100)));
  const fill = TONES[tone].bar;
  return `<div style="margin:0 0 18px 0;">
    <div style="font-size:13px;color:#475569;margin-bottom:6px;">${escapeHtml(label)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;"><tr>
      ${pct > 0 ? `<td width="${pct}%" height="8" bgcolor="${fill}" style="background:${fill};height:8px;font-size:0;line-height:0;">&nbsp;</td>` : ''}
      ${pct < 100 ? `<td height="8" bgcolor="#E2E8F0" style="background:#E2E8F0;height:8px;font-size:0;line-height:0;">&nbsp;</td>` : ''}
    </tr></table>
  </div>`;
}

/** Quoted reviewer note with its author line. */
export function noteBlock(title: string, note: string, byline: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
    <tr><td style="background:#F8FAFC;border-right:4px solid #94A3B8;border-radius:8px;padding:12px 16px;text-align:right;">
      <div style="font-size:12px;font-weight:bold;color:#64748B;margin-bottom:6px;">${escapeHtml(title)}</div>
      <div style="font-size:14px;color:#0F172A;line-height:1.9;">${escapeMultiline(note)}</div>
      ${byline ? `<div style="font-size:12px;color:#94A3B8;margin-top:8px;">${escapeHtml(byline)}</div>` : ''}
    </td></tr>
  </table>`;
}

export function sectionTitle(text: string): string {
  return `<div style="font-size:14px;font-weight:bold;color:#0B2545;margin:4px 0 8px 0;">${escapeHtml(text)}</div>`;
}
