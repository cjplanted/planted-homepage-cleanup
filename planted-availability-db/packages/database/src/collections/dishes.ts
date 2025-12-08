import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { BaseCollection, type QueryOptions } from './base.js';
import { timestampToDate, createTimestamp } from '../firestore.js';
import type { Dish, VenueStatus } from '@pad/core';

export interface DishQueryOptions extends QueryOptions {
  venueId?: string;
  status?: VenueStatus;
  plantedProducts?: string[];
  cuisineType?: string;
  dietaryTags?: string[];
}

export class DishesCollection extends BaseCollection<Dish> {
  protected collectionName = 'dishes';

  protected fromFirestore(doc: QueryDocumentSnapshot): Dish {
    const data = doc.data();
    return {
      id: doc.id,
      venue_id: data.venue_id,
      name: data.name,
      name_localized: data.name_localized,
      description: data.description,
      description_localized: data.description_localized,
      planted_products: data.planted_products,
      price: data.price,
      image_url: data.image_url,
      image_source: data.image_source,
      dietary_tags: data.dietary_tags || [],
      cuisine_type: data.cuisine_type,
      availability: {
        ...data.availability,
        start_date: data.availability?.start_date ? timestampToDate(data.availability.start_date) : undefined,
        end_date: data.availability?.end_date ? timestampToDate(data.availability.end_date) : undefined,
      },
      delivery_partners: data.delivery_partners,
      source: data.source,
      last_verified: timestampToDate(data.last_verified),
      status: data.status,
      created_at: timestampToDate(data.created_at),
      updated_at: timestampToDate(data.updated_at),
    };
  }

  protected toFirestore(data: Partial<Dish>): DocumentData {
    const result: DocumentData = { ...data };

    // Convert dates to Firestore Timestamps
    if (data.last_verified) {
      result.last_verified = createTimestamp(data.last_verified);
    }

    if (data.availability) {
      result.availability = { ...data.availability };
      if (data.availability.start_date) {
        result.availability.start_date = createTimestamp(data.availability.start_date);
      }
      if (data.availability.end_date) {
        result.availability.end_date = createTimestamp(data.availability.end_date);
      }
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
   * Query dishes with filters
   */
  async query(options: DishQueryOptions = {}): Promise<Dish[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options.venueId) {
      query = query.where('venue_id', '==', options.venueId);
    }

    if (options.status) {
      query = query.where('status', '==', options.status);
    }

    if (options.cuisineType) {
      query = query.where('cuisine_type', '==', options.cuisineType);
    }

    // Note: array-contains can only be used once per query
    if (options.plantedProducts && options.plantedProducts.length > 0) {
      query = query.where('planted_products', 'array-contains-any', options.plantedProducts);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    const snapshot = await query.get();
    let dishes = snapshot.docs.map((doc) => this.fromFirestore(doc));

    // Filter by dietary tags in memory (Firestore limitation)
    if (options.dietaryTags && options.dietaryTags.length > 0) {
      dishes = dishes.filter((dish) =>
        options.dietaryTags!.every((tag) => dish.dietary_tags.includes(tag))
      );
    }

    return dishes;
  }

  /**
   * Get all dishes for a venue
   */
  async getByVenue(venueId: string, activeOnly: boolean = true): Promise<Dish[]> {
    let query = this.collection.where('venue_id', '==', venueId);

    if (activeOnly) {
      query = query.where('status', '==', 'active');
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get dishes by planted product SKU
   */
  async getByProduct(productSku: string, limit: number = 50): Promise<Dish[]> {
    const snapshot = await this.collection
      .where('planted_products', 'array-contains', productSku)
      .where('status', '==', 'active')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Search dishes by name (basic prefix search)
   * For better search, use Algolia integration
   */
  async searchByName(searchTerm: string, limit: number = 20): Promise<Dish[]> {
    const normalizedTerm = searchTerm.toLowerCase();

    // Firestore doesn't support full-text search, so we fetch active dishes and filter
    const snapshot = await this.collection
      .where('status', '==', 'active')
      .limit(200)
      .get();

    const dishes = snapshot.docs.map((doc) => this.fromFirestore(doc));

    return dishes
      .filter((dish) => dish.name.toLowerCase().includes(normalizedTerm))
      .slice(0, limit);
  }

  /**
   * Get stale dishes that need re-verification
   */
  async getStaleDishes(daysSinceVerification: number = 7, limit: number = 100): Promise<Dish[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceVerification);

    const snapshot = await this.collection
      .where('status', '==', 'active')
      .where('last_verified', '<', createTimestamp(cutoffDate))
      .orderBy('last_verified', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Mark dish as verified
   */
  async markVerified(id: string): Promise<Dish> {
    return this.update(id, {
      last_verified: new Date(),
      status: 'active',
    } as Partial<Dish>);
  }

  /**
   * Archive a dish
   */
  async archive(id: string): Promise<Dish> {
    return this.update(id, { status: 'archived' } as Partial<Dish>);
  }

  /**
   * Archive all dishes for a venue
   */
  async archiveByVenue(venueId: string): Promise<number> {
    const dishes = await this.getByVenue(venueId, true);
    const batch = dishes.map((dish) => ({
      type: 'update' as const,
      id: dish.id,
      data: { status: 'archived' as const },
    }));

    if (batch.length > 0) {
      await this.batch(batch);
    }

    return batch.length;
  }

  /**
   * Mark dish as stale (hasn't been verified recently)
   */
  async markStale(id: string): Promise<Dish> {
    return this.update(id, { status: 'stale' } as Partial<Dish>);
  }

  /**
   * Mark multiple dishes as stale in batch
   */
  async markManyStale(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const batch = ids.map((id) => ({
      type: 'update' as const,
      id,
      data: { status: 'stale' as const },
    }));

    await this.batch(batch);
    return batch.length;
  }

  /**
   * Archive multiple dishes in batch
   */
  async archiveMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const batch = ids.map((id) => ({
      type: 'update' as const,
      id,
      data: { status: 'archived' as const },
    }));

    await this.batch(batch);
    return batch.length;
  }

  /**
   * Get dishes for archival (very stale - not verified in X days)
   */
  async getDishesForArchival(daysSinceVerification: number = 30, limit: number = 100): Promise<Dish[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceVerification);

    const snapshot = await this.collection
      .where('status', 'in', ['active', 'stale'])
      .where('last_verified', '<', createTimestamp(cutoffDate))
      .orderBy('last_verified', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get freshness statistics
   */
  async getFreshnessStats(): Promise<{
    total: number;
    active: number;
    stale: number;
    archived: number;
    avgDaysSinceVerification: number;
  }> {
    const [activeSnapshot, staleSnapshot, archivedSnapshot] = await Promise.all([
      this.collection.where('status', '==', 'active').count().get(),
      this.collection.where('status', '==', 'stale').count().get(),
      this.collection.where('status', '==', 'archived').count().get(),
    ]);

    const active = activeSnapshot.data().count;
    const stale = staleSnapshot.data().count;
    const archived = archivedSnapshot.data().count;
    const total = active + stale + archived;

    // Calculate average days since verification for active dishes
    const activeDishes = await this.query({ status: 'active', limit: 100 });
    const now = Date.now();
    const avgDays = activeDishes.length > 0
      ? activeDishes.reduce((sum, d) => sum + (now - d.last_verified.getTime()) / (1000 * 60 * 60 * 24), 0) / activeDishes.length
      : 0;

    return {
      total,
      active,
      stale,
      archived,
      avgDaysSinceVerification: Math.round(avgDays * 10) / 10,
    };
  }
}

export const dishes = new DishesCollection();
