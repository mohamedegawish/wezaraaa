import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { LOGO_CID, logoAttachment } from './layout.js';

// Gmail SMTP (App Password) — تذكيرات مركز المراسلات.
export interface MailAttachment {
  filename: string;
  path: string;
  cid?: string;
}

export interface MailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

/** 'sent' = delivered to SMTP; 'skipped' = intentionally not delivered (non-prod without redirect). */
export type MailResult = 'sent' | 'skipped';
export type MailSender = (m: MailMessage) => Promise<MailResult>;

let testSender: MailSender | null = null;
let transport: Transporter | null = null;
let transportKey = '';

/** Tests inject a fake sender (null restores SMTP). */
export function setMailSenderForTests(fn: MailSender | null): void {
  testSender = fn;
}

export function isMailConfigured(): boolean {
  return Boolean(testSender) || Boolean(config.gmailUser && config.gmailAppPassword);
}

function getTransport(): Transporter {
  const key = `${config.gmailUser}:${config.gmailAppPassword}`;
  if (!transport || key !== transportKey) {
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.gmailUser, pass: config.gmailAppPassword },
    });
    transportKey = key;
  }
  return transport;
}

export async function sendMail(input: MailMessage): Promise<MailResult> {
  // Official layout embeds the ministry logo as CID — attach it automatically when referenced.
  const logo = input.html.includes(`cid:${LOGO_CID}`) ? logoAttachment() : null;
  const m: MailMessage = logo && !(input.attachments ?? []).some((a) => a.cid === LOGO_CID)
    ? { ...input, attachments: [...(input.attachments ?? []), logo] }
    : input;
  if (testSender) return testSender(m);
  if (!isMailConfigured()) {
    console.warn('[mail] GMAIL_USER / GMAIL_APP_PASSWORD not set — email skipped');
    return 'skipped';
  }
  let to = m.to;
  let subject = m.subject;
  if (!config.mailSendReal) {
    // Safety net: seed data holds real-looking government addresses — never mail them from dev.
    if (!config.mailRedirectTo) {
      console.log(`[mail] non-production: skipped reminder to ${m.to.join(', ')} (set MAIL_REDIRECT_TO to receive it)`);
      return 'skipped';
    }
    to = [config.mailRedirectTo];
    subject = `[→ ${m.to.join(', ')}] ${m.subject}`;
  }
  await getTransport().sendMail({
    from: { name: config.mailFromName, address: config.gmailUser },
    to,
    subject,
    html: m.html,
    text: m.text,
    attachments: m.attachments,
  });
  return 'sent';
}
