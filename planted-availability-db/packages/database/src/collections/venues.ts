import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { BaseCollection, type QueryOptions } from './base.js';
import { createFirestoreGeoPoint, timestampToDate, createTimestamp } from '../firestore.js';
import type { Venue, VenueType, VenueStatus, GeoPoint } from '@pad/core';

export interface VenueQueryOptions extends QueryOptions {
  type?: VenueType;
  status?: VenueStatus;
  chainId?: string;
  country?: string;
}

export interface NearbyQueryOptions {
  center: GeoPoint;
  radiusKm: number;
  type?: VenueType;
  status?: VenueStatus;
  limit?: number;
}

export class VenuesCollection extends BaseCollection<Venue> {
  protected collectionName = 'venues';

  protected fromFirestore(doc: QueryDocumentSnapshot): Venue {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type,
      name: data.name,
      chain_id: data.chain_id,
      location: {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      },
      address: data.address,
      opening_hours: data.opening_hours,
      delivery_zones: data.delivery_zones,
      contact: data.contact,
      source: data.source,
      last_verified: timestampToDate(data.last_verified),
      status: data.status,
      created_at: timestampToDate(data.created_at),
      updated_at: timestampToDate(data.updated_at),
    };
  }

  protected toFirestore(data: Partial<Venue>): DocumentData {
    const result: DocumentData = { ...data };

    // Convert GeoPoint to Firestore GeoPoint
    if (data.location) {
      result.location = createFirestoreGeoPoint(
        data.location.latitude,
        data.location.longitude
      );
    }

    // Convert dates to Firestore Timestamps
    if (data.last_verified) {
      result.last_verified = createTimestamp(data.last_verified);
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
   * Query venues with filters
   */
  async query(options: VenueQueryOptions = {}): Promise<Venue[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options.type) {
      query = query.where('type', '==', options.type);
    }

    if (options.status) {
      query = query.where('status', '==', options.status);
    }

    if (options.chainId) {
      query = query.where('chain_id', '==', options.chainId);
    }

    if (options.country) {
      query = query.where('address.country', '==', options.country);
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
   * Query venues near a location
   * Note: Firestore doesn't support native geo-queries with radius.
   * This queries all active venues and filters by distance in memory.
   * For large datasets, consider using Geohash-based queries.
   */
  async queryNearby(options: NearbyQueryOptions): Promise<(Venue & { distance_km: number })[]> {
    // Query all active venues (or filtered by status)
    // For large datasets, this should be optimized with Geohash
    let query = this.collection.where('status', '==', options.status || 'active');

    if (options.type) {
      query = query.where('type', '==', options.type);
    }

    // Limit to a reasonable number to prevent excessive reads
    const snapshot = await query.limit(500).get();
    const venues = snapshot.docs.map((doc) => this.fromFirestore(doc));

    // Calculate bounding box for quick pre-filtering
    const latDelta = options.radiusKm / 111.32;
    const lngDelta = options.radiusKm / (111.32 * Math.cos((options.center.latitude * Math.PI) / 180));
    const minLat = options.center.latitude - latDelta;
    const maxLat = options.center.latitude + latDelta;
    const minLng = options.center.longitude - lngDelta;
    const maxLng = options.center.longitude + lngDelta;

    // Filter by bounding box first, then calculate actual distance
    const withDistance = venues
      .filter((venue) => {
        const lat = venue.location.latitude;
        const lng = venue.location.longitude;
        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
      })
      .map((venue) => ({
        ...venue,
        distance_km: this.calculateDistance(options.center, venue.location),
      }))
      .filter((venue) => venue.distance_km <= options.radiusKm);

    // Sort by distance and limit
    return withDistance
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, options.limit || 20);
  }

  /**
   * Get venues by chain
   */
  async getByChain(chainId: string): Promise<Venue[]> {
    const snapshot = await this.collection
      .where('chain_id', '==', chainId)
      .where('status', '==', 'active')
      .get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get stale venues that need re-verification
   */
  async getStaleVenues(daysSinceVerification: number = 7, limit: number = 100): Promise<Venue[]> {
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
   * Mark venue as verified
   */
  async markVerified(id: string): Promise<Venue> {
    return this.update(id, {
      last_verified: new Date(),
      status: 'active',
    } as Partial<Venue>);
  }

  /**
   * Archive a venue
   */
  async archive(id: string): Promise<Venue> {
    return this.update(id, { status: 'archived' } as Partial<Venue>);
  }

  /**
   * Mark venue as stale (hasn't been verified recently)
   */
  async markStale(id: string): Promise<Venue> {
    return this.update(id, { status: 'stale' } as Partial<Venue>);
  }

  /**
   * Mark multiple venues as stale in batch
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
   * Archive multiple venues in batch
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
   * Get venues for archival (very stale - not verified in X days)
   */
  async getVenuesForArchival(daysSinceVerification: number = 30, limit: number = 100): Promise<Venue[]> {
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

    // Calculate average days since verification for active venues
    const activeVenues = await this.query({ status: 'active', limit: 100 });
    const now = Date.now();
    const avgDays = activeVenues.length > 0
      ? activeVenues.reduce((sum, v) => sum + (now - v.last_verified.getTime()) / (1000 * 60 * 60 * 24), 0) / activeVenues.length
      : 0;

    return {
      total,
      active,
      stale,
      archived,
      avgDaysSinceVerification: Math.round(avgDays * 10) / 10,
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);
    const lat1 = this.toRad(point1.latitude);
    const lat2 = this.toRad(point2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c * 100) / 100; // Round to 2 decimal places
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const venues = new VenuesCollection();
