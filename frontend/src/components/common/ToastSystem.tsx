import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  /** Optional inline action (e.g. «فتح» on a chat notification) — clicking it also dismisses. */
  action?: ToastAction;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (type: ToastType, message: string, duration?: number, action?: ToastAction) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let _toastId = 0;
const TOAST_DURATION = 4000;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((type: ToastType, message: string, duration = TOAST_DURATION, action?: ToastAction) => {
    const id = `toast-${++_toastId}-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message, duration, action }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  // Cleanup on unmount
  useEffect(() => {
    const timersRef = timers;
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <span className="toast__icon">{
              t.type === 'success' ? '✓' :
              t.type === 'error' ? '✕' :
              t.type === 'warning' ? '!' : 'i'
            }</span>
            <span className="toast__message">{t.message}</span>
            {t.action && (
              <button className="toast__action" onClick={() => { t.action?.onClick(); dismiss(t.id); }}>{t.action.label}</button>
            )}
            <button className="toast__dismiss" onClick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
