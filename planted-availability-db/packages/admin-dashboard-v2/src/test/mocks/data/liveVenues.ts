/**
 * Mock data for Live Venues feature testing
 */

import type { LiveVenue, HierarchyNode, LiveVenuesStats } from '@/features/live-venues';

// Mock live venues data
export const mockLiveVenues: LiveVenue[] = [
  {
    id: 'live-venue-1',
    name: 'Tibits Zurich HB',
    type: 'restaurant',
    chainId: 'chain-tibits',
    chainName: 'Tibits',
    address: {
      street: 'Bahnhofplatz 10',
      city: 'Zurich',
      postalCode: '8001',
      country: 'CH',
    },
    location: {
      latitude: 47.3769,
      longitude: 8.5417,
    },
    status: 'active',
    lastVerified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    createdAt: '2024-01-15T10:00:00Z',
    deliveryPlatforms: [
      { platform: 'uber_eats', url: 'https://ubereats.com/ch/tibits-hb', active: true },
      { platform: 'wolt', url: 'https://wolt.com/ch/tibits-hb', active: true },
    ],
    dishCount: 12,
  },
  {
    id: 'live-venue-2',
    name: 'Tibits Basel',
    type: 'restaurant',
    chainId: 'chain-tibits',
    chainName: 'Tibits',
    address: {
      street: 'Stänzlergasse 4',
      city: 'Basel',
      postalCode: '4051',
      country: 'CH',
    },
    location: {
      latitude: 47.5596,
      longitude: 7.5886,
    },
    status: 'active',
    lastVerified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    createdAt: '2024-02-20T14:00:00Z',
    deliveryPlatforms: [
      { platform: 'uber_eats', url: 'https://ubereats.com/ch/tibits-basel', active: true },
    ],
    dishCount: 8,
  },
  {
    id: 'live-venue-3',
    name: 'Hiltl Sihlstrasse',
    type: 'restaurant',
    chainId: 'chain-hiltl',
    chainName: 'Hiltl',
    address: {
      street: 'Sihlstrasse 28',
      city: 'Zurich',
      postalCode: '8001',
      country: 'CH',
    },
    location: {
      latitude: 47.3730,
      longitude: 8.5342,
    },
    status: 'stale',
    lastVerified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    createdAt: '2024-01-10T09:00:00Z',
    deliveryPlatforms: [
      { platform: 'wolt', url: 'https://wolt.com/ch/hiltl', active: true },
    ],
    dishCount: 15,
  },
  {
    id: 'live-venue-4',
    name: 'Hans im Glück Berlin',
    type: 'restaurant',
    chainId: 'chain-hans',
    chainName: 'Hans im Glück',
    address: {
      street: 'Friedrichstraße 101',
      city: 'Berlin',
      postalCode: '10117',
      country: 'DE',
    },
    location: {
      latitude: 52.5200,
      longitude: 13.4050,
    },
    status: 'active',
    lastVerified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    createdAt: '2024-03-01T12:00:00Z',
    deliveryPlatforms: [
      { platform: 'lieferando', url: 'https://lieferando.de/hans-im-glueck', active: true },
    ],
    dishCount: 6,
  },
  {
    id: 'live-venue-5',
    name: 'Independent Cafe Vienna',
    type: 'restaurant',
    address: {
      street: 'Stephansplatz 5',
      city: 'Vienna',
      postalCode: '1010',
      country: 'AT',
    },
    location: {
      latitude: 48.2082,
      longitude: 16.3738,
    },
    status: 'archived',
    lastVerified: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
    createdAt: '2023-11-15T08:00:00Z',
    deliveryPlatforms: [],
    dishCount: 3,
  },
  {
    id: 'live-venue-6',
    name: 'Planted Retail Store',
    type: 'retail',
    address: {
      street: 'Langstrasse 100',
      city: 'Zurich',
      postalCode: '8004',
      country: 'CH',
    },
    location: {
      latitude: 47.3800,
      longitude: 8.5300,
    },
    status: 'active',
    lastVerified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    createdAt: '2024-04-01T10:00:00Z',
    deliveryPlatforms: [],
    dishCount: 0,
  },
];

