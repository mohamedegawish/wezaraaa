import { getDb, nowIso, parseJson } from '../db/sqlite.js';
import { ADMIN_ROLES } from '../middleware/requireRole.js';
import type { User } from './users.js';

// ============================================================================
// محرك صلاحيات المسار (Workflow governance)
// - المرحلة الأولى في كل مسار = «المراجعة الأولية — الوزارة» ويقرر فيها المسؤولون فقط.
// - كل مرحلة بعدها تقرر فيها الجهة المسندة إليها فقط؛ الإدارة تتابع (قراءة فقط).
// - التصعيد تنبيه للإدارة ولا ينقل الطلب.
// مصدر الحقيقة الوحيد — الـ routes والفرونت (عبر viewerCanDecide/allowedActions) يعتمدون عليه.
// ============================================================================

export const MINISTRY_ORG_ID = 'org-ministry';
export const INTAKE_STAGE_ID = 'stage-intake';
export const DECISION_ACTIONS = ['approve', 'request_rework', 'reject', 'escalate'] as const;
export type DecisionAction = typeof DECISION_ACTIONS[number];

/** Roles that may decide a stage owned by their organization (auditor / factory_owner never decide). */
const REVIEWER_ROLES = ['ida_reviewer', 'imc_reviewer', 'bank_reviewer', 'solar_provider'] as const;
const CLOSED_STATUSES = ['completed', 'rejected', 'cancelled'];

export interface WorkflowStage {
  id: string;
  order: number;
  code: string;
  nameAr: string;
  nameEn: string;
  assignedOrgId: string;
  assignedOrgNameAr?: string;
  assignedRole?: string;
  slaDays: number;
  canReject?: boolean;
  canRequestRework?: boolean;
  [k: string]: unknown;
}

export function intakeStage(): WorkflowStage {
  return {
    id: INTAKE_STAGE_ID,
    order: 1,
    code: 'MINISTRY_INTAKE',
    nameAr: 'المراجعة الأولية — الوزارة',
    nameEn: 'Ministry Initial Review',
    descriptionAr: 'مراجعة أولية للطلب من إدارة المنصة قبل إحالته للجهات المختصة.',
    descriptionEn: 'Initial screening by the platform officials before routing to the competent entities.',
    assignedOrgId: MINISTRY_ORG_ID,
    assignedOrgNameAr: 'وزارة الصناعة',
    assignedRole: 'ministry_admin',
    slaDays: 3,
    requiredDocuments: [],
    canReject: true,
    canRequestRework: true,
    colorCode: '#C8102E',
  };
}

const NUM_PREFIX = /^\s*\d+\s*[.\-–]\s*/;

/**
 * Guarantees the ministry intake stage is first, renumbers `order` from 1 (and «N. » name prefixes),
 * and reports any other stage assigned to the ministry (admins decide the FIRST stage only).
 */
export function normalizeWorkflowStages(input: unknown[]): { stages: WorkflowStage[]; errors: { index: number; issue: string }[] } {
  const raw = (Array.isArray(input) ? input : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({ ...s } as WorkflowStage))
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  const existingIntake = raw.find((s) => s.id === INTAKE_STAGE_ID);
  const rest = raw.filter((s) => s.id !== INTAKE_STAGE_ID);
  const numbered = rest.length > 0 && rest.filter((s) => NUM_PREFIX.test(String(s.nameAr ?? ''))).length >= Math.ceil(rest.length / 2);

  // The intake stage is fixed: only its SLA may be tuned by the admin.
  const intake = { ...intakeStage(), slaDays: Number(existingIntake?.slaDays) > 0 ? Number(existingIntake?.slaDays) : 3 };
  const errors: { index: number; issue: string }[] = [];
  const stages: WorkflowStage[] = [intake, ...rest].map((s, i) => {
    const order = i + 1;
    const strip = (v: unknown) => String(v ?? '').replace(NUM_PREFIX, '');
    const nameAr = numbered || (s !== intake && NUM_PREFIX.test(String(s.nameAr ?? ''))) ? `${order}. ${strip(s.nameAr)}` : strip(s.nameAr);
    const nameEn = s.nameEn ? (NUM_PREFIX.test(String(s.nameEn)) || numbered ? `${order}. ${strip(s.nameEn)}` : String(s.nameEn)) : String(s.nameEn ?? '');
    if (i > 0 && String(s.assignedOrgId) === MINISTRY_ORG_ID) {
      errors.push({ index: i, issue: 'ministry may only own the first (intake) stage' });
    }
    return { ...s, order, nameAr, nameEn };
  });
  return { stages, errors };
}

/** Stages of an initiative sorted by order (empty when the workflow is missing/corrupt). */
export function getStages(initiativeId: string, cache?: Map<string, WorkflowStage[]>): WorkflowStage[] {
  if (cache?.has(initiativeId)) return cache.get(initiativeId) as WorkflowStage[];
  const row = getDb().prepare('SELECT workflow FROM initiatives WHERE id = ?').get(initiativeId) as { workflow?: string } | undefined;
  const wf = parseJson<{ stages?: WorkflowStage[] }>(row?.workflow, {});
  const stages = Array.isArray(wf.stages) ? [...wf.stages].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)) : [];
  cache?.set(initiativeId, stages);
  return stages;
}

