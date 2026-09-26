import fs from 'node:fs';
import { getDb, nowIso } from './sqlite.js';
import type { SqlParam } from '../store/helpers.js';
import { hashPassword } from '../auth/jwt.js';
import { seedIfEmpty, SEED_DEFAULT_PASSWORD } from './seed.js';
import { createApplication, applyDecision, getApplicationById } from '../store/applications.js';
import { alignWorkflowsAndAssignments, INTAKE_STAGE_ID, MINISTRY_ORG_ID } from '../store/workflow.js';

// ---------------------------------------------------------------------------
// seed-data.json loader — imports a portable demo dataset file (repo root
// seed-data.json) into any environment: local dev, staging, or first prod boot.
// - Base rows (orgs/users/factories/initiatives): INSERT OR IGNORE (idempotent).
// - Demo applications (+ decision timelines via the REAL decision engine):
//   guarded by meta seed_demo_v1 (skipped on re-run unless forceApps).
// - Passwords are NEVER read from the file: every inserted user gets the
//   standard default hash (SEED_DEFAULT_PASSWORD); change after first login.
// ---------------------------------------------------------------------------

export interface SeedFileDecision { action: string; comments?: string; by: string }
export interface SeedFileApplication {
  ref: string; initiativeId: string; factoryId: string;
  formData?: Record<string, unknown>; decisions?: SeedFileDecision[];
}
export interface SeedFileData {
  organizations: Array<{ id: string; code: string; nameAr: string; nameEn: string; type: string; active: number; contactEmail: string }>;
  users: Array<{ id: string; name: string; nameEn: string; email: string; role: string; organizationId: string; factoryId?: string; mustChangePassword?: number }>;
  factories: Array<{ id: string; data: Record<string, unknown> }>;
  initiatives: Array<Record<string, unknown>>;
  applications?: SeedFileApplication[];
}
export interface SeedFileResult {
  orgs: number; users: number; factories: number; initiatives: number; applications: number;
  appsCreated: number; skipped: boolean;
  apps: Array<{ ref: string; id: string; status: string }>;
}

const INIT_COLS = [
  'id', 'slug', 'titleAr', 'titleEn', 'taglineAr', 'taglineEn', 'descriptionAr', 'descriptionEn',
  'category', 'categoryEn', 'status', 'targetSectors', 'targetSectorsEn', 'targetGovernorates',
  'budgetTotalEGP', 'budgetAllocatedEGP', 'startDate', 'endDate', 'coverImage',
  'badgeTextAr', 'badgeTextEn', 'participatingOrgs', 'benefits', 'faqs', 'preEligibilityQuestions',
  'requiredDocsList', 'formSections', 'impactMetrics', 'customization', 'workflow',
  'objectives', 'eligibilityRequirements', 'selectionCriteria', 'financialTerms',
  'executionNotesAr', 'executionNotesEn', 'kpis',
];
const JSON_INIT_COLS = new Set([
  'targetSectors', 'targetSectorsEn', 'targetGovernorates', 'participatingOrgs', 'benefits',
  'faqs', 'preEligibilityQuestions', 'requiredDocsList', 'formSections', 'impactMetrics',
  'customization', 'workflow', 'objectives', 'eligibilityRequirements', 'selectionCriteria',
  'financialTerms', 'kpis',
]);

