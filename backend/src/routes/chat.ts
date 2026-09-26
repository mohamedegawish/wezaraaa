import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type NextFunction, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { config } from '../config.js';
import {
  chatAccessFor, createChatMessage, getChatAttachment, getChatOrg, getConversationById, getConversationByPair, getUnreadSummary,
  listChatDirectory, listConversationMessages, listOversight, markChatRead, type ChatAccess, type NewChatAttachment,
} from '../store/chat.js';
import { addAuditLog } from '../store/audit.js';
import { apiError, okMessage } from '../middleware/error.js';
import type { AuthedRequest } from '../middleware/auth.js';
import type { Organization } from '../store/organizations.js';

export const chatRouter = Router();

// Contract-first 5c: مركز المراسلات — محادثات ثنائية بين أي جهتين + اطلاع الإدارة (المصانع/المستثمرون ممنوعون).
const sendLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', messageAr: 'رسائل كثيرة — انتظر قليلا.', messageEn: 'Too many messages.' },
});

const MAX_BODY = 4000;
const MAX_FILES = 5;

/** Allowed extensions → canonical MIME (never trust the client's Content-Type). */
const ALLOWED: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
};

function extOf(name: string): string {
  return path.extname(name).toLowerCase();
}

/** Busboy decodes raw UTF-8 filenames as latin1 — recover Arabic names (keep original if not valid UTF-8). */
function decodeName(raw: string): string {
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
  const name = utf8.includes('\uFFFD') ? raw : utf8;
  return path.basename(name).replace(/[\u0000-\u001f\u007f/\\]+/g, '_').trim().slice(0, 180) || 'file';
}

/** Magic-bytes check — blocks renamed executables (same idea as the PDF check in factories.ts). */
function contentMatches(ext: string, filePath: string): boolean {
  let head: Buffer;
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      head = Buffer.alloc(8192);
      const n = fs.readSync(fd, head, 0, head.length, 0);
      head = head.subarray(0, n);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
  const starts = (sig: number[], at = 0) => sig.every((b, i) => head[at + i] === b);
  switch (ext) {
    case '.pdf': return head.subarray(0, 5).toString('ascii') === '%PDF-';
    case '.png': return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case '.jpg':
    case '.jpeg': return starts([0xff, 0xd8, 0xff]);
    case '.webp': return head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
    case '.docx':
    case '.xlsx':
    case '.pptx': return starts([0x50, 0x4b, 0x03, 0x04]);
    case '.doc':
    case '.xls': return starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case '.txt':
    case '.csv': return head.length === 0 || !head.includes(0);
    default: return false;
  }
}

interface ChatCtx { access: ChatAccess; peer: Organization }

function ctx(res: Response): ChatCtx {
  return res.locals.chat as ChatCtx;
}

const FORBIDDEN_AR = 'مركز المراسلات متاح للجهات والمسؤولين فقط.';
const FORBIDDEN_EN = 'Message center is for organizations and officials only.';

/** Gate for every chat endpoint: eligible user (not factory/investor). */
function requireChatUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const access = chatAccessFor(req.user);
  if (!access) return apiError(res, 403, 'FORBIDDEN', FORBIDDEN_AR, FORBIDDEN_EN);
  res.locals.access = access;
  next();
}

/**
 * Resolves :orgId as the PEER organization of a pair conversation (caller's org ↔ peer),
 * BEFORE any upload touches the disk. `send` additionally requires a non read-only user.
 */
function requirePeer(send: boolean) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const access = chatAccessFor(req.user);
    if (!access) return apiError(res, 403, 'FORBIDDEN', FORBIDDEN_AR, FORBIDDEN_EN);
    if (send && !access.canSend) {
      return apiError(res, 403, 'READ_ONLY', 'حسابك للاطلاع فقط ولا يمكنه الإرسال.', 'Your account is read-only.');
    }
    const peer = getChatOrg(req.params.orgId);
    if (!peer) return apiError(res, 404, 'NOT_FOUND', 'الجهة غير موجودة أو غير متاحة للمراسلة.', 'Organization not found or not eligible.');
    if (peer.id === access.orgId) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'لا يمكن مراسلة جهتك نفسها.', 'Cannot message your own organization.');
    }
    res.locals.chat = { access, peer } satisfies ChatCtx;
    next();
  };
}

function removeFiles(files: Express.Multer.File[] | undefined) {
  for (const f of files ?? []) fs.promises.unlink(f.path).catch(() => undefined);
}

