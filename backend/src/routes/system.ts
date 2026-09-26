import { Router } from 'express';
import { countApplicationsByStatus, totalApplications } from '../store/applications.js';
import { getDb } from '../db/sqlite.js';
import { addAuditLog, listAuditLogs } from '../store/audit.js';
import { apiError, okMessage } from '../middleware/error.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { AUDIT_ROLES, requireRole } from '../middleware/requireRole.js';

export const dashboardRouter = Router();

// PROD FIX: slaCompliance حقيقي بدل 87 الثابتة — نسبة الطلبات غير المتجاوزة لـ SLA.
dashboardRouter.get('/dashboard/summary', requireRole(...AUDIT_ROLES), (_req, res) => {
  const totalApps = totalApplications();
  const approvedApps = countApplicationsByStatus(['completed', 'approved']);
  const inReviewApps = countApplicationsByStatus(['under_review', 'submitted', 'in_progress']);
  const reworkApps = countApplicationsByStatus(['pending_documents']);
  let slaCompliance = 100;
  try {
    const db = getDb();
    const rows = db.prepare("SELECT status, submittedAt, slaDays FROM applications WHERE status IN ('submitted','under_review','in_progress')").all() as Array<{ submittedAt: string; slaDays: number }>;
    if (rows.length > 0) {
      const now = Date.now();
      let violated = 0;
      for (const r of rows) {
        const due = new Date(r.submittedAt).getTime() + Number(r.slaDays || 3) * 86400000;
        if (Number.isFinite(due) && now > due) violated++;
      }
      slaCompliance = Math.round((100 * (rows.length - violated)) / rows.length);
    }
  } catch {
    slaCompliance = 100;
  }
  return okMessage(res, 200, 'ok', { totalApps, approvedApps, inReviewApps, reworkApps, slaCompliance });
});

export const reportsRouter = Router();

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : `"${s}"`;
}

reportsRouter.get('/reports/applications.csv', requireRole(...AUDIT_ROLES), (req, res) => {
  // PROD FIX: CSV يحترم نفس فلاتر القائمة (initiativeId/status/orgId/q) بدل status فقط.
  const { initiativeId, status, orgId, q } = req.query as Record<string, string>;
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (initiativeId) { where.push('initiativeId = ?'); params.push(initiativeId); }
  if (status && status !== 'ALL') { where.push('status = ?'); params.push(status); }
  if (orgId) { where.push('currentAssignedOrgId = ?'); params.push(orgId); }
  if (q) {
    where.push("(applicationNumber LIKE ? ESCAPE '\\' OR factoryNameAr LIKE ? ESCAPE '\\')");
    const p = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(p, p);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM applications ${clause} ORDER BY rowid DESC LIMIT 5000`).all(...params) as Array<Record<string, unknown>>;
  const header = 'applicationNumber,initiativeTitleAr,factoryNameAr,status,detailsPdfCount,submittedAt';
  const lines = rows.map((r) =>
    [
      String(r.applicationNumber ?? ''),
      csvCell(r.initiativeTitleAr),
      csvCell(r.factoryNameAr),
      String(r.status ?? ''),
      (() => { try { return (JSON.parse(String(r.detailsFileIds ?? '[]')) as unknown[]).length; } catch { return 0; } })(),
      String(r.submittedAt ?? ''),
    ].join(','),
  );
  res.header('Content-Type', 'text/csv; charset=utf-8').send(['\uFEFF' + header, ...lines].join('\n'));
});

reportsRouter.get('/reports/initiatives.csv', requireRole(...AUDIT_ROLES), (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT id, titleAr, titleEn, status, budgetTotalEGP FROM initiatives ORDER BY rowid DESC LIMIT 5000').all() as Array<Record<string, unknown>>;
  const header = 'id,titleAr,titleEn,status,budgetTotalEGP';
  const lines = rows.map((r) => [String(r.id ?? ''), csvCell(r.titleAr), csvCell(r.titleEn), String(r.status ?? ''), String(r.budgetTotalEGP ?? 0)].join(','));
  res.header('Content-Type', 'text/csv; charset=utf-8').send(['\uFEFF' + header, ...lines].join('\n'));
});

export const auditRouter = Router();

// PROD FIX: سجل التدقيق للأدمن/المدقق فقط (كان مفتوحاً لأي مسجل).
// تسجيل التصدير من الواجهة (Excel يُولَّد في المتصفح فلا يمر بالباك) — حتى يظهر فعلاً في سجل التدقيق.
auditRouter.post('/audit-logs/export', requireRole(...AUDIT_ROLES), (req: AuthedRequest, res) => {
  const { summaryAr } = (req.body ?? {}) as { summaryAr?: unknown };
  const text = typeof summaryAr === 'string' ? summaryAr.trim().slice(0, 300) : '';
  if (!text) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'وصف التصدير مطلوب.', 'summaryAr is required.', [{ field: 'summaryAr', issue: 'required' }]);
  }
  addAuditLog({
    userId: req.userId, userName: req.user?.name ?? req.userId ?? 'unknown', ip: req.clientIp ?? '',
    actionType: 'export', entityType: 'report', entityId: '', summaryAr: text,
  });
  return okMessage(res, 201, 'تم تسجيل التصدير', { ok: true });
});

auditRouter.get('/audit-logs', requireRole(...AUDIT_ROLES), (req, res) => {
  const { page = '1', pageSize = '20' } = req.query as Record<string, string>;
  res.json(listAuditLogs({ page, pageSize }));
});
