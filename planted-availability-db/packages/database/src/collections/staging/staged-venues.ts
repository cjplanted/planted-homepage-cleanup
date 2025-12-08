/**
 * Staged Venues Collection
 *
 * Partner-submitted venues awaiting review before promotion to production.
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, timestampToDate, createTimestamp, generateId } from '../../firestore.js';
import type { StagedVenue, StagingStatus } from '@pad/core';

export interface CreateStagedVenueInput {
  batch_id: string;
  partner_id: string;
  external_id?: string;
  data: StagedVenue['data'];
  original_coordinates?: { lat: number; lng: number };
}

export interface StagedVenueQueryOptions {
  batch_id?: string;
  partner_id?: string;
  status?: StagingStatus | StagingStatus[];
  limit?: number;
  offset?: number;
}

/**
 * Staged Venues Collection
 */
export class StagedVenuesCollection {
  private collectionName = 'staged_venues';

  private get db() {
    return getFirestore();
  }

  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): StagedVenue {
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
      production_venue_id: data.production_venue_id,
      data: {
        ...data.data,
        // Parse any dates in opening_hours.exceptions if present
      },
      geocoding: {
        status: data.geocoding?.status || 'pending',
        original_coordinates: data.geocoding?.original_coordinates,
        resolved_coordinates: data.geocoding?.resolved_coordinates,
        geocoder_used: data.geocoding?.geocoder_used,
        geocoding_confidence: data.geocoding?.geocoding_confidence,
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

  protected toFirestore(data: Partial<StagedVenue>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;

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
   * Create a new staged venue
   */
  async create(input: CreateStagedVenueInput): Promise<StagedVenue> {
    const id = generateId(this.collectionName);
    const now = new Date();

    const venue: StagedVenue = {
      id,
      batch_id: input.batch_id,
      partner_id: input.partner_id,
      external_id: input.external_id,
      status: 'pending',
      confidence_score: 0,
      flags: [],
      data: input.data,
      geocoding: {
        status: input.original_coordinates ? 'pending' : 'pending',
        original_coordinates: input.original_coordinates,
      },
      created_at: now,
      updated_at: now,
    };

    await this.collection.doc(id).set(this.toFirestore(venue));
    return venue;
  }

  /**
   * Create multiple staged venues in a batch
   */
  async createBatch(inputs: CreateStagedVenueInput[]): Promise<StagedVenue[]> {
    const batch = this.db.batch();
    const now = new Date();
    const venues: StagedVenue[] = [];

    for (const input of inputs) {
      const id = generateId(this.collectionName);
      const venue: StagedVenue = {
        id,
        batch_id: input.batch_id,
        partner_id: input.partner_id,
        external_id: input.external_id,
        status: 'pending',
        confidence_score: 0,
        flags: [],
        data: input.data,
        geocoding: {
          status: 'pending',
          original_coordinates: input.original_coordinates,
        },
        created_at: now,
        updated_at: now,
      };

      batch.set(this.collection.doc(id), this.toFirestore(venue));
      venues.push(venue);
    }

    await batch.commit();
    return venues;
  }

  /**
   * Get staged venue by ID
   */
  async getById(id: string): Promise<StagedVenue | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Get staged venue by external ID (partner's reference)
   */
  async getByExternalId(partnerId: string, externalId: string): Promise<StagedVenue | null> {
    const snapshot = await this.collection
      .where('partner_id', '==', partnerId)
      .where('external_id', '==', externalId)
      .where('status', 'in', ['pending', 'needs_review'])
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return this.fromFirestore(snapshot.docs[0]);
  }

  /**
   * Update geocoding results
   */
  async updateGeocoding(
    id: string,
    results: {
      status: 'success' | 'failed' | 'manual';
      resolved_coordinates?: { lat: number; lng: number };
      geocoder_used?: string;
      geocoding_confidence?: number;
    }
  ): Promise<void> {
    await this.collection.doc(id).update({
      'geocoding.status': results.status,
      'geocoding.resolved_coordinates': results.resolved_coordinates,
      'geocoding.geocoder_used': results.geocoder_used,
      'geocoding.geocoding_confidence': results.geocoding_confidence,
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Update confidence score
   */
  async updateConfidence(
    id: string,
    score: number,
    breakdown?: StagedVenue['confidence_breakdown']
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
   * Add a flag to the venue
   */
  async addFlag(id: string, flag: string): Promise<void> {
    const venue = await this.getById(id);
    if (!venue) {
      throw new Error(`Staged venue ${id} not found`);
    }

    const flags = [...new Set([...venue.flags, flag])];
    await this.collection.doc(id).update({
      flags,
      status: 'needs_review',
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Link to production venue
   */
  async linkToProduction(id: string, productionVenueId: string): Promise<void> {
    await this.collection.doc(id).update({
      production_venue_id: productionVenueId,
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Approve a staged venue
   */
  async approve(
    id: string,
    reviewedBy: string,
    notes?: string,
    productionVenueId?: string
  ): Promise<void> {
    const now = new Date();
    const updates: DocumentData = {
      status: 'approved',
      review: {
        reviewed_by: reviewedBy,
        reviewed_at: createTimestamp(now),
        decision: 'approved',
        notes,
      },
      updated_at: createTimestamp(now),
    };

    if (productionVenueId) {
      updates.production_venue_id = productionVenueId;
    }

    await this.collection.doc(id).update(updates);
  }

  /**
   * Reject a staged venue
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
  async markPromoted(id: string, productionVenueId: string): Promise<void> {
    await this.collection.doc(id).update({
      status: 'promoted',
      production_venue_id: productionVenueId,
      updated_at: createTimestamp(new Date()),
    });
  }

  /**
   * Query staged venues
   */
  async query(options: StagedVenueQueryOptions = {}): Promise<StagedVenue[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options.batch_id) {
      query = query.where('batch_id', '==', options.batch_id);
    }

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
   * Get venues pending review
   */
  async getPendingReview(limit: number = 50): Promise<StagedVenue[]> {
    return this.query({
      status: ['pending', 'needs_review'],
      limit,
    });
  }

  /**
   * Get venues for a batch
   */
  async getByBatch(batchId: string): Promise<StagedVenue[]> {
    return this.query({ batch_id: batchId });
  }

  /**
   * Count venues by status for a batch
   */
  async countByStatus(batchId: string): Promise<Record<StagingStatus, number>> {
    const venues = await this.getByBatch(batchId);
    const counts: Record<StagingStatus, number> = {
      pending: 0,
      validating: 0,
      needs_review: 0,
      approved: 0,
      rejected: 0,
      promoted: 0,
    };

    for (const venue of venues) {
      counts[venue.status]++;
    }

    return counts;
  }

  /**
   * Delete staged venues for a batch (cleanup after processing)
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

export const stagedVenues = new StagedVenuesCollection();
