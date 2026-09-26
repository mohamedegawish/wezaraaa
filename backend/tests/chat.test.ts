import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isolateTestEnv, startServer, jfetch, H } from './helpers.js';

// مركز المراسلات v2: محادثات ثنائية بين أي جهتين + اطلاع الإدارة/المدقق (قراءة فقط).
const env = isolateTestEnv('chat');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const ADMIN = 'user-admin';       // org-ministry
const MANAGER = 'user-manager';   // org-ministry
const AUDITOR = 'user-auditor';   // org-ministry, read-only
const IDA = 'user-ida';           // org-ida
const BANK = 'user-bank';         // org-nbe
const IMC = 'user-imc';           // org-imc
const SOLAR = 'user-solar';       // org-apex-solar
const OWNER = 'user-factory-1';   // factory — forbidden

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const EXE = Buffer.from('MZ\x90\x00this is not a pdf');

type Json = Record<string, unknown>;
type Dir = Array<{ orgId: string; orgType: string; unread: number; conversationId: string | null; lastMessageFromMe: boolean; peerLastReadAt: string }>;

async function sendForm(peerOrgId: string, userId: string, body: string, files: Array<{ name: string; data: Buffer; type?: string }>) {
  const fd = new FormData();
  if (body) fd.append('body', body);
  for (const f of files) fd.append('files', new Blob([f.data], { type: f.type ?? 'application/octet-stream' }), f.name);
  const res = await fetch(`${base}/chat/conversations/${peerOrgId}/messages`, { method: 'POST', headers: { 'x-user-id': userId }, body: fd });
  let json: Json = {};
  try { json = await res.json() as Json; } catch { /* empty */ }
  return { status: res.status, json };
}
const send = (peer: string, as: string, body: string) =>
  jfetch(`${base}/chat/conversations/${peer}/messages`, { method: 'POST', headers: H(as), body: { body } });
const dir = async (as: string) => (await jfetch(`${base}/chat/conversations`, { headers: H(as) })).json.data as Dir;

function chatUploadFiles(): string[] {
  const d = path.join(env.uploadDir, 'chat');
  return fs.existsSync(d) ? fs.readdirSync(d) : [];
}

describe('chat: access and directory', () => {
  it('factory owner is locked out of every chat endpoint', async () => {
    assert.equal((await jfetch(`${base}/chat/conversations`, { headers: H(OWNER) })).status, 403);
    assert.equal((await jfetch(`${base}/chat/unread`, { headers: H(OWNER) })).status, 403);
    assert.equal((await jfetch(`${base}/chat/conversations/org-imc/messages`, { headers: H(OWNER) })).status, 403);
    assert.equal((await send('org-ida', OWNER, 'hi')).status, 403);
    assert.equal((await jfetch(`${base}/chat/oversight`, { headers: H(OWNER) })).status, 403);
  });

  it('officials see every other non-factory organization, unread first', async () => {
    const r = await jfetch(`${base}/chat/conversations`, { headers: H(ADMIN) });
    assert.equal(r.status, 200);
    assert.equal(r.json['orgId'], 'org-ministry');
    assert.equal(r.json['canSend'], true);
    assert.equal(r.json['canOversee'], true);
    const list = r.json.data as Dir;
    const ids = list.map((c) => c.orgId);
    for (const must of ['org-ida', 'org-imc', 'org-nbe', 'org-eehc', 'org-apex-solar']) assert.ok(ids.includes(must), `missing ${must}`);
    assert.ok(!ids.includes('org-ministry'), 'own organization is not a peer');
    assert.ok(!list.some((c) => c.orgType === 'factory'));
    assert.equal(list[0].orgId, 'org-nbe', 'seeded unread message from the bank comes first');
    assert.equal(list[0].unread, 1);
  });

  it('every entity now sees a directory of all organizations (not only the ministry)', async () => {
    const r = await jfetch(`${base}/chat/conversations`, { headers: H(IDA) });
    assert.equal(r.json['orgId'], 'org-ida');
    assert.equal(r.json['canOversee'], false);
    const list = r.json.data as Dir;
    const ids = list.map((c) => c.orgId);
    for (const must of ['org-ministry', 'org-imc', 'org-nbe', 'org-apex-solar', 'org-eehc']) assert.ok(ids.includes(must), `missing ${must}`);
    assert.ok(!ids.includes('org-ida'));
    assert.equal(list.find((c) => c.orgId === 'org-ministry')?.unread, 1, 'seeded ministry message unread');
    assert.ok(list.find((c) => c.orgId === 'org-imc')?.conversationId, 'seeded IDA↔IMC thread exists');
  });

  it('cannot message own organization or a factory', async () => {
    assert.equal((await send('org-ida', IDA, 'self')).status, 400);
    assert.equal((await send('org-factory-1', IDA, 'x')).status, 404);
  });

  it('auditor is read-only: directory yes, sending / unread no', async () => {
    const r = await jfetch(`${base}/chat/conversations`, { headers: H(AUDITOR) });
    assert.equal(r.status, 200);
    assert.equal(r.json['canSend'], false);
    assert.equal(r.json['canOversee'], true);
    assert.equal((await jfetch(`${base}/chat/unread`, { headers: H(AUDITOR) })).json['total'], 0);
    const s = await send('org-ida', AUDITOR, 'x');
    assert.equal(s.status, 403);
    assert.equal(s.json.code, 'READ_ONLY');
  });
});

