import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Restore: node scripts/restore.mjs <backupDir> — verifies manifest + copies back. Refuses in prod without CONFIRM=YES.
if ((process.env.NODE_ENV ?? '') === 'production' && process.env.CONFIRM !== 'YES') {
  console.error('[restore] REFUSED in production without CONFIRM=YES');
  process.exit(1);
}
const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, 'manifest.json'))) {
  console.error('[restore] usage: node scripts/restore.mjs <backupDir>');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'app.db');
const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads');
const base = path.basename(dbPath);
// Validate backup DB integrity before overwriting live DB
const backupDbPath = manifest.outDb ? path.join(src, manifest.outDb) : path.join(src, base);
if (fs.existsSync(backupDbPath)) {
  try {
    const chk = new DatabaseSync(backupDbPath, { readOnly: true });
    chk.exec('PRAGMA integrity_check');
    const row = chk.prepare('SELECT COUNT(*) c FROM sqlite_master').get();
    if (!row || row.c < 5) throw new Error('backup integrity: too few tables');
    chk.close();
  } catch (e) {
    console.error(`[restore] FAIL: backup integrity check failed — ${e.message}`);
    process.exit(1);
  }
  // Remove stale WAL/SHM from live before copy (vacuum backup is single file)
  for (const sfx of ['-wal', '-shm']) { try { fs.unlinkSync(dbPath + sfx); } catch {} }
  fs.copyFileSync(backupDbPath, dbPath);
  // Also copy legacy split files if present (fallback backups)
  for (const suffix of ['-wal', '-shm']) {
    const from = path.join(src, base + suffix);
    if (fs.existsSync(from) && from !== backupDbPath) fs.copyFileSync(from, dbPath + suffix);
  }
} else {
  for (const suffix of ['', '-wal', '-shm']) {
    const from = path.join(src, base + suffix);
    if (fs.existsSync(from)) fs.copyFileSync(from, dbPath + suffix);
  }
}
const upIn = path.join(src, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
if (fs.existsSync(upIn)) {
  for (const f of fs.readdirSync(upIn)) {
    const srcFile = path.join(upIn, f);
    try { if (fs.statSync(srcFile).isFile()) fs.copyFileSync(srcFile, path.join(uploadDir, f)); } catch {}
  }
}
console.log(`[restore] done from ${src} (verified)`);
