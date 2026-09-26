import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlatformStore } from '../../store/state';
import { api } from '../../api';
import { ApiException } from '../../api/client';
import type { MessageShape } from '../../api/schemas';
import {
  Send,
  Paperclip,
  Plus,
  Trash2,
  MessagesSquare,
  AlertCircle,
  FileText,
  RotateCw,
} from 'lucide-react';

interface MessagesPanelProps {
  applicationId: string;
}

interface CustomRow {
  key: string;
  value: string;
}

const emptyRow = (): CustomRow => ({ key: '', value: '' });

function errText(err: unknown, isAr: boolean): string {
  if (err instanceof ApiException) return err.apiError.messageAr || err.apiError.messageEn;
  return err instanceof Error ? err.message : (isAr ? 'تعذر تحميل الرسائل.' : 'Failed to load messages.');
}

/** سلسلة مراسلات الجهات حول طلب واحد + مؤلف رسالة جديدة (هوية مصرية RTL/En). */
export const MessagesPanel: React.FC<MessagesPanelProps> = ({ applicationId }) => {
  const { applications, organizations, currentUser, language } = usePlatformStore();
  const isAr = language === 'ar';

  const [messages, setMessages] = useState<MessageShape[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [toOrgId, setToOrgId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [customRows, setCustomRows] = useState<CustomRow[]>([emptyRow()]);
  const [detailsFileId, setDetailsFileId] = useState('');
  const [files, setFiles] = useState<Array<Record<string, unknown>>>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const factoryId = useMemo(
    () => applications.find(a => a.id === applicationId)?.factoryId ?? '',
    [applications, applicationId],
  );

  const orgName = useCallback((orgId: string) => {
    const o = organizations.find(x => x.id === orgId);
    if (!o) return orgId;
    return isAr ? o.nameAr : o.nameEn;
  }, [organizations, isAr]);

  // الجهات المستلمة: نشطة فقط ≠ جهة المرسل، ونستبعد جهات المصانع (مراسلات بين الجهات الرسمية).
  const recipientOptions = useMemo(
    () => organizations.filter(o => o.active && o.id !== currentUser.organizationId && o.type !== 'factory'),
    [organizations, currentUser.organizationId],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const r = await api.listMessages(applicationId);
      setMessages(r.data ?? []);
    } catch (e) {
      setLoadError(errText(e, isAr));
    } finally {
      setLoading(false);
    }
  }, [applicationId, isAr]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const r = await api.listMessages(applicationId);
        if (!cancelled) setMessages(r.data ?? []);
      } catch (e) {
        if (!cancelled) setLoadError(errText(e, isAr));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applicationId, isAr]);

  // ملفات PDF الموجودة للمصنع (للإرفاق) — من الـ API فقط، لا بيانات ثابتة.
  useEffect(() => {
    let cancelled = false;
    if (!factoryId) { setFiles([]); return; }
    api.listDetailsFiles(factoryId)
      .then(r => { if (!cancelled) setFiles((r.data ?? []) as Array<Record<string, unknown>>); })
      .catch(() => { if (!cancelled) setFiles([]); });
    return () => { cancelled = true; };
  }, [factoryId]);

  const handleSend = async () => {
    if (sending) return;
    setSendError('');
    const customFields: Record<string, string> = {};
    for (const row of customRows) {
      const k = row.key.trim();
      if (k) customFields[k] = row.value;
    }
    try {
      setSending(true);
      const r = await api.sendMessage(applicationId, {
        toOrgId,
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        body: body.trim(),
        ...(Object.keys(customFields).length ? { customFields } : {}),
        ...(detailsFileId ? { detailsFileId } : {}),
      });
      setMessages(prev => [...prev, r.data]);
      setSubject('');
      setBody('');
      setCustomRows([emptyRow()]);
      setDetailsFileId('');
      setSendError('');
    } catch (e) {
      setSendError(errText(e, isAr));
    } finally {
      setSending(false);
    }
  };

  const canSend = toOrgId.trim().length > 0 && body.trim().length > 0 && body.trim().length <= 2000 && !sending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── السلسلة ── */}
      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <MessagesSquare size={16} style={{ color: 'var(--gov-gold-dark)' }} />
        <span>{isAr ? `سلسلة المراسلات (${messages.length})` : `Message thread (${messages.length})`}</span>
      </h4>

      {loading && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {isAr ? 'جارٍ تحميل الرسائل...' : 'Loading messages...'}
        </div>
      )}

      {!loading && loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 1rem', background: 'var(--status-rejected-bg, #fef2f2)', border: '1px solid var(--status-rejected-bd, #fecaca)', borderRadius: 'var(--radius-md)', color: 'var(--status-rejected-text, #b91c1c)', fontSize: '0.875rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{loadError}</span>
          <button className="btn btn-secondary btn-sm" onClick={reload}>
            <RotateCw size={14} />
            <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
          </button>
        </div>
      )}

      {!loading && !loadError && messages.length === 0 && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-app)', border: '1px dashed var(--border-medium)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {isAr ? 'لا توجد رسائل بعد — ابدأ التواصل مع الجهات من النموذج أدناه.' : 'No messages yet — start the conversation with the form below.'}
        </div>
      )}

      {!loading && !loadError && messages.map(m => (
        <div key={m.id} style={{ padding: '0.85rem 1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', borderInlineStart: '3px solid var(--gov-gold-dark)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gov-primary-900)' }}>
              {m.fromUserName}
              <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> • {orgName(m.fromOrgId)} ← {orgName(m.toOrgId)}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {new Date(m.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
            </div>
          </div>
          {m.subject && (
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gov-primary-800)', marginBottom: '0.25rem' }}>{m.subject}</div>
          )}
          <div style={{ fontSize: '0.875rem', color: 'var(--text-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
          {m.customFields && Object.keys(m.customFields).length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {Object.entries(m.customFields).map(([k, v]) => (
                <span key={k} style={{ fontSize: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: '999px', padding: '0.15rem 0.6rem', color: 'var(--text-secondary)' }}>
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
          {(m.detailsFile || m.detailsFileId) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--gov-gold-dark)' }}>
              <Paperclip size={14} />
              <span>{String((m.detailsFile as Record<string, unknown> | undefined)?.fileName ?? m.detailsFileId)}</span>
            </div>
          )}
        </div>
      ))}

      {/* ── المؤلف ── */}
      <div style={{ borderTop: '2px solid var(--border-subtle)', paddingTop: '1rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gov-primary-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Send size={15} style={{ color: 'var(--gov-gold-dark)' }} />
          <span>{isAr ? 'رسالة جديدة لجهة رسمية' : 'New message to an entity'}</span>
        </h4>

        {sendError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.9rem', marginBottom: '0.75rem', background: 'var(--status-rejected-bg, #fef2f2)', border: '1px solid var(--status-rejected-bd, #fecaca)', borderRadius: 'var(--radius-md)', color: 'var(--status-rejected-text, #b91c1c)', fontSize: '0.85rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{sendError}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,240px), 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{isAr ? 'الجهة المستلمة *' : 'Recipient entity *'}</label>
            <select className="form-control" value={toOrgId} onChange={e => setToOrgId(e.target.value)}>
              <option value="">{isAr ? 'اختر الجهة...' : 'Select entity...'}</option>
              {recipientOptions.map(o => (
                <option key={o.id} value={o.id}>{isAr ? o.nameAr : o.nameEn}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{isAr ? 'الموضوع (اختياري)' : 'Subject (optional)'}</label>
            <input
              className="form-control"
              value={subject}
              maxLength={200}
              onChange={e => setSubject(e.target.value)}
              placeholder={isAr ? 'مثال: استفسار فني حول القدرة' : 'e.g. Technical inquiry'}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{isAr ? 'نص الرسالة * (حتى 2000 حرف)' : 'Message body * (max 2000 chars)'}</label>
          <textarea
            className="form-control"
            rows={3}
            value={body}
            maxLength={2000}
            onChange={e => setBody(e.target.value)}
            placeholder={isAr ? 'اكتب رسالتك للجهة المستلمة...' : 'Write your message...'}
          />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{body.trim().length} / 2000</div>
        </div>

        {/* حقول مخصصة ديناميكية */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <label className="form-label" style={{ margin: 0 }}>{isAr ? 'حقول مخصصة (اختياري — حتى 10)' : 'Custom fields (optional — up to 10)'}</label>
            <button
              className="btn btn-secondary btn-sm"
              disabled={customRows.length >= 10}
              onClick={() => setCustomRows(prev => [...prev, emptyRow()])}
            >
              <Plus size={14} />
              <span>{isAr ? 'إضافة حقل' : 'Add field'}</span>
            </button>
          </div>
          {customRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <input
                className="form-control"
                value={row.key}
                maxLength={100}
                onChange={e => setCustomRows(prev => prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                placeholder={isAr ? 'المفتاح (مثال: priority)' : 'Key (e.g. priority)'}
                style={{ flex: 1 }}
              />
              <input
                className="form-control"
                value={row.value}
                maxLength={500}
                onChange={e => setCustomRows(prev => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                placeholder={isAr ? 'القيمة (حتى 500 حرف)' : 'Value (max 500 chars)'}
                style={{ flex: 2 }}
              />
              <button
                className="btn btn-secondary btn-sm"
                disabled={customRows.length <= 1}
                onClick={() => setCustomRows(prev => prev.filter((_, j) => j !== i))}
                title={isAr ? 'حذف الحقل' : 'Remove field'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* إرفاق PDF موجود للمصنع */}
        <div className="form-group">
          <label className="form-label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <FileText size={14} />
              {isAr ? 'إرفاق ملف PDF موجود للمصنع (اختياري)' : 'Attach an existing factory PDF (optional)'}
            </span>
          </label>
          <select className="form-control" value={detailsFileId} onChange={e => setDetailsFileId(e.target.value)}>
            <option value="">{isAr ? 'بدون مرفق' : 'No attachment'}</option>
            {files.map(f => (
              <option key={String(f.id)} value={String(f.id)}>
                {String(f.fileName)} — {String(f.description || '')}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={!canSend} onClick={handleSend}>
            <Send size={16} />
            <span>{sending ? (isAr ? 'جارٍ الإرسال...' : 'Sending...') : (isAr ? 'إرسال الرسالة' : 'Send message')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
