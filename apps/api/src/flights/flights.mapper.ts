import { createHash } from 'node:crypto';
import type { FlightCalendarResponse, FlightOffer, FlightSearchResponse } from '@wayfinder/shared';
import { z } from 'zod';
import { AppError } from '../common/app-error';

const AirportSchema = z.object({ id: z.string(), name: z.string(), time: z.string() });
const RawLegSchema = z.object({
  departure_airport: AirportSchema,
  arrival_airport: AirportSchema,
  duration: z.number(),
  airline: z.string(),
  flight_number: z.string(),
});
const RawOfferSchema = z.object({
  flights: z.array(RawLegSchema).min(1),
  layovers: z.array(z.object({ id: z.string(), name: z.string(), duration: z.number() })).optional(),
  total_duration: z.number(),
  carbon_emissions: z
    .object({ this_flight: z.number(), typical_for_this_route: z.number(), difference_percent: z.number() })
    .optional(),
  price: z.number(),
  // A one-way or return-leg offer is bookable (booking_token); a round-trip outbound option needs a return flight first (departure_token).
  booking_token: z.string().min(1).optional(),
  departure_token: z.string().min(1).optional(),
}).refine((o) => o.booking_token !== undefined || o.departure_token !== undefined);
const RawInsightsSchema = z.object({
  lowest_price: z.number(),
  price_level: z.enum(['low', 'typical', 'high']),
  typical_price_range: z.tuple([z.number(), z.number()]).optional(),
  price_history: z.array(z.tuple([z.number(), z.number()])).optional(),
});

/** An offer before the per-user handoff link is attached. bookingToken never leaves the API; returnToken goes to the client. */
export type MappedOffer = Omit<FlightOffer, 'handoffUrl'> & { bookingToken: string | null };
export type MappedFlights = { offers: MappedOffer[]; insights: FlightSearchResponse['insights']; asOf: string };

// Only SerpAPI's explicit "no results" message is an empty result. Any other error (bad key, quota)
// must surface as PROVIDER_DOWN so it is not cached as "no flights".
const NO_RESULTS = /hasn't returned any results/i;
const providerError = (raw: unknown): string | undefined => {
  const e = typeof raw === 'object' && raw !== null ? (raw as { error?: unknown }).error : undefined;
  return typeof e === 'string' ? e : undefined;
};
const down = (message: string) => new AppError('PROVIDER_DOWN', message);

const toOffer = (raw: z.infer<typeof RawOfferSchema>, group: 'best' | 'other', currency: string): MappedOffer => {
  const airlines = [...new Set(raw.flights.map((l) => l.airline))];
  const layovers = (raw.layovers ?? []).map((l) => ({ code: l.id, name: l.name, durationMin: l.duration }));
  const emissions = raw.carbon_emissions;
  return {
    id: createHash('sha256').update(raw.booking_token ?? raw.departure_token ?? '').digest('hex').slice(0, 16),
    group,
    price: raw.price,
    currency,
    airline: airlines.join(' + '),
    totalDurationMin: raw.total_duration,
    stops: layovers.length || raw.flights.length - 1,
    legs: raw.flights.map((l) => ({
      fromCode: l.departure_airport.id,
      toCode: l.arrival_airport.id,
      departTime: l.departure_airport.time,
      arriveTime: l.arrival_airport.time,
      airline: l.airline,
      flightNumber: l.flight_number,
      durationMin: l.duration,
    })),
    layovers,
    emissions: emissions
      ? { grams: emissions.this_flight, typicalGrams: emissions.typical_for_this_route, diffPercent: emissions.difference_percent }
      : null,
    returnToken: raw.departure_token ?? null,
    bookingToken: raw.booking_token ?? null,
  };
};

