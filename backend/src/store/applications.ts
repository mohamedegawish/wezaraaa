import { getDb, nowIso, parseJson } from '../db/sqlite.js';
import { newId, normPage, normPageSize, paginate, type SqlParam } from './helpers.js';
import { getUserById } from './users.js';
import { getOrganizationById } from './organizations.js';
import { buildProcessSummary, getStages, type ProcessSummary, type WorkflowStage } from './workflow.js';

/** Immutable performer snapshot for timeline entries (survives renames/deletes). */
function performerSnapshot(by: string): Record<string, string> {
  try {
    const u = getUserById(by);
    if (!u) return {};
    const org = u.organizationId ? getOrganizationById(u.organizationId) : null;
    return {
      byName: u.name ?? by,
      byNameEn: u.nameEn ?? by,
      byRole: u.role ?? '',
      byOrgId: u.organizationId ?? '',
      byOrgNameAr: org?.nameAr ?? '',
      byOrgNameEn: org?.nameEn ?? org?.nameAr ?? '',
    };
  } catch {
    return {};
  }
}

export interface Application {
  id: string;
  applicationNumber: string;
  initiativeId: string;
  initiativeTitleAr: string;
  factoryId: string;
  factoryNameAr: string;
  factorySectorAr: string;
  factoryGovernorateAr: string;
  currentStageId: string;
  currentStageNameAr: string;
  status: string;
  currentAssignedOrgId: string;
  currentAssignedOrgNameAr: string;
  slaDays: number;
  submittedAt: string;
  updatedAt: string;
  formData: Record<string, unknown>;
  detailsFileIds: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timeline: any[];
}

/** API shape = stored row + derived process tracking (متابعة المسار). */
export type ApplicationWithTrack = Application & ProcessSummary;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function toApplicationRow(r: Row): Application {
  return {
    id: r.id,
    applicationNumber: r.applicationNumber,
    initiativeId: r.initiativeId,
    initiativeTitleAr: r.initiativeTitleAr ?? '',
    factoryId: r.factoryId,
    factoryNameAr: r.factoryNameAr ?? '',
    factorySectorAr: r.factorySectorAr ?? '',
    factoryGovernorateAr: r.factoryGovernorateAr ?? '',
    currentStageId: r.currentStageId ?? 'stage-1',
    currentStageNameAr: r.currentStageNameAr ?? '',
    status: r.status ?? 'submitted',
    currentAssignedOrgId: r.currentAssignedOrgId ?? 'org-ida',
    currentAssignedOrgNameAr: r.currentAssignedOrgNameAr ?? '',
    slaDays: Number(r.slaDays ?? 3),
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt ?? r.submittedAt,
    formData: parseJson<Record<string, unknown>>(r.formData, {}),
    detailsFileIds: parseJson<string[]>(r.detailsFileIds, []),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    timeline: parseJson<any[]>(r.timeline, []),
  };
}

/** Row → API, enriched with the per-stage process summary. Pass a cache when mapping many rows. */
export function toApplicationApi(r: Row, stagesCache?: Map<string, WorkflowStage[]>): ApplicationWithTrack {
  const app = toApplicationRow(r);
  return { ...app, ...buildProcessSummary(app, getStages(app.initiativeId, stagesCache)) };
}

export function listApplications(opts: {
  initiativeId?: string; status?: string; orgId?: string; factoryId?: string; q?: string; page?: unknown; pageSize?: unknown;
  /** Reviewer isolation: currently assigned to this org OR the org already acted on it (read-only history). */
  visibleToOrgId?: string;
}) {
  const db = getDb();
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (opts.initiativeId) { where.push('initiativeId = ?'); params.push(opts.initiativeId); }
  if (opts.status && opts.status !== 'ALL') { where.push('status = ?'); params.push(opts.status); }
  if (opts.orgId) { where.push('currentAssignedOrgId = ?'); params.push(opts.orgId); }
  if (opts.factoryId) { where.push('factoryId = ?'); params.push(opts.factoryId); }
  if (opts.visibleToOrgId) {
    where.push("(currentAssignedOrgId = ? OR EXISTS (SELECT 1 FROM json_each(applications.timeline) j WHERE json_extract(j.value, '$.byOrgId') = ?))");
    params.push(opts.visibleToOrgId, opts.visibleToOrgId);
  }
  if (opts.q) {
    where.push("(applicationNumber LIKE ? ESCAPE '\\' OR factoryNameAr LIKE ? ESCAPE '\\')");
    const p = `%${String(opts.q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(p, p);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM applications ${clause}`).get(...params) as { c: number }).c;
  const page = normPage(opts.page);
  const pageSize = normPageSize(opts.pageSize, 10);
  const rows = db.prepare(
    `SELECT * FROM applications ${clause} ORDER BY rowid DESC LIMIT ? OFFSET ?`,
  ).all(...params, pageSize, (page - 1) * pageSize) as unknown as Row[];
  const stagesCache = new Map<string, WorkflowStage[]>();
  const data = rows.map((r) => {
    const app = toApplicationApi(r, stagesCache);
    return { ...app, detailsPdfCount: app.detailsFileIds.length };
  });
  return paginate(data, total, page, pageSize);
}

export function getApplicationById(id: string): ApplicationWithTrack | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Row | undefined;
  return row ? toApplicationApi(row) : null;
}

/** True when the org is currently assigned OR already appears in the application history. */
export function orgParticipated(app: Application, orgId: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return app.currentAssignedOrgId === orgId || app.timeline.some((e: any) => e && e.byOrgId === orgId);
}

export function countApplicationsByInitiative(initiativeId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS c FROM applications WHERE initiativeId = ?').get(initiativeId) as { c: number };
  return row.c;
}

