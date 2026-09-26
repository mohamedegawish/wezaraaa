import { getDb, nowIso, parseJson } from '../db/sqlite.js';
import { newId } from './helpers.js';

// طابور البريد الصادر — القرار يسجّل الرسالة فقط، والعامل (jobs/mailQueue.ts) يرسل مع إعادة المحاولة.

export type OutboxStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface OutboxEmail {
  id: string;
  kind: string;
  refType: string;
  refId: string;
  recipients: string[];
  subject: string;
  html: string;
  text: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string;
  nextAttemptAt: string;
  createdAt: string;
  sentAt: string;
}

/** Retry back-off after the Nth failed attempt (minutes). The 5th failure is final. */
const BACKOFF_MIN = [1, 5, 15, 60];
export const MAX_ATTEMPTS = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOutbox(r: any): OutboxEmail {
  return {
    id: r.id, kind: r.kind, refType: r.refType, refId: r.refId,
    recipients: parseJson<string[]>(r.recipients, []),
    subject: r.subject, html: r.html, text: r.text,
    status: r.status, attempts: Number(r.attempts ?? 0), lastError: r.lastError ?? '',
    nextAttemptAt: r.nextAttemptAt ?? '', createdAt: r.createdAt, sentAt: r.sentAt ?? '',
  };
}

export function enqueueEmail(input: {
  kind: string; refType: string; refId: string; recipients: string[];
  subject: string; html: string; text: string;
  /** 'skipped' records an audit trail without ever sending (mail not configured / no recipients). */
  status?: 'pending' | 'skipped';
  reason?: string;
}): OutboxEmail {
  const id = newId('mail');
  const now = nowIso();
  getDb().prepare(
    `INSERT INTO email_outbox (id, kind, refType, refId, recipients, subject, html, text, status, lastError, nextAttemptAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.kind, input.refType, input.refId, JSON.stringify(input.recipients), input.subject, input.html, input.text,
    input.status ?? 'pending', input.reason ?? '', now, now);
  return getOutboxEmail(id) as OutboxEmail;
}

export function getOutboxEmail(id: string): OutboxEmail | null {
  const r = getDb().prepare('SELECT * FROM email_outbox WHERE id = ?').get(id);
  return r ? toOutbox(r) : null;
}

/** Pending emails whose retry time has come, oldest first. */
export function listDue(nowIsoStr: string, limit = 20): OutboxEmail[] {
  return (getDb().prepare(
    "SELECT * FROM email_outbox WHERE status = 'pending' AND nextAttemptAt <= ? ORDER BY createdAt ASC, rowid ASC LIMIT ?",
  ).all(nowIsoStr, limit)).map(toOutbox);
}

export function markSent(id: string, atIso: string, result: 'sent' | 'skipped'): void {
  getDb().prepare("UPDATE email_outbox SET status = ?, sentAt = ?, attempts = attempts + 1, lastError = ? WHERE id = ?")
    .run(result, atIso, result === 'skipped' ? 'not delivered (mail disabled / non-production without MAIL_REDIRECT_TO)' : '', id);
}

/** Records a failure; schedules a retry with back-off or gives up after MAX_ATTEMPTS. */
export function markRetry(id: string, nowMs: number, error: string): OutboxStatus {
  const row = getOutboxEmail(id);
  if (!row) return 'failed';
  const attempts = row.attempts + 1;
  const final = attempts >= MAX_ATTEMPTS;
  const next = new Date(nowMs + (BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000)).toISOString();
  getDb().prepare('UPDATE email_outbox SET attempts = ?, lastError = ?, status = ?, nextAttemptAt = ? WHERE id = ?')
    .run(attempts, error.slice(0, 500), final ? 'failed' : 'pending', final ? '' : next, id);
  return final ? 'failed' : 'pending';
}

export function markExpired(id: string): void {
  getDb().prepare("UPDATE email_outbox SET status = 'failed', lastError = 'expired (older than 48h, not sent)' WHERE id = ?").run(id);
}

export function listOutbox(refType: string, refId: string): OutboxEmail[] {
  return (getDb().prepare('SELECT * FROM email_outbox WHERE refType = ? AND refId = ? ORDER BY createdAt ASC, rowid ASC')
    .all(refType, refId)).map(toOutbox);
}
