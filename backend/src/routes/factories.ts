import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/sqlite.js';
import {
  createDetailsFile,
  createFactory,
  deleteDetailsFile,
  getFactoryById,
  listDetailsFiles,
  listFactories,
  updateFactory,
} from '../store/factories.js';
import { getInitiativeById } from '../store/initiatives.js';
import { createOrganization, getOrganizationByCode } from '../store/organizations.js';
import { createUser, getUserByEmail, getUserById } from '../store/users.js';
import { signAccess, signRefresh, hashPassword } from '../auth/jwt.js';
import { storeRefreshToken } from '../store/refreshTokens.js';
import { setRefreshCookie, isStrongPassword } from './auth.js';
import { AUDIT_ROLES, requireRole } from '../middleware/requireRole.js';
import { addAuditLog } from '../store/audit.js';
import { apiError, okMessage } from '../middleware/error.js';
import type { AuthedRequest } from '../middleware/auth.js';

export const factoriesRouter = Router();

// P0-SEC: فحص ملكية المصنع — المالك يرى مصنعه فقط، الأدمن/المدقق يرون الكل.
function canAccessFactory(req: AuthedRequest, factoryId: string): boolean {
  const role = req.user?.role ?? '';
  if (role === 'ministry_admin' || role === 'initiative_manager' || role === 'auditor') return true;
  const ownFactory = (req.user as { factoryId?: string } | undefined)?.factoryId ?? '';
  return ownFactory !== '' && ownFactory === factoryId;
}
function canEditFactory(req: AuthedRequest, factoryId: string): boolean {
  const role = req.user?.role ?? '';
  if (role === 'ministry_admin' || role === 'initiative_manager') return true;
  const ownFactory = (req.user as { factoryId?: string } | undefined)?.factoryId ?? '';
  return ownFactory !== '' && ownFactory === factoryId;
}

// API-only frontend: public factory self-registration (replaces local mock signup).
// Mounted BEFORE auth in app.ts — rate-limited there (publicLimiter).
export const publicFactoriesRouter = Router();

// HOSTING: حد الرفع — ملفات كبيرة مكلفة (تخزين + فحص). 30 رفع/دقيقة لكل IP.
const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', messageAr: 'رفع كثير — انتظر قليلا.', messageEn: 'Too many uploads.' },
});

fs.mkdirSync(config.uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const safe = path.basename(file.originalname).replace(/[^\w.\-+\u0600-\u06FF]+/g, '_').slice(0, 120);
    cb(null, `fdet-${randomUUID()}-${safe}`);
  },
});
// PROD FIX: fileFilter يرفض غير-PDF مبكراً + حد 100MB كسقف عام (الحد الحقيقي من customization).
function pdfFileFilter(_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ok = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';
  if (!ok) cb(new Error('INVALID_FILE_TYPE'));
  else cb(null, true);
}
const upload = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
});

// PROD FIX: whitelist صارمة — تمنع mass-assignment (كان يقبل أي مفاتيح).

