import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection } from './base.js';
import type {
  DiscoveryStrategy,
  CreateStrategyInput,
  DeliveryPlatform,
  SupportedCountry,
  StrategyTag,
  SEED_STRATEGIES,
} from '@pad/core';

interface DiscoveryStrategyDoc {
  id: string;
  platform: DeliveryPlatform;
  country: SupportedCountry;
  query_template: string;
  success_rate: number;
  total_uses: number;
  successful_discoveries: number;
  false_positives: number;
  tags: StrategyTag[];
  origin: 'seed' | 'agent' | 'manual' | 'evolved';
  parent_strategy_id?: string;
  created_at: Date;
  updated_at: Date;
  last_used?: Date;
  deprecated_at?: Date;
  deprecation_reason?: string;
}

/**
 * Collection for discovery strategies that the agent learns and evolves
 */
class DiscoveryStrategiesCollection extends BaseCollection<DiscoveryStrategyDoc> {
  protected collectionName = 'discovery_strategies';

  protected fromFirestore(doc: QueryDocumentSnapshot): DiscoveryStrategyDoc {
    const data = doc.data();
    return {
      id: doc.id,
      platform: data.platform,
      country: data.country,
      query_template: data.query_template,
      success_rate: data.success_rate,
      total_uses: data.total_uses,
      successful_discoveries: data.successful_discoveries,
      false_positives: data.false_positives,
      tags: data.tags || [],
      origin: data.origin,
      parent_strategy_id: data.parent_strategy_id,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      last_used: data.last_used ? (data.last_used as Timestamp).toDate() : undefined,
      deprecated_at: data.deprecated_at ? (data.deprecated_at as Timestamp).toDate() : undefined,
      deprecation_reason: data.deprecation_reason,
    };
  }

  protected toFirestore(data: Partial<DiscoveryStrategyDoc>): DocumentData {
    const doc: DocumentData = {};

    if (data.platform !== undefined) doc.platform = data.platform;
    if (data.country !== undefined) doc.country = data.country;
    if (data.query_template !== undefined) doc.query_template = data.query_template;
    if (data.success_rate !== undefined) doc.success_rate = data.success_rate;
    if (data.total_uses !== undefined) doc.total_uses = data.total_uses;
    if (data.successful_discoveries !== undefined) doc.successful_discoveries = data.successful_discoveries;
    if (data.false_positives !== undefined) doc.false_positives = data.false_positives;
    if (data.tags !== undefined) doc.tags = data.tags;
    if (data.origin !== undefined) doc.origin = data.origin;
    if (data.parent_strategy_id !== undefined) doc.parent_strategy_id = data.parent_strategy_id;
    if (data.last_used !== undefined) doc.last_used = data.last_used;
    if (data.deprecated_at !== undefined) doc.deprecated_at = data.deprecated_at;
    if (data.deprecation_reason !== undefined) doc.deprecation_reason = data.deprecation_reason;

    return doc;
  }

  /**
   * Get active strategies for a platform and country
   */
  async getActiveStrategies(
    platform: DeliveryPlatform,
    country: SupportedCountry,
    options?: { minSuccessRate?: number; tags?: StrategyTag[] }
  ): Promise<DiscoveryStrategyDoc[]> {
    // Query by platform and country first
    const snapshot = await this.collection
      .where('platform', '==', platform)
      .where('country', '==', country)
      .get();

    // Filter out deprecated strategies (deprecated_at might not exist)
    let strategies = snapshot.docs
      .map((doc) => this.fromFirestore(doc))
      .filter((s) => !s.deprecated_at);

    // Filter by success rate
    if (options?.minSuccessRate !== undefined) {
      strategies = strategies.filter((s) => s.success_rate >= options.minSuccessRate!);
    }

    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      strategies = strategies.filter((s) =>
        options.tags!.some((tag) => s.tags.includes(tag))
      );
    }

