/**
 * Auto-Verification Rules Engine
 *
 * Automatically verifies or rejects discovered venues based on configurable rules.
 * High-confidence venues from verified chains can be auto-verified.
 * Known brand misuse patterns are auto-rejected.
 */

import { discoveredVenues } from '@pad/database';
import type { DiscoveredVenue, SupportedCountry } from '@pad/core';

// ============================================================================
// Types
// ============================================================================

export interface AutoVerificationResult {
  venueId: string;
  venueName: string;
  action: 'verified' | 'rejected' | 'needs_review';
  reason: string;
  confidence: number;
  rule: string;
}

export interface AutoVerificationStats {
  processed: number;
  autoVerified: number;
  autoRejected: number;
  needsReview: number;
}

export interface AutoVerifierConfig {
  minConfidenceForAutoVerify: number; // Default: 90
  enableAutoVerify: boolean; // Default: true
  enableAutoReject: boolean; // Default: true
  dryRun: boolean; // Default: false
}

// ============================================================================
// Rules
// ============================================================================

// Known brand misuse chains - auto-reject
const BRAND_MISUSE_PATTERNS = [
  'goldies',
  'goldies smashburger',
  'goldies chicken',
  'plant power', // Generic "plant" not "planted"
  'plant based', // Generic "plant" not "planted"
];

// Verified partner chains - auto-verify if confidence >= threshold
const VERIFIED_CHAINS = [
  'birdie birdie',
  'dean&david',
  'dean david',
  'deanddavid',
  'beets&roots',
  'beets and roots',
  'beetsandroots',
  'green club',
  'nooch',
  'nooch asian',
  'rice up',
  'smash bro',
  'doen doen',
  'hiltl',
  'tibits',
  'kaimug',
  'chidoba',
  'stadtsalat',
  'rabowls',
];

// URL patterns that indicate false positives
const REJECT_URL_PATTERNS = [
  /\/search\?/i, // Search result pages, not venue pages
  /\/category\//i, // Category pages
  /\/help\//i, // Help pages
  /\/about/i, // About pages
];

// ============================================================================
// AutoVerifier Class
// ============================================================================

export class AutoVerifier {
  private config: AutoVerifierConfig;
  private stats: AutoVerificationStats;

  constructor(config?: Partial<AutoVerifierConfig>) {
    this.config = {
      minConfidenceForAutoVerify: config?.minConfidenceForAutoVerify ?? 90,
      enableAutoVerify: config?.enableAutoVerify ?? true,
      enableAutoReject: config?.enableAutoReject ?? true,
      dryRun: config?.dryRun ?? false,
    };
    this.stats = this.emptyStats();
  }

  private emptyStats(): AutoVerificationStats {
    return {
      processed: 0,
      autoVerified: 0,
      autoRejected: 0,
      needsReview: 0,
    };
  }

  /**
   * Check if venue name matches a verified chain
   */
  private isVerifiedChain(venueName: string): boolean {
    const lower = venueName.toLowerCase();
    return VERIFIED_CHAINS.some(chain => lower.includes(chain));
  }

  /**
   * Check if venue name matches a brand misuse pattern
   */
  private isBrandMisuse(venueName: string): boolean {
    const lower = venueName.toLowerCase();
    return BRAND_MISUSE_PATTERNS.some(pattern => lower.includes(pattern));
  }

  /**
   * Check if URL matches a reject pattern
   */
  private hasRejectUrlPattern(url: string): string | null {
    for (const pattern of REJECT_URL_PATTERNS) {
      if (pattern.test(url)) {
        return pattern.toString();
      }
    }
    return null;
  }

  /**
   * Check for duplicate URLs in existing venues
   */
  private async isDuplicateUrl(url: string, venueId: string): Promise<boolean> {
    const existing = await discoveredVenues.findByDeliveryUrl(url);
    return existing !== null && existing.id !== venueId;
  }

