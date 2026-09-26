import React, { useEffect, useRef } from 'react';

// مكون نافذة منبثقة موحد — HOW TO USE:
// <Modal onClose={...} title="عنوان" footer={<button>حفظ</button>} maxWidth="950px">
//   {...محتوى النافذة...}
// </Modal>
// - النقر على الخلفية يغلق (onClose)، والنقر داخل المحتوى لا ينتشر للخارج.
// - الألوان من theme.css عبر modal-backdrop/modal-content — لا تضع hex هنا.
// - يدعم Escape للإغلاق + حبس الـ focus داخل النافذة.

type Props = {
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string | number;
};

function useFocusTrap(containerRef: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const firstFocusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => 'disabled' in el && !(el as HTMLElement & { disabled?: boolean }).disabled && el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export const Modal: React.FC<Props> = ({ onClose, title, children, footer, maxWidth }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, onClose);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={containerRef}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="modal-header">
            <div id="modal-title" style={{ fontWeight: 700 }}>{title}</div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              aria-label="إغلاق"
              type="button"
            >
              ✕
            </button>
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
};
