import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Pestaña con una versión vieja del CRM. Cada vez que se publica una mejora,
 * los archivos de las pantallas cambian de nombre y los viejos desaparecen:
 * una pestaña que llevaba horas abierta ya no los encuentra y salía el
 * «Failed to fetch dynamically imported module». Basta recargar, así que se
 * hace sola, una vez (la marca evita un ciclo si el problema fuera otro).
 */
function esErrorDeVersionVieja(msg: string) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(msg);
}
function recargarSiVersionVieja(msg: string) {
  if (!esErrorDeVersionVieja(msg)) return false;
  try {
    const ultima = Number(sessionStorage.getItem('recarga_version') || 0);
    if (Date.now() - ultima < 60_000) return false;
    sessionStorage.setItem('recarga_version', String(Date.now()));
  } catch { /* sin almacenamiento: se intenta igual una vez */ }
  window.location.reload();
  return true;
}
window.addEventListener('vite:preloadError', (e: any) => {
  e.preventDefault?.();
  recargarSiVersionVieja(String(e?.payload?.message || 'Failed to fetch dynamically imported module'));
});
window.addEventListener('unhandledrejection', (e) => {
  recargarSiVersionVieja(String((e.reason && (e.reason.message || e.reason)) || ''));
});

// Global error logger to catch any errors before/during React mount
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    recargarSiVersionVieja(String(error?.message || error));
    (this as any).setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (esErrorDeVersionVieja(String(this.state.error?.message || this.state.error))) {
        return (
          <div style={{ padding: '32px', fontFamily: 'system-ui, sans-serif', textAlign: 'center', color: '#0f172a' }}>
            <h2 style={{ margin: '0 0 8px 0' }}>Hay una versión nueva del CRM</h2>
            <p style={{ margin: '0 0 16px 0', color: '#475569' }}>Recarga la página para continuar.</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: 0, fontWeight: 700, cursor: 'pointer' }}>Recargar</button>
          </div>
        );
      }
      return (
        <div style={{ padding: '20px', backgroundColor: '#fff5f5', color: '#c53030', fontFamily: 'monospace', border: '2px solid #f5c2c2', margin: '20px', borderRadius: '8px' }}>
          <h2 style={{ margin: '0 0 10px 0' }}>Fallo en la Aplicación (Error de React)</h2>
          <p style={{ fontWeight: 'bold' }}>{this.state.error?.toString()}</p>
          {this.state.error?.stack && (
            <pre style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #fed7d7', borderRadius: '4px', overflowX: 'auto', fontSize: '12px' }}>
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

