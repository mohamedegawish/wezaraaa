import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import {
  INITIATIVE_COLUMNS,
  createInitiative,
  deleteInitiative,
  duplicateInitiative,
  getInitiativeById,
  getInitiativeKpis,
  listInitiatives,
  slugExists,
  updateCustomization,
  updateInitiative,
  updateInitiativeKpis,
  updateWorkflow,
} from '../store/initiatives.js';
import { countApplicationsByInitiative } from '../store/applications.js';
import { getOrganizationById } from '../store/organizations.js';
import { MINISTRY_ORG_ID, normalizeWorkflowStages } from '../store/workflow.js';
import { addAuditLog } from '../store/audit.js';
import { apiError, okMessage } from '../middleware/error.js';
import { optionalUser, type AuthedRequest } from '../middleware/auth.js';
import { AUDIT_ROLES } from '../middleware/requireRole.js';

export const initiativesRouter = Router();

// API-only frontend: public showcase reads (no auth) — mounted BEFORE auth in app.ts.
// Mutations stay on initiativesRouter (protected).
export const publicInitiativesRouter = Router();
// المسودة والمؤرشفة لا تظهر للجمهور — فقط للإدارة والمدقق (الهوية اختيارية هنا: الراوت قبل auth).
const HIDDEN_FROM_PUBLIC = ['draft', 'archived'];
const canSeeHidden = (req: Request): boolean => {
  const role = optionalUser(req)?.role ?? '';
  return (AUDIT_ROLES as readonly string[]).includes(role);
};
publicInitiativesRouter.get('/initiatives', (req, res) => {
  const { status, q, page = '1', pageSize = '20', full } = req.query as Record<string, string>;
  res.json(listInitiatives({ status, q, page, pageSize, full: full === '1', hideStatuses: canSeeHidden(req) ? [] : HIDDEN_FROM_PUBLIC }));
});
publicInitiativesRouter.get('/initiatives/:id', (req, res) => {
  const found = getInitiativeById(req.params.id);
  if (!found || (HIDDEN_FROM_PUBLIC.includes(found.status) && !canSeeHidden(req))) {
    return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  }
  return okMessage(res, 200, 'ok', found);
});

const INITIATIVE_STATUSES = ['active', 'draft', 'coming_soon', 'closed', 'archived', 'completed'];
// كل حقول المبادرة القابلة للتحكم من الأدمن (INITIATIVE = CONFIGURATION — لا Hard-code).
// customization و workflow لهما راوتس مخصصة، لذا يستبعدان من الدمج العام هنا.
const EDITABLE_FIELDS = [...INITIATIVE_COLUMNS] as const;

const ARRAY_FIELDS = new Set([
  'targetSectors', 'targetSectorsEn', 'targetGovernorates', 'participatingOrgs',
  'benefits', 'faqs', 'preEligibilityQuestions', 'requiredDocsList', 'formSections',
  'objectives', 'eligibilityRequirements', 'selectionCriteria',
]);
const FINANCING_TYPES = ['bank_loans', 'grants', 'subsidy', 'mixed'];
const CURRENCIES = ['EGP', 'USD'];
const FINANCIAL_NUMBERS = ['maxDurationYears', 'maxFinancingPerClientEGP', 'maxFinancingPerGroupEGP'] as const;
const KPI_UNITS = ['count', 'MW', 'MWh', 'EGP', 'tCO2', 'toe', 'percent', 'days'];

type FieldError = { field: string; issue: string; messageAr: string; messageEn: string };

/** المحددات المالية: كائن، أرقامه ≥ 0، ونوع التمويل/العملة من القيم المسموحة. */
function validateFinancialTerms(v: unknown): FieldError | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return { field: 'financialTerms', issue: 'must be object', messageAr: 'المحددات المالية يجب أن تكون كائنا.', messageEn: 'financialTerms must be an object.' };
  }
  const t = v as Record<string, unknown>;
  if (t.financingType !== undefined && t.financingType !== '' && !FINANCING_TYPES.includes(String(t.financingType))) {
    return { field: 'financialTerms.financingType', issue: `must be ${FINANCING_TYPES.join('|')}`, messageAr: 'نوع التمويل غير صالح.', messageEn: 'Invalid financingType.' };
  }
  if (t.currency !== undefined && t.currency !== '' && !CURRENCIES.includes(String(t.currency))) {
    return { field: 'financialTerms.currency', issue: `must be ${CURRENCIES.join('|')}`, messageAr: 'العملة غير صالحة.', messageEn: 'Invalid currency.' };
  }
  for (const k of FINANCIAL_NUMBERS) {
    if (t[k] === undefined || t[k] === null || t[k] === '') continue;
    const n = Number(t[k]);
    if (!Number.isFinite(n) || n < 0) {
      return { field: `financialTerms.${k}`, issue: '>= 0', messageAr: 'قيم المحددات المالية يجب أن تكون أرقاما موجبة.', messageEn: `${k} must be a number >= 0.` };
    }
  }
  return null;
}