// ----------------------------------------------------------------------------
// Decision policy
// ----------------------------------------------------------------------------

export interface PolicyApp {
  status: string;
  currentStageId: string;
  currentAssignedOrgId: string;
}

export interface DecisionPolicy {
  canDecide: boolean;
  allowedActions: DecisionAction[];
  reason: 'OK' | 'CLOSED' | 'NOT_ASSIGNED' | 'ROLE' | 'MONITOR_ONLY';
  stage: WorkflowStage | null;
}

export function decisionPolicy(user: User | undefined | null, app: PolicyApp, stages: WorkflowStage[]): DecisionPolicy {
  const stage = stages.find((s) => String(s.id) === String(app.currentStageId)) ?? null;
  const deny = (reason: DecisionPolicy['reason']): DecisionPolicy => ({ canDecide: false, allowedActions: [], reason, stage });
  if (!user) return deny('ROLE');
  if (CLOSED_STATUSES.includes(app.status)) return deny('CLOSED');
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(user.role);
  const isReviewer = (REVIEWER_ROLES as readonly string[]).includes(user.role);
  if (!isAdmin && !isReviewer) return deny('ROLE');
  // Source of truth = the stage owner from the workflow (survives legacy reassignment).
  const ownerOrgId = stage?.assignedOrgId ? String(stage.assignedOrgId) : app.currentAssignedOrgId;
  if (user.organizationId !== ownerOrgId) return deny(isAdmin ? 'MONITOR_ONLY' : 'NOT_ASSIGNED');
  const actions: DecisionAction[] = ['approve'];
  if (stage?.canRequestRework !== false) actions.push('request_rework');
  if (stage?.canReject !== false) actions.push('reject');
  if (ownerOrgId !== MINISTRY_ORG_ID) actions.push('escalate');
  return { canDecide: true, allowedActions: actions, reason: 'OK', stage };
}

// ----------------------------------------------------------------------------
// Process tracking (متابعة المسار) — derived from timeline fromStage/toStage
// ----------------------------------------------------------------------------

export type StageTrackStatus = 'approved' | 'current' | 'rework' | 'rejected' | 'pending' | 'skipped';

export interface StageTrackEvent {
  at: string;
  action: string;
  byName: string;
  byRole: string;
  byOrgNameAr: string;
  byOrgNameEn: string;
  comments: string;
}

export interface StageTrackItem {
  stageId: string;
  order: number;
  code: string;
  nameAr: string;
  nameEn: string;
  orgId: string;
  orgNameAr: string;
  status: StageTrackStatus;
  enteredAt: string | null;
  decidedAt: string | null;
  decision: string | null;
  decidedBy: StageTrackEvent | null;
  events: StageTrackEvent[];
  daysSpent: number | null;
  slaDays: number;
  slaBreached: boolean;
  escalation: StageTrackEvent | null;
}

