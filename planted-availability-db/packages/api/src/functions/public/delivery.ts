import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, venues, dishes } from '@pad/database';
import type { Dish, Venue, DeliveryPartner } from '@pad/core';

// Initialize Firestore
initializeFirestore();

interface DeliveryOption {
  venue: Pick<Venue, 'id' | 'name' | 'type' | 'address'>;
  dishes: Pick<Dish, 'id' | 'name' | 'price' | 'image_url' | 'delivery_partners'>[];
  partners: {
    partner: DeliveryPartner;
    url: string;
  }[];
}

interface DeliveryCheckResponse {
  available: boolean;
  options: DeliveryOption[];
  message?: string;
}

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public', // Allow unauthenticated access
};

/**
 * GET /api/v1/delivery/check
 * Check delivery availability for a specific address or postal code
 */
export const deliveryCheckHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const postalCode = req.query.postal_code as string | undefined;
    const country = req.query.country as string | undefined;
    const address = req.query.address as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 20);

    // Validate input
    if (!postalCode && !address) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Either postal_code or address query parameter is required',
      });
      return;
    }

    // Query delivery kitchens and restaurants with delivery
    const deliveryVenues = await venues.query({
      type: 'delivery_kitchen',
      country,
      status: 'active',
      limit: 100,
    });

    // Also check restaurants (they may offer delivery)
    const restaurants = await venues.query({
      type: 'restaurant',
      country,
      status: 'active',
      limit: 100,
    });

    // Combine and filter venues that serve the postal code
    const allVenues = [...deliveryVenues, ...restaurants];
    const servingVenues = allVenues.filter((venue) => {
      if (!venue.delivery_zones) return false;

      // Check if postal code is in delivery zones
      if (Array.isArray(venue.delivery_zones)) {
        return venue.delivery_zones.some((zone) => {
          // Simple postal code matching
          // Could be enhanced with range matching (e.g., "8000-8099")
          if (zone.includes('-')) {
            const [start, end] = zone.split('-').map((z) => parseInt(z, 10));
            const pc = parseInt(postalCode || '0', 10);
            return pc >= start && pc <= end;
          }
          return zone === postalCode;
        });
      }

      // GeoJSON polygon checking would go here
      // For now, return true if venue has any delivery zones
      return true;
    });

    // Get dishes for each serving venue
    const options: DeliveryOption[] = [];

    for (const venue of servingVenues.slice(0, limit)) {
      // Get dishes with delivery partners
      const venueDishes = await dishes.getByVenue(venue.id);
      const deliveryDishes = venueDishes.filter(
        (dish) => dish.delivery_partners && dish.delivery_partners.length > 0
      );

      if (deliveryDishes.length === 0) continue;

      // Collect unique delivery partners
      const partnersMap = new Map<DeliveryPartner, string>();
      deliveryDishes.forEach((dish) => {
        dish.delivery_partners?.forEach((dp) => {
          if (!partnersMap.has(dp.partner)) {
            partnersMap.set(dp.partner, dp.url);
          }
        });
      });

      options.push({
        venue: {
          id: venue.id,
          name: venue.name,
          type: venue.type,
          address: venue.address,
        },
        dishes: deliveryDishes.map((dish) => ({
          id: dish.id,
          name: dish.name,
          price: dish.price,
          image_url: dish.image_url,
          delivery_partners: dish.delivery_partners,
        })),
        partners: Array.from(partnersMap.entries()).map(([partner, url]) => ({
          partner,
          url,
        })),
      });
    }

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache

    const response: DeliveryCheckResponse = {
      available: options.length > 0,
      options,
      message: options.length === 0 ? 'No delivery options available for this location' : undefined,
    };

    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Delivery check API error:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});
