/**
 * LiveVenueActions Component
 *
 * Action buttons for managing live venue status (mark stale, archive, reactivate).
 */

import { useState } from 'react';
import { Clock, Archive, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog';
import type { LiveVenue } from '../types';

interface LiveVenueActionsProps {
  venue: LiveVenue;
  onMarkStale: (venueId: string) => void;
  onArchive: (venueId: string) => void;
  onReactivate: (venueId: string) => void;
  isLoading?: boolean;
}

type ActionType = 'stale' | 'archive' | 'reactivate' | null;

export function LiveVenueActions({
  venue,
  onMarkStale,
  onArchive,
  onReactivate,
  isLoading = false,
}: LiveVenueActionsProps) {
  const [confirmAction, setConfirmAction] = useState<ActionType>(null);

  const handleConfirm = () => {
    if (!confirmAction) return;

    switch (confirmAction) {
      case 'stale':
        onMarkStale(venue.id);
        break;
      case 'archive':
        onArchive(venue.id);
        break;
      case 'reactivate':
        onReactivate(venue.id);
        break;
    }
    setConfirmAction(null);
  };

  const getDialogContent = () => {
    switch (confirmAction) {
      case 'stale':
        return {
          title: 'Mark Venue as Stale',
          description: `Are you sure you want to mark "${venue.name}" as stale? This indicates the venue data needs re-verification.`,
          confirmText: 'Mark Stale',
          icon: <Clock className="h-6 w-6 text-yellow-600" />,
        };
      case 'archive':
        return {
          title: 'Archive Venue',
          description: `Are you sure you want to archive "${venue.name}"? This indicates the venue no longer serves Planted products.`,
          confirmText: 'Archive',
          icon: <Archive className="h-6 w-6 text-gray-600" />,
        };
      case 'reactivate':
        return {
          title: 'Reactivate Venue',
          description: `Are you sure you want to reactivate "${venue.name}"? This will mark the venue as active and update its verification date.`,
          confirmText: 'Reactivate',
          icon: <CheckCircle className="h-6 w-6 text-green-600" />,
        };
      default:
        return null;
    }
  };

  const dialogContent = getDialogContent();

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Mark Stale - only show for active venues */}
        {venue.status === 'active' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmAction('stale')}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Mark Stale
          </Button>
        )}

        {/* Archive - show for active and stale venues */}
        {(venue.status === 'active' || venue.status === 'stale') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmAction('archive')}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        )}

        {/* Reactivate - show for stale and archived venues */}
        {(venue.status === 'stale' || venue.status === 'archived') && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setConfirmAction('reactivate')}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Reactivate
          </Button>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              {dialogContent?.icon}
              <DialogTitle>{dialogContent?.title}</DialogTitle>
            </div>
            <DialogDescription>{dialogContent?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              variant={confirmAction === 'archive' ? 'destructive' : 'default'}
            >
              {isLoading ? 'Processing...' : dialogContent?.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
