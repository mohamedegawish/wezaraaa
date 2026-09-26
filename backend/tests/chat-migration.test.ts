import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv } from './helpers.js';

// ترحيل مركز المراسلات v1 (محادثة لكل جهة مع المسؤولين) → v2 (أزواج جهات) بلا فقد بيانات.
const env = isolateTestEnv('chat-migration');
after(async () => { await env.cleanup(); });

describe('chat v1 → v2 migration', () => {
  it('rebuilds tables losslessly and keeps foreign keys consistent', async () => {
    const { getDb, closeDb } = await import('../src/db/sqlite.js');
    let db = getDb();
    const now = new Date().toISOString();
    for (const [id, type] of [['org-ministry', 'ministry'], ['org-ida', 'authority'], ['org-nbe', 'bank']]) {
      db.prepare('INSERT INTO organizations (id, code, nameAr, nameEn, type, active, contactEmail, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)')
        .run(id, id, id, id, type, '', now, now);
    }
    // Replace the fresh v2 tables with a v1-shaped dataset.
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('DROP TABLE chat_attachments; DROP TABLE chat_messages; DROP TABLE chat_conversations;');
    db.exec(`CREATE TABLE chat_conversations (id TEXT PRIMARY KEY, orgId TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      lastMessageAt TEXT NOT NULL DEFAULT '', lastMessagePreview TEXT NOT NULL DEFAULT '', lastMessageSide TEXT NOT NULL DEFAULT '',
      officialsLastReadAt TEXT NOT NULL DEFAULT '', entityLastReadAt TEXT NOT NULL DEFAULT '',
      entityReminderSentAt TEXT NOT NULL DEFAULT '', entityReminderAttemptAt TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL)`);
    db.exec(`CREATE TABLE chat_messages (id TEXT PRIMARY KEY, conversationId TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      senderUserId TEXT NOT NULL DEFAULT '', senderSide TEXT NOT NULL CHECK (senderSide IN ('officials','entity')),
      body TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL)`);
    db.exec(`CREATE TABLE chat_attachments (id TEXT PRIMARY KEY, messageId TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      fileName TEXT NOT NULL, mimeType TEXT NOT NULL, sizeBytes INTEGER NOT NULL DEFAULT 0, storedPath TEXT NOT NULL, createdAt TEXT NOT NULL)`);
    db.prepare(`INSERT INTO chat_conversations VALUES ('c-ida','org-ida','2026-01-02T00:00:00.000Z','reply','entity',
      '2026-01-01T12:00:00.000Z','2026-01-02T00:00:00.000Z','2026-01-01T13:00:00.000Z','','2026-01-01T00:00:00.000Z')`).run();
    db.prepare(`INSERT INTO chat_conversations VALUES ('c-nbe','org-nbe','2026-01-03T00:00:00.000Z','hello','officials',
      '2026-01-03T00:00:00.000Z','','2026-01-03T01:00:00.000Z','','2026-01-03T00:00:00.000Z')`).run();
    db.prepare(`INSERT INTO chat_conversations VALUES ('c-self','org-ministry','2026-01-04T00:00:00.000Z','x','entity','','','','','2026-01-04T00:00:00.000Z')`).run();
    const msg = db.prepare('INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?, ?)');
    msg.run('m1', 'c-ida', 'user-admin', 'officials', 'hello ida', '2026-01-01T00:00:00.000Z');
    msg.run('m2', 'c-ida', 'user-ida', 'entity', 'reply', '2026-01-02T00:00:00.000Z');
    msg.run('m3', 'c-nbe', 'user-admin', 'officials', 'hello', '2026-01-03T00:00:00.000Z');
    msg.run('m4', 'c-self', 'user-auditor', 'entity', 'x', '2026-01-04T00:00:00.000Z');
    const att = db.prepare('INSERT INTO chat_attachments VALUES (?, ?, ?, ?, ?, ?, ?)');
    att.run('a1', 'm2', 'r.pdf', 'application/pdf', 5, '/tmp/r.pdf', now);
    att.run('a2', 'm4', 's.pdf', 'application/pdf', 5, '/tmp/s.pdf', now);
    db.exec('PRAGMA foreign_keys = ON');
    closeDb();

    db = getDb(); // ensureMigrated runs here
    const cols = new Set((db.prepare('PRAGMA table_info(chat_conversations)').all() as Array<{ name: string }>).map((r) => r.name));
    assert.ok(cols.has('orgA') && !cols.has('orgId'), 'conversations rebuilt as pairs');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ida = db.prepare("SELECT * FROM chat_conversations WHERE id = 'c-ida'").get() as any;
    assert.equal(ida.orgA, 'org-ida');           // 'org-ida' < 'org-ministry'
    assert.equal(ida.orgB, 'org-ministry');
    assert.equal(ida.readA, '2026-01-02T00:00:00.000Z', 'entity read marker → IDA side');
    assert.equal(ida.readB, '2026-01-01T12:00:00.000Z', 'officials read marker → ministry side');
    assert.equal(ida.reminderSentA, '2026-01-01T13:00:00.000Z');
    assert.equal(ida.lastSenderOrgId, 'org-ida');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nbe = db.prepare("SELECT * FROM chat_conversations WHERE id = 'c-nbe'").get() as any;
    assert.equal(nbe.orgA, 'org-ministry');      // 'org-ministry' < 'org-nbe'
    assert.equal(nbe.orgB, 'org-nbe');
    assert.equal(nbe.readA, '2026-01-03T00:00:00.000Z');
    assert.equal(nbe.reminderSentB, '2026-01-03T01:00:00.000Z');
    assert.equal(nbe.lastSenderOrgId, 'org-ministry');
    const senders = Object.fromEntries((db.prepare('SELECT id, senderOrgId FROM chat_messages').all() as Array<{ id: string; senderOrgId: string }>).map((r) => [r.id, r.senderOrgId]));
    assert.deepEqual(senders, { m1: 'org-ministry', m2: 'org-ida', m3: 'org-ministry' });
    assert.ok(db.prepare("SELECT 1 FROM chat_attachments WHERE id = 'a1'").get(), 'attachments of kept messages survive');
    assert.equal(db.prepare("SELECT 1 FROM chat_attachments WHERE id = 'a2'").get(), undefined, 'orphans of the dropped self-thread are removed');
    assert.equal((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys, 1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    closeDb();
    getDb(); // idempotent second boot
    closeDb();
  });
});
