/**
 * ExtractionConfigDialog Component
 *
 * Configuration dialog for starting an extraction scraper.
 */

import { useState } from 'react';
import { Play } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Label } from '@/shared/ui/Label';
import type { ExtractionConfig, ExtractionTarget, ExtractionMode } from '../types';

interface ExtractionConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (config: ExtractionConfig) => void;
  isStarting?: boolean;
}

const TARGETS: { value: ExtractionTarget; label: string; description: string }[] = [
  {
    value: 'all',
    label: 'All Pending',
    description: 'Extract dishes from all pending venues',
  },
  {
    value: 'chain',
    label: 'Specific Chain',
    description: 'Extract dishes from venues of a specific chain',
  },
  {
    value: 'venue',
    label: 'Specific Venue',
    description: 'Extract dishes from a single venue by ID',
  },
];

const MODES: { value: ExtractionMode; label: string; description: string }[] = [
  {
    value: 'enrich',
    label: 'Enrich',
    description: 'Add missing dish information',
  },
  {
    value: 'refresh',
    label: 'Refresh',
    description: 'Update existing dish data',
  },
  {
    value: 'verify',
    label: 'Verify',
    description: 'Verify dish availability and pricing',
  },
];

/**
 * Extraction Config Dialog Component
 */
export function ExtractionConfigDialog({
  open,
  onOpenChange,
  onStart,
  isStarting = false,
}: ExtractionConfigDialogProps) {
  const [target, setTarget] = useState<ExtractionTarget>('all');
  const [chain, setChain] = useState('');
  const [venueId, setVenueId] = useState('');
  const [maxVenues, setMaxVenues] = useState(50);
  const [mode, setMode] = useState<ExtractionMode>('enrich');

  const handleStart = () => {
    const config: ExtractionConfig = {
      target,
      chainId: target === 'chain' ? chain : undefined,
      venueId: target === 'venue' ? venueId : undefined,
      maxVenues,
      mode,
    };
    onStart(config);
  };

  const isValid =
    (target === 'all' ||
      (target === 'chain' && chain.trim().length > 0) ||
      (target === 'venue' && venueId.trim().length > 0)) &&
    maxVenues > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Extraction Scraper</DialogTitle>
          <DialogDescription>
            Set up parameters for dish extraction scraping
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Target */}
          <div className="space-y-3">
            <Label>Extraction Target</Label>
            <div className="space-y-2">
              {TARGETS.map((t) => (
                <label
                  key={t.value}
                  className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="radio"
                    name="target"
                    value={t.value}
                    checked={target === t.value}
                    onChange={(e) => setTarget(e.target.value as ExtractionTarget)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{t.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Chain (conditional) */}
          {target === 'chain' && (
            <div className="space-y-2">
              <Label htmlFor="chain">Chain Name</Label>
              <Input
                id="chain"
                placeholder="e.g., Planted"
                value={chain}
                onChange={(e) => setChain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the chain name to extract dishes from
              </p>
            </div>
          )}

          {/* Venue ID (conditional) */}
          {target === 'venue' && (
            <div className="space-y-2">
              <Label htmlFor="venueId">Venue ID</Label>
              <Input
                id="venueId"
                placeholder="e.g., venue-123"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the venue ID to extract dishes from
              </p>
            </div>
          )}

          {/* Max Venues */}
          <div className="space-y-2">
            <Label htmlFor="maxVenues">Max Venues</Label>
            <Input
              id="maxVenues"
              type="number"
              min={1}
              max={1000}
              value={maxVenues}
              onChange={(e) => setMaxVenues(parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of venues to process
            </p>
          </div>

          {/* Mode */}
          <div className="space-y-3">
            <Label>Extraction Mode</Label>
            <div className="space-y-2">
              {MODES.map((m) => (
                <label
                  key={m.value}
                  className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m.value}
                    checked={mode === m.value}
                    onChange={(e) => setMode(e.target.value as ExtractionMode)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{m.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={!isValid || isStarting}>
            <Play className="h-4 w-4 mr-2" />
            {isStarting ? 'Starting...' : 'Start Extraction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
