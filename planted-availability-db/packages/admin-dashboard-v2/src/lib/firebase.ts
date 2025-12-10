import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, browserLocalPersistence, setPersistence } from 'firebase/auth';

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
 * Validate Firebase Configuration
 */
function validateFirebaseConfig(): void {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ] as const;

  const missingKeys = requiredKeys.filter(
    (key) => !firebaseConfig[key]
  );

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingKeys.join(', ')}. ` +
      'Please check your .env file and ensure all VITE_FIREBASE_* variables are set.'
    );
  }
}

// Validate config on module load
if (import.meta.env.PROD) {
  validateFirebaseConfig();
}

/**
 * Initialize Firebase App
 */
let app: FirebaseApp;
let auth: Auth;

try {
  console.log('Initializing Firebase with config:', {
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
  });
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  // Set persistence to local storage for better redirect handling
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase Auth persistence set to local');
    })
    .catch((error) => {
      console.error('Failed to set auth persistence:', error);
    });

  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  throw error;
}

/**
 * Export Firebase instances
 */
export { app, auth };
export default app;