describe('chat: entity ↔ entity conversations', () => {
  it('IDA messages the bank directly; the bank gets the unread badge', async () => {
    const r = await send('org-nbe', IDA, 'نرجو موافاتنا بقائمة المصانع المتقدمة للتمويل');
    assert.equal(r.status, 201);
    const m = r.json.data as Json;
    assert.equal(m['senderOrgId'], 'org-ida');
    assert.ok(String(m['senderOrgNameAr']).length > 0);
    const u = await jfetch(`${base}/chat/unread`, { headers: H(BANK) });
    const items = u.json['items'] as Array<{ orgId: string; unread: number }>;
    assert.equal(items.find((i) => i.orgId === 'org-ida')?.unread, 1);
    // the ministry's unread is unaffected by a conversation it is not part of
    const mu = await jfetch(`${base}/chat/unread`, { headers: H(ADMIN) });
    assert.ok(!(mu.json['items'] as Array<{ orgId: string }>).some((i) => i.orgId === 'org-ida'), 'IDA→bank message is not in the ministry inbox');
  });

  it('bank reads and replies; IDA sees ✓✓ and the reply', async () => {
    const msgs = await jfetch(`${base}/chat/conversations/org-ida/messages`, { headers: H(BANK) });
    assert.equal((msgs.json.data as unknown[]).length, 1);
    assert.equal((await jfetch(`${base}/chat/conversations/org-ida/read`, { method: 'POST', headers: H(BANK) })).status, 200);
    const idaView = await jfetch(`${base}/chat/conversations/org-nbe/messages`, { headers: H(IDA) });
    const first = (idaView.json.data as Array<{ createdAt: string }>)[0];
    assert.ok(String(idaView.json['peerLastReadAt']) >= first.createdAt, 'bank has read it');
    assert.equal((await send('org-ida', BANK, 'تم، سنرسل القائمة اليوم')).status, 201);
    const d = await dir(IDA);
    const nbe = d.find((c) => c.orgId === 'org-nbe');
    assert.equal(nbe?.unread, 1);
    assert.equal(nbe?.lastMessageFromMe, false);
  });

  it('cursor pagination: before / after', async () => {
    for (let i = 0; i < 3; i++) await send('org-eehc', IDA, `msg ${i}`);
    const latest2 = await jfetch(`${base}/chat/conversations/org-eehc/messages?limit=2`, { headers: H(IDA) });
    const page = latest2.json.data as Array<{ id: string; body: string }>;
    assert.deepEqual(page.map((m) => m.body), ['msg 1', 'msg 2']);
    assert.equal(latest2.json['hasMore'], true);
    const older = await jfetch(`${base}/chat/conversations/org-eehc/messages?before=${page[0].id}`, { headers: H(IDA) });
    assert.deepEqual((older.json.data as Array<{ body: string }>).map((m) => m.body), ['msg 0']);
    const newer = await jfetch(`${base}/chat/conversations/org-eehc/messages?after=${page[0].id}`, { headers: H(IDA) });
    assert.deepEqual((newer.json.data as Array<{ body: string }>).map((m) => m.body), ['msg 2']);
  });
});

