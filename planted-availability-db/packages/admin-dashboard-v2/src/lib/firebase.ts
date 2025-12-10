import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Firebase Configuration
 *
 * Configuration values are loaded from environment variables.
 * Make sure to set these in your .env file.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Validate Firebase Configuration (production only)
 */
if (import.meta.env.PROD) {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId'] as const;
  const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingKeys.join(', ')}. ` +
      'Please check your .env file.'
    );
  }
}

/**
 * Initialize Firebase
 *
 * Keep this simple - Firebase handles persistence and redirect
 * processing internally. No need to manually set persistence
 * or handle redirect results here.
 */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
export default app;
