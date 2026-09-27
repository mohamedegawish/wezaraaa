import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, 'schema.sql'), // tsx: src/db/schema.sql OR dist/db/schema.sql (after copy-schema)
    path.join(process.cwd(), 'dist', 'db', 'schema.sql'), // production: node dist/index.js
    path.join(process.cwd(), 'src', 'db', 'schema.sql'), // dev fallback from root
    path.join(here, '..', 'db', 'schema.sql'), // legacy dist/src layout safety
  ];
  const schemaPath = candidates.find((p) => fs.existsSync(p));
  if (!schemaPath) throw new Error(`schema.sql not found (tried ${candidates.join(' | ')})`);
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  ensureMigrated(db);
  return db;
}

/** PROD FIX: ترحيل تدريجي لقواعد موجودة (ALTER فقط الناقص — idempotent وآمن). */
function ensureMigrated(db: DatabaseSync): void {
  const cols = (table: string): Set<string> => {
    try {
      const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      return new Set(rows.map((r) => r.name));
    } catch { return new Set(); }
  };
  const addCol = (table: string, ddl: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); } catch { /* exists */ }
  };
  const u = cols('users');
  if (!u.has('passwordHash')) addCol('users', "passwordHash TEXT NOT NULL DEFAULT ''");
  if (!u.has('mustChangePassword')) addCol('users', 'mustChangePassword INTEGER NOT NULL DEFAULT 0');
  if (!u.has('factoryId')) addCol('users', "factoryId TEXT NOT NULL DEFAULT ''");
  if (!u.has('isVerified')) addCol('users', 'isVerified INTEGER NOT NULL DEFAULT 1');
  if (!u.has('emailVerificationToken')) addCol('users', "emailVerificationToken TEXT NOT NULL DEFAULT ''");
  if (!u.has('emailVerificationExpires')) addCol('users', "emailVerificationExpires TEXT NOT NULL DEFAULT ''");
  // Index AFTER the column is guaranteed (declaring it in schema.sql would crash
  // pre-migration DBs: index creation runs before this migration).
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_users_factory ON users(factoryId)'); } catch { /* locked/older sqlite */ }
  const a = cols('audit_logs');
  if (!a.has('userId')) addCol('audit_logs', "userId TEXT NOT NULL DEFAULT 'unknown'");
  if (!a.has('ip')) addCol('audit_logs', "ip TEXT NOT NULL DEFAULT ''");
  if (!a.has('beforeJson')) addCol('audit_logs', "beforeJson TEXT NOT NULL DEFAULT ''");
  if (!a.has('afterJson')) addCol('audit_logs', "afterJson TEXT NOT NULL DEFAULT ''");
  // أقسام المبادرة من وثيقتها الرسمية: المستهدفات، المحددات المالية، الاشتراطات، المعايير، المسار، المؤشرات.
  const ini = cols('initiatives');
  if (!ini.has('objectives')) addCol('initiatives', "objectives TEXT NOT NULL DEFAULT '[]'");
  if (!ini.has('eligibilityRequirements')) addCol('initiatives', "eligibilityRequirements TEXT NOT NULL DEFAULT '[]'");
  if (!ini.has('selectionCriteria')) addCol('initiatives', "selectionCriteria TEXT NOT NULL DEFAULT '[]'");
  if (!ini.has('financialTerms')) addCol('initiatives', "financialTerms TEXT NOT NULL DEFAULT '{}'");
  if (!ini.has('executionNotesAr')) addCol('initiatives', "executionNotesAr TEXT NOT NULL DEFAULT ''");
  if (!ini.has('executionNotesEn')) addCol('initiatives', "executionNotesEn TEXT NOT NULL DEFAULT ''");
  if (!ini.has('kpis')) addCol('initiatives', "kpis TEXT NOT NULL DEFAULT '[]'");
  // refresh_tokens created by schema.sql (CREATE IF NOT EXISTS) — no extra work.
  // messages table (contract-first 5b): idempotent for pre-existing DBs.
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      applicationId TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      fromUserId TEXT NOT NULL DEFAULT '',
      fromOrgId TEXT NOT NULL DEFAULT '',
      toOrgId TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      customFields TEXT NOT NULL DEFAULT '{}',
      detailsFileId TEXT,
      createdAt TEXT NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_app ON messages(applicationId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(toOrgId)');
  } catch { /* locked/older sqlite */ }
  // chat tables (contract-first 5c): v1 (one conversation per org with the officials) → v2 pairs.
  migrateChatToPairs(db);
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS chat_conversations (${CHAT_CONVERSATIONS_V2})`);
    db.exec(`CREATE TABLE IF NOT EXISTS chat_messages (${CHAT_MESSAGES_V2})`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_chat_conv_b ON chat_conversations(orgB)');
    db.exec(`CREATE TABLE IF NOT EXISTS chat_attachments (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      fileName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL DEFAULT 0,
      storedPath TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversationId, createdAt)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_chat_attachments_msg ON chat_attachments(messageId)');
  } catch { /* locked/older sqlite */ }
  // email outbox (factory notifications): idempotent for pre-existing DBs / stale dist schema.sql.
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS email_outbox (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      refType TEXT NOT NULL DEFAULT '',
      refId TEXT NOT NULL DEFAULT '',
      recipients TEXT NOT NULL DEFAULT '[]',
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT NOT NULL DEFAULT '',
      nextAttemptAt TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      sentAt TEXT NOT NULL DEFAULT ''
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_email_outbox_due ON email_outbox(status, nextAttemptAt)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_email_outbox_ref ON email_outbox(refType, refId)');
  } catch { /* locked/older sqlite */ }
  // معرفات البانرات تظهر في رابط الصورة — «banner-» تحجبه مانعات الإعلانات، فالبادئة صارت «hl-».
  try { db.exec("UPDATE home_banners SET id = 'hl-' || substr(id, 8) WHERE id LIKE 'banner-%'"); } catch { /* older sqlite */ }
  renameMinistry(db);
}

