import { type QueryDocumentSnapshot, type DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection } from './base.js';
import type {
  DiscoveryRun,
  DiscoveryRunConfig,
  DiscoveryRunStats,
  DiscoveryRunStatus,
  DiscoveryError,
  LearnedPattern,
  CreateDiscoveryRunInput,
} from '@pad/core';

interface DiscoveryRunDoc {
  id: string;
  status: DiscoveryRunStatus;
  config: DiscoveryRunConfig;
  stats: DiscoveryRunStats;
  strategies_used: string[];
  learned_patterns: LearnedPattern[];
  errors: DiscoveryError[];
  triggered_by: 'scheduled' | 'manual' | 'webhook';
  triggered_by_user?: string;
  created_at: Date;
  updated_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

const EMPTY_STATS: DiscoveryRunStats = {
  queries_executed: 0,
  queries_successful: 0,
  queries_failed: 0,
  venues_discovered: 0,
  venues_verified: 0,
  venues_rejected: 0,
  chains_detected: 0,
  new_strategies_created: 0,
};

/**
 * Collection for tracking discovery run executions
 */
class DiscoveryRunsCollection extends BaseCollection<DiscoveryRunDoc> {
  protected collectionName = 'discovery_runs';

  protected fromFirestore(doc: QueryDocumentSnapshot): DiscoveryRunDoc {
    const data = doc.data();
    return {
      id: doc.id,
      status: data.status,
      config: data.config,
      stats: data.stats || EMPTY_STATS,
      strategies_used: data.strategies_used || [],
      learned_patterns: data.learned_patterns || [],
      errors: (data.errors || []).map((e: any) => ({
        ...e,
        timestamp: e.timestamp instanceof Timestamp ? e.timestamp.toDate() : new Date(e.timestamp),
      })),
      triggered_by: data.triggered_by,
      triggered_by_user: data.triggered_by_user,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      started_at: data.started_at ? (data.started_at as Timestamp).toDate() : undefined,
      completed_at: data.completed_at ? (data.completed_at as Timestamp).toDate() : undefined,
    };
  }

  protected toFirestore(data: Partial<DiscoveryRunDoc>): DocumentData {
    const doc: DocumentData = {};

    if (data.status !== undefined) doc.status = data.status;
    if (data.config !== undefined) doc.config = data.config;
    if (data.stats !== undefined) doc.stats = data.stats;
    if (data.strategies_used !== undefined) doc.strategies_used = data.strategies_used;
    if (data.learned_patterns !== undefined) doc.learned_patterns = data.learned_patterns;
    if (data.errors !== undefined) doc.errors = data.errors;
    if (data.triggered_by !== undefined) doc.triggered_by = data.triggered_by;
    if (data.triggered_by_user !== undefined) doc.triggered_by_user = data.triggered_by_user;
    if (data.started_at !== undefined) doc.started_at = data.started_at;
    if (data.completed_at !== undefined) doc.completed_at = data.completed_at;

    return doc;
  }

  /**
   * Create a new discovery run
   */
  async createRun(input: CreateDiscoveryRunInput): Promise<DiscoveryRunDoc> {
    return this.create({
      status: 'pending',
      config: input.config,
      stats: EMPTY_STATS,
      strategies_used: [],
      learned_patterns: [],
      errors: [],
      triggered_by: input.triggered_by,
      triggered_by_user: input.triggered_by_user,
    });
  }

  /**
   * Start a run
   */
  async startRun(runId: string): Promise<DiscoveryRunDoc> {
    return this.update(runId, {
      status: 'running',
      started_at: new Date(),
    });
  }

  /**
   * Complete a run successfully
   */
  async completeRun(
    runId: string,
    stats: DiscoveryRunStats,
    learnedPatterns?: LearnedPattern[]
  ): Promise<DiscoveryRunDoc> {
    const updates: Partial<DiscoveryRunDoc> = {
      status: 'completed',
      stats,
      completed_at: new Date(),
    };

    if (learnedPatterns) {
      updates.learned_patterns = learnedPatterns;
    }

    return this.update(runId, updates);
  }

  /**
   * Fail a run
   */
  async failRun(runId: string, error: DiscoveryError): Promise<DiscoveryRunDoc> {
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
   * Update run stats incrementally
   */
  async incrementStats(
    runId: string,
    increments: Partial<DiscoveryRunStats>
  ): Promise<DiscoveryRunDoc> {
    const run = await this.getById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const newStats = { ...run.stats };
    for (const [key, value] of Object.entries(increments)) {
      if (value !== undefined) {
        (newStats as any)[key] = ((newStats as any)[key] || 0) + value;
      }
    }

    return this.update(runId, { stats: newStats });
  }

  /**
   * Add a strategy to the run's tracking
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
   * Add an error to the run
   */
  async addError(runId: string, error: Omit<DiscoveryError, 'timestamp'>): Promise<void> {
    const run = await this.getById(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    await this.update(runId, {
      errors: [...run.errors, { ...error, timestamp: new Date() }],
    });
  }

  /**
   * Get recent runs
   */
  async getRecentRuns(limit: number = 10): Promise<DiscoveryRunDoc[]> {
    const snapshot = await this.collection
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get runs by status
   */
  async getByStatus(status: DiscoveryRunStatus): Promise<DiscoveryRunDoc[]> {
    const snapshot = await this.collection
      .where('status', '==', status)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get currently running discovery
   */
  async getActiveRun(): Promise<DiscoveryRunDoc | null> {
    const snapshot = await this.collection
      .where('status', '==', 'running')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return this.fromFirestore(snapshot.docs[0]);
  }

  /**
   * Get aggregate stats across all runs
   */
  async getAggregateStats(): Promise<{
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    total_venues_discovered: number;
    total_venues_verified: number;
    average_venues_per_run: number;
  }> {
    const all = await this.getAll();
    const completed = all.filter((r) => r.status === 'completed');

    const totalVenuesDiscovered = completed.reduce(
      (sum, r) => sum + r.stats.venues_discovered,
      0
    );
    const totalVenuesVerified = completed.reduce(
      (sum, r) => sum + r.stats.venues_verified,
      0
    );

    return {
      total_runs: all.length,
      successful_runs: completed.length,
      failed_runs: all.filter((r) => r.status === 'failed').length,
      total_venues_discovered: totalVenuesDiscovered,
      total_venues_verified: totalVenuesVerified,
      average_venues_per_run:
        completed.length > 0 ? Math.round(totalVenuesDiscovered / completed.length) : 0,
    };
  }
}

// Singleton instance
export const discoveryRuns = new DiscoveryRunsCollection();