/** مؤشرات الأداء: قائمة، لكل مؤشر اسم عربي ووحدة معروفة، والمستهدف/المحقق أرقام ≥ 0 إن وُجدا. */
function validateKpis(v: unknown): FieldError | null {
  if (!Array.isArray(v)) {
    return { field: 'kpis', issue: 'must be array', messageAr: 'المؤشرات يجب أن تكون قائمة.', messageEn: 'kpis must be an array.' };
  }
  for (let i = 0; i < v.length; i++) {
    const k = v[i] as Record<string, unknown> | null;
    if (!k || typeof k !== 'object' || !String(k.nameAr ?? '').trim()) {
      return { field: `kpis[${i}].nameAr`, issue: 'required', messageAr: `اسم المؤشر ${i + 1} بالعربي مطلوب.`, messageEn: `kpis[${i}].nameAr is required.` };
    }
    if (k.unit !== undefined && !KPI_UNITS.includes(String(k.unit))) {
      return { field: `kpis[${i}].unit`, issue: `must be ${KPI_UNITS.join('|')}`, messageAr: `وحدة المؤشر ${i + 1} غير صالحة.`, messageEn: `kpis[${i}].unit is invalid.` };
    }
    for (const f of ['targetValue', 'currentValue'] as const) {
      if (k[f] === undefined || k[f] === null || k[f] === '') continue;
      const n = Number(k[f]);
      if (!Number.isFinite(n) || n < 0) {
        return { field: `kpis[${i}].${f}`, issue: '>= 0', messageAr: `قيمة المؤشر ${i + 1} يجب أن تكون رقما موجبا.`, messageEn: `kpis[${i}].${f} must be >= 0.` };
      }
    }
  }
  return null;
}

function canManage(req: AuthedRequest): boolean {
  return req.user?.role === 'ministry_admin' || req.user?.role === 'initiative_manager';
}

function slugify(input: string): string {
  return (input || 'initiative')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `init-${randomUUID().slice(0, 8)}`;
}

// تحقق مشترك لأي إضافة/تعديل — يرجع رسالة الخطأ أو null.
function validateInitiativePatch(
  patch: Record<string, unknown>,
  opts: { isCreate: boolean; selfId?: string },
): { field: string; issue: string; messageAr: string; messageEn: string } | null {
  if (opts.isCreate) {
    const tAr = (patch.titleAr as string | undefined)?.trim() ?? '';
    const tEn = (patch.titleEn as string | undefined)?.trim() ?? '';
    if (tAr.length < 3 || tEn.length < 3) {
      return { field: 'titleAr', issue: 'min 3', messageAr: 'عنوان المبادرة عربي وإنجليزي مطلوب (3 أحرف على الأقل).', messageEn: 'titleAr and titleEn are required (min 3).' };
    }
  } else {
    if (patch.titleAr !== undefined && String(patch.titleAr).trim().length < 3) {
      return { field: 'titleAr', issue: 'min 3', messageAr: 'عنوان المبادرة العربي قصير جدا.', messageEn: 'titleAr too short.' };
    }
    if (patch.titleEn !== undefined && String(patch.titleEn).trim().length < 3) {
      return { field: 'titleEn', issue: 'min 3', messageAr: 'عنوان المبادرة الإنجليزي قصير جدا.', messageEn: 'titleEn too short.' };
    }
  }
  if (patch.status !== undefined && !INITIATIVE_STATUSES.includes(patch.status as string)) {
    return { field: 'status', issue: `must be ${INITIATIVE_STATUSES.join('|')}`, messageAr: 'حالة المبادرة غير صالحة.', messageEn: 'Invalid status.' };
  }
  for (const money of ['budgetTotalEGP', 'budgetAllocatedEGP'] as const) {
    if (patch[money] !== undefined && (Number.isNaN(Number(patch[money])) || Number(patch[money]) < 0)) {
      return { field: money, issue: '>= 0', messageAr: 'الميزانية يجب أن تكون رقما موجبا.', messageEn: `${money} must be >= 0.` };
    }
  }
  for (const f of ARRAY_FIELDS) {
    if (patch[f] !== undefined && !Array.isArray(patch[f])) {
      return { field: f, issue: 'must be array', messageAr: `الحقل ${f} يجب أن يكون قائمة.`, messageEn: `${f} must be an array.` };
    }
  }
  if (patch.impactMetrics !== undefined && (typeof patch.impactMetrics !== 'object' || patch.impactMetrics === null || Array.isArray(patch.impactMetrics))) {
    return { field: 'impactMetrics', issue: 'must be object', messageAr: 'مؤشرات الأثر يجب أن تكون كائنا.', messageEn: 'impactMetrics must be an object.' };
  }
  if (patch.financialTerms !== undefined) {
    const e = validateFinancialTerms(patch.financialTerms);
    if (e) return e;
  }
  if (patch.slug !== undefined) {
    const slug = String(patch.slug).trim();
    if (!slug) return { field: 'slug', issue: 'required', messageAr: 'المعرف النصي slug مطلوب.', messageEn: 'slug is required.' };
    if (slugExists(slug, opts.selfId)) {
      return { field: 'slug', issue: 'unique', messageAr: 'هذا المعرف النصي مسجل بالفعل.', messageEn: 'slug already exists.' };
    }
  }
  return null;
}

