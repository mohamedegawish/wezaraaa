import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { auth } from './middleware/auth.js';
import { apiError } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usersRouter } from './routes/users.js';
import { initiativesRouter, publicInitiativesRouter } from './routes/initiatives.js';
import { factoriesRouter, publicFactoriesRouter } from './routes/factories.js';
import { applicationsRouter } from './routes/applications.js';
import { messagesRouter } from './routes/messages.js';
import { chatRouter } from './routes/chat.js';
import { auditRouter, dashboardRouter, reportsRouter } from './routes/system.js';
import { bannersRouter, publicBannersRouter } from './routes/banners.js';

export function createApp() {
  const app = express();
  // TRUST_PROXY: behind nginx (docker-compose sets TRUST_PROXY=1) Express must trust the
  // first proxy hop so req.ip = real client IP. This feeds express-rate-limit keying AND
  // audit log ip. Never set boolean true — express-rate-limit rejects it as insecure.
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // PROD FIX: request-id للتتبع + helmet مشدد + CORS صريح (لا * في prod — يرمي من config).
  app.use((req, _res, next) => {
    const rid = (req.headers['x-request-id'] as string | undefined) ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    (req as unknown as Record<string, unknown>)['requestId'] = rid;
    next();
  });
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // HOSTING: HSTS only in prod behind TLS-terminating proxy (nginx). Never in dev (breaks http://localhost).
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: config.isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Google Fonts (frontend/index.html) — needed when the SPA is served from here (SERVE_FRONTEND=1).
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        // blob: — chat attachments are fetched with the Bearer token, then previewed via object URLs.
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        frameSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        frameAncestors: ["'none'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: config.corsOrigin.includes('*') ? true : config.corsOrigin,
    credentials: true,
  }));
  // P1-9: لا تسجّل Authorization / Cookie في اللوغ (تسريب أسرار)
  morgan.token('auth', (req) => {
    const h = (req.headers.authorization as string | undefined) || '';
    return h ? '[REDACTED]' : '-';
  });
  app.use(morgan(config.isProd ? ':remote-addr - :remote-user [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" auth=:auth' : 'dev'));
  app.use(cookieParser());
  app.use(express.json({ limit: config.jsonLimit }));

  const v1Limiter = rateLimit({
    // NOTE: express-rate-limit v8 has no per-limiter trustProxy option — its default
    // keyGenerator keys by req.ip, which Express resolves from the app 'trust proxy'
    // setting above (X-Forwarded-For honored ONLY when TRUST_PROXY=1, e.g. behind nginx).
    windowMs: config.rateWindowMs,
    max: config.rateMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      code: 'RATE_LIMITED', messageAr: 'طلبات كثيرة — حاول لاحقا.', messageEn: 'Too many requests, try again later.',
    },
  });

  const v1 = express.Router();
  v1.use(healthRouter); // عام — قبل المصادقة والحد
  // PROD FIX: عقد API علني للفرق والتكامل (يقرأ من contracts/openapi.json).
  v1.get('/openapi.json', (_req, res) => {
    try {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const candidates = [
        path.join(process.cwd(), 'contracts', 'openapi.json'),
        path.join(here, '..', '..', 'contracts', 'openapi.json'),
        path.join(here, '..', 'contracts', 'openapi.json'),
      ];
      const found = candidates.find((p) => fs.existsSync(p));
      if (!found) return apiError(res, 404, 'NOT_FOUND', 'ملف العقد غير موجود.', 'OpenAPI not found.');
      res.type('application/json').send(fs.readFileSync(found, 'utf8'));
    } catch {
      return apiError(res, 500, 'INTERNAL_ERROR', 'تعذر قراءة العقد.', 'Cannot read contract.');
    }
  });
  // PROD FIX: حد صارم لمحاولات الدخول (brute-force) — قبل راوتر المصادقة.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'RATE_LIMITED', messageAr: 'محاولات كثيرة — انتظر 15 دقيقة.', messageEn: 'Too many auth attempts.' },
  });
  // API-only frontend: public showcase reads need NO auth (guest browsing) — but rate-limited (P1-1).
  const publicReadLimiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'RATE_LIMITED', messageAr: 'طلبات كثيرة — حاول لاحقا.', messageEn: 'Too many requests.' },
  });
  // Scope limiter to /initiatives only — mounting as (limiter, router) would count every v1 request.
  v1.use('/initiatives', publicReadLimiter);
  v1.use(publicInitiativesRouter);
  // بانرات الصفحة الرئيسية: المعروض الآن + الصور للزوار؛ ?scope=all والتعديل يكملان إلى auth.
  v1.use('/banners', publicReadLimiter);
  v1.use(publicBannersRouter);
  // API-only frontend: public factory self-registration shares the auth abuse surface.
  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: 'RATE_LIMITED', messageAr: 'محاولات كثيرة — انتظر 15 دقيقة.', messageEn: 'Too many attempts.' },
  });
  v1.use('/factories/register', publicLimiter, publicFactoriesRouter);
  v1.use('/auth/login', authLimiter);
  v1.use(authRouter); // /auth/login|refresh|logout عامة + /auth/change-password محمية داخليا
  v1.use(v1Limiter);
  v1.use(auth); // كل ما بعده يتطلب Bearer JWT او x-user-id (dev)
  v1.use(usersRouter);
  v1.use(initiativesRouter);
  v1.use(factoriesRouter);
  v1.use(applicationsRouter);
  v1.use(messagesRouter);
  v1.use(chatRouter);
  v1.use(dashboardRouter);
  v1.use(reportsRouter);
  v1.use(auditRouter);
  v1.use(bannersRouter);

  app.use('/api/v1', v1);

  // HOSTING: optional single-service mode — serve frontend/dist (SPA + cache). Disabled by default.
  const serveSpa = config.serveFrontend && fs.existsSync(path.join(config.frontendDist, 'index.html'));
  // API-only root info — in SPA mode '/' must fall through to index.html (the site's home page).
  if (!serveSpa) app.get('/', (_req, res) => res.json({ name: 'industry-platform-server', docs: '/api/v1/health' }));
  if (serveSpa) {
    app.use(express.static(config.frontendDist, { maxAge: '1d', index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(config.frontendDist, 'index.html'));
    });
  }

  // 404 موحد تحت /api/v1
  app.use('/api/v1', (req, res) => apiError(res, 404, 'NOT_FOUND', 'المسار غير موجود.', `Route not found: ${req.method} ${req.path}`));
  // معالج أخطاء أخير (multer + غيره) بشكل ApiError
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
      return apiError(res, 400, 'FILE_TOO_LARGE', 'حجم الملف يتجاوز الحد المسموح.', 'File too large.');
    }
    // PROD FIX: fileFilter يرمي Error('INVALID_FILE_TYPE') — وحّده كـ 400 بدل 500.
    if (err instanceof Error && err.message === 'INVALID_FILE_TYPE') {
      return apiError(res, 400, 'INVALID_FILE_TYPE', 'ملف التفاصيل يجب أن يكون PDF فقط.', 'Details file must be PDF only.');
    }
    console.error('[api-error]', err);
    return apiError(res, 500, 'INTERNAL_ERROR', 'خطأ داخلي — حاول لاحقا.', 'Internal server error.');
  });
  return app;
}
