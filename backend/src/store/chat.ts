import { getDb, nowIso } from '../db/sqlite.js';
import { newId } from './helpers.js';
import { getOrganizationById, type Organization } from './organizations.js';
import { ADMIN_ROLES } from '../middleware/requireRole.js';
import type { User } from './users.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ============================================================================
// مركز المراسلات (contract-first 5c) — محادثات ثنائية بين أي جهتين.
// - الوزارة جهة مثل غيرها (يتحدث باسمها ministry_admin / initiative_manager).
// - المدقق: اطلاع فقط. المصانع/المستثمرون: ممنوعون.
// - الإدارة والمدقق يطّلعون (قراءة فقط) على المحادثات بين الجهات الأخرى.
// ============================================================================

export const CHAT_MINISTRY_ORG_ID = 'org-ministry';
const REVIEWER_ROLES = ['ida_reviewer', 'imc_reviewer', 'bank_reviewer', 'solar_provider'];
const OVERSIGHT_ROLES = [...ADMIN_ROLES, 'auditor'] as readonly string[];

export interface ChatAccess {
  /** The organization the user speaks for. */
  orgId: string;
  /** May send / mark read (auditors are read-only). */
  canSend: boolean;
  /** May read conversations between OTHER organizations. */
  canOversee: boolean;
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderNameEn: string;
  senderRole: string;
  senderOrgId: string;
  senderOrgNameAr: string;
  body: string;
  attachments: ChatAttachment[];
  createdAt: string;
}

/** One row of the caller's directory: a peer organization + the pair conversation (if any). */
export interface ChatConversationSummary {
  orgId: string; // the PEER organization
  orgCode: string;
  orgNameAr: string;
  orgNameEn: string;
  orgType: string;
  contactEmail: string;
  conversationId: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageFromMe: boolean;
  myLastReadAt: string;
  peerLastReadAt: string;
  unread: number;
}

export interface ChatOversightItem {
  conversationId: string;
  orgA: { id: string; code: string; nameAr: string; nameEn: string; type: string };
  orgB: { id: string; code: string; nameAr: string; nameEn: string; type: string };
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderOrgId: string;
  messageCount: number;
}

export interface ChatUnreadSummary {
  total: number;
  items: Array<Pick<ChatConversationSummary, 'orgId' | 'orgCode' | 'orgNameAr' | 'orgNameEn' | 'orgType' | 'unread' | 'lastMessagePreview' | 'lastMessageAt'>>;
}

/** Internal only — storedPath never leaves the backend. */
export interface ChatAttachmentInternal extends ChatAttachment {
  storedPath: string;
  orgA: string;
  orgB: string;
}

export interface NewChatAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storedPath: string;
}

const PREVIEW_MAX = 140;

/** Organization eligible for messaging: exists, active, not a factory. */
export function getChatOrg(orgId: string): Organization | null {
  const org = getOrganizationById(orgId);
  if (!org || !org.active || org.type === 'factory') return null;
  return org;
}

export function chatAccessFor(user: User | undefined | null): ChatAccess | null {
  if (!user || user.role === 'factory_owner') return null;
  if (!getChatOrg(user.organizationId)) return null;
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(user.role);
  if (!isAdmin && !REVIEWER_ROLES.includes(user.role) && user.role !== 'auditor') return null;
  return {
    orgId: user.organizationId,
    canSend: user.role !== 'auditor',
    canOversee: OVERSIGHT_ROLES.includes(user.role),
  };
}

