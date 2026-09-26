import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Backup: atomic SQLite snapshot via VACUUM INTO + WAL checkpoint, plus uploads.
// Usage: node scripts/backup.mjs [outDir]   (default: $BACKUP_DIR/<stamp>, BACKUP_DIR defaults to ./backups)
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'app.db');
const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads');
const outRoot = process.argv[2] ?? path.join(process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups'), stamp);
fs.mkdirSync(outRoot, { recursive: true });

const outDb = path.join(outRoot, path.basename(dbPath));
// Ensure DB exists before vacuum
if (!fs.existsSync(dbPath)) {
  console.error(`[backup] FAIL: DB not found at ${dbPath}`);
  process.exit(1);
}
// Atomic snapshot: VACUUM INTO creates a consistent copy without copying -wal/-shm separately.
// This avoids half-written WAL corruption that raw copyFile suffers.
let usedVacuum = false;
try {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  // Ensure WAL is checkpointed into main db before vacuum
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
  // VACUUM INTO requires absolute path with single quotes escaped
  const escaped = outDb.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escaped}'`);
  db.close();
  usedVacuum = true;
} catch (e) {
  console.error(`[backup] VACUUM INTO failed, falling back to file copy: ${e.message}`);
  for (const suffix of ['', '-wal', '-shm']) {
    const src = dbPath + suffix;
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outRoot, path.basename(dbPath) + suffix));
  }
}
const upOut = path.join(outRoot, 'uploads');
fs.mkdirSync(upOut, { recursive: true });
if (fs.existsSync(uploadDir)) {
  for (const f of fs.readdirSync(uploadDir)) {
    const src = path.join(uploadDir, f);
    try { if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(upOut, f)); } catch {}
  }
}
const manifest = {
  stamp,
  dbPath,
  uploadDir,
  files: fs.existsSync(upOut) ? fs.readdirSync(upOut).length : 0,
  method: usedVacuum ? 'vacuum_into' : 'file_copy',
  outDb: path.basename(outDb),
};
fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[backup] done -> ${outRoot} (${manifest.files} uploads, ${manifest.method})`);
