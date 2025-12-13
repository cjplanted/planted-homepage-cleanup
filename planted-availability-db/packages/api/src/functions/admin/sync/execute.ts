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

/**
 * Parse price string to Price object
 * Handles formats: "CHF 18.90", "18.90", "€15.99"
 */
function parsePrice(priceStr: string | undefined, currency: string | undefined): { amount: number; currency: string } {
  if (!priceStr) return { amount: 0, currency: currency || 'CHF' };

  // Handle already-number prices
  if (typeof priceStr === 'number') {
    return { amount: priceStr, currency: currency || 'CHF' };
  }

  // Parse "CHF 18.90" or "18.90" or "€15.99" format
  const match = priceStr.match(/([A-Z]{3}|[€$£])?\s*(\d+(?:[.,]\d+)?)/);
  if (match) {
    const amount = parseFloat(match[2].replace(',', '.'));
    let curr = currency || 'CHF';
    if (match[1]) {
      // Map symbols to currency codes
      const symbolMap: Record<string, string> = { '€': 'EUR', '$': 'USD', '£': 'GBP' };
      curr = symbolMap[match[1]] || match[1];
    }
    return { amount: isNaN(amount) ? 0 : amount, currency: curr };
  }
  return { amount: 0, currency: currency || 'CHF' };
}

/**
 * Parse price from country price map
 */
function parsePriceFromCountryMap(priceByCountry: Record<string, string> | undefined): { amount: number; currency: string } {
  if (!priceByCountry || Object.keys(priceByCountry).length === 0) {
    return { amount: 0, currency: 'CHF' };
  }
  const firstPrice = Object.values(priceByCountry)[0];
  return parsePrice(firstPrice, undefined);
}

// Validation schema for execute request body
const executeBodySchema = z.object({
  venueIds: z.array(z.string()).optional(),
  dishIds: z.array(z.string()).optional(),
  syncAll: z.boolean().optional().default(false),
  skipAddressValidation: z.boolean().optional().default(false), // For backfill scenarios
});

/**
 * Validation result for address completeness
 */
interface AddressValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that a venue has complete address data
 * Returns validation result with any issues found
 */
