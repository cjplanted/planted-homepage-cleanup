/**
 * Search Engine Credential Pool
 *
 * Manages multiple Google Custom Search API credentials to work around
 * the 100 queries/day free tier limit. Automatically rotates between
 * credentials and tracks daily usage in Firestore.
 *
 * With 20 credential sets: 20 × 100 = 2,000 free queries/day
 */

import { getFirestore, Timestamp } from '@pad/database';
import type { Firestore } from 'firebase-admin/firestore';

// ============================================================================
// Types
// ============================================================================

export interface SearchCredential {
  id: string;
  apiKey: string;
  searchEngineId: string;
  name?: string; // Optional friendly name like "Project 1"
}

export interface CredentialUsage {
  credentialId: string;
  queriesUsedToday: number;
  dailyLimit: number;
  lastResetDate: string; // YYYY-MM-DD format (UTC)
  lastUsedAt?: Timestamp;
  totalQueriesAllTime: number;
  isDisabled: boolean;
  disabledReason?: string;
}

export interface PoolStats {
  totalCredentials: number;
  activeCredentials: number;
  disabledCredentials: number;
  totalQueriesAvailableToday: number;
  totalQueriesUsedToday: number;
  queriesRemaining: number;
}

// ============================================================================
// Search Engine Pool
// ============================================================================

export class SearchEnginePool {
  private credentials: SearchCredential[];
  private db: Firestore;
  private collectionName = 'search_engine_quota';
  private dailyLimit: number;
  private initialized = false;

  constructor(options?: {
    credentials?: SearchCredential[];
    dailyLimit?: number;
  }) {
    this.credentials = options?.credentials || this.loadCredentialsFromEnv();
    this.dailyLimit = options?.dailyLimit || 100;
    this.db = getFirestore();
  }

  /**
   * Load credentials from environment variables
   *
   * Format: GOOGLE_SEARCH_CREDENTIALS as JSON array, or
   * individual GOOGLE_SEARCH_API_KEY_1, GOOGLE_SEARCH_ENGINE_ID_1, etc.
   */
  private loadCredentialsFromEnv(): SearchCredential[] {
    const credentials: SearchCredential[] = [];

    // Try JSON format first (preferred)
    const jsonCredentials = process.env.GOOGLE_SEARCH_CREDENTIALS;
    if (jsonCredentials) {
      try {
        const parsed = JSON.parse(jsonCredentials) as Array<{
          apiKey: string;
          searchEngineId: string;
          name?: string;
        }>;
        return parsed.map((cred, index) => ({
          id: `cred_${index + 1}`,
          apiKey: cred.apiKey,
          searchEngineId: cred.searchEngineId,
          name: cred.name || `Credential ${index + 1}`,
        }));
      } catch (e) {
        console.warn('Failed to parse GOOGLE_SEARCH_CREDENTIALS JSON');
      }
    }

    // Try numbered format: GOOGLE_SEARCH_API_KEY_1, GOOGLE_SEARCH_ENGINE_ID_1, etc.
    for (let i = 1; i <= 50; i++) {
      const apiKey = process.env[`GOOGLE_SEARCH_API_KEY_${i}`];
      const searchEngineId = process.env[`GOOGLE_SEARCH_ENGINE_ID_${i}`];

      if (apiKey && searchEngineId) {
        credentials.push({
          id: `cred_${i}`,
          apiKey,
          searchEngineId,
          name: `Project ${i}`,
        });
      }
    }

    // Fall back to single credential (backwards compatibility)
    if (credentials.length === 0) {
      const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
      const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

      if (apiKey && searchEngineId) {
        credentials.push({
          id: 'cred_default',
          apiKey,
          searchEngineId,
          name: 'Default',
        });
      }
    }

    return credentials;
  }

  /**
   * Initialize the pool - ensures all credentials have usage records
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const today = this.getTodayDateString();

    for (const cred of this.credentials) {
      const docRef = this.db.collection(this.collectionName).doc(cred.id);
      const doc = await docRef.get();

      if (!doc.exists) {
        // Create initial usage record
        await docRef.set({
          credentialId: cred.id,
          queriesUsedToday: 0,
          dailyLimit: this.dailyLimit,
          lastResetDate: today,
          totalQueriesAllTime: 0,
          isDisabled: false,
        } as CredentialUsage);
      } else {
        // Reset if it's a new day
        const usage = doc.data() as CredentialUsage;
        if (usage.lastResetDate !== today) {
          await docRef.update({
            queriesUsedToday: 0,
            lastResetDate: today,
          });
        }
      }
    }

    this.initialized = true;
    console.log(`[SearchEnginePool] Initialized with ${this.credentials.length} credentials`);
  }

  /**
   * Get the current date string in YYYY-MM-DD format (UTC)
   */
  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get the next available credential with remaining quota
   */
  async getAvailableCredential(): Promise<SearchCredential | null> {
    await this.initialize();

    const today = this.getTodayDateString();

    for (const cred of this.credentials) {
      const docRef = this.db.collection(this.collectionName).doc(cred.id);
      const doc = await docRef.get();

      if (!doc.exists) continue;

      const usage = doc.data() as CredentialUsage;

      // Skip disabled credentials
      if (usage.isDisabled) continue;

      // Reset if new day
      if (usage.lastResetDate !== today) {
        await docRef.update({
          queriesUsedToday: 0,
          lastResetDate: today,
        });
        return cred;
      }

      // Check if quota available
      if (usage.queriesUsedToday < usage.dailyLimit) {
        return cred;
      }
    }

    return null; // All credentials exhausted for today
  }

