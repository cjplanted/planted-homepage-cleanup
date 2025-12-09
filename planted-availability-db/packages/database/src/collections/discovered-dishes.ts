import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection, type QueryOptions } from './base.js';
import type {
  ExtractedDish,
  CreateExtractedDishInput,
  ExtractedDishStatus,
  PriceEntry,
  SupportedCountry,
  ConfidenceFactor,
} from '@pad/core';

export interface DiscoveredDishQueryOptions extends QueryOptions {
  status?: ExtractedDishStatus;
  chain_id?: string;
  venue_id?: string;
  planted_product?: string;
  min_confidence?: number;
}

/**
 * Collection for discovered dishes from extraction runs
 */
class DiscoveredDishesCollection extends BaseCollection<ExtractedDish> {
  protected collectionName = 'discovered_dishes';

  protected fromFirestore(doc: QueryDocumentSnapshot): ExtractedDish {
    const data = doc.data();
    return {
      id: doc.id,
      extraction_run_id: data.extraction_run_id,
      venue_id: data.venue_id,
      venue_name: data.venue_name,
      chain_id: data.chain_id,
      chain_name: data.chain_name,
      name: data.name,
      description: data.description,
      category: data.category,
      image_url: data.image_url,
      planted_product: data.planted_product,
      product_confidence: data.product_confidence ?? 0,
      product_match_reason: data.product_match_reason || '',
      prices: (data.prices || []).map((p: DocumentData) => ({
        ...p,
        last_seen: (p.last_seen as Timestamp)?.toDate() || new Date(),
      })),
      price_by_country: data.price_by_country || {},
      is_vegan: data.is_vegan ?? true,
      dietary_tags: data.dietary_tags || [],
      confidence_score: data.confidence_score ?? 0,
      confidence_factors: data.confidence_factors || [],
      status: data.status || 'discovered',
      rejection_reason: data.rejection_reason,
      production_dish_id: data.production_dish_id,
      discovered_by_strategy_id: data.discovered_by_strategy_id,
      source_url: data.source_url,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      verified_at: data.verified_at ? (data.verified_at as Timestamp).toDate() : undefined,
      promoted_at: data.promoted_at ? (data.promoted_at as Timestamp).toDate() : undefined,
    };
  }

  protected toFirestore(data: Partial<ExtractedDish>): DocumentData {
    const doc: DocumentData = {};

    if (data.extraction_run_id !== undefined) doc.extraction_run_id = data.extraction_run_id;
    if (data.venue_id !== undefined) doc.venue_id = data.venue_id;
    if (data.venue_name !== undefined) doc.venue_name = data.venue_name;
    if (data.chain_id !== undefined) doc.chain_id = data.chain_id;
    if (data.chain_name !== undefined) doc.chain_name = data.chain_name;
    if (data.name !== undefined) doc.name = data.name;
    if (data.description !== undefined) doc.description = data.description;
    if (data.category !== undefined) doc.category = data.category;
    if (data.image_url !== undefined) doc.image_url = data.image_url;
    if (data.planted_product !== undefined) doc.planted_product = data.planted_product;
    if (data.product_confidence !== undefined) doc.product_confidence = data.product_confidence;
    if (data.product_match_reason !== undefined) doc.product_match_reason = data.product_match_reason;
    if (data.prices !== undefined) doc.prices = data.prices;
    if (data.price_by_country !== undefined) doc.price_by_country = data.price_by_country;
    if (data.is_vegan !== undefined) doc.is_vegan = data.is_vegan;
    if (data.dietary_tags !== undefined) doc.dietary_tags = data.dietary_tags;
    if (data.confidence_score !== undefined) doc.confidence_score = data.confidence_score;
    if (data.confidence_factors !== undefined) doc.confidence_factors = data.confidence_factors;
    if (data.status !== undefined) doc.status = data.status;
    if (data.rejection_reason !== undefined) doc.rejection_reason = data.rejection_reason;
    if (data.production_dish_id !== undefined) doc.production_dish_id = data.production_dish_id;
    if (data.discovered_by_strategy_id !== undefined) doc.discovered_by_strategy_id = data.discovered_by_strategy_id;
    if (data.source_url !== undefined) doc.source_url = data.source_url;
    if (data.verified_at !== undefined) doc.verified_at = data.verified_at;
    if (data.promoted_at !== undefined) doc.promoted_at = data.promoted_at;

    return doc;
  }

  /**
   * Create a new discovered dish
   */
  async createDish(input: CreateExtractedDishInput): Promise<ExtractedDish> {
    return this.create({
      ...input,
      status: 'discovered',
    });
  }

  /**
   * Query dishes with filters
   */
  async query(options: DiscoveredDishQueryOptions = {}): Promise<ExtractedDish[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options.status) {
      query = query.where('status', '==', options.status);
    }

    if (options.chain_id) {
      query = query.where('chain_id', '==', options.chain_id);
    }

    if (options.venue_id) {
      query = query.where('venue_id', '==', options.venue_id);
    }

    if (options.planted_product) {
      query = query.where('planted_product', '==', options.planted_product);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    let dishes = snapshot.docs.map((doc) => this.fromFirestore(doc));

    // Filter by confidence in memory (compound queries limited in Firestore)
    if (options.min_confidence !== undefined) {
      dishes = dishes.filter((d) => d.confidence_score >= options.min_confidence!);
    }

    return dishes;
  }

