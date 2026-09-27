import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-app">
          <div className="w-full max-w-sm rounded-2xl border border-danger/20 bg-danger/10 p-6 flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-danger/20 flex items-center justify-center mb-4">
              <AlertTriangle className="text-danger" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-danger mb-2">Something went wrong</h3>
            <p className="text-sm text-danger/80 mb-6">
              {this.props.fallbackMessage || 'An unexpected error occurred in this component.'}
            </p>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-xl bg-danger hover:bg-danger/80 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              <RotateCcw size={16} />
              Return to Learn
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
