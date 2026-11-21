import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { FlightSearchQuery, FlightSearchResponse } from '@wayfinder/shared';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { HandoffClickService } from '../handoff/handoff-click.service';
import { renderHandoffPage, type RenderedPage } from '../handoff/handoff-page';
import { HandoffSigner } from '../handoff/handoff-signer';
import { SerpApiClient } from '../provider/serpapi.client';
import { mapBookingOptions, mapFlights } from './flights.mapper';

const SEARCH_TTL_SECONDS = 30 * 60; // prices move; users compare, so keep this well under SerpAPI's own 1 h cache
const HANDOFF_TTL_SECONDS = SEARCH_TTL_SECONDS;
const TRAVEL_CLASS = { economy: '1', premium: '2', business: '3', first: '4' } as const;
const BOOKING_TTL_SECONDS = 10 * 60; // booking requests are short-lived on the provider side
const CURRENCY = 'USD';

@Injectable()
export class FlightsService {
  constructor(
    private readonly serpApi: SerpApiClient,
    private readonly signer: HandoffSigner,
    private readonly clicks: HandoffClickService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async search(userId: string, q: FlightSearchQuery): Promise<FlightSearchResponse> {
    // The cache holds only what is the same for every user; the per-user handoff link is added after.
    const mapped = await this.serpApi.call({
      engine: 'google_flights',
      params: {
        departure_id: q.from,
        arrival_id: q.to,
        outbound_date: q.date,
        type: '2',
        adults: q.adults,
        travel_class: TRAVEL_CLASS[q.cabin],
        currency: CURRENCY,
        hl: 'en',
        gl: 'us',
      },
      ttlSeconds: SEARCH_TTL_SECONDS,
      userId,
      map: (raw) => mapFlights(raw, CURRENCY),
    });

    const now = Math.floor(Date.now() / 1000);
    return {
      insights: mapped.insights,
      offers: mapped.offers.map(({ bookingToken, ...offer }) => {
        const ref = this.signer.sign(
          { userId, bookingToken, from: q.from, to: q.to, date: q.date, adults: q.adults, cabin: q.cabin },
          now,
          HANDOFF_TTL_SECONDS,
        );
        return { ...offer, handoffUrl: `${this.env.PUBLIC_API_URL}/flights/handoff?ref=${ref}` };
      }),
    };
  }

  /**
   * Resolve a signed handoff ref into a page that sends the user to the provider.
   * The user comes from the signed ref (the system browser sends no token); the lookup costs that user 1 credit.
   */
  async handoff(ref: string): Promise<RenderedPage> {
    const p = this.signer.verify(ref, Math.floor(Date.now() / 1000));
    const options = await this.serpApi.call({
      engine: 'google_flights',
      params: {
        departure_id: p.from,
        arrival_id: p.to,
        outbound_date: p.date,
        type: '2',
        adults: p.adults,
        travel_class: TRAVEL_CLASS[p.cabin as keyof typeof TRAVEL_CLASS] ?? '1',
        booking_token: p.bookingToken,
        currency: CURRENCY,
        hl: 'en',
        gl: 'us',
      },
      ttlSeconds: BOOKING_TTL_SECONDS,
      userId: p.userId,
      map: mapBookingOptions,
    });

    const page = renderHandoffPage(options, randomBytes(16).toString('base64url'), CURRENCY);
    await this.clicks.record({
      userId: p.userId,
      kind: 'flight',
      provider: page.provider,
      price: Math.min(...options.map((o) => o.price)),
      currency: CURRENCY,
    });
    return page;
  }
}
