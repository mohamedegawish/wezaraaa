import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, MessageCircle, Minimize2, Send, Sparkles, Trash2, X } from 'lucide-react';
import { usePlatformStore } from '../../store/state';
import { answer, normalizeArabic, SUGGESTED_STARTERS } from '../../chatbot/engine';
import { runSafeQuery } from '../../chatbot/safeQueries';
import type { SafeQueryName } from '../../chatbot/contract';
import faqsData from '../../chatbot/knowledge/faqs.ar.json';
import sitemapData from '../../chatbot/knowledge/site-map.json';
import keywordsData from '../../chatbot/knowledge/keywords.json';

/* ============================================================
 * ChatWidget — واجهة الشات بوت العربي (وكيل الواجهة 4/5)
 * - يستورد engine.ts (answer + SUGGESTED_STARTERS) ديناميكياً
 *   مع fallback لطيف إن لم تكن ملفات الزملاء جاهزة بعد.
 * - الفقاعات نص فقط (لا HTML — ضد الحقن).
 * - الروابط أزرار تنقل عبر navigate(view, initiativeId).
 * ============================================================ */

export interface ChatNavLink {
  label: string;
  view: string;
  initiativeId?: string;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  links?: ChatNavLink[];
}

interface EngineAnswer {
  text: string;
  links?: ChatNavLink[];
  suggestions?: string[];
}

const STORAGE_KEY_MSGS = 'egypt_ind_chat_msgs_v1';
const STORAGE_KEY_OPENED = 'egypt_ind_chat_opened_v1';
const STORAGE_KEY_EXPANDED = 'egypt_ind_chat_expanded_v1';
const MAX_STORE = 20;

const FALLBACK_STARTERS: string[] = [
  'ما هي المبادرات المتاحة؟',
  'كيف أقدم على مبادرة؟',
  'كيف أسجل الدخول؟',
  'ما الفرق بين المبادرات؟',
];

const WELCOME_TEXT =
  'أهلاً بك في مساعد المنصة الوطنية للتمويل والمبادرات الصناعية.\n' +
  'يمكنني مساعدتك في:\n' +
  '• استعراض المبادرات المتاحة وشروطها\n' +
  '• شرح خطوات التقديم وتسجيل الدخول\n' +
  '• المقارنة بين المبادرات\n' +
  'اختر سؤالاً من المقترحات بالأسفل أو اكتب سؤالك مباشرة.';

function makeWelcome(): ChatMsg {
  return { id: 'welcome', role: 'assistant', text: WELCOME_TEXT };
}

function loadHistory(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MSGS);
    if (!raw) return [makeWelcome()];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [makeWelcome()];
    const clean: ChatMsg[] = [];
    for (const m of parsed) {
      if (typeof m !== 'object' || m === null) continue;
      const r = m as { role?: unknown; text?: unknown; id?: unknown; links?: unknown };
      if ((r.role !== 'user' && r.role !== 'assistant') || typeof r.text !== 'string') continue;
      clean.push({
        id: typeof r.id === 'string' ? r.id : `m-${clean.length}`,
        role: r.role,
        text: r.text,
        links: Array.isArray(r.links) ? (r.links as ChatNavLink[]) : undefined,
      });
    }
    return clean.length > 0 ? clean.slice(-MAX_STORE) : [makeWelcome()];
  } catch {
    return [makeWelcome()];
  }
}

/* ----- المحرك الحقيقي: استدعاء answer مع المعرفة والاستعلامات المقيدة ----- */
async function askEngine(text: string, isLoggedIn: boolean): Promise<EngineAnswer> {
  const raw = await answer(text, {
    faqs: faqsData,
    sitemap: sitemapData,
    keywords: keywordsData,
    isLoggedIn,
    fetch: (q: SafeQueryName, args?: { initiativeId?: string }) =>
      runSafeQuery(q, { initiativeId: args?.initiativeId }, { isLoggedIn }),
  });
  const links: ChatNavLink[] | undefined = Array.isArray((raw as { links?: unknown }).links)
    ? ((raw as { links?: Array<{ labelAr?: unknown; label?: unknown; view?: unknown; initiativeId?: unknown }> }).links ?? [])
        .filter((l) => l && (typeof l.labelAr === 'string' || typeof l.label === 'string') && typeof l.view === 'string')
        .map((l) => ({
          label: String(l.labelAr ?? l.label ?? ''),
          view: String(l.view ?? ''),
          initiativeId: typeof l.initiativeId === 'string' ? l.initiativeId : undefined,
        }))
    : undefined;
  const suggestions: string[] | undefined = Array.isArray((raw as { suggestions?: unknown }).suggestions)
    ? ((raw as { suggestions?: unknown }).suggestions as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 3)
    : undefined;
  return { text: String((raw as { textAr?: unknown }).textAr ?? ''), links, suggestions };
}

