import 'dotenv/config';
import path from 'node:path';

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const rootDir = process.cwd();

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  port: num('PORT', 4000),
  // LAZY getters (not frozen consts): test files set DB_PATH/UPLOAD_DIR via
  // isolateTestEnv() AFTER imports are hoisted, so paths must resolve at call
  // time. Frozen values silently routed every test at the real dev database.
  get dbPath(): string { return process.env.DB_PATH ?? path.join(rootDir, 'data', 'app.db'); },
  get uploadDir(): string { return process.env.UPLOAD_DIR ?? path.join(rootDir, 'data', 'uploads'); },
  // PROD FIX: default to localhost only — never '*' in production. Explicit CORS_ORIGIN required in prod.
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000').split(',').map((s) => s.trim()).filter(Boolean),
  jsonLimit: process.env.JSON_LIMIT ?? '2mb',
  rateWindowMs: num('RATE_WINDOW_MS', 60_000),
  rateMax: num('RATE_MAX', 300),
  trustProxy: process.env.TRUST_PROXY === '1',
  // PROD FIX: auto-seed only when explicitly enabled. In prod default OFF to prevent wiping/overwriting.
  seedOnBoot: (process.env.SEED_ON_BOOT ?? (process.env.NODE_ENV === 'production' ? '0' : '1')) === '1',
  // Demo auth (x-user-id + switch-user) allowed only when NOT in prod, or when explicitly enabled.
  allowDemoAuth: (process.env.ALLOW_DEMO_AUTH ?? (process.env.NODE_ENV === 'production' ? '0' : '1')) === '1',
  // PROD FIX JWT: secrets + TTLs. In prod JWT_SECRET required and must not be default.
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
  jwtAccessTtlSec: num('JWT_ACCESS_TTL_SEC', 900),
  jwtRefreshTtlSec: num('JWT_REFRESH_TTL_SEC', 7 * 24 * 3600),
  bcryptRounds: num('BCRYPT_ROUNDS', 10),
  // HOSTING: serve built frontend from backend (single-service hosts). 0 = API only (nginx split), 1 = serve ../frontend/dist.
  serveFrontend: (process.env.SERVE_FRONTEND ?? '0') === '1',
  frontendDist: process.env.FRONTEND_DIST ?? path.join(rootDir, '..', 'frontend', 'dist'),
  // مركز المراسلات + تذكير Gmail (SMTP + App Password). Lazy getters: tests override env after import.
  get gmailUser(): string { return (process.env.GMAIL_USER ?? '').trim(); },
  get gmailAppPassword(): string { return (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, ''); },
  get mailFromName(): string { return process.env.MAIL_FROM_NAME ?? 'المنصة الوطنية للتمويل والمبادرات الصناعية'; },
  // Outside production, reminders go ONLY to MAIL_REDIRECT_TO (seed data holds real-looking gov
  // addresses). MAIL_SEND_REAL=1 opts a non-prod host into delivering to real recipients.
  get mailRedirectTo(): string { return (process.env.MAIL_REDIRECT_TO ?? '').trim(); },
  get mailSendReal(): boolean { return (process.env.NODE_ENV ?? 'development') === 'production' || process.env.MAIL_SEND_REAL === '1'; },
  get appUrl(): string {
    const fallback = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim();
    return (process.env.APP_URL?.trim() || fallback).replace(/\/$/, '');
  },
  get chatReminderDelayMin(): number { return num('CHAT_REMINDER_DELAY_MIN', 15); },
  get chatReminderSweepSec(): number { return num('CHAT_REMINDER_SWEEP_SEC', 60); },
  get chatMaxFileMB(): number { return num('CHAT_MAX_FILE_MB', 20); },
} as const;

if (config.isProd && config.corsOrigin.includes('*')) {
  throw new Error('[config] CORS_ORIGIN=* forbidden in production. Set explicit origins.');
}

if (config.isProd && config.jwtSecret === 'dev-only-insecure-secret-change-me') {
  throw new Error('[config] JWT_SECRET must be set to a strong random value in production.');
}