// Mock hierarchy
export const mockLiveVenuesHierarchy: HierarchyNode[] = [
  {
    id: 'CH',
    type: 'country',
    label: 'CH',
    count: 4,
    children: [
      {
        id: 'CH-restaurant',
        type: 'venueType',
        label: 'Restaurants',
        count: 3,
        children: [
          {
            id: 'chain-tibits',
            type: 'chain',
            label: 'Tibits',
            count: 2,
            children: [
              {
                id: 'venue-live-venue-1',
                type: 'venue',
                label: 'Tibits Zurich HB',
                count: 12,
                venue: mockLiveVenues[0],
              },
              {
                id: 'venue-live-venue-2',
                type: 'venue',
                label: 'Tibits Basel',
                count: 8,
                venue: mockLiveVenues[1],
              },
            ],
          },
          {
            id: 'chain-hiltl',
            type: 'chain',
            label: 'Hiltl',
            count: 1,
            children: [
              {
                id: 'venue-live-venue-3',
                type: 'venue',
                label: 'Hiltl Sihlstrasse',
                count: 15,
                venue: mockLiveVenues[2],
              },
            ],
          },
        ],
      },
      {
        id: 'CH-retail',
        type: 'venueType',
        label: 'Retail',
        count: 1,
        children: [
          {
            id: 'CH-retail-independent',
            type: 'chain',
            label: 'Independent',
            count: 1,
            children: [
              {
                id: 'venue-live-venue-6',
                type: 'venue',
                label: 'Planted Retail Store',
                count: 0,
                venue: mockLiveVenues[5],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'DE',
    type: 'country',
    label: 'DE',
    count: 1,
    children: [
      {
        id: 'DE-restaurant',
        type: 'venueType',
        label: 'Restaurants',
        count: 1,
        children: [
          {
            id: 'chain-hans',
            type: 'chain',
            label: 'Hans im Glück',
            count: 1,
            children: [
              {
                id: 'venue-live-venue-4',
                type: 'venue',
                label: 'Hans im Glück Berlin',
                count: 6,
                venue: mockLiveVenues[3],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'AT',
    type: 'country',
    label: 'AT',
    count: 1,
    children: [
      {
        id: 'AT-restaurant',
        type: 'venueType',
        label: 'Restaurants',
        count: 1,
        children: [
          {
            id: 'AT-restaurant-independent',
            type: 'chain',
            label: 'Independent',
            count: 1,
            children: [
              {
                id: 'venue-live-venue-5',
                type: 'venue',
                label: 'Independent Cafe Vienna',
                count: 3,
                venue: mockLiveVenues[4],
              },
            ],
          },
        ],
      },
    ],
  },
];

// Mock stats
export const mockLiveVenuesStats: LiveVenuesStats = {
  active: 4,
  stale: 1,
  archived: 1,
  total: 6,
  byCountry: {
    CH: 4,
    DE: 1,
    AT: 1,
  },
  byType: {
    restaurant: 5,
    retail: 1,
    delivery_kitchen: 0,
  },
  avgDaysSinceVerification: 4.2,
};

// Factory functions
export function createMockLiveVenue(overrides: Partial<LiveVenue> = {}): LiveVenue {
  return {
    id: `live-venue-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Live Venue',
    type: 'restaurant',
    address: {
      street: '123 Test St',
      city: 'Zurich',
      postalCode: '8001',
      country: 'CH',
    },
    location: {
      latitude: 47.3769,
      longitude: 8.5417,
    },
    status: 'active',
    lastVerified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    deliveryPlatforms: [],
    dishCount: 5,
    ...overrides,
  };
}
