import { Router } from 'express';
import { createUser, deleteUser, getUserByEmail, getUserById, listUsers, updateUser } from '../store/users.js';
import { createOrganization, getOrganizationByCode, getOrganizationById, listOrganizations, updateOrganization } from '../store/organizations.js';
import { addAuditLog } from '../store/audit.js';
import { apiError, okMessage } from '../middleware/error.js';
import { ADMIN_ROLES, requireRole } from '../middleware/requireRole.js';
import { hashPassword } from '../auth/jwt.js';
import { config } from '../config.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const usersRouter = Router();

const ORG_TYPES = ['ministry', 'authority', 'center', 'bank', 'utility', 'provider', 'factory'];
const USER_ROLES = ['ministry_admin', 'initiative_manager', 'ida_reviewer', 'imc_reviewer', 'bank_reviewer', 'solar_provider', 'factory_owner', 'auditor'];

function canManageOrgs(req: AuthedRequest): boolean {
  return req.user?.role === 'ministry_admin' || req.user?.role === 'initiative_manager';
}

usersRouter.get('/users/me', (req: AuthedRequest, res) => {
  const me = req.userId ? getUserById(req.userId) : null;
  if (!me) return apiError(res, 404, 'NOT_FOUND', 'المستخدم غير موجود.', 'User not found.');
  return okMessage(res, 200, 'ok', me);
});

usersRouter.post('/auth/switch-user', (req, res) => {
  // PROD FIX: switch-user ديمو فقط — محظور في الإنتاج إلا بتصريح صريح.
  if (!config.allowDemoAuth) {
    return apiError(res, 403, 'FORBIDDEN', 'تبديل الشخصية معطل في الإنتاج.', 'Demo auth disabled in production.');
  }
  const { userId } = (req.body ?? {}) as { userId?: string };
  if (!userId) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'حقل userId مطلوب.', 'userId is required.', [
      { field: 'userId', issue: 'required' },
    ]);
  }
  const found = getUserById(userId);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المستخدم غير موجود.', 'User not found.');
  return okMessage(res, 200, 'تم تبديل الشخصية', found);
});

// --- إدارة الحسابات (ministry_admin / initiative_manager) ---
// PROD FIX: GET /users كان مفتوحاً لأي مسجل — الآن للأدمن فقط.
usersRouter.get('/users', requireRole(...ADMIN_ROLES), (req, res) => {
  const { organizationId, role, q, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  res.json(listUsers({ organizationId, role, q, page, pageSize }));
});

usersRouter.post('/users', (req: AuthedRequest, res) => {
  if (!canManageOrgs(req)) return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', 'Only ministry admins can manage accounts.');
  const { name, nameEn, email, role, organizationId, password } = (req.body ?? {}) as {
    name?: string; nameEn?: string; email?: string; role?: string; organizationId?: string; password?: string;
  };
  if (!name?.trim() || !nameEn?.trim() || !email?.trim() || !role || !organizationId) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'الاسم عربي وإنجليزي والبريد والدور والجهة مطلوبة.', 'name, nameEn, email, role, organizationId are required.', [
      { field: 'email', issue: !email ? 'required' : 'ok' },
    ]);
  }
  if (!USER_ROLES.includes(role)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'دور غير صالح.', 'Invalid role.', [{ field: 'role', issue: 'unknown role' }]);
  }
  const org = getOrganizationById(organizationId);
  if (!org) return apiError(res, 404, 'NOT_FOUND', 'الجهة غير موجودة.', 'Organization not found.');
  if (!org.active) return apiError(res, 400, 'VALIDATION_ERROR', 'لا يمكن إضافة حساب لجهة موقوفة.', 'Organization is inactive.', [{ field: 'organizationId', issue: 'inactive' }]);
  if (getUserByEmail(email)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'هذا البريد مسجل بالفعل.', 'Email already exists.', [{ field: 'email', issue: 'unique' }]);
  }
  // PROD FIX: كلمة مرور مؤقتة مشفرة + اجبار التغيير (كانت تُخزن plaintext في الفرونت فقط).
  const tempPass = password?.trim() || `Temp-${Math.random().toString(36).slice(2, 10)}!A1`;
  if (tempPass.length < 8) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'كلمة المرور 8 احرف على الاقل.', 'password min 8.', [{ field: 'password', issue: 'min 8' }]);
  }
  const created = createUser({ name: name.trim(), nameEn: nameEn.trim(), email: email.trim(), role, organizationId, passwordHash: hashPassword(tempPass), mustChangePassword: true });
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'create', entityType: 'user', entityId: created.id,
    summaryAr: `إنشاء حساب ${created.name} بجهة ${org.nameAr}`,
  });
  return okMessage(res, 201, 'تم إنشاء الحساب', { id: created.id });
});

