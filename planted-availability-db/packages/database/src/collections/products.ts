import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';
import { getFirestore } from '../firestore.js';
import type { Product, ProductCategory } from '@pad/core';

export interface ProductQueryOptions {
  category?: ProductCategory;
  market?: string;
  activeOnly?: boolean;
  retailOnly?: boolean;
  limit?: number;
}

/**
 * Products collection (uses SKU as document ID)
 */
export class ProductsCollection {
  private collectionName = 'products';
  private get db() {
    return getFirestore();
  }
  private get collection() {
    return this.db.collection(this.collectionName);
  }

  protected fromFirestore(doc: QueryDocumentSnapshot): Product {
    const data = doc.data();
    return {
      sku: doc.id,
      name: data.name,
      category: data.category,
      variant: data.variant,
      weight_grams: data.weight_grams,
      image_url: data.image_url,
      markets: data.markets || [],
      retail_only: data.retail_only ?? false,
      active: data.active ?? true,
    };
  }

  protected toFirestore(data: Partial<Product>): DocumentData {
    const result: DocumentData = { ...data };
    // Remove sku as it's the document ID
    delete result.sku;
    return result;
  }

  /**
   * Get product by SKU
   */
  async getBySku(sku: string): Promise<Product | null> {
    const doc = await this.collection.doc(sku).get();
    if (!doc.exists) {
      return null;
    }
    return this.fromFirestore(doc as QueryDocumentSnapshot);
  }

  /**
   * Get multiple products by SKUs
   */
  async getBySkus(skus: string[]): Promise<Product[]> {
    if (skus.length === 0) return [];

    const refs = skus.map((sku) => this.collection.doc(sku));
    const docs = await this.db.getAll(...refs);

    return docs
      .filter((doc) => doc.exists)
      .map((doc) => this.fromFirestore(doc as QueryDocumentSnapshot));
  }

  /**
   * Get all products with optional filters
   */
  async query(options: ProductQueryOptions = {}): Promise<Product[]> {
    let query = this.collection.orderBy('category');

    if (options.category) {
      query = query.where('category', '==', options.category);
    }

    if (options.market) {
      query = query.where('markets', 'array-contains', options.market);
    }

    if (options.activeOnly !== false) {
      query = query.where('active', '==', true);
    }

    if (options.retailOnly === true) {
      query = query.where('retail_only', '==', true);
    } else if (options.retailOnly === false) {
      query = query.where('retail_only', '==', false);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.fromFirestore(doc));
  }

  /**
   * Create or update a product
   */
  async upsert(product: Product): Promise<Product> {
    await this.collection.doc(product.sku).set(this.toFirestore(product), { merge: true });
    return product;
  }

  /**
   * Bulk upsert products (useful for seeding)
   */
  async bulkUpsert(products: Product[]): Promise<void> {
    const batch = this.db.batch();

    for (const product of products) {
      const ref = this.collection.doc(product.sku);
      batch.set(ref, this.toFirestore(product), { merge: true });
    }

    await batch.commit();
  }

  /**
   * Deactivate a product
   */
  async deactivate(sku: string): Promise<void> {
    await this.collection.doc(sku).update({ active: false });
  }

  /**
   * Get all active SKUs
   */
  async getAllActiveSkus(): Promise<string[]> {
    const snapshot = await this.collection
      .where('active', '==', true)
      .select()
      .get();

    return snapshot.docs.map((doc) => doc.id);
  }

  /**
   * Count products by category
   */
  async countByCategory(): Promise<Record<string, number>> {
    const snapshot = await this.collection.where('active', '==', true).get();
    const products = snapshot.docs.map((doc) => this.fromFirestore(doc));

    return products.reduce(
      (acc, product) => {
        acc[product.category] = (acc[product.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}

export const products = new ProductsCollection();
