import fixture from '../../test/fixtures/google_hotels/paris-hotels.json';
import detail from '../../test/fixtures/google_hotels/courtyard-gare-de-lyon.json';
import autocomplete from '../../test/fixtures/google_hotels_autocomplete/paris.json';
import calendar from '../../test/fixtures/google_hotels_price_calendar/courtyard-march.json';
import reviews from '../../test/fixtures/google_hotels_reviews/courtyard-reviews.json';
import { mapHotels, mapReviews, mapStayCalendar, mapStayDetail, mapSuggestions } from './stays.mapper';

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


describe('mapSuggestions (real autocomplete fixture)', () => {
  it('maps text, kind, location and property token', () => {
    const { suggestions } = mapSuggestions(autocomplete);
    expect(suggestions).toHaveLength(10);
    expect(suggestions[0]).toMatchObject({ text: 'paris las vegas', kind: 'accommodation' });
    expect(suggestions.some((s) => s.propertyToken)).toBe(true);
    expect(suggestions.every((s) => s.text.length > 0)).toBe(true);
  });

  it('is empty for no suggestions and PROVIDER_DOWN for provider errors or bad shapes', () => {
    expect(mapSuggestions({ suggestions: [] }).suggestions).toEqual([]);
    expect(mapSuggestions({ error: "Google Hotels hasn't returned any results for this search." }).suggestions).toEqual([]);
    expect(() => mapSuggestions({ error: 'Invalid API key.' })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapSuggestions(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });
});

describe('mapStayDetail (real Courtyard fixture)', () => {
  const d = mapStayDetail(detail);

  it('maps the property facts', () => {
    expect(d.detail).toMatchObject({
      id: 'ChkIh_ig59yqmq16Gg0vZy8xMWY2Y3IybmpqEAE',
      name: 'Courtyard by Marriott Paris Gare de Lyon',
      type: 'hotel',
      address: '209-211 Rue de Bercy, 75012 Paris, France',
      stars: 4,
      rating: 4.4,
      reviewCount: 1764,
      locationRating: 4.6,
      currency: 'USD',
      deal: '22% less than usual',
      typicalPriceRange: { low: 206, high: 265 },
    });
    expect(d.detail.lat).toBeCloseTo(48.845, 2);
    expect(d.detail.ratingBreakdown[0]).toEqual({ stars: 5, count: 1152 });
    expect(d.detail.reviewSources[0]).toMatchObject({ source: 'Tripadvisor', maxRating: 5, count: 852 });
    expect(d.detail.images.length).toBeGreaterThan(3);
    expect(d.detail.images.every((u) => u.startsWith('https://'))).toBe(true);
    expect(d.detail.amenities).toContain('Wi-Fi');
    expect(d.detail.nearby[0]!.transport[0]).toEqual({ type: 'Taxi', duration: '11 min' });
  });

  it('lists provider offers cheapest first with a provider link kept server-side', () => {
    expect(d.offers.length).toBeGreaterThan(10);
    const prices = d.offers.map((o) => o.pricePerNight);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(d.offers[0]).toMatchObject({ provider: 'Super.com', pricePerNight: 202, official: false });
    expect(d.offers.find((o) => o.official)?.provider).toBe('Courtyard by Marriott Paris Gare de Lyon');
    for (const o of d.offers) expect(o.providerUrl).toMatch(/^https:\/\//);
  });
});

describe('mapStayDetail edge cases', () => {
  it('maps NOT_FOUND-style provider errors to NOT_FOUND and others to PROVIDER_DOWN', () => {
    expect(() => mapStayDetail({ error: 'Property not found.' })).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    expect(() => mapStayDetail({ error: 'Invalid API key.' })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapStayDetail(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapStayDetail({ nope: 1 })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });

  it('skips offers without a usable https link or price and tolerates missing optional fields', () => {
    const minimal = {
      name: 'Tiny Inn',
      property_token: 'tok',
      gps_coordinates: { latitude: 1, longitude: 2 },
      prices: [
        { source: 'NoLink', rate_per_night: { extracted_display_price: 50 } },
        { source: 'Insecure', link: 'http://x.example', rate_per_night: { extracted_display_price: 40 } },
        { source: 'NoPrice', link: 'https://x.example' },
        { source: 'Good', link: 'https://good.example', rate_per_night: { extracted_display_price: 60 } },
      ],
    };
    const d = mapStayDetail(minimal);
    expect(d.offers.map((o) => o.provider)).toEqual(['Good']);
    expect(d.detail).toMatchObject({ stars: null, rating: null, reviewCount: 0, description: null, images: [], amenities: [], typicalPriceRange: null, deal: null });
  });
});

describe('mapStayCalendar (real March fixture)', () => {
  it('maps one price per start day, in date order', () => {
    const r = mapStayCalendar(calendar);
    expect(r.currency).toBe('USD');
    expect(r.prices).toHaveLength(31);
    expect(r.prices[0]).toEqual({ date: '2027-03-01', pricePerNight: 230 });
    const dates = r.prices.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('skips days without a price, tolerates an empty list, and handles provider errors', () => {
    expect(mapStayCalendar({ prices: [{ date: '2027-03-01' }, { date: '2027-03-02', extracted_display_price: 99 }] }).prices).toEqual([{ date: '2027-03-02', pricePerNight: 99 }]);
    expect(mapStayCalendar({ prices: [] }).prices).toEqual([]);
    expect(mapStayCalendar({ error: "Google Hotels hasn't returned any results for this search." }).prices).toEqual([]);
    expect(() => mapStayCalendar({ error: 'Invalid API key.' })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapStayCalendar(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapStayCalendar({ nope: 1 })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });
});

describe('mapReviews (real Courtyard fixture)', () => {
  const r = mapReviews(reviews);

  it('maps reviews and the next page token', () => {
    expect(r.reviews).toHaveLength(10);
    expect(r.nextPageToken).toMatch(/:10$/);
    expect(r.reviews[0]).toMatchObject({ author: 'Catherine Wygal', source: 'Google', rating: 5, date: 'a week ago' });
    expect(r.reviews[0]!.text).toContain('Marriott Courtyard');
  });

  it('normalises ratings to a 0-5 scale and keeps only https images, at most 3', () => {
    for (const rv of r.reviews) {
      expect(rv.rating).toBeGreaterThanOrEqual(0);
      expect(rv.rating).toBeLessThanOrEqual(5);
      expect(rv.images.length).toBeLessThanOrEqual(3);
      for (const u of rv.images) expect(u.startsWith('https://')).toBe(true);
    }
    const scaled = mapReviews({ reviews: [{ user: { name: 'A' }, source: 'X', rating: 8, best_rating: 10, snippet: 'ok' }] });
    expect(scaled.reviews[0]!.rating).toBe(4);
  });

  it('does not leak reviewer profile links or avatars', () => {
    const out = JSON.stringify(r);
    expect(out).not.toContain('google.com/maps/contrib');
    expect(out).not.toContain('lh3.googleusercontent.com/a-');
  });

  it('keeps sub-ratings when present and skips reviews without text', () => {
    expect(r.reviews.some((x) => x.subratings && x.subratings.rooms !== undefined)).toBe(true);
    expect(mapReviews({ reviews: [{ user: { name: 'A' }, source: 'X', rating: 5 }, { user: { name: 'B' }, source: 'X', rating: 4, snippet: 'fine' }] }).reviews).toHaveLength(1);
  });

  it('handles empty lists and errors', () => {
    expect(mapReviews({ reviews: [] })).toEqual({ reviews: [], nextPageToken: null });
    expect(() => mapReviews({ error: 'Invalid API key.' })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapReviews({ error: 'Property not found.' })).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    expect(() => mapReviews(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapReviews({ nope: 1 })).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
  });
});
