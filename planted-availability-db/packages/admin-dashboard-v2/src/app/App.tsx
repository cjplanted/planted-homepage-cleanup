import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { router } from '@/app/routes/router';

/**
 * App Component
 *
 * Root application component with all providers and error boundary.
 *
 * Provider hierarchy:
 * 1. ErrorBoundary - Catches all React errors
 * 2. QueryProvider - React Query for data fetching
 * 3. AuthProvider - Firebase authentication
 * 4. RouterProvider - React Router for navigation
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
