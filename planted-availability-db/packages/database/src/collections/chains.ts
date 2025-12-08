import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore, generateId } from '../firestore.js';
import type { Chain, ChainType, PartnershipLevel } from '@pad/core';

export interface ChainQueryOptions {
  type?: ChainType;
  market?: string;
  partnershipLevel?: PartnershipLevel;
  limit?: number;
}

export class ChainsCollection {
  private collectionName = 'chains';
  private get db() {
    return getFirestore();
  }
  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): Chain {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      type: data.type,
      logo_url: data.logo_url,
      website: data.website,
      markets: data.markets || [],
      partnership_level: data.partnership_level,
      contact: data.contact,
    };
  }

  protected toFirestore(data: Partial<Chain>): DocumentData {
    const result: DocumentData = { ...data };
    delete result.id;
    return result;
  }

  /**
   * Get chain by ID
   */
  async getById(id: string): Promise<Chain | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Get multiple chains by IDs
   */
  async getByIds(ids: string[]): Promise<Chain[]> {
    if (ids.length === 0) return [];

    const refs = ids.map((id) => this.collection.doc(id));
    const docs = await this.db.getAll(...refs);

    return docs
      .filter((doc) => doc.exists)
      .map((doc) => this.fromFirestore(doc as QueryDocumentSnapshot));
  }

  /**
   * Get all chains with optional filters
   */
  async query(options: ChainQueryOptions = {}): Promise<Chain[]> {
    let query = this.collection.orderBy('name');

    if (options.type) {
      query = query.where('type', '==', options.type);
    }

    if (options.market) {
      query = query.where('markets', 'array-contains', options.market);
    }

    if (options.partnershipLevel) {
      query = query.where('partnership_level', '==', options.partnershipLevel);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Create a new chain
   */
  async create(data: Omit<Chain, 'id'>): Promise<Chain> {
    const id = generateId(this.collectionName);
    const docData = this.toFirestore({ ...data, id });

    await this.collection.doc(id).set(docData);

    return { id, ...data };
  }

  /**
   * Update a chain
   */
  async update(id: string, data: Partial<Omit<Chain, 'id'>>): Promise<Chain> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Chain ${id} not found`);
    }

    await docRef.update(this.toFirestore(data));

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('Failed to update chain');
    }
    return updated;
  }

  /**
   * Delete a chain
   */
  async delete(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }

  /**
   * Find chain by name (case-insensitive)
   */
  async findByName(name: string): Promise<Chain | null> {
    const normalizedName = name.toLowerCase();

    // Firestore doesn't support case-insensitive queries
    // So we need to fetch all and filter
    const snapshot = await this.collection.get();
    const chains = snapshot.docs.map((doc) => this.fromFirestore(doc));

    return chains.find((chain) => chain.name.toLowerCase() === normalizedName) || null;
  }

  /**
   * Get retail chains
   */
  async getRetailChains(market?: string): Promise<Chain[]> {
    return this.query({
      type: 'retail',
      market,
    });
  }

  /**
   * Get restaurant chains
   */
  async getRestaurantChains(market?: string): Promise<Chain[]> {
    return this.query({
      type: 'restaurant',
      market,
    });
  }
}

export const chains = new ChainsCollection();
