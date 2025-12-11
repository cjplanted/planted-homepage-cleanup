/**
 * LiveVenueStats Component
 *
 * Displays statistics bar for live venues (active, stale, archived counts).
 */

import { CheckCircle, Clock, Archive, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LiveVenuesStats } from '../types';

interface LiveVenueStatsProps {
  stats: LiveVenuesStats;
  className?: string;
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatItem({ icon, label, value, color }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('p-1.5 rounded-full', color)}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold">{value.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function LiveVenueStats({ stats, className }: LiveVenueStatsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-6 p-4 bg-card rounded-lg border',
        className
      )}
    >
      <StatItem
        icon={<CheckCircle className="h-4 w-4 text-green-600" />}
        label="Active"
        value={stats.active}
        color="bg-green-100"
      />
      <StatItem
        icon={<Clock className="h-4 w-4 text-yellow-600" />}
        label="Stale"
        value={stats.stale}
        color="bg-yellow-100"
      />
      <StatItem
        icon={<Archive className="h-4 w-4 text-gray-600" />}
        label="Archived"
        value={stats.archived}
        color="bg-gray-100"
      />
      <div className="h-8 w-px bg-border" />
      <StatItem
        icon={<MapPin className="h-4 w-4 text-blue-600" />}
        label="Total"
        value={stats.total}
        color="bg-blue-100"
      />
      {stats.avgDaysSinceVerification > 0 && (
        <>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Avg. Days Since Verified</span>
            <span className="text-lg font-semibold">{stats.avgDaysSinceVerification}</span>
          </div>
        </>
      )}
    </div>
  );
}
