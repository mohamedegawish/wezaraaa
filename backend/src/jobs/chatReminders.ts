import { config } from '../config.js';
import { getOrganizationById } from '../store/organizations.js';
import {
  listReminderCandidates, markReminderAttempt, markReminderSent, reminderRecipients, type ReminderCandidate,
} from '../store/chat.js';
import { isMailConfigured, sendMail, type MailSender } from '../mail/mailer.js';
import { chatReminderEmail } from '../mail/templates.js';

// التذكير الذكي: رسائل واردة لأي جهة بقيت غير مقروءة ≥ CHAT_REMINDER_DELAY_MIN → بريد واحد للجهة
// يجمع كل المحادثات المعلقة لديها، ولا تذكير آخر لنفس المحادثة حتى تُقرأ (markChatRead يعيد التسليح).
const RETRY_AFTER_MS = 10 * 60_000;

export interface SweepResult {
  sent: number;
  skipped: number;
  failed: number;
}

export async function runChatReminderSweep(opts: { now?: Date; delayMin?: number; send?: MailSender } = {}): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const delayMin = opts.delayMin ?? config.chatReminderDelayMin;
  const send = opts.send ?? sendMail;
  const cutoff = new Date(now.getTime() - delayMin * 60_000).toISOString();
  const retryBefore = new Date(now.getTime() - RETRY_AFTER_MS).toISOString();
  const nowIso = now.toISOString();
  const result: SweepResult = { sent: 0, skipped: 0, failed: 0 };

  // One email per recipient organization, listing every peer it has unread messages from.
  const byOrg = new Map<string, ReminderCandidate[]>();
  for (const c of listReminderCandidates(cutoff, retryBefore)) {
    byOrg.set(c.orgId, [...(byOrg.get(c.orgId) ?? []), c]);
  }

  for (const [orgId, items] of byOrg) {
    const org = getOrganizationById(orgId);
    const to = reminderRecipients(orgId);
    if (!org || to.length === 0) {
      // Nobody to notify — don't re-scan this batch every minute.
      for (const c of items) markReminderSent(c.conversationId, c.side, nowIso);
      result.skipped++;
      continue;
    }
    // Claim first: an overlapping sweep (or crash mid-send) must not double-send.
    for (const c of items) markReminderAttempt(c.conversationId, c.side, nowIso);
    try {
      const mail = chatReminderEmail({
        orgNameAr: org.nameAr,
        orgNameEn: org.nameEn,
        items: items.map((c) => {
          const peer = getOrganizationById(c.peerOrgId);
          return { fromNameAr: peer?.nameAr ?? c.peerOrgId, fromNameEn: peer?.nameEn ?? c.peerOrgId, count: c.unread };
        }),
        appUrl: config.appUrl,
      });
      const r = await send({ to, ...mail });
      for (const c of items) markReminderSent(c.conversationId, c.side, nowIso);
      if (r === 'sent') result.sent++;
      else result.skipped++;
    } catch (e) {
      // Leave SentAt empty → retried after RETRY_AFTER_MS.
      result.failed++;
      console.error(`[chat-reminder] send failed for ${orgId}:`, e instanceof Error ? e.message : e);
    }
  }
  return result;
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startChatReminderJob(): void {
  if (timer) return;
  if (!isMailConfigured()) {
    console.log('[chat-reminder] disabled — set GMAIL_USER and GMAIL_APP_PASSWORD to enable email reminders');
    return;
  }
  const mode = config.mailSendReal ? 'real recipients' : (config.mailRedirectTo ? `redirect → ${config.mailRedirectTo}` : 'log only (non-production)');
  console.log(`[chat-reminder] enabled — delay ${config.chatReminderDelayMin} min, sweep every ${config.chatReminderSweepSec}s, ${mode}`);
  timer = setInterval(() => {
    if (running) return;
    running = true;
    runChatReminderSweep()
      .then((r) => { if (r.sent || r.failed) console.log(`[chat-reminder] sent=${r.sent} skipped=${r.skipped} failed=${r.failed}`); })
      .catch((e) => console.error('[chat-reminder] sweep error:', e))
      .finally(() => { running = false; });
  }, config.chatReminderSweepSec * 1000);
  timer.unref();
}

export function stopChatReminderJob(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