export function seedFromFile(jsonPath: string, opts: { forceApps?: boolean } = {}): SeedFileResult {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SeedFileData;
  if (!Array.isArray(data.organizations) || !Array.isArray(data.users) ||
      !Array.isArray(data.factories) || !Array.isArray(data.initiatives)) {
    throw new Error('[seed-from-file] invalid file: organizations/users/factories/initiatives arrays required');
  }
  // Base platform rows first (also backfills password hashes on old DBs).
  seedIfEmpty();
  const db = getDb();
  const now = nowIso();

  db.exec('BEGIN IMMEDIATE');
  try {
    const orgStmt = db.prepare(
      'INSERT OR IGNORE INTO organizations (id, code, nameAr, nameEn, type, active, contactEmail, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const o of data.organizations) {
      orgStmt.run(o.id, o.code, o.nameAr, o.nameEn, o.type, o.active ? 1 : 0, o.contactEmail ?? '', now, now);
    }
    const defaultHash = hashPassword(SEED_DEFAULT_PASSWORD);
    const userStmt = db.prepare(
      'INSERT OR IGNORE INTO users (id, name, nameEn, email, role, organizationId, factoryId, passwordHash, mustChangePassword, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (const u of data.users) {
      userStmt.run(u.id, u.name, u.nameEn ?? '', u.email, u.role, u.organizationId, u.factoryId ?? '', defaultHash, u.mustChangePassword ? 1 : 0, now, now);
    }
    const facStmt = db.prepare(
      'INSERT OR IGNORE INTO factories (id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
    );
    for (const f of data.factories) facStmt.run(f.id, JSON.stringify(f.data), now, now);
    const placeholders = INIT_COLS.map(() => '?').join(', ');
    const initStmt = db.prepare(
      `INSERT OR IGNORE INTO initiatives (${INIT_COLS.join(', ')}, createdAt, updatedAt) VALUES (${placeholders}, ?, ?)`,
    );
    for (const i of data.initiatives) {
      const vals: SqlParam[] = INIT_COLS.map((c) => {
        const v: unknown = i[c];
        if (JSON_INIT_COLS.has(c)) return JSON.stringify(v ?? (c === 'workflow' ? { stages: [] } : c === 'financialTerms' ? {} : []));
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' || v === null) return v;
        return '';
      });
      initStmt.run(...vals, now, now);
    }
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* noop */ }
    throw e;
  }

  // Demo applications through the real store path (numbering + decision engine).
  const flag = db.prepare("SELECT value FROM meta WHERE key = 'seed_demo_v1'").get() as { value?: string } | undefined;
  const apps: SeedFileResult['apps'] = [];
  let appsCreated = 0;
  let skipped = false;
  if (flag?.value === '1' && !opts.forceApps) {
    skipped = true;
  } else {
    for (const a of data.applications ?? []) {
      const init = db.prepare('SELECT id, titleAr, workflow FROM initiatives WHERE id = ?').get(a.initiativeId) as { id: string; titleAr: string; workflow: string } | undefined;
      const fac = db.prepare('SELECT id, data FROM factories WHERE id = ?').get(a.factoryId) as { id: string; data: string } | undefined;
      if (!init || !fac) throw new Error(`[seed-from-file] unknown initiative/factory for app ref=${a.ref}`);
      let stages: Array<{ id?: string; nameAr?: string; assignedOrgId?: string; assignedOrgNameAr?: string; slaDays?: number; order?: number }> = [];
      try {
        const wf = JSON.parse(init.workflow ?? '{}') as { stages?: typeof stages };
        if (Array.isArray(wf.stages)) stages = [...wf.stages].sort((x, y) => Number(x.order ?? 0) - Number(y.order ?? 0));
      } catch { stages = []; }
      // Demo decisions in the file are scripted from the first ENTITY stage (they pre-date the ministry intake).
      const s0 = stages.find((s) => s.id !== INTAKE_STAGE_ID) ?? stages[0] ?? {};
      const fdata = JSON.parse(fac.data ?? '{}') as Record<string, unknown>;
      const owner = db.prepare('SELECT id FROM users WHERE factoryId = ? LIMIT 1').get(fac.id) as { id: string } | undefined;
      const created = createApplication({
        initiativeId: init.id, initiativeTitleAr: init.titleAr,
        factoryId: fac.id, factoryNameAr: String(fdata.nameAr ?? fac.id),
        factorySectorAr: String(fdata.sector ?? ''), factoryGovernorateAr: String(fdata.governorate ?? ''),
        currentStageId: String(s0.id ?? 'stage-1'), currentStageNameAr: String(s0.nameAr ?? ''),
        currentAssignedOrgId: String(s0.assignedOrgId ?? MINISTRY_ORG_ID),
        currentAssignedOrgNameAr: String(s0.assignedOrgNameAr ?? ''),
        slaDays: Number(s0.slaDays ?? 7), formData: a.formData ?? {}, detailsFileIds: [],
        by: owner?.id ?? '',
      });
      for (const d of a.decisions ?? []) applyDecision(created.id, d.action, d.comments, d.by);
      const fin = getApplicationById(created.id);
      apps.push({ ref: a.ref, id: created.id, status: fin?.status ?? 'unknown' });
      appsCreated++;
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_demo_v1', '1')").run();
  }
  // Mandatory ministry intake stage + consistent assignments (idempotent).
  alignWorkflowsAndAssignments();

  const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
  return {
    orgs: count('organizations'), users: count('users'), factories: count('factories'),
    initiatives: count('initiatives'), applications: count('applications'),
    appsCreated, skipped, apps,
  };
}
