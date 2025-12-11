/**
 * LiveVenueFilters Component
 *
 * Filter bar for the live venues browser.
 * Supports country, status, venue type, and search filters.
 */

import { Search, X } from 'lucide-react';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import type { LiveVenuesFilters } from '../types';
import {
  COUNTRY_LABELS,
  STATUS_LABELS,
  VENUE_TYPE_LABELS,
} from '../types';
import type { VenueType, VenueStatus } from '@pad/core';

interface LiveVenueFiltersProps {
  filters: LiveVenuesFilters;
  onFiltersChange: (filters: LiveVenuesFilters) => void;
  className?: string;
}

export function LiveVenueFilters({
  filters,
  onFiltersChange,
  className,
}: LiveVenueFiltersProps) {
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    onFiltersChange({ ...filters, country: value, page: 1 });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = (e.target.value || undefined) as VenueStatus | undefined;
    onFiltersChange({ ...filters, status: value, page: 1 });
  };

  const handleVenueTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = (e.target.value || undefined) as VenueType | undefined;
    onFiltersChange({ ...filters, venueType: value, page: 1 });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value, page: 1 });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      page: 1,
      pageSize: filters.pageSize,
    });
  };

  const hasActiveFilters = filters.country || filters.status || filters.venueType || filters.search;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Country Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="country-filter" className="text-sm font-medium text-muted-foreground">
            Country:
          </label>
          <select
            id="country-filter"
            value={filters.country || ''}
            onChange={handleCountryChange}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Countries</option>
            {Object.entries(COUNTRY_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground">
            Status:
          </label>
          <select
            id="status-filter"
            value={filters.status || ''}
            onChange={handleStatusChange}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Venue Type Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="type-filter" className="text-sm font-medium text-muted-foreground">
            Type:
          </label>
          <select
            id="type-filter"
            value={filters.venueType || ''}
            onChange={handleVenueTypeChange}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Types</option>
            {Object.entries(VENUE_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search venues..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
