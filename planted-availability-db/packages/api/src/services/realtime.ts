/**
 * Real-time Availability Service
 *
 * Provides real-time updates for venue availability, stock levels, and promotions
 * using Firestore real-time listeners.
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Venue, Dish, RetailAvailability, Promotion } from '@pad/core';
import { isVenueOpen, getNextOpeningTime } from '@pad/core';

export interface AvailabilityStatus {
  venue_id: string;
  is_open: boolean;
  next_open: Date | null;
  today_hours: string;
  has_planted_dishes: boolean;
  dish_count: number;
  active_promotions: number;
  last_updated: Date;
}

export interface StockStatus {
  product_sku: string;
  venue_id: string;
  in_stock: boolean;
  price?: number;
  promotion_price?: number;
  last_checked: Date;
}

export interface RealtimeCallback<T> {
  onUpdate: (data: T) => void;
  onError: (error: Error) => void;
}

/**
 * Real-time availability service
 */
export class RealtimeService {
  private db = getFirestore();
  private listeners: Map<string, () => void> = new Map();

  /**
   * Subscribe to venue availability updates
   */
  subscribeToVenueAvailability(
    venueId: string,
    callback: RealtimeCallback<AvailabilityStatus>
  ): string {
    const listenerId = `venue-${venueId}-${Date.now()}`;

    const unsubscribe = this.db
      .collection('venues')
      .doc(venueId)
      .onSnapshot(
        async (snapshot) => {
          if (!snapshot.exists) {
            callback.onError(new Error(`Venue ${venueId} not found`));
            return;
          }

          const venue = { id: snapshot.id, ...snapshot.data() } as Venue;

          // Get dish count
          const dishesSnapshot = await this.db
            .collection('dishes')
            .where('venue_id', '==', venueId)
            .where('status', '==', 'active')
            .count()
            .get();

          // Get active promotions count
          const now = Timestamp.now();
          const promosSnapshot = await this.db
            .collection('promotions')
            .where('venue_id', '==', venueId)
            .where('valid_until', '>=', now)
            .count()
            .get();

          const isOpen = isVenueOpen(venue.opening_hours);
          const nextOpen = isOpen ? null : getNextOpeningTime(venue.opening_hours);

          callback.onUpdate({
            venue_id: venueId,
            is_open: isOpen,
            next_open: nextOpen,
            today_hours: this.formatTodayHours(venue.opening_hours),
            has_planted_dishes: dishesSnapshot.data().count > 0,
            dish_count: dishesSnapshot.data().count,
            active_promotions: promosSnapshot.data().count,
            last_updated: new Date(),
          });
        },
        (error) => {
          callback.onError(error);
        }
      );

    this.listeners.set(listenerId, unsubscribe);
    return listenerId;
  }

  /**
   * Subscribe to stock updates for a product at a venue
   */
  subscribeToStock(
    venueId: string,
    productSku: string,
    callback: RealtimeCallback<StockStatus>
  ): string {
    const listenerId = `stock-${venueId}-${productSku}-${Date.now()}`;

    const unsubscribe = this.db
      .collection('retail_availability')
      .where('venue_id', '==', venueId)
      .where('product_sku', '==', productSku)
      .limit(1)
      .onSnapshot(
        (snapshot) => {
          if (snapshot.empty) {
            callback.onUpdate({
              product_sku: productSku,
              venue_id: venueId,
              in_stock: false,
              last_checked: new Date(),
            });
            return;
          }

          const data = snapshot.docs[0].data() as RetailAvailability;
          callback.onUpdate({
            product_sku: productSku,
            venue_id: venueId,
            in_stock: data.in_stock,
            price: data.price?.regular,
            promotion_price: data.promotion?.price,
            last_checked: data.last_verified.toDate(),
          });
        },
        (error) => {
          callback.onError(error);
        }
      );

    this.listeners.set(listenerId, unsubscribe);
    return listenerId;
  }

  /**
   * Subscribe to all promotions for a chain
   */
  subscribeToChainPromotions(
    chainId: string,
    callback: RealtimeCallback<Promotion[]>
  ): string {
    const listenerId = `promos-chain-${chainId}-${Date.now()}`;
    const now = Timestamp.now();

    const unsubscribe = this.db
      .collection('promotions')
      .where('chain_id', '==', chainId)
      .where('valid_until', '>=', now)
      .orderBy('valid_until', 'asc')
      .onSnapshot(
        (snapshot) => {
          const promotions = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Promotion
          );
          callback.onUpdate(promotions);
        },
        (error) => {
          callback.onError(error);
        }
      );

