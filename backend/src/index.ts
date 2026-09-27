import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb, getDb } from './db/sqlite.js';
import { applySeedUpdates, seedIfEmpty } from './db/seed.js';
import { startChatReminderJob, stopChatReminderJob } from './jobs/chatReminders.js';
import { startMailQueue, stopMailQueue } from './jobs/mailQueue.js';

let seedUpdates: string[];
if (config.seedOnBoot) {
  const { seeded, updates } = seedIfEmpty();
  seedUpdates = updates;
  console.log(`[server] seed-on-boot=${seeded ? 'seeded' : 'skipped (already seeded)'}`);
} else {
  // Versioned seed updates still reach a DB this seed created; an empty DB stays empty.
  seedUpdates = applySeedUpdates();
  console.log('[server] seed-on-boot disabled (SEED_ON_BOOT=0) — no fresh seed on an empty DB');
  const users = (getDb().prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  if (users === 0) {
    console.warn('[server] WARNING: database is EMPTY and SEED_ON_BOOT=0 — there are no accounts, nobody can log in. Remove SEED_ON_BOOT (default 1) or set it to 1, then restart.');
  }
}
console.log(`[server] seed updates: ${seedUpdates.length ? `applied ${seedUpdates.join(', ')}` : 'up to date'}`);

const server = createApp().listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port} — prefix /api/v1 (env=${config.env})`);
  startChatReminderJob();
  startMailQueue();
});

function shutdown(signal: string) {
  console.log(`[server] ${signal} — closing`);
  stopChatReminderJob();
  stopMailQueue();
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
