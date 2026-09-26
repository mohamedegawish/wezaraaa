import { detailsTable, escapeHtml, paragraph, renderEmail, statusPanel } from './layout.js';

// قوالب رسائل مركز المراسلات — على القالب الرسمي الموحد (layout.ts).
export { escapeHtml };

function arCount(n: number): string {
  if (n === 1) return 'رسالة جديدة';
  if (n === 2) return 'رسالتان جديدتان';
  if (n <= 10) return `${n} رسائل جديدة`;
  return `${n} رسالة جديدة`;
}

export interface ChatReminderItem {
  fromNameAr: string;
  fromNameEn: string;
  count: number;
}

/**
 * Reminder email to an organization with unread messages (from one or more peer organizations).
 * Deliberately carries NO message content (government confidentiality).
 */
export function chatReminderEmail(input: { orgNameAr: string; orgNameEn: string; items: ChatReminderItem[]; appUrl: string }) {
  const link = `${input.appUrl}/#chat`;
  const total = input.items.reduce((s, i) => s + i.count, 0);
  const countAr = arCount(total);
  const countEn = `${total} new message${total === 1 ? '' : 's'}`;
  const single = input.items.length === 1 ? input.items[0] : null;
  const fromAr = single ? `من ${single.fromNameAr}` : `من ${input.items.length} جهات`;
  const subject = `تذكير: لديكم ${countAr} ${fromAr}`;

  const html = renderEmail({
    preheader: `لديكم ${countAr} في مركز المراسلات لم تتم قراءتها بعد.`,
    heading: 'تذكير من مركز المراسلات',
    bodyHtml: [
      paragraph(`السادة / <strong>${escapeHtml(input.orgNameAr)}</strong>`),
      paragraph('تحية طيبة وبعد،'),
      statusPanel('info', `لديكم ${countAr}`, `${fromAr} في مركز المراسلات بالمنصة الوطنية للتمويل والمبادرات الصناعية لم تتم قراءتها بعد.`),
      input.items.length > 1 ? detailsTable(input.items.map((i) => [i.fromNameAr, arCount(i.count)])) : '',
      paragraph('<span style="font-size:13px;color:#64748B;">حفاظاً على سرية المراسلات الحكومية لا يتضمن هذا البريد محتوى الرسائل — يرجى تسجيل الدخول للاطلاع والرد. لن نرسل تذكيراً آخر بخصوص هذه الرسائل حتى تتم قراءتها.</span>'),
    ].join(''),
    cta: { label: 'فتح مركز المراسلات', href: link },
    englishSummary: `${input.orgNameEn} has ${countEn} from ${input.items.map((i) => i.fromNameEn).join(', ')} in the message center.`,
  });

  const text = [
    `السادة/ ${input.orgNameAr}`,
    '',
    `لديكم ${countAr} ${fromAr} في مركز المراسلات لم تتم قراءتها بعد.`,
    ...(input.items.length > 1 ? input.items.map((i) => `- ${i.fromNameAr}: ${arCount(i.count)}`) : []),
    `للاطلاع والرد: ${link}`,
    '',
    `Reminder: ${input.orgNameEn} has ${countEn} in the message center. Open: ${link}`,
    '',
    'هذه رسالة آلية — يرجى عدم الرد عليها.',
  ].join('\n');

  return { subject, html, text };
}
