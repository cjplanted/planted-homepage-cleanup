import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection } from './base.js';
import type {
  DishExtractionStrategy,
  CreateDishExtractionStrategyInput,
  DeliveryPlatform,
  DishStrategyTag,
  ExtractionConfig,
  DISH_SEED_STRATEGIES,
} from '@pad/core';

/**
 * Collection for dish extraction strategies that the agent learns and evolves
 */
class DishExtractionStrategiesCollection extends BaseCollection<DishExtractionStrategy> {
  protected collectionName = 'dish_extraction_strategies';

  protected fromFirestore(doc: QueryDocumentSnapshot): DishExtractionStrategy {
    const data = doc.data();
    return {
      id: doc.id,
      platform: data.platform,
      chain_id: data.chain_id,
      extraction_config: data.extraction_config || {},
      success_rate: data.success_rate ?? 50,
      total_uses: data.total_uses ?? 0,
      successful_extractions: data.successful_extractions ?? 0,
      failed_extractions: data.failed_extractions ?? 0,
      tags: data.tags || [],
      origin: data.origin || 'seed',
      parent_strategy_id: data.parent_strategy_id,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      last_used: data.last_used ? (data.last_used as Timestamp).toDate() : undefined,
      deprecated_at: data.deprecated_at ? (data.deprecated_at as Timestamp).toDate() : undefined,
      deprecation_reason: data.deprecation_reason,
    };
  }

  protected toFirestore(data: Partial<DishExtractionStrategy>): DocumentData {
    const doc: DocumentData = {};

    if (data.platform !== undefined) doc.platform = data.platform;
    if (data.chain_id !== undefined) doc.chain_id = data.chain_id;
    if (data.extraction_config !== undefined) doc.extraction_config = data.extraction_config;
    if (data.success_rate !== undefined) doc.success_rate = data.success_rate;
    if (data.total_uses !== undefined) doc.total_uses = data.total_uses;
    if (data.successful_extractions !== undefined) doc.successful_extractions = data.successful_extractions;
    if (data.failed_extractions !== undefined) doc.failed_extractions = data.failed_extractions;
    if (data.tags !== undefined) doc.tags = data.tags;
    if (data.origin !== undefined) doc.origin = data.origin;
    if (data.parent_strategy_id !== undefined) doc.parent_strategy_id = data.parent_strategy_id;
    if (data.last_used !== undefined) doc.last_used = data.last_used;
    if (data.deprecated_at !== undefined) doc.deprecated_at = data.deprecated_at;
    if (data.deprecation_reason !== undefined) doc.deprecation_reason = data.deprecation_reason;

    return doc;
  }

  /**
   * Get active strategy for a platform (and optionally chain)
   */
  async getStrategy(
    platform: DeliveryPlatform,
    chainId?: string
  ): Promise<DishExtractionStrategy | null> {
    // First try to find a chain-specific strategy
    if (chainId) {
      const chainSnapshot = await this.collection
        .where('platform', '==', platform)
        .where('chain_id', '==', chainId)
        .limit(1)
        .get();

      if (!chainSnapshot.empty) {
        const strategy = this.fromFirestore(chainSnapshot.docs[0]);
        if (!strategy.deprecated_at) {
          return strategy;
        }
      }
    }

    // Fall back to platform default
    const platformSnapshot = await this.collection
      .where('platform', '==', platform)
      .where('chain_id', '==', null)
      .orderBy('success_rate', 'desc')
      .limit(1)
      .get();

    if (!platformSnapshot.empty) {
      const strategy = this.fromFirestore(platformSnapshot.docs[0]);
      if (!strategy.deprecated_at) {
        return strategy;
      }
    }

    return null;
  }

  /**
   * Get all active strategies for a platform
   */
  async getActiveStrategies(
    platform: DeliveryPlatform,
    options?: { minSuccessRate?: number; tags?: DishStrategyTag[] }
  ): Promise<DishExtractionStrategy[]> {
    const snapshot = await this.collection
      .where('platform', '==', platform)
      .get();

    let strategies = snapshot.docs
      .map((doc) => this.fromFirestore(doc))
      .filter((s) => !s.deprecated_at);

    if (options?.minSuccessRate !== undefined) {
      strategies = strategies.filter((s) => s.success_rate >= options.minSuccessRate!);
    }

    if (options?.tags && options.tags.length > 0) {
      strategies = strategies.filter((s) =>
        options.tags!.some((tag) => s.tags.includes(tag))
      );
    }

    return strategies.sort((a, b) => b.success_rate - a.success_rate);
  }

  /**
   * Record strategy usage and outcome
   */
  async recordUsage(
    strategyId: string,
    outcome: { success: boolean; dishes_found: number }
  ): Promise<DishExtractionStrategy> {
    const strategy = await this.getById(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const newTotalUses = strategy.total_uses + 1;
    const newSuccessful = strategy.successful_extractions + (outcome.success ? 1 : 0);
    const newFailed = strategy.failed_extractions + (outcome.success ? 0 : 1);
    const newSuccessRate = Math.round((newSuccessful / newTotalUses) * 100);

    return this.update(strategyId, {
      total_uses: newTotalUses,
      successful_extractions: newSuccessful,
      failed_extractions: newFailed,
      success_rate: newSuccessRate,
      last_used: new Date(),
    });
  }

  /**
   * Deprecate a low-performing strategy
   */
  async deprecate(strategyId: string, reason: string): Promise<DishExtractionStrategy> {
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
    newConfig: ExtractionConfig,
    tags?: DishStrategyTag[]
  ): Promise<DishExtractionStrategy> {
    const parent = await this.getById(parentId);
    if (!parent) {
      throw new Error(`Parent strategy ${parentId} not found`);
    }

    return this.create({
      platform: parent.platform,
      chain_id: parent.chain_id,
      extraction_config: newConfig,
      success_rate: parent.success_rate,
      total_uses: 0,
      successful_extractions: 0,
      failed_extractions: 0,
      tags: tags || parent.tags,
      origin: 'evolved',
      parent_strategy_id: parentId,
    });
  }

  /**
   * Seed the collection with initial strategies
   */
  async seedStrategies(strategies: typeof DISH_SEED_STRATEGIES): Promise<number> {
    let created = 0;

    for (const strategy of strategies) {
      // Check if platform strategy exists
      const existing = await this.collection
        .where('platform', '==', strategy.platform)
        .where('chain_id', '==', null)
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
    high: DishExtractionStrategy[];
    medium: DishExtractionStrategy[];
    low: DishExtractionStrategy[];
    untested: DishExtractionStrategy[];
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

export const dishExtractionStrategies = new DishExtractionStrategiesCollection();