/**
 * «وزارة الصناعة والتجارة» → «وزارة الصناعة» في الداتا الحية (idempotent). البذور لا تُعاد على قاعدة
 * مزروعة، فنصحح الأسماء المنسوخة داخل JSON أيضاً. audit_logs / email_outbox سجلات تاريخية — لا تُلمس.
 */
function renameMinistry(db: DatabaseSync): void {
  const pairs: Array<[string, string]> = [
    ['وزارة الصناعة والتجارة', 'وزارة الصناعة'],
    ['Ministry of Industry and Trade', 'Ministry of Industry'],
  ];
  const targets: Array<[string, string]> = [
    ['organizations', 'nameAr'], ['organizations', 'nameEn'],
    ['initiatives', 'workflow'], ['initiatives', 'participatingOrgs'],
    ['applications', 'timeline'],
  ];
  for (const [table, col] of targets) {
    for (const [from, to] of pairs) {
      try {
        db.prepare(`UPDATE ${table} SET ${col} = REPLACE(${col}, ?, ?) WHERE ${col} LIKE ?`).run(from, to, `%${from}%`);
      } catch { /* column missing on older DBs */ }
    }
  }
}

const CHAT_MINISTRY_ORG = 'org-ministry';

const CHAT_CONVERSATIONS_V2 = `
  id TEXT PRIMARY KEY,
  orgA TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  orgB TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lastMessageAt TEXT NOT NULL DEFAULT '',
  lastMessagePreview TEXT NOT NULL DEFAULT '',
  lastSenderOrgId TEXT NOT NULL DEFAULT '',
  readA TEXT NOT NULL DEFAULT '',
  readB TEXT NOT NULL DEFAULT '',
  reminderSentA TEXT NOT NULL DEFAULT '',
  reminderSentB TEXT NOT NULL DEFAULT '',
  reminderAttemptA TEXT NOT NULL DEFAULT '',
  reminderAttemptB TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  UNIQUE (orgA, orgB),
  CHECK (orgA < orgB)`;