function pickEditable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

initiativesRouter.post('/initiatives', (req: AuthedRequest, res) => {
  if (!canManage(req)) return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', 'Only ministry_admin / initiative_manager can create initiatives.');
  const body = (req.body ?? {}) as Record<string, unknown>;
  const err = validateInitiativePatch(body, { isCreate: true });
  if (err) {
    return apiError(res, 400, 'VALIDATION_ERROR', err.messageAr, err.messageEn, [{ field: err.field, issue: err.issue }]);
  }
  const patch = pickEditable(body);
  const titleEn = String(patch.titleEn ?? 'New Initiative');
  const slug = (String((patch.slug as string | undefined) ?? '').trim() || slugify(titleEn));
  if (slugExists(slug)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'هذا المعرف النصي مسجل بالفعل.', 'slug already exists.', [{ field: 'slug', issue: 'unique' }]);
  }
  const created = createInitiative({ ...patch, titleAr: String(patch.titleAr ?? ''), titleEn, slug });
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'create', entityType: 'initiative', entityId: created.id,
    summaryAr: `إنشاء مبادرة ${created.titleAr}`,
  });
  return okMessage(res, 201, 'تم إنشاء المبادرة', { id: created.id });
});

initiativesRouter.put('/initiatives/:id', (req: AuthedRequest, res) => {
  if (!canManage(req)) return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', 'Only ministry_admin / initiative_manager can update initiatives.');
  const found = getInitiativeById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  const body = (req.body ?? {}) as Record<string, unknown>;
  // تحكم تفاؤلي بالتزامن: المحرر يرسل updatedAt الذي فتح عليه — إن تغيرت المبادرة بعدها نرفض
  // بدل أن تمسح نسخة قديمة تعديلات أحدث (حدث فعلاً: حفظ من صفحة مفتوحة قبل تحديث البيانات).
  if (typeof body.expectedUpdatedAt === 'string' && body.expectedUpdatedAt && body.expectedUpdatedAt !== found.updatedAt) {
    return apiError(res, 409, 'CONFLICT',
      'تم تعديل هذه المبادرة من مكان آخر بعد فتحك لها — أعد فتح المحرر لتحميل أحدث نسخة ثم أعد تعديلاتك.',
      'This initiative was modified after you opened it — reopen the editor to load the latest version.',
      [{ field: 'expectedUpdatedAt', issue: `current ${found.updatedAt}` }]);
  }
  const err = validateInitiativePatch(body, { isCreate: false, selfId: found.id });
  if (err) {
    return apiError(res, 400, 'VALIDATION_ERROR', err.messageAr, err.messageEn, [{ field: err.field, issue: err.issue }]);
  }
  const patch = pickEditable(body);
  if (patch.slug !== undefined) patch.slug = String(patch.slug).trim();
  const updated = updateInitiative(found.id, patch) as { id: string; titleAr: string };
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'update', entityType: 'initiative', entityId: found.id,
    summaryAr: `تحديث مبادرة ${updated.titleAr}`,
  });
  return okMessage(res, 200, 'تم حفظ المبادرة', { id: found.id });
});