describe('chat: oversight (ministry / auditor, read-only)', () => {
  it('officials list conversations between other organizations only', async () => {
    const r = await jfetch(`${base}/chat/oversight`, { headers: H(MANAGER) });
    assert.equal(r.status, 200);
    const list = r.json.data as Array<{ conversationId: string; orgA: { id: string }; orgB: { id: string }; messageCount: number }>;
    const pairs = list.map((c) => [c.orgA.id, c.orgB.id].sort().join('|'));
    assert.ok(pairs.includes('org-ida|org-nbe'));
    assert.ok(pairs.includes('org-ida|org-imc'), 'seeded entity↔entity thread');
    assert.ok(!list.some((c) => c.orgA.id === 'org-ministry' || c.orgB.id === 'org-ministry'), 'own threads live in the directory');
  });

  it('officials read an entity↔entity thread; entities cannot use oversight', async () => {
    const list = (await jfetch(`${base}/chat/oversight`, { headers: H(AUDITOR) })).json.data as Array<{ conversationId: string; orgA: { id: string }; orgB: { id: string } }>;
    const t = list.find((c) => [c.orgA.id, c.orgB.id].includes('org-nbe'))!;
    const r = await jfetch(`${base}/chat/oversight/${t.conversationId}/messages`, { headers: H(AUDITOR) });
    assert.equal(r.status, 200);
    assert.equal((r.json.data as unknown[]).length, 2);
    assert.equal((await jfetch(`${base}/chat/oversight`, { headers: H(IDA) })).status, 403);
    assert.equal((await jfetch(`${base}/chat/oversight/${t.conversationId}/messages`, { headers: H(IMC) })).status, 403);
  });
});

