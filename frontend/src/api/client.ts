import type { ApiError } from './schemas';

// P0-1: XSS mitigation — access token lives only in memory (never localStorage).
// Refresh lives as httpOnly cookie (Secure + SameSite=Lax) — not in JS at all.
// Legacy localStorage tokens are migrated once then wiped.
let memAccess: string | null = null;
try {
  const legacyA = localStorage.getItem('accessToken');
  const legacyR = localStorage.getItem('refreshToken');
  if (legacyA) memAccess = legacyA;
  // Wipe legacy immediately — keeps XSS window tiny; refresh cookie already set by backend.
  if (legacyA || legacyR) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
} catch {}
export function setAccessToken(t: string | null) { memAccess = t; }
export function getAccessToken(): string | null { return memAccess; }
export function clearTokens() { memAccess = null; try { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); } catch {} }

// عميل fetch الوحيد في الفرونت — لا fetch مباشر خارج src/api.
// API-only: لا توجد بيانات ثابتة — القاعدة الوحيدة هي باك SQLite عبر VITE_API_URL
// (فارغ = نفس المنشأ، يعمل مع بروكسي التطوير؛ في الإنتاج يُخبز عبر Docker build-arg).
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

// Prefixed path helper — absolute backend paths like /covers/… need API_BASE
// when frontend and API run on different origins (split VPS/nginx).
// External URLs (http://… or data:…) pass through untouched.
export function resolveCoverUrl(path: string): string {
  return path;
}

// PROD-GUARD: نبّه بصوت عالٍ إن خرجت نسخة إنتاج بدون VITE_API_URL — وضع نفس-المنشأ
// يعمل فقط مع SERVE_FRONTEND=1، ويفشل بصمت مع الاستضافة المقسمة (nginx منفصل).
// VITE_SAME_ORIGIN=1 = نفس-المنشأ مقصود (صورة الحاوية الواحدة في جذر المشروع/Coolify) — لا تحذير.
if (!API_BASE && import.meta.env.PROD && import.meta.env.VITE_SAME_ORIGIN !== '1') {
  console.error('[PROD-GUARD] VITE_API_URL is empty in production build — API calls fall back to same-origin, which only works in single-service mode (SERVE_FRONTEND=1). Set VITE_API_URL to the real API.');
}

export class ApiException extends Error {
  apiError: ApiError;
  http: number;
  constructor(http: number, apiError: ApiError) {
    super(apiError.messageAr || apiError.code);
    this.http = http;
    this.apiError = apiError;
  }
}

// Silent JWT rotation helper: exchanges the stored refresh token for a fresh
// access token (single attempt, no retry loops). Used by apiFetch on 401 and
// by boot-time session restore (no access token at all).
async function tryRefresh(): Promise<boolean> {
  try {
    const url = new URL('/api/v1/auth/refresh', API_BASE || window.location.origin);
    const res = await fetch(url.toString(), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { data?: { accessToken?: string } };
    if (!j.data?.accessToken) return false;
    memAccess = j.data.accessToken;
    return true;
  } catch {
    return false;
  }
}

// Public wrapper for boot-time session restore (no access token at all).
export async function refreshSession(): Promise<boolean> {
  return tryRefresh();
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  userId?: string;
  lang?: 'ar' | 'en';
  formData?: FormData;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const headers: Record<string, string> = {
    'Accept-Language': opts.lang ?? (document.documentElement.lang === 'en' ? 'en' : 'ar'),
  };
  // JWT Bearer from memory only (never localStorage) — XSS cannot steal via script.
  let hadToken = false;
  if (memAccess) { headers['Authorization'] = `Bearer ${memAccess}`; hadToken = true; }
  if (opts.userId) headers['x-user-id'] = opts.userId;
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const doFetch = () => fetch(url.toString(), { method: opts.method ?? 'GET', headers, body, credentials: 'include' });
  let res = await doFetch();
  // Access expired mid-session -> rotate silently once via httpOnly cookie, then retry (incl. file uploads).
  const isAuthPath = path.startsWith('/api/v1/auth/login') || path.startsWith('/api/v1/auth/refresh') || path.startsWith('/api/v1/auth/logout');
  if (res.status === 401 && hadToken && !isAuthPath) {
    if (await tryRefresh() && memAccess) {
      headers['Authorization'] = `Bearer ${memAccess}`;
      res = await doFetch();
    }
  }
  if (!res.ok) {
    let parsed: ApiError = {
      code: `HTTP_${res.status}`,
      messageAr: 'حدث خطأ في الاتصال بالخادم.',
      messageEn: `Request failed with ${res.status}.`,
    };
    try {
      parsed = (await res.json()) as ApiError;
    } catch {
      /* keep default */
    }
    throw new ApiException(res.status, parsed);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// Binary downloads (chat attachments): the token lives in memory, so a plain <a href> cannot
// authenticate — fetch as Blob with the same Bearer + one silent refresh, then use an object URL.
export async function apiFetchBlob(path: string, opts: { query?: Record<string, string>; userId?: string } = {}): Promise<Blob> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  let hadToken = false;
  if (memAccess) { headers['Authorization'] = `Bearer ${memAccess}`; hadToken = true; }
  if (opts.userId) headers['x-user-id'] = opts.userId;
  const doFetch = () => fetch(url.toString(), { headers, credentials: 'include' });
  let res = await doFetch();
  if (res.status === 401 && hadToken && await tryRefresh() && memAccess) {
    headers['Authorization'] = `Bearer ${memAccess}`;
    res = await doFetch();
  }
  if (!res.ok) {
    let parsed: ApiError = { code: `HTTP_${res.status}`, messageAr: 'تعذر تنزيل الملف.', messageEn: `Download failed with ${res.status}.` };
    try { parsed = (await res.json()) as ApiError; } catch { /* keep default */ }
    throw new ApiException(res.status, parsed);
  }
  return res.blob();
}
