import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { applyDecision, createApplication, getApplicationById, listApplications, orgParticipated, type ApplicationWithTrack } from '../store/applications.js';
import { DECISION_ACTIONS, decisionPolicy, getStages, intakeStage, type WorkflowStage } from '../store/workflow.js';
import type { User } from '../store/users.js';
import { notifyFactoryDecision, notifyFactorySubmitted } from '../services/factoryNotify.js';
import { getInitiativeById } from '../store/initiatives.js';
import { getFactoryById } from '../store/factories.js';
import { addAuditLog } from '../store/audit.js';
import { getDb } from '../db/sqlite.js';
import { apiError, okMessage } from '../middleware/error.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const applicationsRouter = Router();

const OVERSIGHT_ROLES = ['ministry_admin', 'initiative_manager', 'auditor'];

/** Adds what THIS viewer may do — the frontend never re-derives the rule. */
function withViewer<T extends ApplicationWithTrack>(app: T, user: User | undefined, cache?: Map<string, WorkflowStage[]>) {
  const policy = decisionPolicy(user, app, getStages(app.initiativeId, cache));
  return { ...app, viewerCanDecide: policy.canDecide, allowedActions: policy.allowedActions };
}

// PROD FIX: حد خاص للقرارات الحساسة (منع spam القرارات).
const decisionLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', messageAr: 'قرارات كثيرة — انتظر قليلا.', messageEn: 'Too many decisions.' },
});

