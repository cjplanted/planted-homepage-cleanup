/**
 * VenueTable Component
 *
 * Table view of venues with sorting capabilities.
 */

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import {
  BrowserVenue,
  BrowserFilters,
  STATUS_EMOJIS,
  STATUS_LABELS,
  COUNTRY_EMOJIS,
  PLATFORM_LABELS,
} from '../types';

interface VenueTableProps {
  venues: BrowserVenue[];
  selectedVenueId?: string;
  onSelectVenue: (venueId: string) => void;
  sortBy: BrowserFilters['sortBy'];
  sortOrder: 'asc' | 'desc';
  onSort: (field: BrowserFilters['sortBy']) => void;
  className?: string;
}

/**
 * VenueTable Component
 */
export function VenueTable({
  venues,
  selectedVenueId,
  onSelectVenue,
  sortBy,
  sortOrder,
  onSort,
  className,
}: VenueTableProps) {
  const SortIcon = ({ field }: { field: BrowserFilters['sortBy'] }) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse">
        <thead className="bg-muted/50 border-b border-border sticky top-0">
          <tr>
            <th className="text-left p-3">
              <button
                onClick={() => onSort('name')}
                className="flex items-center gap-2 font-medium text-sm hover:text-primary"
              >
                Name
                <SortIcon field="name" />
              </button>
            </th>
            <th className="text-left p-3">
              <button
                onClick={() => onSort('city')}
                className="flex items-center gap-2 font-medium text-sm hover:text-primary"
              >
                Location
                <SortIcon field="city" />
              </button>
            </th>
            <th className="text-left p-3">
              <span className="font-medium text-sm">Status</span>
            </th>
            <th className="text-left p-3">
              <button
                onClick={() => onSort('dishCount')}
                className="flex items-center gap-2 font-medium text-sm hover:text-primary"
              >
                Dishes
                <SortIcon field="dishCount" />
              </button>
            </th>
            <th className="text-left p-3">
              <span className="font-medium text-sm">Platforms</span>
            </th>
            <th className="text-left p-3">
              <button
                onClick={() => onSort('updatedAt')}
                className="flex items-center gap-2 font-medium text-sm hover:text-primary"
              >
                Updated
                <SortIcon field="updatedAt" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {venues.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                No venues found
              </td>
            </tr>
          ) : (
            venues.map((venue) => (
              <tr
                key={venue.id}
                onClick={() => onSelectVenue(venue.id)}
                className={cn(
                  'border-b border-border cursor-pointer transition-colors',
                  'hover:bg-accent',
                  selectedVenueId === venue.id && 'bg-primary/10'
                )}
              >
                <td className="p-3">
                  <div className="flex flex-col gap-1">
                    <div className="font-medium text-sm">{venue.name}</div>
                    {venue.chain && (
                      <div className="text-xs text-muted-foreground">{venue.chain}</div>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{COUNTRY_EMOJIS[venue.countryCode] || '🌍'}</span>
                    <span>{venue.city}</span>
                  </div>
                </td>
                <td className="p-3">
                  <Badge
                    variant={
                      venue.status === 'live'
                        ? 'success'
                        : venue.status === 'pending'
                        ? 'warning'
                        : 'destructive'
                    }
                    className="text-xs"
                  >
                    {STATUS_EMOJIS[venue.status]} {STATUS_LABELS[venue.status]}
                  </Badge>
                </td>
                <td className="p-3">
                  <span className="text-sm font-medium">{venue.dishCount}</span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {venue.platforms
                      .filter((p) => p.isActive)
                      .map((platform) => (
                        <Badge
                          key={platform.platform}
                          variant="outline"
                          className="text-xs"
                        >
                          {PLATFORM_LABELS[platform.platform]}
                        </Badge>
                      ))}
                  </div>
                </td>
                <td className="p-3">
                  <span className="text-sm text-muted-foreground">
                    {new Date(venue.updatedAt).toLocaleDateString()}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
