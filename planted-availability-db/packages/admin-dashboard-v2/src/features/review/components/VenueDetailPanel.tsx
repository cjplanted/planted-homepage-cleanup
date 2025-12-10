/**
 * VenueDetailPanel Component
 *
 * Displays detailed information about a selected venue including
 * confidence scores, location, and platform links.
 */

import { ExternalLink, MapPin, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import { ReviewVenue, PLATFORM_LABELS, VENUE_TYPE_LABELS, COUNTRY_EMOJIS } from '../types';

interface VenueDetailPanelProps {
  venue: ReviewVenue;
  className?: string;
}

/**
 * ConfidenceBar Component
 */
function ConfidenceBar({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const getColor = () => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Confidence</span>
        <span className="font-semibold">{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * VenueDetailPanel Component
 */
export function VenueDetailPanel({ venue, className }: VenueDetailPanelProps) {
  const formattedDate = new Date(venue.scrapedAt).toLocaleString();
  const mapUrl = venue.coordinates
    ? `https://www.google.com/maps?q=${venue.coordinates.lat},${venue.coordinates.lng}`
    : null;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-2xl truncate">{venue.name}</CardTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {venue.chain && (
                <Badge variant="secondary" className="font-normal">
                  {venue.chain}
                </Badge>
              )}
              <Badge variant="outline" className="font-normal">
                {VENUE_TYPE_LABELS[venue.venueType]}
              </Badge>
              <Badge
                variant={
                  venue.status === 'verified'
                    ? 'success'
                    : venue.status === 'rejected'
                    ? 'destructive'
                    : 'warning'
                }
              >
                {venue.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Location */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Location</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span>{venue.address}</span>
            </div>
            <div className="flex items-center gap-2 ml-6">
              <span>
                {venue.city}, {COUNTRY_EMOJIS[venue.countryCode] || ''} {venue.country}
              </span>
            </div>
            {venue.coordinates && mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline ml-6"
              >
                View on Map
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Confidence Score */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Confidence Score</h4>
          <ConfidenceBar confidence={venue.confidence} />

          {/* Confidence Factors */}
          {venue.confidenceFactors && venue.confidenceFactors.length > 0 && (
            <div className="space-y-2 mt-4">
              <h5 className="text-xs font-semibold text-muted-foreground uppercase">
                Factors
              </h5>
              <div className="space-y-2">
                {venue.confidenceFactors.map((factor, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{factor.factor}</span>
                    <span className="font-medium">
                      {Math.round(factor.score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Platform</h4>
          <a
            href={venue.platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            {PLATFORM_LABELS[venue.platform]}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Scraped At */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Scraped</h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Feedback / Rejection Reason */}
        {venue.feedback && (
          <div className="space-y-2 p-3 bg-yellow-500/10 rounded-md border border-yellow-500/20">
            <h4 className="text-sm font-semibold text-yellow-700">Feedback</h4>
            <p className="text-sm text-muted-foreground">{venue.feedback}</p>
          </div>
        )}

        {venue.rejectionReason && (
          <div className="space-y-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
            <h4 className="text-sm font-semibold text-destructive">Rejection Reason</h4>
            <p className="text-sm text-muted-foreground">{venue.rejectionReason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