applicationsRouter.get('/applications', (req: AuthedRequest, res) => {
  const { initiativeId, status, orgId, factoryId, q, page = '1', pageSize = '10' } = req.query as Record<string, string>;
  const role = req.user?.role ?? '';
  // P0-SEC: عزل الصفوف حسب الدور — المالك يرى طلبات مصنعه، المراجع يرى المسند لجهته، الأدمن/المدقق يرون الكل.
  if (role === 'factory_owner') {
    const ownFactory = (req.user as { factoryId?: string } | undefined)?.factoryId ?? '';
    if (!ownFactory) return res.json({ data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    if (factoryId && factoryId !== ownFactory) {
      return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك عرض طلبات مصنع آخر.', 'You can only list your own factory applications.');
    }
    const r = listApplications({ initiativeId, status, orgId, factoryId: ownFactory, q, page, pageSize });
    return res.json({ ...r, data: r.data.map((a) => ({ ...a, viewerCanDecide: false, allowedActions: [] })) });
  }
  const cache = new Map<string, WorkflowStage[]>();
  if (!OVERSIGHT_ROLES.includes(role)) {
    const ownOrg = req.user?.organizationId ?? '';
    if (orgId && orgId !== ownOrg) {
      return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك عرض طلبات جهة أخرى.', 'You can only list your organization applications.');
    }
    // الجهة ترى المسند لها الآن + ما شاركت فيه سابقاً (اطلاع فقط).
    const r = listApplications({ initiativeId, status, orgId, factoryId, q, page, pageSize, visibleToOrgId: ownOrg });
    return res.json({ ...r, data: r.data.map((a) => withViewer(a, req.user, cache)) });
  }
  const r = listApplications({ initiativeId, status, orgId, factoryId, q, page, pageSize });
  res.json({ ...r, data: r.data.map((a) => withViewer(a, req.user, cache)) });
});

applicationsRouter.post('/applications', (req: AuthedRequest, res) => {
  const { initiativeId, factoryId, formData, detailsFileId } = (req.body ?? {}) as {
    initiativeId?: string; factoryId?: string; formData?: Record<string, unknown>; detailsFileId?: string;
  };
  if (!initiativeId || !factoryId || !formData || typeof formData !== 'object' || Array.isArray(formData)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'initiativeId و factoryId و formData مطلوبة.', 'initiativeId, factoryId, formData are required.', [
      { field: 'initiativeId', issue: !initiativeId ? 'required' : 'ok' },
    ]);
  }
  const init = getInitiativeById(initiativeId);
  if (!init) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  if (init.status !== 'active') {
    return apiError(res, 400, 'INITIATIVE_NOT_ACTIVE', 'المبادرة غير نشطة ولا تقبل طلبات.', 'Initiative is not active.');
  }
  const factory = getFactoryById(factoryId);
  if (!factory) return apiError(res, 404, 'NOT_FOUND', 'المصنع غير موجود.', 'Factory not found.');
  // P0-SEC: مالك المصنع لا يقدم إلا باسم مصنعه.
  if (req.user?.role === 'factory_owner') {
    const ownFactory = (req.user as { factoryId?: string } | undefined)?.factoryId ?? '';
    if (factoryId !== ownFactory) {
      return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك التقديم باسم مصنع آخر.', 'You can only submit for your own factory.');
    }
  }
  const requiresFile = Boolean((init.customization as Record<string, unknown>)?.requireDetailsFile);
  if (requiresFile && !detailsFileId) {
    return apiError(res, 400, 'DETAILS_FILE_REQUIRED', 'ملف التفاصيل PDF إجباري لهذه المبادرة.', 'detailsFileId is required.', [
      { field: 'detailsFileId', issue: 'required' },
    ]);
  }
  let detailsFileIds: string[] = [];
  if (detailsFileId) {
    const db = getDb();
    const file = db.prepare('SELECT id, factoryId FROM details_files WHERE id = ?').get(detailsFileId) as { id: string; factoryId: string } | undefined;
    if (!file) {
      return apiError(res, 404, 'NOT_FOUND', 'ملف التفاصيل غير موجود.', 'Details file not found.', [
        { field: 'detailsFileId', issue: 'not found' },
      ]);
    }
    if (file.factoryId !== factoryId) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'ملف التفاصيل لا يخص هذا المصنع.', 'Details file belongs to another factory.', [
        { field: 'detailsFileId', issue: 'factory mismatch' },
      ]);
    }
    detailsFileIds = [detailsFileId];
  }
  // كل طلب يبدأ بأول مرحلة (بالترتيب) = «المراجعة الأولية — الوزارة»؛ الاحتياطي نفس المرحلة.
  const first = getStages(init.id)[0] ?? intakeStage();
  const created = createApplication({
    initiativeId: init.id,
    initiativeTitleAr: init.titleAr,
    factoryId: factory.id as string,
    factoryNameAr: String(factory.nameAr ?? ''),
    factorySectorAr: String(factory.sector ?? factory.sectorAr ?? ''),
    factoryGovernorateAr: String(factory.governorate ?? factory.governorateAr ?? ''),
    currentStageId: String(first.id),
    currentStageNameAr: String(first.nameAr ?? ''),
    currentAssignedOrgId: String(first.assignedOrgId),
    currentAssignedOrgNameAr: String(first.assignedOrgNameAr ?? ''),
    slaDays: Number(first.slaDays ?? 3),
    formData,
    detailsFileIds,
    by: req.userId ?? 'unknown',
  });
  if (detailsFileId) {
    getDb().prepare('UPDATE details_files SET applicationId = ? WHERE id = ?').run(created.id, detailsFileId);
  }
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'submit', entityType: 'application', entityId: created.id,
    summaryAr: `تقديم طلب ${created.applicationNumber} لمبادرة ${init.titleAr}`,
  });
  // بريد رسمي للمنشأة: «تم استلام طلبكم» (عبر طابور البريد — لا يؤخر الرد).
  notifyFactorySubmitted(created);
  return okMessage(res, 201, 'تم تقديم الطلب بنجاح', { id: created.id, applicationNumber: created.applicationNumber });
});

applicationsRouter.get('/applications/:id', (req: AuthedRequest, res) => {
  const found = getApplicationById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'الطلب غير موجود.', 'Application not found.');
  // P0-SEC: نفس عزل القائمة — المالك لطلبه، المراجع للمسند لجهته، الأدمن/المدقق للكل.
  const role = req.user?.role ?? '';
  if (role === 'factory_owner') {
    const ownFactory = (req.user as { factoryId?: string } | undefined)?.factoryId ?? '';
    if (found.factoryId !== ownFactory) {
      return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك عرض طلب مصنع آخر.', 'You can only view your own factory application.');
    }
  } else if (!OVERSIGHT_ROLES.includes(role)) {
    // الجهة: المسند لها الآن أو ما شاركت فيه سابقاً (اطلاع فقط).
    if (!orgParticipated(found, req.user?.organizationId ?? '')) {
      return apiError(res, 403, 'NOT_ASSIGNED', 'الطلب غير مسند لجهتك.', 'Not assigned to your organization.');
    }
  }
  // PROD FIX: لا تسرب storedPath — اختر أعمدة آمنة فقط.
  const files = getDb().prepare(
    'SELECT id, factoryId, fileName, fileSize, description, initiativeId, applicationId, uploadedAt, uploadedBy, status FROM details_files WHERE applicationId = ?',
  ).all(found.id);
  const viewer = role === 'factory_owner' ? { viewerCanDecide: false, allowedActions: [] } : withViewer(found, req.user);
  return okMessage(res, 200, 'ok', { ...found, ...viewer, detailsFiles: files });
});

