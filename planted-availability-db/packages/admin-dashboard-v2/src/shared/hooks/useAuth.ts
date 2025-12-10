import { useEffect, useState, useRef } from 'react';
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
  const redirectHandled = useRef(false);

  useEffect(() => {
    console.log('useAuth: Starting auth initialization');

    // Handle redirect result first (only once)
    if (!redirectHandled.current) {
      redirectHandled.current = true;
      console.log('useAuth: Checking for redirect result...');

      getRedirectResult(auth)
        .then((result) => {
          if (result) {
            console.log('useAuth: Redirect sign-in successful', result.user.email);
            // onAuthStateChanged will handle the state update
          } else {
            console.log('useAuth: No redirect result (normal page load)');
          }
        })
        .catch((error) => {
          console.error('useAuth: Redirect result error:', error);
          const authError = error as AuthError;
          let errorMessage = 'Failed to complete sign-in';

          switch (authError.code) {
            case 'auth/account-exists-with-different-credential':
              errorMessage = 'An account already exists with the same email';
              break;
            case 'auth/credential-already-in-use':
              errorMessage = 'This credential is already linked to another account';
              break;
            case 'auth/user-disabled':
              errorMessage = 'This account has been disabled';
              break;
            default:
              errorMessage = authError.message || 'Failed to complete sign-in';
          }

          setState((prev) => ({
            ...prev,
            loading: false,
            error: errorMessage,
          }));
        });
    }

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        console.log('useAuth: onAuthStateChanged fired', user ? `user: ${user.email}` : 'no user');
        setState({
          user,
          loading: false,
          error: null,
        });
      },
      (error) => {
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
      console.log('useAuth: Cleaning up');
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
   * Sign In with Google (uses redirect for better cross-origin compatibility)
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      console.log('useAuth: Starting Google sign-in redirect...');
      // This will redirect to Google, then back to the app
      // getRedirectResult() in useEffect will handle the result
      await signInWithRedirect(auth, googleProvider);
      // Note: Code after signInWithRedirect won't execute as the page redirects
    } catch (error) {
      const authError = error as AuthError;
      let errorMessage = 'Failed to sign in with Google';

      // Handle common auth errors
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
          errorMessage = 'This domain is not authorized for OAuth. Check Firebase console.';
          break;
        default:
          errorMessage = authError.message || 'Failed to sign in with Google';
      }

      console.error('useAuth: Google sign-in error:', errorMessage);
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
