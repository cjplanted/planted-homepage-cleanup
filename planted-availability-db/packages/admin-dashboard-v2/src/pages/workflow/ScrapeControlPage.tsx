/**
 * Scrape Control Page
 *
 * Advanced scraping configuration and control interface.
 */

import { useState, useMemo } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { DiscoveryConfigDialog } from '@/features/scraping/components/DiscoveryConfigDialog';
import { ExtractionConfigDialog } from '@/features/scraping/components/ExtractionConfigDialog';
import { RunningOperations } from '@/features/scraping/components/RunningOperations';
import { BudgetStatus } from '@/features/scraping/components/BudgetStatus';
import { ScraperCard } from '@/features/scraping/components/ScraperCard';
import { useScrapers, useRecentRuns } from '@/features/scraping/hooks/useScrapers';
import { useScraperRun } from '@/features/scraping/hooks/useScraperRun';
import { useBudget } from '@/features/scraping/hooks/useBudget';
import type { DiscoveryConfig, ExtractionConfig, ScraperMetadata } from '@/features/scraping/types';

/**
 * Scrape Control Page
 */
export function ScrapeControlPage() {
  const [discoveryDialogOpen, setDiscoveryDialogOpen] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch available scrapers
  const { data: scrapersData, isLoading: scrapersLoading, error: scrapersError } = useScrapers();

  // Fetch recent runs with auto-refresh
  const {
    data: runsData,
    isLoading: runsLoading,
    refetch: refetchRuns,
  } = useRecentRuns(20, {
    enabled: true,
    refetchInterval: 30000, // 30 seconds
  });

  // Fetch budget status
  const { data: budgetData, isLoading: budgetLoading, error: budgetError } = useBudget({
    enabled: true,
    refetchInterval: 60000, // 1 minute
  });

  // Discovery scraper hook
  const discoveryRun = useScraperRun('discovery', {
    onComplete: () => {
      setDiscoveryDialogOpen(false);
      refetchRuns();
    },
    onError: (error) => {
      console.error('Discovery error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Discovery Failed: ${errorMessage}\n\nCheck console for details.`);
    },
  });

  // Extraction scraper hook
  const extractionRun = useScraperRun('extraction', {
    onComplete: () => {
      setExtractionDialogOpen(false);
      refetchRuns();
    },
    onError: (error) => {
      console.error('Extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Extraction Failed: ${errorMessage}\n\nCheck console for details.`);
    },
  });

  const handleDiscoveryStart = (config: DiscoveryConfig) => {
    discoveryRun.start(config);
  };

  const handleExtractionStart = (config: ExtractionConfig) => {
    extractionRun.start(config);
  };

  const handleCancelRun = (runId: string) => {
    if (discoveryRun.progress?.runId === runId) {
      discoveryRun.cancel(runId);
    } else if (extractionRun.progress?.runId === runId) {
      extractionRun.cancel(runId);
    }
  };

  // Get running operations
  const runningOperations = runsData?.runs.filter((r) => r.status === 'running') || [];

  // Get recent completed runs for history
  const recentHistory = runsData?.runs.filter(
    (r) => r.status === 'completed' || r.status === 'failed' || r.status === 'cancelled'
  ).slice(0, 10) || [];

  // Transform available scrapers data into ScraperMetadata format
  const scrapers: ScraperMetadata[] = useMemo(() => {
    if (!scrapersData) return [];

    // Find most recent runs for each type
    const discoveryRuns = runsData?.runs.filter(r => r.type === 'discovery') || [];
    const extractionRuns = runsData?.runs.filter(r => r.type === 'extraction') || [];
    const lastDiscovery = discoveryRuns[0];
    const lastExtraction = extractionRuns[0];

    const result: ScraperMetadata[] = [
      {
        type: 'discovery',
        name: 'Discovery Scraper',
        description: 'Discover new restaurants serving Planted products',
        lastRun: lastDiscovery ? {
          timestamp: lastDiscovery.startedAt,
          status: lastDiscovery.status,
          duration: lastDiscovery.completedAt
            ? Math.floor((new Date(lastDiscovery.completedAt).getTime() - new Date(lastDiscovery.startedAt).getTime()) / 1000)
            : 0,
        } : undefined,
        capabilities: {
          countries: (scrapersData.discovery?.countries || ['CH', 'DE', 'AT']) as ScraperMetadata['capabilities']['countries'],
          platforms: (scrapersData.discovery?.platforms || ['uber-eats', 'wolt', 'lieferando', 'deliveroo']) as ScraperMetadata['capabilities']['platforms'],
          modes: scrapersData.discovery?.modes.map(m => m.id) || ['explore', 'enumerate', 'verify'],
        },
      },
      {
        type: 'extraction',
        name: 'Extraction Scraper',
        description: 'Extract detailed menu information from restaurants',
        lastRun: lastExtraction ? {
          timestamp: lastExtraction.startedAt,
          status: lastExtraction.status,
          duration: lastExtraction.completedAt
            ? Math.floor((new Date(lastExtraction.completedAt).getTime() - new Date(lastExtraction.startedAt).getTime()) / 1000)
            : 0,
        } : undefined,
        capabilities: {
          countries: (scrapersData.discovery?.countries || ['CH', 'DE', 'AT']) as ScraperMetadata['capabilities']['countries'],
          platforms: (scrapersData.discovery?.platforms || ['uber-eats', 'wolt', 'lieferando', 'deliveroo']) as ScraperMetadata['capabilities']['platforms'],
          modes: scrapersData.extraction?.modes.map(m => m.id) || ['enrich', 'refresh', 'verify'],
        },
      },
    ];

    return result;
  }, [scrapersData, runsData]);

  if (scrapersLoading || runsLoading) {
    return <LoadingState message="Loading scrape control..." />;
  }

  if (scrapersError) {
    return (
      <ErrorState
        title="Failed to load scrapers"
        error={scrapersError as Error}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scraping Control</h1>
          <p className="text-muted-foreground">
            Configure and monitor scraping operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            {showHistory ? 'Hide' : 'Show'} History
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Scrapers and Operations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Available Scrapers */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Available Scrapers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scrapers.map((scraper) => (
                <ScraperCard
                  key={scraper.type}
                  scraper={scraper}
                  onRun={() => {
                    if (scraper.type === 'discovery') {
                      setDiscoveryDialogOpen(true);
                    } else {
                      setExtractionDialogOpen(true);
                    }
                  }}
                  disabled={
                    budgetData?.throttled ||
                    (scraper.type === 'discovery' && discoveryRun.isStarting) ||
                    (scraper.type === 'extraction' && extractionRun.isStarting)
                  }
                />
              ))}
            </div>
          </div>

          {/* Running Operations */}
          <RunningOperations
            operations={runningOperations}
            onCancel={handleCancelRun}
            isCancelling={discoveryRun.isCancelling || extractionRun.isCancelling}
          />

          {/* History */}
          {showHistory && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentHistory.map((run) => (
                    <div
                      key={run.runId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{run.runId}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Type: {run.type}</span>
                          <span>Found: {run.stats.found}</span>
                          <span>Errors: {run.stats.errors}</span>
                          <span>Cost: ${run.cost.total.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="text-sm">
                        <span
                          className={
                            run.status === 'completed'
                              ? 'text-green-500 font-medium'
                              : run.status === 'failed'
                              ? 'text-destructive font-medium'
                              : 'text-muted-foreground'
                          }
                        >
                          {run.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {recentHistory.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent history
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Budget Status */}
        <div className="space-y-6">
          {budgetLoading ? (
            <LoadingState message="Loading budget..." size="sm" />
          ) : budgetError ? (
            <ErrorState
              title="Failed to load budget"
              error={budgetError as Error}
              className="p-4"
            />
          ) : budgetData ? (
            <BudgetStatus budget={budgetData} />
          ) : null}
        </div>
      </div>

      {/* Discovery Dialog */}
      <DiscoveryConfigDialog
        open={discoveryDialogOpen}
        onOpenChange={setDiscoveryDialogOpen}
        onStart={handleDiscoveryStart}
        isStarting={discoveryRun.isStarting}
      />

      {/* Extraction Dialog */}
      <ExtractionConfigDialog
        open={extractionDialogOpen}
        onOpenChange={setExtractionDialogOpen}
        onStart={handleExtractionStart}
        isStarting={extractionRun.isStarting}
      />
    </div>
  );
}

export default ScrapeControlPage;