applicationsRouter.post('/applications/:id/decisions', decisionLimiter, (req: AuthedRequest, res) => {
  const found = getApplicationById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'الطلب غير موجود.', 'Application not found.');
  const { action, comments, documentIdToVerify } = (req.body ?? {}) as { action?: string; comments?: string; documentIdToVerify?: string };
  if (!action || !(DECISION_ACTIONS as readonly string[]).includes(action)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'إجراء غير صالح.', 'Invalid action.', [
      { field: 'action', issue: 'must be approve|request_rework|reject|escalate' },
    ]);
  }
  if ((action === 'request_rework' || action === 'reject' || action === 'escalate') && !comments?.trim()) {
    return apiError(res, 400, 'COMMENTS_REQUIRED', 'التعليق إجباري عند طلب الاستيفاء أو الرفض أو التصعيد.', 'comments are required.', [
      { field: 'comments', issue: 'required' },
    ]);
  }
  // الحوكمة: الجهة صاحبة المرحلة فقط تقرر؛ الإدارة تقرر «المراجعة الأولية» ثم تتابع.
  const policy = decisionPolicy(req.user, found, getStages(found.initiativeId));
  if (policy.reason === 'CLOSED') {
    return apiError(res, 409, 'APPLICATION_CLOSED', 'الطلب مغلق (مكتمل أو مرفوض) ولا يقبل قرارات.', 'Application is closed.');
  }
  if (policy.reason === 'MONITOR_ONLY') {
    return apiError(res, 403, 'NOT_ASSIGNED', 'دور الإدارة في هذه المرحلة المتابعة فقط — القرار للجهة المسند إليها الطلب.', 'Officials monitor this stage; only the assigned organization decides.');
  }
  if (!policy.canDecide) {
    return apiError(res, 403, 'NOT_ASSIGNED', 'الطلب غير مسند لجهتك أو دورك لا يملك صلاحية القرار.', 'Not assigned to your organization.');
  }
  if (!(policy.allowedActions as string[]).includes(action)) {
    return apiError(res, 400, 'ACTION_NOT_ALLOWED', 'هذا الإجراء غير متاح في هذه المرحلة.', 'Action not allowed at this stage.', [
      { field: 'action', issue: `allowed: ${policy.allowedActions.join('|')}` },
    ]);
  }
  // PROD FIX: مرر documentIdToVerify للموتور (كان مُتجاهَل).
  if (documentIdToVerify) {
    const f = getDb().prepare('SELECT id, factoryId FROM details_files WHERE id = ?').get(documentIdToVerify) as { id: string; factoryId: string } | undefined;
    if (!f || f.factoryId !== found.factoryId) {
      return apiError(res, 404, 'NOT_FOUND', 'مستند التحقق غير موجود لهذا الطلب.', 'Document to verify not found.', [
        { field: 'documentIdToVerify', issue: 'not found' },
      ]);
    }
  }
  const updated = applyDecision(found.id, action, comments, req.userId ?? 'unknown', { documentIdToVerify }) as ApplicationWithTrack;
  const ACTION_AR: Record<string, string> = { approve: 'اعتماد', request_rework: 'طلب استيفاء', reject: 'رفض', escalate: 'تصعيد للوزارة' };
  addAuditLog({
    userId: req.userId,
    userName: req.user?.name ?? req.userId ?? 'unknown',
    ip: req.clientIp,
    actionType: 'decision', entityType: 'application', entityId: found.id,
    summaryAr: `${ACTION_AR[action] ?? action} — الطلب ${found.applicationNumber} — مرحلة «${found.currentStageNameAr}»`,
    beforeJson: { status: found.status, stageId: found.currentStageId, orgId: found.currentAssignedOrgId },
    afterJson: { status: updated.status, stageId: updated.currentStageId, orgId: updated.currentAssignedOrgId },
  });
  // بريد رسمي للمنشأة بكل تحديث في مراحل طلبها (الملاحظات تصلها كما هي؛ التصعيد داخلي بلا بريد).
  notifyFactoryDecision(found, updated, action, comments);
  return okMessage(res, 200, 'تم تسجيل القرار', { newStatus: updated.status, newStageId: updated.currentStageId });
});