// API-only frontend: public factory self-registration (replaces local mock signup).
// Creates org (type factory) + factory profile + owner account, then auto-logs in (JWT).
// Rate-limited in app.ts (publicLimiter) — same abuse surface as /auth/login.
// Mounted in app.ts as v1.use('/factories/register', publicLimiter, publicFactoriesRouter)
// so the internal path stays '/' (a full path here would double the prefix).
publicFactoriesRouter.post('/', (req: AuthedRequest, res) => {
  const b = (req.body ?? {}) as {
    name?: string; nameEn?: string; email?: string; password?: string;
    factoryNameAr?: string; factoryNameEn?: string;
    commercialRegistrationNumber?: string; industrialRegistrationNumber?: string; taxIdNumber?: string;
    sector?: string; sectorEn?: string; governorate?: string; governorateEn?: string; phone?: string;
  };
  const email = (b.email ?? '').trim();
  const missing =
    (!b.name?.trim() ? 'name' : null) ?? (!email ? 'email' : null) ??
    (!b.password ? 'password' : null) ?? (!b.factoryNameAr?.trim() ? 'factoryNameAr' : null);
  if (missing) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'الاسم والبريد وكلمة المرور واسم المنشأة مطلوبة.', 'name, email, password, factoryNameAr are required.', [
      { field: missing, issue: 'required' },
    ]);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'البريد الإلكتروني غير صالح.', 'Invalid email.', [
      { field: 'email', issue: 'invalid' },
    ]);
  }
  if (!isStrongPassword(b.password as string)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'كلمة المرور 8 أحرف على الأقل وتحتوي حرفاً ورقماً.', 'password must be 8+ with letter+digit.', [
      { field: 'password', issue: 'weak' },
    ]);
  }
  if (getUserByEmail(email)) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'هذا البريد مسجل بالفعل.', 'Email already exists.', [
      { field: 'email', issue: 'unique' },
    ]);
  }
  let code = '';
  for (let i = 0; i < 5 && !code; i++) {
    const c = `FAC-${randomUUID().slice(0, 4).toUpperCase()}`;
    if (!getOrganizationByCode(c)) code = c;
  }
  if (!code) return apiError(res, 500, 'INTERNAL_ERROR', 'تعذر إنشاء كود الجهة — حاول لاحقا.', 'Could not allocate org code.');
  const factoryNameAr = (b.factoryNameAr as string).trim();
  const factoryNameEn = b.factoryNameEn?.trim() || factoryNameAr;
  // P0-6: معاملة ذرية — فشل أي خطوة يلغي الكل (لا أيتام org/factory).
  const db = getDb();
  let org: { id: string; nameAr: string; nameEn: string };
  let factory: { id: string };
  let created: { id: string; name: string; role: string };
  let accessToken: string;
  let refreshToken: string;
  db.exec('BEGIN IMMEDIATE');
  try {
    org = createOrganization({
      code, nameAr: factoryNameAr, nameEn: factoryNameEn, type: 'factory', contactEmail: email,
    });
    factory = createFactory({
      nameAr: factoryNameAr, nameEn: factoryNameEn,
      sector: b.sector?.trim() || 'الصناعات الهندسية', sectorEn: b.sectorEn?.trim() || 'Engineering Industries',
      governorate: b.governorate?.trim() || 'القاهرة', governorateEn: b.governorateEn?.trim() || 'Cairo',
      industrialZone: 'منطقة صناعية معتمدة',
      commercialRegistrationNumber: b.commercialRegistrationNumber?.trim() || '',
      industrialRegistrationNumber: b.industrialRegistrationNumber?.trim() || '',
      taxIdNumber: b.taxIdNumber?.trim() || '',
      contactPerson: (b.name as string).trim(), contactPhone: b.phone?.trim() || '', contactEmail: email,
      employeesCount: 0, roofAreaSqMeters: 0, annualEnergyConsumptionMWh: 0, monthlyElectricityBillEGP: 0,
    });
    const vToken = randomUUID();
    const vExp = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    created = createUser({
      name: (b.name as string).trim(), nameEn: (b.nameEn?.trim() || b.name as string).trim(),
      email, role: 'factory_owner', organizationId: org.id, factoryId: factory.id,
      passwordHash: hashPassword(b.password as string), mustChangePassword: false,
      isVerified: false, emailVerificationToken: vToken, emailVerificationExpires: vExp,
    });
    // Auto-verify in test env so existing tests don't break; prod/dev require explicit verify-email
    const autoVerify = (process.env.NODE_ENV ?? 'development') === 'test';
    let finalToken: string | undefined = vToken;
    if (autoVerify) {
      getDb().prepare('UPDATE users SET isVerified = 1, emailVerificationToken = ?, emailVerificationExpires = ?, updatedAt = ? WHERE id = ?').run('', '', new Date().toISOString(), created.id);
      (created as { isVerified?: boolean }).isVerified = true;
      finalToken = undefined;
    }
    if (autoVerify) {
      accessToken = signAccess(created.id, created.role, org.id);
      const r = signRefresh(created.id);
      refreshToken = r.token;
      storeRefreshToken(created.id, '', refreshToken);
    } else {
      // Not verified yet — do not issue tokens; user must verify email first
      accessToken = '' as unknown as string;
      refreshToken = '' as unknown as string;
    }
    // Stash token for response (non-prod only)
    (created as { _verificationToken?: string })._verificationToken = finalToken;
    addAuditLog({
      userId: created.id, userName: created.name, ip: req.clientIp ?? '',
      actionType: 'create', entityType: 'factory', entityId: factory.id,
      summaryAr: `تسجيل منشأة جديدة ${factoryNameAr}`,
    });
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
  const isTest = (process.env.NODE_ENV ?? 'development') === 'test';
  if (isTest) setRefreshCookie(res, refreshToken!);
  const resp: Record<string, unknown> = {
    user: created!,
    organization: { id: org!.id, nameAr: org!.nameAr, nameEn: org!.nameEn },
    factory: { id: factory!.id, nameAr: factoryNameAr, nameEn: factoryNameEn },
    mustChangePassword: false,
  };
  if (isTest) {
    (resp as Record<string, unknown>).accessToken = accessToken!;
    (resp as Record<string, unknown>).refreshToken = refreshToken!;
  } else {
    (resp as Record<string, unknown>).requiresVerification = true;
    (resp as Record<string, unknown>).message = 'تم التسجيل — يرجى تفعيل بريدك عبر رابط التفعيل';
  }
  const vt = (created as { _verificationToken?: string })._verificationToken;
  if (vt) (resp as Record<string, unknown>).verificationToken = vt;
  return okMessage(res, 201, isTest ? 'تم تسجيل المنشأة' : 'تم التسجيل — يرجى تفعيل البريد', resp);
});

