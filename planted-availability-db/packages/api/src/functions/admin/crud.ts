import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import {
  initializeFirestore,
  venues,
  dishes,
  promotions,
  chains,
  changeLogs,
  discoveredVenues,
} from '@pad/database';
import {
  createVenueInputSchema,
  updateVenueInputSchema,
  createDishInputSchema,
  updateDishInputSchema,
  createPromotionInputSchema,
  createChainInputSchema,
} from '@pad/core';
import { verifyAuth, requireAdmin, type AuthenticatedRequest } from '../../middleware/auth.js';

// Initialize Firestore
initializeFirestore();

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public', // Allow public access - auth middleware handles authentication
};

/**
 * Helper to wrap admin handlers with authentication
 * Verifies Firebase ID token and checks for admin custom claim
 */
async function withAdminAuth(
  req: Request,
  res: Response,
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>
): Promise<void> {
  // Create a mock next function for middleware compatibility
  let authPassed = false;
  const mockNext = () => { authPassed = true; };

  // Run auth verification
  await verifyAuth(req as AuthenticatedRequest, res, mockNext);
  if (!authPassed) return; // Response already sent by verifyAuth

  // Check admin claim
  authPassed = false;
  await requireAdmin(req as AuthenticatedRequest, res, mockNext);
  if (!authPassed) return; // Response already sent by requireAdmin

  // Auth passed, run the actual handler
  await handler(req as AuthenticatedRequest, res);
}

/**
 * Admin CRUD operations for venues
 * Requires admin authentication
 */
export const adminVenuesHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    try {
      const pathParts = authReq.path.split('/').filter(Boolean);
      const venueId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : undefined;

      switch (authReq.method) {
        case 'GET': {
          if (venueId) {
            const venue = await venues.getById(venueId);
            if (!venue) {
              authRes.status(404).json({ error: 'Not found' });
              return;
            }
            authRes.json(venue);
          } else {
            const limit = parseInt(authReq.query.limit as string, 10) || 50;
            const offset = parseInt(authReq.query.offset as string, 10) || 0;
            const venuesList = await venues.getAll({ limit, offset });
            authRes.json({ venues: venuesList, total: venuesList.length });
          }
          break;
        }

        case 'POST': {
          const parseResult = createVenueInputSchema.safeParse(authReq.body);
          if (!parseResult.success) {
            authRes.status(400).json({
              error: 'Validation error',
              details: parseResult.error.issues,
            });
            return;
          }

          const newVenue = await venues.create({
            ...parseResult.data,
            last_verified: new Date(),
          });

          // Log the change with user info
          await changeLogs.log({
            action: 'created',
            collection: 'venues',
            document_id: newVenue.id,
            changes: [{ field: '*', before: null, after: newVenue }],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin created venue',
          });

          authRes.status(201).json(newVenue);
          break;
        }

        case 'PUT': {
          if (!venueId) {
            authRes.status(400).json({ error: 'Venue ID required' });
            return;
          }

          const existing = await venues.getById(venueId);
          if (!existing) {
            authRes.status(404).json({ error: 'Not found' });
            return;
          }

          const updateResult = updateVenueInputSchema.safeParse(authReq.body);
          if (!updateResult.success) {
            authRes.status(400).json({
              error: 'Validation error',
              details: updateResult.error.issues,
            });
            return;
          }

          const updated = await venues.update(venueId, updateResult.data);

          // Log the change with user info
          await changeLogs.log({
            action: 'updated',
            collection: 'venues',
            document_id: venueId,
            changes: Object.keys(updateResult.data).map((field) => ({
              field,
              before: (existing as any)[field],
              after: (updateResult.data as any)[field],
            })),
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin updated venue',
          });

          authRes.json(updated);
          break;
        }

        case 'DELETE': {
          if (!venueId) {
            authRes.status(400).json({ error: 'Venue ID required' });
            return;
          }

          const toDelete = await venues.getById(venueId);
          if (!toDelete) {
            authRes.status(404).json({ error: 'Not found' });
            return;
          }

          // Archive instead of hard delete
          await venues.archive(venueId);

          // Log the change with user info
          await changeLogs.log({
            action: 'archived',
            collection: 'venues',
            document_id: venueId,
            changes: [{ field: 'status', before: toDelete.status, after: 'archived' }],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin archived venue',
          });

          authRes.status(204).send('');
          break;
        }

        default:
          authRes.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      console.error('Admin venues error:', error);
      authRes.status(500).json({ error: 'Internal server error' });
    }
  });
});

/**
 * Admin CRUD operations for dishes
 * Requires admin authentication
 */
