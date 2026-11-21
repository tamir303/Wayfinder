import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError } from '../common/app-error';
import { SerpApiClient } from './serpapi.client';

// shortcut: fixtures live in test/fixtures and are read relative to the working directory (apps/api when run via
// `pnpm dev`); move them next to the source if the mock backend ever runs from elsewhere.
const FIXTURES = join(process.cwd(), 'test', 'fixtures');

const pick = (engine: string, p: Record<string, string>): string => {
  switch (engine) {
    case 'google_flights':
      if (p.departure_token) return 'google_flights/tlv-cdg-roundtrip-return.json';
      if (p.booking_token) return p.return_date ? 'google_flights/tlv-cdg-roundtrip-booking.json' : 'google_flights/tlv-cdg-oneway-booking.json';
      return p.return_date ? 'google_flights/tlv-cdg-roundtrip.json' : 'google_flights/tlv-cdg-oneway.json';
    case 'google_flights_calendar':
      return 'google_flights_calendar/tlv-cdg-march.json';
    case 'google_flights_autocomplete':
      return 'google_flights_autocomplete/tel-aviv.json';
    case 'google_hotels':
      return p.property_token ? 'google_hotels/courtyard-gare-de-lyon.json' : 'google_hotels/paris-hotels.json';
    case 'google_hotels_autocomplete':
      return 'google_hotels_autocomplete/paris.json';
    case 'google_hotels_price_calendar':
      return 'google_hotels_price_calendar/courtyard-march.json';
    case 'google_hotels_reviews':
      return 'google_hotels_reviews/courtyard-reviews.json';
    default:
      throw new AppError('BAD_QUERY', `No mock data for ${engine}`);
  }
};

// Mock backend (dev): answers every SerpAPI call from the recorded fixtures, so it costs no credits and needs no key.
// Every query returns the same recorded route (TLV to Paris), whatever was asked.
export class FixtureSerpApiClient extends SerpApiClient {
  protected override async fetchWithRetry(engine: string, canonical: Record<string, string>): Promise<unknown> {
    return JSON.parse(await readFile(join(FIXTURES, pick(engine, canonical)), 'utf8'));
  }
}