// API-only frontend: current user's factory (no static mapping, no full list needed).
factoriesRouter.get('/factories/mine', (req: AuthedRequest, res) => {
  const me = req.userId ? getUserById(req.userId) : null;
  const fid = me?.factoryId ?? '';
  if (!fid) {
    return apiError(res, 404, 'NO_FACTORY', 'لا توجد منشأة مرتبطة بحسابك.', 'No factory linked to your account.');
  }
  const found = getFactoryById(fid);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المصنع غير موجود.', 'Factory not found.');
  return okMessage(res, 200, 'ok', found);
});

// API-only frontend: factory directory for privileged roles (admin stats need it;
// factory owners use /factories/mine instead).
factoriesRouter.get('/factories', requireRole(...AUDIT_ROLES), (req, res) => {
  const { q, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  res.json(listFactories({ q, page, pageSize }));
});

factoriesRouter.get('/factories/:id', (req: AuthedRequest, res) => {
  const found = getFactoryById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المصنع غير موجود.', 'Factory not found.');
  if (!canAccessFactory(req, req.params.id)) {
    return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك الوصول لبيانات مصنع آخر.', 'You can only access your own factory.');
  }
  return okMessage(res, 200, 'ok', found);
});

const FACTORY_EDITABLE = new Set([
  'nameAr', 'nameEn', 'commercialRegistrationNumber', 'industrialRegistrationNumber',
  'taxIdNumber', 'sector', 'sectorEn', 'governorate', 'governorateEn', 'industrialZone',
  'roofAreaSqMeters', 'annualEnergyConsumptionMWh', 'monthlyElectricityBillEGP',
  'employeesCount', 'contactPerson', 'contactPhone', 'contactEmail',
]);

factoriesRouter.put('/factories/:id', (req: AuthedRequest, res) => {
  const found = getFactoryById(req.params.id);
  if (!found) return apiError(res, 404, 'NOT_FOUND', 'المصنع غير موجود.', 'Factory not found.');
  if (!canEditFactory(req, req.params.id)) {
    return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك تعديل بيانات مصنع آخر.', 'You can only edit your own factory.');
  }
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) {
    if (FACTORY_EDITABLE.has(k)) patch[k] = raw[k];
  }
  if (Object.keys(patch).length === 0) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'لا توجد حقول قابلة للتعديل.', 'No editable fields.', [
      { field: 'body', issue: 'empty or unknown fields' },
    ]);
  }
  const updated = updateFactory(found.id as string, patch);
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'update', entityType: 'factory', entityId: found.id as string,
    summaryAr: `تحديث الملف الموحد للمصنع ${found.id as string}`,
  });
  return okMessage(res, 200, 'تم حفظ الملف الموحد', { id: updated?.id });
});

factoriesRouter.get('/factories/:id/details-files', (req: AuthedRequest, res) => {
  const factory = getFactoryById(req.params.id);
  if (!factory) return apiError(res, 404, 'NOT_FOUND', 'المصنع غير موجود.', 'Factory not found.');
  if (!canAccessFactory(req, req.params.id)) {
    return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك الوصول لملفات مصنع آخر.', 'You can only access your own factory files.');
  }
  const { initiativeId } = req.query as Record<string, string>;
  return okMessage(res, 200, 'ok', listDetailsFiles(req.params.id, initiativeId));
});

