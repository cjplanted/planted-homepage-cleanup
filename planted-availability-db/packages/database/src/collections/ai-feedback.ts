import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection } from './base.js';
import type {
  AIFeedback,
  CreateAIFeedbackInput,
  FeedbackStats,
  AIFeedbackType,
  TrainingDataExport,
  ConfidenceAnalysis,
  ProductPerformance,
} from '@pad/core';

/**
 * Collection for AI feedback (reinforcement learning)
 */
class AIFeedbackCollection extends BaseCollection<AIFeedback> {
  protected collectionName = 'ai_feedback';

  protected fromFirestore(doc: QueryDocumentSnapshot): AIFeedback {
    const data = doc.data();
    return {
      id: doc.id,
      dish_id: data.dish_id,
      venue_id: data.venue_id,
      discovered_venue_id: data.discovered_venue_id,
      discovered_dish_id: data.discovered_dish_id,
      ai_prediction: data.ai_prediction,
      human_feedback: data.human_feedback,
      correct_product_sku: data.correct_product_sku,
      feedback_notes: data.feedback_notes,
      reviewer_id: data.reviewer_id,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    };
  }

  protected toFirestore(data: Partial<AIFeedback>): DocumentData {
    const doc: DocumentData = {};

    if (data.dish_id !== undefined) doc.dish_id = data.dish_id;
    if (data.venue_id !== undefined) doc.venue_id = data.venue_id;
    if (data.discovered_venue_id !== undefined) doc.discovered_venue_id = data.discovered_venue_id;
    if (data.discovered_dish_id !== undefined) doc.discovered_dish_id = data.discovered_dish_id;
    if (data.ai_prediction !== undefined) doc.ai_prediction = data.ai_prediction;
    if (data.human_feedback !== undefined) doc.human_feedback = data.human_feedback;
    if (data.correct_product_sku !== undefined) doc.correct_product_sku = data.correct_product_sku;
    if (data.feedback_notes !== undefined) doc.feedback_notes = data.feedback_notes;
    if (data.reviewer_id !== undefined) doc.reviewer_id = data.reviewer_id;

    return doc;
  }

  /**
   * Create feedback entry
   */
  async recordFeedback(input: CreateAIFeedbackInput): Promise<AIFeedback> {
    return this.create(input);
  }

