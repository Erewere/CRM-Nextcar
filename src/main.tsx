import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
    (this as any).setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
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

