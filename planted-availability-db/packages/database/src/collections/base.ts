import type { Firestore, DocumentData, QueryDocumentSnapshot, WriteBatch } from 'firebase-admin/firestore';
import { getFirestore, createTimestamp, generateId } from '../firestore.js';

export interface BaseDocument {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export interface BatchOperation<T> {
  type: 'create' | 'update' | 'delete';
  id?: string;
  data?: Partial<T>;
}

/**
 * Base collection class with common CRUD operations
 */
export abstract class BaseCollection<T extends BaseDocument> {
  protected abstract collectionName: string;
  protected db: Firestore;

  constructor() {
    this.db = getFirestore();
  }

  protected get collection() {
    return this.db.collection(this.collectionName);
  }

  /**
   * Transform Firestore document to application type
   */
  protected abstract fromFirestore(doc: QueryDocumentSnapshot): T;

  /**
   * Transform application data to Firestore document
   */
  protected abstract toFirestore(data: Partial<T>): DocumentData;

  /**
   * Get a document by ID
   */
  async getById(id: string): Promise<T | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Get multiple documents by IDs
   */
  async getByIds(ids: string[]): Promise<T[]> {
    if (ids.length === 0) return [];

    const refs = ids.map((id) => this.collection.doc(id));
    const docs = await this.db.getAll(...refs);

    return docs
      .filter((doc) => doc.exists)
      .map((doc) => this.fromFirestore(doc as QueryDocumentSnapshot));
  }

  /**
   * Get all documents with optional pagination
   */
  async getAll(options?: QueryOptions): Promise<T[]> {
    let query = this.collection.orderBy('created_at', 'desc');

    if (options?.orderBy) {
      query = this.collection.orderBy(options.orderBy.field, options.orderBy.direction);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Create a new document
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const id = generateId(this.collectionName);
    const now = createTimestamp();

    const docData = {
      ...this.toFirestore(data as Partial<T>),
      created_at: now,
      updated_at: now,
    };

    await this.collection.doc(id).set(docData);

    const created = await this.getById(id);
    if (!created) {
      throw new Error('Failed to create document');
    }
    return created;
  }

  /**
   * Update an existing document
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Document ${id} not found`);
    }

    const updateData = {
      ...this.toFirestore(data as Partial<T>),
      updated_at: createTimestamp(),
    };

    await docRef.update(updateData);

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Failed to update document');
    }
    return updated;
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<void> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Document ${id} not found`);
    }

    await docRef.delete();
  }

  /**
   * Check if a document exists
   */
  async exists(id: string): Promise<boolean> {
    const doc = await this.collection.doc(id).get();
    return doc.exists;
  }

  /**
   * Count documents matching a query
   */
  async count(): Promise<number> {
    const snapshot = await this.collection.count().get();
    return snapshot.data().count;
  }

  /**
   * Execute batch operations
   */
  async batch(operations: BatchOperation<T>[]): Promise<void> {
    const batch: WriteBatch = this.db.batch();

    for (const op of operations) {
      const id = op.id || generateId(this.collectionName);
      const ref = this.collection.doc(id);

      switch (op.type) {
        case 'create': {
          const now = createTimestamp();
          batch.set(ref, {
            ...this.toFirestore(op.data || {}),
            created_at: now,
            updated_at: now,
          });
          break;
        }
        case 'update': {
          batch.update(ref, {
            ...this.toFirestore(op.data || {}),
            updated_at: createTimestamp(),
          });
          break;
        }
        case 'delete': {
          batch.delete(ref);
          break;
        }
      }
    }

    await batch.commit();
  }
}
