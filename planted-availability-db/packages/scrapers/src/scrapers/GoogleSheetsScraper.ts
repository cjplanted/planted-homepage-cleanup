import { BaseScraper } from '../base/BaseScraper.js';
import { fetchJSON } from '../utils/http.js';
import { venues } from '@pad/database';
import { createVenueInputSchema, type Venue, type VenueType, type OpeningHours, type DayOfWeek } from '@pad/core';

interface SheetRow {
  name: string;
  type: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  latitude?: string;
  longitude?: string;
  phone?: string;
  email?: string;
  website?: string;
  opening_hours?: string;
}

interface SheetResponse {
  values: string[][];
}

export interface GoogleSheetsScraperConfig {
  spreadsheetId: string;
  sheetName: string;
  apiKey: string;
  headerRow?: number;
}

/**
 * Scraper for importing venue data from Google Sheets
 *
 * Expected sheet columns:
 * name, type, street, city, postal_code, country, latitude, longitude, phone, email, website, opening_hours
 */
export class GoogleSheetsScraper extends BaseScraper<SheetRow, Venue> {
  protected readonly name = 'google-sheets-venues';
  protected readonly scraperId: string;
  protected readonly targetCollection = 'venues';

  private readonly sheetsConfig: GoogleSheetsScraperConfig;

  constructor(config: GoogleSheetsScraperConfig) {
    super();
    this.sheetsConfig = config;
    this.scraperId = `gsheets-${config.spreadsheetId.slice(0, 8)}`;
  }

  protected async fetchData(): Promise<SheetRow[]> {
    const { spreadsheetId, sheetName, apiKey, headerRow = 1 } = this.sheetsConfig;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;

    const response = await fetchJSON<SheetResponse>(url);
    const rows = response.values;

    if (!rows || rows.length <= headerRow) {
      return [];
    }

    // Parse header row
    const headers = rows[headerRow - 1].map((h) => h.toLowerCase().trim().replace(/\s+/g, '_'));

    // Parse data rows
    const data: SheetRow[] = [];
    for (let i = headerRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const item: Record<string, string> = {};
      headers.forEach((header, index) => {
        item[header] = row[index]?.trim() || '';
      });

      // Skip rows without a name
      if (!item['name']) continue;

      data.push(item as unknown as SheetRow);
    }

    return data;
  }

  protected async transform(item: SheetRow): Promise<Venue | null> {
    try {
      const venueType = this.parseVenueType(item.type);

      // Parse coordinates
      let location = { latitude: 0, longitude: 0 };
      if (item.latitude && item.longitude) {
        const lat = parseFloat(item.latitude);
        const lng = parseFloat(item.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          location = { latitude: lat, longitude: lng };
        }
      }

      // Build opening hours
      const openingHours: OpeningHours = {
        regular: {},
      };
      if (item.opening_hours) {
        openingHours.regular = this.parseOpeningHours(item.opening_hours);
      }

      const venue: Venue = {
        id: '', // Will be set by database
        name: item.name,
        type: venueType,
        address: {
          street: item.street || '',
          city: item.city || '',
          postal_code: item.postal_code || '',
          country: item.country || 'CH',
        },
        location,
        opening_hours: openingHours,
        source: {
          type: 'partner_feed',
          url: `https://docs.google.com/spreadsheets/d/${this.sheetsConfig.spreadsheetId}`,
        },
        status: 'active',
        last_verified: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Add contact info
      if (item.phone || item.email || item.website) {
        venue.contact = {};
        if (item.phone) venue.contact.phone = item.phone;
        if (item.email) venue.contact.email = item.email;
        if (item.website) venue.contact.website = item.website;
      }

      return venue;
    } catch (error) {
      this.log(`Error transforming row: ${error}`, 'error');
      return null;
    }
  }

  protected async validate(item: Venue): Promise<{ valid: boolean; errors?: string[] }> {
    // Use Zod schema for validation
    const result = createVenueInputSchema.safeParse({
      name: item.name,
      type: item.type,
      address: item.address,
      location: item.location,
      opening_hours: item.opening_hours,
      contact: item.contact,
      source: item.source,
      status: item.status,
    });

    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      };
    }

