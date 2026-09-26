import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Prune orphan details_files: disk vs DB consistency.
// Usage: node scripts/prune-files.mjs [--delete]  (dry-run by default, --delete actually removes)
const shouldDelete = process.argv.includes('--delete');
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'app.db');
const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'data', 'uploads');

if (!fs.existsSync(dbPath)) {
  console.error(`[prune] DB not found at ${dbPath}`);
  process.exit(1);
}
const db = new DatabaseSync(dbPath, { readOnly: shouldDelete ? false : true });
const rows = db.prepare('SELECT id, storedPath FROM details_files').all();
const dbPaths = new Set(rows.map(r => r.storedPath).filter(Boolean));
const diskFiles = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).map(f => path.join(uploadDir, f)) : [];

let orphanOnDisk = 0;
let orphanInDb = 0;

for (const diskPath of diskFiles) {
  if (!dbPaths.has(diskPath)) {
    orphanOnDisk++;
    console.log(`[prune] orphan on disk: ${path.basename(diskPath)}`);
    if (shouldDelete) {
      try { fs.unlinkSync(diskPath); console.log(`  -> deleted`); } catch (e) { console.error(`  -> failed: ${e.message}`); }
    }
  }
}
for (const row of rows) {
  if (row.storedPath && !fs.existsSync(row.storedPath)) {
    orphanInDb++;
    console.log(`[prune] orphan in DB: ${row.id} -> ${row.storedPath}`);
    if (shouldDelete) {
      try { db.prepare('DELETE FROM details_files WHERE id = ?').run(row.id); console.log(`  -> DB entry removed`); } catch (e) { console.error(`  -> failed: ${e.message}`); }
    }
  }
}
if (!shouldDelete) console.log(`[prune] dry-run: ${orphanOnDisk} orphan on disk, ${orphanInDb} orphan in DB (use --delete to clean)`);
else console.log(`[prune] done: cleaned ${orphanOnDisk} disk + ${orphanInDb} DB`);
db.close();