type Brief = Array<{ id: string; titleAr: string; titleEn: string }>;

/* ----- اقتراحات لايف محلية خالصة (بلا أي fetch) -----
 * تجمع أسئلة faqs.ar.json المستورد استاتيكياً + SUGGESTED_STARTERS،
 * وتطابق normalizeArabic (يتضمن) مع تجذيع خفيف يلتقط المفرد/الجمع
 * (مبادره ↔ المبادرات) — كل ذلك داخل المتصفح فقط. */
function stemAr(w: string): string {
  let s = w;
  if (s.startsWith('ال') && s.length > 4) s = s.slice(2);
  else if (s.startsWith('لل') && s.length > 4) s = s.slice(2);
  if (s.startsWith('و') && s.length > 5) s = s.slice(1);
  if (s.length > 5 && s.endsWith('ات')) s = s.slice(0, -2);
  if (s.length > 4 && s.endsWith('ه')) s = s.slice(0, -1);
  return s;
}

function stemsOf(norm: string): string[] {
  return norm
    .split(' ')
    .map(stemAr)
    .filter((t) => t.length >= 2);
}

function readFaqQuestions(f: unknown): string[] {
  if (!f || typeof f !== 'object') return [];
  const rec = f as Record<string, unknown>;
  const out: string[] = [];
  for (const k of ['q', 'questions']) {
    const v = rec[k];
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string' && x.trim()) out.push(x.trim().slice(0, 120));
      }
    }
  }
  const single = rec['question'];
  if (typeof single === 'string' && single.trim()) out.push(single.trim().slice(0, 120));
  return out;
}

const QUESTION_POOL: string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  const raw: unknown = faqsData;
  if (Array.isArray(raw)) {
    for (const f of raw) for (const q of readFaqQuestions(f)) push(q);
  }
  const starters = Array.isArray(SUGGESTED_STARTERS) ? SUGGESTED_STARTERS : FALLBACK_STARTERS;
  for (const s of starters) push(s);
  return out;
})();

const POOL_NORM: Array<{ q: string; n: string; stems: Set<string> }> = QUESTION_POOL.map((q) => {
  const n = normalizeArabic(q);
  return { q, n, stems: new Set(stemsOf(n)) };
});

function liveMatches(rawInput: string): string[] {
  const nq = normalizeArabic(rawInput.trim());
  if (nq.length < 2) return [];
  const qStems = stemsOf(nq);
  const scored: Array<{ q: string; s: number }> = [];
  for (const e of POOL_NORM) {
    if (!e.n) continue;
    let s = 0;
    if (e.n.includes(nq)) s = 100 + nq.length;
    else if (e.n.length >= 4 && nq.includes(e.n)) s = 90;
    else {
      let hit = 0;
      for (const t of qStems) if (e.stems.has(t)) hit += 1;
      if (hit === 0) continue;
      s = 10 + hit;
    }
    scored.push({ q: e.q, s });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, 5).map((x) => x.q);
}

