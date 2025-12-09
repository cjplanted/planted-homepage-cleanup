import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import {
  initializeFirestore,
  discoveredVenues,
  discoveredDishes,
  discoveryStrategies,
  searchFeedback,
  changeLogs,
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
 * Admin API for discovered venues review
 * Supports: GET (list/detail), POST (verify/reject/update)
 */
export const adminDiscoveredVenuesHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    try {
      const pathParts = authReq.path.split('/').filter(Boolean);
      // Path structure: /discovered-venues, /discovered-venues/:id, /discovered-venues/:id/verify, etc.
      const venueId = pathParts.length >= 2 ? pathParts[1] : undefined;
      const action = pathParts.length >= 3 ? pathParts[2] : undefined;

      switch (authReq.method) {
        case 'GET': {
          // GET /discovered-venues/stats - get statistics
          if (venueId === 'stats') {
            const stats = await discoveredVenues.getStats();

            // Calculate confidence distribution
            const allVenues = await discoveredVenues.getByStatus('discovered');
            const byConfidence = {
              low: allVenues.filter(v => v.confidence_score < 40).length,
              medium: allVenues.filter(v => v.confidence_score >= 40 && v.confidence_score < 70).length,
              high: allVenues.filter(v => v.confidence_score >= 70).length,
            };

            authRes.json({
              total_discovered: stats.by_status.discovered || 0,
              total_verified: stats.by_status.verified || 0,
              total_rejected: stats.by_status.rejected || 0,
              by_country: stats.by_country,
              by_platform: stats.by_platform,
              by_confidence: byConfidence,
            });
            return;
          }

          // GET /discovered-venues/:id - get single venue
          if (venueId && venueId !== 'bulk-verify' && venueId !== 'bulk-reject') {
            const venue = await discoveredVenues.getById(venueId);
            if (!venue) {
              authRes.status(404).json({ error: 'Not found' });
              return;
            }
            // Fetch dishes for this venue
            const venueDishes = await discoveredDishes.getByVenue(venueId);
            authRes.json({
              ...venue,
              dishes: venueDishes.map(dish => ({
                id: dish.id,
                name: dish.name,
                description: dish.description,
                category: dish.category,
                product: dish.planted_product, // Map to 'product' for frontend
                confidence: dish.confidence_score, // Map to 'confidence' for frontend
                price: dish.price_by_country ? Object.values(dish.price_by_country)[0] : undefined, // Get first price
                price_by_country: dish.price_by_country,
                image_url: dish.image_url,
                status: dish.status,
              })),
            });
            return;
          }

          // GET /discovered-venues - list venues with filters
          const status = authReq.query.status as string || 'discovered';
          const country = authReq.query.country as string;
          const platform = authReq.query.platform as string;
          const minConfidence = parseInt(authReq.query.min_confidence as string, 10) || 0;
          const maxConfidence = parseInt(authReq.query.max_confidence as string, 10) || 100;
          const limit = parseInt(authReq.query.limit as string, 10) || 50;

          let venues = await discoveredVenues.getByStatus(status as any);

          // Apply filters
          if (country) {
            venues = venues.filter(v => v.address.country === country);
          }
          if (platform) {
            venues = venues.filter(v =>
              v.delivery_platforms.some(p => p.platform === platform)
            );
          }
          if (minConfidence > 0) {
            venues = venues.filter(v => v.confidence_score >= minConfidence);
          }
          if (maxConfidence < 100) {
            venues = venues.filter(v => v.confidence_score <= maxConfidence);
          }

          // Sort by confidence score descending
          venues.sort((a, b) => b.confidence_score - a.confidence_score);

          // Limit results
          const limited = venues.slice(0, limit);

          // Fetch dishes for each venue and attach them
          const venuesWithDishes = await Promise.all(
            limited.map(async (venue) => {
              const venueDishes = await discoveredDishes.getByVenue(venue.id);
              return {
                ...venue,
                dishes: venueDishes.map(dish => ({
                  id: dish.id,
                  name: dish.name,
                  description: dish.description,
                  category: dish.category,
                  product: dish.planted_product, // Map to 'product' for frontend
                  confidence: dish.confidence_score, // Map to 'confidence' for frontend
                  price: dish.price_by_country ? Object.values(dish.price_by_country)[0] : undefined, // Get first price
                  price_by_country: dish.price_by_country,
                  image_url: dish.image_url,
                  status: dish.status,
                })),
              };
            })
          );

          authRes.json({ venues: venuesWithDishes, total: venues.length });
          break;
        }

        case 'POST': {
          // POST /discovered-venues/bulk-verify
          if (venueId === 'bulk-verify') {
            const { ids } = authReq.body as { ids: string[] };
            if (!ids || !Array.isArray(ids)) {
              authRes.status(400).json({ error: 'ids array required' });
              return;
            }

            let verified = 0;
            for (const id of ids) {
              try {
                const venue = await discoveredVenues.getById(id);
                if (venue && venue.status === 'discovered') {
                  await discoveredVenues.verifyVenue(id);

                  // Update strategy success
                  if (venue.discovered_by_strategy_id) {
                    await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
                      success: true,
                      was_false_positive: false,
                    });
                  }

                  verified++;
                }
              } catch (e) {
                console.warn(`Failed to verify venue ${id}:`, e);
              }
            }

            authRes.json({ success: true, verified });
            return;
          }

          // POST /discovered-venues/bulk-reject
          if (venueId === 'bulk-reject') {
            const { ids, reason } = authReq.body as { ids: string[]; reason: string };
            if (!ids || !Array.isArray(ids)) {
              authRes.status(400).json({ error: 'ids array required' });
              return;
            }

            let rejected = 0;
            for (const id of ids) {
              try {
                const venue = await discoveredVenues.getById(id);
                if (venue && venue.status === 'discovered') {
                  await discoveredVenues.rejectVenue(id, reason || 'Bulk rejected');

                  // Update strategy - mark as false positive
                  if (venue.discovered_by_strategy_id) {
                    await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
                      success: false,
                      was_false_positive: true,
                    });
                  }

                  rejected++;
                }
              } catch (e) {
                console.warn(`Failed to reject venue ${id}:`, e);
              }
            }

            authRes.json({ success: true, rejected });
            return;
          }

          if (!venueId) {
            authRes.status(400).json({ error: 'Venue ID required' });
            return;
          }

          const venue = await discoveredVenues.getById(venueId);
          if (!venue) {
            authRes.status(404).json({ error: 'Not found' });
            return;
          }

          // POST /discovered-venues/:id/verify
          if (action === 'verify') {
            const { updates } = authReq.body as { updates?: Record<string, unknown> };

            // Apply any updates first
            if (updates && Object.keys(updates).length > 0) {
              await discoveredVenues.update(venueId, updates as any);
            }

            // Mark as verified
            await discoveredVenues.verifyVenue(venueId);

            // Update strategy success rate
            if (venue.discovered_by_strategy_id) {
              try {
                await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
                  success: true,
                  was_false_positive: false,
                });
              } catch (e) {
                console.warn('Failed to update strategy:', e);
              }

              // Record feedback
              try {
                await searchFeedback.recordSearch({
                  query: venue.discovered_by_query,
                  platform: venue.delivery_platforms[0]?.platform || 'unknown',
                  country: venue.address.country as any,
                  strategy_id: venue.discovered_by_strategy_id,
                  result_type: 'true_positive',
                  discovered_venue_id: venueId,
                });
              } catch (e) {
                console.warn('Failed to record feedback:', e);
              }
            }

            // Log the change
            await changeLogs.log({
              action: 'verified',
              collection: 'discovered_venues',
              document_id: venueId,
              changes: [{ field: 'status', before: 'discovered', after: 'verified' }],
              source: { type: 'manual', user_id: authReq.user?.uid },
              reason: 'Admin verified venue',
            });

            authRes.json({ success: true, message: 'Venue verified' });
            return;
          }

          // POST /discovered-venues/:id/reject
          if (action === 'reject') {
            const { reason } = authReq.body as { reason: string };
            if (!reason) {
              authRes.status(400).json({ error: 'Rejection reason required' });
              return;
            }

            await discoveredVenues.rejectVenue(venueId, reason);

            // Update strategy - mark as false positive
            if (venue.discovered_by_strategy_id) {
              try {
                await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
                  success: false,
                  was_false_positive: true,
                });
              } catch (e) {
                console.warn('Failed to update strategy:', e);
              }

              // Record feedback
              try {
                await searchFeedback.recordSearch({
                  query: venue.discovered_by_query,
                  platform: venue.delivery_platforms[0]?.platform || 'unknown',
                  country: venue.address.country as any,
                  strategy_id: venue.discovered_by_strategy_id,
                  result_type: 'false_positive',
                  discovered_venue_id: venueId,
                });
              } catch (e) {
                console.warn('Failed to record feedback:', e);
              }
            }

            // Log the change
            await changeLogs.log({
              action: 'rejected',
              collection: 'discovered_venues',
              document_id: venueId,
              changes: [
                { field: 'status', before: 'discovered', after: 'rejected' },
                { field: 'rejection_reason', before: null, after: reason },
              ],
              source: { type: 'manual', user_id: authReq.user?.uid },
              reason: `Admin rejected venue: ${reason}`,
            });

            authRes.json({ success: true, message: 'Venue rejected' });
            return;
          }

          // POST /discovered-venues/:id/update-and-verify
          if (action === 'update-and-verify') {
            const updates = authReq.body as Record<string, unknown>;

            // Update the venue with provided data
            await discoveredVenues.update(venueId, updates as any);

            // Mark as verified
            await discoveredVenues.verifyVenue(venueId);

            // Update strategy success rate
            if (venue.discovered_by_strategy_id) {
              try {
                await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
                  success: true,
                  was_false_positive: false,
                });
              } catch (e) {
                console.warn('Failed to update strategy:', e);
              }
            }

            // Log the change
            await changeLogs.log({
              action: 'updated_and_verified',
              collection: 'discovered_venues',
              document_id: venueId,
              changes: Object.keys(updates).map(field => ({
                field,
                before: (venue as any)[field],
                after: (updates as any)[field],
              })),
              source: { type: 'manual', user_id: authReq.user?.uid },
              reason: 'Admin updated and verified venue',
            });

            authRes.json({ success: true, message: 'Venue updated and verified' });
            return;
          }

          authRes.status(400).json({ error: 'Invalid action' });
          break;
        }

        default:
          authRes.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      console.error('Admin discovered venues error:', error);
      authRes.status(500).json({ error: 'Internal server error' });
    }
  });
});
