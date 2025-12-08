/**
 * Partners Collection
 *
 * Manages partner accounts for external data providers.
 * Partners can submit venue, dish, and promotion data via webhooks, email, or file uploads.
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, timestampToDate, createTimestamp, generateId } from '../firestore.js';
import type {
  Partner,
  PartnerCredentials,
  CreatePartnerInput,
  UpdatePartnerInput,
  PartnerStatus,
  PartnerType,
} from '@pad/core';
import * as crypto from 'crypto';

/**
 * Generate a secure random API key
 */
function generateApiKey(): string {
  // Format: pad_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random chars)
  const randomBytes = crypto.randomBytes(24);
  return `pad_live_${randomBytes.toString('base64url')}`;
}

/**
 * Generate a secure webhook secret
 */
function generateWebhookSecret(): string {
  // Format: whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random chars)
  const randomBytes = crypto.randomBytes(24);
  return `whsec_${randomBytes.toString('base64url')}`;
}

/**
 * Hash a secret using SHA-256 (for storage)
 * We use SHA-256 for API keys since we need fast comparison
 */
function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Partners Collection
 */
export class PartnersCollection {
  private collectionName = 'partners';
  private credentialsCollectionName = 'partner_credentials';

  private get db() {
    return getFirestore();
  }

  private get collection() {
    return this.db.collection(this.collectionName);
  }

  private get credentialsCollection() {
    return this.db.collection(this.credentialsCollectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): Partner {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      type: data.type,
      status: data.status,
      contact: data.contact,
      config: data.config,
      quality_metrics: {
        total_submissions: data.quality_metrics?.total_submissions || 0,
        accepted_submissions: data.quality_metrics?.accepted_submissions || 0,
        rejected_submissions: data.quality_metrics?.rejected_submissions || 0,
        average_confidence_score: data.quality_metrics?.average_confidence_score || 0,
        last_submission_at: data.quality_metrics?.last_submission_at
          ? timestampToDate(data.quality_metrics.last_submission_at)
          : undefined,
        data_quality_score: data.quality_metrics?.data_quality_score || 50,
      },
      rate_limits: data.rate_limits || { requests_per_hour: 1000, requests_per_day: 10000 },
      onboarded_at: data.onboarded_at ? timestampToDate(data.onboarded_at) : undefined,
      created_at: timestampToDate(data.created_at),
      updated_at: timestampToDate(data.updated_at),
    };
  }

  protected toFirestore(data: Partial<Partner>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;

    if (data.quality_metrics?.last_submission_at) {
      result.quality_metrics = {
        ...data.quality_metrics,
        last_submission_at: createTimestamp(data.quality_metrics.last_submission_at),
      };
    }

    if (data.onboarded_at) {
      result.onboarded_at = createTimestamp(data.onboarded_at);
    }
    if (data.created_at) {
      result.created_at = createTimestamp(data.created_at);
    }
    if (data.updated_at) {
      result.updated_at = createTimestamp(data.updated_at);
    }

    return result;
  }

