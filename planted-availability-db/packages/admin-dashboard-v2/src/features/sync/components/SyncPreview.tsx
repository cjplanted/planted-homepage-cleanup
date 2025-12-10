/**
 * SyncPreview Component
 *
 * Shows pending changes organized by change type (additions, updates, removals).
 */

import { useState } from 'react';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/lib/utils';
import {
  SyncItem,
  SyncChangeType,
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_EMOJIS,
  CHANGE_TYPE_COLORS,
} from '../types';

interface SyncPreviewProps {
  additions: SyncItem[];
  updates: SyncItem[];
  removals: SyncItem[];
  selectedItems: Set<string>;
  onToggleItem: (itemId: string) => void;
  onToggleAll: (changeType: SyncChangeType) => void;
  onViewDiff: (item: SyncItem) => void;
  className?: string;
}

/**
 * SyncPreview Component
 */
export function SyncPreview({
  additions,
  updates,
  removals,
  selectedItems,
  onToggleItem,
  onToggleAll,
  onViewDiff,
  className,
}: SyncPreviewProps) {
  const [activeTab, setActiveTab] = useState<SyncChangeType>('addition');

  const tabs: { type: SyncChangeType; items: SyncItem[] }[] = [
    { type: 'addition', items: additions },
    { type: 'update', items: updates },
    { type: 'removal', items: removals },
  ];

  const activeItems = tabs.find((t) => t.type === activeTab)?.items || [];

  const areAllSelected = (items: SyncItem[]) => {
    return items.length > 0 && items.every((item) => selectedItems.has(item.id));
  };

  const handleToggleAll = () => {
    onToggleAll(activeTab);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(({ type, items }) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === type
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {CHANGE_TYPE_EMOJIS[type]} {CHANGE_TYPE_LABELS[type]}s ({items.length})
          </button>
        ))}
      </div>

      {/* Select All */}
      {activeItems.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={areAllSelected(activeItems)}
            onCheckedChange={handleToggleAll}
          />
          <label className="text-sm font-medium cursor-pointer" onClick={handleToggleAll}>
            Select All
          </label>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2">
        {activeItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No {CHANGE_TYPE_LABELS[activeTab].toLowerCase()}s pending
          </div>
        ) : (
          activeItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-md border border-border',
                'hover:bg-accent transition-colors',
                selectedItems.has(item.id) && 'bg-accent'
              )}
            >
              <Checkbox
                checked={selectedItems.has(item.id)}
                onCheckedChange={() => onToggleItem(item.id)}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm truncate">{item.venueName}</h4>
                  <Badge
                    variant={CHANGE_TYPE_COLORS[item.changeType] as any}
                    className="text-xs shrink-0"
                  >
                    {CHANGE_TYPE_EMOJIS[item.changeType]} {CHANGE_TYPE_LABELS[item.changeType]}
                  </Badge>
                </div>

                {item.dishCount !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {item.changeType === 'addition' && `+ ${item.dishCount} dishes`}
                    {item.changeType === 'update' && `${item.dishCount} dishes affected`}
                  </p>
                )}

                {item.dishName && (
                  <p className="text-xs text-muted-foreground">
                    Dish: {item.dishName}
                  </p>
                )}

                {item.diff && item.diff.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {item.diff.length} field{item.diff.length > 1 ? 's' : ''} changed
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDiff(item)}
              >
                View Diff
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
