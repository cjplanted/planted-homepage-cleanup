/**
 * AI Feedback Types
 *
 * Types for collecting human feedback on AI predictions to support
 * reinforcement learning and improve model accuracy over time.
 */

export type AIFeedbackType = 'correct' | 'wrong_product' | 'not_planted' | 'needs_review';

export interface AIPrediction {
  product_sku: string;
  confidence: number; // 0-100
  factors: string[]; // Reasons for the prediction
}

export interface AIFeedback {
  id: string;

  // References
  dish_id?: string; // Reference to dishes collection
  venue_id?: string; // Reference to venues collection
  discovered_venue_id?: string; // Reference to discovered_venues collection
  discovered_dish_id?: string; // Reference to discovered_dishes collection

  // AI Prediction
  ai_prediction: AIPrediction;

  // Human Feedback
  human_feedback: AIFeedbackType;
  correct_product_sku?: string; // If wrong_product, what's the correct SKU
  feedback_notes?: string; // Additional notes from reviewer

  // Reviewer
  reviewer_id: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export type CreateAIFeedbackInput = Omit<AIFeedback, 'id' | 'created_at' | 'updated_at'>;

/**
 * Feedback Statistics
 */
export interface FeedbackStats {
  total: number;
  by_feedback_type: Record<AIFeedbackType, number>;
  by_product_sku: Record<string, {
    correct: number;
    wrong: number;
    accuracy_rate: number;
  }>;
  overall_accuracy_rate: number;
  reviewed_today: number;
  reviewed_this_week: number;
  reviewed_this_month: number;
}

/**
 * Training Data Export
 */
export interface TrainingDataExport {
  feedback: AIFeedback[];
  stats: {
    total_records: number;
    date_range: {
      from: Date;
      to: Date;
    };
    by_feedback_type: Record<AIFeedbackType, number>;
    accuracy_by_confidence_bucket: {
      low: { total: number; correct: number; rate: number }; // 0-40
      medium: { total: number; correct: number; rate: number }; // 40-70
      high: { total: number; correct: number; rate: number }; // 70-100
    };
  };
  export_date: Date;
}

/**
 * Confidence Analysis
 */
export interface ConfidenceAnalysis {
  confidence_bucket: 'low' | 'medium' | 'high';
  range: { min: number; max: number };
  total_predictions: number;
  correct_predictions: number;
  accuracy_rate: number;
  common_factors: Array<{
    factor: string;
    frequency: number;
    accuracy_rate: number;
  }>;
}

/**
 * Product Performance
 */
export interface ProductPerformance {
  product_sku: string;
  total_predictions: number;
  correct_predictions: number;
  wrong_predictions: number;
  not_planted_count: number;
  needs_review_count: number;
  accuracy_rate: number;
  avg_confidence: number;
  common_confusion_with?: string[]; // Other SKUs often confused with this one
}
