/**
 * Platform Adapters Index
 *
 * Exports all platform adapters for the Smart Discovery Agent.
 */

export { BasePlatformAdapter } from './BasePlatformAdapter.js';
export type {
  VenuePageData,
  MenuItem,
  PlantedMenuItem,
  PlatformSearchResult,
} from './BasePlatformAdapter.js';

export { JustEatAdapter } from './JustEatAdapter.js';
export { UberEatsAdapter } from './UberEatsAdapter.js';
export { LieferandoAdapter } from './LieferandoAdapter.js';
export { WoltAdapter } from './WoltAdapter.js';
export { SmoodAdapter } from './SmoodAdapter.js';

import type { DeliveryPlatform } from '@pad/core';
import { BasePlatformAdapter } from './BasePlatformAdapter.js';
import { JustEatAdapter } from './JustEatAdapter.js';
import { UberEatsAdapter } from './UberEatsAdapter.js';
import { LieferandoAdapter } from './LieferandoAdapter.js';
import { WoltAdapter } from './WoltAdapter.js';
import { SmoodAdapter } from './SmoodAdapter.js';

/**
 * Registry of all platform adapters
 */
export const platformAdapters: Record<DeliveryPlatform, BasePlatformAdapter> = {
  'just-eat': new JustEatAdapter(),
  'uber-eats': new UberEatsAdapter(),
  'lieferando': new LieferandoAdapter(),
  'wolt': new WoltAdapter(),
  'smood': new SmoodAdapter(),
};

/**
 * Get adapter for a specific platform
 */
export function getAdapter(platform: DeliveryPlatform): BasePlatformAdapter {
  const adapter = platformAdapters[platform];
  if (!adapter) {
    throw new Error(`No adapter found for platform: ${platform}`);
  }
  return adapter;
}

/**
 * Get all adapters that support a country
 */
export function getAdaptersForCountry(country: string): BasePlatformAdapter[] {
  return Object.values(platformAdapters).filter((adapter) =>
    adapter.supportedCountries.includes(country as any)
  );
}

/**
 * Get all supported platforms
 */
export function getSupportedPlatforms(): DeliveryPlatform[] {
  return Object.keys(platformAdapters) as DeliveryPlatform[];
}
