import { z } from 'zod';

export const changeActionSchema = z.enum(['created', 'updated', 'archived', 'restored']);
export const changeSourceTypeSchema = z.enum(['scraper', 'manual', 'system', 'webhook']);

export const fieldChangeSchema = z.object({
  field: z.string(),
  before: z.unknown(),
  after: z.unknown(),
});

export const changeSourceSchema = z.object({
  type: changeSourceTypeSchema,
  scraper_id: z.string().optional(),
  user_id: z.string().optional(),
  ip: z.string().optional(),
});

export const changeLogSchema = z.object({
  id: z.string(),
  timestamp: z.coerce.date(),
  action: changeActionSchema,
  collection: z.string(),
  document_id: z.string(),
  changes: z.array(fieldChangeSchema),
  source: changeSourceSchema,
  reason: z.string().max(500).optional(),
});

export const createChangeLogInputSchema = changeLogSchema.omit({
  id: true,
  timestamp: true,
});

export type ChangeLogSchemaType = z.infer<typeof changeLogSchema>;
export type CreateChangeLogInputSchemaType = z.infer<typeof createChangeLogInputSchema>;
