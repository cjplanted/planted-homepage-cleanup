/**
 * Zod Schemas for API Request Validation
 *
 * Centralized validation for all public API request parameters.
 * Provides type-safe parsing with helpful error messages.
 */

import { z } from 'zod';

// Common validation patterns
const coordinateSchema = z.object({
  lat: z
    .string()
    .transform((v) => parseFloat(v))
    .refine((v) => !isNaN(v) && v >= -90 && v <= 90, 'Latitude must be between -90 and 90'),
  lng: z
    .string()
    .transform((v) => parseFloat(v))
    .refine((v) => !isNaN(v) && v >= -180 && v <= 180, 'Longitude must be between -180 and 180'),
});

const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(parseInt(v, 10), 100) : 20))
    .refine((v) => !isNaN(v) && v > 0, 'Limit must be a positive number'),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0))
    .refine((v) => !isNaN(v) && v >= 0, 'Offset must be a non-negative number'),
});

const countryCodeSchema = z
  .string()
  .length(2, 'Country code must be 2 characters (ISO 3166-1 alpha-2)')
  .toUpperCase()
  .optional();

// Venue types
const venueTypeSchema = z.enum(['retail', 'restaurant', 'delivery_kitchen']).optional();
const venueStatusSchema = z.enum(['active', 'stale', 'archived']).optional();

/**
 * GET /api/v1/venues - List venues
 */
export const venuesListQuerySchema = z.object({
  type: venueTypeSchema,
  country: countryCodeSchema,
  chain_id: z.string().optional(),
  status: venueStatusSchema,
  ...paginationSchema.shape,
});

export type VenuesListQuery = z.infer<typeof venuesListQuerySchema>;

/**
 * GET /api/v1/venues/:id - Venue detail
 */
export const venueIdParamSchema = z.object({
  id: z.string().min(1, 'Venue ID is required'),
});

export type VenueIdParam = z.infer<typeof venueIdParamSchema>;

/**
 * GET /api/v1/nearby - Nearby venues and dishes
 */
export const nearbyQuerySchema = z
  .object({
    ...coordinateSchema.shape,
    radius_km: z
      .string()
      .optional()
      .transform((v) => (v ? Math.min(parseFloat(v), 50) : 5))
      .refine((v) => !isNaN(v) && v > 0, 'Radius must be a positive number'),
    type: z.enum(['retail', 'restaurant', 'delivery_kitchen', 'all']).optional().default('all'),
    open_now: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    product_sku: z.string().optional(),
    dedupe_chains: z
      .string()
      .optional()
      .transform((v) => v !== 'false'), // Default true - only show closest venue per chain
    ...paginationSchema.shape,
  })
  .refine((data) => data.lat !== undefined && data.lng !== undefined, {
    message: 'lat and lng are required',
    path: ['lat', 'lng'],
  });

export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

/**
 * GET /api/v1/dishes - Search dishes
 */
export const dishesQuerySchema = z.object({
  product_sku: z.string().optional(),
  lat: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined)),
  lng: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined)),
  radius_km: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(parseFloat(v), 100) : 50)),
  tags: z
    .string()
    .optional()
    .transform((v) => v?.split(',').filter(Boolean)),
  cuisine: z.string().optional(),
  min_price: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined)),
  max_price: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v) : undefined)),
  ...paginationSchema.shape,
});

export type DishesQuery = z.infer<typeof dishesQuerySchema>;

/**
 * GET /api/v1/dishes/:id - Dish detail
 */
export const dishIdParamSchema = z.object({
  id: z.string().min(1, 'Dish ID is required'),
});

export type DishIdParam = z.infer<typeof dishIdParamSchema>;

/**
 * GET /api/v1/delivery/check - Delivery availability
 */
export const deliveryCheckQuerySchema = z
  .object({
    postal_code: z
      .string()
      .optional()
      .refine((v) => !v || /^\d{4,10}$/.test(v), 'Invalid postal code format'),
    country: countryCodeSchema,
    address: z.string().max(500, 'Address too long').optional(),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Math.min(parseInt(v, 10), 20) : 10)),
  })
  .refine((data) => data.postal_code || data.address, {
    message: 'Either postal_code or address is required',
    path: ['postal_code'],
  });

export type DeliveryCheckQuery = z.infer<typeof deliveryCheckQuerySchema>;

/**
 * Helper: Parse and validate request query with Zod schema
 *
 * Returns parsed data on success, or formatted error response.
 */
export function parseQuery<T extends z.ZodSchema>(
  query: Record<string, unknown>,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: { field: string; message: string }[] } {
  const result = schema.safeParse(query);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format Zod errors into user-friendly format
  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'query',
    message: issue.message,
  }));

  return { success: false, error: errors };
}
