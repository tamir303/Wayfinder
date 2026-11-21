import { Inject, Injectable } from '@nestjs/common';
import type { FlightSearchQuery, FlightSearchResponse } from '@wayfinder/shared';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { HandoffSigner } from '../handoff/handoff-signer';
import { SerpApiClient } from '../provider/serpapi.client';
import { mapFlights } from './flights.mapper';

const SEARCH_TTL_SECONDS = 30 * 60; // prices move; users compare, so keep this well under SerpAPI's own 1 h cache
const HANDOFF_TTL_SECONDS = SEARCH_TTL_SECONDS;
const TRAVEL_CLASS = { economy: '1', premium: '2', business: '3', first: '4' } as const;
const CURRENCY = 'USD';

@Injectable()
export class FlightsService {
  constructor(
    private readonly serpApi: SerpApiClient,
    private readonly signer: HandoffSigner,
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
}
