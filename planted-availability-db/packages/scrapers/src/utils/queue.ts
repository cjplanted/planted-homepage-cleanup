import PQueue from 'p-queue';

export interface QueueOptions {
  concurrency?: number;
  interval?: number;
  intervalCap?: number;
}

const DEFAULT_QUEUE_OPTIONS: QueueOptions = {
  concurrency: 2,
  interval: 1000,
  intervalCap: 5,
};

/**
 * Create a rate-limited queue for processing scraper tasks
 */
export function createQueue(options: QueueOptions = {}): PQueue {
  return new PQueue({
    concurrency: options.concurrency ?? DEFAULT_QUEUE_OPTIONS.concurrency,
    interval: options.interval ?? DEFAULT_QUEUE_OPTIONS.interval,
    intervalCap: options.intervalCap ?? DEFAULT_QUEUE_OPTIONS.intervalCap,
  });
}

/**
 * Process items through a queue with rate limiting
 */
export async function processWithQueue<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput) => Promise<TOutput>,
  options: QueueOptions = {}
): Promise<Array<{ success: boolean; result?: TOutput; error?: string }>> {
  const queue = createQueue(options);
  const results: Array<{ success: boolean; result?: TOutput; error?: string }> = [];

  const tasks = items.map((item, index) =>
    queue.add(async () => {
      try {
        const result = await processor(item);
        results[index] = { success: true, result };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results[index] = { success: false, error: errorMessage };
      }
    })
  );

  await Promise.all(tasks);
  return results;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Add random jitter to a delay
 */
export function jitter(baseMs: number, maxJitterMs: number = 500): number {
  return baseMs + Math.random() * maxJitterMs;
}
