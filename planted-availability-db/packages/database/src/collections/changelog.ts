import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, generateId, createTimestamp, timestampToDate } from '../firestore.js';
import type { ChangeLog, ChangeAction, ChangeSourceType, FieldChange } from '@pad/core';

export interface ChangeLogQueryOptions {
  collection?: string;
  documentId?: string;
  action?: ChangeAction;
  sourceType?: ChangeSourceType;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}

export interface CreateChangeLogInput {
  action: ChangeAction;
  collection: string;
  document_id: string;
  changes: FieldChange[];
  source: {
    type: ChangeSourceType;
    scraper_id?: string;
    user_id?: string;
    ip?: string;
  };
  reason?: string;
}

export class ChangeLogsCollection {
  private collectionName = 'change_logs';
  private get db() {
    return getFirestore();
  }
  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): ChangeLog {
    const data = doc.data();
    return {
      id: doc.id,
      timestamp: timestampToDate(data.timestamp),
      action: data.action,
      collection: data.collection,
      document_id: data.document_id,
      changes: data.changes || [],
      source: data.source,
      reason: data.reason,
    };
  }

  protected toFirestore(data: Partial<ChangeLog>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;

    if (data.timestamp) {
      result.timestamp = createTimestamp(data.timestamp);
    }

    return result;
  }

  /**
   * Log a change
   */
  async log(input: CreateChangeLogInput): Promise<ChangeLog> {
    const id = generateId(this.collectionName);
    const now = new Date();

    const docData = this.toFirestore({
      ...input,
      id,
      timestamp: now,
    });

    await this.collection.doc(id).set(docData);

    return {
      id,
      timestamp: now,
      ...input,
    };
  }

  /**
   * Query change logs with filters
   */
  async query(options: ChangeLogQueryOptions = {}): Promise<ChangeLog[]> {
    let query = this.collection.orderBy('timestamp', 'desc');

    if (options.collection) {
      query = query.where('collection', '==', options.collection);
    }

    if (options.documentId) {
      query = query.where('document_id', '==', options.documentId);
    }

    if (options.action) {
      query = query.where('action', '==', options.action);
    }

    if (options.sourceType) {
      query = query.where('source.type', '==', options.sourceType);
    }

    if (options.fromDate) {
      query = query.where('timestamp', '>=', createTimestamp(options.fromDate));
    }

    if (options.toDate) {
      query = query.where('timestamp', '<=', createTimestamp(options.toDate));
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get changes for a specific document
   */
  async getForDocument(collection: string, documentId: string, limit: number = 50): Promise<ChangeLog[]> {
    return this.query({
      collection,
      documentId,
      limit,
    });
  }

  /**
   * Get recent changes
   */
  async getRecent(limit: number = 100): Promise<ChangeLog[]> {
    return this.query({ limit });
  }

  /**
   * Get changes by scraper
   */
  async getByScraper(scraperId: string, limit: number = 100): Promise<ChangeLog[]> {
    const snapshot = await this.collection
      .where('source.scraper_id', '==', scraperId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Get daily summary
   */
  async getDailySummary(date: Date): Promise<{
    created: number;
    updated: number;
    archived: number;
    restored: number;
    total: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const changes = await this.query({
      fromDate: startOfDay,
      toDate: endOfDay,
      limit: 10000,
    });

    return {
      created: changes.filter((c) => c.action === 'created').length,
      updated: changes.filter((c) => c.action === 'updated').length,
      archived: changes.filter((c) => c.action === 'archived').length,
      restored: changes.filter((c) => c.action === 'restored').length,
      total: changes.length,
    };
  }

  /**
   * Delete old change logs (cleanup)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const snapshot = await this.collection
      .where('timestamp', '<', createTimestamp(cutoffDate))
      .limit(500)
      .get();

    if (snapshot.empty) return 0;

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return snapshot.size;
  }
}

export const changeLogs = new ChangeLogsCollection();
