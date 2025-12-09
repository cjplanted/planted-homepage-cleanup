import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const googleProvider = new GoogleAuthProvider();

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false, error: null });
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign in failed';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  };

  return {
    ...state,
    signIn,
    signInWithGoogle,
    signOut,
  };
}
