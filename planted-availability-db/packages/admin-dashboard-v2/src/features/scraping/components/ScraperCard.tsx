/**
 * ScraperCard Component
 *
 * Card for each available scraper type with run button.
 */

import { Play, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import type { ScraperMetadata } from '../types';

interface ScraperCardProps {
  scraper: ScraperMetadata;
  onRun: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Format duration in seconds to readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}

/**
 * Get status badge variant
 */
function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'cancelled':
      return 'secondary';
    default:
      return 'default';
  }
}

/**
 * Scraper Card Component
 */
export function ScraperCard({
  scraper,
  onRun,
  disabled = false,
  className,
}: ScraperCardProps) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{scraper.name}</CardTitle>
            <CardDescription>{scraper.description}</CardDescription>
          </div>
          <Badge variant="outline" className="capitalize">
            {scraper.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Last Run Info */}
        {scraper.lastRun && (
          <div className="flex items-center gap-3 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Last run:</span>
              <span className="font-medium">
                {formatRelativeTime(scraper.lastRun.timestamp)}
              </span>
              <Badge
                variant={getStatusBadgeVariant(scraper.lastRun.status)}
                className="text-xs"
              >
                {scraper.lastRun.status}
              </Badge>
              <span className="text-muted-foreground">
                ({formatDuration(scraper.lastRun.duration)})
              </span>
            </div>
          </div>
        )}

        {/* Capabilities */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Countries:
            </span>
            {scraper.capabilities.countries.map((country) => (
              <Badge key={country} variant="outline" className="text-xs">
                {country}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Platforms:
            </span>
            {scraper.capabilities.platforms.map((platform) => (
              <Badge key={platform} variant="outline" className="text-xs">
                {platform}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={onRun}
          disabled={disabled}
          className="w-full"
          size="sm"
        >
          <Play className="h-4 w-4 mr-2" />
          Run Now
        </Button>
      </CardFooter>
    </Card>
  );
}
