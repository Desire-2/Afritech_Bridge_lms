"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, CloudOff } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/** Detect chunk loading errors (failed JS bundle download after deploy) */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  return (
    msg.includes('Failed to load') ||
    msg.includes('chunk') ||
    msg.includes('Loading chunk') ||
    msg.includes('loading CSS chunk') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('ECONNRESET') ||
    /src_[a-f0-9]+\._/.test(msg)
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error, 
      errorInfo: null 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    // For chunk errors, a hard reload is more reliable than just resetting state
    if (this.state.error && isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError = isChunkLoadError(this.state.error);

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              {isChunkError ? (
                <CloudOff className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              ) : (
                <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              )}
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {isChunkError ? 'New version deployed!' : 'Something went wrong!'}
              </h1>
              
              <p className="text-gray-600 mb-6">
                {isChunkError
                  ? 'The application has been updated. Please reload to get the latest version.'
                  : 'We encountered an unexpected error. Please try again.'
                }
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  {isChunkError ? 'Reload App' : 'Try Again'}
                </button>
                
                {!isChunkError && (
                  <button
                    onClick={() => window.location.href = '/'}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </button>
                )}
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                  <h3 className="font-semibold text-red-800 mb-2">Error Details:</h3>
                  <p className="text-red-700 text-sm font-mono">
                    {this.state.error.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;