import React from 'react';

// PROD FIX: ErrorBoundary لكل route — خطأ واحد كان يكسر التطبيق كاملاً.
interface Props { children: React.ReactNode; fallbackTitleAr?: string; fallbackTitleEn?: string }
interface State { hasError: boolean; errorId: string }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, errorId: '' };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, errorId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` };
  }

  componentDidCatch(error: unknown) {
    // Hook for Sentry later — currently console + errorId for support.
    console.error('[ErrorBoundary]', this.state.errorId, error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const isAr = document.documentElement.lang !== 'en';
    return (
      <div className="container-custom" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem' }}>
            {isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            {isAr ? 'تم تسجيل الخطأ. حدّث الصفحة أو ارجع للرئيسية.' : 'The error was logged. Refresh or go home.'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', direction: 'ltr' }}>ref: {this.state.errorId}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              {isAr ? 'تحديث الصفحة' : 'Reload'}
            </button>
            <button className="btn" onClick={() => { this.setState({ hasError: false, errorId: '' }); window.location.hash = '#/'; }}>
              {isAr ? 'الرئيسية' : 'Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
