import { z } from 'zod';

export const chainTypeSchema = z.enum(['retail', 'restaurant', 'both']);
export const partnershipLevelSchema = z.enum(['standard', 'premium', 'flagship']);

export const chainContactSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

export const chainSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  type: chainTypeSchema,
  logo_url: z.string().url().optional(),
  website: z.string().url().optional(),
  markets: z.array(z.string().length(2)).min(1), // ISO country codes
  partnership_level: partnershipLevelSchema.optional(),
  contact: chainContactSchema.optional(),
});

export const createChainInputSchema = chainSchema.omit({ id: true });
export const updateChainInputSchema = createChainInputSchema.partial();

export type ChainSchemaType = z.infer<typeof chainSchema>;
export type CreateChainInputSchemaType = z.infer<typeof createChainInputSchema>;
export type UpdateChainInputSchemaType = z.infer<typeof updateChainInputSchema>;
