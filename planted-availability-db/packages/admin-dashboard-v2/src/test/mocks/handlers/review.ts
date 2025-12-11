import { http, HttpResponse } from 'msw';
import { mockVenues, mockHierarchy, mockStats, mockChains } from '../data/venues';

// Use wildcard patterns to match any base URL (localhost or production)
export const reviewHandlers = [
  // Get review queue
  http.get('*/adminReviewQueue', ({ request }) => {
    const url = new URL(request.url);
    const country = url.searchParams.get('country');
    const status = url.searchParams.get('status') || 'discovered';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    let filteredVenues = mockVenues;
    if (country) {
      filteredVenues = filteredVenues.filter(v => v.country === country);
    }
    if (status) {
      filteredVenues = filteredVenues.filter(v => v.status === status);
    }

    // Transform to backend format with proper structure
    const transformedVenues = filteredVenues.map(v => ({
      id: v.id,
      name: v.name,
      chainId: v.chain_id,
      chainName: v.chain_name,
      address: {
        street: v.address,
        city: v.city,
        postalCode: '',
        country: v.country,
      },
      confidenceScore: v.confidence,
      status: v.status,
      createdAt: v.scraped_at,
      dishes: v.dishes.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        product: d.product_type,
        confidence: d.confidence,
        price: d.price?.toString(),
        imageUrl: d.image_url,
        status: d.status,
      })),
      deliveryPlatforms: [{
        platform: v.platform,
        url: v.platform_url,
        active: true,
      }],
    }));

    // Transform hierarchy to backend format
    const transformedHierarchy = mockHierarchy.map(country => ({
      country: country.id,
      totalVenues: country.count,
      venueTypes: country.children?.map(vt => ({
        type: vt.id.includes('restaurant') ? 'chain' : 'independent',
        totalVenues: vt.count,
        chains: vt.children?.map(chain => ({
          chainId: chain.id,
          chainName: chain.label,
          totalVenues: chain.count,
          venues: chain.children?.map(v => {
            const venue = mockVenues.find(mv => mv.id === v.id);
            return venue ? {
              id: venue.id,
              name: venue.name,
              chainId: venue.chain_id,
              chainName: venue.chain_name,
              address: {
                street: venue.address,
                city: venue.city,
                postalCode: '',
                country: venue.country,
              },
              confidenceScore: venue.confidence,
              status: venue.status,
              createdAt: venue.scraped_at,
              dishes: venue.dishes.map(d => ({
                id: d.id,
                name: d.name,
                description: d.description,
                product: d.product_type,
                confidence: d.confidence,
                price: d.price?.toString(),
                imageUrl: d.image_url,
                status: d.status,
              })),
              deliveryPlatforms: [{
                platform: venue.platform,
                url: venue.platform_url,
                active: true,
              }],
            } : null;
          }).filter(Boolean) || [],
        })) || [],
      })) || [],
    }));

    return HttpResponse.json({
      success: true,
      items: transformedVenues,
      hierarchy: transformedHierarchy,
      stats: {
        pending: mockStats.pending,
        verified: mockStats.verified,
        rejected: mockStats.rejected,
        total: mockStats.total,
        byCountry: mockStats.by_country,
      },
      pagination: {
        cursor: null,
        hasMore: false,
        total: filteredVenues.length,
        pageSize: limit,
      },
    });
  }),

  // Approve venue
  http.post('*/adminApproveVenue', async ({ request }) => {
    const body = await request.json() as { venueId: string };

    // Validate venue ID
    if (!body.venueId || body.venueId.trim() === '' || body.venueId.includes('invalid')) {
      return new HttpResponse(
        JSON.stringify({ error: 'Venue ID is required', code: 'INVALID_VENUE_ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Venue approved successfully',
      venue: {
        id: body.venueId,
        name: 'Test Venue',
        status: 'verified',
        verifiedAt: new Date().toISOString(),
      },
    });
  }),

  // Partial approve venue
  http.post('*/adminPartialApproveVenue', async ({ request }) => {
    const body = await request.json() as { venueId: string; feedback: string };
    return HttpResponse.json({
      success: true,
      message: 'Venue partially approved',
      venue: {
        id: body.venueId,
        name: 'Test Venue',
        status: 'verified',
        verifiedAt: new Date().toISOString(),
        feedback: body.feedback
      },
    });
  }),

  // Reject venue
  http.post('*/adminRejectVenue', async ({ request }) => {
    const body = await request.json() as { venueId: string; reason: string };
    return HttpResponse.json({
      success: true,
      message: 'Venue rejected',
      venue: {
        id: body.venueId,
        name: 'Test Venue',
        status: 'rejected',
        rejectionReason: body.reason
      },
    });
  }),

  // Bulk approve
  http.post('*/adminBulkApprove', async ({ request }) => {
    const body = await request.json() as { venueIds: string[] };
    return HttpResponse.json({
      success: body.venueIds.length,
      failed: 0,
    });
  }),

  // Bulk reject
  http.post('*/adminBulkReject', async ({ request }) => {
    const body = await request.json() as { venueIds: string[]; reason: string };
    return HttpResponse.json({
      success: body.venueIds.length,
      failed: 0,
    });
  }),

  // Flag venue
  http.post('*/adminFlagVenue', async ({ request }) => {
    const body = await request.json() as { venueId: string; flagType: string; priority: string };
    return HttpResponse.json({
      success: true,
      message: 'Venue flagged',
      venue: {
        id: body.venueId,
        flag_type: body.flagType,
        flag_priority: body.priority,
        flagged_at: new Date().toISOString(),
      },
    });
  }),

  // Clear venue flag
  http.post('*/adminClearVenueFlag', async ({ request }) => {
    const body = await request.json() as { venueId: string };
    return HttpResponse.json({
      success: true,
      message: 'Flag cleared',
      venue: { id: body.venueId, flag_type: null, flag_priority: null },
    });
  }),

  // Get flagged venues
  http.get('*/adminFlaggedVenues', () => {
    return HttpResponse.json({
      success: true,
      items: mockVenues.filter(v => v.flag_type),
    });
  }),

  // Get chains
  http.get('*/adminChains', () => {
    return HttpResponse.json({
      chains: mockChains.map(c => ({
        id: c.id,
        name: c.name,
        type: 'restaurant',
        markets: [c.country].filter(Boolean),
      })),
      total: mockChains.length,
    });
  }),

  // Assign chain
  http.post('*/adminAssignChain', async ({ request }) => {
    const body = await request.json() as { venueIds: string[]; chainId?: string; newChainName?: string };
    const chainId = body.chainId || 'new-chain-id';
    const chainName = body.newChainName || mockChains.find(c => c.id === chainId)?.name || 'New Chain';

    return HttpResponse.json({
      chainId,
      chainName,
      updatedCount: body.venueIds.length,
    });
  }),

  // Update venue country
  http.post('*/adminUpdateVenueCountry', async ({ request }) => {
    const body = await request.json() as { venueId: string; country: string };
    const validCountries = ['CH', 'DE', 'AT', 'NL', 'UK', 'FR', 'ES', 'IT', 'BE', 'PL'];

    // Validate venue ID
    if (!body.venueId || body.venueId.trim() === '') {
      return new HttpResponse(
        JSON.stringify({ error: 'Invalid request body', details: [{ message: 'venueId is required' }] }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate country
    if (!validCountries.includes(body.country)) {
      return new HttpResponse(
        JSON.stringify({ error: 'Invalid request body', details: [{ message: 'Invalid country code' }] }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find venue to get previous country
    const venue = mockVenues.find(v => v.id === body.venueId);
    const previousCountry = venue?.country || 'CH';

    // Simulate "country unchanged" error
    if (previousCountry === body.country) {
      return new HttpResponse(
        JSON.stringify({ error: 'Country unchanged', message: 'The venue already has this country' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Venue country updated successfully',
      venue: {
        id: body.venueId,
        name: venue?.name || 'Test Venue',
        previousCountry,
        country: body.country,
      },
    });
  }),
];
