import type { Response } from 'express';

// يغلف كل الردود الفاشلة بشكل ApiError الموحد.
export function apiError(
  res: Response, http: number, code: string, messageAr: string, messageEn: string,
  details?: { field: string; issue: string }[],
) {
  return res.status(http).json({ code, messageAr, messageEn, ...(details ? { details } : {}) });
}

export function okMessage(res: Response, http: number, message: string, data?: unknown) {
  return res.status(http).json({ message, status: 'ok' as const, ...(data !== undefined ? { data } : {}) });
}
