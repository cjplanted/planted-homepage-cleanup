import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthContext } from '@/app/providers/AuthProvider';
import { MainLayout } from '@/shared/components/Layout/MainLayout';
import { LoadingState } from '@/shared/components/LoadingState';

// Pages - Minimal 3-tab structure
import { LoginPage } from '@/pages/LoginPage';
import { ReviewQueuePage } from '@/pages/ReviewQueuePage';
import { LiveWebsitePage } from '@/pages/LiveWebsitePage';
import { LiveVenuesPage } from '@/pages/LiveVenuesPage';
import { StatsPage } from '@/pages/StatsPage';

/**
 * Protected Route Component
 *
 * Wraps protected routes to require authentication.
 * Redirects to login if not authenticated.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) {
    return <LoadingState message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
}

/**
 * Public Route Component
 *
 * Wraps public routes (like login).
 * Redirects to dashboard if already authenticated.
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) {
    return <LoadingState message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Minimal 3-Tab Router
 *
 * Tab 1: Approve Queue (/) - Main approval workflow
 * Tab 2: Live Website (/live) - Published venues and sync
 * Tab 3: Stats (/stats) - Budget and performance metrics
 */
export const router = createBrowserRouter([
  // Public Routes
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },

  // Tab 1: Approve Queue (default)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <ReviewQueuePage />
      </ProtectedRoute>
    ),
  },

  // Tab 2: Live Website
  {
    path: '/live',
    element: (
      <ProtectedRoute>
        <LiveWebsitePage />
      </ProtectedRoute>
    ),
  },

  // Live Venues Browser
  {
    path: '/live-venues',
    element: (
      <ProtectedRoute>
        <LiveVenuesPage />
      </ProtectedRoute>
    ),
  },

  // Tab 3: Stats
  {
    path: '/stats',
    element: (
      <ProtectedRoute>
        <StatsPage />
      </ProtectedRoute>
    ),
  },

  // Catch-all - redirect to approve queue
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