const CHAT_MESSAGES_V2 = `
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  senderUserId TEXT NOT NULL DEFAULT '',
  senderOrgId TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL`;

/**
 * Chat v1 → v2 (idempotent, lossless): every v1 conversation «officials ↔ org X» becomes the pair
 * (org-ministry, X); officials messages get senderOrgId = org-ministry. Read markers and the entity
 * reminder state move to the matching side. SQLite cannot drop UNIQUE/CHECK in place, so both tables
 * are rebuilt with foreign keys OFF (otherwise DROP TABLE would cascade-delete messages/attachments).
 */
function migrateChatToPairs(db: DatabaseSync): void {
  let cols: Set<string>;
  try {
    cols = new Set((db.prepare('PRAGMA table_info(chat_conversations)').all() as Array<{ name: string }>).map((r) => r.name));
  } catch { return; }
  if (!cols.has('orgId') || cols.has('orgA')) return;
  const M = CHAT_MINISTRY_ORG;
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`CREATE TABLE chat_conversations_v2 (${CHAT_CONVERSATIONS_V2})`);
      db.prepare(`INSERT INTO chat_conversations_v2
        (id, orgA, orgB, lastMessageAt, lastMessagePreview, lastSenderOrgId, readA, readB, reminderSentA, reminderSentB, reminderAttemptA, reminderAttemptB, createdAt)
        SELECT id,
          CASE WHEN orgId < ?1 THEN orgId ELSE ?1 END,
          CASE WHEN orgId < ?1 THEN ?1 ELSE orgId END,
          lastMessageAt, lastMessagePreview,
          CASE lastMessageSide WHEN 'officials' THEN ?1 WHEN 'entity' THEN orgId ELSE '' END,
          CASE WHEN orgId < ?1 THEN entityLastReadAt ELSE officialsLastReadAt END,
          CASE WHEN orgId < ?1 THEN officialsLastReadAt ELSE entityLastReadAt END,
          CASE WHEN orgId < ?1 THEN entityReminderSentAt ELSE '' END,
          CASE WHEN orgId < ?1 THEN '' ELSE entityReminderSentAt END,
          CASE WHEN orgId < ?1 THEN entityReminderAttemptAt ELSE '' END,
          CASE WHEN orgId < ?1 THEN '' ELSE entityReminderAttemptAt END,
          createdAt
        FROM chat_conversations WHERE orgId <> ?1`).run(M);
      db.exec(`CREATE TABLE chat_messages_v2 (${CHAT_MESSAGES_V2})`);
      db.prepare(`INSERT INTO chat_messages_v2 (id, conversationId, senderUserId, senderOrgId, body, createdAt)
        SELECT m.id, m.conversationId, m.senderUserId,
          CASE m.senderSide WHEN 'officials' THEN ?1 ELSE c.orgId END,
          m.body, m.createdAt
        FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversationId
        WHERE c.orgId <> ?1`).run(M);
      db.exec('DROP TABLE chat_messages');
      db.exec('DROP TABLE chat_conversations');
      db.exec('ALTER TABLE chat_conversations_v2 RENAME TO chat_conversations');
      db.exec('ALTER TABLE chat_messages_v2 RENAME TO chat_messages');
      // v1 «ministry with itself» threads have no v2 equivalent — drop their orphaned attachments.
      db.exec('DELETE FROM chat_attachments WHERE messageId NOT IN (SELECT id FROM chat_messages)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversationId, createdAt)');
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* noop */ }
      throw e;
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

export function closeDb(): void {
  try { db?.close(); } catch { /* already closed */ }
  db = null;
}

/** Parse a JSON TEXT column safely with a fallback. */
export function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
