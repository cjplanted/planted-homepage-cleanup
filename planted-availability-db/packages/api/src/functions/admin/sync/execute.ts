/**
 * Admin Sync Execute API
 * POST /admin/sync/execute
 *
 * Promotes verified discovered entities to production:
 * - Creates production venue/dish records
 * - Updates discovered entity status to 'promoted'
 * - Uses batch writes for atomicity
 * - Records sync in history
 */

import { z } from 'zod';
import {
  initializeFirestore,
  getFirestore,
  discoveredVenues,
  discoveredDishes,
  syncHistory,
  changeLogs,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';
import type { SyncErrorRecord } from '@pad/database';

// Initialize Firestore
initializeFirestore();

// Validation schema for execute request body
const executeBodySchema = z.object({
  venueIds: z.array(z.string()).optional(),
  dishIds: z.array(z.string()).optional(),
  syncAll: z.boolean().optional().default(false),
});

/**
 * Handler for POST /admin/sync/execute
 */
export const adminSyncExecuteHandler = createAdminHandler(
  async (req, res) => {
    // Validate request body
    const validation = executeBodySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { venueIds, dishIds, syncAll } = validation.data;

    // Get entities to sync
    let venuesToSync = [];
    let dishesToSync = [];

    if (syncAll) {
      // Get all verified entities not yet promoted
      const allVerifiedVenues = await discoveredVenues.getByStatus('verified');
      venuesToSync = allVerifiedVenues.filter(v => !v.production_venue_id && !v.promoted_at);

      const allVerifiedDishes = await discoveredDishes.getByStatus('verified');
      dishesToSync = allVerifiedDishes.filter(d => !d.production_dish_id && !d.promoted_at);
    } else {
      // Get specific entities
      if (venueIds && venueIds.length > 0) {
        const venuePromises = venueIds.map(id => discoveredVenues.getById(id));
        const fetchedVenues = await Promise.all(venuePromises);
        venuesToSync = fetchedVenues.filter((v): v is NonNullable<typeof v> =>
          v !== null && v.status === 'verified' && !v.production_venue_id
        );
      }

      if (dishIds && dishIds.length > 0) {
        const dishPromises = dishIds.map(id => discoveredDishes.getById(id));
        const fetchedDishes = await Promise.all(dishPromises);
        dishesToSync = fetchedDishes.filter((d): d is NonNullable<typeof d> =>
          d !== null && d.status === 'verified' && !d.production_dish_id
        );
      }
    }

    if (venuesToSync.length === 0 && dishesToSync.length === 0) {
      res.json({
        success: true,
        message: 'No entities to sync',
        synced: { venues: 0, dishes: 0 },
      });
      return;
    }

    const db = getFirestore();
    const errors: SyncErrorRecord[] = [];
    const syncedVenueIds: string[] = [];
    const syncedDishIds: string[] = [];
    let venuesAdded = 0;
    let dishesAdded = 0;

    // Sync venues
    for (const discoveredVenue of venuesToSync) {
      try {
        // Use a transaction to ensure atomicity
        await db.runTransaction(async (transaction) => {
          // Create production venue
          const venueRef = db.collection('venues').doc();
          const productionVenue = {
            type: 'restaurant' as const,
            name: discoveredVenue.name,
            chain_id: discoveredVenue.chain_id,
            address: {
              street: discoveredVenue.address.street,
              city: discoveredVenue.address.city,
              postal_code: discoveredVenue.address.postal_code,
              country: discoveredVenue.address.country,
            },
            location: discoveredVenue.coordinates ? {
              latitude: discoveredVenue.coordinates.latitude,
              longitude: discoveredVenue.coordinates.longitude,
            } : { latitude: 0, longitude: 0 },
            opening_hours: {
              monday: { open: '11:00', close: '22:00' },
              tuesday: { open: '11:00', close: '22:00' },
              wednesday: { open: '11:00', close: '22:00' },
              thursday: { open: '11:00', close: '22:00' },
              friday: { open: '11:00', close: '22:00' },
              saturday: { open: '11:00', close: '22:00' },
              sunday: { open: '11:00', close: '22:00' },
            },
            delivery_platforms: discoveredVenue.delivery_platforms.map(p => ({
              platform: p.platform,
              url: p.url,
              venue_id: p.venue_id,
            })),
            source: {
              type: 'discovered' as const,
              partner_id: 'smart-discovery-agent',
            },
            status: 'active' as const,
            last_verified: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          };

          transaction.set(venueRef, productionVenue);

          // Update discovered venue to mark as promoted
          const discoveredVenueRef = db.collection('discovered_venues').doc(discoveredVenue.id);
          transaction.update(discoveredVenueRef, {
            status: 'promoted',
            production_venue_id: venueRef.id,
            promoted_at: new Date(),
            updated_at: new Date(),
          });
        });

        syncedVenueIds.push(discoveredVenue.id);
        venuesAdded++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({
          entityId: discoveredVenue.id,
          entityType: 'venue',
          error: errorMsg,
        });
        console.error(`Failed to sync venue ${discoveredVenue.name}:`, errorMsg);
      }
    }

    // Sync dishes
    for (const discoveredDish of dishesToSync) {
      try {
        // Use a transaction to ensure atomicity
        await db.runTransaction(async (transaction) => {
          // Create production dish
          const dishRef = db.collection('dishes').doc();
          const productionDish = {
            venue_id: discoveredDish.production_dish_id || discoveredDish.venue_id,
            name: discoveredDish.name,
            description: discoveredDish.description,
            category: discoveredDish.category,
            product_sku: discoveredDish.planted_product,
            is_vegan: discoveredDish.is_vegan,
            dietary_tags: discoveredDish.dietary_tags,
            price: Object.values(discoveredDish.price_by_country)[0] || '',
            image_url: discoveredDish.image_url,
            source: {
              type: 'discovered' as const,
              partner_id: 'smart-discovery-agent',
            },
            status: 'active' as const,
            created_at: new Date(),
            updated_at: new Date(),
          };

          transaction.set(dishRef, productionDish);

          // Update discovered dish to mark as promoted
          const discoveredDishRef = db.collection('discovered_dishes').doc(discoveredDish.id);
          transaction.update(discoveredDishRef, {
            status: 'promoted',
            production_dish_id: dishRef.id,
            promoted_at: new Date(),
            updated_at: new Date(),
          });
        });

        syncedDishIds.push(discoveredDish.id);
        dishesAdded++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({
          entityId: discoveredDish.id,
          entityType: 'dish',
          error: errorMsg,
        });
        console.error(`Failed to sync dish ${discoveredDish.name}:`, errorMsg);
      }
    }

    // Record sync in history
    const userId = req.user?.uid || 'unknown';
    await syncHistory.recordSync(
      userId,
      syncedVenueIds,
      syncedDishIds,
      {
        venuesAdded,
        venuesUpdated: 0,
        dishesAdded,
        dishesUpdated: 0,
        errors: errors.length,
      },
      errors.length > 0 ? errors : undefined
    );

    // Log to changelog
    try {
      await changeLogs.log({
        action: 'created',
        collection: 'sync_operations',
        document_id: `sync_${Date.now()}`,
        changes: [
          {
            field: 'venues_synced',
            before: null,
            after: venuesAdded
          },
          {
            field: 'dishes_synced',
            before: null,
            after: dishesAdded
          },
        ],
        source: { type: 'manual', user_id: userId },
        reason: `Admin sync: ${venuesAdded} venues, ${dishesAdded} dishes`,
      });
    } catch (e) {
      console.warn('Failed to log sync to changelog:', e);
    }

    res.json({
      success: true,
      message: `Successfully synced ${venuesAdded} venues and ${dishesAdded} dishes`,
      synced: {
        venues: venuesAdded,
        dishes: dishesAdded,
      },
      errors: errors.length > 0 ? errors : undefined,
      stats: {
        requested: {
          venues: venuesToSync.length,
          dishes: dishesToSync.length,
        },
        successful: {
          venues: venuesAdded,
          dishes: dishesAdded,
        },
        failed: {
          venues: venuesToSync.length - venuesAdded,
          dishes: dishesToSync.length - dishesAdded,
        },
      },
    });
  },
  {
    allowedMethods: ['POST'],
    timeoutSeconds: 540, // 9 minutes for large syncs
  }
);
