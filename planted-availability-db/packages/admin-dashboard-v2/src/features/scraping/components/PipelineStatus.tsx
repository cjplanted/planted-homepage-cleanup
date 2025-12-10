/**
 * PipelineStatus Component
 *
 * Visual pipeline showing status at each stage.
 */

import { ArrowRight, Loader2, CheckCircle2, Clock, ListChecks } from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import type { PipelineStage } from '../types';

interface PipelineStatusProps {
  stages: PipelineStage[];
  onStageClick?: (stage: PipelineStage) => void;
  className?: string;
}

/**
 * Get stage icon based on status
 */
function getStageIcon(status: PipelineStage['status']) {
  switch (status) {
    case 'running':
      return Loader2;
    case 'completed':
      return CheckCircle2;
    case 'queued':
      return Clock;
    default:
      return ListChecks;
  }
}

/**
 * Get stage badge variant
 */
function getStageBadgeVariant(status: PipelineStage['status']) {
  switch (status) {
    case 'running':
      return 'default';
    case 'completed':
      return 'success';
    case 'queued':
      return 'warning';
    default:
      return 'secondary';
  }
}

/**
 * Get stage label
 */
function getStageLabel(stage: PipelineStage['stage']) {
  switch (stage) {
    case 'scraping':
      return 'Scraping';
    case 'extraction':
      return 'Extraction';
    case 'review':
      return 'Review';
    case 'website':
      return 'Website';
    default:
      return stage;
  }
}

/**
 * Get stage status text
 */
function getStatusText(stage: PipelineStage): string {
  switch (stage.status) {
    case 'running':
      return stage.activeCount
        ? `${stage.activeCount} active`
        : 'Running';
    case 'queued':
      return stage.count ? `${stage.count} queued` : 'Queued';
    case 'completed':
      return stage.count ? `${stage.count} items` : 'Completed';
    case 'idle':
      return stage.count ? `${stage.count} items` : 'Idle';
    default:
      return stage.status;
  }
}

/**
 * Pipeline Stage Item
 */
function PipelineStageItem({
  stage,
  isLast,
  onClick,
}: {
  stage: PipelineStage;
  isLast: boolean;
  onClick?: () => void;
}) {
  const Icon = getStageIcon(stage.status);
  const isClickable = onClick !== undefined;

  return (
    <div className="flex items-center">
      <button
        onClick={onClick}
        disabled={!isClickable}
        className={cn(
          'flex flex-col items-center justify-center p-4 rounded-lg border transition-all',
          isClickable && 'cursor-pointer hover:bg-accent hover:border-primary',
          !isClickable && 'cursor-default',
          stage.status === 'running' && 'border-primary bg-primary/5',
          stage.status !== 'running' && 'border-border bg-card'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon
            className={cn(
              'h-5 w-5',
              stage.status === 'running' && 'animate-spin text-primary',
              stage.status === 'completed' && 'text-green-500',
              stage.status === 'queued' && 'text-yellow-500',
              stage.status === 'idle' && 'text-muted-foreground'
            )}
          />
          <span className="font-semibold text-sm">
            {getStageLabel(stage.stage)}
          </span>
        </div>
        <Badge
          variant={getStageBadgeVariant(stage.status)}
          className="text-xs"
        >
          {getStatusText(stage)}
        </Badge>
      </button>
      {!isLast && (
        <ArrowRight className="h-5 w-5 text-muted-foreground mx-2" />
      )}
    </div>
  );
}

/**
 * Pipeline Status Component
 */
export function PipelineStatus({
  stages,
  onStageClick,
  className,
}: PipelineStatusProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex flex-col space-y-4">
        <h3 className="text-lg font-semibold">Pipeline Status</h3>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {stages.map((stage, index) => (
            <PipelineStageItem
              key={stage.stage}
              stage={stage}
              isLast={index === stages.length - 1}
              onClick={onStageClick ? () => onStageClick(stage) : undefined}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
