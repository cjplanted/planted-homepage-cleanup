/**
 * Staged Availability Collection
 *
 * Partner-submitted retail availability data awaiting review.
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, timestampToDate, createTimestamp, generateId } from '../../firestore.js';
import type { StagedAvailability, StagingStatus } from '@pad/core';

export interface CreateStagedAvailabilityInput {
  batch_id: string;
  partner_id: string;
  external_id?: string;
  staged_venue_id?: string;
  production_venue_id?: string;
  data: StagedAvailability['data'];
}

export interface StagedAvailabilityQueryOptions {
  batch_id?: string;
  partner_id?: string;
  production_venue_id?: string;
  product_sku?: string;
  status?: StagingStatus | StagingStatus[];
  limit?: number;
  offset?: number;
}

/**
 * Staged Availability Collection
 */
export class StagedAvailabilityCollection {
  private collectionName = 'staged_availability';

  private get db() {
    return getFirestore();
  }

  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): StagedAvailability {
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
      data: {
        ...data.data,
        verified_at: data.data.verified_at ? timestampToDate(data.data.verified_at) : undefined,
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

  protected toFirestore(data: Partial<StagedAvailability>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;

    if (data.data?.verified_at) {
      result.data = {
        ...result.data,
        verified_at: createTimestamp(data.data.verified_at),
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
   * Create a new staged availability record
   */
  async create(input: CreateStagedAvailabilityInput): Promise<StagedAvailability> {
    const id = generateId(this.collectionName);
    const now = new Date();

    const availability: StagedAvailability = {
      id,
      batch_id: input.batch_id,
      partner_id: input.partner_id,
      external_id: input.external_id,
      status: 'pending',
      confidence_score: 0,
      flags: [],
      staged_venue_id: input.staged_venue_id,
      production_venue_id: input.production_venue_id,
      data: input.data,
      created_at: now,
      updated_at: now,
    };

    await this.collection.doc(id).set(this.toFirestore(availability));
    return availability;
  }

  /**
   * Create multiple staged availability records in a batch
   */
  async createBatch(inputs: CreateStagedAvailabilityInput[]): Promise<StagedAvailability[]> {
    const batch = this.db.batch();
    const now = new Date();
    const records: StagedAvailability[] = [];

    for (const input of inputs) {
      const id = generateId(this.collectionName);
      const availability: StagedAvailability = {
        id,
        batch_id: input.batch_id,
        partner_id: input.partner_id,
        external_id: input.external_id,
        status: 'pending',
        confidence_score: 0,
        flags: [],
        staged_venue_id: input.staged_venue_id,
        production_venue_id: input.production_venue_id,
        data: input.data,
        created_at: now,
        updated_at: now,
      };

      batch.set(this.collection.doc(id), this.toFirestore(availability));
      records.push(availability);
    }

    await batch.commit();
    return records;
  }

  /**
   * Get staged availability by ID
   */
  async getById(id: string): Promise<StagedAvailability | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Find existing availability record for a venue/product combination
   */
  async findByVenueAndProduct(
    productionVenueId: string,
    productSku: string
  ): Promise<StagedAvailability | null> {
    const snapshot = await this.collection
      .where('production_venue_id', '==', productionVenueId)
      .where('data.product_sku', '==', productSku)
      .where('status', 'in', ['pending', 'needs_review'])
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return this.fromFirestore(snapshot.docs[0]);
  }

  /**
   * Update confidence score
   */
  async updateConfidence(
    id: string,
    score: number,
    breakdown?: StagedAvailability['confidence_breakdown']
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
   * Add a flag
   */
  async addFlag(id: string, flag: string): Promise<void> {
    const record = await this.getById(id);
    if (!record) {
      throw new Error(`Staged availability ${id} not found`);
    }

    const flags = [...new Set([...record.flags, flag])];
    await this.collection.doc(id).update({
      flags,
      status: 'needs_review',
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Approve
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
   * Reject
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
  async markPromoted(id: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'promoted',
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Query staged availability
   */
  async query(options: StagedAvailabilityQueryOptions = {}): Promise<StagedAvailability[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options.batch_id) {
      query = query.where('batch_id', '==', options.batch_id);
    }

    if (options.partner_id) {
      query = query.where('partner_id', '==', options.partner_id);
    }

    if (options.production_venue_id) {
      query = query.where('production_venue_id', '==', options.production_venue_id);
    }

    if (options.product_sku) {
      query = query.where('data.product_sku', '==', options.product_sku);
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
   * Get records pending review
   */
  async getPendingReview(limit: number = 50): Promise<StagedAvailability[]> {
    return this.query({
      status: ['pending', 'needs_review'],
      limit,
    });
  }

  /**
   * Get records for a batch
   */
  async getByBatch(batchId: string): Promise<StagedAvailability[]> {
    return this.query({ batch_id: batchId });
  }

  /**
   * Count by status for a batch
   */
  async countByStatus(batchId: string): Promise<Record<StagingStatus, number>> {
    const records = await this.getByBatch(batchId);
    const counts: Record<StagingStatus, number> = {
      pending: 0,
      validating: 0,
      needs_review: 0,
      approved: 0,
      rejected: 0,
      promoted: 0,
    };

    for (const record of records) {
      counts[record.status]++;
    }

    return counts;
  }

  /**
   * Delete staged records for a batch
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

export const stagedAvailability = new StagedAvailabilityCollection();
