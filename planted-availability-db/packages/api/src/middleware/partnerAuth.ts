/**
 * Partner Authentication Middleware
 *
 * Handles API key authentication and HMAC signature verification for partner webhooks.
 * Partners receive API keys during onboarding and must sign webhook payloads with HMAC.
 */

import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import type { Partner } from '@pad/core';
import { partners } from '@pad/database';

export interface PartnerAuthenticatedRequest extends Request {
  partner?: Partner;
  rawBody?: string;
}

// Rate limit tracking (in-memory for simplicity - consider Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Verify API key from Authorization header
 * Format: Authorization: Bearer pad_live_xxxxx
 */
export async function verifyPartnerApiKey(
  req: PartnerAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_API_KEY',
      message: 'Missing or invalid Authorization header. Expected: Bearer pad_live_xxxxx',
    });
    return;
  }

  const apiKey = authHeader.split('Bearer ')[1];

  // Validate API key format
  if (!apiKey.startsWith('pad_live_') || apiKey.length < 20) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_API_KEY_FORMAT',
      message: 'Invalid API key format',
    });
    return;
  }

  try {
    const partner = await partners.getByApiKey(apiKey);

    if (!partner) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      });
      return;
    }

    // Check partner status
    if (partner.status !== 'active') {
      res.status(403).json({
        error: 'Forbidden',
        code: 'PARTNER_NOT_ACTIVE',
        message: `Partner account is ${partner.status}. Contact support for assistance.`,
      });
      return;
    }

    // Check rate limits
    const rateLimitKey = `partner:${partner.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, partner.rate_limits);

    if (!rateLimit.allowed) {
      res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        retry_after: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      });
      return;
    }

    req.partner = partner;
    next();
  } catch (error) {
    console.error('Partner auth error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
    });
  }
}

/**
 * Verify webhook signature using HMAC-SHA256
 * Headers required:
 *   - X-Planted-Signature: HMAC signature of timestamp.payload
 *   - X-Planted-Timestamp: Unix timestamp (prevents replay attacks)
 */
export async function verifyWebhookSignature(
  req: PartnerAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const signature = req.headers['x-planted-signature'] as string;
  const timestamp = req.headers['x-planted-timestamp'] as string;

  if (!signature || !timestamp) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_SIGNATURE',
      message: 'Missing X-Planted-Signature or X-Planted-Timestamp header',
    });
    return;
  }

  // Verify timestamp is within 5 minutes (prevent replay attacks)
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  const FIVE_MINUTES = 300;

  if (isNaN(timestampNum) || Math.abs(now - timestampNum) > FIVE_MINUTES) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_TIMESTAMP',
      message: 'Request timestamp is too old or invalid. Use current Unix timestamp.',
    });
    return;
  }

  // Partner must already be authenticated
  if (!req.partner) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'NO_PARTNER',
      message: 'Partner authentication required before signature verification',
    });
    return;
  }

  // Get raw body for signature verification
  const rawBody = req.rawBody || JSON.stringify(req.body);

  try {
    const isValid = await partners.verifyWebhookSignature(
      req.partner.id,
      rawBody,
      signature,
      timestamp
    );

    if (!isValid) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'INVALID_SIGNATURE',
        message: 'Webhook signature verification failed',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      code: 'SIGNATURE_VERIFICATION_ERROR',
      message: 'Signature verification failed',
    });
  }
}

/**
 * Middleware to capture raw body for signature verification
 * Must be used before body-parser for JSON
 */
export function captureRawBody(
  req: PartnerAuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  let data = '';
  req.setEncoding('utf8');

  req.on('data', (chunk: string) => {
    data += chunk;
  });

  req.on('end', () => {
    req.rawBody = data;
    if (data) {
      try {
        req.body = JSON.parse(data);
      } catch {
        // Body parsing will be handled by json middleware
      }
    }
    next();
  });
}

/**
 * Check if partner is allowed to submit specific entity types
 */
export function requireEntityPermission(entityType: 'venue' | 'dish' | 'promotion' | 'availability') {
  return (req: PartnerAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.partner) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_PARTNER',
        message: 'Partner authentication required',
      });
      return;
    }

    const allowedTypes = req.partner.config.allowed_entity_types;
    if (!allowedTypes.includes(entityType)) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'ENTITY_TYPE_NOT_ALLOWED',
        message: `Partner is not authorized to submit ${entityType} data`,
      });
      return;
    }

    next();
  };
}

/**
 * Check if partner is allowed to submit data for a specific market
 */
export function requireMarketPermission(getMarket: (req: Request) => string | undefined) {
  return (req: PartnerAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.partner) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_PARTNER',
        message: 'Partner authentication required',
      });
      return;
    }

    const market = getMarket(req);
    const allowedMarkets = req.partner.config.markets;

    // If partner has no market restrictions, allow all
    if (allowedMarkets.length === 0) {
      next();
      return;
    }

    // If no market specified in request, allow (will be validated later)
    if (!market) {
      next();
      return;
    }

    if (!allowedMarkets.includes(market.toUpperCase())) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'MARKET_NOT_ALLOWED',
        message: `Partner is not authorized to submit data for market: ${market}`,
      });
      return;
    }

    next();
  };
}

/**
 * Simple in-memory rate limit checker
 */
function checkRateLimit(
  key: string,
  limits: { requests_per_hour: number; requests_per_day: number }
): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  let entry = rateLimitMap.get(key);

  // Reset if expired
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + hourMs };
    rateLimitMap.set(key, entry);
  }

  // Check limit
  if (entry.count >= limits.requests_per_hour) {
    return { allowed: false, resetAt: entry.resetAt };
  }

  // Increment and allow
  entry.count++;
  return { allowed: true, resetAt: entry.resetAt };
}

/**
 * Generate HMAC signature for testing/documentation
 */
export function generateSignature(payload: string, secret: string, timestamp: string): string {
  const signedPayload = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
}
