import { useMemo } from 'react';
import type { DiscoveredVenueForReview } from '../lib/api';

export interface CountryNode {
  type: 'country';
  id: string;
  name: string;
  count: number;
  children: (ChainNode | VenueNode)[];
}

export interface ChainNode {
  type: 'chain';
  id: string;
  name: string;
  count: number;
  confidence?: number;
  children: VenueNode[];
}

export interface VenueNode {
  type: 'venue';
  id: string;
  name: string;
  venue: DiscoveredVenueForReview;
  confidence: number;
  dishCount: number;
}

export interface HierarchicalStats {
  totalPending: number;
  byCountry: Record<string, number>;
  byConfidence: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface UseHierarchicalDataOptions {
  venues: DiscoveredVenueForReview[];
  groupBy?: 'country' | 'type' | 'chain';
}

export interface UseHierarchicalDataReturn {
  tree: CountryNode[];
  stats: HierarchicalStats;
}

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export function useHierarchicalData(
  options: UseHierarchicalDataOptions
): UseHierarchicalDataReturn {
  const { venues, groupBy = 'country' } = options;

  const result = useMemo(() => {
    if (!venues || venues.length === 0) {
      return {
        tree: [],
        stats: {
          totalPending: 0,
          byCountry: {},
          byConfidence: { high: 0, medium: 0, low: 0 },
        },
      };
    }

    // Build stats
    const stats: HierarchicalStats = {
      totalPending: venues.length,
      byCountry: {},
      byConfidence: { high: 0, medium: 0, low: 0 },
    };

    venues.forEach((venue) => {
      const country = venue.address.country;
      stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;

      const confidenceLevel = getConfidenceLevel(venue.confidence_score);
      stats.byConfidence[confidenceLevel]++;
    });

    // Build tree based on groupBy option
    if (groupBy === 'country') {
      return {
        tree: buildCountryTree(venues),
        stats,
      };
    }

    // For other groupBy options, default to country for now
    return {
      tree: buildCountryTree(venues),
      stats,
    };
  }, [venues, groupBy]);

  return result;
}

function buildCountryTree(venues: DiscoveredVenueForReview[]): CountryNode[] {
  const countryMap = new Map<string, DiscoveredVenueForReview[]>();

  // Group by country
  venues.forEach((venue) => {
    const country = venue.address.country;
    if (!countryMap.has(country)) {
      countryMap.set(country, []);
    }
    countryMap.get(country)!.push(venue);
  });

  // Convert to country nodes
  const countryNodes: CountryNode[] = [];

  countryMap.forEach((countryVenues, country) => {
    const chainMap = new Map<string, DiscoveredVenueForReview[]>();
    const independentVenues: VenueNode[] = [];

    // Separate chain and independent venues
    countryVenues.forEach((venue) => {
      if (venue.is_chain && venue.chain_id) {
        if (!chainMap.has(venue.chain_id)) {
          chainMap.set(venue.chain_id, []);
        }
        chainMap.get(venue.chain_id)!.push(venue);
      } else {
        independentVenues.push(createVenueNode(venue));
      }
    });

    // Build chain nodes
    const chainNodes: ChainNode[] = [];
    chainMap.forEach((chainVenues, chainId) => {
      const chainName = chainVenues[0].chain_name || 'Unknown Chain';
      const avgConfidence =
        chainVenues.reduce((sum, v) => sum + (v.chain_confidence || 0), 0) /
        chainVenues.length;

      chainNodes.push({
        type: 'chain',
        id: chainId,
        name: chainName,
        count: chainVenues.length,
        confidence: avgConfidence,
        children: chainVenues.map(createVenueNode),
      });
    });

    // Sort chains by confidence and name
    chainNodes.sort((a, b) => {
      if ((b.confidence || 0) !== (a.confidence || 0)) {
        return (b.confidence || 0) - (a.confidence || 0);
      }
      return a.name.localeCompare(b.name);
    });

    // Sort independent venues by confidence
    independentVenues.sort((a, b) => b.confidence - a.confidence);

    // Create country node
    countryNodes.push({
      type: 'country',
      id: country,
      name: country,
      count: countryVenues.length,
      children: [...chainNodes, ...independentVenues],
    });
  });

  // Sort countries by count
  countryNodes.sort((a, b) => b.count - a.count);

  return countryNodes;
}

function createVenueNode(venue: DiscoveredVenueForReview): VenueNode {
  return {
    type: 'venue',
    id: venue.id,
    name: venue.name,
    venue,
    confidence: venue.confidence_score,
    dishCount: venue.dishes?.length || 0,
  };
}
