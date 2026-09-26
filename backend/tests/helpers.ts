import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root (backend/tests/../..) — portable across machines and CI (no hardcoded drive paths).
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Must be called BEFORE importing any src module (config reads env at import).
export function isolateTestEnv(tag: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ind-test-${tag}-`));
  const dbPath = path.join(dir, 'test.db');
  const uploadDir = path.join(dir, 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  process.env.DB_PATH = dbPath;
  process.env.UPLOAD_DIR = uploadDir;
  process.env.CORS_ORIGIN = 'http://localhost:3000';
  process.env.SEED_ON_BOOT = '0';
  process.env.ALLOW_DEMO_AUTH = '1';
  process.env.NODE_ENV = 'test';
  // Tests must never reach a real mailbox: blank (not delete) so dotenv won't refill them from backend/.env.
  process.env.GMAIL_USER = '';
  process.env.GMAIL_APP_PASSWORD = '';
  process.env.MAIL_REDIRECT_TO = '';
  process.env.MAIL_SEND_REAL = '0';
  return {
    dir, dbPath, uploadDir,
    // PROD FIX test hygiene: close DB (releases WAL lock on Windows) before rm.
    cleanup: async () => {
      try {
        const { closeDb } = await import('../src/db/sqlite.js');
        closeDb();
      } catch { /* noop */ }
      await new Promise((r) => setTimeout(r, 50));
      try { fs.rmSync(dir, { recursive: true, force: true }); }
      catch { /* Windows EBUSY transient — best effort */ }
    },
  };
}

export async function startServer() {
  const { createApp } = await import('../src/app.js');
  const { seedIfEmpty, } = await import('../src/db/seed.js');
  const { closeDb } = await import('../src/db/sqlite.js');
  seedIfEmpty();
  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}/api/v1`;
  return {
    app, server, base,
    close: () => new Promise<void>((r) => server.close(() => { try { closeDb(); } catch { /* noop */ } r(); })),
  };
}

export const H = (userId?: string) => ({
  'Content-Type': 'application/json',
  ...(userId ? { 'x-user-id': userId } : {}),
});

export async function jfetch(url: string, opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) };
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  let json: unknown = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json: json as Record<string, unknown> & { data?: unknown; code?: string } };
}
