import { Router } from 'express';
import fs from 'node:fs';
import { getDb } from '../db/sqlite.js';
import { config } from '../config.js';

export const healthRouter = Router();
// PROD FIX: health حقيقي يفحص DB + قرص الرفع (readiness/liveness).
healthRouter.get('/health', (_req, res) => {
  const checks: Record<string, string> = {};
  let ok = true;
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 AS one').get() as { one: number };
    checks.db = row?.one === 1 ? 'ok' : 'fail';
    if (checks.db !== 'ok') ok = false;
  } catch {
    checks.db = 'fail';
    ok = false;
  }
  try {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    fs.accessSync(config.uploadDir, fs.constants.W_OK);
    checks.uploads = 'ok';
    // File lifecycle: count orphans (non-fatal, just report)
    try {
      const db2 = getDb();
      const dbFiles = db2.prepare('SELECT COUNT(*) c FROM details_files').get() as { c: number };
      const diskFiles = fs.existsSync(config.uploadDir) ? fs.readdirSync(config.uploadDir).length : 0;
      checks.files = `db:${dbFiles.c} disk:${diskFiles}`;
    } catch { checks.files = 'unknown'; }
  } catch {
    checks.uploads = 'fail';
    ok = false;
  }
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    version: '1.0.0',
    time: new Date().toISOString(),
    env: config.env,
    checks,
  });
});