export const adminDishesHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    try {
      const pathParts = authReq.path.split('/').filter(Boolean);
      const dishId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : undefined;

      switch (authReq.method) {
        case 'GET': {
          if (dishId) {
            const dish = await dishes.getById(dishId);
            if (!dish) {
              authRes.status(404).json({ error: 'Not found' });
              return;
            }
            authRes.json(dish);
          } else {
            const venueId = authReq.query.venue_id as string | undefined;
            const limit = parseInt(authReq.query.limit as string, 10) || 50;

            let dishList;
            if (venueId) {
              dishList = await dishes.getByVenue(venueId, false);
            } else {
              dishList = await dishes.getAll({ limit });
            }
            authRes.json({ dishes: dishList, total: dishList.length });
          }
          break;
        }

        case 'POST': {
          const parseResult = createDishInputSchema.safeParse(authReq.body);
          if (!parseResult.success) {
            authRes.status(400).json({
              error: 'Validation error',
              details: parseResult.error.issues,
            });
            return;
          }

          const newDish = await dishes.create({
            ...parseResult.data,
            last_verified: new Date(),
          });

          await changeLogs.log({
            action: 'created',
            collection: 'dishes',
            document_id: newDish.id,
            changes: [{ field: '*', before: null, after: newDish }],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin created dish',
          });

          authRes.status(201).json(newDish);
          break;
        }

        case 'PUT': {
          if (!dishId) {
            authRes.status(400).json({ error: 'Dish ID required' });
            return;
          }

          const existing = await dishes.getById(dishId);
          if (!existing) {
            authRes.status(404).json({ error: 'Not found' });
            return;
          }

          const updateResult = updateDishInputSchema.safeParse(authReq.body);
          if (!updateResult.success) {
            authRes.status(400).json({
              error: 'Validation error',
              details: updateResult.error.issues,
            });
            return;
          }

          const updated = await dishes.update(dishId, updateResult.data);

          await changeLogs.log({
            action: 'updated',
            collection: 'dishes',
            document_id: dishId,
            changes: Object.keys(updateResult.data).map((field) => ({
              field,
              before: (existing as any)[field],
              after: (updateResult.data as any)[field],
            })),
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin updated dish',
          });

          authRes.json(updated);
          break;
        }

        case 'DELETE': {
          if (!dishId) {
            authRes.status(400).json({ error: 'Dish ID required' });
            return;
          }

          await dishes.archive(dishId);

          await changeLogs.log({
            action: 'archived',
            collection: 'dishes',
            document_id: dishId,
            changes: [{ field: 'status', before: 'active', after: 'archived' }],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin archived dish',
          });

          authRes.status(204).send('');
          break;
        }

        default:
          authRes.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      console.error('Admin dishes error:', error);
      authRes.status(500).json({ error: 'Internal server error' });
    }
  });
});

/**
 * Admin CRUD operations for promotions
 * Requires admin authentication
 */
export const adminPromotionsHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    try {
      const pathParts = authReq.path.split('/').filter(Boolean);
      const promoId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : undefined;

      switch (authReq.method) {
        case 'GET': {
          if (promoId) {
            const promo = await promotions.getById(promoId);
            if (!promo) {
              authRes.status(404).json({ error: 'Not found' });
              return;
            }
            authRes.json(promo);
          } else {
            const activeOnly = authReq.query.active_only !== 'false';
            const promoList = await promotions.query({ activeOnly, limit: 100 });
            authRes.json({ promotions: promoList, total: promoList.length });
          }
          break;
        }

        case 'POST': {
          const parseResult = createPromotionInputSchema.safeParse(authReq.body);
          if (!parseResult.success) {
            authRes.status(400).json({
              error: 'Validation error',
              details: parseResult.error.issues,
            });
            return;
          }

          const newPromo = await promotions.create(parseResult.data);

          await changeLogs.log({
            action: 'created',
            collection: 'promotions',
            document_id: newPromo.id,
            changes: [{ field: '*', before: null, after: newPromo }],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin created promotion',
          });

          authRes.status(201).json(newPromo);
          break;
        }

        case 'DELETE': {
          if (!promoId) {
            authRes.status(400).json({ error: 'Promotion ID required' });
            return;
          }

          await promotions.delete(promoId);

          await changeLogs.log({
            action: 'archived',
            collection: 'promotions',
            document_id: promoId,
            changes: [],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin deleted promotion',
          });

          authRes.status(204).send('');
          break;
        }

        default:
          authRes.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      console.error('Admin promotions error:', error);
      authRes.status(500).json({ error: 'Internal server error' });
    }
  });
});

