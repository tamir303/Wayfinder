import booking from '../../test/fixtures/google_flights/tlv-cdg-oneway-booking.json';
import oneway from '../../test/fixtures/google_flights/tlv-cdg-oneway.json';
import roundtripBooking from '../../test/fixtures/google_flights/tlv-cdg-roundtrip-booking.json';
import roundtripReturn from '../../test/fixtures/google_flights/tlv-cdg-roundtrip-return.json';
import roundtrip from '../../test/fixtures/google_flights/tlv-cdg-roundtrip.json';
import calendar from '../../test/fixtures/google_flights_calendar/tlv-cdg-march.json';
import { mapBookingOptions, mapCalendar, mapFlights } from './flights.mapper';

describe('mapFlights (real tlv-cdg fixture)', () => {
  const result = mapFlights(oneway);

  // The fixture has 4 best + 7 other flights, but one "best" flight carries no price at all
  // (a real SerpAPI quirk). Offers without a price cannot be shown or sorted, so they are skipped.
  it('merges best and other flights, tags the group and skips the priceless offer', () => {
    expect(result.offers).toHaveLength(10);
    expect(result.offers.filter((o) => o.group === 'best')).toHaveLength(3);
    expect(result.offers.filter((o) => o.group === 'other')).toHaveLength(7);
  });

  it('maps a direct flight', () => {
    const o = result.offers[0]!;
    expect(o).toMatchObject({
      group: 'best',
      price: 226,
      currency: 'USD',
      airline: 'El Al',
      totalDurationMin: 310,
      stops: 0,
      layovers: [],
      emissions: { grams: 283000, typicalGrams: 309000, diffPercent: -8 },
    });
    expect(o.legs).toEqual([
      {
        fromCode: 'TLV',
        toCode: 'CDG',
        departTime: '2027-03-10 16:50',
        arriveTime: '2027-03-10 21:00',
        airline: 'El Al',
        flightNumber: 'LY 325',
        durationMin: 310,
      },
    ]);
    expect(o.bookingToken!.length).toBeGreaterThan(20);
    expect(o.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('maps layovers and the stop count of a connecting flight', () => {
    const o = result.offers.find((x) => x.stops === 1)!;
    expect(o.layovers[0]).toEqual({ code: 'OTP', name: 'Bucharest Henri Coandă International Airport', durationMin: 335 });
    expect(o.legs).toHaveLength(2);
  });

  it('gives every offer a unique stable id', () => {
    expect(new Set(result.offers.map((o) => o.id)).size).toBe(result.offers.length);
    expect(mapFlights(oneway).offers.map((o) => o.id)).toEqual(result.offers.map((o) => o.id));
  });

  it('maps price insights with the typical range and a daily history', () => {
    expect(result.insights).toMatchObject({ lowestPrice: 136, level: 'low', typicalRange: { low: 150, high: 255 } });
    expect(result.insights!.history).toHaveLength(62);
    expect(result.insights!.history[0]).toEqual({ date: '2026-09-20', price: 112 });
    const dates = result.insights!.history.map((h) => h.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('stamps when the provider was queried', () => {
    const at = new Date('2027-01-02T03:04:05.000Z');
    expect(mapFlights(oneway, 'USD', at).asOf).toBe('2027-01-02T03:04:05.000Z');
    expect(mapFlights({ error: "Google Flights hasn't returned any results for this query." }, 'USD', at).asOf).toBe('2027-01-02T03:04:05.000Z');
  });
});

describe('mapFlights edge cases', () => {
  it('treats the provider no-results message as an empty result', () => {
    expect(mapFlights({ error: "Google Flights hasn't returned any results for this query." })).toMatchObject({
      offers: [],
      insights: null,
    });
  });

  it('throws PROVIDER_DOWN for any other provider error, so it is never cached as empty', () => {
    expect(() => mapFlights({ error: 'Invalid API key.' })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });

  it('throws PROVIDER_DOWN for an unexpected shape', () => {
    expect(() => mapFlights(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapFlights({ foo: 1 })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapFlights({ best_flights: [{ nope: true }] })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });

  it('skips a single malformed offer but keeps the rest', () => {
    const raw = { best_flights: [{ nope: true }, oneway.best_flights[0]], other_flights: [] };
    expect(mapFlights(raw).offers).toHaveLength(1);
  });

  it('returns no offers when both lists are empty', () => {
    expect(mapFlights({ best_flights: [], other_flights: [] })).toMatchObject({ offers: [], insights: null });
  });
});


describe('mapBookingOptions (real booking fixture)', () => {
  it('maps providers with price and the POST request', () => {
    const options = mapBookingOptions(booking);
    expect(options).toHaveLength(2);
    expect(options[0]!).toMatchObject({ provider: 'El Al', price: 226 });
    expect(options[0]!.request.url).toMatch(/^https:\/\//);
    expect(options[0]!.request.fields).toEqual(expect.objectContaining({ u: expect.any(String) }));
  });

  it('throws PROVIDER_DOWN when there are no usable options', () => {
    expect(() => mapBookingOptions({ booking_options: [] })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapBookingOptions({ error: 'x' })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });
});

describe('round trip (real fixtures)', () => {
  it('maps outbound options with a return token and no booking token yet', () => {
    const { offers } = mapFlights(roundtrip);
    expect(offers).toHaveLength(10);
    for (const o of offers) {
      expect(o.returnToken).toBeTruthy();
      expect(o.bookingToken).toBeNull();
    }
    expect(offers[0]).toMatchObject({ price: 405, stops: 0 });
    expect(new Set(offers.map((o) => o.id)).size).toBe(10);
  });

  it('maps return-leg options as bookable offers with a booking token', () => {
    const { offers } = mapFlights(roundtripReturn);
    expect(offers).toHaveLength(8);
    for (const o of offers) {
      expect(o.bookingToken).toBeTruthy();
      expect(o.returnToken).toBeNull();
    }
    expect(offers[0]!.price).toBe(405); // total round-trip price
    expect(offers[0]!.legs[0]).toMatchObject({ fromCode: 'CDG', toCode: 'TLV' });
  });

  it('skips an offer that has neither token', () => {
    const noToken = { ...roundtrip.best_flights[0]!, departure_token: undefined, booking_token: undefined };
    expect(mapFlights({ best_flights: [noToken, roundtrip.best_flights[0]] }).offers).toHaveLength(1);
  });

  it('maps round-trip booking options, cheapest first and capped at 10', () => {
    const options = mapBookingOptions(roundtripBooking);
    expect(options).toHaveLength(10);
    const prices = options.map((o) => o.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

describe('mapCalendar (real March fixture)', () => {
  it('maps one price per day, in date order', () => {
    const r = mapCalendar(calendar);
    expect(r.currency).toBe('USD');
    expect(r.prices).toHaveLength(31);
    expect(r.prices[0]).toEqual({ date: '2027-03-01', price: 170 });
    const dates = r.prices.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('leaves out days without a price and tolerates an empty list', () => {
    expect(mapCalendar({ prices: [{ outbound_date: '2027-03-01' }, { outbound_date: '2027-03-02', price: 99 }] }).prices).toEqual([{ date: '2027-03-02', price: 99 }]);
    expect(mapCalendar({ prices: [] }).prices).toEqual([]);
  });

  it('treats the no-results message as empty and any other error as PROVIDER_DOWN', () => {
    expect(mapCalendar({ error: "Google Flights hasn't returned any results for this query." }).prices).toEqual([]);
    expect(() => mapCalendar({ error: 'Invalid API key.' })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapCalendar(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapCalendar({ nope: 1 })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });
});
