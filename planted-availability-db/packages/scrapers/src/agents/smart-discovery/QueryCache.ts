/**
 * Query Cache for Smart Discovery Agent
 *
 * Prevents duplicate searches by tracking executed queries in Firestore.
 * Queries are normalized and hashed before storage to catch semantically
 * identical searches with minor formatting differences.
 *
 * Cache Rules:
 * - Skip if query executed in last 24h with results (successful search)
 * - Skip if query executed in last 7d with 0 results (failed search)
 */

import { getFirestore, Timestamp } from '@pad/database';
import type { Firestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface QueryCacheEntry {
  queryHash: string;
  normalizedQuery: string;
  originalQuery: string;
  executedAt: Timestamp;
  resultsCount: number;
  expiresAt: Timestamp;
}

export interface QueryCacheStats {
  totalCached: number;
  skippedToday: number;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_DURATION_WITH_RESULTS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_DURATION_NO_RESULTS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// Query Cache
// ============================================================================

export class QueryCache {
  private db: Firestore;
  private collectionName = 'query_cache';
  private skippedTodayCount = 0;

  constructor() {
    this.db = getFirestore();
  }

  /**
   * Normalize a query string for consistent hashing
   *
   * - Convert to lowercase
   * - Trim whitespace
   * - Remove extra spaces
   *
   * Note: We preserve word order because Google treats phrase order as significant
   * for relevance ranking. "planted chicken Berlin" may return different results
   * than "Berlin planted chicken".
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .join(' ');
  }

  /**
   * Generate MD5 hash for a normalized query
   */
  private hashQuery(normalizedQuery: string): string {
    return crypto.createHash('md5').update(normalizedQuery).digest('hex');
  }

  /**
   * Check if a query should be skipped based on cache
   *
   * Returns true if:
   * - Query executed in last 24h with results
   * - Query executed in last 7d with 0 results
   */
  async shouldSkipQuery(query: string): Promise<boolean> {
    const normalizedQuery = this.normalizeQuery(query);
    const queryHash = this.hashQuery(normalizedQuery);

    const docRef = this.db.collection(this.collectionName).doc(queryHash);
    const doc = await docRef.get();

    if (!doc.exists) {
      return false; // No cache entry, execute the query
    }

    const entry = doc.data() as QueryCacheEntry;
    const now = new Date();
    const executedAt = entry.executedAt.toDate();
    const timeSinceExecution = now.getTime() - executedAt.getTime();

    // Check if query had results
    if (entry.resultsCount > 0) {
      // Skip if executed in last 24 hours
      if (timeSinceExecution < CACHE_DURATION_WITH_RESULTS) {
        console.log(
          `[QueryCache] Skipping query (had ${entry.resultsCount} results ${Math.round(timeSinceExecution / 1000 / 60)} min ago): ${query}`
        );
        this.skippedTodayCount++;
        return true;
      }
    } else {
      // Skip if executed in last 7 days with no results
      if (timeSinceExecution < CACHE_DURATION_NO_RESULTS) {
        console.log(
          `[QueryCache] Skipping query (had 0 results ${Math.round(timeSinceExecution / 1000 / 60 / 60)} hours ago): ${query}`
        );
        this.skippedTodayCount++;
        return true;
      }
    }

    // Cache expired, don't skip
    return false;
  }

  /**
   * Record a query execution with results count
   */
  async recordQuery(query: string, resultsCount: number): Promise<void> {
    const normalizedQuery = this.normalizeQuery(query);
    const queryHash = this.hashQuery(normalizedQuery);

    const now = Timestamp.now();
    const cacheDuration =
      resultsCount > 0 ? CACHE_DURATION_WITH_RESULTS : CACHE_DURATION_NO_RESULTS;

    const expiresAt = Timestamp.fromMillis(now.toMillis() + cacheDuration);

    const entry: QueryCacheEntry = {
      queryHash,
      normalizedQuery,
      originalQuery: query,
      executedAt: now,
      resultsCount,
      expiresAt,
    };

    const docRef = this.db.collection(this.collectionName).doc(queryHash);
    await docRef.set(entry, { merge: false }); // Overwrite any existing entry

    console.log(
      `[QueryCache] Recorded query (${resultsCount} results, expires in ${cacheDuration / 1000 / 60 / 60}h): ${query}`
    );
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<QueryCacheStats> {
    // Count total cached queries (not expired)
    const now = Timestamp.now();
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('expiresAt', '>', now)
      .get();

    return {
      totalCached: snapshot.size,
      skippedToday: this.skippedTodayCount,
    };
  }

  /**
   * Clean up expired cache entries
   * Should be called periodically (e.g., once per run)
   */
  async cleanupExpired(): Promise<number> {
    const now = Timestamp.now();
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('expiresAt', '<=', now)
      .get();

    const batch = this.db.batch();
    let deleteCount = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    if (deleteCount > 0) {
      await batch.commit();
      console.log(`[QueryCache] Cleaned up ${deleteCount} expired cache entries`);
    }

    return deleteCount;
  }

  /**
   * Reset the skipped today counter
   * Should be called at the start of each discovery run
   */
  resetSkippedCounter(): void {
    this.skippedTodayCount = 0;
  }

  /**
   * Get all cached queries (for debugging)
   */
  async getAllCachedQueries(): Promise<QueryCacheEntry[]> {
    const snapshot = await this.db
      .collection(this.collectionName)
      .orderBy('executedAt', 'desc')
      .limit(100)
      .get();

    return snapshot.docs.map((doc) => doc.data() as QueryCacheEntry);
  }

  /**
   * Clear all cache entries (for testing/debugging)
   */
  async clearAll(): Promise<void> {
    const snapshot = await this.db.collection(this.collectionName).get();

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`[QueryCache] Cleared all ${snapshot.size} cache entries`);
  }

  /**
   * Manually add a cache entry (for testing or seeding)
   */
  async addCacheEntry(query: string, resultsCount: number, hoursAgo: number = 0): Promise<void> {
    const normalizedQuery = this.normalizeQuery(query);
    const queryHash = this.hashQuery(normalizedQuery);

    const executedAt = Timestamp.fromMillis(Date.now() - hoursAgo * 60 * 60 * 1000);
    const cacheDuration =
      resultsCount > 0 ? CACHE_DURATION_WITH_RESULTS : CACHE_DURATION_NO_RESULTS;
    const expiresAt = Timestamp.fromMillis(executedAt.toMillis() + cacheDuration);

    const entry: QueryCacheEntry = {
      queryHash,
      normalizedQuery,
      originalQuery: query,
      executedAt,
      resultsCount,
      expiresAt,
    };

    const docRef = this.db.collection(this.collectionName).doc(queryHash);
    await docRef.set(entry);
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let cacheInstance: QueryCache | null = null;

export function getQueryCache(): QueryCache {
  if (!cacheInstance) {
    cacheInstance = new QueryCache();
  }
  return cacheInstance;
}
