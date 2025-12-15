import { initializeApp, getApps, cert, type App, type Credential } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, GeoPoint, Timestamp, type Firestore } from 'firebase-admin/firestore';

let db: Firestore | null = null;
let app: App | null = null;

/**
 * Initialize Firebase Admin SDK and return Firestore instance.
 * Uses Application Default Credentials in production (Cloud Functions)
 * or service account key in development.
 */
export function initializeFirestore(options?: {
  projectId?: string;
  credential?: Credential;
}): Firestore {
  if (db) {
    return db;
  }

  // Check if already initialized
  const apps = getApps();
  if (apps.length === 0) {
    if (options?.credential) {
      app = initializeApp({
        credential: options.credential,
        projectId: options.projectId,
      });
    } else {
      // Use Application Default Credentials
      app = initializeApp({
        projectId: options?.projectId,
      });
    }
  } else {
    app = apps[0];
  }

  db = getAdminFirestore(app);

  // Configure Firestore settings
  db.settings({
    ignoreUndefinedProperties: true,
  });

  return db;
}

/**
 * Get existing Firestore instance.
 * Auto-initializes with default credentials if not already initialized.
 * This allows collection singletons to be created at module load time.
 */
export function getFirestore(): Firestore {
  if (!db) {
    // Auto-initialize with default credentials (works in Cloud Functions)
    initializeFirestore();
  }
  return db!;
}

/**
 * Create a Firestore GeoPoint from lat/lng
 */
export function createFirestoreGeoPoint(
  latitude: number,
  longitude: number
): GeoPoint {
  return new GeoPoint(latitude, longitude);
}

/**
 * Create a Firestore Timestamp from Date
 */
export function createTimestamp(date?: Date): Timestamp {
  return Timestamp.fromDate(date || new Date());
}

/**
 * Convert Firestore Timestamp to Date
 * Handles null, undefined, and plain objects without toDate method
 */
export function timestampToDate(timestamp: Timestamp | null | undefined | unknown): Date {
  if (!timestamp) {
    return new Date(); // Return current date if timestamp is null/undefined
  }
  // Check if it's a proper Firestore Timestamp with toDate method
  if (typeof (timestamp as Timestamp).toDate === 'function') {
    return (timestamp as Timestamp).toDate();
  }
  // Handle plain object with _seconds (serialized Timestamp)
  if (typeof timestamp === 'object' && '_seconds' in (timestamp as object)) {
    return new Date((timestamp as { _seconds: number })._seconds * 1000);
  }
  // Handle Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }
  // Handle numeric timestamp (milliseconds)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  // Handle string date
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  // Fallback to current date
  return new Date();
}

/**
 * Generate a new document ID
 */
export function generateId(collectionPath: string): string {
  if (!db) {
    throw new Error('Firestore not initialized');
  }
  return db.collection(collectionPath).doc().id;
}

// Export types and utilities
export { GeoPoint, Timestamp, cert };
