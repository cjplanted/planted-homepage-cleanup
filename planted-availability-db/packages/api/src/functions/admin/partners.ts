/**
 * Partner Management API
 *
 * Admin endpoints for managing partner accounts, credentials, and monitoring.
 * All endpoints require admin authentication.
 */

import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { initializeFirestore, partners, ingestionBatches } from '@pad/database';
import type { CreatePartnerInput, UpdatePartnerInput } from '@pad/core';
import { verifyAuth, requireAdmin, type AuthenticatedRequest } from '../../middleware/auth.js';

// Initialize Firestore
initializeFirestore();

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public',
};

// Validation schemas
const createPartnerSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['chain', 'independent', 'distributor', 'aggregator']),
  status: z.enum(['onboarding', 'active', 'suspended', 'inactive']).optional(),
  contact: z.object({
    primary_name: z.string().min(1).max(100),
    primary_email: z.string().email(),
    technical_email: z.string().email().optional(),
    phone: z.string().max(30).optional(),
  }),
  config: z.object({
    data_format: z.enum(['planted_standard', 'custom']).default('planted_standard'),
    transformer_id: z.string().optional(),
    auto_approve_threshold: z.number().min(0).max(100).default(85),
    requires_manual_review: z.boolean().default(false),
    allowed_entity_types: z
      .array(z.enum(['venue', 'dish', 'promotion', 'availability']))
      .default(['venue', 'dish', 'promotion']),
    markets: z.array(z.string().length(2)).default([]),
    callback_url: z.string().url().optional(),
  }),
  rate_limits: z
    .object({
      requests_per_hour: z.number().min(1).max(10000).default(1000),
      requests_per_day: z.number().min(1).max(100000).default(10000),
    })
    .optional(),
});

const updatePartnerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  type: z.enum(['chain', 'independent', 'distributor', 'aggregator']).optional(),
  status: z.enum(['onboarding', 'active', 'suspended', 'inactive']).optional(),
  contact: z
    .object({
      primary_name: z.string().min(1).max(100).optional(),
      primary_email: z.string().email().optional(),
      technical_email: z.string().email().optional().nullable(),
      phone: z.string().max(30).optional().nullable(),
    })
    .optional(),
  config: z
    .object({
      data_format: z.enum(['planted_standard', 'custom']).optional(),
      transformer_id: z.string().optional().nullable(),
      auto_approve_threshold: z.number().min(0).max(100).optional(),
      requires_manual_review: z.boolean().optional(),
      allowed_entity_types: z
        .array(z.enum(['venue', 'dish', 'promotion', 'availability']))
        .optional(),
      markets: z.array(z.string().length(2)).optional(),
      callback_url: z.string().url().optional().nullable(),
    })
    .optional(),
  rate_limits: z
    .object({
      requests_per_hour: z.number().min(1).max(10000).optional(),
      requests_per_day: z.number().min(1).max(100000).optional(),
    })
    .optional(),
});

/**
 * Helper to wrap admin handlers with authentication
 */
async function withAdminAuth(
  req: Request,
  res: Response,
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>
): Promise<void> {
  let authPassed = false;
  const mockNext = () => {
    authPassed = true;
  };

  await verifyAuth(req as AuthenticatedRequest, res, mockNext);
  if (!authPassed) return;

  authPassed = false;
  await requireAdmin(req as AuthenticatedRequest, res, mockNext);
  if (!authPassed) return;

  await handler(req as AuthenticatedRequest, res);
}

/**
 * Partner CRUD operations
 *
 * GET /admin/partners - List all partners
 * GET /admin/partners/:id - Get partner by ID
 * POST /admin/partners - Create new partner (returns API key once)
 * PATCH /admin/partners/:id - Update partner
 * POST /admin/partners/:id/activate - Activate partner
 * POST /admin/partners/:id/suspend - Suspend partner
 * POST /admin/partners/:id/rotate-credentials - Rotate API credentials
 */
