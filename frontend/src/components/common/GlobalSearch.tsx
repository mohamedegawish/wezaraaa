import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePlatformStore } from '../../store/state';
import { Search, X, Zap, Layers } from 'lucide-react';

type SearchKind = 'initiative' | 'application';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  kind: SearchKind;
}

interface GlobalSearchProps {
  onNavigate: (view: string, initId?: string) => void;
  onClose?: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate, onClose }) => {
  const { initiatives, applications, language } = usePlatformStore();
  const isAr = language === 'ar';
  const [query, setQuery] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fuzzyMatch = (text: string, q: string): boolean => {
    if (!q) return true;
    const t = text.toLowerCase();
    const search = q.toLowerCase();
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < search.length; ti++) {
      if (t[ti] === search[qi]) qi++;
    }
    return qi === search.length;
  };

  const results: SearchResult[] = [
    ...initiatives
      .filter(i => fuzzyMatch(i.titleAr, query) || fuzzyMatch(i.titleEn, query) || fuzzyMatch(i.taglineAr, query) || fuzzyMatch(i.categoryEn, query))
      .map(i => ({ id: i.id, title: isAr ? i.titleAr : i.titleEn, subtitle: isAr ? i.category : i.categoryEn, kind: 'initiative' as const })),
    ...applications
      .filter(a => fuzzyMatch(a.initiativeTitleAr, query) || fuzzyMatch(a.factoryNameAr, query) || fuzzyMatch(a.applicationNumber, query))
      .map(a => ({ id: a.id, title: isAr ? a.factoryNameAr : a.factoryNameEn, subtitle: a.applicationNumber, kind: 'application' as const })),
  ];

  useEffect(() => {
    inputRef.current?.focus();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      onClose?.();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIdx(p => Math.min(p + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIdx(p => Math.max(p - 1, -1)); }
    else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      const r = results[focusedIdx];
      if (!r) return;
      if (r.kind === 'initiative') onNavigate('showcase', r.id);
      else onNavigate('admin-applications');
      onClose?.();
    }
    else if (e.key === 'Escape') { onClose?.(); }
  }, [focusedIdx, results, onNavigate, onClose]);

  return (
    <div ref={containerRef} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'var(--overlay-strong)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 1rem',
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: '640px', maxHeight: '70vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', padding: 0,
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setFocusedIdx(-1); }}
            placeholder={isAr ? 'ابحث عن مبادرات، طلبات، مشاريع...' : 'Search initiatives, applications, projects...'}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: '1rem',
              background: 'transparent', color: 'var(--text-main)', font: 'inherit',
            }}
          />
          <button onClick={() => onClose?.()} style={{ color: 'var(--text-muted)', padding: '0.25rem' }} title={isAr ? 'إغلاق' : 'Close'}>
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', padding: '0.5rem 0' }}>
          {results.length === 0 && query && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isAr ? 'لا توجد نتائج — جرّب كلمات مختلفة' : 'No results found. Try different keywords.'}
            </div>
          )}
          {results.slice(0, 12).map((r, idx) => (
            <button
              key={`${r.kind}-${r.id}`}
              onClick={() => {
                if (r.kind === 'initiative') onNavigate('showcase', r.id);
                else onNavigate('admin-applications');
                onClose?.();
              }}
              onMouseEnter={() => setFocusedIdx(idx)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1.25rem', textAlign: isAr ? 'right' : 'left',
                background: idx === focusedIdx ? 'var(--bg-hover)' : 'transparent',
                border: 'none', cursor: 'pointer', transition: 'background 0.1s',
                color: 'var(--text-main)', font: 'inherit',
              }}
            >
              {r.kind === 'initiative'
                ? <Layers size={16} style={{ color: 'var(--gov-primary-600)', flexShrink: 0 }} />
                : <Zap size={16} style={{ color: 'var(--egypt-red)', flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{r.subtitle}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '0.6rem 1.25rem', borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.725rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem',
        }}>
          <span><kbd style={{ background: 'var(--bg-hover)', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.7rem' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ background: 'var(--bg-hover)', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.7rem' }}>↵</kbd> open</span>
          <span><kbd style={{ background: 'var(--bg-hover)', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.7rem' }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};
