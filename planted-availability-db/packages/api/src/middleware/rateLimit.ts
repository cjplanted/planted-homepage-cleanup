import type { Request, Response, NextFunction } from 'express';
import { getFirestore } from '@pad/database';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyGenerator?: (req: Request) => string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,    // 100 requests per minute
};

/**
 * Simple rate limiter using Firestore
 * For production, consider using Redis or Cloud Memorystore
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests, keyGenerator } = { ...defaultConfig, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Generate rate limit key (IP-based by default)
      const key = keyGenerator
        ? keyGenerator(req)
        : req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';

      const db = getFirestore();
      const rateLimitRef = db.collection('rate_limits').doc(key);

      // Use transaction to atomically check and update
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(rateLimitRef);
        const now = Date.now();

        if (!doc.exists) {
          // First request from this key
          transaction.set(rateLimitRef, {
            count: 1,
            windowStart: now,
            expiresAt: now + windowMs,
          });
          return { allowed: true, remaining: maxRequests - 1 };
        }

        const data = doc.data()!;
        const windowStart = data.windowStart as number;

        // Check if window has expired
        if (now - windowStart > windowMs) {
          // Reset window
          transaction.set(rateLimitRef, {
            count: 1,
            windowStart: now,
            expiresAt: now + windowMs,
          });
          return { allowed: true, remaining: maxRequests - 1 };
        }

        const currentCount = data.count as number;

        if (currentCount >= maxRequests) {
          // Rate limit exceeded
          const resetTime = windowStart + windowMs;
          return {
            allowed: false,
            remaining: 0,
            resetTime,
          };
        }

        // Increment count
        transaction.update(rateLimitRef, {
          count: currentCount + 1,
        });

        return {
          allowed: true,
          remaining: maxRequests - currentCount - 1,
        };
      });

      // Set rate limit headers
      res.set('X-RateLimit-Limit', maxRequests.toString());
      res.set('X-RateLimit-Remaining', result.remaining.toString());

      if (!result.allowed) {
        res.set('Retry-After', Math.ceil((result.resetTime! - Date.now()) / 1000).toString());
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((result.resetTime! - Date.now()) / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      // If rate limiting fails, allow the request but log the error
      console.error('Rate limiting error:', error);
      next();
    }
  };
}

// Pre-configured rate limiters
export const publicApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 60,       // 60 requests per minute
});

export const adminApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 200,      // 200 requests per minute
});

export const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,       // 10 requests per minute (for expensive operations)
});
