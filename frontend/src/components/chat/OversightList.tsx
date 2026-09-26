import React, { useMemo, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import type { ChatOversightItem } from '../../api/schemas';
import { orgBadge, shortWhen } from './chatUtils';

interface Props {
  items: ChatOversightItem[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  isAr: boolean;
}

// «محادثات الجهات» — المحادثات بين الجهات الأخرى فيما بينها (اطلاع الإدارة/المدقق — قراءة فقط).
export const OversightList: React.FC<Props> = ({ items, selectedId, onSelect, isAr }) => {
  const [q, setQ] = useState('');
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(i => [i.orgA.nameAr, i.orgA.nameEn, i.orgA.code, i.orgB.nameAr, i.orgB.nameEn, i.orgB.code]
      .some(v => v.toLowerCase().includes(needle)));
  }, [items, q]);

  return (
    <aside className="chat-list" aria-label={isAr ? 'محادثات الجهات' : 'Entity conversations'}>
      <div className="chat-list-head">
        <h2 className="chat-panel-title">
          <Eye size={18} />
          {isAr ? `محادثات الجهات (${items.length})` : `Entity conversations (${items.length})`}
        </h2>
        <div className="chat-readonly chat-readonly--inline">
          {isAr ? 'اطلاع فقط على المراسلات المباشرة بين الجهات.' : 'View-only access to direct conversations between organizations.'}
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', insetInlineStart: '0.8rem', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={isAr ? 'بحث باسم أي من الجهتين...' : 'Search either organization...'}
            style={{ paddingInlineStart: '2.4rem' }}
          />
        </div>
      </div>

      <ul className="chat-list-items">
        {visible.length === 0 && (
          <li className="chat-list-empty">{isAr ? 'لا توجد محادثات بين الجهات بعد.' : 'No conversations between organizations yet.'}</li>
        )}
        {visible.map(i => {
          const active = i.conversationId === selectedId;
          return (
            <li key={i.conversationId}>
              <button type="button" className={`chat-list-item${active ? ' active' : ''}`} onClick={() => onSelect(i.conversationId)} aria-current={active ? 'true' : undefined}>
                <span className="chat-pair-badges">
                  <span className="chat-org-badge">{orgBadge(i.orgA.code, i.orgA.nameEn).slice(0, 4)}</span>
                  <span className="chat-org-badge">{orgBadge(i.orgB.code, i.orgB.nameEn).slice(0, 4)}</span>
                </span>
                <span className="chat-list-main">
                  <span className="chat-list-row">
                    <strong title={`${i.orgA.nameAr} ↔ ${i.orgB.nameAr}`}>{isAr ? `${i.orgA.nameAr} ↔ ${i.orgB.nameAr}` : `${i.orgA.nameEn} ↔ ${i.orgB.nameEn}`}</strong>
                    <small>{shortWhen(i.lastMessageAt, isAr)}</small>
                  </span>
                  <span className="chat-list-row">
                    <span className="chat-list-preview">{i.lastMessagePreview}</span>
                    <span className="chat-count-muted">{i.messageCount}</span>
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
