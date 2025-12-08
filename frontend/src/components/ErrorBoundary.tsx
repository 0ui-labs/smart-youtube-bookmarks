import { AlertCircle } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

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
    console.error("ErrorBoundary caught:", error, errorInfo);

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
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
          <AlertCircle className="mb-4 h-16 w-16 text-destructive" />
          <h2 className="mb-2 font-bold text-2xl">Etwas ist schiefgelaufen</h2>
          <p className="mb-4 max-w-md text-center text-muted-foreground">
            {this.state.error?.message ||
              "Ein unerwarteter Fehler ist aufgetreten"}
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
