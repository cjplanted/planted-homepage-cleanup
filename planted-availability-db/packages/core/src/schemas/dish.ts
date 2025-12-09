import { z } from 'zod';
import { dataSourceSchema, venueStatusSchema, dayOfWeekSchema, deliveryPartnerSchema } from './venue.js';

export const availabilityTypeSchema = z.enum(['permanent', 'limited', 'seasonal']);

// Re-export for backwards compatibility
export { deliveryPartnerSchema } from './venue.js';

export const localizedStringSchema = z.record(z.string(), z.string());

// ISO 4217 currency code
const currencyRegex = /^[A-Z]{3}$/;
// ISO 3166-1 alpha-2 country code
const countryCodeRegex = /^[A-Z]{2}$/;

export const priceSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().regex(currencyRegex, 'Currency must be ISO 4217 code'),
});

// Multi-country pricing for chain restaurants
export const countryPriceSchema = z.object({
  country: z.string().regex(countryCodeRegex, 'Country must be ISO 3166-1 alpha-2 code'),
  amount: z.number().min(0),
  currency: z.string().regex(currencyRegex, 'Currency must be ISO 4217 code'),
});

export const dishAvailabilitySchema = z.object({
  type: availabilityTypeSchema,
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  days_available: z.array(dayOfWeekSchema).optional(),
});

// Dish-specific delivery info (URL is deprecated, stored on venue.delivery_platforms)
export const deliveryPartnerInfoSchema = z.object({
  partner: deliveryPartnerSchema,
  url: z.string().url().optional(), // @deprecated - Use venue.delivery_platforms
  price: z.number().min(0).optional(), // Dish-specific price on this platform
});

export const dishSchema = z.object({
  id: z.string(),
  venue_id: z.string(),
  name: z.string().min(1).max(200),
  name_localized: localizedStringSchema.optional(),
  description: z.string().max(2000),
  description_localized: localizedStringSchema.optional(),
  planted_products: z.array(z.string()).min(1),
  // Pricing
  price: priceSchema, // Default/primary price
  prices_by_country: z.array(countryPriceSchema).optional(), // For multi-country chains
  image_url: z.string().url().optional(),
  image_source: z.string().url().optional(),
  dietary_tags: z.array(z.string()),
  cuisine_type: z.string().optional(),
  availability: dishAvailabilitySchema,
  // Delivery info (URLs now on venue.delivery_platforms)
  delivery_partners: z.array(deliveryPartnerInfoSchema).optional(),
  source: dataSourceSchema,
  last_verified: z.coerce.date(),
  status: venueStatusSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const createDishInputSchema = dishSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  last_verified: true,
});

export const updateDishInputSchema = createDishInputSchema.partial();

export type DishSchemaType = z.infer<typeof dishSchema>;
export type CreateDishInputSchemaType = z.infer<typeof createDishInputSchema>;
export type UpdateDishInputSchemaType = z.infer<typeof updateDishInputSchema>;
