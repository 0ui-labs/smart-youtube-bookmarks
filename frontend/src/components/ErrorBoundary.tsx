import { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree and displays
 * a fallback UI instead of crashing the entire app.
 *
 * IMPORTANT: Error boundaries only catch errors in:
 * - Rendering
 * - Lifecycle methods
 * - Constructors of class components
 *
 * Error boundaries DO NOT catch errors in:
 * - Event handlers (use try/catch)
 * - Asynchronous code (use try/catch)
 * - Server-side rendering
 * - Errors thrown in the error boundary itself
 *
 * @example
 * ```tsx
 * // Wrap your app or specific sections
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 *
 * // Custom fallback UI
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <FeatureSection />
 * </ErrorBoundary>
 * ```
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error to error reporting service
    console.error('ErrorBoundary caught:', error, errorInfo);

    // TODO: Send to error tracking service (e.g., Sentry)
    // Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided by parent
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Etwas ist schiefgelaufen</h2>
          <p className="text-muted-foreground mb-4 text-center max-w-md">
            {this.state.error?.message || 'Ein unerwarteter Fehler ist aufgetreten'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Seite neu laden
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