  /**
   * Get dishes by status
   */
  async getByStatus(status: ExtractedDishStatus, limit?: number): Promise<ExtractedDish[]> {
    let query = this.collection
      .where('status', '==', status)
      .orderBy('confidence_score', 'desc');

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get dishes pending review (high confidence, discovered status)
   */
  async getPendingReview(limit: number = 20): Promise<ExtractedDish[]> {
    const snapshot = await this.collection
      .where('status', '==', 'discovered')
      .orderBy('confidence_score', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get dishes by venue
   */
  async getByVenue(venueId: string): Promise<ExtractedDish[]> {
    const snapshot = await this.collection
      .where('venue_id', '==', venueId)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get dishes by chain
   */
  async getByChain(chainId: string): Promise<ExtractedDish[]> {
    const snapshot = await this.collection
      .where('chain_id', '==', chainId)
      .orderBy('name')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Find dish by name and venue (for deduplication)
   */
  async findByNameAndVenue(name: string, venueId: string): Promise<ExtractedDish | null> {
    const snapshot = await this.collection
      .where('venue_id', '==', venueId)
      .where('name', '==', name)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return this.fromFirestore(snapshot.docs[0]);
  }

  /**
   * Verify a dish
   */
  async verifyDish(id: string): Promise<ExtractedDish> {
    return this.update(id, {
      status: 'verified',
      verified_at: new Date(),
    });
  }

  /**
   * Reject a dish
   */
  async rejectDish(id: string, reason: string): Promise<ExtractedDish> {
    return this.update(id, {
      status: 'rejected',
      rejection_reason: reason,
    });
  }

  /**
   * Mark dish as promoted to production
   */
  async markPromoted(id: string, productionDishId: string): Promise<ExtractedDish> {
    return this.update(id, {
      status: 'promoted',
      production_dish_id: productionDishId,
      promoted_at: new Date(),
    });
  }

  /**
   * Mark dish as stale
   */
  async markStale(id: string): Promise<ExtractedDish> {
    return this.update(id, {
      status: 'stale',
    });
  }

  /**
   * Update price for a dish
   */
  async updatePrice(
    id: string,
    priceEntry: PriceEntry
  ): Promise<ExtractedDish> {
    const dish = await this.getById(id);
    if (!dish) {
      throw new Error(`Dish ${id} not found`);
    }

    // Update the prices array
    const updatedPrices = dish.prices.filter(
      (p) => !(p.country === priceEntry.country && p.platform === priceEntry.platform)
    );
    updatedPrices.push(priceEntry);

    // Recalculate price_by_country (pick most recent per country)
    const priceByCountry: Partial<Record<SupportedCountry, string>> = {};
    for (const country of ['CH', 'DE', 'AT'] as SupportedCountry[]) {
      const countryPrices = updatedPrices.filter((p) => p.country === country);
      if (countryPrices.length > 0) {
        // Sort by last_seen, pick most recent
        countryPrices.sort((a, b) => b.last_seen.getTime() - a.last_seen.getTime());
        priceByCountry[country] = countryPrices[0].formatted;
      }
    }

    return this.update(id, {
      prices: updatedPrices,
      price_by_country: priceByCountry,
      updated_at: new Date(),
    });
  }

  /**
   * Update confidence score
   */
  async updateConfidence(
    id: string,
    score: number,
    factors: ConfidenceFactor[]
  ): Promise<ExtractedDish> {
    return this.update(id, {
      confidence_score: score,
      confidence_factors: factors,
    });
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    by_status: Record<ExtractedDishStatus, number>;
    by_product: Record<string, number>;
    by_chain: Record<string, number>;
    average_confidence: number;
  }> {
    const all = await this.getAll();

    const byStatus: Record<ExtractedDishStatus, number> = {
      discovered: 0,
      verified: 0,
      rejected: 0,
      promoted: 0,
      stale: 0,
    };

    const byProduct: Record<string, number> = {};
    const byChain: Record<string, number> = {};
    let totalConfidence = 0;

    for (const dish of all) {
      byStatus[dish.status]++;

      if (dish.planted_product) {
        byProduct[dish.planted_product] = (byProduct[dish.planted_product] || 0) + 1;
      }

      if (dish.chain_id) {
        byChain[dish.chain_id] = (byChain[dish.chain_id] || 0) + 1;
      }

      totalConfidence += dish.confidence_score;
    }

    return {
      total: all.length,
      by_status: byStatus,
      by_product: byProduct,
      by_chain: byChain,
      average_confidence: all.length > 0 ? Math.round(totalConfidence / all.length) : 0,
    };
  }

  /**
   * Get unique dishes by chain (for export - deduplicated)
   */
  async getUniqueDishesForChain(chainId: string): Promise<ExtractedDish[]> {
    const dishes = await this.getByChain(chainId);

    // Group by name, pick highest confidence
    const uniqueMap = new Map<string, ExtractedDish>();

    for (const dish of dishes) {
      if (dish.status !== 'verified' && dish.status !== 'promoted') continue;

      const existing = uniqueMap.get(dish.name);
      if (!existing || dish.confidence_score > existing.confidence_score) {
        uniqueMap.set(dish.name, dish);
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Get stale dishes that need re-verification
   */
  async getStaleDishes(daysSinceUpdate: number = 7, limit: number = 100): Promise<ExtractedDish[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceUpdate);

    // Get verified dishes that haven't been updated recently
    const snapshot = await this.collection
      .where('status', '==', 'verified')
      .where('updated_at', '<', cutoffDate)
      .orderBy('updated_at', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }
}

export const discoveredDishes = new DiscoveredDishesCollection();
