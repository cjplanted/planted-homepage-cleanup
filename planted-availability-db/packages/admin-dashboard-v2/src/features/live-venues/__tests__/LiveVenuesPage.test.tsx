/**
 * LiveVenuesPage Tests
 *
 * Tests for the Live Venues Browser page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import { LiveVenuesPage } from '@/pages/LiveVenuesPage';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

// Mock firebase auth - must be before any imports that use it
vi.mock('@/lib/firebase', () => {
  const mockGetIdToken = vi.fn().mockResolvedValue('mock-token');
  return {
    auth: {
      currentUser: {
        getIdToken: mockGetIdToken,
      },
    },
  };
});

// Mock the auth provider
vi.mock('@/app/providers/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthContext: () => ({
    isAuthenticated: true,
    user: { uid: 'test-user', email: 'test@example.com', displayName: 'Test User' },
    loading: false,
    error: null,
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

describe('LiveVenuesPage', () => {
  beforeEach(() => {
    // Reset handlers before each test
    server.resetHandlers();
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      // Delay the response to see loading state
      server.use(
        http.get('*/adminLiveVenues', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            items: [],
            hierarchy: [],
            stats: { active: 0, stale: 0, archived: 0, total: 0, byCountry: {}, byType: {}, avgDaysSinceVerification: 0 },
            pagination: { page: 1, pageSize: 0, total: 0, totalPages: 0, hasMore: false },
          });
        })
      );

      render(<LiveVenuesPage />);
      expect(screen.getByText(/loading live venues/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state when API fails', async () => {
      // Override handler for this test
      server.use(
        http.get('*/adminLiveVenues', () => {
          return new HttpResponse(
            JSON.stringify({ error: 'Server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        })
      );

      render(<LiveVenuesPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load venues/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no venues', async () => {
      server.use(
        http.get('*/adminLiveVenues', () => {
          return HttpResponse.json({
            items: [],
            hierarchy: [],
            stats: { active: 0, stale: 0, archived: 0, total: 0, byCountry: {}, byType: {}, avgDaysSinceVerification: 0 },
            pagination: { page: 1, pageSize: 0, total: 0, totalPages: 0, hasMore: false },
          });
        })
      );

      render(<LiveVenuesPage />);

      await waitFor(() => {
        expect(screen.getByText(/no venues found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('should display venues data when loaded', async () => {
      render(<LiveVenuesPage />);

      // Wait for data to load - check for Total which is unique to stats bar
      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Stats should be displayed - use getAllByText since labels appear in filters too
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Stale').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
    });

    it('should display hierarchy tree', async () => {
      render(<LiveVenuesPage />);

      // Wait for data to load first
      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show country node - check for button containing "CH"
      expect(screen.getByRole('button', { name: /CH/i })).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('should have filter dropdowns', async () => {
      render(<LiveVenuesPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Check for filter selects by their label text or role
      expect(screen.getByRole('combobox', { name: /country/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /type/i })).toBeInTheDocument();
    });

    it('should have search input', async () => {
      render(<LiveVenuesPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByPlaceholderText(/search venues/i)).toBeInTheDocument();
    });
  });

  describe('Venue Selection', () => {
    it('should show prompt to select venue when none selected', async () => {
      render(<LiveVenuesPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByText(/select a venue from the list/i)).toBeInTheDocument();
    });
  });
});