  /**
   * Get partner by ID
   */
  async getById(id: string): Promise<Partner | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Get partner by API key
   * Used for webhook authentication
   */
  async getByApiKey(apiKey: string): Promise<Partner | null> {
    const keyHash = hashSecret(apiKey);

    const credSnapshot = await this.credentialsCollection
      .where('api_key_hash', '==', keyHash)
      .limit(1)
      .get();

    if (credSnapshot.empty) {
      return null;
    }

    const credentials = credSnapshot.docs[0].data();
    return this.getById(credentials.partner_id);
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  async verifyWebhookSignature(
    partnerId: string,
    payload: string,
    signature: string,
    timestamp: string
  ): Promise<boolean> {
    const credDoc = await this.credentialsCollection.doc(partnerId).get();
    if (!credDoc.exists) {
      return false;
    }

    const credentials = credDoc.data() as PartnerCredentials;

    // Reconstruct the signed payload
    const signedPayload = `${timestamp}.${payload}`;

    // We store the hash of the webhook secret, but for HMAC we need the original
    // So we actually store the secret itself (encrypted) - for simplicity here we'll
    // use a different approach: the partner sends signature = HMAC(timestamp.payload, secret)
    // and we verify by recomputing

    // For this implementation, we'll store the webhook_secret_hash as the actual secret
    // In production, you'd want to encrypt/decrypt this properly
    const expectedSignature = crypto
      .createHmac('sha256', credentials.webhook_secret_hash)
      .update(signedPayload)
      .digest('hex');

    // Timing-safe comparison
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Create a new partner with credentials
   * Returns the partner and plaintext credentials (only time they're available)
   */
  async create(
    data: CreatePartnerInput
  ): Promise<{ partner: Partner; apiKey: string; webhookSecret: string }> {
    const id = generateId(this.collectionName);
    const now = new Date();

    // Generate credentials
    const apiKey = generateApiKey();
    const webhookSecret = generateWebhookSecret();

    // Create partner document
    const partnerData: Partner = {
      id,
      name: data.name,
      type: data.type,
      status: data.status || 'onboarding',
      contact: data.contact,
      config: {
        data_format: data.config.data_format || 'planted_standard',
        transformer_id: data.config.transformer_id,
        auto_approve_threshold: data.config.auto_approve_threshold ?? 85,
        requires_manual_review: data.config.requires_manual_review ?? false,
        allowed_entity_types: data.config.allowed_entity_types || ['venue', 'dish', 'promotion'],
        markets: data.config.markets || [],
        callback_url: data.config.callback_url,
      },
      quality_metrics: {
        total_submissions: 0,
        accepted_submissions: 0,
        rejected_submissions: 0,
        average_confidence_score: 0,
        data_quality_score: 50, // Start at neutral
      },
      rate_limits: data.rate_limits || {
        requests_per_hour: 1000,
        requests_per_day: 10000,
      },
      created_at: now,
      updated_at: now,
    };

    // Create credentials document
    const credentialsData: PartnerCredentials = {
      partner_id: id,
      api_key_hash: hashSecret(apiKey),
      webhook_secret_hash: webhookSecret, // Store actual secret for HMAC
      email_whitelist: [],
      last_rotated_at: now,
      created_at: now,
    };

    // Write both in a batch
    const batch = this.db.batch();
    batch.set(this.collection.doc(id), this.toFirestore(partnerData));
    batch.set(this.credentialsCollection.doc(id), {
      ...credentialsData,
      last_rotated_at: createTimestamp(now),
      created_at: createTimestamp(now),
    });
    await batch.commit();

    return {
      partner: partnerData,
      apiKey,
      webhookSecret,
    };
  }

  /**
   * Update a partner
   */
  async update(id: string, data: UpdatePartnerInput): Promise<Partner> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Partner ${id} not found`);
    }

    const updateData = {
      ...this.toFirestore(data as Partial<Partner>),
      updated_at: createTimestamp(new Date()),
    };

    await docRef.update(updateData);

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Failed to update partner');
    }
    return updated;
  }

  /**
   * Activate a partner (complete onboarding)
   */
  async activate(id: string): Promise<Partner> {
    return this.update(id, {
      status: 'active',
      onboarded_at: new Date(),
    });
  }

  /**
   * Suspend a partner
   */
  async suspend(id: string, reason?: string): Promise<Partner> {
    // Could also log the reason to audit log
    return this.update(id, { status: 'suspended' });
  }

  /**
   * Rotate API credentials
   * Returns new credentials and sets grace period for old ones
   */
  async rotateCredentials(
    id: string
  ): Promise<{ apiKey: string; webhookSecret: string; oldCredentialsValidUntil: Date }> {
    const partner = await this.getById(id);
    if (!partner) {
      throw new Error(`Partner ${id} not found`);
    }

    const apiKey = generateApiKey();
    const webhookSecret = generateWebhookSecret();
    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Update credentials
    await this.credentialsCollection.doc(id).update({
      api_key_hash: hashSecret(apiKey),
      webhook_secret_hash: webhookSecret,
      last_rotated_at: createTimestamp(now),
      // Store old credentials for grace period
      old_api_key_hash: (await this.credentialsCollection.doc(id).get()).data()?.api_key_hash,
      old_credentials_valid_until: createTimestamp(gracePeriodEnd),
    });

    return {
      apiKey,
      webhookSecret,
      oldCredentialsValidUntil: gracePeriodEnd,
    };
  }

  /**
   * Update email whitelist for a partner
   */
  async updateEmailWhitelist(id: string, domains: string[]): Promise<void> {
    await this.credentialsCollection.doc(id).update({
      email_whitelist: domains.map((d) => d.toLowerCase().trim()),
    });
  }

  /**
   * Check if email is allowed for a partner
   */
  async isEmailAllowed(partnerId: string, email: string): Promise<boolean> {
    const credDoc = await this.credentialsCollection.doc(partnerId).get();
    if (!credDoc.exists) {
      return false;
    }

    const credentials = credDoc.data() as PartnerCredentials;
    const emailDomain = email.split('@')[1]?.toLowerCase();

    if (!emailDomain || !credentials.email_whitelist?.length) {
      return false;
    }

    return credentials.email_whitelist.includes(emailDomain);
  }

  /**
   * Record a submission for quality metrics
   */
  async recordSubmission(
    id: string,
    stats: {
      accepted: number;
      rejected: number;
      averageConfidence: number;
    }
  ): Promise<void> {
    const partner = await this.getById(id);
    if (!partner) {
      throw new Error(`Partner ${id} not found`);
    }

    const metrics = partner.quality_metrics;
    const totalSubmissions = metrics.total_submissions + 1;
    const totalAccepted = metrics.accepted_submissions + stats.accepted;
    const totalRejected = metrics.rejected_submissions + stats.rejected;

    // Calculate rolling average confidence
    const newAvgConfidence =
      (metrics.average_confidence_score * metrics.total_submissions + stats.averageConfidence) /
      totalSubmissions;

    // Calculate data quality score based on acceptance rate and confidence
    const acceptanceRate = totalAccepted / Math.max(totalAccepted + totalRejected, 1);
    const dataQualityScore = Math.round(acceptanceRate * 50 + newAvgConfidence * 0.5);

    await this.update(id, {
      quality_metrics: {
        total_submissions: totalSubmissions,
        accepted_submissions: totalAccepted,
        rejected_submissions: totalRejected,
        average_confidence_score: Math.round(newAvgConfidence),
        last_submission_at: new Date(),
        data_quality_score: Math.min(100, Math.max(0, dataQualityScore)),
      },
    });
  }

  /**
   * List partners with filters
   */
  async list(options?: {
    status?: PartnerStatus;
    type?: PartnerType;
    limit?: number;
    offset?: number;
  }): Promise<Partner[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options?.status) {
      query = query.where('status', '==', options.status);
    }

    if (options?.type) {
      query = query.where('type', '==', options.type);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get partner statistics summary
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<PartnerStatus, number>;
    byType: Record<PartnerType, number>;
    avgQualityScore: number;
  }> {
    const snapshot = await this.collection.get();
    const partners = snapshot.docs.map((doc) => this.fromFirestore(doc));

    const byStatus: Record<PartnerStatus, number> = {
      onboarding: 0,
      active: 0,
      suspended: 0,
      inactive: 0,
    };

    const byType: Record<PartnerType, number> = {
      chain: 0,
      independent: 0,
      distributor: 0,
      aggregator: 0,
    };

    let totalQuality = 0;

    for (const partner of partners) {
      byStatus[partner.status]++;
      byType[partner.type]++;
      totalQuality += partner.quality_metrics.data_quality_score;
    }

    return {
      total: partners.length,
      byStatus,
      byType,
      avgQualityScore: partners.length > 0 ? Math.round(totalQuality / partners.length) : 0,
    };
  }
}

export const partners = new PartnersCollection();
