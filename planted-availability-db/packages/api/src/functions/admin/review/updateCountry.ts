/**
 * Admin Update Venue Country API
 * POST /adminUpdateVenueCountry
 *
 * Updates the country of a discovered venue
 * - Validates country is a supported country
 * - Updates discovered_venues.address.country
 * - Records change in changelog
 */

import { z } from 'zod';
import {
  initializeFirestore,
  discoveredVenues,
  changeLogs,
} from '@pad/database';
import { SUPPORTED_COUNTRIES } from '@pad/core';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for update country request body
const updateCountryBodySchema = z.object({
  venueId: z.string().min(1),
  country: z.enum(SUPPORTED_COUNTRIES as unknown as [string, ...string[]]),
});

/**
 * Handler for POST /adminUpdateVenueCountry
 */
export const adminUpdateVenueCountryHandler = createAdminHandler(
  async (req, res) => {
    // Validate request body
    const validation = updateCountryBodySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { venueId, country } = validation.data;

    // Get the venue
    const venue = await discoveredVenues.getById(venueId);
    if (!venue) {
      res.status(404).json({ error: 'Venue not found' });
      return;
    }

    const previousCountry = venue.address.country;

    // Check if country is already the same
    if (previousCountry === country) {
      res.status(400).json({
        error: 'Country unchanged',
        message: 'The venue already has this country',
      });
      return;
    }

    // Update the venue country
    const updatedVenue = await discoveredVenues.updateCountry(venueId, country as typeof venue.address.country);

    // Log the change
    try {
      await changeLogs.log({
        action: 'updated',
        collection: 'discovered_venues',
        document_id: venueId,
        changes: [
          { field: 'address.country', before: previousCountry, after: country },
        ],
        source: { type: 'manual', user_id: req.user?.uid },
        reason: `Admin changed venue country from ${previousCountry} to ${country}`,
      });
    } catch (e) {
      console.warn('Failed to log change:', e);
    }

    res.json({
      success: true,
      message: 'Venue country updated successfully',
      venue: {
        id: updatedVenue.id,
        name: updatedVenue.name,
        previousCountry,
        country: updatedVenue.address.country,
      },
    });
  },
  { allowedMethods: ['POST'] }
);
