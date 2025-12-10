/**
 * ViewToggle Component
 *
 * Toggle button group for switching between tree, table, and card views.
 */

import { List, Table, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViewMode } from '../types';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

/**
 * ViewToggle Component
 */
export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  const options: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'tree', icon: <List className="h-4 w-4" />, label: 'Tree' },
    { mode: 'table', icon: <Table className="h-4 w-4" />, label: 'Table' },
    { mode: 'cards', icon: <LayoutGrid className="h-4 w-4" />, label: 'Cards' },
  ];

  return (
    <div className={cn('inline-flex items-center rounded-md border border-border', className)}>
      {options.map((option, index) => (
        <button
          key={option.mode}
          onClick={() => onChange(option.mode)}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            value === option.mode
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-background text-muted-foreground',
            index === 0 && 'rounded-l-md',
            index === options.length - 1 && 'rounded-r-md',
            index > 0 && 'border-l border-border'
          )}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