/** multer built per request so CHAT_MAX_FILE_MB / UPLOAD_DIR resolve lazily; errors mapped to ApiError here. */
function chatUpload(req: AuthedRequest, res: Response, next: NextFunction) {
  const dir = path.join(config.uploadDir, 'chat');
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_r, _f, cb) => {
        try { fs.mkdirSync(dir, { recursive: true }); cb(null, dir); } catch (e) { cb(e as Error, dir); }
      },
      filename: (_r, file, cb) => cb(null, `chat-${randomUUID()}${extOf(decodeName(file.originalname))}`),
    }),
    fileFilter: (_r, file, cb) => {
      if (ALLOWED[extOf(decodeName(file.originalname))]) cb(null, true);
      else cb(new Error('INVALID_CHAT_FILE_TYPE'));
    },
    limits: { fileSize: config.chatMaxFileMB * 1024 * 1024, files: MAX_FILES },
  }).array('files', MAX_FILES);
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    removeFiles((req as unknown as { files?: Express.Multer.File[] }).files);
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      return apiError(res, 400, 'FILE_TOO_LARGE', `حجم الملف يتجاوز ${config.chatMaxFileMB} ميجا.`, `File exceeds ${config.chatMaxFileMB} MB.`, [
        { field: 'files', issue: 'too large' },
      ]);
    }
    if (code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE') {
      return apiError(res, 400, 'VALIDATION_ERROR', `الحد الأقصى ${MAX_FILES} ملفات في الرسالة.`, `Max ${MAX_FILES} files per message.`, [
        { field: 'files', issue: 'too many' },
      ]);
    }
    if (err instanceof Error && err.message === 'INVALID_CHAT_FILE_TYPE') {
      return apiError(res, 400, 'INVALID_FILE_TYPE', 'نوع الملف غير مسموح.', 'File type not allowed.', [
        { field: 'files', issue: `allowed: ${Object.keys(ALLOWED).join(' ')}` },
      ]);
    }
    return next(err);
  });
}

/** Directory: every eligible organization except mine + the pair conversation summary. */
chatRouter.get('/chat/conversations', requireChatUser, (_req: AuthedRequest, res) => {
  const access = res.locals.access as ChatAccess;
  return res.json({ orgId: access.orgId, canSend: access.canSend, canOversee: access.canOversee, data: listChatDirectory(access.orgId) });
});

chatRouter.get('/chat/unread', requireChatUser, (_req: AuthedRequest, res) => {
  const access = res.locals.access as ChatAccess;
  // Read-only viewers (auditor) have nothing to act on — never surface the ministry inbox to them.
  if (!access.canSend) return res.json({ total: 0, items: [] });
  return res.json(getUnreadSummary(access.orgId));
});

chatRouter.get('/chat/conversations/:orgId/messages', requirePeer(false), (req: AuthedRequest, res) => {
  const { access, peer } = ctx(res);
  const { before, after, limit } = req.query as Record<string, string | undefined>;
  const conv = getConversationByPair(access.orgId, peer.id);
  const page = listConversationMessages(conv, {
    before: typeof before === 'string' ? before : undefined,
    after: typeof after === 'string' ? after : undefined,
    limit,
  });
  const meIsA = page.orgA === access.orgId;
  return res.json({
    data: page.data,
    hasMore: page.hasMore,
    myLastReadAt: meIsA ? page.readA : page.readB,
    peerLastReadAt: meIsA ? page.readB : page.readA,
  });
});