    this.listeners.set(listenerId, unsubscribe);
    return listenerId;
  }

  /**
   * Subscribe to nearby venues with real-time updates
   */
  subscribeToNearbyVenues(
    lat: number,
    lng: number,
    radiusKm: number,
    callback: RealtimeCallback<Venue[]>
  ): string {
    const listenerId = `nearby-${lat}-${lng}-${radiusKm}-${Date.now()}`;

    // Firestore doesn't support native geo queries with real-time listeners,
    // so we use a bounding box approach
    const { minLat, maxLat, minLng, maxLng } = this.getBoundingBox(lat, lng, radiusKm);

    const unsubscribe = this.db
      .collection('venues')
      .where('status', '==', 'active')
      .where('location.latitude', '>=', minLat)
      .where('location.latitude', '<=', maxLat)
      .onSnapshot(
        (snapshot) => {
          // Filter by longitude and exact distance in memory
          const venues = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }) as Venue)
            .filter((venue) => {
              if (venue.location.longitude < minLng || venue.location.longitude > maxLng) {
                return false;
              }
              const distance = this.haversineDistance(
                lat, lng,
                venue.location.latitude, venue.location.longitude
              );
              return distance <= radiusKm;
            })
            .sort((a, b) => {
              const distA = this.haversineDistance(lat, lng, a.location.latitude, a.location.longitude);
              const distB = this.haversineDistance(lat, lng, b.location.latitude, b.location.longitude);
              return distA - distB;
            });

          callback.onUpdate(venues);
        },
        (error) => {
          callback.onError(error);
        }
      );

    this.listeners.set(listenerId, unsubscribe);
    return listenerId;
  }

  /**
   * Unsubscribe from a listener
   */
  unsubscribe(listenerId: string): boolean {
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(listenerId);
      return true;
    }
    return false;
  }

  /**
   * Unsubscribe from all listeners
   */
  unsubscribeAll(): void {
    for (const unsubscribe of this.listeners.values()) {
      unsubscribe();
    }
    this.listeners.clear();
  }

  /**
   * Get bounding box for geo queries
   */
  private getBoundingBox(
    lat: number,
    lng: number,
    radiusKm: number
  ): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    const latDelta = radiusKm / 111; // ~111km per degree latitude
    const lngDelta = radiusKm / (111 * Math.cos(lat * (Math.PI / 180)));

    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta,
    };
  }

  /**
   * Calculate haversine distance between two points
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Format today's hours as string
   */
  private formatTodayHours(openingHours: any): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    const hours = openingHours?.regular?.[today];

    if (!hours || hours.length === 0) {
      return 'Closed';
    }

    return hours.map((h: any) => `${h.open} - ${h.close}`).join(', ');
  }
}

// Singleton instance
let realtimeService: RealtimeService | null = null;

export function getRealtimeService(): RealtimeService {
  if (!realtimeService) {
    realtimeService = new RealtimeService();
  }
  return realtimeService;
}

/**
 * Check if a specific product is available at nearby stores
 */
export async function checkNearbyAvailability(
  productSku: string,
  lat: number,
  lng: number,
  radiusKm: number = 10
): Promise<Array<{
  venue: Venue;
  in_stock: boolean;
  price?: number;
  distance_km: number;
}>> {
  const db = getFirestore();

  // Get nearby retail venues
  const { minLat, maxLat } = {
    minLat: lat - radiusKm / 111,
    maxLat: lat + radiusKm / 111,
  };

  const venuesSnapshot = await db
    .collection('venues')
    .where('type', '==', 'retail')
    .where('status', '==', 'active')
    .where('location.latitude', '>=', minLat)
    .where('location.latitude', '<=', maxLat)
    .get();

  const results: Array<{
    venue: Venue;
    in_stock: boolean;
    price?: number;
    distance_km: number;
  }> = [];

  for (const doc of venuesSnapshot.docs) {
    const venue = { id: doc.id, ...doc.data() } as Venue;

    // Calculate actual distance
    const distance = haversineDistance(
      lat, lng,
      venue.location.latitude, venue.location.longitude
    );

    if (distance > radiusKm) continue;

    // Check availability
    const availSnapshot = await db
      .collection('retail_availability')
      .where('venue_id', '==', venue.id)
      .where('product_sku', '==', productSku)
      .limit(1)
      .get();

    let inStock = false;
    let price: number | undefined;

    if (!availSnapshot.empty) {
      const avail = availSnapshot.docs[0].data() as RetailAvailability;
      inStock = avail.in_stock;
      price = avail.promotion?.price || avail.price?.regular;
    }

    results.push({
      venue,
      in_stock: inStock,
      price,
      distance_km: Math.round(distance * 10) / 10,
    });
  }

  // Sort by distance
  results.sort((a, b) => a.distance_km - b.distance_km);

  return results;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
