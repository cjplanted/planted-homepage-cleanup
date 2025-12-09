import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection } from './base.js';
import type {
  DiscoveredVenue,
  DiscoveredVenueStatus,
  DiscoveredVenueAddress,
  DiscoveredVenueCoordinates,
  DiscoveredDeliveryLink,
  DiscoveredDish,
  ConfidenceFactor,
  CreateDiscoveredVenueInput,
  DeliveryPlatform,
  SupportedCountry,
} from '@pad/core';

interface DiscoveredVenueDoc extends Omit<DiscoveredVenue, 'created_at' | 'verified_at' | 'promoted_at'> {
  created_at: Date;
  updated_at: Date;
  verified_at?: Date;
  promoted_at?: Date;
}

/**
 * Collection for venues discovered by the smart agent
 */
class DiscoveredVenuesCollection extends BaseCollection<DiscoveredVenueDoc> {
  protected collectionName = 'discovered_venues';

  protected fromFirestore(doc: QueryDocumentSnapshot): DiscoveredVenueDoc {
    const data = doc.data();
    return {
      id: doc.id,
      discovery_run_id: data.discovery_run_id,
      name: data.name,
      chain_id: data.chain_id,
      chain_name: data.chain_name,
      is_chain: data.is_chain || false,
      chain_confidence: data.chain_confidence,
      address: data.address,
      coordinates: data.coordinates,
      delivery_platforms: data.delivery_platforms || [],
      planted_products: data.planted_products || [],
      dishes: data.dishes || [],
      confidence_score: data.confidence_score || 0,
      confidence_factors: data.confidence_factors || [],
      status: data.status || 'discovered',
      rejection_reason: data.rejection_reason,
      production_venue_id: data.production_venue_id,
      discovered_by_strategy_id: data.discovered_by_strategy_id,
      discovered_by_query: data.discovered_by_query,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      verified_at: data.verified_at ? (data.verified_at as Timestamp).toDate() : undefined,
      promoted_at: data.promoted_at ? (data.promoted_at as Timestamp).toDate() : undefined,
    };
  }

  protected toFirestore(data: Partial<DiscoveredVenueDoc>): DocumentData {
    const doc: DocumentData = {};

    if (data.discovery_run_id !== undefined) doc.discovery_run_id = data.discovery_run_id;
    if (data.name !== undefined) doc.name = data.name;
    if (data.chain_id !== undefined) doc.chain_id = data.chain_id;
    if (data.chain_name !== undefined) doc.chain_name = data.chain_name;
    if (data.is_chain !== undefined) doc.is_chain = data.is_chain;
    if (data.chain_confidence !== undefined) doc.chain_confidence = data.chain_confidence;
    if (data.address !== undefined) doc.address = data.address;
    if (data.coordinates !== undefined) doc.coordinates = data.coordinates;
    if (data.delivery_platforms !== undefined) doc.delivery_platforms = data.delivery_platforms;
    if (data.planted_products !== undefined) doc.planted_products = data.planted_products;
    if (data.dishes !== undefined) doc.dishes = data.dishes;
    if (data.confidence_score !== undefined) doc.confidence_score = data.confidence_score;
    if (data.confidence_factors !== undefined) doc.confidence_factors = data.confidence_factors;
    if (data.status !== undefined) doc.status = data.status;
    if (data.rejection_reason !== undefined) doc.rejection_reason = data.rejection_reason;
    if (data.production_venue_id !== undefined) doc.production_venue_id = data.production_venue_id;
    if (data.discovered_by_strategy_id !== undefined) doc.discovered_by_strategy_id = data.discovered_by_strategy_id;
    if (data.discovered_by_query !== undefined) doc.discovered_by_query = data.discovered_by_query;
    if (data.verified_at !== undefined) doc.verified_at = data.verified_at;
    if (data.promoted_at !== undefined) doc.promoted_at = data.promoted_at;

    return doc;
  }

  /**
   * Create a discovered venue
   */
  async createVenue(input: CreateDiscoveredVenueInput): Promise<DiscoveredVenueDoc> {
    return this.create({
      ...input,
      status: 'discovered',
    });
  }

  /**
   * Check if a venue already exists (by name and city)
   */
  async findExisting(name: string, city: string): Promise<DiscoveredVenueDoc | null> {
    const snapshot = await this.collection
      .where('name', '==', name)
      .where('address.city', '==', city)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return this.fromFirestore(snapshot.docs[0]);
  }

