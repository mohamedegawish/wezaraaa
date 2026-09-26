import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

// بريد المنشأة الرسمي مع كل تحديث في مراحل طلبها (عبر طابور email_outbox).
const env = isolateTestEnv('factory-notify'); // also blanks GMAIL_* so no real mailbox is ever reached

type Sent = { to: string[]; subject: string; html: string; text: string; attachments?: Array<{ cid?: string }> };
const sent: Sent[] = [];
let base = '';
let close = async () => {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mailer: any; let queue: any; let outbox: any; let apps: any;

before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
  mailer = await import('../src/mail/mailer.js');
  queue = await import('../src/jobs/mailQueue.js');
  outbox = await import('../src/store/emailOutbox.js');
  apps = await import('../src/store/applications.js');
  mailer.setMailSenderForTests(async (m: Sent) => { sent.push(m); return 'sent'; });
});
after(async () => { mailer.setMailSenderForTests(null); await close(); await env.cleanup(); });

const ADMIN = 'user-admin';
const MANAGER = 'user-manager';
const IDA = 'user-ida';
const EEHC = 'user-eehc';

async function create(factoryId: string): Promise<{ id: string; no: string }> {
  const r = await jfetch(`${base}/applications`, {
    method: 'POST', headers: H(ADMIN),
    body: { initiativeId: 'init-solar-2026', factoryId, formData: { requestedCapacityKW: 900 } },
  });
  assert.equal(r.status, 201);
  const d = r.json.data as { id: string; applicationNumber: string };
  return { id: d.id, no: d.applicationNumber };
}
const decide = (id: string, as: string, action: string, comments = '') =>
  jfetch(`${base}/applications/${id}/decisions`, { method: 'POST', headers: H(as), body: { action, comments } });
const rows = (id: string) => outbox.listOutbox('application', id) as Array<{ kind: string; status: string; recipients: string[]; attempts: number; nextAttemptAt: string; lastError: string }>;
async function flush(): Promise<Sent[]> {
  const before = sent.length;
  await queue.processOutbox();
  return sent.slice(before);
}

