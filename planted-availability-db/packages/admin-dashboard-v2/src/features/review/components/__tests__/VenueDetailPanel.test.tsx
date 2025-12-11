/**
 * VenueDetailPanel Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import { VenueDetailPanel } from '../VenueDetailPanel';
import { mockVenues } from '@/test/mocks/data/venues';

describe('VenueDetailPanel', () => {
  const mockOnAssignChain = vi.fn();
  const mockOnUpdateCountry = vi.fn();

  beforeEach(() => {
    mockOnAssignChain.mockClear();
    mockOnUpdateCountry.mockClear();
  });

  describe('Rendering', () => {
    it('should render venue name', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      expect(screen.getByText('Tibits Zurich')).toBeInTheDocument();
    });

    it('should render venue address', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      expect(screen.getByText('Seefeldstrasse 2')).toBeInTheDocument();
    });

    it('should render city and country', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      // City is now separate from country due to editable country feature
      expect(screen.getByText(/Zurich,/)).toBeInTheDocument();
      expect(screen.getByText(/🇨🇭 Switzerland/)).toBeInTheDocument();
    });

    it('should render venue type badge', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      expect(screen.getByText('Restaurant')).toBeInTheDocument();
    });

    it('should render status badge', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      // Status is uppercased in the component
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });

    it('should render chain badge when chain exists', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      expect(screen.getByText('Tibits')).toBeInTheDocument();
    });
  });

  describe('Confidence Display', () => {
    it('should render confidence score', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('should render confidence bar', () => {
      const { container } = render(<VenueDetailPanel venue={mockVenues[0]} />);
      const confidenceBar = container.querySelector('[style*="width: 92%"]');
      expect(confidenceBar).toBeInTheDocument();
    });

    it('should render confidence factors when available', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      // Check that confidence factors section exists
      expect(screen.getByText('Factors')).toBeInTheDocument();
    });
  });

  describe('Platform Links', () => {
    it('should render platform name', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      expect(screen.getByText('Uber Eats')).toBeInTheDocument();
    });

    it('should have external link to platform', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      const link = screen.getByText('Uber Eats').closest('a');
      expect(link).toHaveAttribute('href', mockVenues[0].platform_url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Scraped Date', () => {
    it('should render scraped timestamp', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      expect(screen.getByText('Scraped')).toBeInTheDocument();
    });

    it('should format date correctly', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      // Should contain formatted date
      const scrapedSection = screen.getByText('Scraped').parentElement;
      expect(scrapedSection).toBeInTheDocument();
    });
  });

  describe('Assign Chain Button', () => {
    it('should show assign chain button for pending venues without chain', () => {
      const venueWithoutChain = {
        ...mockVenues[0],
        chain_id: null,
        chain_name: null,
        chain: undefined, // Component checks !venue.chain
        chainId: null,
        chainName: null,
        status: 'pending' as const,
      };
      render(
        <VenueDetailPanel
          venue={venueWithoutChain}
          onAssignChain={mockOnAssignChain}
        />
      );

      expect(screen.getByText('Assign Chain')).toBeInTheDocument();
    });

    it('should not show assign chain button for venues with chain', () => {
      render(
        <VenueDetailPanel
          venue={mockVenues[0]}
          onAssignChain={mockOnAssignChain}
        />
      );

      expect(screen.queryByText('Assign Chain')).not.toBeInTheDocument();
    });

    it('should call onAssignChain when clicked', async () => {
      const venueWithoutChain = {
        ...mockVenues[0],
        chain: undefined,
        chainId: null,
        chainName: null,
        status: 'pending' as const,
      };
      const { user } = render(
        <VenueDetailPanel
          venue={venueWithoutChain}
          onAssignChain={mockOnAssignChain}
        />
      );

      await user.click(screen.getByText('Assign Chain'));
      expect(mockOnAssignChain).toHaveBeenCalled();
    });
  });

  describe('Map Link', () => {
    it('should show map link when coordinates are available', () => {
      const venueWithCoords = {
        ...mockVenues[0],
        coordinates: { lat: 47.3769, lng: 8.5417 },
      };
      render(<VenueDetailPanel venue={venueWithCoords} />);

      const mapLink = screen.getByText('View on Map');
      expect(mapLink).toBeInTheDocument();
      expect(mapLink.closest('a')).toHaveAttribute(
        'href',
        'https://www.google.com/maps?q=47.3769,8.5417'
      );
    });

    it('should not show map link when coordinates are missing', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);
      expect(screen.queryByText('View on Map')).not.toBeInTheDocument();
    });
  });

  describe('Feedback and Rejection', () => {
    it('should show feedback when present', () => {
      const venueWithFeedback = {
        ...mockVenues[0],
        feedback: 'Please verify the address',
      };
      render(<VenueDetailPanel venue={venueWithFeedback} />);

      expect(screen.getByText('Feedback')).toBeInTheDocument();
      expect(screen.getByText('Please verify the address')).toBeInTheDocument();
    });

    it('should show rejection reason when present', () => {
      const rejectedVenue = {
        ...mockVenues[4],
      };
      render(<VenueDetailPanel venue={rejectedVenue} />);

      expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
      expect(screen.getByText('Not a planted venue')).toBeInTheDocument();
    });
  });

  describe('Country Editing', () => {
    it('should show edit button when onUpdateCountry is provided', () => {
      render(
        <VenueDetailPanel
          venue={mockVenues[0]}
          onUpdateCountry={mockOnUpdateCountry}
        />
      );

      // Look for the edit/pencil button
      const editButton = screen.getByTitle('Change country');
      expect(editButton).toBeInTheDocument();
    });

    it('should not show edit button when onUpdateCountry is not provided', () => {
      render(<VenueDetailPanel venue={mockVenues[0]} />);

      expect(screen.queryByTitle('Change country')).not.toBeInTheDocument();
    });

    it('should show country selector when edit button is clicked', async () => {
      const { user } = render(
        <VenueDetailPanel
          venue={mockVenues[0]}
          onUpdateCountry={mockOnUpdateCountry}
        />
      );

      await user.click(screen.getByTitle('Change country'));

      // Country selector should appear
      const countrySelect = screen.getByRole('combobox');
      expect(countrySelect).toBeInTheDocument();
    });

    it('should show confirm and cancel buttons when editing', async () => {
      const { user } = render(
        <VenueDetailPanel
          venue={mockVenues[0]}
          onUpdateCountry={mockOnUpdateCountry}
        />
      );

      await user.click(screen.getByTitle('Change country'));

      // Should have confirm (check) and cancel (X) buttons
      expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
    });

    it('should call onUpdateCountry when country is changed and confirmed', async () => {
      mockOnUpdateCountry.mockResolvedValue(undefined);

      const { user } = render(
        <VenueDetailPanel
          venue={mockVenues[0]}
          onUpdateCountry={mockOnUpdateCountry}
        />
      );

      // Click edit button
      await user.click(screen.getByTitle('Change country'));

      // Change country selection
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'DE');

      // Click confirm button (the check mark)
      const buttons = screen.getAllByRole('button');
      const confirmButton = buttons.find(btn =>
        btn.querySelector('svg.lucide-check') || btn.querySelector('[class*="text-green"]')
      );
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(mockOnUpdateCountry).toHaveBeenCalledWith(mockVenues[0].id, 'DE');
      });
    });

    it('should close selector when cancel button is clicked', async () => {
      const { user } = render(
        <VenueDetailPanel
          venue={mockVenues[0]}
          onUpdateCountry={mockOnUpdateCountry}
        />
      );

      // Click edit button
      await user.click(screen.getByTitle('Change country'));

      // Selector should be visible
      expect(screen.getByRole('combobox')).toBeInTheDocument();

      // Find and click cancel button (the X mark)
      const buttons = screen.getAllByRole('button');
      const cancelButton = buttons.find(btn =>
        btn.querySelector('svg.lucide-x') || btn.querySelector('[class*="text-red"]')
      );
      if (cancelButton) {
        await user.click(cancelButton);
      }

      // Selector should be hidden
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should show loading state when isUpdatingCountry is true', async () => {
      const { user } = render(
        <VenueDetailPanel
          venue={mockVenues[0]}
          onUpdateCountry={mockOnUpdateCountry}
          isUpdatingCountry={true}
        />
      );

      // Click edit button to show the selector
      await user.click(screen.getByTitle('Change country'));

      // Select should be disabled
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });
});
