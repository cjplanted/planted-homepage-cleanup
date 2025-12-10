import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthContext } from '@/app/providers/AuthProvider';
import { MainLayout } from '@/shared/components/Layout/MainLayout';
import { LoadingState } from '@/shared/components/LoadingState';

// Pages
import { LoginPage } from '@/pages/LoginPage';
import { ScrapeControlPage } from '@/pages/ScrapeControlPage';
import { ReviewQueuePage } from '@/pages/ReviewQueuePage';
import { LiveVenuesPage } from '@/pages/LiveVenuesPage';
import { CostsPage } from '@/pages/CostsPage';

// Workflow Pages
import { DashboardPage as WorkflowDashboard } from '@/pages/workflow/DashboardPage';
import { ScrapeControlPage as WorkflowScrapeControl } from '@/pages/workflow/ScrapeControlPage';
import { SyncPage } from '@/pages/workflow/SyncPage';

// Browser Pages
import { VenueBrowserPage } from '@/pages/browser/VenueBrowserPage';

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
 * Application Router
 *
 * Defines all routes for the application.
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

  // Protected Routes - Workflow Section
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <WorkflowDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/workflow/dashboard',
    element: (
      <ProtectedRoute>
        <WorkflowDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/workflow/scrape-control',
    element: (
      <ProtectedRoute>
        <WorkflowScrapeControl />
      </ProtectedRoute>
    ),
  },
  {
    path: '/scrape-control',
    element: (
      <ProtectedRoute>
        <ScrapeControlPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/review',
    element: (
      <ProtectedRoute>
        <ReviewQueuePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/review-queue',
    element: (
      <ProtectedRoute>
        <ReviewQueuePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/sync',
    element: (
      <ProtectedRoute>
        <SyncPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/workflow/sync',
    element: (
      <ProtectedRoute>
        <SyncPage />
      </ProtectedRoute>
    ),
  },

  // Protected Routes - Browser Section
  {
    path: '/venues',
    element: (
      <ProtectedRoute>
        <VenueBrowserPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/browser',
    element: (
      <ProtectedRoute>
        <VenueBrowserPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/live-venues',
    element: (
      <ProtectedRoute>
        <LiveVenuesPage />
      </ProtectedRoute>
    ),
  },

  // Protected Routes - Operations Section
  {
    path: '/costs',
    element: (
      <ProtectedRoute>
        <CostsPage />
      </ProtectedRoute>
    ),
  },

  // Catch-all - redirect to dashboard
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
