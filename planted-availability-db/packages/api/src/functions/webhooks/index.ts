/**
 * Webhook Endpoints
 *
 * Handles incoming data from partners, email forwarding services,
 * and other automated data sources.
 */

import type { Request, Response } from 'express';
import { getFirestore, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  parseWebhookPayload,
  parseNaturalLanguage,
  validatePartnerAuth,
  type EmailPayload,
} from '../../services/webhook-parser.js';

const db = getFirestore();

// Maximum items per webhook request to prevent abuse
const MAX_ITEMS_PER_REQUEST = 100;

// Webhook payload validation schema
const webhookPayloadSchema = z.object({
  type: z.enum(['venue_update', 'menu_update', 'promotion', 'availability']),
  partner_id: z.string().min(1).max(100).optional(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
});

// Email payload validation schema
const emailPayloadSchema = z.object({
  from: z.string().email().max(255),
  subject: z.string().max(1000),
  body: z.string().max(100000), // 100KB max
  attachments: z.array(z.object({
    filename: z.string().max(255),
    content_type: z.string().max(100),
    data: z.string().optional(), // Base64 data, optional
  })).max(10).optional(),
});

// Partner secrets (in production, load from Firebase config or Secret Manager)
const KNOWN_PARTNERS = new Map<string, string>([
  // Add partner credentials here or load from environment
  // ['partner-id', 'partner-secret']
]);

// Load partner credentials from environment if available
if (process.env.PARTNER_CREDENTIALS) {
  try {
    const creds = JSON.parse(process.env.PARTNER_CREDENTIALS) as Record<string, string>;
    Object.entries(creds).forEach(([id, secret]) => {
      KNOWN_PARTNERS.set(id, secret);
    });
  } catch {
    console.warn('Failed to parse PARTNER_CREDENTIALS environment variable');
  }
}

/**
 * POST /api/webhooks/partner
 *
 * Receives structured data updates from partners.
 * Requires X-Partner-ID and X-Partner-Secret headers.
 */
export async function partnerWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    // Validate partner authentication
    const partnerId = req.headers['x-partner-id'] as string;
    const partnerSecret = req.headers['x-partner-secret'] as string;

    if (!partnerId || !partnerSecret) {
      res.status(401).json({
        error: 'Missing partner credentials',
        message: 'X-Partner-ID and X-Partner-Secret headers are required',
      });
      return;
    }

    // ALWAYS validate partner credentials - no dev mode bypass
    // In development, add test partners to PARTNER_CREDENTIALS env var
    if (!validatePartnerAuth(partnerId, partnerSecret, KNOWN_PARTNERS)) {
      console.warn(`Invalid partner auth attempt: ${partnerId}`);
      res.status(403).json({
        error: 'Invalid partner credentials',
      });
      return;
    }

    // Validate payload schema with Zod
    const payloadValidation = webhookPayloadSchema.safeParse(req.body);
    if (!payloadValidation.success) {
      res.status(400).json({
        error: 'Invalid payload schema',
        details: payloadValidation.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    const payload = {
      type: payloadValidation.data.type,
      data: payloadValidation.data.data,
      partner_id: payloadValidation.data.partner_id || partnerId,
    };

    const result = parseWebhookPayload(payload);

    if (!result.success) {
      res.status(400).json({
        error: 'Parse error',
        errors: result.errors,
      });
      return;
    }

    // Validate item counts to prevent abuse
    const totalItems =
      (result.data?.venues?.length || 0) +
      (result.data?.dishes?.length || 0) +
      (result.data?.promotions?.length || 0);

    if (totalItems > MAX_ITEMS_PER_REQUEST) {
      res.status(400).json({
        error: 'Too many items',
        message: `Maximum ${MAX_ITEMS_PER_REQUEST} items per request, got ${totalItems}`,
      });
      return;
    }

    // Store the parsed data using batched writes for atomicity
    const stats = {
      venues_processed: 0,
      dishes_processed: 0,
      promotions_processed: 0,
    };

    const batch: WriteBatch = db.batch();
    const now = Timestamp.now();

    // Process venues
    if (result.data?.venues && result.data.venues.length > 0) {
      for (const venue of result.data.venues) {
        const docRef = db.collection('webhook_staging').doc();
        batch.set(docRef, {
          type: 'venue',
          partner_id: partnerId,
          data: venue,
          confidence: result.confidence,
          received_at: now,
          status: 'pending_review',
        });
        stats.venues_processed++;
      }
    }

    // Process dishes
    if (result.data?.dishes && result.data.dishes.length > 0) {
      for (const dish of result.data.dishes) {
        const docRef = db.collection('webhook_staging').doc();
        batch.set(docRef, {
          type: 'dish',
          partner_id: partnerId,
          data: dish,
          confidence: result.confidence,
          received_at: now,
          status: 'pending_review',
        });
        stats.dishes_processed++;
      }
    }

    // Process promotions
    if (result.data?.promotions && result.data.promotions.length > 0) {
      for (const promo of result.data.promotions) {
        const docRef = db.collection('webhook_staging').doc();
        batch.set(docRef, {
          type: 'promotion',
          partner_id: partnerId,
          data: promo,
          confidence: result.confidence,
          received_at: now,
          status: 'pending_review',
        });
        stats.promotions_processed++;
      }
    }

    // Add log entry to batch
    const logRef = db.collection('webhook_logs').doc();
    batch.set(logRef, {
      partner_id: partnerId,
      type: payload.type,
      received_at: now,
      stats,
      warnings: result.warnings,
    });

    // Commit all writes atomically
    await batch.commit();

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      stats,
      warnings: result.warnings,
    });
  } catch (error) {
    // Log error details server-side only
    console.error('Partner webhook error:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * POST /api/webhooks/email
 *
 * Receives parsed emails from email forwarding services (Zapier, Make.com, etc.)
 * Uses natural language parsing to extract venue/dish/promotion data.
 */
export async function emailWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    // Validate payload schema with Zod
    const payloadValidation = emailPayloadSchema.safeParse(req.body);
    if (!payloadValidation.success) {
      res.status(400).json({
        error: 'Invalid email payload',
        details: payloadValidation.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    const payload = payloadValidation.data;

    // Combine subject and body for parsing
    const textToParse = `${payload.subject}\n\n${payload.body}`;

    // Parse using natural language parser
    const result = parseNaturalLanguage(textToParse);

    // Store in staging for review (emails need manual verification)
    const stagingDoc = await db.collection('email_staging').add({
      from: payload.from,
      subject: payload.subject,
      body: payload.body.slice(0, 50000), // Limit stored body size
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content_type: a.content_type,
        // Don't store actual attachment data in Firestore
        has_data: !!a.data,
      })),
      parsed_data: result.data,
      confidence: result.confidence,
      warnings: result.warnings,
      received_at: Timestamp.now(),
      status: 'pending_review',
    });

    // Log for analytics
    await db.collection('webhook_logs').add({
      type: 'email',
      email_from: payload.from,
      received_at: Timestamp.now(),
      staging_id: stagingDoc.id,
      confidence: result.confidence,
    });

    // Return 202 Accepted since this is queued for review
    res.status(202).json({
      success: true,
      message: 'Email received and queued for review',
      staging_id: stagingDoc.id,
      parsed: {
        venues_found: result.data?.venues?.length || 0,
        dishes_found: result.data?.dishes?.length || 0,
        promotions_found: result.data?.promotions?.length || 0,
        confidence: result.confidence,
      },
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Email webhook error:', error instanceof Error ? error.message : error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * GET /api/webhooks/staging
 *
 * Admin endpoint to view items in webhook staging queue.
 */
export async function webhookStagingHandler(req: Request, res: Response): Promise<void> {
  try {
    const status = (req.query.status as string) || 'pending_review';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const snapshot = await db
      .collection('webhook_staging')
      .where('status', '==', status)
      .orderBy('received_at', 'desc')
      .limit(limit)
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      received_at: doc.data().received_at?.toDate?.() || doc.data().received_at,
    }));

    res.status(200).json({
      items,
      count: items.length,
      status,
    });
  } catch (error) {
    console.error('Webhook staging error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * POST /api/webhooks/staging/:id/approve
 *
 * Admin endpoint to approve a staging item and move it to production.
 */
export async function approveWebhookItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const stagingRef = db.collection('webhook_staging').doc(id);
    const stagingDoc = await stagingRef.get();

    if (!stagingDoc.exists) {
      res.status(404).json({ error: 'Staging item not found' });
      return;
    }

    const data = stagingDoc.data()!;
    const type = data.type as 'venue' | 'dish' | 'promotion';

    // Move to appropriate collection based on type
    const targetCollection = type === 'venue' ? 'venues' : type === 'dish' ? 'dishes' : 'promotions';

    await db.collection(targetCollection).add({
      ...data.data,
      source: {
        type: 'partner_feed',
        webhook_staging_id: id,
        partner_id: data.partner_id,
      },
      created_at: Timestamp.now(),
      last_verified: Timestamp.now(),
      status: 'active',
    });

    // Update staging status
    await stagingRef.update({
      status: 'approved',
      approved_at: Timestamp.now(),
    });

    res.status(200).json({
      success: true,
      message: `${type} approved and added to ${targetCollection}`,
    });
  } catch (error) {
    console.error('Approve webhook item error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * POST /api/webhooks/staging/:id/reject
 *
 * Admin endpoint to reject a staging item.
 */
export async function rejectWebhookItemHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const stagingRef = db.collection('webhook_staging').doc(id);
    const stagingDoc = await stagingRef.get();

    if (!stagingDoc.exists) {
      res.status(404).json({ error: 'Staging item not found' });
      return;
    }

    await stagingRef.update({
      status: 'rejected',
      rejected_at: Timestamp.now(),
      rejection_reason: reason || 'No reason provided',
    });

    res.status(200).json({
      success: true,
      message: 'Item rejected',
    });
  } catch (error) {
    console.error('Reject webhook item error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}
