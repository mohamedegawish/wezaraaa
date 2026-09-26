import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, CheckCheck, Clock, Eye, Loader2, Mail, MessagesSquare, Paperclip, Upload } from 'lucide-react';
import { api } from '../../api/endpoints';
import { ApiException } from '../../api/client';
import type { ChatConversationSummary, ChatMessageShape, ChatOversightItem } from '../../api/schemas';
import { store } from '../../store/state';
import { useToast } from '../common/ToastSystem';
import { AttachmentCard } from './AttachmentCard';
import { ChatComposer, type ChatComposerHandle } from './ChatComposer';
import { dayKey, dayLabel, formatBytes, orgBadge, orgTypeMeta, roleTitle, timeLabel } from './chatUtils';

const POLL_MS = 5000;
const GROUP_GAP_MS = 5 * 60_000;

/**
 * - peer: my organization ↔ another organization (send / read receipts; auditor = read-only).
 * - oversight: a conversation between two OTHER organizations (officials / auditor, read-only).
 */
export type ThreadMode =
  | { kind: 'peer'; conv: ChatConversationSummary; myOrgId: string; canSend: boolean }
  | { kind: 'oversight'; item: ChatOversightItem };

interface Props {
  mode: ThreadMode;
  isAr: boolean;
  /** Mobile: back to the list. */
  onBack?: () => void;
  /** Something changed (sent / read) — parent refreshes the list. */
  onActivity: () => void;
}

interface Pending { id: string; body: string; files: { name: string; size: number }[] }
interface Page { data: ChatMessageShape[]; hasMore: boolean; myRead: string; peerRead: string }