initiativesRouter.delete('/initiatives/:id', (req: AuthedRequest, res) => {
  if (req.user?.role !== 'ministry_admin') {
    return apiError(res, 403, 'FORBIDDEN', 'حذف المبادرات للمشرف العام فقط.', 'Only ministry_admin can delete initiatives.');
  }
  const found = getInitiativeById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  const linked = countApplicationsByInitiative(req.params.id);
  if (linked > 0) {
    return apiError(res, 400, 'HAS_APPLICATIONS', `لا يمكن حذف المبادرة — يوجد ${linked} طلب مرتبط بها.`, 'Initiative has linked applications.', [
      { field: 'initiativeId', issue: 'has applications' },
    ]);
  }
  deleteInitiative(req.params.id);
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'delete', entityType: 'initiative', entityId: req.params.id,
    summaryAr: `حذف مبادرة ${found.titleAr}`,
  });
  return okMessage(res, 200, 'تم حذف المبادرة', { id: req.params.id });
});

// نسخ مبادرة كاملة كمسودة (البيانات + التخصيص + المراحل + المؤشرات) لبدء مبادرة جديدة منها.
initiativesRouter.post('/initiatives/:id/duplicate', (req: AuthedRequest, res) => {
  if (!canManage(req)) return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', 'Only ministry_admin / initiative_manager can duplicate initiatives.');
  const copy = duplicateInitiative(req.params.id);
  if (!copy) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'create', entityType: 'initiative', entityId: copy.id,
    summaryAr: `نسخ مبادرة ${copy.titleAr}`,
  });
  return okMessage(res, 201, 'تم نسخ المبادرة كمسودة', { id: copy.id });
});

// مؤشرات قياس الأداء — ADMIN ONLY: لا تظهر في القراءة العامة للمبادرة.
initiativesRouter.get('/initiatives/:id/kpis', (req: AuthedRequest, res) => {
  if (!canManage(req)) return apiError(res, 403, 'FORBIDDEN', 'مؤشرات الأداء للإدارة فقط.', 'KPIs are for ministry_admin / initiative_manager only.');
  const kpis = getInitiativeKpis(req.params.id);
  if (!kpis) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  return okMessage(res, 200, 'ok', kpis);
});

initiativesRouter.put('/initiatives/:id/kpis', (req: AuthedRequest, res) => {
  if (!canManage(req)) return apiError(res, 403, 'FORBIDDEN', 'مؤشرات الأداء للإدارة فقط.', 'KPIs are for ministry_admin / initiative_manager only.');
  const found = getInitiativeById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  const kpis = (req.body ?? {}).kpis as unknown;
  const err = validateKpis(kpis);
  if (err) return apiError(res, 400, 'VALIDATION_ERROR', err.messageAr, err.messageEn, [{ field: err.field, issue: err.issue }]);
  updateInitiativeKpis(found.id, kpis as unknown[]);
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'update', entityType: 'initiative', entityId: found.id,
    summaryAr: `تحديث مؤشرات أداء مبادرة ${found.titleAr}`,
  });
  return okMessage(res, 200, 'تم حفظ مؤشرات الأداء', { id: found.id, count: (kpis as unknown[]).length });
});

initiativesRouter.get('/initiatives/:id/customization', (req, res) => {
  const found = getInitiativeById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  return okMessage(res, 200, 'ok', found.customization);
});

