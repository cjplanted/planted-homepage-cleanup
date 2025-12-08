import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, generateId, createTimestamp, timestampToDate } from '../firestore.js';
import type { ScraperRun, ScraperStatus, ScraperStats, ScraperError } from '@pad/core';

export interface ScraperRunQueryOptions {
  scraperId?: string;
  status?: ScraperStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}

export class ScraperRunsCollection {
  private collectionName = 'scraper_runs';
  private get db() {
    return getFirestore();
  }
  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): ScraperRun {
    const data = doc.data();
    return {
      id: doc.id,
      scraper_id: data.scraper_id,
      started_at: timestampToDate(data.started_at),
      completed_at: data.completed_at ? timestampToDate(data.completed_at) : undefined,
      status: data.status,
      stats: data.stats,
      errors: data.errors,
      next_run: data.next_run ? timestampToDate(data.next_run) : undefined,
    };
  }

  protected toFirestore(data: Partial<ScraperRun>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;

    if (data.started_at) {
      result.started_at = createTimestamp(data.started_at);
    }
    if (data.completed_at) {
      result.completed_at = createTimestamp(data.completed_at);
    }
    if (data.next_run) {
      result.next_run = createTimestamp(data.next_run);
    }

    return result;
  }

  /**
   * Start a new scraper run
   */
  async start(scraperId: string): Promise<ScraperRun> {
    const id = generateId(this.collectionName);
    const now = new Date();

    const run: ScraperRun = {
      id,
      scraper_id: scraperId,
      started_at: now,
      status: 'running',
      stats: {
        venues_checked: 0,
        venues_updated: 0,
        dishes_found: 0,
        dishes_updated: 0,
        errors: 0,
      },
    };

    await this.collection.doc(id).set(this.toFirestore(run));

    return run;
  }

  /**
   * Update run statistics
   */
  async updateStats(id: string, stats: Partial<ScraperStats>): Promise<void> {
    const docRef = this.collection.doc(id);

    await docRef.update({
      'stats.venues_checked': stats.venues_checked,
      'stats.venues_updated': stats.venues_updated,
      'stats.dishes_found': stats.dishes_found,
      'stats.dishes_updated': stats.dishes_updated,
      'stats.errors': stats.errors,
    });
  }

  /**
   * Complete a scraper run
   */
  async complete(
    id: string,
    status: 'completed' | 'failed' | 'partial',
    stats: ScraperStats,
    errors?: ScraperError[],
    nextRun?: Date
  ): Promise<ScraperRun> {
    const now = new Date();

    const updateData: DocumentData = {
      completed_at: createTimestamp(now),
      status,
      stats,
    };

    if (errors && errors.length > 0) {
      updateData.errors = errors;
    }

    if (nextRun) {
      updateData.next_run = createTimestamp(nextRun);
    }

    await this.collection.doc(id).update(updateData);

    const doc = await this.collection.doc(id).get();
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Get run by ID
   */
  async getById(id: string): Promise<ScraperRun | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Query scraper runs
   */
  async query(options: ScraperRunQueryOptions = {}): Promise<ScraperRun[]> {
    let query = this.collection.orderBy('started_at', 'desc');

    if (options.scraperId) {
      query = query.where('scraper_id', '==', options.scraperId);
    }

    if (options.status) {
      query = query.where('status', '==', options.status);
    }

    if (options.fromDate) {
      query = query.where('started_at', '>=', createTimestamp(options.fromDate));
    }

    if (options.toDate) {
      query = query.where('started_at', '<=', createTimestamp(options.toDate));
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get latest run for a scraper
   */
  async getLatest(scraperId: string): Promise<ScraperRun | null> {
    const runs = await this.query({ scraperId, limit: 1 });
    return runs[0] || null;
  }

  /**
   * Get running scrapers
   */
  async getRunning(): Promise<ScraperRun[]> {
    return this.query({ status: 'running' });
  }

  /**
   * Get recent scraper runs
   */
  async getRecent(limit: number = 10): Promise<ScraperRun[]> {
    return this.query({ limit });
  }

  /**
   * Get scraper health status
   */
  async getScraperHealth(scraperId: string, daysBack: number = 7): Promise<{
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    partialRuns: number;
    successRate: number;
    avgVenuesChecked: number;
    avgDishesFound: number;
    lastRun?: ScraperRun;
  }> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const runs = await this.query({
      scraperId,
      fromDate,
      limit: 1000,
    });

    const completedRuns = runs.filter((r) => r.status !== 'running');
    const successfulRuns = runs.filter((r) => r.status === 'completed');
    const failedRuns = runs.filter((r) => r.status === 'failed');
    const partialRuns = runs.filter((r) => r.status === 'partial');

    const totalVenuesChecked = completedRuns.reduce((sum, r) => sum + r.stats.venues_checked, 0);
    const totalDishesFound = completedRuns.reduce((sum, r) => sum + r.stats.dishes_found, 0);

    return {
      totalRuns: runs.length,
      successfulRuns: successfulRuns.length,
      failedRuns: failedRuns.length,
      partialRuns: partialRuns.length,
      successRate: completedRuns.length > 0 ? successfulRuns.length / completedRuns.length : 0,
      avgVenuesChecked: completedRuns.length > 0 ? totalVenuesChecked / completedRuns.length : 0,
      avgDishesFound: completedRuns.length > 0 ? totalDishesFound / completedRuns.length : 0,
      lastRun: runs[0],
    };
  }

  /**
   * Delete old runs (cleanup)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const snapshot = await this.collection
      .where('started_at', '<', createTimestamp(cutoffDate))
      .limit(500)
      .get();

    if (snapshot.empty) return 0;

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return snapshot.size;
  }

  /**
   * Get unique scraper IDs from recent runs
   */
  async getActiveScraperIds(daysBack: number = 30): Promise<string[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const runs = await this.query({ fromDate, limit: 1000 });
    const scraperIds = new Set(runs.map((r) => r.scraper_id));
    return Array.from(scraperIds);
  }

  /**
   * Get health status for all scrapers
   */
  async getAllScrapersHealth(daysBack: number = 7): Promise<{
    scrapers: Array<{
      id: string;
      status: 'healthy' | 'warning' | 'critical' | 'inactive';
      health: {
        totalRuns: number;
        successfulRuns: number;
        failedRuns: number;
        partialRuns: number;
        successRate: number;
        avgVenuesChecked: number;
        avgDishesFound: number;
        lastRun?: ScraperRun;
      };
      alerts: string[];
    }>;
    overall: {
      totalScrapers: number;
      healthy: number;
      warning: number;
      critical: number;
      inactive: number;
      overallSuccessRate: number;
    };
  }> {
    // Known scrapers in the system
    const knownScrapers = [
      'wolt-browser',
      'lieferando',
      'ubereats',
      'google-search',
      'coop',
      'migros',
      'google-sheets',
      'web-menu',
    ];

    // Get active scraper IDs from database
    const activeIds = await this.getActiveScraperIds(daysBack * 2);
    const allScraperIds = [...new Set([...knownScrapers, ...activeIds])];

    const results = await Promise.all(
      allScraperIds.map(async (id) => {
        const health = await this.getScraperHealth(id, daysBack);
        const alerts: string[] = [];
        let status: 'healthy' | 'warning' | 'critical' | 'inactive' = 'healthy';

        // Determine status based on health metrics
        if (health.totalRuns === 0) {
          status = 'inactive';
          alerts.push('No runs in the last ' + daysBack + ' days');
        } else if (health.successRate < 0.5) {
          status = 'critical';
          alerts.push('Success rate below 50%');
        } else if (health.successRate < 0.8) {
          status = 'warning';
          alerts.push('Success rate below 80%');
        }

        // Check for stale scraper (last run > 2 days ago)
        if (health.lastRun) {
          const daysSinceLastRun = (Date.now() - health.lastRun.started_at.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastRun > 2 && status !== 'inactive') {
            if (status === 'healthy') status = 'warning';
            alerts.push(`Last run was ${Math.round(daysSinceLastRun)} days ago`);
          }
        }

        // Check for consecutive failures
        if (health.failedRuns >= 3 && health.lastRun?.status === 'failed') {
          status = 'critical';
          alerts.push('Multiple consecutive failures detected');
        }

        return { id, status, health, alerts };
      })
    );

    // Calculate overall stats
    const overall = {
      totalScrapers: results.length,
      healthy: results.filter((r) => r.status === 'healthy').length,
      warning: results.filter((r) => r.status === 'warning').length,
      critical: results.filter((r) => r.status === 'critical').length,
      inactive: results.filter((r) => r.status === 'inactive').length,
      overallSuccessRate: 0,
    };

    const activeResults = results.filter((r) => r.health.totalRuns > 0);
    if (activeResults.length > 0) {
      const totalRuns = activeResults.reduce((sum, r) => sum + r.health.totalRuns, 0);
      const totalSuccess = activeResults.reduce((sum, r) => sum + r.health.successfulRuns, 0);
      overall.overallSuccessRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0;
    }

    return { scrapers: results, overall };
  }

  /**
   * Get recent errors across all scrapers
   */
  async getRecentErrors(limit: number = 50): Promise<Array<{
    scraper_id: string;
    run_id: string;
    started_at: Date;
    errors: ScraperError[];
  }>> {
    const runs = await this.query({ status: 'failed', limit });
    return runs
      .filter((r) => r.errors && r.errors.length > 0)
      .map((r) => ({
        scraper_id: r.scraper_id,
        run_id: r.id,
        started_at: r.started_at,
        errors: r.errors!,
      }));
  }

  /**
   * Get scraper run trends (daily aggregates)
   */
  async getRunTrends(daysBack: number = 14): Promise<Array<{
    date: string;
    total: number;
    successful: number;
    failed: number;
    partial: number;
  }>> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const runs = await this.query({ fromDate, limit: 5000 });

    // Group by date
    const byDate = new Map<string, { total: number; successful: number; failed: number; partial: number }>();

    for (const run of runs) {
      const dateStr = run.started_at.toISOString().split('T')[0];
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, { total: 0, successful: 0, failed: 0, partial: 0 });
      }
      const entry = byDate.get(dateStr)!;
      entry.total++;
      if (run.status === 'completed') entry.successful++;
      if (run.status === 'failed') entry.failed++;
      if (run.status === 'partial') entry.partial++;
    }

    // Convert to sorted array
    return Array.from(byDate.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const scraperRuns = new ScraperRunsCollection();