describe('factory stage-update emails', () => {
  let app = { id: '', no: '' };

  it('submission → «تم استلام طلبكم» to the factory contact + owner (de-duplicated), with the logo', async () => {
    app = await create('factory-sewedy');
    const r = rows(app.id);
    assert.equal(r.length, 1);
    assert.equal(r[0].kind, 'factory_submitted');
    assert.equal(r[0].status, 'pending');
    assert.deepEqual(r[0].recipients, ['m.sewedy@elsewedy-ind.com']);
    const [m] = await flush();
    assert.match(m.subject, new RegExp(app.no));
    assert.match(m.html, /تم استلام طلبكم بنجاح/);
    assert.match(m.html, /مصنع السويدي/);
    assert.match(m.html, /المراجعة الأولية/);
    assert.match(m.html, /#my-initiatives/);
    assert.ok(m.attachments?.some((a) => a.cid === 'platform-logo'), 'ministry logo embedded as CID');
    assert.equal(rows(app.id)[0].status, 'sent');
  });

  it('stage approval → email names the approving org, the next stage/org and carries the comment', async () => {
    assert.equal((await decide(app.id, MANAGER, 'approve', 'تم التحقق من البيانات الأساسية للمنشأة')).status, 200);
    const [m] = await flush();
    assert.equal(rows(app.id).at(-1)?.kind, 'factory_stage_approved');
    assert.match(m.subject, /اعتماد مرحلة «المراجعة الأولية — الوزارة»/);
    assert.match(m.html, /تم التحقق من البيانات الأساسية للمنشأة/);
    assert.match(m.html, /تسجيل المصنع/);
    assert.match(m.html, /الهيئة العامة للتنمية الصناعية/);
    assert.match(m.html, /المرحلة 2 من 9/);
  });

  it('escalation is internal — no email to the factory', async () => {
    const count = rows(app.id).length;
    assert.equal((await decide(app.id, IDA, 'escalate', 'استفسار داخلي للوزارة')).status, 200);
    assert.equal(rows(app.id).length, count);
  });

  it('rework → «مطلوب استيفاء» with the (escaped) request', async () => {
    const note = 'يرجى إرفاق السجل الصناعي المحدث\n<script>alert(1)</script>';
    assert.equal((await decide(app.id, IDA, 'request_rework', note)).status, 200);
    const [m] = await flush();
    assert.equal(rows(app.id).at(-1)?.kind, 'factory_rework');
    assert.match(m.subject, /مطلوب استيفاء/);
    assert.match(m.html, /يرجى إرفاق السجل الصناعي المحدث<br>/);
    assert.ok(m.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'comment must be escaped');
    assert.ok(!m.html.includes('<script>alert(1)'), 'no raw script in email');
    assert.match(m.text, /يرجى إرفاق السجل الصناعي المحدث/);
  });

  it('rejection → «قرار بشأن طلبكم» with the reasons', async () => {
    assert.equal((await decide(app.id, IDA, 'reject', 'عدم استيفاء اشتراطات الأهلية الفنية')).status, 200);
    const [m] = await flush();
    assert.equal(rows(app.id).at(-1)?.kind, 'factory_rejected');
    assert.match(m.subject, new RegExp(`قرار بشأن طلبكم ${app.no}`));
    assert.match(m.html, /عدم الموافقة على الطلب/);
    assert.match(m.html, /عدم استيفاء اشتراطات الأهلية الفنية/);
  });

  it('final approval → «اعتماد نهائي» when the last stage is approved', async () => {
    const a2 = await create('factory-1');
    await flush();
    for (let i = 0; i < 8; i++) apps.applyDecision(a2.id, 'approve', 'fast-forward', 'user-admin');
    assert.equal((await decide(a2.id, EEHC, 'approve', 'تم الربط والتشغيل بنجاح')).status, 200);
    const [m] = await flush();
    assert.equal(rows(a2.id).at(-1)?.kind, 'factory_completed');
    assert.deepEqual(m.to, ['factory@nile.eg']);
    assert.match(m.subject, /اعتماد نهائي/);
    assert.match(m.html, /اكتمل مسار طلبكم/);
    assert.match(m.html, /تم الربط والتشغيل بنجاح/);
  });

  it('SMTP failure is retried with back-off, then delivered', async () => {
    const a3 = await create('factory-1');
    const t0 = new Date();
    const fail = await queue.processOutbox({ now: t0, send: async () => { throw new Error('smtp down'); } });
    assert.equal(fail.retried, 1);
    let r = rows(a3.id)[0];
    assert.equal(r.status, 'pending');
    assert.equal(r.attempts, 1);
    assert.ok(r.nextAttemptAt > t0.toISOString(), 'retry scheduled in the future');
    const early = await queue.processOutbox({ now: new Date(t0.getTime() + 20_000) });
    assert.equal(early.sent, 0, 'not before the back-off');
    const later = await queue.processOutbox({ now: new Date(t0.getTime() + 2 * 60_000) });
    assert.equal(later.sent, 1);
    r = rows(a3.id)[0];
    assert.equal(r.status, 'sent');
  });

  it('no factory email on file → recorded as skipped (audit), never sent', async () => {
    const a4 = await create('factory-delta');
    const r = rows(a4.id)[0];
    assert.equal(r.status, 'skipped');
    assert.match(r.lastError, /no factory email/);
  });

  it('mail not configured → recorded as skipped (no backlog replay later)', async () => {
    mailer.setMailSenderForTests(null);
    try {
      const a5 = await create('factory-1');
      const r = rows(a5.id)[0];
      assert.equal(r.status, 'skipped');
      assert.match(r.lastError, /not configured/);
    } finally {
      mailer.setMailSenderForTests(async (m: Sent) => { sent.push(m); return 'sent'; });
    }
  });
});
