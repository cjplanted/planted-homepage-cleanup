/**
 * Partner Ingestion API
 *
 * Endpoints for partners to submit data via webhooks.
 * All endpoints require partner API key authentication.
 */

import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  initializeFirestore,
  ingestionBatches,
  stagedVenues,
  stagedDishes,
  stagedPromotions,
  stagedAvailability,
} from '@pad/database';
import type { CreateStagedVenueInput } from '@pad/database';
import {
  verifyPartnerApiKey,
  verifyWebhookSignature,
  requireEntityPermission,
  type PartnerAuthenticatedRequest,
} from '../../middleware/partnerAuth.js';

// Initialize Firestore
initializeFirestore();

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public',
};

// Maximum items per request
const MAX_ITEMS = 100;

// Validation schemas for incoming data
const venueDataSchema = z.object({
  external_id: z.string().max(100).optional(),
  type: z.enum(['restaurant', 'cafe', 'bar', 'food_truck', 'canteen', 'catering', 'retail', 'other']),
  name: z.string().min(1).max(200),
  chain_id: z.string().optional(),
  address: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    postal_code: z.string().min(1).max(20),
    country: z.string().length(2),
    raw_address: z.string().optional(),
  }),
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  opening_hours: z.record(z.array(z.object({ open: z.string(), close: z.string() }))).optional(),
  contact: z
    .object({
      phone: z.string().optional(),
      email: z.string().email().optional(),
      website: z.string().url().optional(),
    })
    .optional(),
  delivery_partners: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const dishDataSchema = z.object({
  external_id: z.string().max(100).optional(),
  venue_external_id: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  name_localized: z.record(z.string()).optional(),
  description: z.string().max(1000),
  description_localized: z.record(z.string()).optional(),
  planted_products: z.array(z.string()).optional(),
  product_text: z.string().optional(), // Raw text for product mapping
  price: z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
  }),
  image_url: z.string().url().optional(),
  dietary_tags: z.array(z.string()).default([]),
  cuisine_type: z.string().optional(),
  availability: z
    .object({
      type: z.enum(['permanent', 'limited', 'seasonal']),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      days_available: z.array(z.string()).optional(),
    })
    .default({ type: 'permanent' }),
  metadata: z.record(z.unknown()).optional(),
});