export const adminPartnersHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    try {
      const pathParts = authReq.path.split('/').filter(Boolean);
      // Path format: /admin/partners or /admin/partners/:id or /admin/partners/:id/action
      const partnerId = pathParts.length >= 3 ? pathParts[2] : undefined;
      const action = pathParts.length >= 4 ? pathParts[3] : undefined;

      switch (authReq.method) {
        case 'GET': {
          if (partnerId) {
            // Get single partner
            const partner = await partners.getById(partnerId);
            if (!partner) {
              authRes.status(404).json({ error: 'Partner not found' });
              return;
            }
            authRes.json(partner);
          } else {
            // List partners
            const limit = parseInt(authReq.query.limit as string, 10) || 50;
            const offset = parseInt(authReq.query.offset as string, 10) || 0;
            const status = authReq.query.status as string | undefined;
            const type = authReq.query.type as string | undefined;

            const partnersList = await partners.list({
              status: status as 'onboarding' | 'active' | 'suspended' | 'inactive' | undefined,
              type: type as 'chain' | 'independent' | 'distributor' | 'aggregator' | undefined,
              limit,
              offset,
            });

            const stats = await partners.getStats();
            authRes.json({
              partners: partnersList,
              total: stats.total,
              stats,
            });
          }
          break;
        }

        case 'POST': {
          // Handle actions for existing partners
          if (partnerId && action) {
            switch (action) {
              case 'activate': {
                const partner = await partners.activate(partnerId);
                authRes.json({
                  message: 'Partner activated successfully',
                  partner,
                });
                break;
              }

              case 'suspend': {
                const reason = authReq.body.reason as string | undefined;
                const partner = await partners.suspend(partnerId, reason);
                authRes.json({
                  message: 'Partner suspended',
                  partner,
                });
                break;
              }

              case 'rotate-credentials': {
                const result = await partners.rotateCredentials(partnerId);
                authRes.json({
                  message: 'Credentials rotated successfully',
                  api_key: result.apiKey,
                  webhook_secret: result.webhookSecret,
                  old_credentials_valid_until: result.oldCredentialsValidUntil.toISOString(),
                  warning:
                    'Store these credentials securely. The API key will not be shown again.',
                });
                break;
              }

              case 'email-whitelist': {
                const domains = authReq.body.domains as string[] | undefined;
                if (!domains || !Array.isArray(domains)) {
                  authRes.status(400).json({ error: 'domains array required' });
                  return;
                }
                await partners.updateEmailWhitelist(partnerId, domains);
                authRes.json({
                  message: 'Email whitelist updated',
                  domains,
                });
                break;
              }

              default:
                authRes.status(404).json({ error: `Unknown action: ${action}` });
            }
            return;
          }

          // Create new partner
          const validation = createPartnerSchema.safeParse(authReq.body);
          if (!validation.success) {
            authRes.status(400).json({
              error: 'Validation failed',
              details: validation.error.errors,
            });
            return;
          }

          const input: CreatePartnerInput = {
            name: validation.data.name,
            type: validation.data.type,
            status: validation.data.status,
            contact: validation.data.contact,
            config: validation.data.config,
            rate_limits: validation.data.rate_limits,
          };

          const result = await partners.create(input);

          authRes.status(201).json({
            message: 'Partner created successfully',
            partner: result.partner,
            credentials: {
              api_key: result.apiKey,
              webhook_secret: result.webhookSecret,
              warning:
                'Store these credentials securely. They will only be shown once. ' +
                'The API key is used in the Authorization header: Bearer <api_key>. ' +
                'The webhook secret is used to sign payloads with HMAC-SHA256.',
            },
            integration_docs: {
              webhook_url: 'https://europe-west6-planted-availability.cloudfunctions.net/partnerWebhook',
              signature_header: 'X-Planted-Signature',
              timestamp_header: 'X-Planted-Timestamp',
              example: `curl -X POST <webhook_url> \\
  -H "Authorization: Bearer ${result.apiKey}" \\
  -H "Content-Type: application/json" \\
  -H "X-Planted-Timestamp: $(date +%s)" \\
  -H "X-Planted-Signature: <hmac_sha256_signature>" \\
  -d '{"type": "venue_update", "data": {...}}'`,
            },
          });
          break;
        }

        case 'PATCH': {
          if (!partnerId) {
            authRes.status(400).json({ error: 'Partner ID required' });
            return;
          }

          const validation = updatePartnerSchema.safeParse(authReq.body);
          if (!validation.success) {
            authRes.status(400).json({
              error: 'Validation failed',
              details: validation.error.errors,
            });
            return;
          }

          const partner = await partners.update(partnerId, validation.data as UpdatePartnerInput);
          authRes.json(partner);
          break;
        }

        case 'DELETE': {
          // For safety, we don't delete partners - just suspend them
          authRes.status(400).json({
            error: 'Partners cannot be deleted. Use POST /admin/partners/:id/suspend instead.',
          });
          break;
        }

        default:
          authRes.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      console.error('Partner management error:', error);
      authRes.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
});

/**
 * Partner Ingestion Batches
 *
 * GET /admin/partners/:id/batches - Get batches for a partner
 * GET /admin/batches - List all recent batches
 * GET /admin/batches/:id - Get batch details
 * GET /admin/batches/pending-review - Get batches needing review
 */
export const adminBatchesHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    try {
      const pathParts = authReq.path.split('/').filter(Boolean);
      // Path format: /admin/batches or /admin/batches/:id or /admin/batches/pending-review
      const batchIdOrAction = pathParts.length >= 3 ? pathParts[2] : undefined;

      switch (authReq.method) {
        case 'GET': {
          if (batchIdOrAction === 'pending-review') {
            const limit = parseInt(authReq.query.limit as string, 10) || 50;
            const batches = await ingestionBatches.getPendingReview(limit);
            authRes.json({ batches, total: batches.length });
            return;
          }

          if (batchIdOrAction === 'stats') {
            const since = authReq.query.since
              ? new Date(authReq.query.since as string)
              : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
            const stats = await ingestionBatches.getStats(since);
            authRes.json(stats);
            return;
          }

          if (batchIdOrAction) {
            // Get single batch
            const batch = await ingestionBatches.getById(batchIdOrAction);
            if (!batch) {
              authRes.status(404).json({ error: 'Batch not found' });
              return;
            }
            authRes.json(batch);
          } else {
            // List batches
            const limit = parseInt(authReq.query.limit as string, 10) || 50;
            const offset = parseInt(authReq.query.offset as string, 10) || 0;
            const partnerId = authReq.query.partner_id as string | undefined;
            const status = authReq.query.status as string | undefined;
            const channel = authReq.query.channel as string | undefined;

            const batches = await ingestionBatches.query({
              partner_id: partnerId,
              status: status as 'received' | 'validating' | 'approved' | undefined,
              channel: channel as 'webhook' | 'email' | 'file_upload' | 'agent' | 'manual' | undefined,
              limit,
              offset,
            });

            authRes.json({ batches, total: batches.length });
          }
          break;
        }

        default:
          authRes.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      console.error('Batch management error:', error);
      authRes.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
});
