import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getApplicationById } from '../store/applications.js';
import { createMessage, listMessages } from '../store/messages.js';
import { getOrganizationById } from '../store/organizations.js';
import { addAuditLog } from '../store/audit.js';
import { getDb } from '../db/sqlite.js';
import { apiError, okMessage } from '../middleware/error.js';
import { AUDIT_ROLES } from '../middleware/requireRole.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const messagesRouter = Router();

// Contract-first 5b: حد خاص لرسائل التواصل (منع spam — نفس نمط قرارات applications).
const messageLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', messageAr: 'رسائل كثيرة — انتظر قليلا.', messageEn: 'Too many messages.' },
});

function validateCustomFields(raw: unknown): { ok: boolean; value: Record<string, string>; issue?: string } {
  if (raw === undefined) return { ok: true, value: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, value: {}, issue: 'must be an object' };
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 10) return { ok: false, value: {}, issue: 'max 10 keys' };
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (typeof v !== 'string') return { ok: false, value: {}, issue: `key '${k}' must be a string` };
    if (v.length > 500) return { ok: false, value: {}, issue: `key '${k}' max 500 chars` };
    out[k] = v;
  }
  return { ok: true, value: out };
}

messagesRouter.get('/applications/:id/messages', (req: AuthedRequest, res) => {
  const found = getApplicationById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'الطلب غير موجود.', 'Application not found.');
  const role = req.user?.role ?? '';
  const { page = '1', pageSize = '20' } = req.query as Record<string, string>;
  // عزل القراءة: أدمن/مدير/مدقق يرون الكل.
  if ((AUDIT_ROLES as readonly string[]).includes(role)) {
    return res.json(listMessages(found.id, { page, pageSize }));
  }
  if (role === 'factory_owner') {
    const ownFactory = (req.user as { factoryId?: string } | undefined)?.factoryId ?? '';
    if (found.factoryId !== ownFactory) {
      return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك عرض رسائل طلب مصنع آخر.', 'You can only view your own factory application messages.');
    }
    return res.json(listMessages(found.id, { page, pageSize }));
  }
  // غيرهما: فقط ما جهته مرسل/مستلم.
  const ownOrg = req.user?.organizationId ?? '';
  return res.json(listMessages(found.id, { page, pageSize, orgId: ownOrg }));
});

messagesRouter.post('/applications/:id/messages', messageLimiter, (req: AuthedRequest, res) => {
  const found = getApplicationById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'الطلب غير موجود.', 'Application not found.');
  const { toOrgId, subject, body, customFields, detailsFileId } = (req.body ?? {}) as {
    toOrgId?: string; subject?: string; body?: string;
    customFields?: unknown; detailsFileId?: string;
  };

  // 1) صلاحية الإرسال: أدمن/مدير أي طلب؛ غيرهما جهته = المسندة الحالية أو مالك مصنع الطلب.
  const role = req.user?.role ?? '';
  const isPrivileged = role === 'ministry_admin' || role === 'initiative_manager';
  if (!isPrivileged) {
    if (role === 'factory_owner') {
      const ownFactory = (req.user as { factoryId?: string } | undefined)?.factoryId ?? '';
      if (found.factoryId !== ownFactory) {
        return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك مراسلة جهات طلب مصنع آخر.', 'You can only message about your own factory application.');
      }
    } else if (found.currentAssignedOrgId !== req.user?.organizationId) {
      return apiError(res, 403, 'NOT_ASSIGNED', 'الطلب غير مسند لجهتك.', 'Not assigned to your organization.');
    }
  }

  // 2) المستلم: جهة موجودة ونشطة ≠ جهة المرسل.
  const fromOrgId = req.user?.organizationId ?? '';
  if (!toOrgId || typeof toOrgId !== 'string') {
    return apiError(res, 400, 'VALIDATION_ERROR', 'الجهة المستلمة مطلوبة.', 'toOrgId is required.', [
      { field: 'toOrgId', issue: 'required' },
    ]);
  }
  const target = getOrganizationById(toOrgId);
  if (!target || !target.active) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'الجهة المستلمة غير موجودة أو غير نشطة.', 'Recipient organization not found or inactive.', [
      { field: 'toOrgId', issue: 'unknown or inactive' },
    ]);
  }
  if (toOrgId === fromOrgId) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'لا يمكن المراسلة لنفس جهتك.', 'Cannot message your own organization.', [
      { field: 'toOrgId', issue: 'must differ from sender org' },
    ]);
  }

  // 3) المتن: 1..2000 حرف.
  if (!body || typeof body !== 'string' || !body.trim() || body.trim().length > 2000) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'نص الرسالة مطلوب (1..2000 حرف).', 'body is required (1..2000 chars).', [
      { field: 'body', issue: !body?.trim() ? 'required' : 'max 2000 chars' },
    ]);
  }

  // 4) الحقول المخصصة: كائن ≤10 مفاتيح، قيم نصية ≤500.
  const cf = validateCustomFields(customFields);
  if (!cf.ok) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'الحقول المخصصة غير صالحة.', 'Invalid customFields.', [
      { field: 'customFields', issue: cf.issue ?? 'invalid' },
    ]);
  }

  // 5) ملف التفاصيل: يخص نفس مصنع الطلب (نفس نمط createApplication).
  if (detailsFileId) {
    const file = getDb().prepare('SELECT id, factoryId FROM details_files WHERE id = ?').get(detailsFileId) as { id: string; factoryId: string } | undefined;
    if (!file) {
      return apiError(res, 404, 'NOT_FOUND', 'ملف التفاصيل غير موجود.', 'Details file not found.', [
        { field: 'detailsFileId', issue: 'not found' },
      ]);
    }
    if (file.factoryId !== found.factoryId) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'ملف التفاصيل لا يخص مصنع هذا الطلب.', 'Details file belongs to another factory.', [
        { field: 'detailsFileId', issue: 'factory mismatch' },
      ]);
    }
  }

  const created = createMessage({
    applicationId: found.id,
    fromUserId: req.userId ?? 'unknown',
    fromOrgId,
    toOrgId,
    subject: typeof subject === 'string' ? subject.trim().slice(0, 200) : '',
    body: body.trim(),
    customFields: cf.value,
    detailsFileId,
  });
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'message', entityType: 'application', entityId: found.id,
    summaryAr: `رسالة من ${req.user?.organizationId ?? ''} إلى ${toOrgId} حول الطلب ${found.applicationNumber}`,
  });
  return okMessage(res, 201, 'تم إرسال الرسالة بنجاح', created);
});
