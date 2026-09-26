import { getDb, parseJson } from '../db/sqlite.js';
import { randomUUID } from 'node:crypto';

/** PROD FIX: collision-safe IDs — replaces Date.now() which collides under concurrency. */
export function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

/** Params accepted by node:sqlite prepared statements. */
export type SqlParam = string | number | bigint | null | NodeJS.ArrayBufferView;

export function normPage(page: unknown, fallback = 1): number {
  const n = Number(page);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export function normPageSize(pageSize: unknown, fallback = 20, max = 100): number {
  const n = Number(pageSize);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export function paginate<T>(rows: T[], total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { data: rows, page, pageSize, total, totalPages };
}

/** LIKE escape for % _ \ in user search strings. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function db() {
  return getDb();
}

export { parseJson };
