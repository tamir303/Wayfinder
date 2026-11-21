import { Inject, Injectable } from '@nestjs/common';
import type {
  StayCalendarQuery,
  StayCalendarResponse,
  StayDetail,
  StayDetailQuery,
  StayReviewsQuery,
  StayReviewsResponse,
  StaySearchQuery,
  StaySearchResponse,
  StaySuggestQuery,
  StaySuggestResponse,
} from '@wayfinder/shared';
import { AppError } from '../common/app-error';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { HandoffClickService } from '../handoff/handoff-click.service';
import { HandoffSigner } from '../handoff/handoff-signer';
import { SerpApiClient } from '../provider/serpapi.client';
import { mapHotels, mapReviews, mapStayCalendar, mapStayDetail, mapSuggestions } from './stays.mapper';

const SEARCH_TTL_SECONDS = 30 * 60;
const SUGGEST_TTL_SECONDS = 24 * 60 * 60;
const CALENDAR_TTL_SECONDS = 3 * 60 * 60; // a price calendar changes slowly
const REVIEWS_TTL_SECONDS = 24 * 60 * 60;
const CURRENCY = 'USD';

// `provider` is set for offers from the detail page, so the click is logged against the booking site, not Google.
type StayHandoff = { userId: string; url: string; name: string; price: number; provider?: string };

// Used when Google gives no provider link for a property.
const fallbackUrl = (name: string, destination: string) =>
  `https://www.google.com/travel/search?q=${encodeURIComponent(`${name} ${destination}`)}`;

@Injectable()
export class StaysService {
  constructor(
    private readonly serpApi: SerpApiClient,
    private readonly signer: HandoffSigner,
    private readonly clicks: HandoffClickService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async search(userId: string, q: StaySearchQuery): Promise<StaySearchResponse> {
    // The cache holds only what is the same for every user; per-user handoff links are added after.
    const mapped = await this.serpApi.call({
      engine: 'google_hotels',
      params: {
        q: q.q,
        check_in_date: q.checkIn,
        check_out_date: q.checkOut,
        adults: q.adults,
        currency: CURRENCY,
        gl: 'us',
        hl: 'en',
        ...(q.pageToken ? { next_page_token: q.pageToken } : {}),
      },
      ttlSeconds: SEARCH_TTL_SECONDS,
      userId,
      map: (raw) => mapHotels(raw, CURRENCY),
    });

    const now = Math.floor(Date.now() / 1000);
    return {
      nextPageToken: mapped.nextPageToken,
      stays: mapped.stays.map(({ providerUrl, ...stay }) => {
        const url = providerUrl ?? fallbackUrl(stay.name, q.q);
        const ref = this.signer.sign<StayHandoff>('stay', { userId, url, name: stay.name, price: stay.pricePerNight }, now, SEARCH_TTL_SECONDS);
        return { ...stay, dealUrl: `${this.env.PUBLIC_API_URL}/stays/handoff?ref=${ref}` };
      }),
    };
  }

  async suggest(userId: string, q: StaySuggestQuery): Promise<StaySuggestResponse> {
    return this.serpApi.call({
      engine: 'google_hotels_autocomplete',
      params: { q: q.q.toLowerCase(), gl: 'us', hl: 'en', currency: CURRENCY },
      ttlSeconds: SUGGEST_TTL_SECONDS,
      userId,
      map: mapSuggestions,
    });
  }

  /** Best one-night price per start day for one property. */
  async calendar(userId: string, token: string, q: StayCalendarQuery): Promise<StayCalendarResponse> {
    return this.serpApi.call({
      engine: 'google_hotels_price_calendar',
      params: { property_token: token, start_date: q.start, end_date: q.end, adults: q.adults, currency: CURRENCY, gl: 'us', hl: 'en' },
      ttlSeconds: CALENDAR_TTL_SECONDS,
      userId,
      map: (raw) => mapStayCalendar(raw, CURRENCY),
    });
  }

  /** Guest reviews, ten per page. */
  async reviews(userId: string, token: string, q: StayReviewsQuery): Promise<StayReviewsResponse> {
    return this.serpApi.call({
      engine: 'google_hotels_reviews',
      params: { property_token: token, hl: 'en', ...(q.pageToken ? { next_page_token: q.pageToken } : {}) },
      ttlSeconds: REVIEWS_TTL_SECONDS,
      userId,
      map: mapReviews,
    });
  }

  /** One property with its prices by provider; the dates drive the prices. */
  async detail(userId: string, token: string, q: StayDetailQuery): Promise<StayDetail> {
    const mapped = await this.serpApi.call({
      engine: 'google_hotels',
      params: {
        q: q.q,
        check_in_date: q.checkIn,
        check_out_date: q.checkOut,
        adults: q.adults,
        property_token: token,
        currency: CURRENCY,
        gl: 'us',
        hl: 'en',
      },
      ttlSeconds: SEARCH_TTL_SECONDS,
      userId,
      map: (raw) => mapStayDetail(raw, CURRENCY),
    });

    const now = Math.floor(Date.now() / 1000);
    return {
      ...mapped.detail,
      offers: mapped.offers.map(({ providerUrl, ...offer }) => {
        const ref = this.signer.sign<StayHandoff>(
          'stay',
          { userId, url: providerUrl, name: mapped.detail.name, price: offer.pricePerNight, provider: offer.provider },
          now,
          SEARCH_TTL_SECONDS,
        );
        return { ...offer, dealUrl: `${this.env.PUBLIC_API_URL}/stays/handoff?ref=${ref}` };
      }),
    };
  }

  /** Verifies a signed stay ref, records the click and returns the provider URL to redirect to. No credit is spent. */
  async handoff(ref: string): Promise<string> {
    const p = this.signer.verify<StayHandoff>(ref, Math.floor(Date.now() / 1000), 'stay');
    let host: string;
    try {
      const parsed = new URL(p.url);
      if (parsed.protocol !== 'https:') throw new Error('not https');
      host = parsed.hostname;
    } catch {
      throw new AppError('BAD_QUERY', 'Invalid or expired link');
    }
    await this.clicks.record({ userId: p.userId, kind: 'stay', provider: p.provider ?? host, price: p.price, currency: CURRENCY });
    return p.url;
  }
}
