import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase-admin/firestore';
import { BaseCollection } from './base.js';
import type {
  DishFeedback,
  CreateDishFeedbackInput,
  DishFeedbackResultType,
  DishFeedbackDetails,
} from '@pad/core';

/**
 * Collection for human feedback on discovered dishes (reinforcement learning)
 */
class DishFeedbackCollection extends BaseCollection<DishFeedback> {
  protected collectionName = 'dish_feedback';

  protected fromFirestore(doc: QueryDocumentSnapshot): DishFeedback {
    const data = doc.data();
    return {
      id: doc.id,
      discovered_dish_id: data.discovered_dish_id,
      strategy_id: data.strategy_id,
      result_type: data.result_type,
      feedback_details: data.feedback_details,
      reviewed_by: data.reviewed_by,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      reviewed_at: data.reviewed_at ? (data.reviewed_at as Timestamp).toDate() : undefined,
    };
  }

  protected toFirestore(data: Partial<DishFeedback>): DocumentData {
    const doc: DocumentData = {};

    if (data.discovered_dish_id !== undefined) doc.discovered_dish_id = data.discovered_dish_id;
    if (data.strategy_id !== undefined) doc.strategy_id = data.strategy_id;
    if (data.result_type !== undefined) doc.result_type = data.result_type;
    if (data.feedback_details !== undefined) doc.feedback_details = data.feedback_details;
    if (data.reviewed_by !== undefined) doc.reviewed_by = data.reviewed_by;
    if (data.reviewed_at !== undefined) doc.reviewed_at = data.reviewed_at;

    return doc;
  }

  /**
   * Record feedback for a dish
   */
  async recordFeedback(input: CreateDishFeedbackInput): Promise<DishFeedback> {
    return this.create({
      ...input,
      reviewed_at: new Date(),
    });
  }

  /**
   * Get feedback for a specific dish
   */
  async getByDish(dishId: string): Promise<DishFeedback[]> {
    const snapshot = await this.collection
      .where('discovered_dish_id', '==', dishId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get feedback by strategy (for learning)
   */
  async getByStrategy(strategyId: string): Promise<DishFeedback[]> {
    const snapshot = await this.collection
      .where('strategy_id', '==', strategyId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get recent feedback for learning
   */
  async getForLearning(days: number = 7): Promise<DishFeedback[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const snapshot = await this.collection
      .where('created_at', '>=', cutoffDate)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get strategy performance based on feedback
   */
  async getStrategyPerformance(strategyId: string): Promise<{
    total: number;
    correct: number;
    wrong_product: number;
    wrong_price: number;
    not_planted: number;
    success_rate: number;
  }> {
    const feedback = await this.getByStrategy(strategyId);

    const counts = {
      total: feedback.length,
      correct: 0,
      wrong_product: 0,
      wrong_price: 0,
      not_planted: 0,
    };

    for (const f of feedback) {
      switch (f.result_type) {
        case 'correct':
          counts.correct++;
          break;
        case 'wrong_product':
          counts.wrong_product++;
          break;
        case 'wrong_price':
          counts.wrong_price++;
          break;
        case 'not_planted':
          counts.not_planted++;
          break;
      }
    }

    return {
      ...counts,
      success_rate: counts.total > 0 ? Math.round((counts.correct / counts.total) * 100) : 0,
    };
  }

  /**
   * Get overall statistics
   */
  async getStats(): Promise<{
    total: number;
    by_result_type: Record<DishFeedbackResultType, number>;
    by_strategy: Record<string, number>;
    overall_success_rate: number;
    reviewed_today: number;
  }> {
    const all = await this.getAll();

    const byResultType: Record<DishFeedbackResultType, number> = {
      correct: 0,
      wrong_product: 0,
      wrong_price: 0,
      wrong_name: 0,
      not_planted: 0,
      not_found: 0,
      error: 0,
    };

    const byStrategy: Record<string, number> = {};
    let correctCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let reviewedToday = 0;

    for (const f of all) {
      byResultType[f.result_type]++;

      if (f.strategy_id) {
        byStrategy[f.strategy_id] = (byStrategy[f.strategy_id] || 0) + 1;
      }

      if (f.result_type === 'correct') {
        correctCount++;
      }

      if (f.created_at >= today) {
        reviewedToday++;
      }
    }

    return {
      total: all.length,
      by_result_type: byResultType,
      by_strategy: byStrategy,
      overall_success_rate: all.length > 0 ? Math.round((correctCount / all.length) * 100) : 0,
      reviewed_today: reviewedToday,
    };
  }

  /**
   * Get feedback patterns for learning (groups common issues)
   */
  async getFeedbackPatterns(): Promise<{
    common_wrong_products: Array<{ from: string; to: string; count: number }>;
    problematic_strategies: Array<{ strategy_id: string; error_rate: number; count: number }>;
  }> {
    const feedback = await this.getAll();

    // Track wrong product corrections
    const productCorrections = new Map<string, number>();

    for (const f of feedback) {
      if (f.result_type === 'wrong_product' && f.feedback_details?.corrected_product) {
        // We'd need to look up the original dish to get the original product
        // For now, just track that corrections happened
        const key = `correction_${f.feedback_details.corrected_product}`;
        productCorrections.set(key, (productCorrections.get(key) || 0) + 1);
      }
    }

    // Track strategy error rates
    const strategyStats = new Map<string, { errors: number; total: number }>();

    for (const f of feedback) {
      if (!f.strategy_id) continue;

      const stats = strategyStats.get(f.strategy_id) || { errors: 0, total: 0 };
      stats.total++;

      if (f.result_type !== 'correct') {
        stats.errors++;
      }

      strategyStats.set(f.strategy_id, stats);
    }

    const problematicStrategies = Array.from(strategyStats.entries())
      .map(([strategy_id, stats]) => ({
        strategy_id,
        error_rate: Math.round((stats.errors / stats.total) * 100),
        count: stats.total,
      }))
      .filter((s) => s.error_rate > 30 && s.count >= 5) // At least 30% errors, 5+ uses
      .sort((a, b) => b.error_rate - a.error_rate);

    return {
      common_wrong_products: Array.from(productCorrections.entries())
        .map(([key, count]) => ({
          from: 'unknown', // Would need dish lookup
          to: key.replace('correction_', ''),
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      problematic_strategies: problematicStrategies.slice(0, 10),
    };
  }
}

export const dishFeedback = new DishFeedbackCollection();
