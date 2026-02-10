import React from 'react';
import { AlertCircle } from 'lucide-react';
import Button from '../ui/Button';

/**
 * Error Boundary for catching unexpected errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-zinc-100 px-4">
          <div className="max-w-md text-center">
            <div className="p-4 bg-red-500/10 rounded-full text-red-400 mb-6 inline-block">
              <AlertCircle size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-zinc-400 mb-6">
              An unexpected error occurred. Please try refreshing the page or contact support.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre className="bg-zinc-900 p-4 rounded mb-6 text-left text-xs text-red-400 overflow-auto max-h-40">
                {this.state.error?.toString()}
              </pre>
            )}
            <div className="flex gap-3">
              <Button variant="primary" onClick={this.reset}>
                Try Again
              </Button>
              <Button variant="secondary" onClick={() => window.location.href = '/'}>
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
