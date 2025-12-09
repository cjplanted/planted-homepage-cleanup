import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection } from './base.js';
import type {
  DishExtractionRun,
  DishExtractionRunConfig,
  DishExtractionRunStats,
  DishExtractionError,
  CreateDishExtractionRunInput,
} from '@pad/core';

/**
 * Collection for tracking dish extraction runs
 */
class DishExtractionRunsCollection extends BaseCollection<DishExtractionRun> {
  protected collectionName = 'dish_extraction_runs';

  private emptyStats(): DishExtractionRunStats {
    return {
      venues_processed: 0,
      venues_successful: 0,
      venues_failed: 0,
      dishes_extracted: 0,
      dishes_updated: 0,
      dishes_verified: 0,
      prices_found: 0,
      images_found: 0,
      errors: 0,
    };
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): DishExtractionRun {
    const data = doc.data();
    return {
      id: doc.id,
      status: data.status || 'pending',
      config: data.config || {},
      stats: data.stats || this.emptyStats(),
      strategies_used: data.strategies_used || [],
      errors: (data.errors || []).map((e: DocumentData) => ({
        ...e,
        timestamp: (e.timestamp as Timestamp)?.toDate() || new Date(),
      })),
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      started_at: data.started_at ? (data.started_at as Timestamp).toDate() : undefined,
      completed_at: data.completed_at ? (data.completed_at as Timestamp).toDate() : undefined,
      triggered_by: data.triggered_by || 'manual',
      triggered_by_user: data.triggered_by_user,
    };
  }

  protected toFirestore(data: Partial<DishExtractionRun>): DocumentData {
    const doc: DocumentData = {};

    if (data.status !== undefined) doc.status = data.status;
    if (data.config !== undefined) doc.config = data.config;
    if (data.stats !== undefined) doc.stats = data.stats;
    if (data.strategies_used !== undefined) doc.strategies_used = data.strategies_used;
    if (data.errors !== undefined) doc.errors = data.errors;
    if (data.started_at !== undefined) doc.started_at = data.started_at;
    if (data.completed_at !== undefined) doc.completed_at = data.completed_at;
    if (data.triggered_by !== undefined) doc.triggered_by = data.triggered_by;
    if (data.triggered_by_user !== undefined) doc.triggered_by_user = data.triggered_by_user;

    return doc;
  }

  /**
   * Create a new extraction run
   */
  async createRun(input: CreateDishExtractionRunInput): Promise<DishExtractionRun> {
    return this.create({
      ...input,
      status: 'pending',
      stats: this.emptyStats(),
      strategies_used: [],
      errors: [],
    });
  }

  /**
   * Start a run
   */
  async startRun(runId: string): Promise<DishExtractionRun> {
    return this.update(runId, {
      status: 'running',
      started_at: new Date(),
    });
  }

  /**
   * Complete a run with final stats
   */
  async completeRun(runId: string, stats: DishExtractionRunStats): Promise<DishExtractionRun> {
    return this.update(runId, {
      status: 'completed',
      stats,
      completed_at: new Date(),
    });
  }

  /**
   * Mark run as failed
   */
  async failRun(runId: string, error: DishExtractionError): Promise<DishExtractionRun> {
    const run = await this.getById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    return this.update(runId, {
      status: 'failed',
      errors: [...run.errors, error],
      completed_at: new Date(),
    });
  }

  /**
   * Add an error to a run
   */
  async addError(runId: string, error: Omit<DishExtractionError, 'timestamp'>): Promise<void> {
    const run = await this.getById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const errorWithTimestamp: DishExtractionError = {
      ...error,
      timestamp: new Date(),
    };

    await this.update(runId, {
      errors: [...run.errors, errorWithTimestamp],
      stats: {
        ...run.stats,
        errors: run.stats.errors + 1,
      },
    });
  }

  /**
   * Add a strategy to the list of used strategies
   */
  async addStrategyUsed(runId: string, strategyId: string): Promise<void> {
    const run = await this.getById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (!run.strategies_used.includes(strategyId)) {
      await this.update(runId, {
        strategies_used: [...run.strategies_used, strategyId],
      });
    }
  }

  /**
   * Update stats during a run
   */
  async updateStats(runId: string, statsUpdate: Partial<DishExtractionRunStats>): Promise<void> {
    const run = await this.getById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    await this.update(runId, {
      stats: { ...run.stats, ...statsUpdate },
    });
  }

  /**
   * Increment specific stats
   */
  async incrementStats(
    runId: string,
    increments: Partial<DishExtractionRunStats>
  ): Promise<void> {
    const run = await this.getById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const newStats = { ...run.stats };
    for (const [key, value] of Object.entries(increments)) {
      if (typeof value === 'number') {
        (newStats as Record<string, number>)[key] =
          ((newStats as Record<string, number>)[key] || 0) + value;
      }
    }

    await this.update(runId, { stats: newStats });
  }

  /**
   * Get recent runs
   */
  async getRecentRuns(limit: number = 10): Promise<DishExtractionRun[]> {
    const snapshot = await this.collection
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get runs by status
   */
  async getByStatus(status: DishExtractionRun['status']): Promise<DishExtractionRun[]> {
    const snapshot = await this.collection
      .where('status', '==', status)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get aggregate stats across all runs
   */
  async getAggregateStats(): Promise<{
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    total_dishes_extracted: number;
    total_venues_processed: number;
    average_dishes_per_venue: number;
  }> {
    const all = await this.getAll();

    const completed = all.filter((r) => r.status === 'completed');
    const failed = all.filter((r) => r.status === 'failed');

    const totalDishes = completed.reduce((sum, r) => sum + r.stats.dishes_extracted, 0);
    const totalVenues = completed.reduce((sum, r) => sum + r.stats.venues_processed, 0);

    return {
      total_runs: all.length,
      successful_runs: completed.length,
      failed_runs: failed.length,
      total_dishes_extracted: totalDishes,
      total_venues_processed: totalVenues,
      average_dishes_per_venue: totalVenues > 0 ? Math.round((totalDishes / totalVenues) * 10) / 10 : 0,
    };
  }
}

export const dishExtractionRuns = new DishExtractionRunsCollection();
