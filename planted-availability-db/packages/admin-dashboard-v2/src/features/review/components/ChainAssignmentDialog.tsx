/**
 * ChainAssignmentDialog Component
 *
 * Dialog for assigning venues to existing chains or creating new chains.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChains, assignChain, type Chain } from '../api/reviewApi';

interface ChainAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueIds: string[];
  onSuccess?: () => void;
}

/**
 * Chain Assignment Dialog Component
 */
export function ChainAssignmentDialog({
  open,
  onOpenChange,
  venueIds,
  onSuccess,
}: ChainAssignmentDialogProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedChainId, setSelectedChainId] = useState<string>('');
  const [newChainName, setNewChainName] = useState('');

  const queryClient = useQueryClient();

  // Fetch chains
  const { data: chains = [], isLoading: chainsLoading } = useQuery({
    queryKey: ['chains'],
    queryFn: getChains,
    enabled: open,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMode('existing');
      setSelectedChainId('');
      setNewChainName('');
    }
  }, [open]);

  // Assign chain mutation
  const assignMutation = useMutation({
    mutationFn: assignChain,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['chains'] });
      alert(`Successfully assigned ${result.updatedCount} venue(s) to chain "${result.chainName}"`);
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to assign chain: ${errorMessage}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'existing' && !selectedChainId) {
      return;
    }

    if (mode === 'new' && !newChainName.trim()) {
      return;
    }

    assignMutation.mutate({
      venueIds,
      chainId: mode === 'existing' ? selectedChainId : undefined,
      newChainName: mode === 'new' ? newChainName.trim() : undefined,
    });
  };

  const canSubmit = mode === 'existing' ? selectedChainId : newChainName.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Chain</DialogTitle>
          <DialogDescription>
            Assign {venueIds.length} venue{venueIds.length > 1 ? 's' : ''} to a chain
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Assignment Type</Label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="existing"
                  checked={mode === 'existing'}
                  onChange={() => setMode('existing')}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">Select Existing Chain</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="new"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">Create New Chain</span>
              </label>
            </div>
          </div>

          {/* Existing Chain Selection */}
          {mode === 'existing' && (
            <div className="space-y-2">
              <Label htmlFor="chain-select">Chain</Label>
              {chainsLoading ? (
                <div className="flex items-center justify-center h-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <select
                  id="chain-select"
                  value={selectedChainId}
                  onChange={(e) => setSelectedChainId(e.target.value)}
                  disabled={assignMutation.isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a chain...</option>
                  {chains.map((chain: Chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              )}
              {chains.length === 0 && !chainsLoading && (
                <p className="text-sm text-muted-foreground">
                  No chains found. Create a new chain instead.
                </p>
              )}
            </div>
          )}

          {/* New Chain Input */}
          {mode === 'new' && (
            <div className="space-y-2">
              <Label htmlFor="chain-name">Chain Name</Label>
              <Input
                id="chain-name"
                type="text"
                placeholder="Enter chain name..."
                value={newChainName}
                onChange={(e) => setNewChainName(e.target.value)}
                disabled={assignMutation.isPending}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={assignMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || assignMutation.isPending}
            >
              {assignMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
