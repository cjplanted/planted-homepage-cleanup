import type {
  ScraperStats,
  ScraperError,
  ChangeSource,
} from '@pad/core';
import { scraperRuns, changeLogs, initializeFirestore } from '@pad/database';

export interface ScraperResult<T = unknown> {
  success: boolean;
  data?: T[];
  errors?: string[];
  stats: {
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
  };
}

export interface ScraperOptions {
  dryRun?: boolean;
  verbose?: boolean;
  maxItems?: number;
}

export abstract class BaseScraper<TInput = unknown, TOutput = unknown> {
  protected abstract readonly name: string;
  protected abstract readonly scraperId: string;
  protected abstract readonly targetCollection: string;

  protected runId: string | null = null;
  protected startTime: Date | null = null;
  protected options: ScraperOptions = {};

  constructor() {
    initializeFirestore();
  }

  /**
   * Execute the scraper
   */
  async run(options: ScraperOptions = {}): Promise<ScraperResult<TOutput>> {
    this.options = options;
    this.startTime = new Date();

    const result: ScraperResult<TOutput> = {
      success: false,
      data: [],
      errors: [],
      stats: {
        created: 0,
        updated: 0,
        unchanged: 0,
        failed: 0,
      },
    };

    try {
      // Start scraper run tracking
      if (!options.dryRun) {
        const run = await scraperRuns.start(this.scraperId);
        this.runId = run.id;
      }

      this.log(`Starting scraper: ${this.name}`);

      // Fetch raw data
      this.log('Fetching data...');
      const rawData = await this.fetchData();
      this.log(`Fetched ${rawData.length} items`);

      // Apply max items limit if specified
      const itemsToProcess = options.maxItems
        ? rawData.slice(0, options.maxItems)
        : rawData;

      // Transform and process each item
      for (const item of itemsToProcess) {
        try {
          const transformed = await this.transform(item);
          if (!transformed) {
            result.stats.failed++;
            continue;
          }

          const validated = await this.validate(transformed);
          if (!validated.valid) {
            result.errors?.push(
              `Validation failed for item: ${validated.errors?.join(', ')}`
            );
            result.stats.failed++;
            continue;
          }

          if (!options.dryRun) {
            const saveResult = await this.save(transformed);
            if (saveResult.action === 'created') {
              result.stats.created++;
            } else if (saveResult.action === 'updated') {
              result.stats.updated++;
            } else {
              result.stats.unchanged++;
            }
          } else {
            result.stats.unchanged++;
          }

          result.data?.push(transformed);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          result.errors?.push(`Error processing item: ${errorMessage}`);
          result.stats.failed++;
        }
      }

      result.success = result.stats.failed === 0;

      // Complete scraper run tracking
      if (!options.dryRun && this.runId) {
        const stats: ScraperStats = {
          venues_checked: itemsToProcess.length,
          venues_updated: result.stats.updated,
          dishes_found: result.stats.created + result.stats.updated,
          dishes_updated: result.stats.updated,
          errors: result.stats.failed,
        };

        const errors: ScraperError[] = (result.errors || []).map((msg) => ({
          message: msg,
        }));

        await scraperRuns.complete(
          this.runId,
          result.success ? 'completed' : 'partial',
          stats,
          errors.length > 0 ? errors : undefined
        );
      }

      this.log(`Scraper completed: ${JSON.stringify(result.stats)}`);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors?.push(`Fatal error: ${errorMessage}`);

      if (!options.dryRun && this.runId) {
        const stats: ScraperStats = {
          venues_checked: 0,
          venues_updated: 0,
          dishes_found: 0,
          dishes_updated: 0,
          errors: 1,
        };
        await scraperRuns.complete(
          this.runId,
          'failed',
          stats,
          [{ message: errorMessage }]
        );
      }

      this.log(`Scraper failed: ${errorMessage}`, 'error');
      return result;
    }
  }

  /**
   * Fetch raw data from the source
   */
  protected abstract fetchData(): Promise<TInput[]>;

  /**
   * Transform raw data to the target format
   */
  protected abstract transform(item: TInput): Promise<TOutput | null>;

  /**
   * Validate transformed data
   */
  protected abstract validate(
    item: TOutput
  ): Promise<{ valid: boolean; errors?: string[] }>;

  /**
   * Save data to the database
   */
  protected abstract save(
    item: TOutput
  ): Promise<{ action: 'created' | 'updated' | 'unchanged'; id: string }>;

  /**
   * Log a change to the changelog
   */
  protected async logChange(options: {
    action: 'created' | 'updated' | 'archived';
    collection: string;
    documentId: string;
    changes: Array<{ field: string; before: unknown; after: unknown }>;
    reason?: string;
  }): Promise<void> {
    if (this.options.dryRun) return;

    const source: ChangeSource = {
      type: 'scraper',
      scraper_id: this.scraperId,
    };

    await changeLogs.log({
      action: options.action,
      collection: options.collection,
      document_id: options.documentId,
      changes: options.changes,
      source,
      reason: options.reason || `Scraped by ${this.name}`,
    });
  }

  /**
   * Log a message
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.options.verbose && level === 'info') return;

    const prefix = `[${this.name}]`;
    switch (level) {
      case 'error':
        console.error(`${prefix} ERROR: ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} WARN: ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Get scraper info
   */
  getInfo(): {
    name: string;
    scraperId: string;
    targetCollection: string;
  } {
    return {
      name: this.name,
      scraperId: this.scraperId,
      targetCollection: this.targetCollection,
    };
  }
}
