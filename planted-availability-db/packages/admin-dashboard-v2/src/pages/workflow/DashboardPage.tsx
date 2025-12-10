/**
 * Workflow Dashboard Page
 *
 * Main dashboard showing pipeline status, quick actions, stats, and running operations.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Settings, Play, ListChecks, Globe } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { PipelineStatus } from '@/features/scraping/components/PipelineStatus';
import { RunningOperations } from '@/features/scraping/components/RunningOperations';
import { DiscoveryConfigDialog } from '@/features/scraping/components/DiscoveryConfigDialog';
import { ExtractionConfigDialog } from '@/features/scraping/components/ExtractionConfigDialog';
import { useRecentRuns } from '@/features/scraping/hooks/useScrapers';
import { useScraperRun } from '@/features/scraping/hooks/useScraperRun';
import type { PipelineStage, DiscoveryConfig, ExtractionConfig } from '@/features/scraping/types';

/**
 * Format cost
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Workflow Dashboard Page
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const [autoRefresh] = useState(true);
  const [discoveryDialogOpen, setDiscoveryDialogOpen] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);

  // Fetch recent runs with auto-refresh
  const {
    data: runsData,
    isLoading,
    error,
    refetch,
  } = useRecentRuns(10, {
    enabled: true,
    refetchInterval: autoRefresh ? 30000 : undefined, // 30 seconds
  });

  // Discovery scraper hook
  const discoveryRun = useScraperRun('discovery', {
    onComplete: () => {
      setDiscoveryDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error('Discovery error:', error);
    },
  });

  // Extraction scraper hook
  const extractionRun = useScraperRun('extraction', {
    onComplete: () => {
      setExtractionDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error('Extraction error:', error);
    },
  });

  const handleDiscoveryStart = (config: DiscoveryConfig) => {
    discoveryRun.start(config);
  };

  const handleExtractionStart = (config: ExtractionConfig) => {
    extractionRun.start(config);
  };

  // Mock pipeline stages (in real app, this would come from API)
  const pipelineStages: PipelineStage[] = [
    {
      stage: 'scraping',
      status: runsData?.runs.some((r) => r.type === 'discovery' && r.status === 'running')
        ? 'running'
        : 'idle',
      activeCount: runsData?.runs.filter((r) => r.type === 'discovery' && r.status === 'running').length || 0,
    },
    {
      stage: 'extraction',
      status: runsData?.runs.some((r) => r.type === 'extraction' && r.status === 'running')
        ? 'running'
        : 'idle',
      activeCount: runsData?.runs.filter((r) => r.type === 'extraction' && r.status === 'running').length || 0,
    },
    {
      stage: 'review',
      status: 'idle',
      count: 47,
    },
    {
      stage: 'website',
      status: 'completed',
      count: 234,
    },
  ];

  // Calculate today's stats from recent runs
  const todayStats = {
    discovered: runsData?.runs
      .filter((r) => r.type === 'discovery' && r.status === 'completed')
      .reduce((sum, r) => sum + r.stats.found, 0) || 0,
    approved: 18, // Mock data
    rejected: 5, // Mock data
    costs: runsData?.runs
      .reduce((sum, r) => sum + r.cost.total, 0) || 0,
  };

  // Get running operations
  const runningOperations = runsData?.runs.filter((r) => r.status === 'running') || [];

  const handleStageClick = (stage: PipelineStage) => {
    switch (stage.stage) {
      case 'review':
        navigate('/review');
        break;
      case 'website':
        navigate('/live-venues');
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading workflow dashboard..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        error={error as Error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and control your data pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/workflow/scrape-control')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Scrape Control
          </Button>
        </div>
      </div>

      {/* Pipeline Status */}
      <PipelineStatus stages={pipelineStages} onStageClick={handleStageClick} />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setDiscoveryDialogOpen(true)}
              disabled={discoveryRun.isStarting}
            >
              <Play className="h-4 w-4 mr-2" />
              Discovery: CH
            </Button>
            <Button
              variant="outline"
              onClick={() => setDiscoveryDialogOpen(true)}
              disabled={discoveryRun.isStarting}
            >
              <Play className="h-4 w-4 mr-2" />
              Discovery: DE
            </Button>
            <Button
              variant="outline"
              onClick={() => setExtractionDialogOpen(true)}
              disabled={extractionRun.isStarting}
            >
              <Play className="h-4 w-4 mr-2" />
              Extract Dishes
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/review')}
            >
              <ListChecks className="h-4 w-4 mr-2" />
              Review Queue
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/sync')}
            >
              <Globe className="h-4 w-4 mr-2" />
              Sync to Website
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats and Running Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Discovered</span>
                <span className="text-2xl font-bold">{todayStats.discovered}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Approved</span>
                <span className="text-2xl font-bold text-green-500">
                  {todayStats.approved}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rejected</span>
                <span className="text-2xl font-bold text-destructive">
                  {todayStats.rejected}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-sm font-semibold">Costs</span>
                <span className="text-2xl font-bold">
                  {formatCost(todayStats.costs)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Running Operations */}
        <div className="lg:col-span-2">
          <RunningOperations
            operations={runningOperations}
            onCancel={(runId) => {
              if (discoveryRun.progress?.runId === runId) {
                discoveryRun.cancel(runId);
              } else if (extractionRun.progress?.runId === runId) {
                extractionRun.cancel(runId);
              }
            }}
            isCancelling={discoveryRun.isCancelling || extractionRun.isCancelling}
          />
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

export default DashboardPage;
