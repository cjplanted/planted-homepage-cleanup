/**
 * Ingestion Batches Collection
 *
 * Tracks each batch of data submitted by partners through any channel.
 * Provides visibility into the ingestion pipeline status.
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, timestampToDate, createTimestamp, generateId } from '../firestore.js';
import type { IngestionBatch, BatchStatus, ValidationError } from '@pad/core';

export interface CreateBatchInput {
  partner_id: string;
  source: IngestionBatch['source'];
  records_received: number;
}

export interface BatchQueryOptions {
  partner_id?: string;
  status?: BatchStatus | BatchStatus[];
  channel?: IngestionBatch['source']['channel'];
  since?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Ingestion Batches Collection
 */
export class IngestionBatchesCollection {
  private collectionName = 'ingestion_batches';

  private get db() {
    return getFirestore();
  }

  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): IngestionBatch {
    const data = doc.data();
    return {
      id: doc.id,
      partner_id: data.partner_id,
      source: data.source,
      status: data.status,
      stats: data.stats || {
        records_received: 0,
        records_valid: 0,
        records_invalid: 0,
        records_staged: 0,
        records_approved: 0,
        records_rejected: 0,
      },
      processing: {
        started_at: data.processing?.started_at
          ? timestampToDate(data.processing.started_at)
          : undefined,
        completed_at: data.processing?.completed_at
          ? timestampToDate(data.processing.completed_at)
          : undefined,
        transformer_version: data.processing?.transformer_version,
        validation_errors: data.processing?.validation_errors,
        transform_warnings: data.processing?.transform_warnings,
      },
      review: data.review
        ? {
            required: data.review.required,
            reviewed_by: data.review.reviewed_by,
            reviewed_at: data.review.reviewed_at
              ? timestampToDate(data.review.reviewed_at)
              : undefined,
            review_notes: data.review.review_notes,
            decision: data.review.decision,
          }
        : undefined,
      received_at: timestampToDate(data.received_at),
      created_at: timestampToDate(data.created_at),
      updated_at: timestampToDate(data.updated_at),
    };
  }

  protected toFirestore(data: Partial<IngestionBatch>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;

    // Convert dates
    if (data.processing?.started_at) {
      result.processing = {
        ...result.processing,
        started_at: createTimestamp(data.processing.started_at),
      };
    }
    if (data.processing?.completed_at) {
      result.processing = {
        ...result.processing,
        completed_at: createTimestamp(data.processing.completed_at),
      };
    }
    if (data.review?.reviewed_at) {
      result.review = {
        ...result.review,
        reviewed_at: createTimestamp(data.review.reviewed_at),
      };
    }
    if (data.received_at) {
      result.received_at = createTimestamp(data.received_at);
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
   * Create a new ingestion batch
   */
  async create(input: CreateBatchInput): Promise<IngestionBatch> {
    const id = generateId(this.collectionName);
    const now = new Date();

    const batch: IngestionBatch = {
      id,
      partner_id: input.partner_id,
      source: input.source,
      status: 'received',
      stats: {
        records_received: input.records_received,
        records_valid: 0,
        records_invalid: 0,
        records_staged: 0,
        records_approved: 0,
        records_rejected: 0,
      },
      processing: {},
      received_at: now,
      created_at: now,
      updated_at: now,
    };

    await this.collection.doc(id).set(this.toFirestore(batch));
    return batch;
  }

  /**
   * Get batch by ID
   */
  async getById(id: string): Promise<IngestionBatch | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Get batch by idempotency key (to prevent duplicate processing)
   */
  async getByIdempotencyKey(
    partnerId: string,
    idempotencyKey: string
  ): Promise<IngestionBatch | null> {
    const snapshot = await this.collection
      .where('partner_id', '==', partnerId)
      .where('source.idempotency_key', '==', idempotencyKey)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return this.fromFirestore(snapshot.docs[0]);
  }

  /**
   * Update batch status
   */
  async updateStatus(id: string, status: BatchStatus): Promise<void> {
    await this.collection.doc(id).update({
      status,
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Start processing a batch
   */
  async startProcessing(id: string, transformerVersion?: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'validating',
      'processing.started_at': createTimestamp(new Date()),
      'processing.transformer_version': transformerVersion,
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Record validation results
   */
  async recordValidation(
    id: string,
    results: {
      valid: number;
      invalid: number;
      errors: ValidationError[];
    }
  ): Promise<void> {
    await this.collection.doc(id).update({
      status: 'transforming',
      'stats.records_valid': results.valid,
      'stats.records_invalid': results.invalid,
      'processing.validation_errors': results.errors,
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Record staging results
   */
  async recordStaging(
    id: string,
    results: {
      staged: number;
      warnings?: string[];
    }
  ): Promise<void> {
    await this.collection.doc(id).update({
      status: 'scoring',
      'stats.records_staged': results.staged,
      'processing.transform_warnings': results.warnings || [],
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Complete batch processing
   */
  async completeProcessing(
    id: string,
    result: {
      status: BatchStatus;
      requiresReview: boolean;
    }
  ): Promise<void> {
    const now = new Date();
    await this.collection.doc(id).update({
      status: result.status,
      'processing.completed_at': createTimestamp(now),
      review: {
        required: result.requiresReview,
      },
      updated_at: createTimestamp(now),
    });
  }

  /**
   * Record review decision
   */
  async recordReview(
    id: string,
    decision: {
      reviewed_by: string;
      decision: 'approved' | 'rejected' | 'partial';
      notes?: string;
      approved_count?: number;
      rejected_count?: number;
    }
  ): Promise<void> {
    const now = new Date();
    const status: BatchStatus =
      decision.decision === 'approved'
        ? 'approved'
        : decision.decision === 'partial'
          ? 'partially_approved'
          : 'rejected';

    const updates: DocumentData = {
      status,
      'review.reviewed_by': decision.reviewed_by,
      'review.reviewed_at': createTimestamp(now),
      'review.decision': decision.decision,
      'review.review_notes': decision.notes,
      updated_at: createTimestamp(now),
    };

    if (decision.approved_count !== undefined) {
      updates['stats.records_approved'] = decision.approved_count;
    }
    if (decision.rejected_count !== undefined) {
      updates['stats.records_rejected'] = decision.rejected_count;
    }

    await this.collection.doc(id).update(updates);
  }

  /**
   * Mark batch as failed
   */
  async markFailed(id: string, error: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'failed',
      'processing.completed_at': createTimestamp(new Date()),
      'processing.transform_warnings': [error],
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Query batches with filters
   */
  async query(options: BatchQueryOptions = {}): Promise<IngestionBatch[]> {
    let query = this.collection.orderBy('received_at', 'desc');

    if (options.partner_id) {
      query = query.where('partner_id', '==', options.partner_id);
    }

    if (options.status) {
      if (Array.isArray(options.status)) {
        query = query.where('status', 'in', options.status);
      } else {
        query = query.where('status', '==', options.status);
      }
    }

    if (options.channel) {
      query = query.where('source.channel', '==', options.channel);
    }

    if (options.since) {
      query = query.where('received_at', '>=', createTimestamp(options.since));
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
   * Get pending batches needing review
   */
  async getPendingReview(limit: number = 50): Promise<IngestionBatch[]> {
    return this.query({
      status: 'pending_review',
      limit,
    });
  }

  /**
   * Get recent batches for a partner
   */
  async getRecentForPartner(partnerId: string, limit: number = 20): Promise<IngestionBatch[]> {
    return this.query({
      partner_id: partnerId,
      limit,
    });
  }

  /**
   * Get batch statistics for dashboard
   */
  async getStats(since?: Date): Promise<{
    total: number;
    byStatus: Record<BatchStatus, number>;
    byChannel: Record<string, number>;
    avgProcessingTime: number;
  }> {
    let query = this.collection.orderBy('received_at', 'desc');

    if (since) {
      query = query.where('received_at', '>=', createTimestamp(since));
    }

    const snapshot = await query.get();
    const batches = snapshot.docs.map((doc) => this.fromFirestore(doc));

    const byStatus: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    let totalProcessingTime = 0;
    let processedCount = 0;

    for (const batch of batches) {
      // Count by status
      byStatus[batch.status] = (byStatus[batch.status] || 0) + 1;

      // Count by channel
      byChannel[batch.source.channel] = (byChannel[batch.source.channel] || 0) + 1;

      // Calculate processing time
      if (batch.processing.started_at && batch.processing.completed_at) {
        const processingTime =
          batch.processing.completed_at.getTime() - batch.processing.started_at.getTime();
        totalProcessingTime += processingTime;
        processedCount++;
      }
    }

    return {
      total: batches.length,
      byStatus: byStatus as Record<BatchStatus, number>,
      byChannel,
      avgProcessingTime: processedCount > 0 ? Math.round(totalProcessingTime / processedCount) : 0,
    };
  }
}

export const ingestionBatches = new IngestionBatchesCollection();
