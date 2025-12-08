import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { BaseCollection, type QueryOptions } from './base.js';
import { createTimestamp, timestampToDate } from '../firestore.js';
import type { RetailAvailability, DataSource } from '@pad/core';

export interface RetailAvailabilityQueryOptions extends QueryOptions {
  venue_id?: string;
  product_sku?: string;
  in_stock?: boolean;
}

export class RetailAvailabilityCollection extends BaseCollection<RetailAvailability> {
  protected collectionName = 'retail_availability';

  protected fromFirestore(doc: QueryDocumentSnapshot): RetailAvailability {
    const data = doc.data();
    return {
      id: doc.id,
      venue_id: data.venue_id,
      product_sku: data.product_sku,
      in_stock: data.in_stock,
      price: data.price,
      promotion: data.promotion
        ? {
            id: data.promotion.id,
            price: data.promotion.price,
            valid_until: timestampToDate(data.promotion.valid_until),
          }
        : undefined,
      shelf_location: data.shelf_location,
      last_verified: timestampToDate(data.last_verified),
      source: data.source,
      created_at: timestampToDate(data.created_at),
      updated_at: timestampToDate(data.updated_at),
    };
  }

  protected toFirestore(data: Partial<RetailAvailability>): DocumentData {
    const result: DocumentData = { ...data };

    // Convert dates to Firestore Timestamps
    if (data.last_verified) {
      result.last_verified = createTimestamp(data.last_verified);
    }

    if (data.promotion?.valid_until) {
      result.promotion = {
        ...data.promotion,
        valid_until: createTimestamp(data.promotion.valid_until),
      };
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
   * Query retail availability with filters
   */
  async query(options: RetailAvailabilityQueryOptions = {}): Promise<RetailAvailability[]> {
    let query = this.collection.orderBy('last_verified', 'desc');

    if (options.venue_id) {
      query = query.where('venue_id', '==', options.venue_id);
    }

    if (options.product_sku) {
      query = query.where('product_sku', '==', options.product_sku);
    }

    if (options.in_stock !== undefined) {
      query = query.where('in_stock', '==', options.in_stock);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get availability for a specific venue
   */
  async getByVenue(venueId: string): Promise<RetailAvailability[]> {
    const snapshot = await this.collection
      .where('venue_id', '==', venueId)
      .orderBy('product_sku')
      .get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get availability for a specific product across all venues
   */
  async getByProduct(productSku: string): Promise<RetailAvailability[]> {
    const snapshot = await this.collection
      .where('product_sku', '==', productSku)
      .where('in_stock', '==', true)
      .get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get or create availability for a venue/product combination
   */
  async getOrCreate(
    venueId: string,
    productSku: string
  ): Promise<RetailAvailability | null> {
    const snapshot = await this.collection
      .where('venue_id', '==', venueId)
      .where('product_sku', '==', productSku)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return this.fromFirestore(snapshot.docs[0]);
  }

  /**
   * Bulk update availability from scraper
   */
  async bulkUpdate(
    updates: Array<{
      venue_id: string;
      product_sku: string;
      in_stock: boolean;
      price?: { regular: number; currency: string };
    }>,
    source: DataSource
  ): Promise<void> {
    const batch = this.db.batch();
    const now = new Date();

    for (const update of updates) {
      // Check if record exists
      const existing = await this.getOrCreate(update.venue_id, update.product_sku);

      if (existing) {
        const ref = this.collection.doc(existing.id);
        batch.update(ref, {
          in_stock: update.in_stock,
          price: update.price,
          last_verified: createTimestamp(now),
          source,
          updated_at: createTimestamp(now),
        });
      } else {
        const ref = this.collection.doc();
        batch.set(ref, {
          venue_id: update.venue_id,
          product_sku: update.product_sku,
          in_stock: update.in_stock,
          price: update.price,
          last_verified: createTimestamp(now),
          source,
          created_at: createTimestamp(now),
          updated_at: createTimestamp(now),
        });
      }
    }

    await batch.commit();
  }

  /**
   * Get stale availability records that need re-verification
   */
  async getStale(daysSinceVerification: number = 7, limit: number = 100): Promise<RetailAvailability[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceVerification);

    const snapshot = await this.collection
      .where('last_verified', '<', createTimestamp(cutoffDate))
      .orderBy('last_verified', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }
}

export const retailAvailability = new RetailAvailabilityCollection();
