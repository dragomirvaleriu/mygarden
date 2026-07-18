import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-500/5 border border-red-500/20 rounded-3xl text-center max-w-md mx-auto mt-10">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Oops! Ceva nu a funcționat.</h2>
          <p className="text-sm text-gray-500 font-medium mb-6">
            A apărut o problemă la afișarea acestui modul (posibil o eroare de conexiune cu sistemul). Sistemul a interceptat eroarea pentru a nu bloca aplicația.
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-6 py-3 rounded-xl font-bold transition-colors"
          >
            <RefreshCcw size={16} />
            Reîncarcă Modulul
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
