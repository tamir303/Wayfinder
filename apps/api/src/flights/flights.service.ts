import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  FlightCalendarQuery,
  FlightCalendarResponse,
  FlightReturnQuery,
  FlightSearchQuery,
  FlightSearchResponse,
} from '@wayfinder/shared';
import { ENV } from '../common/tokens';
import type { Env } from '../config/env';
import { HandoffClickService } from '../handoff/handoff-click.service';
import { renderHandoffPage, type RenderedPage } from '../handoff/handoff-page';
import { HandoffSigner } from '../handoff/handoff-signer';
import { SerpApiClient } from '../provider/serpapi.client';
import { mapBookingOptions, mapCalendar, mapFlights, type MappedFlights } from './flights.mapper';

const SEARCH_TTL_SECONDS = 30 * 60; // prices move; users compare, so keep this well under SerpAPI's own 1 h cache
const HANDOFF_TTL_SECONDS = SEARCH_TTL_SECONDS;
const BOOKING_TTL_SECONDS = 10 * 60; // booking requests are short-lived on the provider side
const CALENDAR_TTL_SECONDS = 3 * 60 * 60; // a price calendar changes slowly
const TRAVEL_CLASS = { economy: '1', premium: '2', business: '3', first: '4' } as const;
const CURRENCY = 'USD';

type Trip = { from: string; to: string; date: string; returnDate?: string | undefined; adults: number; cabin: keyof typeof TRAVEL_CLASS };
type FlightHandoff = Trip & { userId: string; bookingToken: string };

@Injectable()
export class FlightsService {
  constructor(
    private readonly serpApi: SerpApiClient,
    private readonly signer: HandoffSigner,
    private readonly clicks: HandoffClickService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Params shared by search, return and booking calls. A round trip is type 1 with a return date. */
  private tripParams(t: Trip) {
    return {
      departure_id: t.from,
      arrival_id: t.to,
      outbound_date: t.date,
      type: t.returnDate ? '1' : '2',
      ...(t.returnDate ? { return_date: t.returnDate } : {}),
      adults: t.adults,
      travel_class: TRAVEL_CLASS[t.cabin] ?? '1',
      currency: CURRENCY,
      hl: 'en',
      gl: 'us',
    };
  }

  /** One-way: bookable offers. Round trip: outbound options, each with a returnToken for step two. */
  async search(userId: string, q: FlightSearchQuery): Promise<FlightSearchResponse> {
    // The cache holds only what is the same for every user; the per-user handoff link is added after.
    const mapped = await this.serpApi.call({
      engine: 'google_flights',
      params: this.tripParams(q),
      ttlSeconds: SEARCH_TTL_SECONDS,
      userId,
      map: (raw) => mapFlights(raw, CURRENCY),
    });
    return this.withHandoff(userId, mapped, q);
  }

  /** Step two of a round trip: the return flights for a chosen outbound, priced as the whole trip. */
  async returnFlights(userId: string, q: FlightReturnQuery): Promise<FlightSearchResponse> {
    const mapped = await this.serpApi.call({
      engine: 'google_flights',
      params: { ...this.tripParams(q), departure_token: q.token },
      ttlSeconds: SEARCH_TTL_SECONDS,
      userId,
      map: (raw) => mapFlights(raw, CURRENCY),
    });
    return this.withHandoff(userId, mapped, q);
  }

  async calendar(userId: string, q: FlightCalendarQuery): Promise<FlightCalendarResponse> {
    return this.serpApi.call({
      engine: 'google_flights_calendar',
      params: {
        departure_id: q.from,
        arrival_id: q.to,
        type: '2',
        date_range_start: q.start,
        date_range_end: q.end,
        currency: CURRENCY,
        hl: 'en',
        gl: 'us',
      },
      ttlSeconds: CALENDAR_TTL_SECONDS,
      userId,
      map: (raw) => mapCalendar(raw, CURRENCY),
    });
  }

  private withHandoff(userId: string, mapped: MappedFlights, trip: Trip): FlightSearchResponse {
    const now = Math.floor(Date.now() / 1000);
    return {
      insights: mapped.insights,
      asOf: mapped.asOf,
      offers: mapped.offers.map(({ bookingToken, ...offer }) => {
        if (!bookingToken) return { ...offer, handoffUrl: null }; // round-trip outbound: pick a return flight first
        const payload: FlightHandoff = { userId, bookingToken, ...trip };
        const ref = this.signer.sign('flight', payload, now, HANDOFF_TTL_SECONDS);
        return { ...offer, handoffUrl: `${this.env.PUBLIC_API_URL}/flights/handoff?ref=${ref}` };
      }),
    };
  }

  /**
   * Resolve a signed handoff ref into a page that sends the user to the provider.
   * The user comes from the signed ref (the system browser sends no token); the lookup costs that user 1 credit.
   */
  async handoff(ref: string): Promise<RenderedPage> {
    const p = this.signer.verify<FlightHandoff>(ref, Math.floor(Date.now() / 1000), 'flight');
    const options = await this.serpApi.call({
      engine: 'google_flights',
      params: { ...this.tripParams(p), booking_token: p.bookingToken },
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