function pairOf(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/** Column suffix for an org inside a conversation row. */
function sideOf(conv: Row, orgId: string): 'A' | 'B' {
  return conv.orgA === orgId ? 'A' : 'B';
}

export function getConversationByPair(x: string, y: string): Row | undefined {
  const [a, b] = pairOf(x, y);
  return getDb().prepare('SELECT * FROM chat_conversations WHERE orgA = ? AND orgB = ?').get(a, b) as Row | undefined;
}

export function getConversationById(id: string): Row | undefined {
  return getDb().prepare('SELECT * FROM chat_conversations WHERE id = ?').get(id) as Row | undefined;
}

function getOrCreateConversation(x: string, y: string): Row {
  const existing = getConversationByPair(x, y);
  if (existing) return existing;
  const [a, b] = pairOf(x, y);
  getDb().prepare('INSERT INTO chat_conversations (id, orgA, orgB, createdAt) VALUES (?, ?, ?, ?)').run(newId('chat'), a, b, nowIso());
  return getConversationByPair(a, b) as Row;
}

// ----------------------------------------------------------------------------
// Directory / unread
// ----------------------------------------------------------------------------

/** Every eligible organization except mine, with the pair conversation summary. Unread first, then recent. */
export function listChatDirectory(myOrgId: string): ChatConversationSummary[] {
  const rows = getDb().prepare(
    `SELECT o.id AS orgId, o.code AS orgCode, o.nameAr AS orgNameAr, o.nameEn AS orgNameEn, o.type AS orgType,
            o.contactEmail AS contactEmail,
            c.id AS conversationId, c.lastMessageAt, c.lastMessagePreview, c.lastSenderOrgId,
            CASE WHEN c.orgA = :me THEN c.readA ELSE c.readB END AS myLastReadAt,
            CASE WHEN c.orgA = :me THEN c.readB ELSE c.readA END AS peerLastReadAt,
            (SELECT COUNT(*) FROM chat_messages m
              WHERE m.conversationId = c.id AND m.senderOrgId <> :me
                AND m.createdAt > (CASE WHEN c.orgA = :me THEN c.readA ELSE c.readB END)) AS unread
       FROM organizations o
       LEFT JOIN chat_conversations c
         ON (c.orgA = :me AND c.orgB = o.id) OR (c.orgB = :me AND c.orgA = o.id)
      WHERE o.active = 1 AND o.type <> 'factory' AND o.id <> :me
      ORDER BY (unread > 0) DESC, COALESCE(c.lastMessageAt, '') DESC, (o.id = :ministry) DESC, o.nameAr ASC`,
  ).all({ me: myOrgId, ministry: CHAT_MINISTRY_ORG_ID }) as unknown as Row[];
  return rows.map((r) => ({
    orgId: r.orgId,
    orgCode: r.orgCode ?? '',
    orgNameAr: r.orgNameAr ?? '',
    orgNameEn: r.orgNameEn ?? '',
    orgType: r.orgType ?? '',
    contactEmail: r.contactEmail ?? '',
    conversationId: r.conversationId ?? null,
    lastMessageAt: r.lastMessageAt ?? '',
    lastMessagePreview: r.lastMessagePreview ?? '',
    lastMessageFromMe: !!r.lastSenderOrgId && r.lastSenderOrgId === myOrgId,
    myLastReadAt: r.myLastReadAt ?? '',
    peerLastReadAt: r.peerLastReadAt ?? '',
    unread: Number(r.unread ?? 0),
  }));
}

export function getUnreadSummary(myOrgId: string): ChatUnreadSummary {
  const withUnread = listChatDirectory(myOrgId).filter((c) => c.unread > 0);
  return {
    total: withUnread.reduce((s, c) => s + c.unread, 0),
    items: withUnread
      .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
      .slice(0, 10)
      .map((c) => ({
        orgId: c.orgId, orgCode: c.orgCode, orgNameAr: c.orgNameAr, orgNameEn: c.orgNameEn, orgType: c.orgType,
        unread: c.unread, lastMessagePreview: c.lastMessagePreview, lastMessageAt: c.lastMessageAt,
      })),
  };
}

/** Conversations between OTHER organizations (read-only oversight for the ministry / auditor). */
export function listOversight(excludeOrgId: string): ChatOversightItem[] {
  const rows = getDb().prepare(
    `SELECT c.id AS conversationId, c.lastMessageAt, c.lastMessagePreview, c.lastSenderOrgId,
            a.id AS aId, a.code AS aCode, a.nameAr AS aNameAr, a.nameEn AS aNameEn, a.type AS aType,
            b.id AS bId, b.code AS bCode, b.nameAr AS bNameAr, b.nameEn AS bNameEn, b.type AS bType,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.conversationId = c.id) AS messageCount
       FROM chat_conversations c
       JOIN organizations a ON a.id = c.orgA
       JOIN organizations b ON b.id = c.orgB
      WHERE c.lastMessageAt <> '' AND c.orgA <> ? AND c.orgB <> ?
      ORDER BY c.lastMessageAt DESC`,
  ).all(excludeOrgId, excludeOrgId) as unknown as Row[];
  return rows.map((r) => ({
    conversationId: r.conversationId,
    orgA: { id: r.aId, code: r.aCode, nameAr: r.aNameAr, nameEn: r.aNameEn, type: r.aType },
    orgB: { id: r.bId, code: r.bCode, nameAr: r.bNameAr, nameEn: r.bNameEn, type: r.bType },
    lastMessageAt: r.lastMessageAt ?? '',
    lastMessagePreview: r.lastMessagePreview ?? '',
    lastSenderOrgId: r.lastSenderOrgId ?? '',
    messageCount: Number(r.messageCount ?? 0),
  }));
}

// ----------------------------------------------------------------------------
// Messages
// ----------------------------------------------------------------------------

function isImageMime(mime: string): boolean {
  return mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp';
}

function attachmentsFor(messageIds: string[]): Map<string, ChatAttachment[]> {
  const out = new Map<string, ChatAttachment[]>();
  if (!messageIds.length) return out;
  const marks = messageIds.map(() => '?').join(',');
  const rows = getDb().prepare(
    `SELECT id, messageId, fileName, mimeType, sizeBytes, createdAt FROM chat_attachments
      WHERE messageId IN (${marks}) ORDER BY rowid ASC`,
  ).all(...messageIds) as unknown as Row[];
  for (const r of rows) {
    const list = out.get(r.messageId) ?? [];
    list.push({
      id: r.id, fileName: r.fileName, mimeType: r.mimeType, sizeBytes: Number(r.sizeBytes ?? 0),
      isImage: isImageMime(r.mimeType), createdAt: r.createdAt,
    });
    out.set(r.messageId, list);
  }
  return out;
}

function toMessages(rows: Row[]): ChatMessage[] {
  const files = attachmentsFor(rows.map((r) => r.id as string));
  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    senderUserId: r.senderUserId ?? '',
    senderName: r.senderName ?? '',
    senderNameEn: r.senderNameEn ?? '',
    senderRole: r.senderRole ?? '',
    senderOrgId: r.senderOrgId ?? '',
    senderOrgNameAr: r.senderOrgNameAr ?? '',
    body: r.body ?? '',
    attachments: files.get(r.id) ?? [],
    createdAt: r.createdAt,
  }));
}