    // Sort by success rate descending
    return strategies.sort((a, b) => b.success_rate - a.success_rate);
  }

  /**
   * Get best performing strategies overall
   */
  async getTopStrategies(limit: number = 10): Promise<DiscoveryStrategyDoc[]> {
    const snapshot = await this.collection
      .where('deprecated_at', '==', null)
      .where('total_uses', '>=', 5) // At least 5 uses for statistical significance
      .orderBy('total_uses')
      .orderBy('success_rate', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get strategies that need more data (low usage)
   */
  async getUndertestedStrategies(maxUses: number = 10): Promise<DiscoveryStrategyDoc[]> {
    const snapshot = await this.collection
      .where('deprecated_at', '==', null)
      .where('total_uses', '<', maxUses)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Record strategy usage and outcome
   */
  async recordUsage(
    strategyId: string,
    outcome: { success: boolean; was_false_positive: boolean }
  ): Promise<DiscoveryStrategyDoc> {
    const strategy = await this.getById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const newTotalUses = strategy.total_uses + 1;
    const newSuccessful = strategy.successful_discoveries + (outcome.success ? 1 : 0);
    const newFalsePositives = strategy.false_positives + (outcome.was_false_positive ? 1 : 0);
    const newSuccessRate = Math.round((newSuccessful / newTotalUses) * 100);

    return this.update(strategyId, {
      total_uses: newTotalUses,
      successful_discoveries: newSuccessful,
      false_positives: newFalsePositives,
      success_rate: newSuccessRate,
      last_used: new Date(),
    });
  }

  /**
   * Deprecate a low-performing strategy
   */
  async deprecate(strategyId: string, reason: string): Promise<DiscoveryStrategyDoc> {
    return this.update(strategyId, {
      deprecated_at: new Date(),
      deprecation_reason: reason,
    });
  }

  /**
   * Create an evolved strategy from a parent
   */
  async createEvolved(
    parentId: string,
    newQueryTemplate: string,
    tags?: StrategyTag[]
  ): Promise<DiscoveryStrategyDoc> {
    const parent = await this.getById(parentId);
    if (!parent) {
      throw new Error(`Parent strategy ${parentId} not found`);
    }

    return this.create({
      platform: parent.platform,
      country: parent.country,
      query_template: newQueryTemplate,
      success_rate: parent.success_rate, // Start with parent's rate
      total_uses: 0,
      successful_discoveries: 0,
      false_positives: 0,
      tags: tags || parent.tags,
      origin: 'evolved',
      parent_strategy_id: parentId,
    });
  }

  /**
   * Seed the collection with initial strategies
   */
  async seedStrategies(strategies: typeof SEED_STRATEGIES): Promise<number> {
    let created = 0;

    for (const strategy of strategies) {
      // Check if similar strategy exists
      const existing = await this.collection
        .where('platform', '==', strategy.platform)
        .where('country', '==', strategy.country)
        .where('query_template', '==', strategy.query_template)
        .limit(1)
        .get();

      if (existing.empty) {
        await this.create(strategy);
        created++;
      }
    }

    return created;
  }

  /**
   * Get strategies grouped by performance tier
   */
  async getStrategyTiers(): Promise<{
    high: DiscoveryStrategyDoc[];
    medium: DiscoveryStrategyDoc[];
    low: DiscoveryStrategyDoc[];
    untested: DiscoveryStrategyDoc[];
  }> {
    const all = await this.getAll();
    const active = all.filter((s) => !s.deprecated_at);

    return {
      high: active.filter((s) => s.total_uses >= 5 && s.success_rate >= 70),
      medium: active.filter((s) => s.total_uses >= 5 && s.success_rate >= 40 && s.success_rate < 70),
      low: active.filter((s) => s.total_uses >= 5 && s.success_rate < 40),
      untested: active.filter((s) => s.total_uses < 5),
    };
  }
}

// Singleton instance
export const discoveryStrategies = new DiscoveryStrategiesCollection();
