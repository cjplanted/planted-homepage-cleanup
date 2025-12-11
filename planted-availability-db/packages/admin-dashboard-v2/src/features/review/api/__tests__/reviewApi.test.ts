/**
 * Review API Tests
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { reviewHandlers } from '@/test/mocks/handlers/review';
import {
  getReviewQueue,
  approveVenue,
  partialApproveVenue,
  rejectVenue,
  bulkApproveVenues,
  bulkRejectVenues,
  getChains,
  assignChain,
  updateVenueCountry,
} from '../reviewApi';

// Mock firebase auth
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

const server = setupServer(...reviewHandlers);

describe('Review API', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe('getReviewQueue', () => {
    it('should fetch review queue', async () => {
      const response = await getReviewQueue();

      expect(response).toBeDefined();
      expect(response.items).toBeInstanceOf(Array);
      expect(response.hierarchy).toBeInstanceOf(Array);
      expect(response.stats).toBeDefined();
    });

    it('should filter by country', async () => {
      const response = await getReviewQueue({ country: 'CH' });

      expect(response.items).toBeInstanceOf(Array);
      response.items.forEach(item => {
        expect(item.country).toBe('CH');
      });
    });

    it('should filter by status', async () => {
      const response = await getReviewQueue({ status: 'pending' });

      expect(response.items).toBeInstanceOf(Array);
      response.items.forEach(item => {
        // Frontend status should be 'pending' (transformed from backend 'discovered')
        expect(item.status).toBe('pending');
      });
    });

    it('should return pagination info', async () => {
      const response = await getReviewQueue({ pageSize: 10 });

      expect(response.pagination).toBeDefined();
      expect(response.pagination.pageSize).toBe(10);
      expect(response.pagination.total).toBeGreaterThanOrEqual(0);
    });

    it('should return stats', async () => {
      const response = await getReviewQueue();

      expect(response.stats.pending).toBeGreaterThanOrEqual(0);
      expect(response.stats.verified).toBeGreaterThanOrEqual(0);
      expect(response.stats.rejected).toBeGreaterThanOrEqual(0);
      expect(response.stats.total).toBeGreaterThanOrEqual(0);
    });

    it('should return hierarchy', async () => {
      const response = await getReviewQueue();

      expect(response.hierarchy).toBeInstanceOf(Array);
      if (response.hierarchy.length > 0) {
        expect(response.hierarchy[0].type).toBe('country');
      }
    });
  });

  describe('approveVenue', () => {
    it('should approve venue successfully', async () => {
      const result = await approveVenue('venue-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('venue-1');
      expect(result.status).toBe('verified');
    });

    it('should return updated venue data', async () => {
      const result = await approveVenue('venue-1');

      expect(result.id).toBeDefined();
      expect(result.status).toBe('verified');
    });
  });

  describe('partialApproveVenue', () => {
    it('should partial approve venue with feedback', async () => {
      const result = await partialApproveVenue(
        'venue-1',
        'Please check dish prices',
        ['dish-1']
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('verified');
    });

    it('should handle feedback without dish IDs', async () => {
      const result = await partialApproveVenue('venue-1', 'General feedback');

      expect(result).toBeDefined();
      expect(result.status).toBe('verified');
    });
  });

  describe('rejectVenue', () => {
    it('should reject venue with reason', async () => {
      const result = await rejectVenue('venue-1', 'Not a planted venue');

      expect(result).toBeDefined();
      expect(result.id).toBe('venue-1');
      expect(result.status).toBe('rejected');
    });
  });

  describe('bulkApproveVenues', () => {
    it('should approve multiple venues', async () => {
      const result = await bulkApproveVenues(['venue-1', 'venue-2', 'venue-3']);

      expect(result).toBeDefined();
      expect(result.success).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty array', async () => {
      const result = await bulkApproveVenues([]);

      expect(result).toBeDefined();
      expect(result.success).toBe(0);
    });
  });

  describe('bulkRejectVenues', () => {
    it('should reject multiple venues', async () => {
      const result = await bulkRejectVenues(
        ['venue-1', 'venue-2'],
        'Bulk rejection reason'
      );

      expect(result).toBeDefined();
      expect(result.success).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getChains', () => {
    it('should fetch chains list', async () => {
      const chains = await getChains();

      expect(chains).toBeInstanceOf(Array);
      if (chains.length > 0) {
        expect(chains[0]).toHaveProperty('id');
        expect(chains[0]).toHaveProperty('name');
      }
    });
  });

  describe('assignChain', () => {
    it('should assign existing chain to venues', async () => {
      const result = await assignChain({
        venueIds: ['venue-1', 'venue-2'],
        chainId: 'chain-tibits',
      });

      expect(result).toBeDefined();
      expect(result.chainId).toBe('chain-tibits');
      expect(result.updatedCount).toBe(2);
    });

    it('should create new chain', async () => {
      const result = await assignChain({
        venueIds: ['venue-1'],
        newChainName: 'New Chain Name',
      });

      expect(result).toBeDefined();
      expect(result.chainId).toBeDefined();
      expect(result.chainName).toBe('New Chain Name');
      expect(result.updatedCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid venue ID', async () => {
      await expect(approveVenue('')).rejects.toThrow();
    });
  });

  describe('Data Transformation', () => {
    it('should transform backend data to frontend format', async () => {
      const response = await getReviewQueue();

      // Check that confidence is normalized (0-1 range)
      if (response.items.length > 0) {
        const firstVenue = response.items[0];
        expect(firstVenue.confidence).toBeGreaterThanOrEqual(0);
        expect(firstVenue.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should map backend status to frontend status', async () => {
      const response = await getReviewQueue({ status: 'pending' });

      // Backend 'discovered' should map to frontend 'pending'
      response.items.forEach(item => {
        expect(['pending', 'verified', 'rejected']).toContain(item.status);
      });
    });
  });

  describe('updateVenueCountry', () => {
    it('should update venue country successfully', async () => {
      const result = await updateVenueCountry('venue-1', 'DE');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.venue.id).toBe('venue-1');
      expect(result.venue.country).toBe('DE');
    });

    it('should return previous and new country', async () => {
      const result = await updateVenueCountry('venue-1', 'AT');

      expect(result.venue.previousCountry).toBeDefined();
      expect(result.venue.country).toBe('AT');
    });

    it('should reject invalid country codes', async () => {
      await expect(updateVenueCountry('venue-1', 'INVALID')).rejects.toThrow();
    });

    it('should reject empty venue ID', async () => {
      await expect(updateVenueCountry('', 'DE')).rejects.toThrow();
    });
  });
});
