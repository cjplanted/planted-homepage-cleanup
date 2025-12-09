import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import {
  initializeFirestore,
  getFirestore,
  discoveredVenues,
  venues,
} from '@pad/database';
import { verifyAuth, requireAdmin, type AuthenticatedRequest } from '../../middleware/auth.js';

// Initialize Firestore
initializeFirestore();

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public',
};

/**
 * Helper to wrap admin handlers with authentication
 */
async function withAdminAuth(
  req: Request,
  res: Response,
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>
): Promise<void> {
  let authPassed = false;
  const mockNext = () => { authPassed = true; };

  await verifyAuth(req as AuthenticatedRequest, res, mockNext);
  if (!authPassed) return;

  authPassed = false;
  await requireAdmin(req as AuthenticatedRequest, res, mockNext);
  if (!authPassed) return;

  await handler(req as AuthenticatedRequest, res);
}

/**
 * Admin API for website sync operations
 * Handles syncing verified venues to the website
 */
export const adminSyncHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    try {
      const pathParts = authReq.path.split('/').filter(Boolean);
      // Path structure: /sync/preview, /sync/execute, /sync/status

      const action = pathParts.length >= 2 ? pathParts[1] : undefined;

      switch (authReq.method) {
        case 'GET': {
          // GET /sync/preview - Returns counts of venues to add/update/remove
          if (action === 'preview') {
            const db = getFirestore();

            // Get verified discovered venues (to be added to website)
            const verifiedVenues = await discoveredVenues.getByStatus('verified');

            // Filter to only those not yet promoted to production
            const toAdd = verifiedVenues.filter(v => !v.production_venue_id);

            // Get active production venues
            const productionVenues = await venues.query({
              status: 'active',
              limit: 1000,
            });

            // Count stale venues (could be candidates for removal/update)
            const staleVenues = await venues.getStaleVenues(30, 100); // 30 days

            // Check sync metadata
            const syncMetaRef = db.collection('system_metadata').doc('website_sync');
            const syncMeta = await syncMetaRef.get();
            const lastSync = syncMeta.exists
              ? syncMeta.data()?.last_sync?.toDate?.() || null
              : null;

            authRes.json({
              preview: {
                venues_to_add: toAdd.length,
                venues_to_update: 0, // Could implement update logic
                venues_to_remove: 0, // Could implement removal logic
                stale_venues: staleVenues.length,
              },
              details: {
                verified_venues: toAdd.map(v => ({
                  id: v.id,
                  name: v.name,
                  chain_name: v.chain_name,
                  city: v.address.city,
                  country: v.address.country,
                  confidence_score: v.confidence_score,
                })),
                current_production_count: productionVenues.length,
              },
              last_sync: lastSync,
            });
            return;
          }

          // GET /sync/status - Returns last sync time and pending count
          if (action === 'status') {
            const db = getFirestore();

            // Get verified venues pending sync
            const verifiedVenues = await discoveredVenues.getByStatus('verified');
            const pendingSync = verifiedVenues.filter(v => !v.production_venue_id);

            // Get sync metadata
            const syncMetaRef = db.collection('system_metadata').doc('website_sync');
            const syncMeta = await syncMetaRef.get();
            const syncData = syncMeta.exists ? syncMeta.data() : null;

            authRes.json({
              last_sync: syncData?.last_sync?.toDate?.() || null,
              last_sync_by: syncData?.last_sync_by || null,
              last_sync_count: syncData?.last_sync_count || 0,
              pending_count: pendingSync.length,
              status: pendingSync.length > 0 ? 'pending' : 'synced',
            });
            return;
          }

          authRes.status(404).json({ error: 'Not found' });
          break;
        }

        case 'POST': {
          // POST /sync/execute - Triggers sync to website
          if (action === 'execute') {
            const db = getFirestore();

            // Get verified venues to sync
            const verifiedVenues = await discoveredVenues.getByStatus('verified');
            const toSync = verifiedVenues.filter(v => !v.production_venue_id);

            if (toSync.length === 0) {
              authRes.json({
                success: true,
                message: 'No venues to sync',
                synced_count: 0,
              });
              return;
            }

            // Promote verified venues to production
            let syncedCount = 0;
            const errors: string[] = [];

            for (const discoveredVenue of toSync) {
              try {
                // Create production venue with proper type mapping
                const productionVenue = await venues.create({
                  type: 'restaurant', // Default type for discovered venues
                  name: discoveredVenue.name,
                  chain_id: discoveredVenue.chain_id,
                  address: {
                    street: discoveredVenue.address.street,
                    city: discoveredVenue.address.city,
                    postal_code: discoveredVenue.address.postal_code,
                    country: discoveredVenue.address.country,
                  },
                  // Map coordinates to location (GeoPoint format)
                  location: discoveredVenue.coordinates ? {
                    latitude: discoveredVenue.coordinates.latitude,
                    longitude: discoveredVenue.coordinates.longitude,
                  } : { latitude: 0, longitude: 0 },
                  // Provide default opening hours
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
                    type: 'discovered',
                    partner_id: 'smart-discovery-agent',
                  },
                  status: 'active',
                  last_verified: new Date(),
                });

                // Update discovered venue to mark it as promoted
                await discoveredVenues.update(discoveredVenue.id, {
                  production_venue_id: productionVenue.id,
                  promoted_at: new Date(),
                });

                syncedCount++;
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`Failed to sync ${discoveredVenue.name}: ${errorMsg}`);
                console.error('Sync error:', errorMsg);
              }
            }

            // Update sync metadata
            const syncMetaRef = db.collection('system_metadata').doc('website_sync');
            await syncMetaRef.set({
              last_sync: new Date(),
              last_sync_by: authReq.user?.uid || 'unknown',
              last_sync_count: syncedCount,
              last_sync_errors: errors,
            }, { merge: true });

            authRes.json({
              success: true,
              message: `Synced ${syncedCount} venues to production`,
              synced_count: syncedCount,
              errors: errors.length > 0 ? errors : undefined,
              note: 'Venues have been promoted to production. You may need to regenerate the website static files.',
            });
            return;
          }

          authRes.status(400).json({ error: 'Invalid action' });
          break;
        }

        default:
          authRes.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      console.error('Admin sync error:', error);
      authRes.status(500).json({ error: 'Internal server error' });
    }
  });
});
