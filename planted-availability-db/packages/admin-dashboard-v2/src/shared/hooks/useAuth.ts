import { useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
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
 * Usage:
 * const { user, loading, error, signIn, signOut } = useAuth();
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setState((prev) => {
        if (prev.loading) {
          console.warn('Auth state check timed out after 10 seconds');
          return {
            user: null,
            loading: false,
            error: null,
          };
        }
        return prev;
      });
    }, 10000);

    // Handle redirect result (from Google sign-in redirect)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log('Redirect sign-in successful');
          // Auth state change listener will handle the user state update
        }
      })
      .catch((error) => {
        const authError = error as AuthError;
        console.error('Redirect result error:', authError);
        // Only set error for actual redirect failures, not for no redirect
        if (authError.code && authError.code !== 'auth/popup-closed-by-user') {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: authError.message || 'Sign-in redirect failed',
          }));
        }
      });

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        clearTimeout(timeoutId);
        setState({
          user,
          loading: false,
          error: null,
        });
      },
      (error) => {
        clearTimeout(timeoutId);
        console.error('Auth state change error:', error);
        setState({
          user: null,
          loading: false,
          error: error.message,
        });
      }
    );

    // Cleanup subscription on unmount
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  /**
   * Sign In
   */
  const signIn = async (credentials: SignInCredentials): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = 'Failed to sign in';

      // Handle common auth errors
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
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection';
          break;
        default:
          errorMessage = authError.message;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  };

  /**
   * Sign In with Google (using redirect for COOP compatibility)
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      // Use redirect instead of popup to avoid COOP issues
      // The redirect result is handled in useEffect on page load
      await signInWithRedirect(auth, googleProvider);
      // Note: This function won't return after redirect - user will be redirected to Google
    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = 'Failed to sign in with Google';

      // Handle common redirect auth errors
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
        default:
          errorMessage = authError.message || 'Failed to sign in with Google';
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  };

  /**
   * Sign Out
   */
  const signOut = async (): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await firebaseSignOut(auth);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Failed to sign out';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw new Error(errorMessage);
    }
  };

  /**
   * Get Auth Token
   */
  const getToken = async (forceRefresh = false): Promise<string | null> => {
    try {
      if (!state.user) {
        return null;
      }
      return await state.user.getIdToken(forceRefresh);
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  };

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    signIn,
    signInWithGoogle,
    signOut,
    getToken,
  };
}