export function countApplicationsByStatus(statuses: string[]): number {
  const db = getDb();
  if (!statuses.length) return 0;
  const marks = statuses.map(() => '?').join(',');
  const row = db.prepare(`SELECT COUNT(*) AS c FROM applications WHERE status IN (${marks})`).get(...statuses) as { c: number };
  return row.c;
}

export function totalApplications(): number {
  const db = getDb();
  return (db.prepare('SELECT COUNT(*) AS c FROM applications').get() as { c: number }).c;
}

function nextApplicationNumberTx(): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM meta WHERE key = 'app_seq'").get() as { value?: string } | undefined;
  const seq = Number(row?.value ?? 41) + 1;
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('app_seq', ?)").run(String(seq));
  return `EGY-SOL-2026-${String(seq).padStart(4, '0')}`;
}

export function createApplication(input: {
  initiativeId: string; initiativeTitleAr: string;
  factoryId: string; factoryNameAr: string; factorySectorAr: string; factoryGovernorateAr: string;
  currentStageId: string; currentStageNameAr: string;
  currentAssignedOrgId: string; currentAssignedOrgNameAr: string; slaDays: number;
  formData: Record<string, unknown>; detailsFileIds: string[]; by?: string;
}): ApplicationWithTrack {
  const db = getDb();
  const now = nowIso();
  const id = newId('app');
  db.exec('BEGIN IMMEDIATE');
  try {
    const applicationNumber = nextApplicationNumberTx();
    db.prepare(
      `INSERT INTO applications
       (id, applicationNumber, initiativeId, initiativeTitleAr, factoryId, factoryNameAr, factorySectorAr, factoryGovernorateAr,
        currentStageId, currentStageNameAr, status, currentAssignedOrgId, currentAssignedOrgNameAr, slaDays,
        submittedAt, updatedAt, formData, detailsFileIds, timeline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, applicationNumber, input.initiativeId, input.initiativeTitleAr,
      input.factoryId, input.factoryNameAr, input.factorySectorAr, input.factoryGovernorateAr,
      input.currentStageId, input.currentStageNameAr,
      input.currentAssignedOrgId, input.currentAssignedOrgNameAr, input.slaDays,
      now, now, JSON.stringify(input.formData), JSON.stringify(input.detailsFileIds),
      JSON.stringify([{ at: now, action: 'submit', by: input.by ?? '', ...(input.by ? performerSnapshot(input.by) : {}) }]),
    );
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* noop */ }
    throw e;
  }
  return getApplicationById(id) as ApplicationWithTrack;
}

export function applyDecision(
  id: string,
  action: string,
  comments: string | undefined,
  by: string,
  opts?: { documentIdToVerify?: string },
): Application | null {
  const db = getDb();
  const current = getApplicationById(id);
  if (!current) return null;
  // PROD FIX: موتور قرارات حقيقي — approve يتقدم عبر stages، escalate مسار مستقل، documentIdToVerify يُفعَّل.
  // 1) لو فيه documentIdToVerify فعّله كـ verified (كان مُتجاهَل تماماً).
  if (opts?.documentIdToVerify) {
    db.prepare("UPDATE details_files SET status = 'verified' WHERE id = ? AND factoryId = ?").run(
      opts.documentIdToVerify,
      current.factoryId,
    );
  }
  // 2) هات stages المبادرة مرتبة بـ order.
  const stages = getStages(current.initiativeId);
  const now = nowIso();
  let nextStatus = current.status;
  let nextStageId = current.currentStageId;
  let nextStageNameAr = current.currentStageNameAr;
  let nextOrgId = current.currentAssignedOrgId;
  let nextOrgNameAr = current.currentAssignedOrgNameAr;
  let nextSla = current.slaDays;
  if (action === 'approve') {
    const idx = stages.findIndex((s) => String(s.id) === String(current.currentStageId));
    if (idx === -1 || stages.length === 0) {
      // لا workflow معرف — سلوك آمن: in_progress بدون نقل.
      nextStatus = 'in_progress';
    } else if (idx === stages.length - 1) {
      // آخر مرحلة → اكتمال حقيقي (كان مستحيل الوصول لـ completed قبل الإصلاح).
      nextStatus = 'completed';
    } else {
      const nxt = stages[idx + 1];
      nextStatus = 'in_progress';
      nextStageId = String(nxt.id ?? nextStageId);
      nextStageNameAr = String(nxt.nameAr ?? nextStageNameAr);
      nextOrgId = String(nxt.assignedOrgId ?? nextOrgId);
      nextOrgNameAr = String(nxt.assignedOrgNameAr ?? nextOrgNameAr);
      nextSla = Number(nxt.slaDays ?? nextSla);
    }
  } else if (action === 'request_rework') {
    nextStatus = 'pending_documents';
  } else if (action === 'reject') {
    nextStatus = 'rejected';
  } else if (action === 'escalate') {
    // التصعيد = تنبيه للإدارة فقط: الطلب يبقى لدى الجهة صاحبة المرحلة وهي من تقرر (لا نقل ولا تغيير حالة).
  } else {
    nextStatus = 'rejected';
  }
  const timeline = [...current.timeline, { at: now, action, comments: comments ?? '', by, ...performerSnapshot(by), fromStage: current.currentStageId, toStage: nextStageId }];
  db.prepare(
    'UPDATE applications SET status = ?, currentStageId = ?, currentStageNameAr = ?, currentAssignedOrgId = ?, currentAssignedOrgNameAr = ?, slaDays = ?, updatedAt = ?, timeline = ? WHERE id = ?',
  ).run(nextStatus, nextStageId, nextStageNameAr, nextOrgId, nextOrgNameAr, nextSla, now, JSON.stringify(timeline), id);
  return getApplicationById(id);
}
