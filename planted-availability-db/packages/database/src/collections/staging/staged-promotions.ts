/**
 * Staged Promotions Collection
 *
 * Partner-submitted promotions awaiting review before promotion to production.
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, timestampToDate, createTimestamp, generateId } from '../../firestore.js';
import type { StagedPromotion, StagingStatus } from '@pad/core';

export interface CreateStagedPromotionInput {
  batch_id: string;
  partner_id: string;
  external_id?: string;
  staged_venue_id?: string;
  production_venue_id?: string;
  chain_id?: string;
  data: StagedPromotion['data'];
}

export interface StagedPromotionQueryOptions {
  batch_id?: string;
  partner_id?: string;
  chain_id?: string;
  status?: StagingStatus | StagingStatus[];
  limit?: number;
  offset?: number;
}

/**
 * Staged Promotions Collection
 */
export class StagedPromotionsCollection {
  private collectionName = 'staged_promotions';

  private get db() {
    return getFirestore();
  }

  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): StagedPromotion {
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
      chain_id: data.chain_id,
      data: {
        ...data.data,
        valid_from: timestampToDate(data.data.valid_from),
        valid_until: timestampToDate(data.data.valid_until),
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

  protected toFirestore(data: Partial<StagedPromotion>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;

    // Convert dates in promotion data
    if (data.data?.valid_from) {
      result.data = {
        ...result.data,
        valid_from: createTimestamp(data.data.valid_from),
      };
    }
    if (data.data?.valid_until) {
      result.data = {
        ...result.data,
        valid_until: createTimestamp(data.data.valid_until),
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
   * Create a new staged promotion
   */
  async create(input: CreateStagedPromotionInput): Promise<StagedPromotion> {
    const id = generateId(this.collectionName);
    const now = new Date();

    const promotion: StagedPromotion = {
      id,
      batch_id: input.batch_id,
      partner_id: input.partner_id,
      external_id: input.external_id,
      status: 'pending',
      confidence_score: 0,
      flags: [],
      staged_venue_id: input.staged_venue_id,
      production_venue_id: input.production_venue_id,
      chain_id: input.chain_id,
      data: input.data,
      created_at: now,
      updated_at: now,
    };

    await this.collection.doc(id).set(this.toFirestore(promotion));
    return promotion;
  }

  /**
   * Create multiple staged promotions in a batch
   */
  async createBatch(inputs: CreateStagedPromotionInput[]): Promise<StagedPromotion[]> {
    const batch = this.db.batch();
    const now = new Date();
    const promotions: StagedPromotion[] = [];

    for (const input of inputs) {
      const id = generateId(this.collectionName);
      const promotion: StagedPromotion = {
        id,
        batch_id: input.batch_id,
        partner_id: input.partner_id,
        external_id: input.external_id,
        status: 'pending',
        confidence_score: 0,
        flags: [],
        staged_venue_id: input.staged_venue_id,
        production_venue_id: input.production_venue_id,
        chain_id: input.chain_id,
        data: input.data,
        created_at: now,
        updated_at: now,
      };

      batch.set(this.collection.doc(id), this.toFirestore(promotion));
      promotions.push(promotion);
    }

    await batch.commit();
    return promotions;
  }

  /**
   * Get staged promotion by ID
   */
  async getById(id: string): Promise<StagedPromotion | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Update confidence score
   */
  async updateConfidence(
    id: string,
    score: number,
    breakdown?: StagedPromotion['confidence_breakdown']
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
   * Add a flag to the promotion
   */
  async addFlag(id: string, flag: string): Promise<void> {
    const promotion = await this.getById(id);
    if (!promotion) {
      throw new Error(`Staged promotion ${id} not found`);
    }

    const flags = [...new Set([...promotion.flags, flag])];
    await this.collection.doc(id).update({
      flags,
      status: 'needs_review',
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Approve a staged promotion
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
   * Reject a staged promotion
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
  async markPromoted(id: string, productionPromotionId: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'promoted',
      production_promotion_id: productionPromotionId,
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Query staged promotions
   */
  async query(options: StagedPromotionQueryOptions = {}): Promise<StagedPromotion[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options.batch_id) {
      query = query.where('batch_id', '==', options.batch_id);
    }

    if (options.partner_id) {
      query = query.where('partner_id', '==', options.partner_id);
    }

    if (options.chain_id) {
      query = query.where('chain_id', '==', options.chain_id);
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
   * Get promotions pending review
   */
  async getPendingReview(limit: number = 50): Promise<StagedPromotion[]> {
    return this.query({
      status: ['pending', 'needs_review'],
      limit,
    });
  }

  /**
   * Get promotions for a batch
   */
  async getByBatch(batchId: string): Promise<StagedPromotion[]> {
    return this.query({ batch_id: batchId });
  }

  /**
   * Count promotions by status for a batch
   */
  async countByStatus(batchId: string): Promise<Record<StagingStatus, number>> {
    const promotions = await this.getByBatch(batchId);
    const counts: Record<StagingStatus, number> = {
      pending: 0,
      validating: 0,
      needs_review: 0,
      approved: 0,
      rejected: 0,
      promoted: 0,
    };

    for (const promotion of promotions) {
      counts[promotion.status]++;
    }

    return counts;
  }

  /**
   * Delete staged promotions for a batch
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

export const stagedPromotions = new StagedPromotionsCollection();