const MESSAGE_SELECT = `SELECT m.rowid AS rid, m.id, m.conversationId, m.senderUserId, m.senderOrgId, m.body, m.createdAt,
       u.name AS senderName, u.nameEn AS senderNameEn, u.role AS senderRole, so.nameAr AS senderOrgNameAr
  FROM chat_messages m
  LEFT JOIN users u ON u.id = m.senderUserId
  LEFT JOIN organizations so ON so.id = m.senderOrgId`;

export interface MessagePage {
  data: ChatMessage[];
  hasMore: boolean;
  readA: string;
  readB: string;
  orgA: string;
  orgB: string;
}

/**
 * Cursor pagination by message id (rowid — strictly monotonic):
 * default = newest `limit`; before=<id> = older page; after=<id> = everything newer (polling, ≤100).
 */
export function listConversationMessages(conv: Row | undefined, opts: { before?: string; after?: string; limit?: unknown }): MessagePage {
  const db = getDb();
  const empty = (): MessagePage => ({ data: [], hasMore: false, readA: conv?.readA ?? '', readB: conv?.readB ?? '', orgA: conv?.orgA ?? '', orgB: conv?.orgB ?? '' });
  if (!conv) return empty();
  const n = Number(opts.limit);
  const limit = Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 50) : 30;
  const rowidOf = (id: string) =>
    (db.prepare('SELECT rowid AS rid FROM chat_messages WHERE id = ? AND conversationId = ?').get(id, conv.id) as { rid: number } | undefined)?.rid;

  if (opts.after) {
    const rid = rowidOf(opts.after);
    if (rid === undefined) return empty();
    const rows = db.prepare(`${MESSAGE_SELECT} WHERE m.conversationId = ? AND m.rowid > ? ORDER BY m.rowid ASC LIMIT 100`)
      .all(conv.id, rid) as unknown as Row[];
    return { ...empty(), data: toMessages(rows) };
  }
  let rows: Row[];
  if (opts.before) {
    const rid = rowidOf(opts.before);
    if (rid === undefined) return empty();
    rows = db.prepare(`${MESSAGE_SELECT} WHERE m.conversationId = ? AND m.rowid < ? ORDER BY m.rowid DESC LIMIT ?`)
      .all(conv.id, rid, limit) as unknown as Row[];
  } else {
    rows = db.prepare(`${MESSAGE_SELECT} WHERE m.conversationId = ? ORDER BY m.rowid DESC LIMIT ?`)
      .all(conv.id, limit) as unknown as Row[];
  }
  rows.reverse();
  const oldest = rows[0]?.rid as number | undefined;
  const hasMore = oldest !== undefined
    && Boolean(db.prepare('SELECT 1 AS x FROM chat_messages WHERE conversationId = ? AND rowid < ? LIMIT 1').get(conv.id, oldest));
  return { ...empty(), data: toMessages(rows), hasMore };
}

