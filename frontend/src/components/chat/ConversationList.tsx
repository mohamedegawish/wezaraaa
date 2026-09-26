import React, { useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import type { ChatConversationSummary } from '../../api/schemas';
import { ORG_TYPE_META, orgBadge, orgTypeMeta, shortWhen } from './chatUtils';

interface Props {
  conversations: ChatConversationSummary[];
  selectedOrgId: string | null;
  onSelect: (orgId: string) => void;
  isAr: boolean;
}

// دليل الجهات (لكل الجهات) — نفس عناصر صفحة «الجهات والحسابات»: بحث form-control + فلتر نوع + أزرار btn-sm.
export const ConversationList: React.FC<Props> = ({ conversations, selectedOrgId, onSelect, isAr }) => {
  const [q, setQ] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [type, setType] = useState<string>('ALL');

  const unreadCount = conversations.filter(c => c.unread > 0).length;
  const types = useMemo(() => Object.keys(ORG_TYPE_META).filter(t => conversations.some(c => c.orgType === t)), [conversations]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return conversations.filter(c => {
      if (onlyUnread && c.unread === 0) return false;
      if (type !== 'ALL' && c.orgType !== type) return false;
      if (!needle) return true;
      return [c.orgNameAr, c.orgNameEn, c.orgCode, c.contactEmail].some(v => v.toLowerCase().includes(needle));
    });
  }, [conversations, q, onlyUnread, type]);

  return (
    <aside className="chat-list" aria-label={isAr ? 'الجهات' : 'Organizations'}>
      <div className="chat-list-head">
        <h2 className="chat-panel-title">
          <Building2 size={18} />
          {isAr ? `الجهات (${conversations.length})` : `Organizations (${conversations.length})`}
        </h2>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.8rem', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو الكود...' : 'Search name or code...'}
            style={{ paddingInlineStart: '2.4rem' }}
          />
        </div>
        <div className="chat-filters">
          <button type="button" className={`btn btn-sm ${!onlyUnread ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOnlyUnread(false)}>
            {isAr ? 'الكل' : 'All'}
          </button>
          <button type="button" className={`btn btn-sm ${onlyUnread ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setOnlyUnread(true)}>
            {isAr ? 'غير مقروءة' : 'Unread'}
            {unreadCount > 0 && <span className="chat-count-pill">{unreadCount}</span>}
          </button>
          {types.length > 1 && (
            <select className="form-control chat-type-select" value={type} onChange={e => setType(e.target.value)} aria-label={isAr ? 'نوع الجهة' : 'Type'}>
              <option value="ALL">{isAr ? 'كل الأنواع' : 'All types'}</option>
              {types.map(t => <option key={t} value={t}>{isAr ? orgTypeMeta(t).ar : orgTypeMeta(t).en}</option>)}
            </select>
          )}
        </div>
      </div>

      <ul className="chat-list-items">
        {visible.length === 0 && (
          <li className="chat-list-empty">{onlyUnread ? (isAr ? 'لا توجد رسائل غير مقروءة.' : 'No unread messages.') : (isAr ? 'لا توجد جهات مطابقة.' : 'No organizations found.')}</li>
        )}
        {visible.map(c => {
          const m = orgTypeMeta(c.orgType);
          const active = c.orgId === selectedOrgId;
          return (
            <li key={c.orgId}>
              <button
                type="button"
                className={`chat-list-item${active ? ' active' : ''}${c.unread ? ' unread' : ''}`}
                onClick={() => onSelect(c.orgId)}
                aria-current={active ? 'true' : undefined}
              >
                <span className="chat-org-badge">{orgBadge(c.orgCode, c.orgNameEn).slice(0, 4)}</span>
                <span className="chat-list-main">
                  <span className="chat-list-row">
                    <strong title={isAr ? c.orgNameAr : c.orgNameEn}>{isAr ? c.orgNameAr : c.orgNameEn}</strong>
                    {c.orgId === 'org-ministry' && <span className="chat-org-tag">{isAr ? 'إدارة المنصة' : 'Officials'}</span>}
                    {c.lastMessageAt && <small>{shortWhen(c.lastMessageAt, isAr)}</small>}
                  </span>
                  <span className="chat-list-row">
                    <span className="chat-list-preview">
                      {c.lastMessagePreview
                        ? <>{c.lastMessageFromMe && <b>{isAr ? 'أنتم: ' : 'You: '}</b>}{c.lastMessagePreview}</>
                        : (isAr ? m.ar : m.en)}
                    </span>
                    {c.unread > 0 && <span className="chat-count-pill">{c.unread > 99 ? '99+' : c.unread}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};
