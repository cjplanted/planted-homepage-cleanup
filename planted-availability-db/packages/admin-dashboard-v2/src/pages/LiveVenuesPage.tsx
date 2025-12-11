/**
 * LiveVenuesPage
 *
 * Main page for browsing and managing live (production) venues.
 * Similar layout to ReviewQueuePage but for production venues collection.
 */

import { useState } from 'react';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  useLiveVenues,
  useMarkVenueStale,
  useArchiveVenue,
  useReactivateVenue,
  LiveVenueTree,
  LiveVenueFilters,
  LiveVenueStats,
  LiveVenueDetail,
} from '@/features/live-venues';
import type { LiveVenuesFilters, LiveVenue } from '@/features/live-venues';

export function LiveVenuesPage() {
  // Filter state
  const [filters, setFilters] = useState<LiveVenuesFilters>({
    page: 1,
    pageSize: 100,
  });

  // Selected venue state - store full venue object from hierarchy
  const [selectedVenue, setSelectedVenue] = useState<LiveVenue | undefined>();

  // Fetch data
  const { data, isLoading, isError, error, refetch } = useLiveVenues(filters);

  // Mutations
  const markStaleMutation = useMarkVenueStale({
    onSuccess: () => {
      // Toast or notification could go here
    },
  });

  const archiveMutation = useArchiveVenue({
    onSuccess: () => {
      // Toast or notification could go here
    },
  });

  const reactivateMutation = useReactivateVenue({
    onSuccess: () => {
      // Toast or notification could go here
    },
  });

  const isMutating = markStaleMutation.isPending || archiveMutation.isPending || reactivateMutation.isPending;

  // Handle venue selection - receive full venue object from tree
  const handleSelectVenue = (venue: LiveVenue) => {
    setSelectedVenue(venue);
  };

  // Handle actions
  const handleMarkStale = (venueId: string) => {
    markStaleMutation.mutate(venueId);
  };

  const handleArchive = (venueId: string) => {
    archiveMutation.mutate(venueId);
  };

  const handleReactivate = (venueId: string) => {
    reactivateMutation.mutate(venueId);
  };

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading live venues..." />;
  }

  // Error state
  if (isError) {
    return (
      <ErrorState
        title="Failed to load venues"
        message={error?.message || 'An error occurred while loading venues.'}
        onRetry={() => refetch()}
      />
    );
  }

  // Empty state
  if (!data || data.items.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <LiveVenueFilters filters={filters} onFiltersChange={setFilters} />
        <EmptyState
          title="No venues found"
          description="No live venues match your current filters. Try adjusting your filters or check back later."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
        {/* Stats Bar */}
        <div className="p-4 border-b">
          <LiveVenueStats stats={data.stats} />
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b bg-muted/30">
          <LiveVenueFilters filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Main Content - Split View */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Hierarchy Tree */}
          <div className="w-1/4 min-w-[280px] max-w-[400px] border-r overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-muted/30">
              <h2 className="text-sm font-medium">
                Venues ({data.pagination.total.toLocaleString()})
              </h2>
            </div>
            <LiveVenueTree
              hierarchy={data.hierarchy}
              selectedVenueId={selectedVenue?.id}
              onSelectVenue={handleSelectVenue}
              className="flex-1 p-2"
            />
          </div>

          {/* Right Panel - Venue Detail */}
          <div className="flex-1 overflow-hidden">
            {selectedVenue ? (
              <LiveVenueDetail
                venue={selectedVenue}
                onMarkStale={handleMarkStale}
                onArchive={handleArchive}
                onReactivate={handleReactivate}
                isLoading={isMutating}
                className="h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>Select a venue from the list to view details</p>
              </div>
            )}
          </div>
        </div>

      {/* Pagination Info */}
      {data.pagination.totalPages > 1 && (
        <div className="p-3 border-t bg-muted/30 text-sm text-muted-foreground text-center">
          Showing {data.items.length} of {data.pagination.total} venues
          {data.pagination.hasMore && (
            <span className="ml-2">
              (Page {data.pagination.page} of {data.pagination.totalPages})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
