/**
 * MSW Handlers for Live Venues feature
 */

import { http, HttpResponse } from 'msw';
import {
  mockLiveVenues,
  mockLiveVenuesHierarchy,
  mockLiveVenuesStats,
} from '../data/liveVenues';

export const liveVenuesHandlers = [
  // Get live venues
  http.get('*/adminLiveVenues', ({ request }) => {
    const url = new URL(request.url);
    const country = url.searchParams.get('country');
    const status = url.searchParams.get('status');
    const venueType = url.searchParams.get('venueType');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '100', 10);

    let filteredVenues = [...mockLiveVenues];

    // Apply filters
    if (country) {
      filteredVenues = filteredVenues.filter(v => v.address.country === country);
    }
    if (status) {
      filteredVenues = filteredVenues.filter(v => v.status === status);
    }
    if (venueType) {
      filteredVenues = filteredVenues.filter(v => v.type === venueType);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredVenues = filteredVenues.filter(v =>
        v.name.toLowerCase().includes(searchLower) ||
        v.address.city.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const total = filteredVenues.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedVenues = filteredVenues.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < total;

    // Update stats based on filters
    const stats = {
      active: filteredVenues.filter(v => v.status === 'active').length,
      stale: filteredVenues.filter(v => v.status === 'stale').length,
      archived: filteredVenues.filter(v => v.status === 'archived').length,
      total: filteredVenues.length,
      byCountry: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      avgDaysSinceVerification: mockLiveVenuesStats.avgDaysSinceVerification,
    };

    filteredVenues.forEach(v => {
      stats.byCountry[v.address.country] = (stats.byCountry[v.address.country] || 0) + 1;
      stats.byType[v.type] = (stats.byType[v.type] || 0) + 1;
    });

    return HttpResponse.json({
      items: paginatedVenues,
      hierarchy: mockLiveVenuesHierarchy,
      stats,
      pagination: {
        page,
        pageSize: paginatedVenues.length,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore,
      },
    });
  }),

  // Update venue status
  http.post('*/adminUpdateVenueStatus', async ({ request }) => {
    const body = await request.json() as { venueId: string; status: string };

    // Validate venue ID
    if (!body.venueId || body.venueId.trim() === '') {
      return new HttpResponse(
        JSON.stringify({ error: 'Invalid request body', details: [{ message: 'venueId is required' }] }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate status
    const validStatuses = ['active', 'stale', 'archived'];
    if (!validStatuses.includes(body.status)) {
      return new HttpResponse(
        JSON.stringify({ error: 'Invalid request body', details: [{ message: 'Invalid status' }] }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find venue
    const venue = mockLiveVenues.find(v => v.id === body.venueId);
    if (!venue) {
      return new HttpResponse(
        JSON.stringify({ error: 'Venue not found', venueId: body.venueId }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const previousStatus = venue.status;

    return HttpResponse.json({
      success: true,
      message: `Venue status updated from ${previousStatus} to ${body.status}`,
      venue: {
        id: body.venueId,
        name: venue.name,
        previousStatus,
        status: body.status,
        lastVerified: body.status === 'active' ? new Date().toISOString() : venue.lastVerified,
      },
    });
  }),
];
