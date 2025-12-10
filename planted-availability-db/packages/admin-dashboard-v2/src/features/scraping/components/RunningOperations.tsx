/**
 * RunningOperations Component
 *
 * Displays list of running scraper operations with progress.
 */

import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { Activity } from 'lucide-react';
import { ScraperProgress } from './ScraperProgress';
import type { ScraperProgress as ScraperProgressType } from '../types';

interface RunningOperationsProps {
  operations: ScraperProgressType[];
  onCancel?: (runId: string) => void;
  isCancelling?: boolean;
  className?: string;
}

/**
 * Running Operations Component
 */
export function RunningOperations({
  operations,
  onCancel,
  isCancelling = false,
  className,
}: RunningOperationsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Running Operations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {operations.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No running operations"
            description="Start a scraper to see real-time progress here"
          />
        ) : (
          <div className="space-y-4">
            {operations.map((operation) => (
              <ScraperProgress
                key={operation.runId}
                progress={operation}
                onCancel={onCancel}
                isCancelling={isCancelling}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