  /**
   * Record a successful query usage
   */
  async recordUsage(credentialId: string): Promise<void> {
    const docRef = this.db.collection(this.collectionName).doc(credentialId);

    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) return;

      const usage = doc.data() as CredentialUsage;
      transaction.update(docRef, {
        queriesUsedToday: usage.queriesUsedToday + 1,
        totalQueriesAllTime: usage.totalQueriesAllTime + 1,
        lastUsedAt: Timestamp.now(),
      });
    });
  }

  /**
   * Mark a credential as exhausted for today (e.g., after receiving 429)
   */
  async markExhausted(credentialId: string): Promise<void> {
    const docRef = this.db.collection(this.collectionName).doc(credentialId);

    await docRef.update({
      queriesUsedToday: this.dailyLimit, // Mark as fully used
    });

    console.log(`[SearchEnginePool] Credential ${credentialId} marked as exhausted`);
  }

  /**
   * Disable a credential (e.g., if API key is revoked)
   */
  async disableCredential(credentialId: string, reason: string): Promise<void> {
    const docRef = this.db.collection(this.collectionName).doc(credentialId);

    await docRef.update({
      isDisabled: true,
      disabledReason: reason,
    });

    console.log(`[SearchEnginePool] Credential ${credentialId} disabled: ${reason}`);
  }

  /**
   * Re-enable a credential
   */
  async enableCredential(credentialId: string): Promise<void> {
    const docRef = this.db.collection(this.collectionName).doc(credentialId);

    await docRef.update({
      isDisabled: false,
      disabledReason: null,
    });

    console.log(`[SearchEnginePool] Credential ${credentialId} re-enabled`);
  }

  /**
   * Get pool statistics
   */
  async getStats(): Promise<PoolStats> {
    await this.initialize();

    const today = this.getTodayDateString();
    let activeCredentials = 0;
    let disabledCredentials = 0;
    let totalUsedToday = 0;
    let totalAvailableToday = 0;

    for (const cred of this.credentials) {
      const docRef = this.db.collection(this.collectionName).doc(cred.id);
      const doc = await docRef.get();

      if (!doc.exists) continue;

      const usage = doc.data() as CredentialUsage;

      if (usage.isDisabled) {
        disabledCredentials++;
      } else {
        activeCredentials++;
        totalAvailableToday += usage.dailyLimit;

        // Only count today's usage
        if (usage.lastResetDate === today) {
          totalUsedToday += usage.queriesUsedToday;
        }
      }
    }

    return {
      totalCredentials: this.credentials.length,
      activeCredentials,
      disabledCredentials,
      totalQueriesAvailableToday: totalAvailableToday,
      totalQueriesUsedToday: totalUsedToday,
      queriesRemaining: totalAvailableToday - totalUsedToday,
    };
  }

  /**
   * Get detailed usage for all credentials
   */
  async getDetailedUsage(): Promise<Array<{ credential: SearchCredential; usage: CredentialUsage }>> {
    await this.initialize();

    const results: Array<{ credential: SearchCredential; usage: CredentialUsage }> = [];

    for (const cred of this.credentials) {
      const docRef = this.db.collection(this.collectionName).doc(cred.id);
      const doc = await docRef.get();

      if (doc.exists) {
        results.push({
          credential: { ...cred, apiKey: cred.apiKey.slice(0, 10) + '...' }, // Mask API key
          usage: doc.data() as CredentialUsage,
        });
      }
    }

    return results;
  }

  /**
   * Get count of available credentials
   */
  getCredentialCount(): number {
    return this.credentials.length;
  }

  /**
   * Check if we have any credentials configured
   */
  hasCredentials(): boolean {
    return this.credentials.length > 0;
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let poolInstance: SearchEnginePool | null = null;

export function getSearchEnginePool(): SearchEnginePool {
  if (!poolInstance) {
    poolInstance = new SearchEnginePool();
  }
  return poolInstance;
}
