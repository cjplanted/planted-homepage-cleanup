/**
 * Caching Middleware & Utilities
 *
 * Provides in-memory caching, CDN cache headers, and cache invalidation.
 * Uses a simple LRU cache for serverless environments.
 */

import type { Request, Response, NextFunction } from 'express';

// Simple LRU Cache implementation for serverless
class LRUCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Delete entries matching a pattern
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

// Global cache instance
const apiCache = new LRUCache<any>(1000);

/**
 * Cache configuration by endpoint type
 */
export const CacheConfig = {
  // Static data - cache for 1 hour
  STATIC: {
    ttl: 3600,
    cdnMaxAge: 3600,
    staleWhileRevalidate: 86400,
  },
  // Semi-static data - cache for 5 minutes
  SEMI_STATIC: {
    ttl: 300,
    cdnMaxAge: 300,
    staleWhileRevalidate: 3600,
  },
  // Dynamic data - cache for 1 minute
  DYNAMIC: {
    ttl: 60,
    cdnMaxAge: 60,
    staleWhileRevalidate: 300,
  },
  // Real-time data - no caching
  REALTIME: {
    ttl: 0,
    cdnMaxAge: 0,
    staleWhileRevalidate: 0,
  },
};

/**
 * Generate cache key from request
 */
export function generateCacheKey(req: Request): string {
  const parts = [
    req.method,
    req.path,
    JSON.stringify(req.query),
  ];
  return parts.join(':');
}

/**
 * Set CDN cache headers
 */
export function setCacheHeaders(
  res: Response,
  config: typeof CacheConfig.STATIC
): void {
  if (config.cdnMaxAge === 0) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return;
  }

  const directives = [
    'public',
    `max-age=${config.cdnMaxAge}`,
    `s-maxage=${config.cdnMaxAge}`,
  ];

  if (config.staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  res.setHeader('Cache-Control', directives.join(', '));
}

/**
 * Caching middleware factory
 */
export function cacheMiddleware(config: typeof CacheConfig.STATIC) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if no caching configured
    if (config.ttl === 0) {
      setCacheHeaders(res, config);
      return next();
    }

    const cacheKey = generateCacheKey(req);
    const cached = apiCache.get(cacheKey);

    if (cached) {
      setCacheHeaders(res, config);
      res.setHeader('X-Cache', 'HIT');
      res.json(cached);
      return;
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to cache the response
    res.json = (body: any) => {
      apiCache.set(cacheKey, body, config.ttl);
      setCacheHeaders(res, config);
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

/**
 * Cache invalidation utilities
 */
export const CacheInvalidation = {
  /**
   * Invalidate all venue-related caches
   */
  invalidateVenue(venueId: string): number {
    return apiCache.invalidatePattern(new RegExp(`venue.*${venueId}`));
  },

  /**
   * Invalidate all dish-related caches
   */
  invalidateDish(dishId: string): number {
    return apiCache.invalidatePattern(new RegExp(`dish.*${dishId}`));
  },

  /**
   * Invalidate caches for a geographic area
   */
  invalidateArea(lat: number, lng: number, radiusKm: number): number {
    // This is approximate - invalidates anything near these coords
    const latPattern = lat.toFixed(1);
    const lngPattern = lng.toFixed(1);
    return apiCache.invalidatePattern(new RegExp(`lat.*${latPattern}.*lng.*${lngPattern}`));
  },

  /**
   * Invalidate all nearby queries
   */
  invalidateNearby(): number {
    return apiCache.invalidatePattern(/nearby/);
  },

  /**
   * Clear entire cache
   */
  clearAll(): void {
    apiCache.clear();
  },

  /**
   * Get cache stats
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: apiCache.size(),
      maxSize: 1000,
    };
  },
};

/**
 * Query optimization utilities
 */
export const QueryOptimization = {
  /**
   * Create optimized geo query bounds
   */
  getGeoBounds(lat: number, lng: number, radiusKm: number) {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * (Math.PI / 180)));

    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta,
    };
  },

  /**
   * Batch venue queries to reduce Firestore reads
   */
  async batchGetVenues(
    db: FirebaseFirestore.Firestore,
    venueIds: string[]
  ): Promise<Map<string, any>> {
    const results = new Map();
    const BATCH_SIZE = 10; // Firestore limit for 'in' queries

    for (let i = 0; i < venueIds.length; i += BATCH_SIZE) {
      const batch = venueIds.slice(i, i + BATCH_SIZE);
      const snapshot = await db
        .collection('venues')
        .where('__name__', 'in', batch)
        .get();

      for (const doc of snapshot.docs) {
        results.set(doc.id, { id: doc.id, ...doc.data() });
      }
    }

    return results;
  },

  /**
   * Paginate results efficiently
   */
  paginate<T>(items: T[], page: number, pageSize: number): {
    items: T[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  } {
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);
    const totalPages = Math.ceil(items.length / pageSize);

    return {
      items: paginatedItems,
      page,
      pageSize,
      totalItems: items.length,
      totalPages,
      hasMore: page < totalPages,
    };
  },
};

/**
 * Response compression hint
 */
export function shouldCompress(req: Request): boolean {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  return acceptEncoding.includes('gzip') || acceptEncoding.includes('br');
}

/**
 * ETag generation for conditional requests
 */
export function generateETag(data: any): string {
  const content = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `"${Math.abs(hash).toString(36)}"`;
}

/**
 * Check if client has fresh copy (304 Not Modified)
 */
export function checkFreshness(req: Request, etag: string): boolean {
  const ifNoneMatch = req.headers['if-none-match'];
  return ifNoneMatch === etag;
}