  /**
   * Check if venue exists by delivery URL
   */
  async findByDeliveryUrl(url: string): Promise<DiscoveredVenueDoc | null> {
    // This requires a more complex query - we'll search in-memory
    const all = await this.getAll();
    return all.find((v) =>
      v.delivery_platforms.some((p) => p.url === url)
    ) || null;
  }

  /**
   * Get venues by status
   */
  async getByStatus(status: DiscoveredVenueStatus): Promise<DiscoveredVenueDoc[]> {
    const snapshot = await this.collection
      .where('status', '==', status)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get venues pending review (discovered but not verified)
   */
  async getPendingReview(limit: number = 50): Promise<DiscoveredVenueDoc[]> {
    const snapshot = await this.collection
      .where('status', '==', 'discovered')
      .orderBy('confidence_score', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Verify a venue
   */
  async verifyVenue(venueId: string): Promise<DiscoveredVenueDoc> {
    return this.update(venueId, {
      status: 'verified',
      verified_at: new Date(),
    });
  }

  /**
   * Reject a venue as false positive
   */
  async rejectVenue(venueId: string, reason: string): Promise<DiscoveredVenueDoc> {
    return this.update(venueId, {
      status: 'rejected',
      rejection_reason: reason,
    });
  }

  /**
   * Mark a venue as promoted to production
   */
  async markPromoted(venueId: string, productionVenueId: string): Promise<DiscoveredVenueDoc> {
    return this.update(venueId, {
      status: 'promoted',
      production_venue_id: productionVenueId,
      promoted_at: new Date(),
    });
  }

  /**
   * Get venues by country
   */
  async getByCountry(country: SupportedCountry): Promise<DiscoveredVenueDoc[]> {
    const snapshot = await this.collection
      .where('address.country', '==', country)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get venues by delivery platform
   */
  async getByPlatform(platform: DeliveryPlatform): Promise<DiscoveredVenueDoc[]> {
    // Firestore doesn't support array-contains on nested objects
    // So we need to filter in memory
    const all = await this.getAll();
    return all.filter((v) =>
      v.delivery_platforms.some((p) => p.platform === platform)
    );
  }

  /**
   * Get venues from a specific discovery run
   */
  async getByRun(runId: string): Promise<DiscoveredVenueDoc[]> {
    const snapshot = await this.collection
      .where('discovery_run_id', '==', runId)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get chain locations
   */
  async getChainLocations(chainId: string): Promise<DiscoveredVenueDoc[]> {
    const snapshot = await this.collection
      .where('chain_id', '==', chainId)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Update confidence score and factors
   */
  async updateConfidence(
    venueId: string,
    score: number,
    factors: ConfidenceFactor[]
  ): Promise<DiscoveredVenueDoc> {
    return this.update(venueId, {
      confidence_score: score,
      confidence_factors: factors,
    });
  }

  /**
   * Add a delivery platform link
   */
  async addDeliveryPlatform(
    venueId: string,
    platform: DiscoveredDeliveryLink
  ): Promise<DiscoveredVenueDoc> {
    const venue = await this.getById(venueId);
    if (!venue) {
      throw new Error(`Venue ${venueId} not found`);
    }

    // Check if platform already exists
    const existing = venue.delivery_platforms.find(
      (p) => p.platform === platform.platform
    );

    if (existing) {
      // Update existing
      const updated = venue.delivery_platforms.map((p) =>
        p.platform === platform.platform ? platform : p
      );
      return this.update(venueId, { delivery_platforms: updated });
    } else {
      // Add new
      return this.update(venueId, {
        delivery_platforms: [...venue.delivery_platforms, platform],
      });
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    by_status: Record<DiscoveredVenueStatus, number>;
    by_country: Record<string, number>;
    by_platform: Record<string, number>;
    average_confidence: number;
  }> {
    const all = await this.getAll();

    const byStatus: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    let totalConfidence = 0;

    for (const venue of all) {
      // By status
      byStatus[venue.status] = (byStatus[venue.status] || 0) + 1;

      // By country
      byCountry[venue.address.country] = (byCountry[venue.address.country] || 0) + 1;

      // By platform
      for (const p of venue.delivery_platforms) {
        byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1;
      }

      totalConfidence += venue.confidence_score;
    }

    return {
      total: all.length,
      by_status: byStatus as Record<DiscoveredVenueStatus, number>,
      by_country: byCountry,
      by_platform: byPlatform,
      average_confidence: all.length > 0 ? Math.round(totalConfidence / all.length) : 0,
    };
  }
}

// Singleton instance
export const discoveredVenues = new DiscoveredVenuesCollection();
