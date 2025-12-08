/**
 * Staged Dishes Collection
 *
 * Partner-submitted dishes awaiting review before promotion to production.
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, timestampToDate, createTimestamp, generateId } from '../../firestore.js';
import type { StagedDish, StagingStatus } from '@pad/core';

export interface CreateStagedDishInput {
  batch_id: string;
  partner_id: string;
  external_id?: string;
  staged_venue_id?: string;
  production_venue_id?: string;
  venue_external_id?: string;
  data: StagedDish['data'];
  product_mapping?: Partial<StagedDish['product_mapping']>;
}

export interface StagedDishQueryOptions {
  batch_id?: string;
  partner_id?: string;
  staged_venue_id?: string;
  production_venue_id?: string;
  status?: StagingStatus | StagingStatus[];
  limit?: number;
  offset?: number;
}

/**
 * Staged Dishes Collection
 */
export class StagedDishesCollection {
  private collectionName = 'staged_dishes';

  private get db() {
    return getFirestore();
  }

  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): StagedDish {
    const data = doc.data();
    return {
      id: doc.id,
      batch_id: data.batch_id,
      partner_id: data.partner_id,
      external_id: data.external_id,
      status: data.status,
      confidence_score: data.confidence_score || 0,
      confidence_breakdown: data.confidence_breakdown,
      flags: data.flags || [],
      staged_venue_id: data.staged_venue_id,
      production_venue_id: data.production_venue_id,
      venue_external_id: data.venue_external_id,
      data: {
        ...data.data,
        availability: {
          ...data.data.availability,
          start_date: data.data.availability?.start_date
            ? timestampToDate(data.data.availability.start_date)
            : undefined,
          end_date: data.data.availability?.end_date
            ? timestampToDate(data.data.availability.end_date)
            : undefined,
        },
      },
      product_mapping: data.product_mapping || {
        auto_mapped: false,
        mapping_method: 'manual',
        mapping_confidence: 0,
      },
      review: data.review
        ? {
            reviewed_by: data.review.reviewed_by,
            reviewed_at: data.review.reviewed_at
              ? timestampToDate(data.review.reviewed_at)
              : undefined,
            decision: data.review.decision,
            notes: data.review.notes,
          }
        : undefined,
      created_at: timestampToDate(data.created_at),
      updated_at: timestampToDate(data.updated_at),
    };
  }

  protected toFirestore(data: Partial<StagedDish>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;

    // Convert dates in availability
    if (data.data?.availability?.start_date) {
      result.data = {
        ...result.data,
        availability: {
          ...result.data.availability,
          start_date: createTimestamp(data.data.availability.start_date),
        },
      };
    }
    if (data.data?.availability?.end_date) {
      result.data = {
        ...result.data,
        availability: {
          ...result.data.availability,
          end_date: createTimestamp(data.data.availability.end_date),
        },
      };
    }

    if (data.review?.reviewed_at) {
      result.review = {
        ...result.review,
        reviewed_at: createTimestamp(data.review.reviewed_at),
      };
    }
    if (data.created_at) {
      result.created_at = createTimestamp(data.created_at);
    }
    if (data.updated_at) {
      result.updated_at = createTimestamp(data.updated_at);
    }

    return result;
  }

  /**
   * Create a new staged dish
   */
  async create(input: CreateStagedDishInput): Promise<StagedDish> {
    const id = generateId(this.collectionName);
    const now = new Date();

    const dish: StagedDish = {
      id,
      batch_id: input.batch_id,
      partner_id: input.partner_id,
      external_id: input.external_id,
      status: 'pending',
      confidence_score: 0,
      flags: [],
      staged_venue_id: input.staged_venue_id,
      production_venue_id: input.production_venue_id,
      venue_external_id: input.venue_external_id,
      data: input.data,
      product_mapping: {
        auto_mapped: input.product_mapping?.auto_mapped ?? false,
        mapping_method: input.product_mapping?.mapping_method ?? 'manual',
        mapping_confidence: input.product_mapping?.mapping_confidence ?? 0,
        original_product_text: input.product_mapping?.original_product_text,
        suggested_products: input.product_mapping?.suggested_products,
      },
      created_at: now,
      updated_at: now,
    };

    await this.collection.doc(id).set(this.toFirestore(dish));
    return dish;
  }

  /**
   * Create multiple staged dishes in a batch
   */
  async createBatch(inputs: CreateStagedDishInput[]): Promise<StagedDish[]> {
    const batch = this.db.batch();
    const now = new Date();
    const dishes: StagedDish[] = [];

    for (const input of inputs) {
      const id = generateId(this.collectionName);
      const dish: StagedDish = {
        id,
        batch_id: input.batch_id,
        partner_id: input.partner_id,
        external_id: input.external_id,
        status: 'pending',
        confidence_score: 0,
        flags: [],
        staged_venue_id: input.staged_venue_id,
        production_venue_id: input.production_venue_id,
        venue_external_id: input.venue_external_id,
        data: input.data,
        product_mapping: {
          auto_mapped: input.product_mapping?.auto_mapped ?? false,
          mapping_method: input.product_mapping?.mapping_method ?? 'manual',
          mapping_confidence: input.product_mapping?.mapping_confidence ?? 0,
          original_product_text: input.product_mapping?.original_product_text,
          suggested_products: input.product_mapping?.suggested_products,
        },
        created_at: now,
        updated_at: now,
      };

      batch.set(this.collection.doc(id), this.toFirestore(dish));
      dishes.push(dish);
    }

    await batch.commit();
    return dishes;
  }

  /**
   * Get staged dish by ID
   */
  async getById(id: string): Promise<StagedDish | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Update product mapping
   */
  async updateProductMapping(
    id: string,
    mapping: StagedDish['product_mapping']
  ): Promise<void> {
    await this.collection.doc(id).update({
      product_mapping: mapping,
      'data.planted_products': mapping.auto_mapped
        ? mapping.suggested_products?.slice(0, 1) || []
        : [],
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Update confidence score
   */
  async updateConfidence(
    id: string,
    score: number,
    breakdown?: StagedDish['confidence_breakdown']
  ): Promise<void> {
    const updates: DocumentData = {
      confidence_score: score,
      updated_at: createTimestamp(new Date()),
    };

    if (breakdown) {
      updates.confidence_breakdown = breakdown;
    }

    await this.collection.doc(id).update(updates);
  }

  /**
   * Link to venue (staged or production)
   */
  async linkToVenue(
    id: string,
    venueLink: { staged_venue_id?: string; production_venue_id?: string }
  ): Promise<void> {
    const updates: DocumentData = {
      updated_at: createTimestamp(new Date()),
    };

    if (venueLink.staged_venue_id) {
      updates.staged_venue_id = venueLink.staged_venue_id;
    }
    if (venueLink.production_venue_id) {
      updates.production_venue_id = venueLink.production_venue_id;
    }

    await this.collection.doc(id).update(updates);
  }

  /**
   * Add a flag to the dish
   */
  async addFlag(id: string, flag: string): Promise<void> {
    const dish = await this.getById(id);
    if (!dish) {
      throw new Error(`Staged dish ${id} not found`);
    }

    const flags = [...new Set([...dish.flags, flag])];
    await this.collection.doc(id).update({
      flags,
      status: 'needs_review',
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Approve a staged dish
   */
  async approve(id: string, reviewedBy: string, notes?: string): Promise<void> {
    const now = new Date();
    await this.collection.doc(id).update({
      status: 'approved',
      review: {
        reviewed_by: reviewedBy,
        reviewed_at: createTimestamp(now),
        decision: 'approved',
        notes,
      },
      updated_at: createTimestamp(now),
    });
  }

  /**
   * Reject a staged dish
   */
  async reject(id: string, reviewedBy: string, notes?: string): Promise<void> {
    const now = new Date();
    await this.collection.doc(id).update({
      status: 'rejected',
      review: {
        reviewed_by: reviewedBy,
        reviewed_at: createTimestamp(now),
        decision: 'rejected',
        notes,
      },
      updated_at: createTimestamp(now),
    });
  }

  /**
   * Mark as promoted to production
   */
  async markPromoted(id: string, productionDishId: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'promoted',
      production_dish_id: productionDishId,
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Query staged dishes
   */
  async query(options: StagedDishQueryOptions = {}): Promise<StagedDish[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options.batch_id) {
      query = query.where('batch_id', '==', options.batch_id);
    }

    if (options.partner_id) {
      query = query.where('partner_id', '==', options.partner_id);
    }

    if (options.staged_venue_id) {
      query = query.where('staged_venue_id', '==', options.staged_venue_id);
    }

    if (options.production_venue_id) {
      query = query.where('production_venue_id', '==', options.production_venue_id);
    }

    if (options.status) {
      if (Array.isArray(options.status)) {
        query = query.where('status', 'in', options.status);
      } else {
        query = query.where('status', '==', options.status);
      }
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
   * Get dishes pending review
   */
  async getPendingReview(limit: number = 50): Promise<StagedDish[]> {
    return this.query({
      status: ['pending', 'needs_review'],
      limit,
    });
  }

  /**
   * Get dishes for a batch
   */
  async getByBatch(batchId: string): Promise<StagedDish[]> {
    return this.query({ batch_id: batchId });
  }

  /**
   * Get dishes for a staged venue
   */
  async getByStagedVenue(stagedVenueId: string): Promise<StagedDish[]> {
    return this.query({ staged_venue_id: stagedVenueId });
  }

  /**
   * Count dishes by status for a batch
   */
  async countByStatus(batchId: string): Promise<Record<StagingStatus, number>> {
    const dishes = await this.getByBatch(batchId);
    const counts: Record<StagingStatus, number> = {
      pending: 0,
      validating: 0,
      needs_review: 0,
      approved: 0,
      rejected: 0,
      promoted: 0,
    };

    for (const dish of dishes) {
      counts[dish.status]++;
    }

    return counts;
  }

  /**
   * Delete staged dishes for a batch
   */
  async deleteByBatch(batchId: string): Promise<number> {
    const snapshot = await this.collection.where('batch_id', '==', batchId).get();

    const batch = this.db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }

    await batch.commit();
    return snapshot.size;
  }
}

export const stagedDishes = new StagedDishesCollection();