const promotionDataSchema = z.object({
  external_id: z.string().max(100).optional(),
  venue_external_id: z.string().max(100).optional(),
  chain_id: z.string().optional(),
  promo_type: z.enum(['discount', 'bundle', 'loyalty', 'launch', 'seasonal', 'limited_time']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  product_skus: z.array(z.string()).default([]),
  discount: z
    .object({
      type: z.enum(['percent', 'fixed']),
      value: z.number().positive(),
    })
    .optional(),
  image_url: z.string().url().optional(),
  valid_from: z.string(),
  valid_until: z.string(),
  terms: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const availabilityDataSchema = z.object({
  external_id: z.string().max(100).optional(),
  venue_external_id: z.string().max(100).optional(),
  product_sku: z.string().min(1).max(50),
  in_stock: z.boolean(),
  price: z
    .object({
      regular: z.number().positive(),
      sale: z.number().positive().optional(),
      currency: z.string().length(3),
    })
    .optional(),
  promotion_ref: z.string().optional(),
  shelf_location: z.string().optional(),
  verified_at: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const webhookPayloadSchema = z.object({
  type: z.enum(['venue_update', 'menu_update', 'promotion', 'availability']),
  idempotency_key: z.string().max(100).optional(),
  venues: z.array(venueDataSchema).max(MAX_ITEMS).optional(),
  dishes: z.array(dishDataSchema).max(MAX_ITEMS).optional(),
  promotions: z.array(promotionDataSchema).max(MAX_ITEMS).optional(),
  availability: z.array(availabilityDataSchema).max(MAX_ITEMS).optional(),
});

/**
 * Helper to wrap partner handlers with authentication
 */
async function withPartnerAuth(
  req: Request,
  res: Response,
  handler: (req: PartnerAuthenticatedRequest, res: Response) => Promise<void>,
  options?: { requireSignature?: boolean }
): Promise<void> {
  let authPassed = false;
  const mockNext = () => {
    authPassed = true;
  };

  // Verify API key
  await verifyPartnerApiKey(req as PartnerAuthenticatedRequest, res, mockNext);
  if (!authPassed) return;

  // Optionally verify webhook signature
  if (options?.requireSignature) {
    authPassed = false;
    await verifyWebhookSignature(req as PartnerAuthenticatedRequest, res, mockNext);
    if (!authPassed) return;
  }

  await handler(req as PartnerAuthenticatedRequest, res);
}

/**
 * Partner Webhook Endpoint
 *
 * POST /partner/webhook - Submit data via webhook
 *
 * Headers:
 *   - Authorization: Bearer pad_live_xxxxx
 *   - X-Planted-Signature: HMAC-SHA256 signature (optional but recommended)
 *   - X-Planted-Timestamp: Unix timestamp
 *   - X-Idempotency-Key: Unique key to prevent duplicate processing
 */
export const partnerWebhookHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withPartnerAuth(
    req,
    res,
    async (authReq, authRes) => {
      try {
        if (authReq.method !== 'POST') {
          authRes.status(405).json({ error: 'Method not allowed' });
          return;
        }

        const partner = authReq.partner!;

        // Validate payload
        const validation = webhookPayloadSchema.safeParse(authReq.body);
        if (!validation.success) {
          authRes.status(400).json({
            error: 'Validation failed',
            code: 'INVALID_PAYLOAD',
            details: validation.error.errors,
          });
          return;
        }

        const payload = validation.data;

        // Check idempotency
        const idempotencyKey =
          payload.idempotency_key || (authReq.headers['x-idempotency-key'] as string);
        if (idempotencyKey) {
          const existingBatch = await ingestionBatches.getByIdempotencyKey(
            partner.id,
            idempotencyKey
          );
          if (existingBatch) {
            authRes.status(200).json({
              message: 'Request already processed',
              batch_id: existingBatch.id,
              status: existingBatch.status,
              idempotent: true,
            });
            return;
          }
        }

        // Count total records
        const recordCount =
          (payload.venues?.length || 0) +
          (payload.dishes?.length || 0) +
          (payload.promotions?.length || 0) +
          (payload.availability?.length || 0);

        if (recordCount === 0) {
          authRes.status(400).json({
            error: 'No data provided',
            code: 'EMPTY_PAYLOAD',
            message: 'At least one of venues, dishes, promotions, or availability must be provided',
          });
          return;
        }

        // Create batch record
        const batch = await ingestionBatches.create({
          partner_id: partner.id,
          source: {
            channel: 'webhook',
            idempotency_key: idempotencyKey,
            ip_address: authReq.ip,
            user_agent: authReq.headers['user-agent'],
          },
          records_received: recordCount,
        });

        // Start processing
        await ingestionBatches.startProcessing(batch.id, 'v1.0');

        // Process venues
        const stagedVenueIds: string[] = [];
        if (payload.venues && payload.venues.length > 0) {
          const venueInputs: CreateStagedVenueInput[] = payload.venues.map((v) => ({
            batch_id: batch.id,
            partner_id: partner.id,
            external_id: v.external_id,
            data: {
              type: v.type,
              name: v.name,
              chain_id: v.chain_id,
              address: v.address,
              opening_hours: v.opening_hours
                ? { regular: v.opening_hours }
                : undefined,
              contact: v.contact,
              delivery_partners: v.delivery_partners,
              metadata: v.metadata,
            },
            original_coordinates: v.coordinates,
          }));

          const createdVenues = await stagedVenues.createBatch(venueInputs);
          stagedVenueIds.push(...createdVenues.map((v) => v.id));
        }

        // Process dishes
        const stagedDishIds: string[] = [];
        if (payload.dishes && payload.dishes.length > 0) {
          const dishInputs = payload.dishes.map((d) => ({
            batch_id: batch.id,
            partner_id: partner.id,
            external_id: d.external_id,
            venue_external_id: d.venue_external_id,
            data: {
              name: d.name,
              name_localized: d.name_localized,
              description: d.description,
              description_localized: d.description_localized,
              planted_products: d.planted_products || [],
              price: d.price,
              image_url: d.image_url,
              dietary_tags: d.dietary_tags,
              cuisine_type: d.cuisine_type,
              availability: {
                type: d.availability.type,
                start_date: d.availability.start_date ? new Date(d.availability.start_date) : undefined,
                end_date: d.availability.end_date ? new Date(d.availability.end_date) : undefined,
                days_available: d.availability.days_available,
              },
              metadata: d.metadata,
            },
            product_mapping: d.product_text
              ? {
                  auto_mapped: false,
                  mapping_method: 'manual' as const,
                  mapping_confidence: 0,
                  original_product_text: d.product_text,
                }
              : undefined,
          }));

          const createdDishes = await stagedDishes.createBatch(dishInputs);
          stagedDishIds.push(...createdDishes.map((d) => d.id));
        }

        // Process promotions
        const stagedPromotionIds: string[] = [];
        if (payload.promotions && payload.promotions.length > 0) {
          const promotionInputs = payload.promotions.map((p) => ({
            batch_id: batch.id,
            partner_id: partner.id,
            external_id: p.external_id,
            chain_id: p.chain_id,
            data: {
              promo_type: p.promo_type,
              title: p.title,
              description: p.description,
              product_skus: p.product_skus,
              discount: p.discount,
              image_url: p.image_url,
              valid_from: new Date(p.valid_from),
              valid_until: new Date(p.valid_until),
              terms: p.terms,
              metadata: p.metadata,
            },
          }));

          const createdPromotions = await stagedPromotions.createBatch(promotionInputs);
          stagedPromotionIds.push(...createdPromotions.map((p) => p.id));
        }

        // Process availability
        const stagedAvailabilityIds: string[] = [];
        if (payload.availability && payload.availability.length > 0) {
          const availabilityInputs = payload.availability.map((a) => ({
            batch_id: batch.id,
            partner_id: partner.id,
            external_id: a.external_id,
            data: {
              product_sku: a.product_sku,
              in_stock: a.in_stock,
              price: a.price,
              promotion_ref: a.promotion_ref,
              shelf_location: a.shelf_location,
              verified_at: a.verified_at ? new Date(a.verified_at) : undefined,
              metadata: a.metadata,
            },
          }));

          const createdAvailability = await stagedAvailability.createBatch(availabilityInputs);
          stagedAvailabilityIds.push(...createdAvailability.map((a) => a.id));
        }

        // Update batch with staging results
        const totalStaged =
          stagedVenueIds.length +
          stagedDishIds.length +
          stagedPromotionIds.length +
          stagedAvailabilityIds.length;

        await ingestionBatches.recordStaging(batch.id, {
          staged: totalStaged,
        });

        // Determine if review is needed based on partner config
        const requiresReview =
          partner.config.requires_manual_review ||
          partner.quality_metrics.data_quality_score < partner.config.auto_approve_threshold;

        await ingestionBatches.completeProcessing(batch.id, {
          status: requiresReview ? 'pending_review' : 'approved',
          requiresReview,
        });

        authRes.status(202).json({
          message: 'Data received and staged for processing',
          batch_id: batch.id,
          status: requiresReview ? 'pending_review' : 'approved',
          stats: {
            venues: stagedVenueIds.length,
            dishes: stagedDishIds.length,
            promotions: stagedPromotionIds.length,
            availability: stagedAvailabilityIds.length,
            total: totalStaged,
          },
          staged_ids: {
            venues: stagedVenueIds,
            dishes: stagedDishIds,
            promotions: stagedPromotionIds,
            availability: stagedAvailabilityIds,
          },
        });
      } catch (error) {
        console.error('Webhook processing error:', error);
        authRes.status(500).json({
          error: 'Internal server error',
          code: 'PROCESSING_ERROR',
          message: 'Failed to process webhook data',
        });
      }
    },
    { requireSignature: false } // Signature optional for now, can be made required
  );
});

/**
 * Partner Status Endpoint
 *
 * GET /partner/status - Check API key validity and partner status
 */
export const partnerStatusHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withPartnerAuth(req, res, async (authReq, authRes) => {
    if (authReq.method !== 'GET') {
      authRes.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const partner = authReq.partner!;

    authRes.json({
      status: 'authenticated',
      partner: {
        id: partner.id,
        name: partner.name,
        status: partner.status,
        type: partner.type,
        config: {
          data_format: partner.config.data_format,
          allowed_entity_types: partner.config.allowed_entity_types,
          markets: partner.config.markets,
          auto_approve_threshold: partner.config.auto_approve_threshold,
        },
        rate_limits: partner.rate_limits,
        quality_metrics: {
          total_submissions: partner.quality_metrics.total_submissions,
          data_quality_score: partner.quality_metrics.data_quality_score,
        },
      },
    });
  });
});

/**
 * Partner Batch Status Endpoint
 *
 * GET /partner/batches/:id - Check status of a submitted batch
 */
export const partnerBatchStatusHandler = onRequest(
  functionOptions,
  async (req: Request, res: Response) => {
    await withPartnerAuth(req, res, async (authReq, authRes) => {
      if (authReq.method !== 'GET') {
        authRes.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const pathParts = authReq.path.split('/').filter(Boolean);
      const batchId = pathParts[pathParts.length - 1];

      if (!batchId) {
        authRes.status(400).json({ error: 'Batch ID required' });
        return;
      }

      const batch = await ingestionBatches.getById(batchId);

      if (!batch) {
        authRes.status(404).json({ error: 'Batch not found' });
        return;
      }

      // Ensure partner can only see their own batches
      if (batch.partner_id !== authReq.partner!.id) {
        authRes.status(403).json({ error: 'Not authorized to view this batch' });
        return;
      }

      authRes.json({
        id: batch.id,
        status: batch.status,
        received_at: batch.received_at.toISOString(),
        stats: batch.stats,
        processing: {
          started_at: batch.processing.started_at?.toISOString(),
          completed_at: batch.processing.completed_at?.toISOString(),
        },
        review: batch.review
          ? {
              required: batch.review.required,
              decision: batch.review.decision,
              reviewed_at: batch.review.reviewed_at?.toISOString(),
            }
          : undefined,
      });
    });
  }
);
