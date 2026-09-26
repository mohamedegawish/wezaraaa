import { getDb, nowIso } from '../db/sqlite.js';
import { likePattern, newId, normPage, normPageSize, paginate, type SqlParam } from './helpers.js';

export interface User {
  id: string;
  name: string;
  nameEn: string;
  email: string;
  role: string;
  organizationId: string;
  factoryId?: string;
  mustChangePassword?: boolean;
  isVerified?: boolean;
}

/** Internal row WITH passwordHash — never return to clients. */
export interface UserInternal extends User {
  passwordHash: string;
}

export function listUsers(opts: { organizationId?: string; role?: string; q?: string; page?: unknown; pageSize?: unknown }) {
  const db = getDb();
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (opts.organizationId) { where.push('organizationId = ?'); params.push(opts.organizationId); }
  if (opts.role && opts.role !== 'ALL') { where.push('role = ?'); params.push(opts.role); }
  if (opts.q) {
    where.push("(name LIKE ? ESCAPE '\\' OR nameEn LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
    const p = likePattern(opts.q);
    params.push(p, p, p);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM users ${clause}`).get(...params) as { c: number }).c;
  const page = normPage(opts.page);
  const pageSize = normPageSize(opts.pageSize);
  const rows = db.prepare(
    `SELECT id, name, nameEn, email, role, organizationId, factoryId FROM users ${clause} ORDER BY name ASC LIMIT ? OFFSET ?`,
  ).all(...params, pageSize, (page - 1) * pageSize) as unknown as User[];
  return paginate(rows, total, page, pageSize);
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name, nameEn, email, role, organizationId, factoryId, mustChangePassword, isVerified FROM users WHERE id = ?').get(id) as (User & { mustChangePassword?: number; isVerified?: number }) | undefined;
  if (!row) return null;
  return { ...row, mustChangePassword: Boolean(row.mustChangePassword), isVerified: row.isVerified !== 0 };
}

export function getUserInternalById(id: string): UserInternal | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name, nameEn, email, role, organizationId, factoryId, passwordHash, mustChangePassword, isVerified, emailVerificationToken, emailVerificationExpires FROM users WHERE id = ?').get(id) as (UserInternal & { mustChangePassword?: number; isVerified?: number; emailVerificationToken?: string; emailVerificationExpires?: string }) | undefined;
  if (!row) return null;
  return { ...row, mustChangePassword: Boolean(row.mustChangePassword), isVerified: row.isVerified !== 0 } as UserInternal;
}

export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name, nameEn, email, role, organizationId, factoryId, mustChangePassword, isVerified FROM users WHERE email = ? COLLATE NOCASE').get(email) as (User & { mustChangePassword?: number; isVerified?: number }) | undefined;
  if (!row) return null;
  return { ...row, mustChangePassword: Boolean(row.mustChangePassword), isVerified: row.isVerified !== 0 };
}

export function getUserInternalByEmail(email: string): UserInternal | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name, nameEn, email, role, organizationId, factoryId, passwordHash, mustChangePassword, isVerified, emailVerificationToken, emailVerificationExpires FROM users WHERE email = ? COLLATE NOCASE').get(email) as (UserInternal & { mustChangePassword?: number; isVerified?: number; emailVerificationToken?: string; emailVerificationExpires?: string }) | undefined;
  if (!row) return null;
  return { ...row, mustChangePassword: Boolean(row.mustChangePassword), isVerified: (row as { isVerified?: number }).isVerified !== 0 } as UserInternal;
}

export function createUser(input: { name: string; nameEn: string; email: string; role: string; organizationId: string; factoryId?: string; passwordHash?: string; mustChangePassword?: boolean; isVerified?: boolean; emailVerificationToken?: string; emailVerificationExpires?: string }): User {
  const db = getDb();
  const now = nowIso();
  const id = newId('user');
  db.prepare(
    'INSERT INTO users (id, name, nameEn, email, role, organizationId, factoryId, passwordHash, mustChangePassword, isVerified, emailVerificationToken, emailVerificationExpires, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, input.name.trim(), input.nameEn.trim(), input.email.trim(), input.role, input.organizationId, input.factoryId ?? '', input.passwordHash ?? '', input.mustChangePassword ? 1 : 0, input.isVerified === false ? 0 : 1, input.emailVerificationToken ?? '', input.emailVerificationExpires ?? '', now, now);
  return getUserById(id) as User;
}

export function verifyUserEmail(token: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT id, emailVerificationExpires FROM users WHERE emailVerificationToken = ?').get(token) as { id: string; emailVerificationExpires: string } | undefined;
  if (!row) return null;
  if (row.emailVerificationExpires && new Date(row.emailVerificationExpires).getTime() < Date.now()) return null;
  db.prepare('UPDATE users SET isVerified = 1, emailVerificationToken = ?, emailVerificationExpires = ?, updatedAt = ? WHERE id = ?').run('', '', nowIso(), row.id);
  return getUserById(row.id);
}

export function setUserPassword(id: string, passwordHash: string, mustChange: boolean): void {
  const db = getDb();
  db.prepare('UPDATE users SET passwordHash = ?, mustChangePassword = ?, updatedAt = ? WHERE id = ?').run(passwordHash, mustChange ? 1 : 0, nowIso(), id);
}

// PROD FIX: إكمال العقد — PUT/DELETE /users/:id كانا معلنين بدون تنفيذ.
export function updateUser(id: string, patch: Partial<Pick<User, 'name' | 'nameEn' | 'email' | 'role' | 'organizationId' | 'factoryId'>>): User | null {
  const db = getDb();
  const sets: string[] = [];
  const params: SqlParam[] = [];
  if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name.trim()); }
  if (patch.nameEn !== undefined) { sets.push('nameEn = ?'); params.push(patch.nameEn.trim()); }
  if (patch.email !== undefined) { sets.push('email = ?'); params.push(patch.email.trim()); }
  if (patch.role !== undefined) { sets.push('role = ?'); params.push(patch.role); }
  if (patch.organizationId !== undefined) { sets.push('organizationId = ?'); params.push(patch.organizationId); }
  if (patch.factoryId !== undefined) { sets.push('factoryId = ?'); params.push(patch.factoryId); }
  if (sets.length) {
    sets.push('updatedAt = ?');
    params.push(nowIso(), id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  return getUserById(id);
}

export function deleteUser(id: string): boolean {
  const db = getDb();
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return Number(info.changes ?? 0) > 0;
}
