import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, MessageSquareText, Paperclip, SendHorizontal, X } from 'lucide-react';
import { useToast } from '../common/ToastSystem';
import {
  CHAT_ACCEPT, CHAT_ALLOWED_EXT, CHAT_MAX_BODY, CHAT_MAX_FILE_MB, CHAT_MAX_FILES,
  extOf, fileIconFor, formatBytes,
} from './chatUtils';

export interface ChatComposerHandle {
  addFiles: (files: FileList | File[]) => void;
  focus: () => void;
}

interface Props {
  isAr: boolean;
  placeholder: string;
  /** Resolves true when the message was delivered (composer then clears). */
  onSend: (body: string, files: File[]) => Promise<boolean>;
  onTyping?: () => void;
}

const QUICK_REPLIES = [
  { ar: 'تم الاستلام، وجارٍ المراجعة.', en: 'Received — under review.' },
  { ar: 'برجاء موافاتنا بالمستندات المطلوبة.', en: 'Please send the required documents.' },
  { ar: 'تمت الموافقة، شكراً لتعاونكم.', en: 'Approved — thank you for your cooperation.' },
  { ar: 'سيتم الرد خلال يوم عمل.', en: 'We will reply within one business day.' },
];

// صندوق الكتابة: Enter إرسال · Shift+Enter سطر جديد · إرفاق بالزر/السحب/اللصق · قائمة ردود جاهزة.
export const ChatComposer = forwardRef<ChatComposerHandle, Props>(({ isAr, placeholder, onSend, onTyping }, ref) => {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    if (!quickOpen) return;
    const onDown = (e: MouseEvent) => { if (quickRef.current && !quickRef.current.contains(e.target as Node)) setQuickOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setQuickOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [quickOpen]);

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (!list.length) return;
    const accepted: File[] = [];
    for (const f of list) {
      if (!CHAT_ALLOWED_EXT.includes(extOf(f.name))) {
        toast('error', isAr ? `«${f.name}»: نوع غير مسموح. المسموح: PDF، صور، Word، Excel، PowerPoint، نص.` : `"${f.name}": type not allowed.`);
        continue;
      }
      if (f.size > CHAT_MAX_FILE_MB * 1024 * 1024) {
        toast('error', isAr ? `«${f.name}» أكبر من ${CHAT_MAX_FILE_MB} ميجا.` : `"${f.name}" exceeds ${CHAT_MAX_FILE_MB} MB.`);
        continue;
      }
      accepted.push(f);
    }
    setFiles(prev => {
      const merged = [...prev, ...accepted.filter(a => !prev.some(p => p.name === a.name && p.size === a.size))];
      if (merged.length > CHAT_MAX_FILES) {
        toast('warning', isAr ? `الحد الأقصى ${CHAT_MAX_FILES} ملفات في الرسالة.` : `Max ${CHAT_MAX_FILES} files per message.`);
      }
      return merged.slice(0, CHAT_MAX_FILES);
    });
  };

  useImperativeHandle(ref, () => ({ addFiles, focus: () => inputRef.current?.focus() }));

  // Auto-grow up to ~6 lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);

  const canSend = !sending && (text.trim().length > 0 || files.length > 0) && text.length <= CHAT_MAX_BODY;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    const ok = await onSend(text.trim(), files);
    setSending(false);
    if (ok) {
      setText('');
      setFiles([]);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files.length) {
      e.preventDefault();
      addFiles(e.clipboardData.files);
    }
  };

  const remaining = CHAT_MAX_BODY - text.length;

  return (
    <div className="chat-composer">
      {files.length > 0 && (
        <div className="chat-files">
          {files.map((f, i) => {
            const { Icon, color } = fileIconFor(f.name);
            return (
              <span key={`${f.name}-${i}`} className="chat-file-chip">
                <Icon size={15} style={{ color }} />
                <span className="chat-file-chip-name" title={f.name}>{f.name}</span>
                <small>{formatBytes(f.size)}</small>
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} aria-label={isAr ? 'إزالة' : 'Remove'} disabled={sending}>
                  <X size={13} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="chat-composer-row">
        <button
          type="button"
          className="btn btn-secondary chat-round-btn"
          onClick={() => fileRef.current?.click()}
          disabled={sending || files.length >= CHAT_MAX_FILES}
          title={isAr ? `إرفاق ملف (حتى ${CHAT_MAX_FILES} ملفات، ${CHAT_MAX_FILE_MB} ميجا للملف)` : `Attach (up to ${CHAT_MAX_FILES} files, ${CHAT_MAX_FILE_MB} MB each)`}
          aria-label={isAr ? 'إرفاق ملف' : 'Attach file'}
        >
          <Paperclip size={17} />
        </button>
        <div className="chat-quick-wrap" ref={quickRef}>
          <button
            type="button"
            className="btn btn-secondary chat-round-btn"
            onClick={() => setQuickOpen(o => !o)}
            disabled={sending}
            title={isAr ? 'ردود جاهزة' : 'Quick replies'}
            aria-label={isAr ? 'ردود جاهزة' : 'Quick replies'}
            aria-expanded={quickOpen}
          >
            <MessageSquareText size={17} />
          </button>
          {quickOpen && (
            <div className="chat-quick-menu" role="menu">
              <div className="chat-quick-title">{isAr ? 'ردود جاهزة' : 'Quick replies'}</div>
              {QUICK_REPLIES.map(q => (
                <button key={q.en} type="button" role="menuitem" onClick={() => { setText(isAr ? q.ar : q.en); setQuickOpen(false); inputRef.current?.focus(); }}>
                  {isAr ? q.ar : q.en}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={CHAT_ACCEPT}
          hidden
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        />
        <textarea
          ref={inputRef}
          className="form-control chat-input"
          rows={1}
          value={text}
          maxLength={CHAT_MAX_BODY + 200}
          placeholder={placeholder}
          onChange={e => { setText(e.target.value); onTyping?.(); }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          disabled={sending}
          aria-label={placeholder}
        />
        <button
          type="button"
          className="btn btn-primary chat-send"
          onClick={() => void submit()}
          disabled={!canSend}
          title={isAr ? 'إرسال (Enter)' : 'Send (Enter)'}
        >
          {sending ? <Loader2 size={16} className="chat-spin" /> : <SendHorizontal size={16} className="chat-send-icon" />}
          <span>{isAr ? 'إرسال' : 'Send'}</span>
        </button>
      </div>
      {remaining < 500 && (
        <div className={`chat-counter${remaining < 0 ? ' over' : ''}`}>{remaining}</div>
      )}
    </div>
  );
});
ChatComposer.displayName = 'ChatComposer';
