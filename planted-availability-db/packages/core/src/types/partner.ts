/**
 * Partner Types
 *
 * Partners are external data providers who submit venue, dish, and promotion data.
 * This module defines the types for partner management and data ingestion.
 */

export type PartnerType = 'chain' | 'independent' | 'distributor' | 'aggregator';
export type PartnerStatus = 'onboarding' | 'active' | 'suspended' | 'inactive';
export type EntityType = 'venue' | 'dish' | 'promotion' | 'availability';

/**
 * Partner - External data provider
 */
export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  status: PartnerStatus;

  // Contact information
  contact: {
    primary_name: string;
    primary_email: string;
    technical_email?: string;
    phone?: string;
  };

  // Configuration
  config: {
    /** Data format: 'planted_standard' or 'custom' with transformer */
    data_format: 'planted_standard' | 'custom';
    /** Custom transformer ID if data_format is 'custom' */
    transformer_id?: string;
    /** Confidence threshold for auto-approval (0-100) */
    auto_approve_threshold: number;
    /** Force manual review for all submissions */
    requires_manual_review: boolean;
    /** Allowed entity types this partner can submit */
    allowed_entity_types: EntityType[];
    /** Allowed country codes (ISO 3166-1 alpha-2) */
    markets: string[];
    /** Webhook URL for status callbacks (optional) */
    callback_url?: string;
  };

  // Quality metrics (updated automatically)
  quality_metrics: {
    total_submissions: number;
    accepted_submissions: number;
    rejected_submissions: number;
    average_confidence_score: number;
    last_submission_at?: Date;
    /** Overall quality score 0-100 */
    data_quality_score: number;
  };

  // Rate limiting
  rate_limits: {
    requests_per_hour: number;
    requests_per_day: number;
  };

  // Timestamps
  onboarded_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Partner credentials (stored separately for security)
 * API key and webhook secret are only returned once during creation
 */
export interface PartnerCredentials {
  partner_id: string;
  /** Hashed API key (bcrypt) */
  api_key_hash: string;
  /** Hashed webhook secret for HMAC signatures (bcrypt) */
  webhook_secret_hash: string;
  /** Allowed email domains for email-based submissions */
  email_whitelist: string[];
  /** IP whitelist (optional, for extra security) */
  ip_whitelist?: string[];
  /** Last key rotation date */
  last_rotated_at: Date;
  created_at: Date;
}

/**
 * Ingestion batch - tracks each data submission
 */
export interface IngestionBatch {
  id: string;
  partner_id: string;

  // Source information
  source: {
    channel: 'webhook' | 'email' | 'file_upload' | 'agent' | 'manual';
    /** Idempotency key to prevent duplicate processing */
    idempotency_key?: string;
    /** Firebase Storage reference to raw payload */
    raw_payload_ref?: string;
    file_name?: string;
    file_type?: string;
    email_message_id?: string;
    /** User ID for manual/agent submissions */
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
  };

  // Processing status
  status: BatchStatus;

  // Statistics
  stats: {
    records_received: number;
    records_valid: number;
    records_invalid: number;
    records_staged: number;
    records_approved: number;
    records_rejected: number;
  };

  // Processing metadata
  processing: {
    started_at?: Date;
    completed_at?: Date;
    transformer_version?: string;
    validation_errors?: ValidationError[];
    transform_warnings?: string[];
  };

  // Review information
  review?: {
    required: boolean;
    reviewed_by?: string;
    reviewed_at?: Date;
    review_notes?: string;
    decision?: 'approved' | 'rejected' | 'partial';
  };

  // Timestamps
  received_at: Date;
  created_at: Date;
  updated_at: Date;
}

export type BatchStatus =
  | 'received'
  | 'validating'
  | 'transforming'
  | 'staging'
  | 'scoring'
  | 'pending_review'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'failed';

export type StagingStatus =
  | 'pending'
  | 'validating'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'promoted';

export interface ValidationError {
  record_index: number;
  field: string;
  error: string;
  value?: unknown;
}

/**
 * Staged entity base - common fields for all staged records
 */
export interface StagedEntityBase {
  id: string;
  batch_id: string;
  partner_id: string;
  /** Partner's internal ID for this record */
  external_id?: string;

  status: StagingStatus;

  // Confidence scoring
  /** Overall confidence score 0-100 */
  confidence_score: number;
  /** Breakdown of confidence by category */
  confidence_breakdown?: Record<string, number>;
  /** Flags indicating issues or concerns */
  flags: string[];

  // Review
  review?: {
    reviewed_by: string;
    reviewed_at?: Date;
    decision: 'approved' | 'rejected';
    notes?: string;
  };

  created_at: Date;
  updated_at: Date;
}

/**
 * Review queue item
 */
export interface ReviewQueueItem {
  id: string;
  entity_type: EntityType | 'batch';
  entity_id: string;
  batch_id: string;
  partner_id: string;

  priority: 'critical' | 'high' | 'normal' | 'low';
  status: 'pending' | 'in_progress' | 'completed';

  review_reason:
    | 'low_confidence'
    | 'conflict'
    | 'new_partner'
    | 'high_value'
    | 'suspicious'
    | 'manual_flag'
    | 'policy';

  summary: string;
  confidence_score: number;
  conflict_details?: {
    existing_id: string;
    conflicting_fields: string[];
  };

  assigned_to?: string;
  assigned_at?: Date;

  resolved_by?: string;
  resolved_at?: Date;
  resolution?: 'approved' | 'rejected' | 'merged' | 'deferred';
  resolution_notes?: string;

  created_at: Date;
  updated_at: Date;
  due_at?: Date;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;

  action:
    | 'partner_created'
    | 'partner_updated'
    | 'credentials_rotated'
    | 'ingestion_received'
    | 'validation_completed'
    | 'staging_completed'
    | 'review_started'
    | 'review_completed'
    | 'approved'
    | 'rejected'
    | 'promoted'
    | 'conflict_resolved'
    | 'manual_edit';

  entity_type: 'batch' | 'venue' | 'dish' | 'promotion' | 'availability' | 'partner';
  entity_id: string;
  batch_id?: string;
  partner_id?: string;

  actor: {
    type: 'system' | 'user' | 'partner' | 'scheduler';
    id?: string;
    ip?: string;
    user_agent?: string;
  };

  changes?: {
    field: string;
    before: unknown;
    after: unknown;
  }[];

  metadata?: Record<string, unknown>;
  notes?: string;
}

// Input types for creating/updating
export type CreatePartnerInput = Omit<
  Partner,
  'id' | 'quality_metrics' | 'created_at' | 'updated_at'
> & {
  quality_metrics?: Partial<Partner['quality_metrics']>;
};

export type UpdatePartnerInput = Partial<Omit<Partner, 'id' | 'created_at' | 'updated_at'>>;
