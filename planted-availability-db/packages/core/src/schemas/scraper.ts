import { z } from 'zod';
import { venueSchema } from './venue.js';
import { dishSchema } from './dish.js';
import { promotionBaseSchema } from './promotion.js';

export const scraperStatusSchema = z.enum(['running', 'completed', 'failed', 'partial']);

export const scraperStatsSchema = z.object({
  venues_checked: z.number().int().min(0),
  venues_updated: z.number().int().min(0),
  dishes_found: z.number().int().min(0),
  dishes_updated: z.number().int().min(0),
  errors: z.number().int().min(0),
});

export const scraperErrorSchema = z.object({
  message: z.string(),
  url: z.string().url().optional(),
  stack: z.string().optional(),
});

export const scraperRunSchema = z.object({
  id: z.string(),
  scraper_id: z.string(),
  started_at: z.coerce.date(),
  completed_at: z.coerce.date().optional(),
  status: scraperStatusSchema,
  stats: scraperStatsSchema,
  errors: z.array(scraperErrorSchema).optional(),
  next_run: z.coerce.date().optional(),
});

export const scraperConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  market: z.array(z.string().length(2)),
  type: z.enum(['retail', 'restaurant', 'delivery']),
  schedule: z.string(), // cron expression
  rateLimit: z.object({
    requestsPerSecond: z.number().min(0.1).max(100),
    maxConcurrent: z.number().int().min(1).max(50),
  }),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10),
    backoffMs: z.number().int().min(100).max(60000),
  }),
  enabled: z.boolean(),
});

export const scraperResultSchema = z.object({
  venues: z.array(venueSchema.partial()),
  dishes: z.array(dishSchema.partial()),
  promotions: z.array(promotionBaseSchema.partial()),
  errors: z.array(scraperErrorSchema),
});

export const createScraperRunInputSchema = scraperRunSchema.omit({ id: true });

export type ScraperRunSchemaType = z.infer<typeof scraperRunSchema>;
export type ScraperConfigSchemaType = z.infer<typeof scraperConfigSchema>;
export type ScraperResultSchemaType = z.infer<typeof scraperResultSchema>;
