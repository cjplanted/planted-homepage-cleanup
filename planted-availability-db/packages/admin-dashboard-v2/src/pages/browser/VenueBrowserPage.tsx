/**
 * Venue Browser Page
 *
 * Browse and search all venues (live, pending, rejected) with multiple view modes.
 */

import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { cn } from '@/lib/utils';
import {
  useVenueBrowser,
  useFilters,
  ViewMode,
  ViewToggle,
  BrowserFilters,
  BrowserFiltersComponent,
  VenueTree,
  VenueTable,
  VenueCards,
  VenueDetail,
  exportVenuesToCSV,
  STATUS_EMOJIS,
} from '@/features/browser';

/**
 * VenueBrowserPage Component
 */
export function VenueBrowserPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [selectedVenueId, setSelectedVenueId] = useState<string>();
  const [isExporting, setIsExporting] = useState(false);

  const { filters, setFilter, resetFilters, hasActiveFilters } = useFilters();
  const { data, isLoading, error, refetch } = useVenueBrowser(filters);

  // Get unique countries and chains for filters
  const { countries, chains } = useMemo(() => {
    if (!data?.venues) return { countries: [], chains: [] };

    const countrySet = new Set<string>();
    const chainSet = new Set<string>();

    data.venues.forEach((venue) => {
      countrySet.add(venue.country);
      if (venue.chain) {
        chainSet.add(venue.chain);
      }
    });

    return {
      countries: Array.from(countrySet).sort(),
      chains: Array.from(chainSet).sort(),
    };
  }, [data]);

  // Get selected venue
  const selectedVenue = useMemo(() => {
    if (!selectedVenueId || !data?.venues) return undefined;
    return data.venues.find((v) => v.id === selectedVenueId);
  }, [selectedVenueId, data]);

  // Handle sort
  const handleSort = (field: BrowserFilters['sortBy']) => {
    if (filters.sortBy === field) {
      // Toggle sort order
      setFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field with default ascending order
      setFilter('sortBy', field);
      setFilter('sortOrder', 'asc');
    }
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportVenuesToCSV(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `venues-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export venues:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState message="Loading venues..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState
          title="Failed to load venues"
          message={error.message}
          onRetry={refetch}
        />
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState
          title="No data available"
          message="Unable to load venue data"
          onRetry={refetch}
        />
      </div>
    );
  }

  const { venues, hierarchy, stats } = data;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Venue Browser</h1>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          {/* Filters */}
          <BrowserFiltersComponent
            filters={filters}
            countries={countries}
            chains={chains}
            onFilterChange={setFilter}
            onReset={resetFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {/* Stats Bar */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="font-semibold">{stats.total}</span> total
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1">
                <span>{STATUS_EMOJIS.live}</span>
                <span className="font-semibold">{stats.live}</span> live
              </div>
              <div className="flex items-center gap-1">
                <span>{STATUS_EMOJIS.pending}</span>
                <span className="font-semibold">{stats.pending}</span> pending
              </div>
              <div className="flex items-center gap-1">
                <span>{STATUS_EMOJIS.rejected}</span>
                <span className="font-semibold">{stats.rejected}</span> rejected
              </div>
              <div className="h-4 w-px bg-border" />
              <div>
                <span className="font-semibold">{stats.totalDishes}</span> dishes
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - List View */}
        <div className={cn('border-r border-border bg-background overflow-auto', selectedVenue ? 'w-1/2' : 'w-full')}>
          <div className="p-4">
            {viewMode === 'tree' && (
              <VenueTree
                hierarchy={hierarchy}
                selectedVenueId={selectedVenueId}
                onSelectVenue={setSelectedVenueId}
              />
            )}

            {viewMode === 'table' && (
              <VenueTable
                venues={venues}
                selectedVenueId={selectedVenueId}
                onSelectVenue={setSelectedVenueId}
                sortBy={filters.sortBy || 'name'}
                sortOrder={filters.sortOrder || 'asc'}
                onSort={handleSort}
              />
            )}

            {viewMode === 'cards' && (
              <VenueCards
                venues={venues}
                selectedVenueId={selectedVenueId}
                onSelectVenue={setSelectedVenueId}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Detail View */}
        {selectedVenue && (
          <div className="w-1/2 bg-muted/20 overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Venue Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedVenueId(undefined)}
                >
                  Close
                </Button>
              </div>
              <VenueDetail venue={selectedVenue} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
