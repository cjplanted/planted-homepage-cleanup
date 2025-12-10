/**
 * BrowserFilters Component
 *
 * Filter controls for the venue browser.
 */

import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import {
  BrowserFilters as Filters,
  StatusFilter,
  VenueType,
  DeliveryPlatform,
  STATUS_EMOJIS,
  STATUS_LABELS,
  VENUE_TYPE_LABELS,
  PLATFORM_LABELS,
} from '../types';

interface BrowserFiltersProps {
  filters: Filters;
  countries: string[];
  chains: string[];
  onFilterChange: <K extends keyof Filters>(key: K, value: Filters[K] | undefined) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  className?: string;
}

/**
 * BrowserFilters Component
 */
export function BrowserFilters({
  filters,
  countries,
  chains,
  onFilterChange,
  onReset,
  hasActiveFilters,
  className,
}: BrowserFiltersProps) {
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'live', label: `${STATUS_EMOJIS.live} ${STATUS_LABELS.live}` },
    { value: 'pending', label: `${STATUS_EMOJIS.pending} ${STATUS_LABELS.pending}` },
    { value: 'rejected', label: `${STATUS_EMOJIS.rejected} ${STATUS_LABELS.rejected}` },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Status and Search Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status Filter */}
        <div className="flex gap-2">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant={filters.status === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('status', option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search venues..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value || undefined)}
            className="pl-9"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange('search', undefined)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdowns Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Country Filter */}
        <select
          value={filters.country || ''}
          onChange={(e) => onFilterChange('country', e.target.value || undefined)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All Countries</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>

        {/* Chain Filter */}
        <select
          value={filters.chain || ''}
          onChange={(e) => onFilterChange('chain', e.target.value || undefined)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All Chains</option>
          {chains.map((chain) => (
            <option key={chain} value={chain}>
              {chain}
            </option>
          ))}
        </select>

        {/* Venue Type Filter */}
        <select
          value={filters.venueType || ''}
          onChange={(e) => onFilterChange('venueType', (e.target.value as VenueType) || undefined)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All Types</option>
          {Object.entries(VENUE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Platform Filter */}
        <select
          value={filters.platform || ''}
          onChange={(e) => onFilterChange('platform', (e.target.value as DeliveryPlatform) || undefined)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All Platforms</option>
          {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onReset} className="shrink-0">
            <X className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>

      {/* Active Filters Tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.status !== 'all' && (
            <Badge variant="secondary">
              Status: {STATUS_LABELS[filters.status as keyof typeof STATUS_LABELS]}
              <button
                onClick={() => onFilterChange('status', 'all')}
                className="ml-2 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.country && (
            <Badge variant="secondary">
              Country: {filters.country}
              <button
                onClick={() => onFilterChange('country', undefined)}
                className="ml-2 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.chain && (
            <Badge variant="secondary">
              Chain: {filters.chain}
              <button
                onClick={() => onFilterChange('chain', undefined)}
                className="ml-2 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.venueType && (
            <Badge variant="secondary">
              Type: {VENUE_TYPE_LABELS[filters.venueType]}
              <button
                onClick={() => onFilterChange('venueType', undefined)}
                className="ml-2 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.platform && (
            <Badge variant="secondary">
              Platform: {PLATFORM_LABELS[filters.platform]}
              <button
                onClick={() => onFilterChange('platform', undefined)}
                className="ml-2 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
