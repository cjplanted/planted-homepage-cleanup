/**
 * VenueDetail Component
 *
 * Full venue details panel with dishes and platform information.
 */

import { MapPin, ExternalLink, Calendar, Package } from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/lib/utils';
import {
  BrowserVenue,
  STATUS_EMOJIS,
  STATUS_LABELS,
  COUNTRY_EMOJIS,
  PLATFORM_LABELS,
  VENUE_TYPE_LABELS,
  PRODUCT_LABELS,
} from '../types';

interface VenueDetailProps {
  venue: BrowserVenue;
  className?: string;
}

/**
 * VenueDetail Component
 */
export function VenueDetail({ venue, className }: VenueDetailProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-2xl font-bold">{venue.name}</h2>
          <Badge
            variant={
              venue.status === 'live'
                ? 'success'
                : venue.status === 'pending'
                ? 'warning'
                : 'destructive'
            }
          >
            {STATUS_EMOJIS[venue.status]} {STATUS_LABELS[venue.status]}
          </Badge>
        </div>
        {venue.chain && (
          <p className="text-sm text-muted-foreground">Chain: {venue.chain}</p>
        )}
      </div>

      {/* Location */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Location
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span>{COUNTRY_EMOJIS[venue.countryCode] || '🌍'}</span>
            <span>{venue.country}</span>
          </div>
          <div className="text-muted-foreground">{venue.address}</div>
          <div className="text-muted-foreground">{venue.city}</div>
          {venue.coordinates && (
            <div className="text-xs text-muted-foreground">
              {venue.coordinates.lat.toFixed(4)}, {venue.coordinates.lng.toFixed(4)}
            </div>
          )}
        </div>
      </Card>

      {/* Venue Info */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Venue Info
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Type: </span>
            <span>{VENUE_TYPE_LABELS[venue.venueType]}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Dishes: </span>
            <span className="font-medium">{venue.dishCount}</span>
          </div>
          {venue.liveAt && (
            <div>
              <span className="text-muted-foreground">Live since: </span>
              <span>{new Date(venue.liveAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Platforms */}
      {venue.platforms.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Platforms</h3>
          <div className="space-y-2">
            {venue.platforms.map((platform) => (
              <div
                key={platform.platform}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={platform.isActive ? 'success' : 'secondary'}>
                    {PLATFORM_LABELS[platform.platform]}
                  </Badge>
                  {!platform.isActive && (
                    <span className="text-xs text-muted-foreground">Inactive</span>
                  )}
                </div>
                {platform.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Dishes */}
      {venue.dishes.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">
            Dishes ({venue.dishes.length})
          </h3>
          <div className="space-y-3">
            {venue.dishes.map((dish) => (
              <div
                key={dish.id}
                className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
              >
                {dish.imageUrl && (
                  <img
                    src={dish.imageUrl}
                    alt={dish.name}
                    className="w-16 h-16 rounded object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-medium text-sm">{dish.name}</h4>
                    <Badge variant={dish.availability ? 'success' : 'secondary'} className="text-xs shrink-0">
                      {dish.price.toFixed(2)} {dish.currency}
                    </Badge>
                  </div>
                  {dish.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {dish.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {PRODUCT_LABELS[dish.productType]}
                    </Badge>
                    {!dish.availability && (
                      <span className="text-xs text-muted-foreground">Unavailable</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Metadata */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Metadata
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div>
            <span>Created: </span>
            <span>{new Date(venue.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span>Updated: </span>
            <span>{new Date(venue.updatedAt).toLocaleString()}</span>
          </div>
          <div>
            <span>ID: </span>
            <span className="font-mono">{venue.id}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
