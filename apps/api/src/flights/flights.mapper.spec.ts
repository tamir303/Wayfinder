import booking from '../../test/fixtures/google_flights/tlv-cdg-oneway-booking.json';
import oneway from '../../test/fixtures/google_flights/tlv-cdg-oneway.json';
import { mapBookingOptions, mapFlights } from './flights.mapper';

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
    expect(o.bookingToken.length).toBeGreaterThan(20);
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

  it('maps price insights', () => {
    expect(result.insights).toEqual({ lowestPrice: 136, level: 'low' });
  });
});

describe('mapFlights edge cases', () => {
  it('treats the provider no-results message as an empty result', () => {
    expect(mapFlights({ error: "Google Flights hasn't returned any results for this query." })).toEqual({
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
    expect(mapFlights({ best_flights: [], other_flights: [] })).toEqual({ offers: [], insights: null });
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
