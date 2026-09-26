import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isolateTestEnv, startServer, jfetch, H, ROOT } from './helpers.js';

const env = isolateTestEnv('audit-backup');
let base = '';
let close = async () => {};
before(async () => {
  const s = await startServer();
  base = s.base;
  close = s.close;
});
after(async () => { await close(); await env.cleanup(); });

const ADMIN = 'user-admin';

describe('audit append-only + backup scripts', () => {
  it('audit row has userId/ip/before/after columns', async () => {
    // trigger an audited action
    await jfetch(`${base}/initiatives`, {
      method: 'POST', headers: H(ADMIN),
      body: { titleAr: 'تدقيق اختبار AppendOnly', titleEn: 'Audit AppendOnly Test' },
    });
    const r = await jfetch(`${base}/audit-logs?page=1&pageSize=5`, { headers: H(ADMIN) });
    assert.equal(r.status, 200);
    const rows = (r.json as { data: Record<string, unknown>[] }).data;
    assert.ok(rows.length > 0);
    const row = rows[0];
    assert.ok('userId' in row, 'missing userId col');
    assert.ok('ip' in row, 'missing ip col');
    assert.ok('beforeJson' in row, 'missing beforeJson col');
  });

  it('audit DELETE is blocked at DB level', async () => {
    const { getDb } = await import('../src/db/sqlite.js');
    const db = getDb();
    const row = db.prepare('SELECT id FROM audit_logs LIMIT 1').get() as { id: string } | undefined;
    assert.ok(row?.id, 'need at least one audit row');
    assert.throws(() => db.prepare('DELETE FROM audit_logs WHERE id = ?').run(row!.id), /append-only/);
  });

  it('audit UPDATE is blocked at DB level', async () => {
    const { getDb } = await import('../src/db/sqlite.js');
    const db = getDb();
    const row = db.prepare('SELECT id FROM audit_logs LIMIT 1').get() as { id: string } | undefined;
    assert.throws(() => db.prepare('UPDATE audit_logs SET summaryAr = ? WHERE id = ?').run('x', row!.id), /append-only/);
  });

  it('backup script produces manifest + db copy', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);
    const outDir = `${env.dir}/bkp`;
    const { stdout } = await run(process.execPath, ['scripts/backup.mjs', outDir], {
      cwd: `${ROOT}/backend`,
      env: { ...process.env, DB_PATH: env.dbPath, UPLOAD_DIR: env.uploadDir },
    });
    assert.match(stdout, /\[backup\] done/);
    const fs = await import('node:fs');
    assert.ok(fs.existsSync(`${outDir}/manifest.json`));
  });
});
