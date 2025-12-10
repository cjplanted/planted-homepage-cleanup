/**
 * FilterBar Component
 *
 * Filter controls for the review queue including country, status,
 * confidence range, and search.
 */

import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/lib/utils';
import { ReviewQueueFilters } from '../types';

interface FilterBarProps {
  filters: ReviewQueueFilters;
  onChange: (filters: ReviewQueueFilters) => void;
  onReset: () => void;
  className?: string;
}

/**
 * FilterBar Component
 */
export function FilterBar({ filters, onChange, onReset, className }: FilterBarProps) {
  const hasActiveFilters =
    filters.country ||
    filters.status ||
    filters.venueType ||
    filters.platform ||
    filters.minConfidence !== undefined ||
    filters.maxConfidence !== undefined ||
    filters.search;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search venues..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2">
        {/* Country Filter */}
        <select
          value={filters.country || ''}
          onChange={(e) =>
            onChange({ ...filters, country: e.target.value || undefined })
          }
          className={cn(
            'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <option value="">All Countries</option>
          <option value="CH">🇨🇭 Switzerland</option>
          <option value="DE">🇩🇪 Germany</option>
          <option value="AT">🇦🇹 Austria</option>
          <option value="UK">🇬🇧 United Kingdom</option>
          <option value="FR">🇫🇷 France</option>
          <option value="IT">🇮🇹 Italy</option>
          <option value="ES">🇪🇸 Spain</option>
          <option value="NL">🇳🇱 Netherlands</option>
        </select>

        {/* Status Filter */}
        <select
          value={filters.status || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              status: e.target.value ? (e.target.value as any) : undefined,
            })
          }
          className={cn(
            'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Venue Type Filter */}
        <select
          value={filters.venueType || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              venueType: e.target.value ? (e.target.value as any) : undefined,
            })
          }
          className={cn(
            'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <option value="">All Types</option>
          <option value="restaurant">Restaurant</option>
          <option value="cafe">Cafe</option>
          <option value="hotel">Hotel</option>
          <option value="food_truck">Food Truck</option>
          <option value="catering">Catering</option>
          <option value="other">Other</option>
        </select>

        {/* Platform Filter */}
        <select
          value={filters.platform || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              platform: e.target.value ? (e.target.value as any) : undefined,
            })
          }
          className={cn(
            'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <option value="">All Platforms</option>
          <option value="uber_eats">Uber Eats</option>
          <option value="deliveroo">Deliveroo</option>
          <option value="wolt">Wolt</option>
          <option value="just_eat">Just Eat</option>
          <option value="doordash">DoorDash</option>
          <option value="other">Other</option>
        </select>

        {/* Confidence Filter */}
        <select
          value={
            filters.minConfidence !== undefined
              ? `${filters.minConfidence}`
              : ''
          }
          onChange={(e) => {
            const value = e.target.value;
            if (value === '') {
              const { minConfidence, maxConfidence, ...rest } = filters;
              onChange(rest);
            } else if (value === '0.8') {
              onChange({ ...filters, minConfidence: 0.8, maxConfidence: undefined });
            } else if (value === '0.6') {
              onChange({ ...filters, minConfidence: 0.6, maxConfidence: 0.8 });
            } else if (value === '0') {
              onChange({ ...filters, minConfidence: 0, maxConfidence: 0.6 });
            }
          }}
          className={cn(
            'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <option value="">All Confidence</option>
          <option value="0.8">High (80%+)</option>
          <option value="0.6">Medium (60-80%)</option>
          <option value="0">Low (&lt;60%)</option>
        </select>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-9"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