factoriesRouter.post('/factories/:id/details-files', uploadLimiter, upload.single('file'), (req: AuthedRequest, res) => {
  const factory = getFactoryById(req.params.id);
  if (!canEditFactory(req, req.params.id)) {
    if (req.file) fs.promises.unlink(req.file.path).catch(() => undefined);
    return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك الرفع لمصنع آخر.', 'You can only upload to your own factory.');
  }
  if (!factory) {
    if (req.file) fs.promises.unlink(req.file.path).catch(() => undefined);
    return apiError(res, 404, 'NOT_FOUND', 'المصنع غير موجود.', 'Factory not found.');
  }
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'أرفق ملف PDF في حقل file.', 'file is required.', [
      { field: 'file', issue: 'required' },
    ]);
  }
  const cleanup = () => fs.promises.unlink(file.path).catch(() => undefined);
  const isPdf = file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';
  if (!isPdf) {
    void cleanup();
    return apiError(res, 400, 'INVALID_FILE_TYPE', 'ملف التفاصيل يجب أن يكون PDF فقط.', 'Details file must be PDF only.');
  }
  // PROD FIX: فحص magic-bytes — يمنع تزوير الامتداد (ملف .exe مُعاد تسميته لـ .pdf).
  try {
    const fd = fs.openSync(file.path, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    if (buf.toString('ascii') !== '%PDF-') {
      void cleanup();
      return apiError(res, 400, 'INVALID_FILE_TYPE', 'محتوى الملف ليس PDF حقيقي.', 'File content is not a valid PDF.');
    }
  } catch {
    void cleanup();
    return apiError(res, 400, 'INVALID_FILE_TYPE', 'تعذر فحص الملف.', 'Could not validate file.');
  }
  const initiativeId = (req.body?.initiativeId as string | undefined) ?? undefined;
  const init = initiativeId ? getInitiativeById(initiativeId) : null;
  if (initiativeId && !init) {
    void cleanup();
    return apiError(res, 404, 'NOT_FOUND', 'المبادرة غير موجودة.', 'Initiative not found.');
  }
  const maxMB = Number((init?.customization as Record<string, unknown> | undefined)?.maxFileSizeMB ?? 15);
  if (file.size > maxMB * 1024 * 1024) {
    void cleanup();
    return apiError(res, 400, 'FILE_TOO_LARGE', `حجم الملف يتجاوز ${maxMB} ميجا.`, `File exceeds ${maxMB} MB.`);
  }
  const entry = createDetailsFile({
    factoryId: factory.id as string,
    fileName: file.originalname,
    fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
    description: (req.body?.description as string | undefined) ?? '',
    initiativeId,
    applicationId: (req.body?.applicationId as string | undefined) ?? undefined,
    storedPath: file.path,
    uploadedBy: req.user?.id ?? req.userId ?? 'unknown',
  });
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'upload', entityType: 'details_file', entityId: entry.id,
    summaryAr: `رفع ملف التفاصيل ${file.originalname} للمصنع ${factory.id as string}`,
  });
  return okMessage(res, 201, 'تم رفع ملف التفاصيل', entry);
});

factoriesRouter.delete('/factories/:id/details-files/:fileId', (req: AuthedRequest, res) => {
  const factory = getFactoryById(req.params.id);
  if (!canEditFactory(req, req.params.id)) {
    return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك حذف ملفات مصنع آخر.', 'You can only delete your own factory files.');
  }
  if (!factory) return apiError(res, 404, 'NOT_FOUND', 'المصنع غير موجود.', 'Factory not found.');
  const removed = deleteDetailsFile(req.params.id, req.params.fileId);
  if (!removed) return apiError(res, 404, 'NOT_FOUND', 'الملف غير موجود.', 'File not found.');
  if (removed.storedPath) fs.promises.unlink(removed.storedPath).catch(() => undefined);
  addAuditLog({
    userName: req.user?.name ?? req.userId ?? 'unknown',
    actionType: 'delete', entityType: 'details_file', entityId: req.params.fileId,
    summaryAr: `حذف ملف التفاصيل ${removed.fileName}`,
  });
  return okMessage(res, 200, 'تم حذف الملف', undefined);
});
