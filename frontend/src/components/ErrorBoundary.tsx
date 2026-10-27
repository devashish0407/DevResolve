import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6 text-white">
          <div className="glass-card max-w-md w-full p-8 text-center space-y-5 border border-status-danger/30 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-status-danger/10 text-status-danger flex items-center justify-center mx-auto border border-status-danger/20">
              <AlertTriangle size={28} />
            </div>

            <div>
              <h2 className="text-xl font-bold mb-2">Something unexpected occurred</h2>
              <p className="text-xs text-slate-400 leading-relaxed font-mono bg-dark-900 p-3 rounded-lg border border-surface-border overflow-x-auto text-left">
                {this.state.error?.message || 'An unknown render exception was caught.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="btn-gradient flex items-center gap-2 text-xs py-2 px-4"
              >
                <RefreshCw size={14} />
                Reload Application
              </button>
              <a
                href="/app"
                className="btn-ghost flex items-center gap-2 text-xs py-2 px-4"
              >
                <Home size={14} />
                Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
