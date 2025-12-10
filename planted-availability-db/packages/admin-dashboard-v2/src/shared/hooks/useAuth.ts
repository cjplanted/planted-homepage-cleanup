import { useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  AuthError,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Initialize Google provider
const googleProvider = new GoogleAuthProvider();

/**
 * Auth State
 */
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

/**
 * Sign In Credentials
 */
export interface SignInCredentials {
  email: string;
  password: string;
}

/**
 * useAuth Hook
 *
 * Provides authentication state and methods for sign in/out.
 *
 * SIMPLE PATTERN: We only use onAuthStateChanged.
 * Firebase internally waits for getRedirectResult to complete
 * before firing onAuthStateChanged, so we don't need to
 * manually coordinate them.
 *
 * Usage:
 * const { user, loading, error, signIn, signOut } = useAuth();
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SIMPLE: Just listen to auth state changes
  // Firebase internally handles getRedirectResult before firing this callback
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        console.log('Auth state changed:', firebaseUser ? firebaseUser.email : 'no user');
        setUser(firebaseUser);
        setLoading(false);
        setError(null);
      },
      (authError) => {
        console.error('Auth error:', authError);
        setUser(null);
        setLoading(false);
        setError(authError.message);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Sign In with Email/Password
   */
  const signIn = async (credentials: SignInCredentials): Promise<void> => {
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      // onAuthStateChanged will handle the state update
    } catch (err) {
      const authError = err as AuthError;
      let errorMessage = 'Failed to sign in';

      switch (authError.code) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        default:
          errorMessage = authError.message || 'Failed to sign in';
      }

      setLoading(false);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  /**
   * Sign In with Google
   *
   * Uses redirect flow. After redirect:
   * 1. Page reloads
   * 2. Firebase processes the redirect result internally
   * 3. onAuthStateChanged fires with the user
   */
  const signInWithGoogle = async (): Promise<void> => {
    setError(null);
    // Don't set loading=true here - the page will redirect away
    // and when it returns, loading starts as true anyway

    try {
      await signInWithRedirect(auth, googleProvider);
      // Code after this won't execute - page redirects to Google
    } catch (err) {
      const authError = err as AuthError;
      let errorMessage = 'Failed to sign in with Google';

      switch (authError.code) {
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with the same email';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Google sign-in is not enabled';
          break;
        case 'auth/unauthorized-domain':
          errorMessage = 'This domain is not authorized for OAuth';
          break;
        default:
          errorMessage = authError.message || 'Failed to sign in with Google';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  /**
   * Sign Out
   */
  const signOut = async (): Promise<void> => {
    setError(null);

    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle the state update
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to sign out';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  /**
   * Get Auth Token
   */
  const getToken = async (forceRefresh = false): Promise<string | null> => {
    if (!user) {
      return null;
    }

    try {
      return await user.getIdToken(forceRefresh);
    } catch (err) {
      console.error('Failed to get auth token:', err);
      return null;
    }
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signIn,
    signInWithGoogle,
    signOut,
    getToken,
  };
}
