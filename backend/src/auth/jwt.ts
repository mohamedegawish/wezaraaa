import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config.js';

export interface AccessClaims { sub: string; role: string; org: string; typ: 'access' }
export interface RefreshClaims { sub: string; jti: string; typ: 'refresh' }

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, config.bcryptRounds);
}

export function verifyPassword(plain: string, hash: string): boolean {
  if (!hash) return false;
  try { return bcrypt.compareSync(plain, hash); }
  catch { return false; }
}

export function signAccess(userId: string, role: string, org: string): string {
  return jwt.sign({ sub: userId, role, org, typ: 'access' } as AccessClaims, config.jwtSecret, { expiresIn: config.jwtAccessTtlSec });
}

export function signRefresh(userId: string): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, jti, typ: 'refresh' } as RefreshClaims, config.jwtSecret, { expiresIn: config.jwtRefreshTtlSec });
  return { token, jti };
}

export function verifyAccess(token: string): AccessClaims | null {
  try {
    const p = jwt.verify(token, config.jwtSecret) as AccessClaims;
    return p.typ === 'access' ? p : null;
  } catch { return null; }
}

export function verifyRefresh(token: string): RefreshClaims | null {
  try {
    const p = jwt.verify(token, config.jwtSecret) as RefreshClaims;
    return p.typ === 'refresh' ? p : null;
  } catch { return null; }
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
