import type { QueryDocumentSnapshot, DocumentData, WriteBatch } from 'firebase-admin/firestore';
import { getFirestore, timestampToDate, createTimestamp, generateId } from '../firestore.js';
import type { Promotion, PromoType } from '@pad/core';

export interface PromotionQueryOptions {
  venueId?: string;
  chainId?: string;
  promoType?: PromoType;
  activeOnly?: boolean;
  productSku?: string;
  limit?: number;
  offset?: number;
}

/**
 * Promotions collection (no updated_at field)
 */
export class PromotionsCollection {
  private collectionName = 'promotions';
  private get db() {
    return getFirestore();
  }
  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): Promotion {
    const data = doc.data();
    const validFrom = timestampToDate(data.valid_from);
    const validUntil = timestampToDate(data.valid_until);
    const now = new Date();

    // Always compute active status dynamically based on current date
    // We don't use stored 'active' field to ensure freshness
    const active = validFrom <= now && validUntil >= now;

    return {
      id: doc.id,
      venue_id: data.venue_id,
      chain_id: data.chain_id,
      product_skus: data.product_skus || [],
      promo_type: data.promo_type,
      discount: data.discount,
      title: data.title,
      description: data.description,
      image_url: data.image_url,
      valid_from: validFrom,
      valid_until: validUntil,
      terms: data.terms,
      source: data.source,
      active,
      created_at: timestampToDate(data.created_at),
    };
  }

  protected toFirestore(data: Partial<Promotion>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;
    // Never store 'active' - it's computed dynamically in fromFirestore
    delete result.active;

    // Convert dates to Firestore Timestamps
    if (data.valid_from) {
      result.valid_from = createTimestamp(data.valid_from);
    }
    if (data.valid_until) {
      result.valid_until = createTimestamp(data.valid_until);
    }
    if (data.created_at) {
      result.created_at = createTimestamp(data.created_at);
    }

    // Remove undefined values
    Object.keys(result).forEach((key) => {
      if (result[key] === undefined) {
        delete result[key];
      }
    });

    return result;
  }

  /**
   * Get promotion by ID
   */
  async getById(id: string): Promise<Promotion | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Create a new promotion
   *
   * Note: The 'active' field is computed dynamically in fromFirestore based on
   * valid_from/valid_until dates. We don't store it to avoid stale data.
   */
  async create(data: Omit<Promotion, 'id' | 'created_at' | 'active'>): Promise<Promotion> {
    const id = generateId(this.collectionName);
    const now = new Date();

    // Note: We intentionally do NOT store 'active' - it's computed in fromFirestore
    const docData = {
      ...this.toFirestore(data as Partial<Promotion>),
      created_at: createTimestamp(now),
    };

    await this.collection.doc(id).set(docData);

    // Compute active for the returned object
    const active = data.valid_from <= now && data.valid_until >= now;

    return {
      id,
      ...data,
      active,
      created_at: now,
    };
  }

  /**
   * Update a promotion
   */
  async update(id: string, data: Partial<Omit<Promotion, 'id' | 'created_at'>>): Promise<Promotion> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Promotion ${id} not found`);
    }

    await docRef.update(this.toFirestore(data as Partial<Promotion>));

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Failed to update promotion');
    }
    return updated;
  }

  /**
   * Delete a promotion
   */
  async delete(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }

  /**
   * Query promotions with filters
   */
  async query(options: PromotionQueryOptions = {}): Promise<Promotion[]> {
    let query = this.collection.orderBy('valid_until', 'asc');

    if (options.venueId) {
      query = query.where('venue_id', '==', options.venueId);
    }

    if (options.chainId) {
      query = query.where('chain_id', '==', options.chainId);
    }

    if (options.promoType) {
      query = query.where('promo_type', '==', options.promoType);
    }

    if (options.productSku) {
      query = query.where('product_skus', 'array-contains', options.productSku);
    }

    if (options.activeOnly !== false) {
      const now = createTimestamp();
      query = query.where('valid_until', '>=', now);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const snapshot = await query.get();
    let promotions = snapshot.docs.map((doc) => this.fromFirestore(doc));

    // Filter by valid_from in memory (Firestore can't do range queries on two fields)
    if (options.activeOnly !== false) {
      const now = new Date();
      promotions = promotions.filter((p) => p.valid_from <= now);
    }

    return promotions;
  }

  /**
   * Get active promotions for a venue
   */
  async getActiveForVenue(venueId: string): Promise<Promotion[]> {
    return this.query({ venueId, activeOnly: true });
  }

  /**
   * Get active promotions for a chain
   */
  async getActiveForChain(chainId: string): Promise<Promotion[]> {
    return this.query({ chainId, activeOnly: true });
  }

  /**
   * Get promotions for a specific product
   */
  async getForProduct(productSku: string, activeOnly: boolean = true): Promise<Promotion[]> {
    return this.query({ productSku, activeOnly });
  }

  /**
   * Get expired promotions for cleanup
   */
  async getExpired(limit: number = 100): Promise<Promotion[]> {
    const now = createTimestamp();

    const snapshot = await this.collection
      .where('valid_until', '<', now)
      .orderBy('valid_until', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Delete expired promotions
   */
  async deleteExpired(): Promise<number> {
    const expired = await this.getExpired(500);

    if (expired.length === 0) return 0;

    const batch: WriteBatch = this.db.batch();
    expired.forEach((promo) => {
      batch.delete(this.collection.doc(promo.id));
    });
    await batch.commit();

    return expired.length;
  }

  /**
   * Get upcoming promotions (starting in the future)
   */
  async getUpcoming(daysAhead: number = 7, limit: number = 50): Promise<Promotion[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const snapshot = await this.collection
      .where('valid_from', '>', createTimestamp(now))
      .where('valid_from', '<', createTimestamp(futureDate))
      .orderBy('valid_from', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }
}

export const promotions = new PromotionsCollection();
