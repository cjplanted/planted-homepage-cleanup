import { ErrorInfo } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

/**
 * Error Fallback UI Component
 *
 * Displays when an unhandled error is caught by ErrorBoundary.
 * Provides options to retry or navigate home.
 */
export function ErrorFallback({ error, errorInfo, onReset }: ErrorFallbackProps) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleReload = () => {
    window.location.reload();
  };

  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Error Icon */}
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>

          {/* Title and Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Something went wrong
            </h1>
            <p className="text-muted-foreground">
              We encountered an unexpected error. Please try reloading the page or
              return to the home page.
            </p>
          </div>

          {/* Error Details (Development Only) */}
          {isDev && error && (
            <div className="w-full text-left">
              <details className="bg-muted rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-sm mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="space-y-3 mt-3">
                  <div>
                    <p className="text-xs font-semibold text-destructive mb-1">
                      Error Message:
                    </p>
                    <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                      {error.message}
                    </pre>
                  </div>
                  {error.stack && (
                    <div>
                      <p className="text-xs font-semibold text-destructive mb-1">
                        Stack Trace:
                      </p>
                      <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-40">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <p className="text-xs font-semibold text-destructive mb-1">
                        Component Stack:
                      </p>
                      <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-40">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              onClick={onReset}
              variant="default"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button
              onClick={handleReload}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
            <Button
              onClick={handleGoHome}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </div>

          {/* Support Message */}
          <p className="text-xs text-muted-foreground">
            If the problem persists, please contact support with details about what
            you were doing when this error occurred.
          </p>
        </div>
      </Card>
    </div>
  );
}
