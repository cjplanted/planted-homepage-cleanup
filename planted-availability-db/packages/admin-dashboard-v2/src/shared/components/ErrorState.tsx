import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: Error;
  onRetry?: () => void;
  className?: string;
}

/**
 * Error State Component
 *
 * Displays when an error occurs with an optional retry button.
 *
 * Usage:
 * <ErrorState
 *   title="Failed to load venues"
 *   message="Unable to fetch data from the server"
 *   onRetry={handleRetry}
 * />
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  const displayMessage = message || error?.message || 'An unexpected error occurred';
  const isDev = import.meta.env.DEV;

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {displayMessage}
          </p>
        </div>
        {isDev && error?.stack && (
          <details className="w-full text-left">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground mb-2">
              Error Details (Development Only)
            </summary>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            Try Again
          </Button>
        )}
      </div>
    </Card>
  );
}
