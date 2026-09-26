import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Loader2, MessagesSquare } from 'lucide-react';
import { api } from '../../api/endpoints';
import { ApiException } from '../../api/client';
import type { ChatConversationSummary, ChatOversightItem } from '../../api/schemas';
import { usePlatformStore } from '../../store/state';
import { AdminPageHeader } from '../admin/AdminLayout';
import { ErrorBox } from '../ui/ErrorBox';
import { ChatThread } from './ChatThread';
import { ConversationList } from './ConversationList';
import { OversightList } from './OversightList';

const LIST_REFRESH_MS = 15_000;

// مركز المراسلات — كل جهة تراسل أي جهة أخرى (محادثات ثنائية)، والإدارة/المدقق يطّلعون على محادثات الجهات.
// نفس هيكل صفحات الإدارة (container-custom + AdminPageHeader + card).
export const ChatCenterView: React.FC = () => {
  const { language, chatUnread, consumeChatFocus } = usePlatformStore();
  const isAr = language === 'ar';
  const [myOrgId, setMyOrgId] = useState('');
  const [canSend, setCanSend] = useState(true);
  const [canOversee, setCanOversee] = useState(false);
  const [tab, setTab] = useState<'mine' | 'oversight'>('mine');
  const [directory, setDirectory] = useState<ChatConversationSummary[]>([]);
  const [oversight, setOversight] = useState<ChatOversightItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedOversight, setSelectedOversight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Lazy init: consume the notification target exactly once on mount (a plain useRef(arg) would re-run every render).
  const [initialFocus] = useState(() => consumeChatFocus());
  const focusRef = useRef<string | null>(initialFocus);

  const load = useCallback(async () => {
    try {
      const r = await api.listChatConversations();
      setMyOrgId(r.orgId);
      setCanSend(r.canSend);
      setCanOversee(r.canOversee);
      setDirectory(r.data);
      setError(null);
      setSelected(cur => {
        const focus = focusRef.current;
        focusRef.current = null;
        if (focus && r.data.some(c => c.orgId === focus)) return focus;
        return cur;
      });
      if (r.canOversee) {
        try { setOversight((await api.listChatOversight()).data); } catch { /* keep previous */ }
      }
    } catch (e) {
      setError(e instanceof ApiException ? (isAr ? e.apiError.messageAr : e.apiError.messageEn) : (isAr ? 'تعذر تحميل المراسلات.' : 'Could not load conversations.'));
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => { void load(); }, [load]);

  // Notification click while already on this page → jump to that conversation.
  useEffect(() => {
    const focus = consumeChatFocus();
    if (focus && directory.some(c => c.orgId === focus)) { setTab('mine'); setSelected(focus); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  // Keep previews/badges fresh: periodic + whenever the global unread summary changes.
  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) void load(); }, LIST_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);
  const unreadSig = `${chatUnread?.total ?? 0}|${chatUnread?.items.map(i => i.lastMessageAt).join(',') ?? ''}`;
  useEffect(() => { if (!loading) void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [unreadSig]);

  const current = directory.find(c => c.orgId === selected) ?? null;
  const currentOversight = oversight.find(o => o.conversationId === selectedOversight) ?? null;
  const showingOversight = canOversee && tab === 'oversight';
  const hasThread = showingOversight ? !!currentOversight : !!current;

  const emptyState = (
    <section className="chat-thread">
      <div className="chat-state">
        <span className="chat-state-icon">{showingOversight ? <Eye size={26} /> : <MessagesSquare size={26} />}</span>
        <strong>{showingOversight
          ? (isAr ? 'اختر محادثة للاطلاع عليها' : 'Select a conversation to view')
          : (isAr ? 'اختر جهة من القائمة لبدء المراسلة' : 'Select an organization to start messaging')}</strong>
        <span>{showingOversight
          ? (isAr ? 'المحادثات المباشرة بين الجهات — اطلاع فقط دون مشاركة.' : 'Direct conversations between organizations — view only.')
          : (isAr ? 'يمكنكم مراسلة أي جهة مشاركة في المنصة مباشرة. الجهات التي لديها رسائل غير مقروءة تظهر أولاً.' : 'Message any organization directly. Unread conversations are listed first.')}</span>
      </div>
    </section>
  );

  return (
    <div className="container-custom" style={{ padding: '2rem 1.5rem 3rem 1.5rem' }}>
      <AdminPageHeader
        title={isAr ? 'مركز المراسلات' : 'Message Center'}
        description={isAr
          ? 'تواصل مباشر بين الجهات الحكومية والشركاء ووزارة الصناعة — رسائل وملفات، مع إشعار فوري وتذكير تلقائي بالبريد عند عدم القراءة.'
          : 'Direct messaging between government entities, partners and the Ministry — files, instant notifications and email reminders.'}
        actions={canOversee ? (
          <div className="chat-tabs-top" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'mine'} className={`btn btn-sm ${tab === 'mine' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('mine')}>
              <MessagesSquare size={14} />
              <span>{isAr ? 'مراسلات جهتي' : 'My conversations'}</span>
              {(chatUnread?.total ?? 0) > 0 && <span className="chat-count-pill">{chatUnread?.total}</span>}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'oversight'} className={`btn btn-sm ${tab === 'oversight' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('oversight')}>
              <Eye size={14} />
              <span>{isAr ? 'محادثات الجهات (اطلاع)' : 'Entity conversations (view)'}</span>
            </button>
          </div>
        ) : undefined}
      />

      <ErrorBox message={error} style={{ marginBottom: '1rem' }} />

      {loading ? (
        <div className="card chat-card chat-card--state">
          <Loader2 size={20} className="chat-spin" />
          <span>{isAr ? 'جارٍ تحميل المراسلات…' : 'Loading conversations…'}</span>
        </div>
      ) : !error && (
        <div className={`card chat-card${hasThread ? ' has-thread' : ''}`}>
          {showingOversight ? (
            <>
              <OversightList items={oversight} selectedId={selectedOversight} onSelect={setSelectedOversight} isAr={isAr} />
              {currentOversight
                ? <ChatThread key={`o-${currentOversight.conversationId}`} mode={{ kind: 'oversight', item: currentOversight }} isAr={isAr} onBack={() => setSelectedOversight(null)} onActivity={() => void load()} />
                : emptyState}
            </>
          ) : (
            <>
              <ConversationList conversations={directory} selectedOrgId={selected} onSelect={setSelected} isAr={isAr} />
              {current
                ? <ChatThread key={`p-${current.orgId}`} mode={{ kind: 'peer', conv: current, myOrgId, canSend }} isAr={isAr} onBack={() => setSelected(null)} onActivity={() => void load()} />
                : emptyState}
            </>
          )}
        </div>
      )}
    </div>
  );
};