export const ChatWidget: React.FC = () => {
  const { navigate, language, isLoggedIn } = usePlatformStore();
  const isAr = language === 'ar';

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_EXPANDED) === '1';
    } catch {
      return false;
    }
  });
  const [liveHidden, setLiveHidden] = useState(false);
  const [starters, setStarters] = useState<string[]>(() =>
    (Array.isArray(SUGGESTED_STARTERS) ? SUGGESTED_STARTERS : FALLBACK_STARTERS).slice(0, 6),
  );
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadHistory());
  const [openedEver, setOpenedEver] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_OPENED) === '1';
    } catch {
      return false;
    }
  });

  const openRef = useRef(open);
  openRef.current = open;
  const idRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  /* اقتراحات لايف أثناء الكتابة — تصفية محلية خالصة (بلا fetch). */
  const liveList = useMemo(
    () => (liveHidden || thinking ? [] : liveMatches(input)),
    [input, liveHidden, thinking],
  );

  const toggleExpanded = () => {
    setExpanded((v) => {
      const n = !v;
      try {
        localStorage.setItem(STORAGE_KEY_EXPANDED, n ? '1' : '0');
      } catch {
        /* ignore */
      }
      return n;
    });
  };

  /* حفظ آخر 20 رسالة */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MSGS, JSON.stringify(messages.slice(-MAX_STORE)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  /* التمرير لأسفل مع كل رسالة */

  /* التمرير لأسفل مع كل رسالة */
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, open]);

  /* إغلاق بـ Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);

  const nextId = () => `m-${Date.now()}-${idRef.current++}`;

  const handleOpen = () => {
    setOpen(true);
    setUnread(0);
    setOpenedEver(true);
    try {
      localStorage.setItem(STORAGE_KEY_OPENED, '1');
    } catch {
      /* ignore */
    }
  };

  const handleClear = () => setMessages([makeWelcome()]);

  const goLink = (l: ChatNavLink) => {
    navigate(l.view, l.initiativeId);
    setOpen(false);
  };

  const sendText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || thinking) return;
      const userMsg: ChatMsg = { id: nextId(), role: 'user', text };
      setMessages((prev) => [...prev, userMsg].slice(-MAX_STORE * 2));
      setInput('');
      setLiveHidden(true);
      setThinking(true);
      try {
        const ans = await askEngine(text, isLoggedIn);
        const botMsg: ChatMsg = { id: nextId(), role: 'assistant', text: ans.text, links: ans.links };
        setMessages((prev) => [...prev, botMsg].slice(-MAX_STORE * 2));
        if (ans.suggestions && ans.suggestions.length > 0) setStarters(ans.suggestions.slice(0, 6));
        if (!openRef.current) setUnread((u) => u + 1);
      } catch {
        const err: ChatMsg = {
          id: nextId(),
          role: 'assistant',
          text: 'حدث خطأ مؤقت أثناء التفكير. يمكنك المتابعة يدوياً من الروابط التالية:',
          links: [
            { label: 'تصفح المبادرات', view: 'initiatives' },
            { label: 'تسجيل الدخول', view: 'login' },
          ],
        };
        setMessages((prev) => [...prev, err].slice(-MAX_STORE * 2));
        if (!openRef.current) setUnread((u) => u + 1);
      } finally {
        setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thinking, isLoggedIn],
  );

  const showBadge = !open && (unread > 0 || !openedEver);

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label={isAr ? 'مساعد المنصة' : 'Platform Assistant'}
          style={{
            position: 'fixed',
            bottom: '5.5rem',
            left: '1.25rem',
            zIndex: 1100,
            width: expanded ? 'min(880px, 96vw)' : 'min(380px, calc(100vw - 2rem))',
            ...(expanded
              ? { height: 'calc(100dvh - 7rem)' }
              : { maxHeight: 'min(560px, calc(100dvh - 8rem))' }),
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            overscrollBehavior: 'contain',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          <style>{`@keyframes chatblink{0%,80%,100%{opacity:.25}40%{opacity:1}}`}</style>
          <div style={{ height: '4px', background: 'var(--egypt-flag-ribbon)' }} />

          {/* الترويسة — كرومز فقط (Ar/En) */}
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.7rem 0.9rem',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--egypt-red)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                {isAr ? 'مساعد المنصة' : 'Platform Assistant'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {isAr ? 'يجيب بالعربية عن المبادرات والتقديم' : 'Answers in Arabic about initiatives'}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={toggleExpanded}
              aria-pressed={expanded}
              aria-label={expanded ? (isAr ? 'تصغير اللوحة' : 'Restore panel') : (isAr ? 'ملء الشاشة' : 'Expand panel')}
              title={expanded ? (isAr ? 'تصغير اللوحة' : 'Restore panel') : (isAr ? 'ملء الشاشة' : 'Expand panel')}
              style={{ padding: '0.4rem' }}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleClear}
              aria-label={isAr ? 'مسح المحادثة' : 'Clear chat'}
              title={isAr ? 'مسح المحادثة' : 'Clear chat'}
              style={{ padding: '0.4rem' }}
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen(false)}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              title={isAr ? 'إغلاق' : 'Close'}
              style={{ padding: '0.4rem' }}
            >
              <X size={16} />
            </button>
          </header>

          {/* الرسائل */}
          <div
            ref={listRef}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              padding: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              minHeight: '200px',
            }}
          >
            {messages.map((m) =>
              m.role === 'user' ? (
                <div
                  key={m.id}
                  style={{
                    marginLeft: 'auto',
                    maxWidth: '85%',
                    background: 'var(--egypt-red)',
                    color: '#fff',
                    borderRadius: '14px 14px 4px 14px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.84rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {m.text}
                </div>
              ) : (
                <div
                  key={m.id}
                  style={{
                    marginRight: 'auto',
                    maxWidth: '85%',
                    background: 'var(--bg-muted)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: '3px solid var(--egypt-red)',
                    borderRadius: '14px 14px 14px 4px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.84rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {m.text}
                  {m.links && m.links.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                      {m.links.map((l, i) => (
                        <button
                          key={`${l.view}-${l.initiativeId ?? ''}-${i}`}
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => goLink(l)}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {thinking && (
              <div
                aria-live="polite"
                style={{
                  marginRight: 'auto',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px 14px 14px 4px',
                  padding: '0.55rem 0.9rem',
                  display: 'flex',
                  gap: '0.3rem',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: 'var(--egypt-red)',
                      animation: 'chatblink 1.2s infinite',
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* رقائق الأسئلة المقترحة */}
          <div
            style={{
              padding: '0.5rem 0.8rem 0 0.8rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
            }}
          >
            {isAr ? 'جرّب أن تسأل:' : 'Try asking:'}
          </div>
          <div
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              gap: '0.35rem',
              overflowX: 'auto',
              overscrollBehavior: 'contain',
              padding: '0.35rem 0.8rem 0 0.8rem',
            }}
          >
            {starters.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => void sendText(s)}
                disabled={thinking}
                style={{
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  borderColor: '#F0A3B0',
                  background: 'var(--egypt-red-soft)',
                  color: 'var(--egypt-red-dark)',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* الإدخال + قائمة الاقتراحات اللايف فوقه */}
          <div style={{ position: 'relative' }}>
            {liveList.length > 0 && (
              <div
                role="listbox"
                aria-label={isAr ? 'اقتراحات مطابقة' : 'Matching suggestions'}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '0.8rem',
                  right: '0.8rem',
                  marginBottom: '0.35rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  maxHeight: '220px',
                  padding: '0.3rem',
                  zIndex: 5,
                }}
              >
                {liveList.map((q) => (
                  <button
                    key={q}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => void sendText(q)}
                    disabled={thinking}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--egypt-red-soft)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'start',
                      padding: '0.45rem 0.6rem',
                      borderRadius: '8px',
                      border: '1px solid transparent',
                      background: 'transparent',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendText(input);
              }}
              style={{ display: 'flex', gap: '0.5rem', padding: '0.7rem 0.8rem 0.9rem 0.8rem' }}
            >
              <input
                className="form-control"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setLiveHidden(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && liveList.length > 0) {
                    e.stopPropagation();
                    setLiveHidden(true);
                  }
                }}
                placeholder={isAr ? 'اكتب سؤالك هنا…' : 'Type your question…'}
                aria-label={isAr ? 'اكتب سؤالك' : 'Type your question'}
                disabled={thinking}
                maxLength={500}
              />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!input.trim() || thinking}
              aria-label={isAr ? 'إرسال' : 'Send'}
              title={isAr ? 'إرسال' : 'Send'}
              style={{ flexShrink: 0 }}
            >
              <Send size={16} style={isAr ? { transform: 'scaleX(-1)' } : undefined} />
            </button>
          </form>
          </div>
        </section>
      )}

      {/* الزر العائم — أسفل-يسار */}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-expanded={open}
        aria-label={isAr ? 'مساعد المنصة' : 'Platform Assistant'}
        title={isAr ? 'مساعد المنصة' : 'Platform Assistant'}
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 1100,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--egypt-red)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-red), var(--shadow-lg)',
          border: '1px solid var(--egypt-red-dark)',
        }}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {showBadge && (
          <span
            className="badge"
            style={{
              position: 'absolute',
              top: '-6px',
              insetInlineEnd: '-6px',
              minWidth: '20px',
              height: '20px',
              padding: '0 5px',
              background: '#fff',
              color: 'var(--egypt-red)',
              border: '2px solid var(--egypt-red)',
              fontSize: '0.65rem',
            }}
          >
            {unread > 0 ? String(unread) : ''}
          </span>
        )}
      </button>
    </>
  );
};
