/**
 * VenueCards Component
 *
 * Card grid view of venues.
 */

import { MapPin } from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import {
  BrowserVenue,
  STATUS_EMOJIS,
  COUNTRY_EMOJIS,
  PLATFORM_LABELS,
  VENUE_TYPE_LABELS,
} from '../types';

interface VenueCardsProps {
  venues: BrowserVenue[];
  selectedVenueId?: string;
  onSelectVenue: (venueId: string) => void;
  className?: string;
}

/**
 * VenueCards Component
 */
export function VenueCards({
  venues,
  selectedVenueId,
  onSelectVenue,
  className,
}: VenueCardsProps) {
  if (venues.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No venues found
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {venues.map((venue) => (
        <Card
          key={venue.id}
          onClick={() => onSelectVenue(venue.id)}
          className={cn(
            'p-4 cursor-pointer transition-all hover:shadow-md',
            selectedVenueId === venue.id && 'ring-2 ring-primary'
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{venue.name}</h3>
              {venue.chain && (
                <p className="text-xs text-muted-foreground truncate">{venue.chain}</p>
              )}
            </div>
            <Badge
              variant={
                venue.status === 'live'
                  ? 'success'
                  : venue.status === 'pending'
                  ? 'warning'
                  : 'destructive'
              }
              className="text-xs shrink-0"
            >
              {STATUS_EMOJIS[venue.status]}
            </Badge>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {COUNTRY_EMOJIS[venue.countryCode] || '🌍'} {venue.city}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
            <div>
              <span className="font-medium text-foreground">{venue.dishCount}</span> dishes
            </div>
            <div className="truncate">
              {VENUE_TYPE_LABELS[venue.venueType]}
            </div>
          </div>

          {/* Platforms */}
          {venue.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {venue.platforms
                .filter((p) => p.isActive)
                .slice(0, 3)
                .map((platform) => (
                  <Badge
                    key={platform.platform}
                    variant="outline"
                    className="text-xs"
                  >
                    {PLATFORM_LABELS[platform.platform]}
                  </Badge>
                ))}
              {venue.platforms.filter((p) => p.isActive).length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{venue.platforms.filter((p) => p.isActive).length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            Updated {new Date(venue.updatedAt).toLocaleDateString()}
          </div>
        </Card>
      ))}
    </div>
  );
}
