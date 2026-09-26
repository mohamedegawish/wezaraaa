import { getDb, nowIso } from '../db/sqlite.js';
import { newId, normPage, normPageSize, paginate } from './helpers.js';

export interface AuditEntry {
  userId?: string;
  userName: string;
  ip?: string;
  actionType: string;
  entityType: string;
  entityId: string;
  summaryAr: string;
  beforeJson?: unknown;
  afterJson?: unknown;
}

export function addAuditLog(entry: AuditEntry) {
  const db = getDb();
  const id = newId('audit');
  const before = entry.beforeJson === undefined ? '' : JSON.stringify(entry.beforeJson);
  const after = entry.afterJson === undefined ? '' : JSON.stringify(entry.afterJson);
  db.prepare(
    'INSERT INTO audit_logs (id, timestamp, userId, userName, ip, actionType, entityType, entityId, summaryAr, beforeJson, afterJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, nowIso(), entry.userId ?? 'unknown', entry.userName ?? 'unknown', entry.ip ?? '', entry.actionType ?? '', entry.entityType ?? '', entry.entityId ?? '', entry.summaryAr ?? '', before, after);
  return { ...entry, id };
}

export function listAuditLogs(opts: { page?: unknown; pageSize?: unknown }) {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get() as { c: number }).c;
  const page = normPage(opts.page);
  const pageSize = normPageSize(opts.pageSize);
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC, rowid DESC LIMIT ? OFFSET ?').all(
    pageSize, (page - 1) * pageSize,
  );
  return paginate(rows, total, page, pageSize);
}
