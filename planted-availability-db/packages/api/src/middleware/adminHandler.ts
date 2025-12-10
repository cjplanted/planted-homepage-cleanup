/**
 * Admin Handler Factory
 *
 * Creates Firebase Cloud Functions with proper CORS handling and admin authentication.
 * This ensures CORS headers are set BEFORE any auth checks, fixing the CORS error
 * that occurs when auth middleware sends 401/403 responses without CORS headers.
 */

import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { verifyAuth, requireAdmin, type AuthenticatedRequest } from './auth.js';

// Allowed origins for CORS
const ALLOWED_ORIGINS: (string | RegExp)[] = [
  // Production
  'https://planted.com',
  'https://www.planted.com',
  'https://get-planted-db.web.app',
  'https://get-planted-db.firebaseapp.com',
  /^https:\/\/.*\.planted\.com$/,
  // External
  'https://cgjen-box.github.io',
  // Development
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4000',
];

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Allow requests without origin (mobile, curl)
  return ALLOWED_ORIGINS.some(allowed => {
    if (allowed instanceof RegExp) return allowed.test(origin);
    return allowed === origin;
  });
}

/**
 * Set CORS headers on the response
 */
function setCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin;

  if (origin && isOriginAllowed(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // For requests without origin (mobile apps, curl)
    res.set('Access-Control-Allow-Origin', '*');
  }
  // If origin is not allowed, don't set the header (browser will block)

  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Admin handler function type
 */
export type AdminHandler = (req: AuthenticatedRequest, res: Response) => Promise<void>;

/**
 * Options for creating an admin handler
 */
export interface AdminHandlerOptions extends Omit<HttpsOptions, 'cors'> {
  /** Allowed HTTP methods. Defaults to ['GET', 'POST'] */
  allowedMethods?: string[];
  /** Skip admin role check (only verify authentication) */
  skipAdminCheck?: boolean;
}

/**
 * Creates a Firebase Cloud Function with proper CORS and admin authentication.
 *
 * This handles:
 * 1. OPTIONS preflight requests with CORS headers
 * 2. CORS headers on ALL responses (including auth errors)
 * 3. Firebase auth token verification
 * 4. Admin role verification
 * 5. HTTP method validation
 * 6. Error handling
 *
 * @example
 * ```typescript
 * export const myHandler = createAdminHandler(
 *   async (req, res) => {
 *     // Handler logic - req.user is guaranteed to be authenticated admin
 *     res.status(200).json({ data: 'success' });
 *   },
 *   { allowedMethods: ['GET'] }
 * );
 * ```
 */
export function createAdminHandler(
  handler: AdminHandler,
  options: AdminHandlerOptions = {}
) {
  const {
    allowedMethods = ['GET', 'POST'],
    skipAdminCheck = false,
    ...functionOptions
  } = options;

  const httpOptions: HttpsOptions = {
    region: 'europe-west6',
    invoker: 'public',
    ...functionOptions,
    // We handle CORS ourselves to ensure headers are set before auth
    cors: false,
  };

  return onRequest(httpOptions, async (req: Request, res: Response) => {
    // Step 1: Always set CORS headers FIRST (before any other processing)
    setCorsHeaders(req, res);

    // Step 2: Handle OPTIONS preflight requests immediately
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Step 3: Validate HTTP method
    if (!allowedMethods.includes(req.method)) {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Step 4: Verify authentication (Firebase ID token)
    let authPassed = false;
    const mockNext = () => { authPassed = true; };

    await verifyAuth(req as AuthenticatedRequest, res, mockNext);
    if (!authPassed) {
      // verifyAuth already sent the response with proper error message
      // CORS headers are already set, so browser won't block the 401
      return;
    }

    // Step 5: Verify admin role (unless skipped)
    if (!skipAdminCheck) {
      authPassed = false;
      await requireAdmin(req as AuthenticatedRequest, res, mockNext);
      if (!authPassed) {
        // requireAdmin already sent the response
        return;
      }
    }

    // Step 6: Run the actual handler with error handling
    try {
      await handler(req as AuthenticatedRequest, res);
    } catch (error) {
      console.error('Admin handler error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? message : undefined,
      });
    }
  });
}

/**
 * Creates an admin handler for Server-Sent Events (SSE) streaming.
 * Similar to createAdminHandler but with SSE-specific configuration.
 */
export function createAdminSSEHandler(
  handler: AdminHandler,
  options: AdminHandlerOptions = {}
) {
  const {
    allowedMethods = ['GET'],
    skipAdminCheck = false,
    timeoutSeconds = 540, // 9 minutes for SSE
    ...functionOptions
  } = options;

  const httpOptions: HttpsOptions = {
    region: 'europe-west6',
    invoker: 'public',
    timeoutSeconds,
    ...functionOptions,
    cors: false,
  };

  return onRequest(httpOptions, async (req: Request, res: Response) => {
    // Set CORS headers for SSE
    setCorsHeaders(req, res);

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Validate method
    if (!allowedMethods.includes(req.method)) {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Verify auth
    let authPassed = false;
    const mockNext = () => { authPassed = true; };

    await verifyAuth(req as AuthenticatedRequest, res, mockNext);
    if (!authPassed) return;

    if (!skipAdminCheck) {
      authPassed = false;
      await requireAdmin(req as AuthenticatedRequest, res, mockNext);
      if (!authPassed) return;
    }

    // Set SSE headers
    res.set('Content-Type', 'text/event-stream');
    res.set('Cache-Control', 'no-cache');
    res.set('Connection', 'keep-alive');

    try {
      await handler(req as AuthenticatedRequest, res);
    } catch (error) {
      console.error('Admin SSE handler error:', error);
      // For SSE, send error as event
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
      res.end();
    }
  });
}
