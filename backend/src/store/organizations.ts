import { getDb, nowIso, parseJson } from '../db/sqlite.js';
import { likePattern, newId, normPage, normPageSize, paginate, type SqlParam } from './helpers.js';

export interface Organization {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: string;
  active: boolean;
  contactEmail: string;
}

interface OrgRow {
  id: string; code: string; nameAr: string; nameEn: string;
  type: string; active: number; contactEmail: string;
}

function toApi(r: OrgRow): Organization {
  return {
    id: r.id, code: r.code, nameAr: r.nameAr, nameEn: r.nameEn,
    type: r.type, active: r.active === 1, contactEmail: r.contactEmail ?? '',
  };
}

export function listOrganizations(opts: { type?: string; q?: string; page?: unknown; pageSize?: unknown }) {
  const db = getDb();
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (opts.type && opts.type !== 'ALL') {
    where.push('type = ?');
    params.push(opts.type);
  }
  if (opts.q) {
    where.push("(nameAr LIKE ? ESCAPE '\\' OR nameEn LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\')");
    const p = likePattern(opts.q);
    params.push(p, p, p);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM organizations ${clause}`).get(...params) as { c: number }).c;
  const page = normPage(opts.page);
  const pageSize = normPageSize(opts.pageSize);
  const rows = db.prepare(
    `SELECT * FROM organizations ${clause} ORDER BY nameAr ASC LIMIT ? OFFSET ?`,
  ).all(...params, pageSize, (page - 1) * pageSize) as unknown as OrgRow[];
  return paginate(rows.map(toApi), total, page, pageSize);
}

export function getOrganizationById(id: string): Organization | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as OrgRow | undefined;
  return row ? toApi(row) : null;
}

export function getOrganizationByCode(code: string): Organization | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM organizations WHERE code = ? COLLATE NOCASE').get(code) as OrgRow | undefined;
  return row ? toApi(row) : null;
}

export function createOrganization(input: {
  code: string; nameAr: string; nameEn: string; type: string; contactEmail?: string;
}): Organization {
  const db = getDb();
  const now = nowIso();
  const id = newId('org');
  db.prepare(
    'INSERT INTO organizations (id, code, nameAr, nameEn, type, active, contactEmail, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
  ).run(id, input.code.trim().toUpperCase(), input.nameAr.trim(), input.nameEn.trim(), input.type, (input.contactEmail ?? '').trim(), now, now);
  return getOrganizationById(id) as Organization;
}

export function updateOrganization(id: string, patch: Partial<Pick<Organization, 'code' | 'nameAr' | 'nameEn' | 'type' | 'active' | 'contactEmail'>>): Organization | null {
  const db = getDb();
  const sets: string[] = [];
  const params: SqlParam[] = [];
  if (patch.code !== undefined) { sets.push('code = ?'); params.push(patch.code.trim().toUpperCase()); }
  if (patch.nameAr !== undefined) { sets.push('nameAr = ?'); params.push(patch.nameAr.trim()); }
  if (patch.nameEn !== undefined) { sets.push('nameEn = ?'); params.push(patch.nameEn.trim()); }
  if (patch.type !== undefined) { sets.push('type = ?'); params.push(patch.type); }
  if (patch.active !== undefined) { sets.push('active = ?'); params.push(patch.active ? 1 : 0); }
  if (patch.contactEmail !== undefined) { sets.push('contactEmail = ?'); params.push(patch.contactEmail.trim()); }
  if (sets.length) {
    sets.push('updatedAt = ?');
    params.push(nowIso(), id);
    db.prepare(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  return getOrganizationById(id);
}

export { parseJson };
