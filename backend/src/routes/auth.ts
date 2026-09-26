import { Router } from 'express';
import { getUserInternalByEmail, getUserById, setUserPassword, verifyUserEmail } from '../store/users.js';
import { hashPassword, signAccess, signRefresh, verifyPassword, verifyRefresh } from '../auth/jwt.js';
import { isRefreshValid, revokeRefreshToken, storeRefreshToken } from '../store/refreshTokens.js';
import { getDb } from '../db/sqlite.js';
import { randomUUID } from 'node:crypto';
import { addAuditLog } from '../store/audit.js';
import { apiError, okMessage } from '../middleware/error.js';
import { auth, type AuthedRequest } from '../middleware/auth.js';
import { config } from '../config.js';

export const authRouter = Router();

export function setRefreshCookie(res: import('express').Response, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: config.jwtRefreshTtlSec * 1000,
    path: '/api/v1/auth',
  });
}

// P1-2/3: account lockout + strong password helpers
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();
const LOCK_THRESHOLD = 5;
const LOCK_MS = 15 * 60 * 1000;
function isLocked(email: string): number {
  const e = failedLogins.get(email.toLowerCase());
  if (!e || !e.lockedUntil) return 0;
  const remain = e.lockedUntil - Date.now();
  return remain > 0 ? remain : 0;
}
function recordFail(email: string) {
  const k = email.toLowerCase();
  const cur = failedLogins.get(k) ?? { count: 0, lockedUntil: 0 };
  cur.count += 1;
  if (cur.count >= LOCK_THRESHOLD) cur.lockedUntil = Date.now() + LOCK_MS;
  failedLogins.set(k, cur);
}
function recordSuccess(email: string) { failedLogins.delete(email.toLowerCase()); }
export function isStrongPassword(pw: string): boolean {
  if (pw.length < 8) return false;
  // At least one letter + one digit (practical, not annoying); special char optional but encouraged
  return /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

// POST /auth/login { email, password } -> { accessToken, mustChangePassword, user } + httpOnly refresh cookie
authRouter.post('/auth/login', (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'البريد وكلمة المرور مطلوبان.', 'email and password required.', [
      { field: 'email', issue: !email ? 'required' : 'ok' },
    ]);
  }
  const lockedRemain = isLocked(email.trim());
  if (lockedRemain > 0) {
    const mins = Math.ceil(lockedRemain / 60000);
    return apiError(res, 423, 'ACCOUNT_LOCKED', `الحساب مقفل مؤقتاً — حاول بعد ${mins} دقيقة.`, `Account locked for ${mins} min after ${LOCK_THRESHOLD} failed attempts.`);
  }
  const found = getUserInternalByEmail(email.trim());
  // Generic message to avoid user enumeration
  if (!found || !verifyPassword(password, found.passwordHash)) {
    recordFail(email.trim());
    return apiError(res, 401, 'INVALID_CREDENTIALS', 'بيانات الدخول غير صحيحة.', 'Invalid email or password.');
  }
  // P0-4: email verification required (factory self-registrations start unverified)
  if ((found as { isVerified?: boolean }).isVerified === false) {
    return apiError(res, 403, 'EMAIL_NOT_VERIFIED', 'البريد غير مؤكد — يرجى تفعيل حسابك عبر رابط التفعيل.', 'Email not verified.', [
      { field: 'email', issue: 'not_verified' },
    ]);
  }
  recordSuccess(email.trim());
  const accessToken = signAccess(found.id, found.role, found.organizationId);
  const { token: refreshToken } = signRefresh(found.id);
  storeRefreshToken(found.id, '', refreshToken);
  setRefreshCookie(res, refreshToken);
  addAuditLog({
    userId: found.id, userName: found.name, ip: (req as AuthedRequest).clientIp ?? '',
    actionType: 'login', entityType: 'user', entityId: found.id,
    summaryAr: `تسجيل دخول ${found.name}`,
  });
  const { passwordHash: _omit, ...safe } = found;
  void _omit;
  return okMessage(res, 200, 'تم تسجيل الدخول', {
    accessToken,
    refreshToken,
    mustChangePassword: Boolean(found.mustChangePassword),
    user: safe,
  });
});