/**
 * Admin CRUD operations for chains
 * Requires admin authentication
 */
export const adminChainsHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    try {
      const pathParts = authReq.path.split('/').filter(Boolean);
      const chainId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : undefined;

      switch (authReq.method) {
        case 'GET': {
          if (chainId) {
            const chain = await chains.getById(chainId);
            if (!chain) {
              authRes.status(404).json({ error: 'Not found' });
              return;
            }
            authRes.json(chain);
          } else {
            const chainList = await chains.query({ limit: 100 });
            authRes.json({ chains: chainList, total: chainList.length });
          }
          break;
        }

        case 'POST': {
          const parseResult = createChainInputSchema.safeParse(authReq.body);
          if (!parseResult.success) {
            authRes.status(400).json({
              error: 'Validation error',
              details: parseResult.error.issues,
            });
            return;
          }

          const newChain = await chains.create(parseResult.data);

          await changeLogs.log({
            action: 'created',
            collection: 'chains',
            document_id: newChain.id,
            changes: [{ field: '*', before: null, after: newChain }],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin created chain',
          });

          authRes.status(201).json(newChain);
          break;
        }

        case 'DELETE': {
          if (!chainId) {
            authRes.status(400).json({ error: 'Chain ID required' });
            return;
          }

          await chains.delete(chainId);

          await changeLogs.log({
            action: 'archived',
            collection: 'chains',
            document_id: chainId,
            changes: [],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: 'Admin deleted chain',
          });

          authRes.status(204).send('');
          break;
        }

        default:
          authRes.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      console.error('Admin chains error:', error);
      authRes.status(500).json({ error: 'Internal server error' });
    }
  });
});

/**
 * Admin Assign Chain to Venues
 * POST /adminAssignChain
 * Assigns discovered venues to an existing chain or creates a new chain
 */
export const adminAssignChainHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    if (authReq.method !== 'POST') {
      authRes.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { venueIds, chainId, newChainName } = authReq.body;

      // Validation
      if (!venueIds || !Array.isArray(venueIds) || venueIds.length === 0) {
        authRes.status(400).json({ error: 'venueIds array is required' });
        return;
      }

      if (!chainId && !newChainName) {
        authRes.status(400).json({ error: 'Either chainId or newChainName must be provided' });
        return;
      }

      let targetChainId: string;
      let targetChainName: string;

      // Either use existing chain or create new one
      if (chainId) {
        const existingChain = await chains.getById(chainId);
        if (!existingChain) {
          authRes.status(404).json({ error: 'Chain not found' });
          return;
        }
        targetChainId = chainId;
        targetChainName = existingChain.name;
      } else {
        // Create new chain
        const newChain = await chains.create({
          name: newChainName,
          type: 'restaurant',
          markets: [],
        });
        targetChainId = newChain.id;
        targetChainName = newChainName;

        await changeLogs.log({
          action: 'created',
          collection: 'chains',
          document_id: newChain.id,
          changes: [{ field: '*', before: null, after: newChain }],
          source: { type: 'manual', user_id: authReq.user?.uid },
          reason: 'Admin created chain via chain assignment',
        });
      }

      // Update all venues with chain info
      let updatedCount = 0;
      const errors: Array<{ venueId: string; error: string }> = [];

      for (const venueId of venueIds) {
        try {
          const venue = await discoveredVenues.getById(venueId);
          if (!venue) {
            errors.push({ venueId, error: 'Venue not found' });
            continue;
          }

          await discoveredVenues.update(venueId, {
            chain_id: targetChainId,
            chain_name: targetChainName,
            is_chain: true,
          });

          await changeLogs.log({
            action: 'updated',
            collection: 'discovered_venues',
            document_id: venueId,
            changes: [
              { field: 'chain_id', before: venue.chain_id, after: targetChainId },
              { field: 'chain_name', before: venue.chain_name, after: targetChainName },
              { field: 'is_chain', before: venue.is_chain, after: true },
            ],
            source: { type: 'manual', user_id: authReq.user?.uid },
            reason: `Admin assigned venue to chain: ${targetChainName}`,
          });

          updatedCount++;
        } catch (error) {
          console.error(`Failed to update venue ${venueId}:`, error);
          errors.push({
            venueId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      authRes.json({
        success: true,
        chainId: targetChainId,
        chainName: targetChainName,
        updatedCount,
        totalRequested: venueIds.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error('Admin assign chain error:', error);
      authRes.status(500).json({ error: 'Internal server error' });
    }
  });
});