  /**
   * Get feedback by venue
   */
  async getByVenue(venueId: string): Promise<AIFeedback[]> {
    const snapshot = await this.collection
      .where('venue_id', '==', venueId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get feedback by discovered venue
   */
  async getByDiscoveredVenue(discoveredVenueId: string): Promise<AIFeedback[]> {
    const snapshot = await this.collection
      .where('discovered_venue_id', '==', discoveredVenueId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get feedback by dish
   */
  async getByDish(dishId: string): Promise<AIFeedback[]> {
    const snapshot = await this.collection
      .where('dish_id', '==', dishId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get feedback by discovered dish
   */
  async getByDiscoveredDish(discoveredDishId: string): Promise<AIFeedback[]> {
    const snapshot = await this.collection
      .where('discovered_dish_id', '==', discoveredDishId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get feedback statistics
   */
  async getStats(since?: Date): Promise<FeedbackStats> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (since) {
      query = query.where('created_at', '>=', since);
    }

    const snapshot = await query.get();
    const feedback = snapshot.docs.map((doc) => this.fromFirestore(doc));

    // Initialize counters
    const byFeedbackType: Record<AIFeedbackType, number> = {
      correct: 0,
      wrong_product: 0,
      not_planted: 0,
      needs_review: 0,
    };

    const byProductSku: Record<string, { correct: number; wrong: number }> = {};

    let correctCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    let reviewedToday = 0;
    let reviewedThisWeek = 0;
    let reviewedThisMonth = 0;

    for (const f of feedback) {
      // Count by feedback type
      byFeedbackType[f.human_feedback]++;

      // Track product accuracy
      const sku = f.ai_prediction.product_sku;
      if (!byProductSku[sku]) {
        byProductSku[sku] = { correct: 0, wrong: 0 };
      }

      if (f.human_feedback === 'correct') {
        byProductSku[sku].correct++;
        correctCount++;
      } else if (f.human_feedback === 'wrong_product' || f.human_feedback === 'not_planted') {
        byProductSku[sku].wrong++;
      }

      // Count by time periods
      if (f.created_at >= today) {
        reviewedToday++;
      }
      if (f.created_at >= thisWeek) {
        reviewedThisWeek++;
      }
      if (f.created_at >= thisMonth) {
        reviewedThisMonth++;
      }
    }

    // Calculate accuracy rates per product
    const byProductSkuWithRates: Record<string, {
      correct: number;
      wrong: number;
      accuracy_rate: number;
    }> = {};

    for (const [sku, counts] of Object.entries(byProductSku)) {
      const total = counts.correct + counts.wrong;
      byProductSkuWithRates[sku] = {
        ...counts,
        accuracy_rate: total > 0 ? Math.round((counts.correct / total) * 100) : 0,
      };
    }

    return {
      total: feedback.length,
      by_feedback_type: byFeedbackType,
      by_product_sku: byProductSkuWithRates,
      overall_accuracy_rate: feedback.length > 0 ? Math.round((correctCount / feedback.length) * 100) : 0,
      reviewed_today: reviewedToday,
      reviewed_this_week: reviewedThisWeek,
      reviewed_this_month: reviewedThisMonth,
    };
  }

  /**
   * Export training data with analysis
   */
  async exportTrainingData(since?: Date): Promise<TrainingDataExport> {
    let query = this.collection.orderBy('created_at', 'asc');

    if (since) {
      query = query.where('created_at', '>=', since);
    }

    const snapshot = await query.get();
    const feedback = snapshot.docs.map((doc) => this.fromFirestore(doc));

    // Calculate statistics
    const byFeedbackType: Record<AIFeedbackType, number> = {
      correct: 0,
      wrong_product: 0,
      not_planted: 0,
      needs_review: 0,
    };

    const confidenceBuckets = {
      low: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      high: { total: 0, correct: 0 },
    };

    for (const f of feedback) {
      byFeedbackType[f.human_feedback]++;

      // Bucket by confidence
      const confidence = f.ai_prediction.confidence;
      let bucket: 'low' | 'medium' | 'high';
      if (confidence < 40) {
        bucket = 'low';
      } else if (confidence < 70) {
        bucket = 'medium';
      } else {
        bucket = 'high';
      }

      confidenceBuckets[bucket].total++;
      if (f.human_feedback === 'correct') {
        confidenceBuckets[bucket].correct++;
      }
    }

    // Date range
    const dates = feedback.map(f => f.created_at).filter(d => d);
    const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();

    return {
      feedback,
      stats: {
        total_records: feedback.length,
        date_range: {
          from: minDate,
          to: maxDate,
        },
        by_feedback_type: byFeedbackType,
        accuracy_by_confidence_bucket: {
          low: {
            total: confidenceBuckets.low.total,
            correct: confidenceBuckets.low.correct,
            rate: confidenceBuckets.low.total > 0
              ? Math.round((confidenceBuckets.low.correct / confidenceBuckets.low.total) * 100)
              : 0,
          },
          medium: {
            total: confidenceBuckets.medium.total,
            correct: confidenceBuckets.medium.correct,
            rate: confidenceBuckets.medium.total > 0
              ? Math.round((confidenceBuckets.medium.correct / confidenceBuckets.medium.total) * 100)
              : 0,
          },
          high: {
            total: confidenceBuckets.high.total,
            correct: confidenceBuckets.high.correct,
            rate: confidenceBuckets.high.total > 0
              ? Math.round((confidenceBuckets.high.correct / confidenceBuckets.high.total) * 100)
              : 0,
          },
        },
      },
      export_date: new Date(),
    };
  }

  /**
   * Analyze confidence accuracy
   */
  async analyzeConfidence(): Promise<ConfidenceAnalysis[]> {
    const feedback = await this.getAll();

    const buckets = {
      low: { min: 0, max: 40, total: 0, correct: 0, factors: new Map<string, { count: number; correct: number }>() },
      medium: { min: 40, max: 70, total: 0, correct: 0, factors: new Map<string, { count: number; correct: number }>() },
      high: { min: 70, max: 100, total: 0, correct: 0, factors: new Map<string, { count: number; correct: number }>() },
    };

    for (const f of feedback) {
      const confidence = f.ai_prediction.confidence;
      let bucket: 'low' | 'medium' | 'high';

      if (confidence < 40) {
        bucket = 'low';
      } else if (confidence < 70) {
        bucket = 'medium';
      } else {
        bucket = 'high';
      }

      const b = buckets[bucket];
      b.total++;

      if (f.human_feedback === 'correct') {
        b.correct++;
      }

      // Track factors
      for (const factor of f.ai_prediction.factors) {
        if (!b.factors.has(factor)) {
          b.factors.set(factor, { count: 0, correct: 0 });
        }
        const factorStats = b.factors.get(factor)!;
        factorStats.count++;
        if (f.human_feedback === 'correct') {
          factorStats.correct++;
        }
      }
    }

    return Object.entries(buckets).map(([name, data]) => ({
      confidence_bucket: name as 'low' | 'medium' | 'high',
      range: { min: data.min, max: data.max },
      total_predictions: data.total,
      correct_predictions: data.correct,
      accuracy_rate: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      common_factors: Array.from(data.factors.entries())
        .map(([factor, stats]) => ({
          factor,
          frequency: stats.count,
          accuracy_rate: stats.count > 0 ? Math.round((stats.correct / stats.count) * 100) : 0,
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10),
    }));
  }

  /**
   * Analyze product performance
   */
  async analyzeProductPerformance(): Promise<ProductPerformance[]> {
    const feedback = await this.getAll();

    const productStats = new Map<string, {
      total: number;
      correct: number;
      wrong: number;
      not_planted: number;
      needs_review: number;
      confidenceSum: number;
      confusedWith: Map<string, number>;
    }>();

    for (const f of feedback) {
      const sku = f.ai_prediction.product_sku;

      if (!productStats.has(sku)) {
        productStats.set(sku, {
          total: 0,
          correct: 0,
          wrong: 0,
          not_planted: 0,
          needs_review: 0,
          confidenceSum: 0,
          confusedWith: new Map(),
        });
      }

      const stats = productStats.get(sku)!;
      stats.total++;
      stats.confidenceSum += f.ai_prediction.confidence;

      switch (f.human_feedback) {
        case 'correct':
          stats.correct++;
          break;
        case 'wrong_product':
          stats.wrong++;
          if (f.correct_product_sku) {
            stats.confusedWith.set(
              f.correct_product_sku,
              (stats.confusedWith.get(f.correct_product_sku) || 0) + 1
            );
          }
          break;
        case 'not_planted':
          stats.not_planted++;
          break;
        case 'needs_review':
          stats.needs_review++;
          break;
      }
    }

    return Array.from(productStats.entries())
      .map(([sku, stats]) => ({
        product_sku: sku,
        total_predictions: stats.total,
        correct_predictions: stats.correct,
        wrong_predictions: stats.wrong,
        not_planted_count: stats.not_planted,
        needs_review_count: stats.needs_review,
        accuracy_rate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        avg_confidence: stats.total > 0 ? Math.round(stats.confidenceSum / stats.total) : 0,
        common_confusion_with: stats.confusedWith.size > 0
          ? Array.from(stats.confusedWith.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([confused_sku]) => confused_sku)
          : undefined,
      }))
      .sort((a, b) => b.total_predictions - a.total_predictions);
  }
}

export const aiFeedback = new AIFeedbackCollection();