// PROD FIX: إكمال العقد — PUT /users/:id (كان معلناً بدون تنفيذ).
usersRouter.put('/users/:id', requireRole(...ADMIN_ROLES), (req: AuthedRequest, res) => {
  const found = getUserById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المستخدم غير موجود.', 'User not found.');
  const patch = (req.body ?? {}) as { name?: string; nameEn?: string; email?: string; role?: string; organizationId?: string };
  if (patch.role !== undefined && !USER_ROLES.includes(patch.role)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'دور غير صالح.', 'Invalid role.', [{ field: 'role', issue: 'unknown role' }]);
  }
  if (patch.email !== undefined) {
    const existing = getUserByEmail(patch.email);
    if (existing && existing.id !== found.id) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'هذا البريد مسجل بالفعل.', 'Email already exists.', [{ field: 'email', issue: 'unique' }]);
    }
  }
  if (patch.organizationId !== undefined) {
    const org = getOrganizationById(patch.organizationId);
    if (!org) return apiError(res, 404, 'NOT_FOUND', 'الجهة غير موجودة.', 'Organization not found.');
    if (!org.active) return apiError(res, 400, 'VALIDATION_ERROR', 'لا يمكن النقل لجهة موقوفة.', 'Organization is inactive.');
  }
  const updated = updateUser(found.id, patch);
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'update', entityType: 'user', entityId: found.id,
    summaryAr: `تحديث حساب ${updated?.name ?? found.id}`,
  });
  return okMessage(res, 200, 'تم حفظ الحساب', { id: found.id });
});

// PROD FIX: إكمال العقد — DELETE /users/:id (كان معلناً بدون تنفيذ).
usersRouter.delete('/users/:id', requireRole('ministry_admin'), (req: AuthedRequest, res) => {
  const found = getUserById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المستخدم غير موجود.', 'User not found.');
  if (found.id === req.userId) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'لا يمكنك حذف حسابك الحالي.', 'Cannot delete yourself.');
  }
  deleteUser(found.id);
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'delete', entityType: 'user', entityId: found.id,
    summaryAr: `حذف حساب ${found.name}`,
  });
  return okMessage(res, 200, 'تم حذف الحساب', { id: found.id });
});

// --- إدارة الجهات المسؤولة ---
usersRouter.get('/organizations', (req, res) => {
  const { q, type, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  res.json(listOrganizations({ q, type, page, pageSize }));
});

usersRouter.post('/organizations', (req: AuthedRequest, res) => {
  if (!canManageOrgs(req)) return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', 'Only ministry admins can manage organizations.');
  const { code, nameAr, nameEn, type, contactEmail } = (req.body ?? {}) as {
    code?: string; nameAr?: string; nameEn?: string; type?: string; contactEmail?: string;
  };
  if (!code?.trim() || !nameAr?.trim() || !nameEn?.trim() || !type) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'الكود والاسم عربي وإنجليزي والنوع مطلوبة.', 'code, nameAr, nameEn, type are required.', [
      { field: 'code', issue: !code ? 'required' : 'ok' },
    ]);
  }
  if (!ORG_TYPES.includes(type)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'نوع جهة غير صالح.', 'Invalid organization type.', [{ field: 'type', issue: 'unknown type' }]);
  }
  if (getOrganizationByCode(code)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'هذا الكود مسجل بالفعل.', 'Code already exists.', [{ field: 'code', issue: 'unique' }]);
  }
  const created = createOrganization({
    code: code.trim(), nameAr: nameAr.trim(), nameEn: nameEn.trim(), type, contactEmail: contactEmail?.trim() ?? '',
  });
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'create', entityType: 'organization', entityId: created.id,
    summaryAr: `إنشاء جهة ${created.nameAr}`,
  });
  return okMessage(res, 201, 'تم إنشاء الجهة', { id: created.id });
});

usersRouter.put('/organizations/:id', (req: AuthedRequest, res) => {
  if (!canManageOrgs(req)) return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', 'Only ministry admins can manage organizations.');
  const found = getOrganizationById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'الجهة غير موجودة.', 'Organization not found.');
  const patch = (req.body ?? {}) as { code?: string; nameAr?: string; nameEn?: string; type?: string; active?: boolean; contactEmail?: string };
  if (patch.type !== undefined && !ORG_TYPES.includes(patch.type)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'نوع جهة غير صالح.', 'Invalid organization type.', [{ field: 'type', issue: 'unknown type' }]);
  }
  if (patch.code !== undefined && getOrganizationByCode(patch.code) && getOrganizationByCode(patch.code)?.id !== found.id) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'هذا الكود مسجل بالفعل.', 'Code already exists.', [{ field: 'code', issue: 'unique' }]);
  }
  const updated = updateOrganization(found.id, {
    ...(patch.code !== undefined ? { code: patch.code } : {}),
    ...(patch.nameAr !== undefined ? { nameAr: patch.nameAr } : {}),
    ...(patch.nameEn !== undefined ? { nameEn: patch.nameEn } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
    ...(patch.contactEmail !== undefined ? { contactEmail: patch.contactEmail } : {}),
  });
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'update', entityType: 'organization', entityId: found.id,
    summaryAr: `تحديث جهة ${updated?.nameAr ?? found.nameAr}`,
  });
  return okMessage(res, 200, 'تم حفظ الجهة', { id: found.id });
});
