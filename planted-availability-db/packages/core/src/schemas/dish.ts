import { z } from 'zod';
import { dataSourceSchema, venueStatusSchema, dayOfWeekSchema } from './venue.js';

export const availabilityTypeSchema = z.enum(['permanent', 'limited', 'seasonal']);
export const deliveryPartnerSchema = z.enum([
  'uber_eats', 'wolt', 'lieferando', 'deliveroo', 'just_eat', 'glovo'
]);

export const localizedStringSchema = z.record(z.string(), z.string());

// ISO 4217 currency code
const currencyRegex = /^[A-Z]{3}$/;
export const priceSchema = z.object({
  amount: z.number().min(0),
  currency: z.string().regex(currencyRegex, 'Currency must be ISO 4217 code'),
});

export const dishAvailabilitySchema = z.object({
  type: availabilityTypeSchema,
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  days_available: z.array(dayOfWeekSchema).optional(),
});

export const deliveryPartnerInfoSchema = z.object({
  partner: deliveryPartnerSchema,
  url: z.string().url(),
  price: z.number().min(0).optional(),
});

export const dishSchema = z.object({
  id: z.string(),
  venue_id: z.string(),
  name: z.string().min(1).max(200),
  name_localized: localizedStringSchema.optional(),
  description: z.string().max(2000),
  description_localized: localizedStringSchema.optional(),
  planted_products: z.array(z.string()).min(1),
  price: priceSchema,
  image_url: z.string().url().optional(),
  image_source: z.string().url().optional(),
  dietary_tags: z.array(z.string()),
  cuisine_type: z.string().optional(),
  availability: dishAvailabilitySchema,
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
