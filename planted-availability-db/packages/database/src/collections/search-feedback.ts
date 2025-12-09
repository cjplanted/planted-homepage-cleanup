import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection } from './base.js';
import type {
  SearchFeedback,
  CreateSearchFeedbackInput,
  FeedbackResultType,
  SearchFeedbackDetails,
  DeliveryPlatform,
  SupportedCountry,
} from '@pad/core';

interface SearchFeedbackDoc extends Omit<SearchFeedback, 'created_at' | 'reviewed_at'> {
  created_at: Date;
  updated_at: Date;
  reviewed_at?: Date;
}

/**
 * Collection for tracking search query feedback to enable learning
 */
class SearchFeedbackCollection extends BaseCollection<SearchFeedbackDoc> {
  protected collectionName = 'search_feedback';

  protected fromFirestore(doc: QueryDocumentSnapshot): SearchFeedbackDoc {
    const data = doc.data();
    return {
      id: doc.id,
      query: data.query,
      platform: data.platform,
      country: data.country,
      strategy_id: data.strategy_id,
      result_type: data.result_type,
      discovered_venue_id: data.discovered_venue_id,
      feedback: data.feedback,
      reviewed_by: data.reviewed_by,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      reviewed_at: data.reviewed_at ? (data.reviewed_at as Timestamp).toDate() : undefined,
    };
  }

  protected toFirestore(data: Partial<SearchFeedbackDoc>): DocumentData {
    const doc: DocumentData = {};

    if (data.query !== undefined) doc.query = data.query;
    if (data.platform !== undefined) doc.platform = data.platform;
    if (data.country !== undefined) doc.country = data.country;
    if (data.strategy_id !== undefined) doc.strategy_id = data.strategy_id;
    if (data.result_type !== undefined) doc.result_type = data.result_type;
    if (data.discovered_venue_id !== undefined) doc.discovered_venue_id = data.discovered_venue_id;
    if (data.feedback !== undefined) doc.feedback = data.feedback;
    if (data.reviewed_by !== undefined) doc.reviewed_by = data.reviewed_by;
    if (data.reviewed_at !== undefined) doc.reviewed_at = data.reviewed_at;

    return doc;
  }

  /**
   * Record a search result
   */
  async recordSearch(input: CreateSearchFeedbackInput): Promise<SearchFeedbackDoc> {
    return this.create(input);
  }

  /**
   * Add human feedback to a search result
   */
  async addFeedback(
    feedbackId: string,
    feedback: SearchFeedbackDetails,
    reviewedBy: string
  ): Promise<SearchFeedbackDoc> {
    return this.update(feedbackId, {
      feedback,
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
    });
  }

  /**
   * Get feedback for a specific strategy
   */
  async getByStrategy(strategyId: string): Promise<SearchFeedbackDoc[]> {
    const snapshot = await this.collection
      .where('strategy_id', '==', strategyId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get feedback by result type
   */
  async getByResultType(resultType: FeedbackResultType): Promise<SearchFeedbackDoc[]> {
    const snapshot = await this.collection
      .where('result_type', '==', resultType)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get unreviewed feedback
   */
  async getUnreviewed(limit: number = 50): Promise<SearchFeedbackDoc[]> {
    const snapshot = await this.collection
      .where('reviewed_at', '==', null)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get feedback for a platform and country
   */
  async getByPlatformAndCountry(
    platform: DeliveryPlatform,
    country: SupportedCountry
  ): Promise<SearchFeedbackDoc[]> {
    const snapshot = await this.collection
      .where('platform', '==', platform)
      .where('country', '==', country)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get strategy performance from feedback
   */
  async getStrategyPerformance(strategyId: string): Promise<{
    total: number;
    true_positives: number;
    false_positives: number;
    no_results: number;
    errors: number;
    success_rate: number;
    reviewed_count: number;
    average_usefulness: number;
  }> {
    const feedback = await this.getByStrategy(strategyId);

    const counts = {
      total: feedback.length,
      true_positives: 0,
      false_positives: 0,
      no_results: 0,
      errors: 0,
      reviewed_count: 0,
      useful_count: 0,
    };

    for (const f of feedback) {
      switch (f.result_type) {
        case 'true_positive':
          counts.true_positives++;
          break;
        case 'false_positive':
          counts.false_positives++;
          break;
        case 'no_results':
          counts.no_results++;
          break;
        case 'error':
          counts.errors++;
          break;
      }

      if (f.feedback) {
        counts.reviewed_count++;
        if (f.feedback.was_useful) {
          counts.useful_count++;
        }
      }
    }

    return {
      ...counts,
      success_rate:
        counts.total > 0
          ? Math.round((counts.true_positives / counts.total) * 100)
          : 0,
      average_usefulness:
        counts.reviewed_count > 0
          ? Math.round((counts.useful_count / counts.reviewed_count) * 100)
          : 0,
    };
  }

  /**
   * Get recent false positives for analysis
   */
  async getRecentFalsePositives(limit: number = 20): Promise<SearchFeedbackDoc[]> {
    const snapshot = await this.collection
      .where('result_type', '==', 'false_positive')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get queries that led to discoveries for a venue
   */
  async getForVenue(venueId: string): Promise<SearchFeedbackDoc[]> {
    const snapshot = await this.collection
      .where('discovered_venue_id', '==', venueId)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get aggregate statistics
   */
  async getStats(): Promise<{
    total_searches: number;
    by_result_type: Record<FeedbackResultType, number>;
    by_platform: Record<string, number>;
    by_country: Record<string, number>;
    overall_success_rate: number;
    reviewed_percentage: number;
  }> {
    const all = await this.getAll();

    const byResultType: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    let reviewed = 0;
    let truePositives = 0;

    for (const f of all) {
      byResultType[f.result_type] = (byResultType[f.result_type] || 0) + 1;
      byPlatform[f.platform] = (byPlatform[f.platform] || 0) + 1;
      byCountry[f.country] = (byCountry[f.country] || 0) + 1;

      if (f.reviewed_at) reviewed++;
      if (f.result_type === 'true_positive') truePositives++;
    }

    return {
      total_searches: all.length,
      by_result_type: byResultType as Record<FeedbackResultType, number>,
      by_platform: byPlatform,
      by_country: byCountry,
      overall_success_rate:
        all.length > 0 ? Math.round((truePositives / all.length) * 100) : 0,
      reviewed_percentage:
        all.length > 0 ? Math.round((reviewed / all.length) * 100) : 0,
    };
  }

  /**
   * Get data for learning analysis (last N days)
   */
  async getForLearning(days: number = 7): Promise<SearchFeedbackDoc[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const snapshot = await this.collection
      .where('created_at', '>=', cutoff)
      .where('reviewed_at', '!=', null)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }
}

// Singleton instance
export const searchFeedback = new SearchFeedbackCollection();
