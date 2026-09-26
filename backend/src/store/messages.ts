import { getDb, nowIso, parseJson } from '../db/sqlite.js';
import { newId, normPage, normPageSize, paginate, type SqlParam } from './helpers.js';
import { getUserById } from './users.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface MessageFile {
  id: string;
  fileName: string;
  fileSize: string;
  description: string;
  initiativeId?: string;
  applicationId?: string;
  uploadedAt: string;
  status: string;
}

export interface Message {
  id: string;
  applicationId: string;
  fromUserId: string;
  fromUserName: string;
  fromOrgId: string;
  toOrgId: string;
  subject: string;
  body: string;
  customFields: Record<string, string>;
  detailsFileId?: string;
  detailsFile?: MessageFile;
  createdAt: string;
}

function toMessageApi(r: Row): Message {
  const cf = parseJson<Record<string, string>>(r.customFields, {});
  const msg: Message = {
    id: r.id,
    applicationId: r.applicationId,
    fromUserId: r.fromUserId ?? '',
    fromUserName: r.fromUserName ?? '',
    fromOrgId: r.fromOrgId ?? '',
    toOrgId: r.toOrgId ?? '',
    subject: r.subject ?? '',
    body: r.body ?? '',
    customFields: cf && typeof cf === 'object' ? cf : {},
    createdAt: r.createdAt,
  };
  if (r.detailsFileId) msg.detailsFileId = r.detailsFileId;
  if (r._detailsFile) msg.detailsFile = r._detailsFile as MessageFile;
  return msg;
}

/** Resolves the sender display name (snapshot at read time — same pattern as applications performerSnapshot). */
function senderName(userId: string): string {
  try {
    const u = getUserById(userId);
    return u?.name ?? userId;
  } catch {
    return userId;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attachDetailsFile(msg: any, db: ReturnType<typeof getDb>): void {
  if (!msg.detailsFileId) return;
  try {
    const f = db.prepare(
      'SELECT id, fileName, fileSize, description, initiativeId, applicationId, uploadedAt, status FROM details_files WHERE id = ?',
    ).get(msg.detailsFileId) as Row | undefined;
    // PROD FIX: never leak storedPath — explicit safe columns only.
    if (f) {
      msg._detailsFile = {
        id: f.id, fileName: f.fileName, fileSize: f.fileSize, description: f.description,
        initiativeId: f.initiativeId, applicationId: f.applicationId,
        uploadedAt: f.uploadedAt, status: f.status,
      };
    }
  } catch { /* ignore — message stays without file data */ }
}

export function listMessages(
  applicationId: string,
  opts: { page?: unknown; pageSize?: unknown; orgId?: string },
) {
  const db = getDb();
  const page = normPage(opts.page);
  const pageSize = normPageSize(opts.pageSize, 20);
  const where = opts.orgId
    ? 'WHERE applicationId = ? AND (fromOrgId = ? OR toOrgId = ?)'
    : 'WHERE applicationId = ?';
  const params: SqlParam[] = opts.orgId ? [applicationId, opts.orgId, opts.orgId] : [applicationId];
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM messages ${where}`).get(...params) as { c: number }).c;
  const rows = db.prepare(
    `SELECT * FROM messages ${where} ORDER BY createdAt ASC, rowid ASC LIMIT ? OFFSET ?`,
  ).all(...params, pageSize, (page - 1) * pageSize) as unknown as Row[];
  const data = rows.map((r) => {
    const withName = { ...r, fromUserName: senderName(String(r.fromUserId ?? '')) };
    attachDetailsFile(withName, db);
    return toMessageApi(withName);
  });
  return paginate(data, total, page, pageSize);
}

export function createMessage(input: {
  applicationId: string; fromUserId: string; fromOrgId: string; toOrgId: string;
  subject: string; body: string; customFields: Record<string, string>; detailsFileId?: string;
}): Message {
  const db = getDb();
  const id = newId('msg');
  const now = nowIso();
  db.prepare(
    `INSERT INTO messages
     (id, applicationId, fromUserId, fromOrgId, toOrgId, subject, body, customFields, detailsFileId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, input.applicationId, input.fromUserId, input.fromOrgId, input.toOrgId,
    input.subject, input.body, JSON.stringify(input.customFields),
    (input.detailsFileId ?? null) as SqlParam, now,
  );
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Row;
  const withName = { ...row, fromUserName: senderName(input.fromUserId) };
  attachDetailsFile(withName, db);
  return toMessageApi(withName);
}
