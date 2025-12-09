/**
 * Search Engine Credential Pool
 *
 * Manages multiple Google Custom Search Engine IDs to work around
 * the 100 queries/day free tier limit. Automatically rotates between
 * search engines and tracks daily usage in Firestore.
 *
 * With 6 search engines: 6 × 100 = 600 free queries/day
 * After exhausting free quota, switches to paid mode ($5/1000 queries)
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
  freeQueriesUsed: number;
  freeQueriesTotal: number;
  paidQueriesUsed: number;
  estimatedCost: number;
  mode: 'free' | 'paid';
  // Legacy fields for backwards compatibility
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
  private paidUsageCollection = 'search_engine_paid_usage';
  private dailyLimit: number;
  private initialized = false;
  private costPerPaidQuery = 0.005; // $5 per 1000 queries

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
   * Supports 6 search engines with the same API key but different engine IDs.
   * Each engine gets 100 free queries/day for a total of 600 free queries.
   */
  private loadCredentialsFromEnv(): SearchCredential[] {
    const credentials: SearchCredential[] = [];

    // Get the shared API key
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;

    if (!apiKey) {
      console.warn('GOOGLE_SEARCH_API_KEY not found in environment');
      return credentials;
    }

    // Predefined search engine IDs
    const searchEngineIds = [
      '5197714c708c342da',
      '11d0363b458124bf9',
      'd00179eae32804ecf',
      '76e01e0818708470a',
      '31f7192c1ff464765',
      '323cdbf28a6974711',
    ];

    // Load search engine IDs from env vars (GOOGLE_SEARCH_ENGINE_ID_1 through _6)
    // or fall back to predefined IDs
    for (let i = 1; i <= 6; i++) {
      const envEngineId = process.env[`GOOGLE_SEARCH_ENGINE_ID_${i}`];
      const searchEngineId = envEngineId || searchEngineIds[i - 1];

      if (searchEngineId) {
        credentials.push({
          id: `engine_${i}`,
          apiKey,
          searchEngineId,
          name: `Search Engine ${i}`,
        });
      }
    }

    console.log(`[SearchEnginePool] Loaded ${credentials.length} search engines`);
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
   * If all free quota is exhausted, returns a credential for paid mode
   */
  async getAvailableCredential(): Promise<SearchCredential | null> {
    await this.initialize();

    const today = this.getTodayDateString();

    // First, try to find a credential with free quota remaining
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

    // All free quota exhausted - switch to paid mode
    // Return any active credential (quota is account-wide in paid mode)
    console.log('[SearchEnginePool] All free quota exhausted, switching to paid mode');

    for (const cred of this.credentials) {
      const docRef = this.db.collection(this.collectionName).doc(cred.id);
      const doc = await docRef.get();

      if (!doc.exists) continue;

      const usage = doc.data() as CredentialUsage;

      // Return first non-disabled credential for paid mode
      if (!usage.isDisabled) {
        return cred;
      }
    }

    return null; // No credentials available at all
  }

  /**
   * Check if we're currently in paid mode (all free quota exhausted)
   */
  private async isInPaidMode(): Promise<boolean> {
    const today = this.getTodayDateString();

    for (const cred of this.credentials) {
      const docRef = this.db.collection(this.collectionName).doc(cred.id);
      const doc = await docRef.get();

      if (!doc.exists) continue;

      const usage = doc.data() as CredentialUsage;

      // Skip disabled credentials
      if (usage.isDisabled) continue;

      // If it's a new day or has quota remaining, we're in free mode
      if (usage.lastResetDate !== today || usage.queriesUsedToday < usage.dailyLimit) {
        return false;
      }
    }

    // All active credentials exhausted
    return true;
  }

  /**
   * Record a successful query usage
   * Automatically detects if query was free or paid based on quota status
   */
  async recordUsage(credentialId: string): Promise<void> {
    const isPaid = await this.isInPaidMode();

    if (isPaid) {
      // Record paid usage in separate collection
      await this.recordPaidUsage();
    } else {
      // Record free usage for the specific credential
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
  }

  /**
   * Record a paid query usage
   */
  private async recordPaidUsage(): Promise<void> {
    const today = this.getTodayDateString();
    const docRef = this.db.collection(this.paidUsageCollection).doc(today);

    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        // Create new paid usage record for today
        transaction.set(docRef, {
          date: today,
          queriesUsed: 1,
          lastUsedAt: Timestamp.now(),
        });
      } else {
        // Increment existing record
        const data = doc.data();
        transaction.update(docRef, {
          queriesUsed: (data?.queriesUsed || 0) + 1,
          lastUsedAt: Timestamp.now(),
        });
      }
    });
  }

  /**
   * Get paid queries used today
   */
  private async getPaidQueriesUsedToday(): Promise<number> {
    const today = this.getTodayDateString();
    const docRef = this.db.collection(this.paidUsageCollection).doc(today);
    const doc = await docRef.get();

    if (!doc.exists) return 0;

    const data = doc.data();
    return data?.queriesUsed || 0;
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
    let freeQueriesUsed = 0;
    let freeQueriesTotal = 0;

    for (const cred of this.credentials) {
      const docRef = this.db.collection(this.collectionName).doc(cred.id);
      const doc = await docRef.get();

      if (!doc.exists) continue;

      const usage = doc.data() as CredentialUsage;

      if (usage.isDisabled) {
        disabledCredentials++;
      } else {
        activeCredentials++;
        freeQueriesTotal += usage.dailyLimit;

        // Only count today's usage
        if (usage.lastResetDate === today) {
          freeQueriesUsed += usage.queriesUsedToday;
        }
      }
    }

    // Get paid queries used today
    const paidQueriesUsed = await this.getPaidQueriesUsedToday();

    // Calculate estimated cost
    const estimatedCost = paidQueriesUsed * this.costPerPaidQuery;

    // Determine mode
    const mode: 'free' | 'paid' = freeQueriesUsed >= freeQueriesTotal ? 'paid' : 'free';

    return {
      totalCredentials: this.credentials.length,
      activeCredentials,
      disabledCredentials,
      freeQueriesUsed,
      freeQueriesTotal,
      paidQueriesUsed,
      estimatedCost,
      mode,
      // Legacy fields for backwards compatibility
      totalQueriesAvailableToday: freeQueriesTotal,
      totalQueriesUsedToday: freeQueriesUsed + paidQueriesUsed,
      queriesRemaining: Math.max(0, freeQueriesTotal - freeQueriesUsed),
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