initiativesRouter.put('/initiatives/:id/customization', (req: AuthedRequest, res) => {
  if (!canManage(req)) return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', 'Only ministry_admin / initiative_manager can update customization.');
  const found = getInitiativeById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  const patch = (req.body ?? {}) as Record<string, unknown>;
  const max = patch.maxFileSizeMB as number | undefined;
  if (max !== undefined && (Number(max) < 1 || Number(max) > 100)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'أقصى حجم ملف بين 1 و 100 ميجا.', 'maxFileSizeMB must be 1..100.', [
      { field: 'maxFileSizeMB', issue: 'range 1..100' },
    ]);
  }
  // page: اختياري بالكامل (توافق خلفي) — يُتحقق منه فقط عند إرساله.
  if (patch.page !== undefined) {
    const page = patch.page as Record<string, unknown>;
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'إعدادات الصفحة page يجب أن تكون كائنا.', 'page must be an object.', [
        { field: 'page', issue: 'must be object' },
      ]);
    }
    const LAYOUTS = ['standard', 'spotlight', 'compact'];
    if (page.layout !== undefined && !LAYOUTS.includes(String(page.layout))) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'تخطيط الصفحة layout غير صالح.', 'page.layout must be standard|spotlight|compact.', [
        { field: 'page.layout', issue: 'must be standard|spotlight|compact' },
      ]);
    }
    if (page.galleryImages !== undefined) {
      if (!Array.isArray(page.galleryImages) || (page.galleryImages as unknown[]).length > 8 ||
        !(page.galleryImages as unknown[]).every((g) => typeof g === 'string' && (g as string).trim().length > 0)) {
        return apiError(res, 400, 'VALIDATION_ERROR', 'صور المعرض galleryImages: حتى 8 نصوص غير فارغة.', 'page.galleryImages must be an array of <= 8 non-empty strings.', [
          { field: 'page.galleryImages', issue: 'array of <= 8 strings' },
        ]);
      }
    }
    if (page.sections !== undefined) {
      const sections = page.sections as unknown[];
      const SECTION_KINDS = ['stats', 'benefits', 'timeline', 'faqs', 'partners', 'gallery', 'documents', 'apply', 'custom', 'objectives', 'financing', 'requirements', 'criteria'];
      if (!Array.isArray(sections) || sections.length > 12) {
        return apiError(res, 400, 'VALIDATION_ERROR', 'أقسام الصفحة sections: مصفوفة حتى 12 عنصرا.', 'page.sections must be an array of <= 12.', [
          { field: 'page.sections', issue: 'array <= 12' },
        ]);
      }
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i] as Record<string, unknown>;
        const where = `page.sections[${i}]`;
        if (!s || typeof s !== 'object' || Array.isArray(s)) {
          return apiError(res, 400, 'VALIDATION_ERROR', `القسم ${i + 1} غير صالح.`, 'Invalid section.', [{ field: where, issue: 'must be object' }]);
        }
        if (!String(s.id ?? '').trim()) {
          return apiError(res, 400, 'VALIDATION_ERROR', `القسم ${i + 1}: id مطلوب.`, 'section id required.', [{ field: `${where}.id`, issue: 'required' }]);
        }
        if (!SECTION_KINDS.includes(String(s.kind))) {
          return apiError(res, 400, 'VALIDATION_ERROR', `القسم ${i + 1}: kind غير صالح.`, `section kind must be ${SECTION_KINDS.join('|')}.`, [{ field: `${where}.kind`, issue: `must be ${SECTION_KINDS.join('|')}` }]);
        }
        if (!String(s.titleAr ?? '').trim() || !String(s.titleEn ?? '').trim()) {
          return apiError(res, 400, 'VALIDATION_ERROR', `القسم ${i + 1}: titleAr و titleEn مطلوبان.`, 'section titleAr and titleEn are required.', [{ field: `${where}.titleAr`, issue: 'required' }]);
        }
        if (typeof s.visible !== 'boolean') {
          return apiError(res, 400, 'VALIDATION_ERROR', `القسم ${i + 1}: visible يجب أن يكون true/false.`, 'section visible must be boolean.', [{ field: `${where}.visible`, issue: 'must be boolean' }]);
        }
        for (const bodyKey of ['bodyAr', 'bodyEn'] as const) {
          const v = s[bodyKey];
          if (v !== undefined && (typeof v !== 'string' || v.length > 2000)) {
            return apiError(res, 400, 'VALIDATION_ERROR', `القسم ${i + 1}: ${bodyKey} نص اختياري حتى 2000 حرف.`, `section ${bodyKey} must be an optional string of max 2000 chars.`, [{ field: `${where}.${bodyKey}`, issue: 'string max 2000' }]);
          }
        }
      }
    }
  }
  const merged = updateCustomization(found.id, patch) as Record<string, unknown>;
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'update', entityType: 'customization', entityId: found.id,
    summaryAr: `تحديث تخصيص مبادرة ${found.titleAr}`,
  });
  return okMessage(res, 200, 'تم حفظ التخصيص', merged);
});

initiativesRouter.get('/initiatives/:id/workflow', (req, res) => {
  const found = getInitiativeById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  return okMessage(res, 200, 'ok', found.workflow);
});