  /**
   * Apply rules to a single venue and determine action
   */
  async evaluateVenue(venue: DiscoveredVenue): Promise<AutoVerificationResult> {
    const venueName = venue.name;
    const venueUrl = venue.delivery_platforms[0]?.url || '';
    const confidence = venue.confidence_score || 0;

    // Rule 1: Brand misuse - auto-reject
    if (this.isBrandMisuse(venueName)) {
      return {
        venueId: venue.id,
        venueName,
        action: 'rejected',
        reason: 'Brand misuse pattern detected - venue claims "planted" but likely uses generic plant-based products',
        confidence,
        rule: 'brand_misuse',
      };
    }

    // Rule 2: Reject URL patterns - auto-reject
    const rejectPattern = this.hasRejectUrlPattern(venueUrl);
    if (rejectPattern) {
      return {
        venueId: venue.id,
        venueName,
        action: 'rejected',
        reason: `URL matches reject pattern: ${rejectPattern}`,
        confidence,
        rule: 'reject_url_pattern',
      };
    }

    // Rule 3: Duplicate URL - auto-reject
    if (await this.isDuplicateUrl(venueUrl, venue.id)) {
      return {
        venueId: venue.id,
        venueName,
        action: 'rejected',
        reason: 'Duplicate URL - venue already exists',
        confidence,
        rule: 'duplicate_url',
      };
    }

    // Rule 4: Verified chain with high confidence - auto-verify
    if (this.isVerifiedChain(venueName) && confidence >= this.config.minConfidenceForAutoVerify) {
      return {
        venueId: venue.id,
        venueName,
        action: 'verified',
        reason: `Verified chain with ${confidence}% confidence`,
        confidence,
        rule: 'verified_chain_high_confidence',
      };
    }

    // Rule 5: Very high confidence (>= 95) - auto-verify
    if (confidence >= 95) {
      return {
        venueId: venue.id,
        venueName,
        action: 'verified',
        reason: `Very high confidence: ${confidence}%`,
        confidence,
        rule: 'very_high_confidence',
      };
    }

    // Rule 6: Has dishes extracted with planted products - boost confidence
    if (venue.dishes && venue.dishes.length > 0) {
      const plantedDishes = venue.dishes.filter(d =>
        d.planted_product && d.planted_product.startsWith('planted.')
      );
      if (plantedDishes.length >= 2 && confidence >= 80) {
        return {
          venueId: venue.id,
          venueName,
          action: 'verified',
          reason: `${plantedDishes.length} planted dishes extracted with ${confidence}% confidence`,
          confidence,
          rule: 'dishes_with_planted_products',
        };
      }
    }

    // Default: needs manual review
    return {
      venueId: venue.id,
      venueName,
      action: 'needs_review',
      reason: `Confidence ${confidence}% - requires manual verification`,
      confidence,
      rule: 'default_review',
    };
  }

  /**
   * Process a venue and apply the action (verify/reject)
   */
  async processVenue(venue: DiscoveredVenue): Promise<AutoVerificationResult> {
    const result = await this.evaluateVenue(venue);
    this.stats.processed++;

    if (this.config.dryRun) {
      // Dry run - just count, don't apply
      if (result.action === 'verified') this.stats.autoVerified++;
      else if (result.action === 'rejected') this.stats.autoRejected++;
      else this.stats.needsReview++;
      return result;
    }

    // Apply the action
    if (result.action === 'verified' && this.config.enableAutoVerify) {
      await discoveredVenues.verifyVenue(result.venueId);
      this.stats.autoVerified++;
    } else if (result.action === 'rejected' && this.config.enableAutoReject) {
      await discoveredVenues.rejectVenue(result.venueId, result.reason);
      this.stats.autoRejected++;
    } else {
      this.stats.needsReview++;
    }

    return result;
  }

  /**
   * Process all pending venues
   */
  async processAllPending(): Promise<AutoVerificationResult[]> {
    this.stats = this.emptyStats();
    const results: AutoVerificationResult[] = [];

    const pendingVenues = await discoveredVenues.getByStatus('discovered');

    for (const venue of pendingVenues) {
      const result = await this.processVenue(venue as DiscoveredVenue);
      results.push(result);
    }

    return results;
  }

  /**
   * Process venues by country
   */
  async processByCountry(country: SupportedCountry): Promise<AutoVerificationResult[]> {
    this.stats = this.emptyStats();
    const results: AutoVerificationResult[] = [];

    const venues = await discoveredVenues.getByCountry(country);
    const pendingVenues = venues.filter(v => v.status === 'discovered');

    for (const venue of pendingVenues) {
      const result = await this.processVenue(venue as DiscoveredVenue);
      results.push(result);
    }

    return results;
  }

  /**
   * Get current stats
   */
  getStats(): AutoVerificationStats {
    return { ...this.stats };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = this.emptyStats();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let autoVerifierInstance: AutoVerifier | null = null;

export function getAutoVerifier(config?: Partial<AutoVerifierConfig>): AutoVerifier {
  if (!autoVerifierInstance) {
    autoVerifierInstance = new AutoVerifier(config);
  }
  return autoVerifierInstance;
}

export function resetAutoVerifier(): void {
  autoVerifierInstance = null;
}