export interface ProcessSummary {
  stageTrack: StageTrackItem[];
  currentStageOrder: number;
  totalStages: number;
  stageStartedAt: string;
  daysSpentInStage: number;
  slaDueDate: string;
  isSlaViolated: boolean;
  isEscalated: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function days(fromIso: string, toMs: number): number {
  return Math.max(0, Math.round(((toMs - new Date(fromIso).getTime()) / DAY_MS) * 10) / 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEvent(e: any): StageTrackEvent {
  return {
    at: String(e.at ?? e.timestamp ?? ''),
    action: String(e.action ?? ''),
    byName: String(e.byName ?? e.performerName ?? e.by ?? ''),
    byRole: String(e.byRole ?? ''),
    byOrgNameAr: String(e.byOrgNameAr ?? e.performerOrgAr ?? ''),
    byOrgNameEn: String(e.byOrgNameEn ?? e.performerOrgEn ?? ''),
    comments: String(e.comments ?? ''),
  };
}

export function buildProcessSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: { status: string; currentStageId: string; submittedAt: string; slaDays: number; timeline: any[] },
  stages: WorkflowStage[],
  nowMs = Date.now(),
): ProcessSummary {
  const tl = Array.isArray(app.timeline) ? app.timeline : [];
  const decisions = tl.filter((e) => e && e.fromStage);
  const currentIdx = stages.findIndex((s) => String(s.id) === String(app.currentStageId));
  // Stage where the application entered the workflow (legacy apps pre-date the intake stage).
  const entryStageId = String(decisions[0]?.fromStage ?? app.currentStageId);
  const entryIdx = Math.max(0, stages.findIndex((s) => String(s.id) === entryStageId));
  const open = !CLOSED_STATUSES.includes(app.status);

  const track: StageTrackItem[] = stages.map((s, idx) => {
    const sid = String(s.id);
    const evs = decisions.filter((e) => String(e.fromStage) === sid);
    const movedIn = tl.find((e) => e && e.action === 'approve' && String(e.toStage) === sid && String(e.fromStage) !== sid);
    const enteredAt: string | null = movedIn ? String(movedIn.at) : (idx === entryIdx ? app.submittedAt : null);
    const closing = [...evs].reverse().find((e) => e.action === 'approve' || e.action === 'reject');
    const escalate = [...evs].reverse().find((e) => e.action === 'escalate');

    let status: StageTrackStatus;
    if (currentIdx === -1) status = closing ? (closing.action === 'reject' ? 'rejected' : 'approved') : 'pending';
    else if (idx < currentIdx) status = idx < entryIdx && !closing ? 'skipped' : 'approved';
    else if (idx === currentIdx) {
      if (app.status === 'rejected') status = 'rejected';
      else if (app.status === 'completed') status = 'approved';
      else if (app.status === 'pending_documents') status = 'rework';
      else status = 'current';
    } else status = 'pending';

    const decidedAt = closing ? String(closing.at) : null;
    const endMs = decidedAt ? new Date(decidedAt).getTime() : (status === 'current' || status === 'rework' ? nowMs : NaN);
    const daysSpent = enteredAt && Number.isFinite(endMs) ? days(enteredAt, endMs) : null;
    const slaDays = Number(s.slaDays ?? 0) || 0;
    return {
      stageId: sid,
      order: Number(s.order ?? idx + 1),
      code: String(s.code ?? ''),
      nameAr: String(s.nameAr ?? ''),
      nameEn: String(s.nameEn ?? ''),
      orgId: String(s.assignedOrgId ?? ''),
      orgNameAr: String(s.assignedOrgNameAr ?? ''),
      status,
      enteredAt,
      decidedAt,
      decision: closing ? String(closing.action) : null,
      decidedBy: closing ? toEvent(closing) : null,
      events: evs.map(toEvent),
      daysSpent,
      slaDays,
      slaBreached: daysSpent !== null && slaDays > 0 && daysSpent > slaDays,
      escalation: escalate ? toEvent(escalate) : null,
    };
  });

  const cur = currentIdx >= 0 ? track[currentIdx] : null;
  const stageStartedAt = cur?.enteredAt ?? app.submittedAt;
  const slaDays = cur?.slaDays || Number(app.slaDays) || 0;
  const daysSpentInStage = open ? days(stageStartedAt, nowMs) : (cur?.daysSpent ?? 0);
  // Escalated = an escalate event on the current stage after the stage was entered, while still open.
  const isEscalated = open && !!cur?.escalation && (!cur.enteredAt || cur.escalation.at >= cur.enteredAt);
  return {
    stageTrack: track,
    currentStageOrder: currentIdx + 1,
    totalStages: stages.length,
    stageStartedAt,
    daysSpentInStage,
    slaDueDate: new Date(new Date(stageStartedAt).getTime() + slaDays * DAY_MS).toISOString(),
    isSlaViolated: open && slaDays > 0 && daysSpentInStage > slaDays,
    isEscalated,
  };
}

// ----------------------------------------------------------------------------
// Boot-time alignment (idempotent) — existing DBs get the intake stage + consistent assignments
// ----------------------------------------------------------------------------

export function alignWorkflowsAndAssignments(): { workflows: number; applications: number } {
  const db = getDb();
  let workflows = 0;
  let applications = 0;
  const inits = db.prepare('SELECT id, workflow FROM initiatives').all() as Array<{ id: string; workflow: string }>;
  const stagesByInit = new Map<string, WorkflowStage[]>();
  for (const i of inits) {
    const wf = parseJson<{ version?: number; stages?: unknown[] }>(i.workflow, {});
    const { stages } = normalizeWorkflowStages(wf.stages ?? []);
    stagesByInit.set(i.id, stages);
    const before = JSON.stringify(wf.stages ?? []);
    if (before !== JSON.stringify(stages)) {
      db.prepare('UPDATE initiatives SET workflow = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify({ ...wf, version: Number(wf.version ?? 1) + 1, stages }), nowIso(), i.id);
      workflows++;
    }
  }
  const orgName = db.prepare('SELECT nameAr FROM organizations WHERE id = ?');
  const apps = db.prepare('SELECT id, initiativeId, currentStageId, currentStageNameAr, currentAssignedOrgId, status FROM applications').all() as Array<Record<string, string>>;
  const upd = db.prepare('UPDATE applications SET currentAssignedOrgId = ?, currentAssignedOrgNameAr = ?, currentStageNameAr = ? WHERE id = ?');
  for (const a of apps) {
    const stage = (stagesByInit.get(a.initiativeId) ?? []).find((s) => String(s.id) === String(a.currentStageId));
    if (!stage) continue;
    const owner = String(stage.assignedOrgId ?? '');
    if (owner && (owner !== a.currentAssignedOrgId || stage.nameAr !== a.currentStageNameAr)) {
      const name = (orgName.get(owner) as { nameAr?: string } | undefined)?.nameAr ?? String(stage.assignedOrgNameAr ?? '');
      upd.run(owner, name, String(stage.nameAr ?? a.currentStageNameAr), a.id);
      applications++;
    }
  }
  return { workflows, applications };
}