function validateVenueAddress(venue: { name: string; address: { street?: string; city: string; postal_code?: string; country: string } }): AddressValidationResult {
  const errors: string[] = [];

  if (!venue.address.street || venue.address.street.trim() === '') {
    errors.push('Missing street address');
  }
  if (!venue.address.city || venue.address.city.trim() === '' || venue.address.city === 'Unknown') {
    errors.push('Missing or invalid city');
  }
  if (!venue.address.country || venue.address.country.trim() === '') {
    errors.push('Missing country');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize address for matching
 */
function normalizeAddressKey(address: { street?: string; city: string; postal_code?: string; country: string }): string {
  const street = (address.street || '').toLowerCase().trim();
  const postal = (address.postal_code || '').toLowerCase().trim();
  const city = address.city.toLowerCase().trim();
  const country = address.country.toLowerCase().trim();
  return `${street}|${postal}|${city}|${country}`;
}

/**
 * Find existing production venue that matches the discovered venue
 * Uses: delivery platform URL match, address match, or chain_id + city match
 */
async function findExistingProductionVenue(
  db: FirebaseFirestore.Firestore,
  discoveredVenue: {
    name: string;
    chain_id?: string;
    address: { street?: string; city: string; postal_code?: string; country: string };
    delivery_platforms: Array<{ platform: string; url: string; venue_id?: string }>;
  }
): Promise<{ id: string; needsUpdate: boolean } | null> {
  // Get all venues to check (we need to check multiple criteria)
  const venuesSnapshot = await db.collection('venues').get();
  const normalizedDiscoveredAddress = normalizeAddressKey(discoveredVenue.address);

  // Build set of discovered platform URLs
  const discoveredUrls = new Set(
    discoveredVenue.delivery_platforms.map(p => p.url.toLowerCase())
  );

  for (const doc of venuesSnapshot.docs) {
    const existingVenue = doc.data() as {
      chain_id?: string;
      address: { street?: string; city: string; postal_code?: string; country: string };
      delivery_platforms?: Array<{ platform: string; url: string }>;
    };

    // Check 1: Matching delivery platform URL (strongest signal)
    if (existingVenue.delivery_platforms) {
      for (const platform of existingVenue.delivery_platforms) {
        if (discoveredUrls.has(platform.url.toLowerCase())) {
          return { id: doc.id, needsUpdate: true };
        }
      }
    }

    // Check 2: Exact address match
    const normalizedExistingAddress = normalizeAddressKey(existingVenue.address);
    if (normalizedDiscoveredAddress === normalizedExistingAddress) {
      return { id: doc.id, needsUpdate: true };
    }

    // Check 3: Same chain + same city + same country (likely same venue)
    if (
      discoveredVenue.chain_id &&
      existingVenue.chain_id === discoveredVenue.chain_id &&
      existingVenue.address.city.toLowerCase() === discoveredVenue.address.city.toLowerCase() &&
      existingVenue.address.country.toLowerCase() === discoveredVenue.address.country.toLowerCase()
    ) {
      // Also check street similarity to avoid matching different locations of same chain
      const existingStreet = (existingVenue.address.street || '').toLowerCase();
      const discoveredStreet = (discoveredVenue.address.street || '').toLowerCase();
      if (existingStreet === discoveredStreet || !existingStreet || !discoveredStreet) {
        return { id: doc.id, needsUpdate: true };
      }
    }
  }

  return null;
}

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

    const { venueIds, dishIds, syncAll, skipAddressValidation } = validation.data;

    // Get entities to sync
    let venuesToSync = [];
    let dishesToSync = [];

    if (syncAll) {
      // Get all verified entities not yet promoted
      const allVerifiedVenues = await discoveredVenues.getByStatus('verified');
      console.log(`[Sync] Found ${allVerifiedVenues.length} verified venues`);
      venuesToSync = allVerifiedVenues.filter(v => !v.production_venue_id && !v.promoted_at);
      console.log(`[Sync] ${venuesToSync.length} venues to sync after filtering`);

      const allVerifiedDishes = await discoveredDishes.getByStatusUnordered('verified');
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
    let venuesUpdated = 0;
    let dishesAdded = 0;

    // Sync venues (including their embedded dishes)
    let skippedForValidation = 0;
    for (const discoveredVenue of venuesToSync) {
      // Validate address completeness unless explicitly skipped
      if (!skipAddressValidation) {
        const addressValidation = validateVenueAddress(discoveredVenue);
        if (!addressValidation.valid) {
          const errorMsg = `Address validation failed: ${addressValidation.errors.join(', ')}`;
          console.warn(`[Sync] Skipping venue "${discoveredVenue.name}": ${errorMsg}`);
          errors.push({
            entityId: discoveredVenue.id,
            entityType: 'venue',
            error: errorMsg,
          });
          skippedForValidation++;
          continue; // Skip to next venue
        }
      }

      try {
        // Check if venue already exists in production
        const existingVenue = await findExistingProductionVenue(db, discoveredVenue);

        // Use a transaction to ensure atomicity
        const result = await db.runTransaction(async (transaction) => {
          let venueRef: FirebaseFirestore.DocumentReference;
          let isUpdate = false;

          if (existingVenue) {
            // Update existing venue
            venueRef = db.collection('venues').doc(existingVenue.id);
            isUpdate = true;

            // Merge delivery platforms (keep existing + add new)
            const existingDoc = await transaction.get(venueRef);
            const existingData = existingDoc.data() as {
              delivery_platforms?: Array<{ platform: string; url: string }>;
            } | undefined;

            const existingUrls = new Set(
              (existingData?.delivery_platforms || []).map(p => p.url.toLowerCase())
            );

            const mergedPlatforms = [
              ...(existingData?.delivery_platforms || []),
              ...discoveredVenue.delivery_platforms
                .filter(p => !existingUrls.has(p.url.toLowerCase()))
                .map(p => ({
                  platform: p.platform,
                  url: p.url,
                  venue_id: p.venue_id,
                })),
            ];

            transaction.update(venueRef, {
              name: discoveredVenue.name,
              chain_id: discoveredVenue.chain_id || null,
              address: {
                street: discoveredVenue.address.street,
                city: discoveredVenue.address.city,
                postal_code: discoveredVenue.address.postal_code,
                country: discoveredVenue.address.country,
              },
              location: discoveredVenue.coordinates ? {
                latitude: discoveredVenue.coordinates.latitude,
                longitude: discoveredVenue.coordinates.longitude,
              } : undefined,
              delivery_platforms: mergedPlatforms,
              last_verified: new Date(),
              updated_at: new Date(),
            });

            console.log(`[Sync] Updated existing venue: ${discoveredVenue.name} (${venueRef.id})`);
          } else {
            // Create new production venue
            venueRef = db.collection('venues').doc();
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
            console.log(`[Sync] Created new venue: ${discoveredVenue.name} (${venueRef.id})`);
          }

          // Get existing dishes for this venue to avoid duplicates
          const existingDishesSnapshot = await db
            .collection('dishes')
            .where('venue_id', '==', venueRef.id)
            .get();
          const existingDishNames = new Set(
            existingDishesSnapshot.docs.map(d =>
              (d.data().name as string || '').toLowerCase().trim()
            )
          );

          // Create production dishes from embedded dishes array (skip duplicates)
          let embeddedDishesCreated = 0;
          if (discoveredVenue.dishes && discoveredVenue.dishes.length > 0) {
            for (const embeddedDish of discoveredVenue.dishes) {
              const normalizedName = embeddedDish.name.toLowerCase().trim();

              // Skip if dish already exists
              if (existingDishNames.has(normalizedName)) {
                continue;
              }

              const dishRef = db.collection('dishes').doc();
              const productionDish = {
                venue_id: venueRef.id,
                name: embeddedDish.name,
                description: embeddedDish.description || '',
                planted_products: [embeddedDish.planted_product || embeddedDish.product_sku || 'planted.chicken'],
                price: parsePrice(embeddedDish.price, embeddedDish.currency),
                dietary_tags: embeddedDish.dietary_tags || [],
                cuisine_type: embeddedDish.category || undefined,
                availability: { type: 'permanent' as const },
                image_url: embeddedDish.image_url || undefined,
                source: {
                  type: 'discovered' as const,
                  partner_id: 'smart-discovery-agent',
                },
                status: 'active' as const,
                last_verified: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
              };
              transaction.set(dishRef, productionDish);
              existingDishNames.add(normalizedName);
              embeddedDishesCreated++;
            }
          }

          // Update discovered venue to mark as promoted
          const discoveredVenueRef = db.collection('discovered_venues').doc(discoveredVenue.id);
          transaction.update(discoveredVenueRef, {
            status: 'promoted',
            production_venue_id: venueRef.id,
            promoted_at: new Date(),
            updated_at: new Date(),
          });

          return { embeddedDishesCreated, isUpdate };
        });

        syncedVenueIds.push(discoveredVenue.id);
        if (result.isUpdate) {
          venuesUpdated++;
        } else {
          venuesAdded++;
        }
        dishesAdded += result.embeddedDishesCreated;
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

    // Sync dishes - need to look up production venue ID for each dish
    for (const discoveredDish of dishesToSync) {
      try {
        // Look up the discovered venue to get the production venue ID
        const discoveredVenue = await discoveredVenues.getById(discoveredDish.venue_id);
        const productionVenueId = discoveredVenue?.production_venue_id;

        if (!productionVenueId) {
          // Skip dish - its venue hasn't been promoted yet
          errors.push({
            entityId: discoveredDish.id,
            entityType: 'dish',
            error: `Venue ${discoveredDish.venue_id} not yet promoted to production`,
          });
          console.warn(`Skipping dish ${discoveredDish.name}: venue not yet promoted`);
          continue;
        }

        // Use a transaction to ensure atomicity
        await db.runTransaction(async (transaction) => {
          // Create production dish with correct schema
          const dishRef = db.collection('dishes').doc();
          const productionDish = {
            venue_id: productionVenueId,  // Use production venue ID, not discovered venue ID
            name: discoveredDish.name,
            description: discoveredDish.description || '',
            planted_products: [discoveredDish.planted_product || 'planted.chicken'],
            price: parsePriceFromCountryMap(discoveredDish.price_by_country),
            dietary_tags: discoveredDish.dietary_tags || [],
            cuisine_type: discoveredDish.category || undefined,
            availability: { type: 'permanent' as const },
            image_url: discoveredDish.image_url || undefined,
            source: {
              type: 'discovered' as const,
              partner_id: 'smart-discovery-agent',
            },
            status: 'active' as const,
            last_verified: new Date(),
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
        venuesUpdated,
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
      message: `Successfully synced ${venuesAdded + venuesUpdated} venues (${venuesAdded} new, ${venuesUpdated} updated) and ${dishesAdded} dishes`,
      synced: {
        venues: venuesAdded + venuesUpdated,
        venuesAdded,
        venuesUpdated,
        dishes: dishesAdded,
      },
      errors: errors.length > 0 ? errors : undefined,
      stats: {
        requested: {
          venues: venuesToSync.length,
          dishes: dishesToSync.length,
        },
        successful: {
          venues: venuesAdded + venuesUpdated,
          venuesAdded,
          venuesUpdated,
          dishes: dishesAdded,
        },
        failed: {
          venues: venuesToSync.length - venuesAdded - venuesUpdated,
          dishes: dishesToSync.length - dishesAdded,
        },
        skippedForValidation,
      },
    });
  },
  {
    allowedMethods: ['POST'],
    timeoutSeconds: 540, // 9 minutes for large syncs
  }
);