describe('chat: attachments', () => {
  let pdfId = '';

  it('sends PDF + PNG with an Arabic filename to another entity', async () => {
    const r = await sendForm('org-imc', IDA, 'مرفق التقرير', [
      { name: 'تقرير الربع الأول.pdf', data: PDF, type: 'application/pdf' },
      { name: 'photo.png', data: PNG, type: 'image/png' },
    ]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const atts = (r.json.data as Json)['attachments'] as Array<{ id: string; fileName: string; mimeType: string; isImage: boolean; sizeBytes: number }>;
    assert.equal(atts.length, 2);
    assert.equal(atts[0].fileName, 'تقرير الربع الأول.pdf');
    assert.equal(atts[0].mimeType, 'application/pdf');
    assert.equal(atts[1].isImage, true);
    assert.ok(!('storedPath' in atts[0]), 'storedPath must never leak');
    pdfId = atts[0].id;
  });

  it('both parties and the officials can download; others cannot', async () => {
    const ok = await fetch(`${base}/chat/attachments/${pdfId}`, { headers: { 'x-user-id': IMC } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'application/pdf');
    assert.match(String(ok.headers.get('content-disposition')), /^attachment; filename="[^"]+"; filename\*=UTF-8''/);
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await ok.arrayBuffer()), PDF);
    const oversight = await fetch(`${base}/chat/attachments/${pdfId}?inline=1`, { headers: { 'x-user-id': ADMIN } });
    assert.equal(oversight.status, 200);
    assert.match(String(oversight.headers.get('content-disposition')), /^inline;/);
    await oversight.arrayBuffer();
    assert.equal((await fetch(`${base}/chat/attachments/${pdfId}`, { headers: { 'x-user-id': BANK } })).status, 403);
    assert.equal((await fetch(`${base}/chat/attachments/${pdfId}`, { headers: { 'x-user-id': OWNER } })).status, 403);
  });

  it('empty message -> 400; too long -> 400', async () => {
    assert.equal((await send('org-imc', IDA, '   ')).status, 400);
    assert.equal((await send('org-imc', IDA, 'a'.repeat(4001))).status, 400);
  });

  it('renamed executable (.pdf) is rejected and removed from disk', async () => {
    const before = chatUploadFiles().length;
    const r = await sendForm('org-imc', IDA, 'bad', [{ name: 'invoice.pdf', data: EXE }]);
    assert.equal(r.status, 400);
    assert.equal(r.json['code'], 'INVALID_FILE_TYPE');
    await new Promise((res) => setTimeout(res, 50));
    assert.equal(chatUploadFiles().length, before);
  });

  it('disallowed extension / too many files / oversized -> 400', async () => {
    assert.equal((await sendForm('org-imc', IDA, 'bad', [{ name: 'setup.exe', data: EXE }])).status, 400);
    assert.equal((await sendForm('org-imc', IDA, 'many', Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.pdf`, data: PDF })))).status, 400);
    process.env.CHAT_MAX_FILE_MB = '1';
    try {
      const big = Buffer.concat([PDF, Buffer.alloc(1024 * 1024 + 10, 0x20)]);
      const r = await sendForm('org-imc', IDA, 'big', [{ name: 'big.pdf', data: big }]);
      assert.equal(r.status, 400);
      assert.equal(r.json['code'], 'FILE_TOO_LARGE');
    } finally {
      delete process.env.CHAT_MAX_FILE_MB;
    }
  });
});

describe('chat: smart email reminder (every recipient organization)', () => {
  type Sent = { to: string[]; subject: string; html: string; text: string };
  const secret = 'رقم الحساب السري 998877';
  const minsFromNow = (m: number) => new Date(Date.now() + m * 60_000);

  async function sweep(atMins: number, match: string) {
    const { runChatReminderSweep } = await import('../src/jobs/chatReminders.js');
    const sent: Sent[] = [];
    await runChatReminderSweep({ now: minsFromNow(atMins), delayMin: 15, send: async (m) => { sent.push(m); return 'sent'; } });
    return sent.filter((m) => m.to.some((t) => t.includes(match)));
  }

  it('entity → entity: one email after the delay, no content leak, no repeat until read', async () => {
    assert.equal((await send('org-apex-solar', IDA, secret)).status, 201);
    assert.equal((await sweep(5, 'apexsolar')).length, 0);
    const mails = await sweep(16, 'apexsolar');
    assert.equal(mails.length, 1);
    assert.ok(mails[0].to.includes('projects@apexsolar.eg'));
    assert.ok(mails[0].to.includes('k.nabil@apexsolar.eg'));
    assert.match(mails[0].subject, /الهيئة العامة للتنمية الصناعية/);
    assert.ok(!mails[0].html.includes(secret) && !mails[0].text.includes(secret));
    assert.ok(mails[0].html.includes('/#chat'));
    await send('org-apex-solar', IDA, 'متابعة');
    assert.equal((await sweep(40, 'apexsolar')).length, 0, 'no second email while unread');
    await jfetch(`${base}/chat/conversations/org-ida/read`, { method: 'POST', headers: H(SOLAR) });
    await send('org-apex-solar', IDA, 'رسالة جديدة');
    assert.equal((await sweep(16, 'apexsolar')).length, 1, 're-armed after reading');
  });

  it('the ministry is reminded too — one email listing every organization waiting', async () => {
    await send('org-ministry', SOLAR, 'استفسار من مقدم الخدمة');
    await send('org-ministry', IMC, 'استفسار من مركز التحديث');
    const mails = await sweep(16, 'industry.gov.eg');
    assert.equal(mails.length, 1);
    assert.ok(mails[0].to.includes('initiatives@industry.gov.eg'));
    assert.ok(!mails[0].to.includes('heba.farouk@audit.gov.eg'), 'read-only auditor is not emailed');
    assert.match(mails[0].html, /مركز تحديث الصناعة/);
    assert.match(mails[0].html, /أبيكس لحلول الطاقة الشمسية/);
  });

  it('failed send is retried later (not marked as sent)', async () => {
    const { runChatReminderSweep } = await import('../src/jobs/chatReminders.js');
    await send('org-eehc', BANK, 'retry me');
    const fail = await runChatReminderSweep({ now: minsFromNow(16), delayMin: 15, send: async () => { throw new Error('smtp down'); } });
    assert.ok(fail.failed >= 1);
    assert.equal((await sweep(20, 'eehc')).length, 0, 'retry waits 10 minutes');
    assert.equal((await sweep(27, 'eehc')).length, 1, 'retried after the back-off');
  });
});
