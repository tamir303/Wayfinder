import fixture from '../../test/fixtures/google_hotels/paris-hotels.json';
import { mapHotels } from './stays.mapper';

describe('mapHotels (real Paris fixture)', () => {
  const result = mapHotels(fixture);

  it('maps every property and exposes the next page token', () => {
    expect(result.stays).toHaveLength(20);
    expect(result.nextPageToken).toBe('CBI=');
  });

  it('maps the fields the app needs', () => {
    const s = result.stays[0]!;
    expect(s).toMatchObject({
      id: 'ChkIh_ig59yqmq16Gg0vZy8xMWY2Y3IybmpqEAE',
      name: 'Courtyard by Marriott Paris Gare de Lyon',
      type: 'hotel',
      stars: 4,
      rating: 4.4,
      reviewCount: 1764,
      pricePerNight: 202,
      totalPrice: 809,
      currency: 'USD',
      lat: 48.8450789,
      lng: 2.3712402,
      deal: '22% less than usual',
    });
    expect(s.thumbnail).toMatch(/^https:\/\//);
    expect(s.amenities).toContain('Air conditioning');
    expect(s.providerUrl).toMatch(/^https:\/\/www\.marriott\.com\//);
  });

  it('strips the paid marker from amenities', () => {
    for (const s of result.stays) for (const a of s.amenities) expect(a).not.toMatch(/\(\$+\)$/);
    expect(result.stays[0]!.amenities).toContain('Breakfast');
  });

  it('gives every stay a unique id, a positive price and real coordinates', () => {
    expect(new Set(result.stays.map((s) => s.id)).size).toBe(20);
    for (const s of result.stays) {
      expect(s.pricePerNight).toBeGreaterThan(0);
      expect(Math.abs(s.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(s.lng)).toBeLessThanOrEqual(180);
    }
  });

  it('keeps vacation rentals and marks their type', () => {
    expect(result.stays.some((s) => s.type === 'vacation rental')).toBe(true);
  });
});

describe('mapHotels edge cases', () => {
  const first = fixture.properties[0]!;

  it('treats the provider no-results message as an empty result', () => {
    expect(mapHotels({ error: "Google Hotels hasn't returned any results for this search." })).toEqual({ stays: [], nextPageToken: null });
  });

  it('throws PROVIDER_DOWN for any other provider error', () => {
    expect(() => mapHotels({ error: 'Invalid API key.' })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });

  it('throws PROVIDER_DOWN for an unexpected shape or when every property is malformed', () => {
    expect(() => mapHotels(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapHotels({ foo: 1 })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapHotels({ properties: [{ nope: true }] })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });

  it('skips a malformed or unpriced property but keeps the rest', () => {
    const unpriced = { ...first, rate_per_night: undefined };
    expect(mapHotels({ properties: [{ nope: true }, unpriced, first] }).stays).toHaveLength(1);
  });

  it('falls back to the lowest price when there is no display price, and tolerates missing optional fields', () => {
    const minimal = {
      name: 'Tiny Inn',
      property_token: 'tok',
      gps_coordinates: { latitude: 1, longitude: 2 },
      rate_per_night: { extracted_lowest: 99 },
    };
    expect(mapHotels({ properties: [minimal] }).stays[0]).toMatchObject({
      id: 'tok',
      pricePerNight: 99,
      totalPrice: null,
      stars: null,
      rating: null,
      reviewCount: 0,
      thumbnail: null,
      deal: null,
      amenities: [],
      providerUrl: null,
    });
  });

  it('returns an empty list for an empty properties array', () => {
    expect(mapHotels({ properties: [] })).toEqual({ stays: [], nextPageToken: null });
  });
});
