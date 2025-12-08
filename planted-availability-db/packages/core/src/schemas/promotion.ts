import { z } from 'zod';
import { dataSourceSchema } from './venue.js';

export const promoTypeSchema = z.enum(['discount', 'bundle', 'special', 'new_product']);
export const discountTypeSchema = z.enum(['percent', 'fixed']);

export const discountSchema = z.object({
  type: discountTypeSchema,
  value: z.number().min(0),
});

// Base schema without refinement for deriving other schemas
export const promotionBaseSchema = z.object({
  id: z.string(),
  venue_id: z.string().optional(),
  chain_id: z.string().optional(),
  product_skus: z.array(z.string()),
  promo_type: promoTypeSchema,
  discount: discountSchema.optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  image_url: z.string().url().optional(),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date(),
  terms: z.string().max(2000).optional(),
  source: dataSourceSchema,
  active: z.boolean(), // Computed: true if valid_from <= now <= valid_until
  created_at: z.coerce.date(),
});

// Full schema with date validation
export const promotionSchema = promotionBaseSchema.refine(
  (data) => data.valid_until > data.valid_from,
  { message: 'valid_until must be after valid_from' }
);

export const retailAvailabilitySchema = z.object({
  id: z.string(),
  venue_id: z.string(),
  product_sku: z.string(),
  in_stock: z.boolean(),
  price: z.object({
    regular: z.number().min(0),
    currency: z.string().length(3),
  }).optional(),
  promotion: z.object({
    id: z.string(),
    price: z.number().min(0),
    valid_until: z.coerce.date(),
  }).optional(),
  shelf_location: z.string().max(200).optional(),
  last_verified: z.coerce.date(),
  source: dataSourceSchema,
});

export const createPromotionInputSchema = promotionBaseSchema.omit({
  id: true,
  created_at: true,
  active: true, // Computed server-side
}).refine(
  (data) => data.valid_until > data.valid_from,
  { message: 'valid_until must be after valid_from' }
);

export const updatePromotionInputSchema = promotionBaseSchema.omit({
  id: true,
  created_at: true,
  active: true, // Computed server-side
}).partial();

export const createRetailAvailabilityInputSchema = retailAvailabilitySchema.omit({ id: true });
export const updateRetailAvailabilityInputSchema = createRetailAvailabilityInputSchema.partial();

export type PromotionSchemaType = z.infer<typeof promotionSchema>;
export type RetailAvailabilitySchemaType = z.infer<typeof retailAvailabilitySchema>;
