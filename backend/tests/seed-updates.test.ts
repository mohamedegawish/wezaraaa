import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv } from './helpers.js';
import { applySeedUpdates, seedIfEmpty } from '../src/db/seed.js';
import { getDb } from '../src/db/sqlite.js';
import { verifyPassword } from '../src/auth/jwt.js';

// Versioned seed updates: a live DB created by an older seed picks up new accounts + Shams
// content on the next boot (even with SEED_ON_BOOT=0), once, without overwriting edits.
const env = isolateTestEnv('seed-updates');
after(() => env.cleanup());

const NEW_USERS = ['user-bank2', 'user-ghazl', 'user-chem', 'user-ceramic'];
const count = (t: string) => (getDb().prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
const shams = () => getDb().prepare(
  "SELECT objectives, eligibilityRequirements, selectionCriteria, financialTerms, executionNotesAr, kpis FROM initiatives WHERE id = 'init-solar-2026'",
).get() as Record<string, string>;

describe('seed updates (applySeedUpdates)', () => {
  it('leaves an empty (never seeded) DB untouched', () => {
    assert.deepEqual(applySeedUpdates(), []);
    assert.equal(count('users'), 0);
  });

  it('fresh seed: all 14 accounts + full Shams content', () => {
    const r = seedIfEmpty();
    assert.equal(r.seeded, true);
    assert.deepEqual(r.updates.sort(), ['seed_shams_content_v1', 'seed_users_v2']);
    assert.equal(count('users'), 14);
    const s = shams();
    assert.equal(JSON.parse(s.objectives).length, 7);
    assert.equal(JSON.parse(s.eligibilityRequirements).length, 13);
    assert.equal(JSON.parse(s.selectionCriteria).length, 10);
    assert.equal(JSON.parse(s.kpis).length, 16);
    assert.equal(JSON.parse(s.financialTerms).maxFinancingPerGroupEGP, 200_000_000);
    assert.ok(s.executionNotesAr.includes('الربط والتشغيل'));
    assert.deepEqual(seedIfEmpty().updates, [], 'second boot applies nothing');
  });

  it('upgrades a DB from the older seed without overwriting admin edits', () => {
    const db = getDb();
    // Rewind to what the previous seed left behind (10 accounts, empty Shams fields) …
    db.exec("DELETE FROM meta WHERE key IN ('seed_users_v2', 'seed_shams_content_v1')");
    db.exec(`DELETE FROM users WHERE id IN (${NEW_USERS.map((u) => `'${u}'`).join(', ')})`);
    db.exec("UPDATE initiatives SET objectives = '[]', eligibilityRequirements = '[]', financialTerms = '{}', executionNotesAr = '', kpis = '[]' WHERE id = 'init-solar-2026'");
    // … plus edits made on the live site since then.
    const custom = JSON.stringify([{ textAr: 'معيار كتبه الأدمن', textEn: 'Admin criterion' }]);
    db.prepare("UPDATE initiatives SET selectionCriteria = ? WHERE id = 'init-solar-2026'").run(custom);
    db.exec("UPDATE users SET passwordHash = 'changed-by-owner', mustChangePassword = 0 WHERE id = 'user-admin'");

    assert.deepEqual(applySeedUpdates().sort(), ['seed_shams_content_v1', 'seed_users_v2']);

    assert.equal(count('users'), 14);
    for (const id of NEW_USERS) {
      const u = db.prepare('SELECT passwordHash, mustChangePassword, factoryId FROM users WHERE id = ?').get(id) as { passwordHash: string; mustChangePassword: number; factoryId: string };
      assert.equal(u.mustChangePassword, 1, `${id} must change the seed password`);
      assert.ok(verifyPassword('Egypt@2026', u.passwordHash));
      if (id !== 'user-bank2') assert.equal(u.factoryId, id.replace('user-', 'factory-'), `${id} linked to its factory`);
    }
    const admin = db.prepare("SELECT passwordHash, mustChangePassword FROM users WHERE id = 'user-admin'").get() as { passwordHash: string; mustChangePassword: number };
    assert.equal(admin.passwordHash, 'changed-by-owner', 'existing password untouched');
    const s = shams();
    assert.equal(s.selectionCriteria, custom, 'admin-edited field untouched');
    assert.equal(JSON.parse(s.objectives).length, 7, 'empty field filled');
    assert.equal(JSON.parse(s.kpis).length, 16);

    // Once applied, a deleted account is not resurrected and a cleared field is not refilled.
    db.exec("DELETE FROM users WHERE id = 'user-bank2'");
    db.exec("UPDATE initiatives SET objectives = '[]' WHERE id = 'init-solar-2026'");
    assert.deepEqual(applySeedUpdates(), []);
    assert.equal(count('users'), 13);
    assert.equal(shams().objectives, '[]');
  });
});
