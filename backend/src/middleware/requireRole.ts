import type { Response, NextFunction } from 'express';
import { apiError } from './error.js';
import type { AuthedRequest } from './auth.js';

// PROD FIX: RBAC دقيق — يحمي الراوتس الحساسة من أي مسجل (كان معظم القراءات مفتوحة).
export function requireRole(...allowed: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', `Requires one of: ${allowed.join(', ')}.`);
    }
    next();
  };
}

export const ADMIN_ROLES = ['ministry_admin', 'initiative_manager'] as const;
export const AUDIT_ROLES = ['ministry_admin', 'initiative_manager', 'auditor'] as const;
