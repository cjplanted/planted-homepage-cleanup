/**
 * LiveVenueDetail Component
 *
 * Displays detailed information about a selected live venue.
 */

import { MapPin, Clock, Calendar, ExternalLink, Utensils, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';
import { cn } from '@/lib/utils';
import type { LiveVenue } from '../types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  VENUE_TYPE_LABELS,
  PLATFORM_LABELS,
  COUNTRY_LABELS,
} from '../types';
import { LiveVenueActions } from './LiveVenueActions';
import { VenueDishList } from './VenueDishList';
import { useVenueDishes } from '../hooks/useVenueDishes';

interface LiveVenueDetailProps {
  venue: LiveVenue;
  onMarkStale: (venueId: string) => void;
  onArchive: (venueId: string) => void;
  onReactivate: (venueId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function LiveVenueDetail({
  venue,
  onMarkStale,
  onArchive,
  onReactivate,
  isLoading = false,
  className,
}: LiveVenueDetailProps) {
  const [showDishes, setShowDishes] = useState(true);
  const { data: dishesData, isLoading: dishesLoading, error: dishesError } = useVenueDishes(venue.id);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysSinceVerified = () => {
    const lastVerified = new Date(venue.lastVerified);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastVerified.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysSinceVerified = getDaysSinceVerified();

  return (
    <Card className={cn('h-full overflow-auto', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{venue.name}</CardTitle>
            {venue.chainName && (
              <p className="text-sm text-muted-foreground mt-1">
                Chain: {venue.chainName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn(STATUS_COLORS[venue.status])}>
              {STATUS_LABELS[venue.status]}
            </Badge>
            <Badge variant="outline">
              {VENUE_TYPE_LABELS[venue.type]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Actions */}
        <div className="pb-4 border-b">
          <LiveVenueActions
            venue={venue}
            onMarkStale={onMarkStale}
            onArchive={onArchive}
            onReactivate={onReactivate}
            isLoading={isLoading}
          />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </h3>
          <div className="text-sm text-muted-foreground pl-6 space-y-1">
            {venue.address.street && <p>{venue.address.street}</p>}
            <p>
              {venue.address.postalCode && `${venue.address.postalCode} `}
              {venue.address.city}
            </p>
            <p>{COUNTRY_LABELS[venue.address.country] || venue.address.country}</p>
          </div>
        </div>

        {/* Verification Info */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Verification
          </h3>
          <div className="text-sm text-muted-foreground pl-6 space-y-1">
            <p>
              Last verified: {formatDate(venue.lastVerified)}
              {daysSinceVerified > 0 && (
                <span className={cn(
                  'ml-2',
                  daysSinceVerified > 7 ? 'text-yellow-600' : 'text-green-600'
                )}>
                  ({daysSinceVerified} day{daysSinceVerified !== 1 ? 's' : ''} ago)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Created Date */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Created
          </h3>
          <div className="text-sm text-muted-foreground pl-6">
            <p>{formatDate(venue.createdAt)}</p>
          </div>
        </div>

        {/* Delivery Platforms */}
        {venue.deliveryPlatforms.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Delivery Platforms
            </h3>
            <div className="pl-6 space-y-2">
              {venue.deliveryPlatforms.map((platform, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge
                    variant={platform.active ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {PLATFORM_LABELS[platform.platform] || platform.platform}
                  </Badge>
                  <a
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
                  >
                    {platform.url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dishes */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-between p-0 h-auto hover:bg-transparent"
            onClick={() => setShowDishes(!showDishes)}
          >
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Dishes
              <Badge variant="secondary" className="ml-1 text-xs">
                {dishesData?.total ?? venue.dishCount}
              </Badge>
            </h3>
            {showDishes ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          {showDishes && (
            <VenueDishList
              dishes={dishesData?.dishes ?? []}
              isLoading={dishesLoading}
              error={dishesError}
              className="mt-2"
            />
          )}
        </div>

        {/* Location Coordinates */}
        <div className="text-xs text-muted-foreground pt-4 border-t">
          <p>
            Coordinates: {venue.location.latitude.toFixed(6)}, {venue.location.longitude.toFixed(6)}
          </p>
          <p className="mt-1">ID: {venue.id}</p>
        </div>
      </CardContent>
    </Card>
  );
}
