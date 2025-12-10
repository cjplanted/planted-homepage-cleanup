/**
 * useScraperRun Hook
 *
 * Manages scraper run lifecycle: start, track progress via SSE, cancel.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  startDiscovery,
  startExtraction,
  cancelScraperRun,
  createScraperProgressStream,
  setupProgressEventHandlers,
} from '../api/scraperApi';
import type {
  DiscoveryConfig,
  ExtractionConfig,
  ScraperProgress,
  ScraperType,
} from '../types';

interface UseScraperRunOptions {
  onComplete?: (progress: ScraperProgress) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to manage a scraper run with real-time progress tracking
 */
export function useScraperRun(type: ScraperType, options?: UseScraperRunOptions) {
  const [progress, setProgress] = useState<ScraperProgress | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Setup progress stream
  const setupProgressStream = useCallback(
    async (runId: string) => {
      try {
        setIsStreaming(true);
        const eventSource = await createScraperProgressStream(runId);
        eventSourceRef.current = eventSource;

        setupProgressEventHandlers(eventSource, {
          onProgress: (newProgress) => {
            setProgress(newProgress);
          },
          onComplete: (finalProgress) => {
            setProgress(finalProgress);
            setIsStreaming(false);
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['scrapers', 'runs'] });
            queryClient.invalidateQueries({ queryKey: ['budget'] });
            if (options?.onComplete) {
              options.onComplete(finalProgress);
            }
          },
          onError: (error) => {
            setIsStreaming(false);
            if (options?.onError) {
              options.onError(error);
            }
          },
          onClose: () => {
            setIsStreaming(false);
          },
        });
      } catch (error) {
        setIsStreaming(false);
        if (options?.onError) {
          options.onError(
            error instanceof Error ? error : new Error('Failed to setup progress stream')
          );
        }
      }
    },
    [queryClient, options]
  );

  // Start discovery mutation
  const startDiscoveryMutation = useMutation({
    mutationFn: (config: DiscoveryConfig) => startDiscovery(config),
    onSuccess: (response) => {
      setupProgressStream(response.runId);
      queryClient.invalidateQueries({ queryKey: ['scrapers', 'runs'] });
    },
    onError: (error) => {
      if (options?.onError) {
        options.onError(
          error instanceof Error ? error : new Error('Failed to start discovery')
        );
      }
    },
  });

  // Start extraction mutation
  const startExtractionMutation = useMutation({
    mutationFn: (config: ExtractionConfig) => startExtraction(config),
    onSuccess: (response) => {
      setupProgressStream(response.runId);
      queryClient.invalidateQueries({ queryKey: ['scrapers', 'runs'] });
    },
    onError: (error) => {
      if (options?.onError) {
        options.onError(
          error instanceof Error ? error : new Error('Failed to start extraction')
        );
      }
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (runId: string) => cancelScraperRun(runId),
    onSuccess: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: ['scrapers', 'runs'] });
    },
  });

  // Start function based on type
  const start = useCallback(
    (config: DiscoveryConfig | ExtractionConfig) => {
      if (type === 'discovery') {
        startDiscoveryMutation.mutate(config as DiscoveryConfig);
      } else {
        startExtractionMutation.mutate(config as ExtractionConfig);
      }
    },
    [type, startDiscoveryMutation, startExtractionMutation]
  );

  // Cancel function
  const cancel = useCallback(
    (runId: string) => {
      cancelMutation.mutate(runId);
    },
    [cancelMutation]
  );

  // Reset function
  const reset = useCallback(() => {
    setProgress(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    start,
    cancel,
    reset,
    progress,
    isStreaming,
    isStarting:
      startDiscoveryMutation.isPending || startExtractionMutation.isPending,
    isCancelling: cancelMutation.isPending,
    error:
      startDiscoveryMutation.error ||
      startExtractionMutation.error ||
      cancelMutation.error,
  };
}

/**
 * Hook to track progress of an existing scraper run
 */
export function useScraperProgress(
  runId: string | null,
  options?: UseScraperRunOptions
) {
  const [progress, setProgress] = useState<ScraperProgress | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) {
      return;
    }

    let mounted = true;

    const setupStream = async () => {
      try {
        setIsStreaming(true);
        const eventSource = await createScraperProgressStream(runId);
        eventSourceRef.current = eventSource;

        setupProgressEventHandlers(eventSource, {
          onProgress: (newProgress) => {
            if (mounted) {
              setProgress(newProgress);
            }
          },
          onComplete: (finalProgress) => {
            if (mounted) {
              setProgress(finalProgress);
              setIsStreaming(false);
            }
            if (options?.onComplete) {
              options.onComplete(finalProgress);
            }
          },
          onError: (error) => {
            if (mounted) {
              setIsStreaming(false);
            }
            if (options?.onError) {
              options.onError(error);
            }
          },
          onClose: () => {
            if (mounted) {
              setIsStreaming(false);
            }
          },
        });
      } catch (error) {
        if (mounted) {
          setIsStreaming(false);
        }
        if (options?.onError) {
          options.onError(
            error instanceof Error ? error : new Error('Failed to setup progress stream')
          );
        }
      }
    };

    setupStream();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [runId, options]);

  return {
    progress,
    isStreaming,
  };
}
