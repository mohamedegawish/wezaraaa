import React, { useEffect, useRef } from 'react';
import { store, usePlatformStore } from '../../store/state';
import { useToast } from '../common/ToastSystem';
import type { ChatUnreadSummary } from '../../api/schemas';

// مُشغّل إشعارات مركز المراسلات (بدون واجهة) — يُركَّب مرة واحدة داخل ToastProvider.
// polling كل 20 ثانية والتبويب ظاهر (دقيقة وهو مخفي) + فوراً عند العودة للتبويب.
// عند وصول رسالة جديدة: Toast بزر «فتح» + إشعار سطح المكتب (إن سمح المستخدم) + عداد في عنوان التبويب.
const POLL_VISIBLE_MS = 20_000;
const POLL_HIDDEN_MS = 60_000;
const SESSION_KEY = 'egypt_ind_chat_unread_hint';

function setTitleCount(n: number) {
  const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
  document.title = n > 0 ? `(${n > 99 ? '99+' : n}) ${base}` : base;
}

function desktopNotify(title: string, body: string, tag: string, onClick: () => void) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    // Deliberately no message text — lock screens are not a safe place for government correspondence.
    const n = new Notification(title, { body, tag, icon: '/ministry-industry-logo.png' });
    n.onclick = () => { window.focus(); onClick(); n.close(); };
  } catch { /* unsupported (e.g. iOS Safari) */ }
}

export const ChatNotifier: React.FC = () => {
  const { currentUser, isLoggedIn } = usePlatformStore();
  const { toast } = useToast();
  const prevRef = useRef<ChatUnreadSummary | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    prevRef.current = null;
    if (!store.canUseChat()) {
      setTitleCount(0);
      return;
    }
    let stopped = false;

    const handle = (next: ChatUnreadSummary) => {
      const isAr = store.language === 'ar';
      const prev = prevRef.current;
      prevRef.current = next;
      setTitleCount(next.total);

      if (!prev) {
        // First load of the session: one gentle hint, not a toast per conversation.
        let hinted = false;
        try { hinted = sessionStorage.getItem(SESSION_KEY) === '1'; } catch { /* ignore */ }
        if (next.total > 0 && !hinted && store.activeView !== 'chat') {
          try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
          toastRef.current(
            'info',
            isAr ? `لديك ${next.total} رسالة غير مقروءة في مركز المراسلات` : `You have ${next.total} unread message(s) in the message center`,
            7000,
            { label: isAr ? 'فتح' : 'Open', onClick: () => store.openChat() },
          );
        }
        return;
      }

      const prevAt = new Map(prev.items.map(i => [i.orgId, i.lastMessageAt]));
      const fresh = next.items.filter(i => i.lastMessageAt > (prevAt.get(i.orgId) ?? ''));
      for (const item of fresh.slice(0, 3)) {
        const viewingIt = store.activeView === 'chat' && store.chatActiveOrgId === item.orgId && !document.hidden;
        if (viewingIt) continue;
        const from = isAr ? item.orgNameAr : (item.orgNameEn || item.orgNameAr);
        const open = () => store.openChat(item.orgId);
        toastRef.current('info', isAr ? `رسالة جديدة من ${from}` : `New message from ${from}`, 7000, { label: isAr ? 'فتح' : 'Open', onClick: open });
        desktopNotify(
          isAr ? `رسالة جديدة — ${from}` : `New message — ${from}`,
          isAr ? `لديك ${item.unread} رسالة غير مقروءة في مركز المراسلات` : `${item.unread} unread message(s) in the message center`,
          `chat-${item.orgId}`,
          open,
        );
      }
    };

    const tick = async () => {
      if (stopped) return;
      const next = await store.refreshChatUnread();
      if (next && !stopped) handle(next);
    };

    void tick();
    const fast = window.setInterval(() => { if (!document.hidden) void tick(); }, POLL_VISIBLE_MS);
    const slow = window.setInterval(() => { if (document.hidden) void tick(); }, POLL_HIDDEN_MS);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(fast);
      window.clearInterval(slow);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [currentUser.id, currentUser.role, isLoggedIn]);

  return null;
};
