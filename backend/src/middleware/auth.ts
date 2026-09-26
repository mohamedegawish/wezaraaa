import type { Request, Response, NextFunction } from 'express';
import { getUserById, type User } from '../store/users.js';
import { verifyAccess } from '../auth/jwt.js';
import { config } from '../config.js';

export interface AuthedRequest extends Request {
  userId?: string;
  user?: User;
  authMethod?: 'jwt' | 'demo';
  clientIp?: string;
}

function clientIp(req: Request): string {
  // P0-2: لا تثق بـ X-Forwarded-For إلا خلف بروكسي موثوق (TRUST_PROXY=1). وإلا يمكن تزوير IP التدقيق.
  if (config.trustProxy) {
    const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    if (fwd) return fwd;
  }
  return req.ip || '';
}

/**
 * هوية اختيارية للراوتس العامة (قبل auth): نفس منطق auth() لكن ترجع null بدل 401.
 * تُستخدم لتمييز ما يراه الأدمن عن الجمهور (مثل المبادرات المسودة) دون إلزام بالدخول.
 */
export function optionalUser(req: Request): User | null {
  const hdr = (req.header('authorization') || '').trim();
  if (hdr.toLowerCase().startsWith('bearer ')) {
    const claims = verifyAccess(hdr.slice(7).trim());
    return claims ? getUserById(claims.sub) ?? null : null;
  }
  if (!config.allowDemoAuth) return null;
  const userId = (req.header('x-user-id') || '').trim();
  return userId ? getUserById(userId) ?? null : null;
}

export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  req.clientIp = clientIp(req);
  // 1) Preferred: Bearer JWT (production path)
  const hdr = (req.header('authorization') || '').trim();
  if (hdr.toLowerCase().startsWith('bearer ')) {
    const token = hdr.slice(7).trim();
    const claims = verifyAccess(token);
    if (!claims) {
      return res.status(401).json({
        code: 'UNAUTHORIZED', messageAr: 'انتهت الجلسة — سجل الدخول مجددا.', messageEn: 'Invalid or expired token.',
      });
    }
    const user = getUserById(claims.sub);
    if (!user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED', messageAr: 'المستخدم غير موجود.', messageEn: 'Unknown user.',
      });
    }
    req.userId = user.id;
    req.user = user;
    req.authMethod = 'jwt';
    return next();
  }
  // 2) Fallback: demo x-user-id (dev only, or explicitly enabled)
  if (!config.allowDemoAuth) {
    return res.status(401).json({
      code: 'UNAUTHORIZED', messageAr: 'سجل الدخول عبر /auth/login اولا.', messageEn: 'Login via /auth/login first.',
    });
  }
  const userId = (req.header('x-user-id') || '').trim();
  if (!userId) {
    return res.status(401).json({
      code: 'UNAUTHORIZED', messageAr: 'سجل الدخول اولا.', messageEn: 'Missing credentials.',
    });
  }
  const user = getUserById(userId);
  if (!user) {
    return res.status(401).json({
      code: 'UNAUTHORIZED', messageAr: 'المستخدم غير موجود.', messageEn: 'Unknown user.',
    });
  }
  req.userId = user.id;
  req.user = user;
  req.authMethod = 'demo';
  next();
}
