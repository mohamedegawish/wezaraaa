import { getDb, nowIso } from '../db/sqlite.js';
import { newId } from './helpers.js';
import { sha256 } from '../auth/jwt.js';
import { config } from '../config.js';

export function storeRefreshToken(userId: string, jti: string, token: string): void {
  const db = getDb();
  const exp = new Date(Date.now() + config.jwtRefreshTtlSec * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (id, userId, tokenHash, expiresAt, revoked, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
  ).run(newId('rt'), userId, sha256(token), exp, nowIso());
  void jti;
}

export function isRefreshValid(token: string): { userId: string; jti: string } | null {
  const db = getDb();
  const h = sha256(token);
  const row = db.prepare('SELECT userId, expiresAt, revoked FROM refresh_tokens WHERE tokenHash = ?').get(h) as
    | { userId: string; expiresAt: string; revoked: number } | undefined;
  if (!row || row.revoked) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  // jti not stored separately — sub from JWT verified by caller
  return { userId: row.userId, jti: '' };
}

export function revokeRefreshToken(token: string): void {
  const db = getDb();
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE tokenHash = ?').run(sha256(token));
}

export function revokeAllForUser(userId: string): void {
  const db = getDb();
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE userId = ?').run(userId);
}