/** Strictly increasing per conversation so "createdAt > lastReadAt" never loses a same-ms message. */
function monotonicNow(after: string): string {
  const now = nowIso();
  if (!after || now > after) return now;
  return new Date(new Date(after).getTime() + 1).toISOString();
}

export function createChatMessage(input: {
  fromOrgId: string; toOrgId: string; senderUserId: string; body: string; attachments: NewChatAttachment[];
}): ChatMessage {
  const db = getDb();
  const id = newId('cmsg');
  db.exec('BEGIN IMMEDIATE');
  try {
    const conv = getOrCreateConversation(input.fromOrgId, input.toOrgId);
    const createdAt = monotonicNow(conv.lastMessageAt as string);
    db.prepare('INSERT INTO chat_messages (id, conversationId, senderUserId, senderOrgId, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, conv.id, input.senderUserId, input.fromOrgId, input.body, createdAt);
    const attStmt = db.prepare(
      'INSERT INTO chat_attachments (id, messageId, fileName, mimeType, sizeBytes, storedPath, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const a of input.attachments) {
      attStmt.run(newId('catt'), id, a.fileName, a.mimeType, a.sizeBytes, a.storedPath, createdAt);
    }
    const preview = input.body
      ? input.body.replace(/\s+/g, ' ').slice(0, PREVIEW_MAX)
      : `📎 ${input.attachments[0]?.fileName ?? ''}${input.attachments.length > 1 ? ` (+${input.attachments.length - 1})` : ''}`;
    // Sending implies the sender's org has seen everything up to its own message.
    const s = sideOf(conv, input.fromOrgId);
    db.prepare(`UPDATE chat_conversations SET lastMessageAt = ?, lastMessagePreview = ?, lastSenderOrgId = ?, read${s} = ? WHERE id = ?`)
      .run(createdAt, preview, input.fromOrgId, createdAt, conv.id);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* noop */ }
    throw e;
  }
  const row = db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(id) as Row;
  return toMessages([row])[0];
}

/** Marks the pair conversation read for `orgId` and re-arms its email reminder. */
export function markChatRead(myOrgId: string, peerOrgId: string): { myLastReadAt: string; peerLastReadAt: string } {
  const conv = getConversationByPair(myOrgId, peerOrgId);
  if (!conv) return { myLastReadAt: '', peerLastReadAt: '' };
  const me = sideOf(conv, myOrgId);
  const peer = me === 'A' ? 'B' : 'A';
  const upTo = (conv.lastMessageAt as string) || '';
  getDb().prepare(
    `UPDATE chat_conversations SET read${me} = ?, reminderSent${me} = '', reminderAttempt${me} = '' WHERE id = ? AND read${me} < ?`,
  ).run(upTo, conv.id, upTo);
  const after = getConversationById(conv.id) as Row;
  return { myLastReadAt: after[`read${me}`] ?? '', peerLastReadAt: after[`read${peer}`] ?? '' };
}