initiativesRouter.put('/initiatives/:id/workflow', (req: AuthedRequest, res) => {
  if (!canManage(req)) return apiError(res, 403, 'FORBIDDEN', 'غير مصرح لهذا الدور.', 'Only ministry_admin / initiative_manager can update workflow.');
  const found = getInitiativeById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  const { stages } = (req.body ?? {}) as { stages?: unknown[] };
  if (!Array.isArray(stages) || stages.length < 1) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'يجب إرسال مرحلة واحدة على الأقل.', 'stages must be a non-empty array.', [
      { field: 'stages', issue: 'min 1' },
    ]);
  }
  // PROD FIX: تحقق صارم من stages (كان يقبل أي شيء) — assignedOrgId/slaDays/code-unique/order.
  const seenCodes = new Set<string>();
  const seenIds = new Set<string>();
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i] as Record<string, unknown>;
    const where = `stages[${i}]`;
    if (!s || typeof s !== 'object') {
      return apiError(res, 400, 'VALIDATION_ERROR', `المرحلة ${i + 1} غير صالحة.`, 'Invalid stage.', [{ field: where, issue: 'must be object' }]);
    }
    const id = String(s.id ?? '').trim();
    const code = String(s.code ?? '').trim();
    const nameAr = String(s.nameAr ?? '').trim();
    const assignedOrgId = String(s.assignedOrgId ?? '').trim();
    const slaDays = Number(s.slaDays);
    if (!id) return apiError(res, 400, 'VALIDATION_ERROR', `المرحلة ${i + 1}: id مطلوب.`, 'stage id required.', [{ field: `${where}.id`, issue: 'required' }]);
    if (seenIds.has(id)) return apiError(res, 400, 'VALIDATION_ERROR', `معرف المرحلة مكرر: ${id}.`, 'Duplicate stage id.', [{ field: `${where}.id`, issue: 'unique' }]);
    seenIds.add(id);
    if (!code) return apiError(res, 400, 'VALIDATION_ERROR', `المرحلة ${i + 1}: code مطلوب.`, 'stage code required.', [{ field: `${where}.code`, issue: 'required' }]);
    if (seenCodes.has(code.toUpperCase())) return apiError(res, 400, 'VALIDATION_ERROR', `كود المرحلة مكرر: ${code}.`, 'Duplicate stage code.', [{ field: `${where}.code`, issue: 'unique' }]);
    seenCodes.add(code.toUpperCase());
    if (!nameAr) return apiError(res, 400, 'VALIDATION_ERROR', `المرحلة ${i + 1}: nameAr مطلوب.`, 'stage nameAr required.', [{ field: `${where}.nameAr`, issue: 'required' }]);
    if (!assignedOrgId) return apiError(res, 400, 'VALIDATION_ERROR', `المرحلة ${i + 1}: assignedOrgId مطلوب.`, 'assignedOrgId required.', [{ field: `${where}.assignedOrgId`, issue: 'required' }]);
    if (!getOrganizationById(assignedOrgId)) {
      return apiError(res, 404, 'NOT_FOUND', `المرحلة ${i + 1}: الجهة ${assignedOrgId} غير موجودة.`, 'Assigned org not found.', [{ field: `${where}.assignedOrgId`, issue: 'not found' }]);
    }
    if (!Number.isFinite(slaDays) || slaDays < 1 || slaDays > 365) {
      return apiError(res, 400, 'VALIDATION_ERROR', `المرحلة ${i + 1}: slaDays بين 1 و 365.`, 'slaDays must be 1..365.', [{ field: `${where}.slaDays`, issue: 'range 1..365' }]);
    }
  }
  // الحوكمة: «المراجعة الأولية — الوزارة» ثابتة في أول المسار، والوزارة لا تُسند لأي مرحلة أخرى
  // (الإدارة تقرر المرحلة الأولى فقط ثم تتابع).
  const normalized = normalizeWorkflowStages(stages);
  if (normalized.errors.length) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'الوزارة تقرر المرحلة الأولى فقط — أسند المراحل الأخرى لجهاتها المختصة.', `${MINISTRY_ORG_ID} may only own the intake stage.`,
      normalized.errors.map((e) => ({ field: `stages[${e.index}].assignedOrgId`, issue: e.issue })));
  }
  // اسم الجهة من جدول الجهات (مصدر الحقيقة) حتى لا تظهر أسماء قديمة في متابعة المسار.
  const withNames = normalized.stages.map((st) => ({ ...st, assignedOrgNameAr: getOrganizationById(String(st.assignedOrgId))?.nameAr ?? st.assignedOrgNameAr ?? '' }));
  const { version } = updateWorkflow(found.id, withNames) as { version: number };
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'update', entityType: 'workflow', entityId: found.id,
    summaryAr: `تحديث مسار عمل مبادرة ${found.titleAr} للإصدار ${version}`,
  });
  return okMessage(res, 200, 'تم حفظ مسار العمل', { version });
});