// POST /auth/refresh { refreshToken? } (body or httpOnly cookie) -> rotate pair
authRouter.post('/auth/refresh', (req, res) => {
  const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const fromCookie = (req as unknown as { cookies?: Record<string, string> }).cookies?.refresh_token;
  const token = (fromBody || fromCookie || '').trim();
  if (!token) return apiError(res, 401, 'UNAUTHORIZED', 'جلسة التحديث مفقودة.', 'Missing refresh token.');
  const claims = verifyRefresh(token);
  if (!claims || !isRefreshValid(token)) {
    return apiError(res, 401, 'UNAUTHORIZED', 'جلسة التحديث منتهية.', 'Invalid refresh token.');
  }
  const user = getUserById(claims.sub);
  if (!user) return apiError(res, 401, 'UNAUTHORIZED', 'المستخدم غير موجود.', 'Unknown user.');
  revokeRefreshToken(token);
  const accessToken = signAccess(user.id, user.role, user.organizationId);
  const { token: next } = signRefresh(user.id);
  storeRefreshToken(user.id, '', next);
  setRefreshCookie(res, next);
  return okMessage(res, 200, 'تم تجديد الجلسة', { accessToken, refreshToken: next });
});

// POST /auth/logout — revoke presented refresh token
authRouter.post('/auth/logout', (req, res) => {
  const fromBody = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const fromCookie = (req as unknown as { cookies?: Record<string, string> }).cookies?.refresh_token;
  const token = (fromBody || fromCookie || '').trim();
  if (token) revokeRefreshToken(token);
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  return okMessage(res, 200, 'تم تسجيل الخروج', undefined);
});

// POST /auth/verify-email { token } -> activate factory self-registration
authRouter.post('/auth/verify-email', (req, res) => {
  const token = ((req.body ?? {}) as { token?: string }).token?.trim() ?? '';
  if (!token) return apiError(res, 400, 'VALIDATION_ERROR', 'رمز التفعيل مطلوب.', 'token required.', [{ field: 'token', issue: 'required' }]);
  const user = verifyUserEmail(token);
  if (!user) return apiError(res, 400, 'VALIDATION_ERROR', 'رمز التفعيل غير صالح أو منتهي.', 'Invalid or expired token.');
  return okMessage(res, 200, 'تم تفعيل البريد بنجاح', { email: user.email });
});

// POST /auth/resend-verification { email } -> re-issue token (rate-limited by publicLimiter)
authRouter.post('/auth/resend-verification', (req, res) => {
  const email = ((req.body ?? {}) as { email?: string }).email?.trim() ?? '';
  if (!email) return apiError(res, 400, 'VALIDATION_ERROR', 'البريد مطلوب.', 'email required.', [{ field: 'email', issue: 'required' }]);
  const u = getUserInternalByEmail(email);
  if (!u) return okMessage(res, 200, 'تم الإرسال إن وجد الحساب', undefined); // no enumeration
  if ((u as { isVerified?: boolean }).isVerified !== false) return okMessage(res, 200, 'الحساب مفعل بالفعل', undefined);
  const token = randomUUID();
  const exp = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  getDb().prepare('UPDATE users SET emailVerificationToken = ?, emailVerificationExpires = ?, updatedAt = ? WHERE id = ?').run(token, exp, new Date().toISOString(), u.id);
  // In production this would send email; for hosting readiness we log and return token in non-prod
  if ((process.env.NODE_ENV ?? 'development') !== 'production') {
    return okMessage(res, 200, 'تم إعادة الإرسال', { token });
  }
  console.log(`[verify-email] token for ${email}: ${token}`);
  return okMessage(res, 200, 'تم إرسال رابط التفعيل إلى بريدك', undefined);
});

// POST /auth/change-password (Bearer required) { currentPassword?, newPassword }
authRouter.post('/auth/change-password', auth, (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = (req.body ?? {}) as { currentPassword?: string; newPassword?: string };
  if (!newPassword || !isStrongPassword(newPassword)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'كلمة المرور 8 أحرف على الأقل وتحتوي حرفاً ورقماً.', 'newPassword must be 8+ with letter+digit.', [
      { field: 'newPassword', issue: 'weak' },
    ]);
  }
  const me = req.userId ? getUserInternalByEmail(getUserById(req.userId)?.email ?? '') : null;
  if (!me) return apiError(res, 401, 'UNAUTHORIZED', 'المستخدم غير موجود.', 'Unknown user.');
  // If user already has a password, require currentPassword (except forced first set when hash empty)
  if (me.passwordHash && (!currentPassword || !verifyPassword(currentPassword, me.passwordHash))) {
    return apiError(res, 401, 'INVALID_CREDENTIALS', 'كلمة المرور الحالية غير صحيحة.', 'Current password incorrect.');
  }
  setUserPassword(me.id, hashPassword(newPassword), false);
  addAuditLog({
    userId: me.id, userName: me.name, ip: req.clientIp ?? '',
    actionType: 'change-password', entityType: 'user', entityId: me.id,
    summaryAr: `تغيير كلمة المرور ${me.name}`,
  });
  return okMessage(res, 200, 'تم تغيير كلمة المرور', undefined);
});
