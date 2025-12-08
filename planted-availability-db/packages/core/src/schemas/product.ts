import { z } from 'zod';
import { localizedStringSchema } from './dish.js';

export const productCategorySchema = z.enum([
  'chicken',
  'steak',
  'pulled',
  'kebab',
  'schnitzel',
  'bratwurst',
  'duck',
  'skewers',
  'filetwuerfel',
  'burger',
  'nuggets',
]);

// SKU format: PLANTED-CATEGORY-VARIANT-WEIGHT
const skuRegex = /^[A-Z0-9-]+$/;

export const productSchema = z.object({
  sku: z.string().regex(skuRegex, 'SKU must be uppercase alphanumeric with hyphens'),
  name: localizedStringSchema,
  category: productCategorySchema,
  variant: z.string().min(1).max(100),
  weight_grams: z.number().int().positive().optional(),
  image_url: z.string().url(),
  markets: z.array(z.string().length(2)).min(1), // ISO country codes
  retail_only: z.boolean(),
  active: z.boolean(),
});

export const createProductInputSchema = productSchema.extend({
  sku: z.string().regex(skuRegex).optional(),
});

export const updateProductInputSchema = productSchema.omit({ sku: true }).partial();

export type ProductSchemaType = z.infer<typeof productSchema>;
export type CreateProductInputSchemaType = z.infer<typeof createProductInputSchema>;
export type UpdateProductInputSchemaType = z.infer<typeof updateProductInputSchema>;
