import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, ROOT } from './helpers.js';
import { seedFromFile } from '../src/db/seedFromFile.js';
import { verifyPassword } from '../src/auth/jwt.js';
import { getDb } from '../src/db/sqlite.js';

const FILE = `${ROOT}/seed-data.json`;

describe('seed-data.json loader (seedFromFile)', () => {
  const env = isolateTestEnv('seedfile');
  after(() => env.cleanup());
  let firstApps = 0;

  it('loads full demo dataset incl. decision timelines', () => {
    const r = seedFromFile(FILE);
    assert.equal(r.skipped, false);
    assert.equal(r.orgs, 11);
    assert.equal(r.users, 14); // 13 in seed-data.json + user-eehc from the built-in seed (seedIfEmpty runs first)
    assert.equal(r.factories, 6);
    assert.equal(r.initiatives, 4);
    assert.equal(r.applications, 4);
    assert.equal(r.appsCreated, 4);
    firstApps = r.applications;
    const byRef = Object.fromEntries(r.apps.map((a) => [a.ref, a]));
    // Full lifecycle demo: 8 approves walk all 8 solar stages -> completed
    assert.equal(byRef['demo-solar-delta'].status, 'completed');
    // Fresh submission untouched at stage 1
    assert.equal(byRef['demo-solar-ghazl'].status, 'submitted');
    // Escalated app rerouted to ministry, still in progress
    assert.equal(byRef['demo-mod-ceramic'].status, 'in_progress');
    assert.equal(byRef['demo-solar-sewedy'].status, 'in_progress');
    const db = getDb();
    const esc = db.prepare('SELECT currentAssignedOrgId FROM applications WHERE id = ?').get(byRef['demo-mod-ceramic'].id) as { currentAssignedOrgId: string };
    // التصعيد تنبيه فقط: الطلب يبقى لدى جهة المرحلة.
    assert.equal(esc.currentAssignedOrgId, 'org-imc');
    const delta = db.prepare('SELECT timeline FROM applications WHERE id = ?').get(byRef['demo-solar-delta'].id) as { timeline: string };
    const deltaTl = JSON.parse(delta.timeline) as Array<Record<string, unknown>>;
    assert.equal(deltaTl.length, 9); // submit + 8 approves
    // Performer snapshots are embedded (immutable history, no user lookup needed).
    assert.equal(deltaTl[1].by, 'user-ida');
    assert.ok(typeof deltaTl[1].byName === 'string' && (deltaTl[1].byName as string).length > 0, 'decision entry must carry byName snapshot');
    assert.ok(typeof deltaTl[1].byOrgNameAr === 'string' && (deltaTl[1].byOrgNameAr as string).length > 0, 'decision entry must carry byOrgNameAr snapshot');
    const sewedy = db.prepare('SELECT timeline, currentStageId FROM applications WHERE id = ?').get(byRef['demo-solar-sewedy'].id) as { timeline: string; currentStageId: string };
    assert.equal((JSON.parse(sewedy.timeline) as unknown[]).length, 3); // submit + 2 approves
    assert.equal(sewedy.currentStageId, 'stage-sh3'); // advanced to prefeasibility stage
    // New factory users get default password hash + mustChangePassword flag
    const u = db.prepare("SELECT passwordHash, mustChangePassword FROM users WHERE id = 'user-ghazl'").get() as { passwordHash: string; mustChangePassword: number };
    assert.equal(u.mustChangePassword, 1);
    assert.ok(verifyPassword('Egypt@2026', u.passwordHash));
  });

  it('second run is idempotent (apps skipped, counts unchanged)', () => {
    const r = seedFromFile(FILE);
    assert.equal(r.skipped, true);
    assert.equal(r.appsCreated, 0);
    assert.equal(r.applications, firstApps);
    assert.equal(r.orgs, 11);
    assert.equal(r.users, 14); // 13 in seed-data.json + user-eehc from the built-in seed (seedIfEmpty runs first)
  });

  it('rejects malformed seed files', () => {
    assert.throws(() => seedFromFile(`${ROOT}/backend/package.json`), /invalid file/);
  });
});
