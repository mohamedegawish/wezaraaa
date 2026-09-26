import React, { useEffect, useState } from 'react';
import { Bell, MessagesSquare, MonitorSmartphone } from 'lucide-react';
import { usePlatformStore } from '../../store/state';
import { orgBadge, relativeTime } from './chatUtils';

// إشعارات مركز المراسلات داخل زر الحساب في الهيدر — بلا أي عنصر إضافي يغيّر عرض الشريط العلوي.
// ChatUnreadBadge: عداد صغير فوق الصورة الرمزية · AccountNotifications: قسم «الإشعارات» داخل قائمة الحساب.

/** Red count bubble on the account avatar (renders nothing when there is nothing unread). */
export const ChatUnreadBadge: React.FC = () => {
  const { chatUnread, canUseChat } = usePlatformStore();
  const total = chatUnread?.total ?? 0;
  if (!canUseChat() || total === 0) return null;
  return (
    <span
      aria-label={`${total}`}
      style={{
        position: 'absolute', top: '-6px', insetInlineEnd: '-8px',
        minWidth: '17px', height: '17px', padding: '0 4px', borderRadius: '999px',
        background: 'var(--egypt-red)', color: '#FFFFFF', border: '2px solid #FFFFFF',
        fontSize: '0.6rem', fontWeight: 800, lineHeight: '13px', textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      {total > 99 ? '99+' : total}
    </span>
  );
};

const rowStyle = (isAr: boolean): React.CSSProperties => ({
  width: '100%', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem',
  borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer',
  textAlign: isAr ? 'right' : 'left',
});

/** «الإشعارات» section inside the account dropdown — same look as the menu's other rows. */
export const AccountNotifications: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => {
  const { language, chatUnread, canUseChat, openChat, refreshChatUnread } = usePlatformStore();
  const isAr = language === 'ar';
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(
    () => ('Notification' in window ? Notification.permission : 'unsupported'),
  );
  const eligible = canUseChat();

  useEffect(() => { if (eligible) void refreshChatUnread(); }, [eligible, refreshChatUnread]);

  if (!eligible) return null;

  const total = chatUnread?.total ?? 0;
  const items = (chatUnread?.items ?? []).slice(0, 4);
  const go = (orgId?: string) => { onNavigate(); openChat(orgId); };

  return (
    <div style={{ padding: '0.4rem', borderBottom: '1px solid #EAECF0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.85rem 0.25rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 800, color: '#64748B' }}>
          <Bell size={13} />
          {isAr ? 'الإشعارات' : 'Notifications'}
        </span>
        {total > 0 && (
          <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'var(--egypt-red-soft)', color: 'var(--egypt-red)', border: '1px solid var(--gov-gold-border)' }}>
            {isAr ? `${total} جديدة` : `${total} new`}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '0.35rem 0.85rem 0.55rem', fontSize: '0.75rem', color: '#94A3B8' }}>
          {isAr ? 'لا توجد رسائل جديدة.' : 'No new messages.'}
        </div>
      ) : items.map(i => {
        const name = isAr ? i.orgNameAr : (i.orgNameEn || i.orgNameAr);
        return (
          <button key={i.orgId} type="button" onClick={() => go(i.orgId)} style={rowStyle(isAr)} className="header-notif-row">
            <span style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>
              {orgBadge(i.orgCode, i.orgNameEn).slice(0, 4)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#101828', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                <span style={{ fontSize: '0.66rem', color: '#94A3B8', flexShrink: 0 }}>{relativeTime(i.lastMessageAt, isAr)}</span>
              </span>
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {i.lastMessagePreview}
              </span>
            </span>
            <span style={{ minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: 'var(--egypt-red)', color: '#FFFFFF', fontSize: '0.62rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {i.unread}
            </span>
          </button>
        );
      })}

      <button type="button" onClick={() => go()} style={{ ...rowStyle(isAr), padding: '0.6rem 0.85rem', color: '#101828', fontSize: '0.825rem', fontWeight: 600 }} className="header-notif-row">
        <MessagesSquare size={15} style={{ color: '#475569' }} />
        <span style={{ flex: 1 }}>{isAr ? 'مركز المراسلات' : 'Message Center'}</span>
      </button>

      {perm === 'default' && (
        <button
          type="button"
          onClick={async () => { try { setPerm(await Notification.requestPermission()); } catch { /* ignore */ } }}
          style={{ ...rowStyle(isAr), color: '#1D4ED8', fontSize: '0.75rem', fontWeight: 600 }}
          className="header-notif-row"
        >
          <MonitorSmartphone size={14} />
          <span>{isAr ? 'تفعيل إشعارات سطح المكتب' : 'Enable desktop notifications'}</span>
        </button>
      )}
    </div>
  );
};
