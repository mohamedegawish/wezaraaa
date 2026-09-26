import { isMailConfigured, sendMail, type MailSender } from '../mail/mailer.js';
import { listDue, markExpired, markRetry, markSent } from '../store/emailOutbox.js';

// عامل طابور البريد: يرسل المستحق من email_outbox مع إعادة المحاولة (1، 5، 15، 60 دقيقة ثم فشل نهائي).
const SWEEP_MS = 20_000;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface OutboxRunResult { sent: number; skipped: number; retried: number; failed: number }

export async function processOutbox(opts: { now?: Date; send?: MailSender; limit?: number } = {}): Promise<OutboxRunResult> {
  const now = opts.now ?? new Date();
  const send = opts.send ?? sendMail;
  const res: OutboxRunResult = { sent: 0, skipped: 0, retried: 0, failed: 0 };
  for (const m of listDue(now.toISOString(), opts.limit ?? 20)) {
    // Never deliver stale news (e.g. SMTP was down for days) — mark it instead.
    if (now.getTime() - new Date(m.createdAt).getTime() > MAX_AGE_MS) {
      markExpired(m.id);
      res.failed++;
      continue;
    }
    try {
      const r = await send({ to: m.recipients, subject: m.subject, html: m.html, text: m.text });
      markSent(m.id, now.toISOString(), r);
      if (r === 'sent') res.sent++; else res.skipped++;
    } catch (e) {
      const status = markRetry(m.id, now.getTime(), e instanceof Error ? e.message : String(e));
      if (status === 'failed') res.failed++; else res.retried++;
      console.error(`[mail-queue] ${m.kind} ${m.refId} attempt failed:`, e instanceof Error ? e.message : e);
    }
  }
  return res;
}

let timer: NodeJS.Timeout | null = null;
let running = false;
let again = false;

async function run(): Promise<void> {
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      const r = await processOutbox();
      if (r.sent || r.failed || r.retried) console.log(`[mail-queue] sent=${r.sent} retried=${r.retried} failed=${r.failed} skipped=${r.skipped}`);
    } while (again);
  } catch (e) {
    console.error('[mail-queue] sweep error:', e);
  } finally {
    running = false;
  }
}

/** Near-instant delivery after a decision (the interval is only the safety net / retry clock). */
export function kickMailQueue(): void {
  if (!timer) return; // worker not started (tests / mail disabled)
  setImmediate(() => { void run(); });
}

export function startMailQueue(): void {
  if (timer) return;
  if (!isMailConfigured()) {
    console.log('[mail-queue] disabled — set GMAIL_USER and GMAIL_APP_PASSWORD to email factories on every stage update');
    return;
  }
  console.log('[mail-queue] enabled — factory stage-update emails');
  timer = setInterval(() => { void run(); }, SWEEP_MS);
  timer.unref();
  void run();
}

export function stopMailQueue(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
