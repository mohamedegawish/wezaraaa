import { getDb, nowIso, parseJson } from '../db/sqlite.js';
import { newId, normPage, normPageSize, paginate } from './helpers.js';

export interface DetailsFile {
  id: string;
  factoryId: string;
  fileName: string;
  fileSize: string;
  description: string;
  initiativeId?: string;
  applicationId?: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'pending' | 'verified' | 'rejected';
}

/** Internal row WITH storedPath — for filesystem deletion only, NEVER returned to clients. */
export interface DetailsFileInternal extends DetailsFile {
  storedPath: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function toApi(r: Row): DetailsFile {
  // PROD FIX: never expose storedPath (internal disk layout) to API clients.
  return {
    id: r.id, factoryId: r.factoryId, fileName: r.fileName,
    fileSize: r.fileSize ?? '', description: r.description ?? '',
    initiativeId: r.initiativeId ?? undefined, applicationId: r.applicationId ?? undefined,
    uploadedAt: r.uploadedAt,
    uploadedBy: r.uploadedBy ?? 'unknown',
    status: (r.status ?? 'pending') as DetailsFile['status'],
  };
}

function toInternal(r: Row): DetailsFileInternal {
  return { ...toApi(r), storedPath: r.storedPath ?? '' };
}

/** Unified factory profile: id + merged JSON `data` columns. */
export function getFactoryById(id: string): (Record<string, unknown> & { id: string }) | null {
  const db = getDb();
  const row = db.prepare('SELECT id, data FROM factories WHERE id = ?').get(id) as { id: string; data: string } | undefined;
  if (!row) return null;
  const data = parseJson<Record<string, unknown>>(row.data, {});
  return { ...data, id: row.id };
}

/** API-only frontend: public factory self-registration creates the factory row. */
export function createFactory(data: Record<string, unknown>): { id: string } {
  const db = getDb();
  const now = nowIso();
  const id = newId('factory');
  db.prepare('INSERT INTO factories (id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run(
    id, JSON.stringify({ ...data, id }), now, now,
  );
  return { id };
}

export function listFactories(opts: { q?: string; page?: unknown; pageSize?: unknown }) {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) AS c FROM factories').get() as { c: number }).c;
  const page = normPage(opts.page);
  const pageSize = normPageSize(opts.pageSize);
  const rows = db.prepare('SELECT id, data FROM factories ORDER BY rowid DESC LIMIT ? OFFSET ?').all(
    pageSize, (page - 1) * pageSize,
  ) as { id: string; data: string }[];
  let items = rows.map((r) => ({ ...parseJson<Record<string, unknown>>(r.data, {}), id: r.id }));
  if (opts.q) {
    const q = opts.q.toLowerCase();
    items = items.filter((f) =>
      String((f as Record<string, unknown>).nameAr ?? '').includes(opts.q as string) ||
      String((f as Record<string, unknown>).nameEn ?? '').toLowerCase().includes(q),
    );
  }
  return paginate(items, total, page, pageSize);
}

export function updateFactory(id: string, patch: Record<string, unknown>): (Record<string, unknown> & { id: string }) | null {
  const db = getDb();
  const current = getFactoryById(id);
  if (!current) return null;
  const { id: _omit, ...rest } = current;
  void _omit;
  const merged = { ...rest, ...patch, id };
  db.prepare('UPDATE factories SET data = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(merged), nowIso(), id);
  return getFactoryById(id);
}

export function listDetailsFiles(factoryId: string, initiativeId?: string): DetailsFile[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM details_files WHERE factoryId = ? ORDER BY rowid DESC').all(factoryId) as Row[];
  const all = rows.map(toApi);
  if (!initiativeId) return all;
  return all.filter((f) => !f.initiativeId || f.initiativeId === initiativeId);
}

export function createDetailsFile(input: {
  factoryId: string; fileName: string; fileSize: string; description?: string;
  initiativeId?: string; applicationId?: string; storedPath?: string; uploadedBy: string;
}): DetailsFile {
  const db = getDb();
  const id = newId('fdet');
  const now = nowIso();
  db.prepare(
    `INSERT INTO details_files (id, factoryId, fileName, fileSize, description, initiativeId, applicationId, storedPath, uploadedAt, uploadedBy, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  ).run(
    id, input.factoryId, input.fileName, input.fileSize, input.description ?? '',
    input.initiativeId ?? null, input.applicationId ?? null, input.storedPath ?? '', now, input.uploadedBy,
  );
  const row = db.prepare('SELECT * FROM details_files WHERE id = ?').get(id) as Row;
  return toApi(row);
}

export function deleteDetailsFile(factoryId: string, fileId: string): DetailsFileInternal | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM details_files WHERE id = ? AND factoryId = ?').get(fileId, factoryId) as Row | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM details_files WHERE id = ?').run(fileId);
  return toInternal(row);
}

export function countFilesByApplication(applicationId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS c FROM details_files WHERE applicationId = ?').get(applicationId) as { c: number };
  return row.c;
}