export function getChatAttachment(id: string): ChatAttachmentInternal | null {
  const r = getDb().prepare(
    `SELECT a.id, a.fileName, a.mimeType, a.sizeBytes, a.storedPath, a.createdAt, c.orgA, c.orgB
       FROM chat_attachments a
       JOIN chat_messages m ON m.id = a.messageId
       JOIN chat_conversations c ON c.id = m.conversationId
      WHERE a.id = ?`,
  ).get(id) as Row | undefined;
  if (!r) return null;
  return {
    id: r.id, fileName: r.fileName, mimeType: r.mimeType, sizeBytes: Number(r.sizeBytes ?? 0),
    isImage: isImageMime(r.mimeType), createdAt: r.createdAt, storedPath: r.storedPath, orgA: r.orgA, orgB: r.orgB,
  };
}

// ----------------------------------------------------------------------------
// Reminder support (jobs/chatReminders.ts) — per recipient side
// ----------------------------------------------------------------------------

export interface ReminderCandidate {
  conversationId: string;
  side: 'A' | 'B';
  /** Recipient organization (has unread messages). */
  orgId: string;
  peerOrgId: string;
  unread: number;
  oldestUnreadAt: string;
}

/** Sides whose incoming messages stayed unread past `cutoff` and were not reminded yet. */
export function listReminderCandidates(cutoffIso: string, retryBeforeIso: string): ReminderCandidate[] {
  const q = (me: 'A' | 'B') => {
    const peer = me === 'A' ? 'B' : 'A';
    return `SELECT c.id AS conversationId, '${me}' AS side, c.org${me} AS orgId, c.org${peer} AS peerOrgId,
                   COUNT(m.id) AS unread, MIN(m.createdAt) AS oldestUnreadAt
              FROM chat_conversations c
              JOIN chat_messages m ON m.conversationId = c.id
              JOIN organizations o ON o.id = c.org${me}
             WHERE m.senderOrgId = c.org${peer}
               AND m.createdAt > c.read${me}
               AND c.reminderSent${me} = ''
               AND (c.reminderAttempt${me} = '' OR c.reminderAttempt${me} <= ?)
               AND o.active = 1 AND o.type <> 'factory'
             GROUP BY c.id
            HAVING MIN(m.createdAt) <= ?`;
  };
  const rows = getDb().prepare(`${q('A')} UNION ALL ${q('B')}`)
    .all(retryBeforeIso, cutoffIso, retryBeforeIso, cutoffIso) as unknown as Row[];
  return rows.map((r) => ({
    conversationId: r.conversationId, side: r.side, orgId: r.orgId, peerOrgId: r.peerOrgId,
    unread: Number(r.unread ?? 0), oldestUnreadAt: r.oldestUnreadAt,
  }));
}

/** Org contact email + verified members who can chat for it (no factory owners / auditors), de-duplicated. */
export function reminderRecipients(orgId: string): string[] {
  const org = getOrganizationById(orgId);
  const users = getDb().prepare(
    "SELECT email FROM users WHERE organizationId = ? AND isVerified = 1 AND role NOT IN ('factory_owner', 'auditor')",
  ).all(orgId) as unknown as Array<{ email: string }>;
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (e: string | undefined) => {
    const v = (e ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return;
    const k = v.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(v);
  };
  add(org?.contactEmail);
  for (const u of users) add(u.email);
  return out;
}

export function markReminderAttempt(conversationId: string, side: 'A' | 'B', atIso: string): void {
  getDb().prepare(`UPDATE chat_conversations SET reminderAttempt${side} = ? WHERE id = ?`).run(atIso, conversationId);
}

export function markReminderSent(conversationId: string, side: 'A' | 'B', atIso: string): void {
  getDb().prepare(`UPDATE chat_conversations SET reminderSent${side} = ?, reminderAttempt${side} = ? WHERE id = ?`)
    .run(atIso, atIso, conversationId);
}