    return { valid: true };
  }

  protected async save(item: Venue): Promise<{ action: 'created' | 'updated' | 'unchanged'; id: string }> {
    // Check if venue already exists by name and address
    const existing = await venues.query({
      country: item.address.country,
      limit: 1000,
    });

    const match = existing.find(
      (v) =>
        v.name.toLowerCase() === item.name.toLowerCase() &&
        v.address.city.toLowerCase() === item.address.city.toLowerCase()
    );

    if (match) {
      // Check if any fields changed
      const hasChanges = this.detectChanges(match, item);

      if (hasChanges.length > 0) {
        await venues.update(match.id, {
          name: item.name,
          type: item.type,
          address: item.address,
          location: item.location,
          opening_hours: item.opening_hours,
          contact: item.contact,
          last_verified: new Date(),
        });
        await this.logChange({
          action: 'updated',
          collection: 'venues',
          documentId: match.id,
          changes: hasChanges,
          reason: 'Updated from Google Sheets import',
        });
        return { action: 'updated', id: match.id };
      }

      // Just update last_verified
      await venues.update(match.id, { last_verified: new Date() });
      return { action: 'unchanged', id: match.id };
    }

    // Create new venue
    const created = await venues.create({
      name: item.name,
      type: item.type,
      address: item.address,
      location: item.location,
      opening_hours: item.opening_hours,
      contact: item.contact,
      source: item.source,
      status: item.status,
      last_verified: new Date(),
    });

    await this.logChange({
      action: 'created',
      collection: 'venues',
      documentId: created.id,
      changes: [{ field: '*', before: null, after: created }],
      reason: 'Created from Google Sheets import',
    });

    return { action: 'created', id: created.id };
  }

  private parseVenueType(type: string): VenueType {
    const normalized = type.toLowerCase().trim();
    const typeMap: Record<string, VenueType> = {
      restaurant: 'restaurant',
      cafe: 'restaurant',
      'quick-service': 'restaurant',
      'quick service': 'restaurant',
      qsr: 'restaurant',
      canteen: 'restaurant',
      kantine: 'restaurant',
      hotel: 'restaurant',
      catering: 'restaurant',
      delivery: 'delivery_kitchen',
      'delivery kitchen': 'delivery_kitchen',
      'ghost kitchen': 'delivery_kitchen',
      retail: 'retail',
      store: 'retail',
      supermarket: 'retail',
    };

    return typeMap[normalized] || 'restaurant';
  }

  private parseOpeningHours(hours: string): { [K in DayOfWeek]?: { open: string; close: string }[] } {
    // Simple parsing - expects format like "Mon-Fri: 11:00-22:00, Sat-Sun: 12:00-22:00"
    const result: { [K in DayOfWeek]?: { open: string; close: string }[] } = {};
    const dayMap: Record<string, DayOfWeek> = {
      mon: 'monday',
      tue: 'tuesday',
      wed: 'wednesday',
      thu: 'thursday',
      fri: 'friday',
      sat: 'saturday',
      sun: 'sunday',
    };

    const parts = hours.split(',').map((p) => p.trim());

    for (const part of parts) {
      const match = part.match(/([a-zA-Z-]+):\s*(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
      if (match) {
        const [, days, open, close] = match;
        const dayRange = days.toLowerCase().split('-');

        if (dayRange.length === 2) {
          // Range like Mon-Fri
          const allDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
          const startIdx = allDays.indexOf(dayRange[0] as typeof allDays[number]);
          const endIdx = allDays.indexOf(dayRange[1] as typeof allDays[number]);

          if (startIdx >= 0 && endIdx >= 0) {
            for (let i = startIdx; i <= endIdx; i++) {
              const day = dayMap[allDays[i]];
              result[day] = [{ open, close }];
            }
          }
        } else {
          // Single day
          const day = dayMap[dayRange[0]];
          if (day) {
            result[day] = [{ open, close }];
          }
        }
      }
    }

    return result;
  }

  private detectChanges(
    existing: Venue,
    updated: Venue
  ): Array<{ field: string; before: unknown; after: unknown }> {
    const changes: Array<{ field: string; before: unknown; after: unknown }> = [];
    const fieldsToCheck: (keyof Venue)[] = ['name', 'type', 'address', 'contact', 'opening_hours', 'location'];

    for (const field of fieldsToCheck) {
      const before = existing[field];
      const after = updated[field];

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({ field, before, after });
      }
    }

    return changes;
  }
}