export const ChatThread: React.FC<Props> = ({ mode, isAr, onBack, onActivity }) => {
  const { toast } = useToast();
  const meId = store.currentUser.id;
  const isPeer = mode.kind === 'peer';
  const threadKey = mode.kind === 'peer' ? `p:${mode.conv.orgId}` : `o:${mode.item.conversationId}`;
  const canSend = mode.kind === 'peer' && mode.canSend;
  // Alignment: my org (peer mode) / orgB (oversight) on the «end» side.
  const endOrgId = mode.kind === 'peer' ? mode.myOrgId : mode.item.orgB.id;

  const [messages, setMessages] = useState<ChatMessageShape[]>([]);
  const [peerRead, setPeerRead] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [newBelow, setNewBelow] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const atBottomRef = useRef(true);
  const restoreFromBottomRef = useRef<number | null>(null);
  const scrollIntentRef = useRef<'bottom' | 'unread' | null>(null);
  const messagesRef = useRef<ChatMessageShape[]>([]);
  messagesRef.current = messages;
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const peerName = mode.kind === 'peer' ? (isAr ? mode.conv.orgNameAr : (mode.conv.orgNameEn || mode.conv.orgNameAr)) : '';

  /** One fetcher for both modes → normalized page. */
  const fetchPage = useCallback(async (q: { before?: string; after?: string; limit?: number }): Promise<Page> => {
    const m = modeRef.current;
    if (m.kind === 'peer') {
      const r = await api.listChatMessages(m.conv.orgId, q);
      return { data: r.data, hasMore: r.hasMore, myRead: r.myLastReadAt, peerRead: r.peerLastReadAt };
    }
    const r = await api.listOversightMessages(m.item.conversationId, q);
    return { data: r.data, hasMore: r.hasMore, myRead: '', peerRead: '' };
  }, []);

  const merge = useCallback((incoming: ChatMessageShape[]) => {
    if (!incoming.length) return;
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id));
      const add = incoming.filter(m => !seen.has(m.id));
      return add.length ? [...prev, ...add] : prev;
    });
  }, []);

  const markRead = useCallback(async () => {
    const m = modeRef.current;
    if (m.kind !== 'peer' || !m.canSend) return; // read-only viewers never consume the org's unread
    try {
      const r = await api.markChatRead(m.conv.orgId);
      setPeerRead(r.data.peerLastReadAt);
      store.clearChatUnread(m.conv.orgId);
      activityRef.current();
    } catch { /* next poll retries */ }
  }, []);

  const scrollToBottom = (smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  // ── Initial load per thread ───────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const m = modeRef.current;
    if (m.kind === 'peer') store.chatActiveOrgId = m.conv.orgId;
    setMessages([]); setPending(null); setError(null); setNewBelow(0); setFirstUnreadId(null); setPeerRead('');
    setLoading(true);
    fetchPage({ limit: 30 })
      .then(r => {
        if (!alive) return;
        const myOrg = m.kind === 'peer' ? m.myOrgId : '';
        const firstUnread = m.kind === 'peer'
          ? r.data.find(x => x.senderOrgId !== myOrg && x.createdAt > r.myRead)
          : undefined;
        setMessages(r.data);
        setPeerRead(r.peerRead);
        setHasMore(r.hasMore);
        setFirstUnreadId(firstUnread?.id ?? null);
        scrollIntentRef.current = firstUnread ? 'unread' : 'bottom';
        if (firstUnread) void markRead();
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof ApiException ? (isAr ? e.apiError.messageAr : e.apiError.messageEn) : (isAr ? 'تعذر تحميل المحادثة.' : 'Could not load conversation.'));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
      if (m.kind === 'peer' && store.chatActiveOrgId === m.conv.orgId) store.chatActiveOrgId = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey]);

  // ── Scroll positioning after renders ──────────────────────────────────────
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreFromBottomRef.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFromBottomRef.current;
      restoreFromBottomRef.current = null;
      return;
    }
    if (scrollIntentRef.current === 'unread') {
      const divider = el.querySelector('.chat-unread-divider') as HTMLElement | null;
      if (divider) el.scrollTop = Math.max(0, divider.offsetTop - 24);
      else scrollToBottom();
      scrollIntentRef.current = null;
    } else if (scrollIntentRef.current === 'bottom') {
      scrollToBottom();
      scrollIntentRef.current = null;
    }
  }, [messages, pending, loading]);

  // ── Polling for new messages + read receipts ──────────────────────────────
  useEffect(() => {
    if (loading || error) return;
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      const list = messagesRef.current;
      const lastId = list[list.length - 1]?.id;
      try {
        const r = await fetchPage(lastId ? { after: lastId } : { limit: 30 });
        if (!alive) return;
        setPeerRead(prev => (prev === r.peerRead ? prev : r.peerRead));
        const known = new Set(list.map(x => x.id));
        const fresh = r.data.filter(x => !known.has(x.id));
        if (!fresh.length) return;
        const fromOther = fresh.filter(x => x.senderOrgId !== endOrgId).length;
        if (atBottomRef.current) scrollIntentRef.current = 'bottom';
        else if (fromOther) setNewBelow(n => n + fromOther);
        merge(fresh);
        if (fromOther && atBottomRef.current) void markRead();
      } catch { /* transient — next tick */ }
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [threadKey, endOrgId, loading, error, merge, markRead, fetchPage]);

  const loadOlder = useCallback(async () => {
    const first = messagesRef.current[0];
    const el = scrollRef.current;
    if (!first || !el || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const r = await fetchPage({ before: first.id, limit: 30 });
      restoreFromBottomRef.current = el.scrollHeight - el.scrollTop;
      setMessages(prev => {
        const seen = new Set(prev.map(m => m.id));
        return [...r.data.filter(m => !seen.has(m.id)), ...prev];
      });
      setHasMore(r.hasMore);
    } catch {
      toast('error', isAr ? 'تعذر تحميل الرسائل الأقدم.' : 'Could not load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  }, [fetchPage, loadingOlder, toast, isAr]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottomRef.current && newBelow > 0) {
      setNewBelow(0);
      void markRead();
    }
    if (el.scrollTop < 40 && hasMore && !loadingOlder) void loadOlder();
  };

  const send = async (body: string, files: File[]): Promise<boolean> => {
    if (mode.kind !== 'peer') return false;
    setPending({ id: `pending-${Date.now()}`, body, files: files.map(f => ({ name: f.name, size: f.size })) });
    scrollIntentRef.current = 'bottom';
    try {
      const r = await api.sendChatMessage(mode.conv.orgId, body, files);
      setPending(null);
      setFirstUnreadId(null);
      setNewBelow(0);
      scrollIntentRef.current = 'bottom';
      merge([r.data]);
      store.clearChatUnread(mode.conv.orgId);
      activityRef.current();
      return true;
    } catch (e) {
      setPending(null);
      toast('error', e instanceof ApiException ? (isAr ? e.apiError.messageAr : e.apiError.messageEn) : (isAr ? 'تعذر إرسال الرسالة.' : 'Message not sent.'));
      return false;
    }
  };

  // ── Drag & drop anywhere on the thread (senders only) ─────────────────────
  const hasFiles = (e: React.DragEvent) => canSend && Array.from(e.dataTransfer.types).includes('Files');
  const onDragOver = (e: React.DragEvent) => { if (hasFiles(e)) { e.preventDefault(); setDragOver(true); } };
  const onDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragOver(false);
    composerRef.current?.addFiles(e.dataTransfer.files);
    composerRef.current?.focus();
  };

  const rendered = useMemo(() => {
    const out: React.ReactNode[] = [];
    let lastDay = '';
    let prev: ChatMessageShape | null = null;
    for (const m of messages) {
      const dk = dayKey(m.createdAt);
      if (dk !== lastDay) {
        out.push(<div key={`d-${dk}`} className="chat-day"><span>{dayLabel(m.createdAt, isAr)}</span></div>);
        lastDay = dk;
        prev = null;
      }
      if (m.id === firstUnreadId) {
        out.push(<div key="unread-divider" className="chat-unread-divider"><span>{isAr ? 'رسائل جديدة' : 'New messages'}</span></div>);
        prev = null;
      }
      const mine = m.senderOrgId === endOrgId;
      const grouped = !!prev && prev.senderUserId === m.senderUserId
        && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP_MS;
      const personName = isAr ? m.senderName : (m.senderNameEn || m.senderName);
      // Peer mode: my colleagues by name, the other side with role; oversight: always name · organization.
      const showSender = !grouped && (!isPeer || !mine || m.senderUserId !== meId);
      const senderLine = !isPeer
        ? `${personName} · ${m.senderOrgNameAr}`
        : mine ? personName : `${personName} · ${roleTitle(m.senderRole, isAr)}`;
      const read = isPeer && mine && !!peerRead && m.createdAt <= peerRead;
      out.push(
        <div key={m.id} className={`chat-msg ${mine ? 'mine' : 'theirs'}${grouped ? ' grouped' : ''}`}>
          <div className="chat-bubble">
            {showSender && <div className="chat-sender">{senderLine}</div>}
            {m.body && <div className="chat-text" dir="auto">{m.body}</div>}
            {m.attachments.length > 0 && (
              <div className="chat-atts">
                {m.attachments.map(a => <AttachmentCard key={a.id} att={a} isAr={isAr} mine={mine} />)}
              </div>
            )}
            <div className="chat-meta">
              <span>{timeLabel(m.createdAt, isAr)}</span>
              {isPeer && mine && (read
                ? <CheckCheck size={14} className="chat-tick read" aria-label={isAr ? 'تمت القراءة' : 'Read'} />
                : <Check size={14} className="chat-tick" aria-label={isAr ? 'تم الإرسال' : 'Sent'} />)}
            </div>
          </div>
        </div>,
      );
      prev = m;
    }
    return out;
  }, [messages, firstUnreadId, endOrgId, isPeer, isAr, meId, peerRead]);

  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const header = mode.kind === 'peer' ? (() => {
    const meta = orgTypeMeta(mode.conv.orgType);
    return (
      <>
        <span className="chat-org-badge chat-org-badge--lg">{orgBadge(mode.conv.orgCode, mode.conv.orgNameEn).slice(0, 4)}</span>
        <div className="chat-thread-title">
          <strong>{peerName}</strong>
          <span className="chat-thread-sub">
            <span>{isAr ? meta.ar : meta.en}</span>
            {mode.conv.contactEmail && <span className="chat-sub-item" dir="ltr"><Mail size={12} />{mode.conv.contactEmail}</span>}
          </span>
        </div>
      </>
    );
  })() : (
    <>
      <span className="chat-pair-badges">
        <span className="chat-org-badge">{orgBadge(mode.item.orgA.code, mode.item.orgA.nameEn).slice(0, 4)}</span>
        <span className="chat-org-badge">{orgBadge(mode.item.orgB.code, mode.item.orgB.nameEn).slice(0, 4)}</span>
      </span>
      <div className="chat-thread-title">
        <strong>{isAr ? `${mode.item.orgA.nameAr} ↔ ${mode.item.orgB.nameAr}` : `${mode.item.orgA.nameEn} ↔ ${mode.item.orgB.nameEn}`}</strong>
        <span className="chat-thread-sub">
          <span className="chat-sub-item"><Eye size={12} />{isAr ? 'اطلاع فقط — محادثة بين جهتين' : 'View only — conversation between two organizations'}</span>
        </span>
      </div>
    </>
  );

  return (
    <section
      className={`chat-thread${dragOver ? ' is-drag' : ''}`}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={mode.kind === 'peer' ? peerName : 'oversight'}
    >
      <header className="chat-thread-head">
        {onBack && (
          <button type="button" className="btn btn-secondary chat-round-btn chat-back" onClick={onBack} aria-label={isAr ? 'رجوع' : 'Back'}>
            <BackIcon size={18} />
          </button>
        )}
        {header}
      </header>

      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {loading ? (
          <div className="chat-state"><Loader2 size={20} className="chat-spin" /><span>{isAr ? 'جارٍ تحميل المحادثة…' : 'Loading conversation…'}</span></div>
        ) : error ? (
          <div className="chat-state"><div className="error-box">{error}</div></div>
        ) : (
          <>
            {hasMore && (
              <div className="chat-older">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadOlder()} disabled={loadingOlder} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {loadingOlder ? <Loader2 size={14} className="chat-spin" /> : null}
                  <span>{isAr ? 'عرض الرسائل الأقدم' : 'Load older messages'}</span>
                </button>
              </div>
            )}
            {messages.length === 0 && !pending && (
              <div className="chat-state">
                <span className="chat-state-icon"><MessagesSquare size={26} /></span>
                <strong>{isPeer ? (isAr ? `ابدأ المحادثة مع ${peerName}` : `Start the conversation with ${peerName}`) : (isAr ? 'لا توجد رسائل' : 'No messages')}</strong>
                {isPeer && (
                  <span>{isAr
                    ? 'ستصل للجهة إشعارات فورية داخل المنصة، وتذكير بالبريد إن لم تُقرأ الرسالة خلال 15 دقيقة.'
                    : 'The organization is notified in-app, with an email reminder if unread after 15 minutes.'}</span>
                )}
              </div>
            )}
            {rendered}
            {pending && (
              <div className="chat-msg mine pending">
                <div className="chat-bubble">
                  {pending.body && <div className="chat-text" dir="auto">{pending.body}</div>}
                  {pending.files.map(f => (
                    <div key={f.name} className="chat-att"><span className="chat-att-icon"><Paperclip size={16} /></span>
                      <span className="chat-att-meta"><span className="chat-att-name">{f.name}</span><small>{formatBytes(f.size)}</small></span>
                    </div>
                  ))}
                  <div className="chat-meta"><span>{isAr ? 'جارٍ الإرسال' : 'Sending'}</span><Clock size={13} className="chat-tick" /></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {newBelow > 0 && (
        <button type="button" className="btn btn-primary btn-sm chat-jump" onClick={() => { scrollToBottom(true); setNewBelow(0); void markRead(); }}>
          <ArrowDown size={14} />
          <span>{isAr ? `${newBelow} رسالة جديدة` : `${newBelow} new`}</span>
        </button>
      )}

      {dragOver && (
        <div className="chat-drop">
          <Upload size={30} />
          <strong>{isAr ? 'أفلت الملفات هنا لإرفاقها' : 'Drop files to attach'}</strong>
          <small>{isAr ? 'PDF، صور، Word، Excel، PowerPoint — حتى 20 ميجا للملف' : 'PDF, images, Word, Excel, PowerPoint — up to 20 MB each'}</small>
        </div>
      )}

      {!error && (canSend ? (
        <ChatComposer
          ref={composerRef}
          isAr={isAr}
          onSend={send}
          placeholder={isAr ? `اكتب رسالة إلى ${peerName}…` : `Message ${peerName}…`}
        />
      ) : (
        <div className="chat-readonly">
          <Eye size={15} />
          <span>{isPeer
            ? (isAr ? 'حسابك للاطلاع فقط ولا يمكنه الإرسال.' : 'Your account is view-only.')
            : (isAr ? 'اطلاع فقط — الإدارة تتابع المحادثات بين الجهات دون المشاركة فيها.' : 'View only — officials follow conversations between organizations without taking part.')}</span>
        </div>
      ))}
    </section>
  );
};
