/**
 * DiscoveryConfigDialog Component
 *
 * Configuration dialog for starting a discovery scraper.
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
import { Checkbox } from '@/shared/ui/Checkbox';
import type { DiscoveryConfig, Country, Platform, DiscoveryMode } from '../types';

interface DiscoveryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (config: DiscoveryConfig) => void;
  isStarting?: boolean;
}

const COUNTRIES: Country[] = ['CH', 'DE', 'AT'];
const PLATFORMS: Platform[] = ['uber-eats', 'wolt', 'lieferando', 'deliveroo'];
const MODES: { value: DiscoveryMode; label: string; description: string }[] = [
  {
    value: 'explore',
    label: 'Explore',
    description: 'Discover new venues in selected regions',
  },
  {
    value: 'enumerate',
    label: 'Enumerate',
    description: 'Find all locations for a specific chain',
  },
  {
    value: 'verify',
    label: 'Verify',
    description: 'Verify existing venues are still available',
  },
];

/**
 * Discovery Config Dialog Component
 */
export function DiscoveryConfigDialog({
  open,
  onOpenChange,
  onStart,
  isStarting = false,
}: DiscoveryConfigDialogProps) {
  const [countries, setCountries] = useState<Country[]>(['CH']);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [mode, setMode] = useState<DiscoveryMode>('explore');
  const [chain, setChain] = useState('');
  const [maxQueries, setMaxQueries] = useState(50);
  const [dryRun, setDryRun] = useState(false);

  const handleCountryToggle = (country: Country) => {
    setCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country]
    );
  };

  const handlePlatformToggle = (platform: Platform) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleStart = () => {
    const config: DiscoveryConfig = {
      countries,
      platforms: platforms.length > 0 ? platforms : PLATFORMS, // Default to all if none selected
      mode,
      chainId: mode === 'enumerate' ? chain : undefined,
      maxQueries,
      dryRun,
    };
    onStart(config);
  };

  const isValid =
    countries.length > 0 &&
    (mode !== 'enumerate' || chain.trim().length > 0) &&
    maxQueries > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Discovery Scraper</DialogTitle>
          <DialogDescription>
            Set up parameters for venue discovery scraping
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Countries */}
          <div className="space-y-3">
            <Label>Countries</Label>
            <div className="flex flex-wrap gap-3">
              {COUNTRIES.map((country) => (
                <Checkbox
                  key={country}
                  label={country}
                  checked={countries.includes(country)}
                  onChange={() => handleCountryToggle(country)}
                />
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <Label>Platforms (leave empty for all)</Label>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((platform) => (
                <Checkbox
                  key={platform}
                  label={platform}
                  checked={platforms.includes(platform)}
                  onChange={() => handlePlatformToggle(platform)}
                />
              ))}
            </div>
          </div>

          {/* Mode */}
          <div className="space-y-3">
            <Label>Discovery Mode</Label>
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
                    onChange={(e) => setMode(e.target.value as DiscoveryMode)}
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

          {/* Chain (conditional) */}
          {mode === 'enumerate' && (
            <div className="space-y-2">
              <Label htmlFor="chain">Chain Name</Label>
              <Input
                id="chain"
                placeholder="e.g., Planted"
                value={chain}
                onChange={(e) => setChain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the chain name to find all locations
              </p>
            </div>
          )}

          {/* Max Queries */}
          <div className="space-y-2">
            <Label htmlFor="maxQueries">Max Queries</Label>
            <Input
              id="maxQueries"
              type="number"
              min={1}
              max={1000}
              value={maxQueries}
              onChange={(e) => setMaxQueries(parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of search queries to execute
            </p>
          </div>

          {/* Dry Run */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="dryRun"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            <Label htmlFor="dryRun" className="cursor-pointer">
              Dry Run (preview without saving)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={!isValid || isStarting}>
            <Play className="h-4 w-4 mr-2" />
            {isStarting ? 'Starting...' : 'Start Discovery'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