chatRouter.post('/chat/conversations/:orgId/messages', sendLimiter, requirePeer(true), chatUpload, (req: AuthedRequest, res) => {
  const { access, peer } = ctx(res);
  const files = ((req as unknown as { files?: Express.Multer.File[] }).files ?? []);
  const raw = (req.body ?? {}) as { body?: unknown };
  const body = typeof raw.body === 'string' ? raw.body.replace(/\r\n/g, '\n').trim() : '';

  if (body.length > MAX_BODY) {
    removeFiles(files);
    return apiError(res, 400, 'VALIDATION_ERROR', `نص الرسالة بحد أقصى ${MAX_BODY} حرف.`, `body max ${MAX_BODY} chars.`, [
      { field: 'body', issue: `max ${MAX_BODY} chars` },
    ]);
  }
  if (!body && files.length === 0) {
    return apiError(res, 400, 'VALIDATION_ERROR', 'اكتب رسالة أو أرفق ملفاً.', 'body or at least one file is required.', [
      { field: 'body', issue: 'required' },
    ]);
  }

  const attachments: NewChatAttachment[] = [];
  for (const f of files) {
    const fileName = decodeName(f.originalname);
    const ext = extOf(fileName);
    if (!contentMatches(ext, f.path)) {
      removeFiles(files);
      return apiError(res, 400, 'INVALID_FILE_TYPE', `محتوى الملف «${fileName}» لا يطابق امتداده.`, `File content of "${fileName}" does not match its type.`, [
        { field: 'files', issue: 'content mismatch' },
      ]);
    }
    attachments.push({ fileName, mimeType: ALLOWED[ext], sizeBytes: f.size, storedPath: f.path });
  }

  let created;
  try {
    created = createChatMessage({ fromOrgId: access.orgId, toOrgId: peer.id, senderUserId: req.userId ?? 'unknown', body, attachments });
  } catch (e) {
    removeFiles(files);
    throw e;
  }
  const fromOrg = getChatOrg(access.orgId);
  addAuditLog({
    userId: req.userId,
    userName: req.user?.name ?? req.userId ?? 'unknown',
    ip: req.clientIp,
    actionType: 'chat_message',
    entityType: 'organization',
    entityId: peer.id,
    summaryAr: `رسالة من ${fromOrg?.nameAr ?? access.orgId} إلى ${peer.nameAr}${attachments.length ? ` مع ${attachments.length} مرفق` : ''}`,
  });
  return okMessage(res, 201, 'تم إرسال الرسالة', created);
});

chatRouter.post('/chat/conversations/:orgId/read', requirePeer(true), (_req: AuthedRequest, res) => {
  const { access, peer } = ctx(res);
  return okMessage(res, 200, 'ok', markChatRead(access.orgId, peer.id));
});

// ---- Oversight: the ministry / auditor read conversations between OTHER organizations ----
chatRouter.get('/chat/oversight', requireChatUser, (_req: AuthedRequest, res) => {
  const access = res.locals.access as ChatAccess;
  if (!access.canOversee) return apiError(res, 403, 'FORBIDDEN', 'الاطلاع على محادثات الجهات متاح للإدارة والمدقق فقط.', 'Oversight is for officials only.');
  return res.json({ data: listOversight(access.orgId) });
});

chatRouter.get('/chat/oversight/:conversationId/messages', requireChatUser, (req: AuthedRequest, res) => {
  const access = res.locals.access as ChatAccess;
  if (!access.canOversee) return apiError(res, 403, 'FORBIDDEN', 'الاطلاع على محادثات الجهات متاح للإدارة والمدقق فقط.', 'Oversight is for officials only.');
  const conv = getConversationById(req.params.conversationId);
  if (!conv) return apiError(res, 404, 'NOT_FOUND', 'المحادثة غير موجودة.', 'Conversation not found.');
  const { before, after, limit } = req.query as Record<string, string | undefined>;
  const page = listConversationMessages(conv, {
    before: typeof before === 'string' ? before : undefined,
    after: typeof after === 'string' ? after : undefined,
    limit,
  });
  return res.json(page);
});

chatRouter.get('/chat/attachments/:id', requireChatUser, (req: AuthedRequest, res) => {
  const access = res.locals.access as ChatAccess;
  const att = getChatAttachment(req.params.id);
  if (!att) return apiError(res, 404, 'NOT_FOUND', 'الملف غير موجود.', 'Attachment not found.');
  const participant = att.orgA === access.orgId || att.orgB === access.orgId;
  if (!participant && !access.canOversee) {
    return apiError(res, 403, 'FORBIDDEN', 'لا يمكنك تنزيل مرفقات محادثة لست طرفاً فيها.', 'You are not a party to this conversation.');
  }
  let size = 0;
  try { size = fs.statSync(att.storedPath).size; } catch {
    return apiError(res, 404, 'NOT_FOUND', 'الملف لم يعد متاحاً على الخادم.', 'File is no longer available.');
  }
  const inline = req.query.inline === '1' && (att.isImage || att.mimeType === 'application/pdf');
  const ascii = att.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.setHeader('Content-Type', att.mimeType);
  res.setHeader('Content-Length', String(size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(att.fileName)}`);
  const stream = fs.createReadStream(att.storedPath);
  stream.on('error', () => { if (!res.headersSent) apiError(res, 500, 'INTERNAL_ERROR', 'تعذر قراءة الملف.', 'Cannot read file.'); else res.end(); });
  stream.pipe(res);
});