export const mapFlights = (raw: unknown, currency = 'USD', now: Date = new Date()): MappedFlights => {
  const asOf = now.toISOString(); // stored with the cached result, so it stays the time the provider was queried
  const error = providerError(raw);
  if (error !== undefined) {
    if (NO_RESULTS.test(error)) return { offers: [], insights: null, asOf };
    throw down('Flight search failed');
  }
  if (typeof raw !== 'object' || raw === null) throw down('Unexpected flights response');
  const body = raw as { best_flights?: unknown; other_flights?: unknown; price_insights?: unknown };
  if (!Array.isArray(body.best_flights) && !Array.isArray(body.other_flights)) throw down('Unexpected flights response');

  const offers: MappedOffer[] = [];
  let seen = 0;
  for (const [group, list] of [['best', body.best_flights], ['other', body.other_flights]] as const) {
    for (const item of Array.isArray(list) ? list : []) {
      seen++;
      const parsed = RawOfferSchema.safeParse(item);
      if (parsed.success) offers.push(toOffer(parsed.data, group, currency));
    }
  }
  // Offers without a price or booking token (SerpAPI omits them for some flights) are skipped.
  // Skipping some offers is fine; every offer failing means the response shape changed.
  if (seen > 0 && offers.length === 0) throw down('Unexpected flights response');

  const insights = RawInsightsSchema.safeParse(body.price_insights);
  return {
    offers,
    asOf,
    insights: insights.success
      ? {
          lowestPrice: insights.data.lowest_price,
          level: insights.data.price_level,
          typicalRange: insights.data.typical_price_range ? { low: insights.data.typical_price_range[0], high: insights.data.typical_price_range[1] } : null,
          history: (insights.data.price_history ?? []).map(([ts, price]) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), price })),
        }
      : null,
  };
};

const RawBookingOptionSchema = z.object({
  together: z.object({
    book_with: z.string(),
    airline: z.boolean().optional(),
    price: z.number(),
    baggage_prices: z.array(z.string()).optional(),
    booking_request: z.object({ url: z.string().url(), post_data: z.string() }),
  }),
});

const MAX_BOOKING_OPTIONS = 10;

export type BookingOption = {
  provider: string;
  price: number;
  isAirline: boolean;
  baggage: string[];
  /** The provider expects a POST of these form fields to this URL. */
  request: { url: string; fields: Record<string, string> };
};

export const mapBookingOptions = (raw: unknown): BookingOption[] => {
  const list = typeof raw === 'object' && raw !== null ? (raw as { booking_options?: unknown }).booking_options : undefined;
  const options: BookingOption[] = [];
  for (const item of Array.isArray(list) ? list : []) {
    const parsed = RawBookingOptionSchema.safeParse(item);
    if (!parsed.success) continue;
    const t = parsed.data.together;
    options.push({
      provider: t.book_with,
      price: t.price,
      isAirline: t.airline ?? false,
      baggage: t.baggage_prices ?? [],
      request: { url: t.booking_request.url, fields: Object.fromEntries(new URLSearchParams(t.booking_request.post_data)) },
    });
  }
  if (options.length === 0) throw down('No booking options available');
  // Cheapest first; a long tail of agencies is noise on a handoff page.
  return options.sort((a, b) => a.price - b.price).slice(0, MAX_BOOKING_OPTIONS);
};

const RawCalendarEntrySchema = z.object({ outbound_date: z.string(), price: z.number() });

export const mapCalendar = (raw: unknown, currency = 'USD'): FlightCalendarResponse => {
  const error = providerError(raw);
  if (error !== undefined) {
    if (NO_RESULTS.test(error)) return { currency, prices: [] };
    throw down('Price calendar failed');
  }
  const list = typeof raw === 'object' && raw !== null ? (raw as { prices?: unknown }).prices : undefined;
  if (!Array.isArray(list)) throw down('Unexpected calendar response');
  const prices: FlightCalendarResponse['prices'] = [];
  for (const item of list) {
    const parsed = RawCalendarEntrySchema.safeParse(item);
    if (parsed.success) prices.push({ date: parsed.data.outbound_date, price: parsed.data.price });
  }
  prices.sort((a, b) => a.date.localeCompare(b.date));
  return { currency, prices };
};
