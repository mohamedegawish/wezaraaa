import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/sqlite.js';
import { seedIfEmpty } from './db/seed.js';
import { startChatReminderJob, stopChatReminderJob } from './jobs/chatReminders.js';
import { startMailQueue, stopMailQueue } from './jobs/mailQueue.js';

if (config.seedOnBoot) {
  const { seeded } = seedIfEmpty();
  console.log(`[server] seed-on-boot=${seeded ? 'seeded' : 'skipped (already seeded)'}`);
} else {
  console.log('[server] seed-on-boot disabled (SEED_ON_BOOT=0) — production safe mode');
}

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
