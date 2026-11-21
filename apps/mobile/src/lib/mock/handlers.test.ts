import { mockRequest, resetMockState } from './handlers';

describe('mockRequest (dev, no network)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetMockState();
  });
  afterEach(() => jest.useRealTimers());
  const call = async (path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }) => {
    const p = mockRequest(path, init);
    await jest.advanceTimersByTimeAsync(300);
    return p;
  };

  it('filters airports by query', async () => {
    const r = (await call('/geo/suggest?q=paris')) as { suggestions: { code: string }[] };
    expect(r.suggestions.map((s) => s.code)).toEqual(['CDG', 'ORY']);
  });
  it('builds flights for the requested route and scales price by adults', async () => {
    const r = (await call('/flights/search?from=TLV&to=CDG&date=2027-03-10&adults=2')) as { offers: { price: number; legs: { fromCode: string }[] }[] };
    expect(r.offers[0].legs[0].fromCode).toBe('TLV');
    expect(r.offers[0].price).toBe(452);
  });
  it('returns no offers when from equals to', async () => {
    expect(await call('/flights/search?from=TLV&to=TLV&date=2027-03-10')).toMatchObject({ offers: [] });
  });
  it('simulates error states with special queries', async () => {
    const fail = async (path: string) => {
      const p = mockRequest(path).then(() => null, (e: unknown) => e);
      await jest.advanceTimersByTimeAsync(300);
      return p;
    };
    expect(await fail('/geo/suggest?q=limit')).toMatchObject({ code: 'RATE_LIMITED' });
    expect(await fail('/geo/suggest?q=down')).toMatchObject({ code: 'PROVIDER_DOWN' });
  });

  it('round trip: outbound options carry a return token and are not bookable yet', async () => {
    const r = (await call('/flights/search?from=TLV&to=CDG&date=2027-03-10&returnDate=2027-03-17&adults=1')) as { offers: { returnToken: string | null; handoffUrl: string | null; price: number }[] };
    expect(r.offers).toHaveLength(6);
    for (const o of r.offers) {
      expect(o.returnToken).toBeTruthy();
      expect(o.handoffUrl).toBeNull();
    }
  });

  it('return step: legs run back on the return date and offers are bookable', async () => {
    const r = (await call('/flights/return?from=TLV&to=CDG&date=2027-03-10&returnDate=2027-03-17&adults=1&token=rt-0')) as {
      offers: { handoffUrl: string | null; returnToken: string | null; legs: { fromCode: string; toCode: string; departTime: string }[] }[];
    };
    expect(r.offers[0]!.legs[0]).toMatchObject({ fromCode: 'CDG', toCode: 'TLV' });
    expect(r.offers[0]!.legs[0]!.departTime.startsWith('2027-03-17')).toBe(true);
    for (const o of r.offers) {
      expect(o.handoffUrl).toMatch(/^https:\/\//);
      expect(o.returnToken).toBeNull();
    }
  });

  it('return step without a token is a bad query', async () => {
    const p = mockRequest('/flights/return?from=TLV&to=CDG&date=2027-03-10&returnDate=2027-03-17').then(() => null, (e: unknown) => e);
    await jest.advanceTimersByTimeAsync(300);
    expect(await p).toMatchObject({ code: 'BAD_QUERY' });
  });

  it('calendar: one price per day in the range', async () => {
    const r = (await call('/flights/calendar?from=TLV&to=CDG&start=2027-03-01&end=2027-03-31')) as { currency: string; prices: { date: string; price: number }[] };
    expect(r.currency).toBe('USD');
    expect(r.prices).toHaveLength(31);
    expect(r.prices[0]!.date).toBe('2027-03-01');
    expect(r.prices.at(-1)!.date).toBe('2027-03-31');
    expect(r.prices.every((p) => p.price > 0)).toBe(true);
  });

  describe('stays', () => {
    it('searches by destination and returns stays with coordinates and deal links', async () => {
      const r = (await call('/stays/search?q=rome&checkIn=2027-03-10&checkOut=2027-03-14')) as { stays: { id: string; lat: number; lng: number; dealUrl: string }[]; nextPageToken: string | null };
      expect(r.stays).toHaveLength(5);
      expect(r.stays.every((s) => typeof s.lat === 'number' && typeof s.lng === 'number' && s.dealUrl.startsWith('https://'))).toBe(true);
      expect(r.nextPageToken).toBeNull();
    });

    it('returns nothing for the special "zzz" destination', async () => {
      expect(await call('/stays/search?q=zzz&checkIn=2027-03-10&checkOut=2027-03-14')).toMatchObject({ stays: [] });
    });

    it('suggests destinations and hotels', async () => {
      const r = (await call('/stays/suggest?q=rom')) as { suggestions: { text: string; kind: string }[] };
      expect(r.suggestions.length).toBeGreaterThan(0);
      expect(r.suggestions.every((s) => s.text.toLowerCase().includes('rom'))).toBe(true);
    });

    it('returns a property detail with provider offers cheapest first', async () => {
      const d = (await call('/stays/s1?q=Rome&checkIn=2027-03-10&checkOut=2027-03-14')) as { id: string; name: string; offers: { pricePerNight: number; dealUrl: string }[]; amenities: string[] };
      expect(d).toMatchObject({ id: 's1', name: 'Hotel Eden' });
      expect(d.offers.length).toBeGreaterThanOrEqual(3);
      const prices = d.offers.map((o) => o.pricePerNight);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      expect(d.offers.every((o) => o.dealUrl.startsWith('https://'))).toBe(true);
    });

    it('answers NOT_FOUND for an unknown property', async () => {
      const p = mockRequest('/stays/nope?q=Rome&checkIn=2027-03-10&checkOut=2027-03-14').then(() => null, (e: unknown) => e);
      await jest.advanceTimersByTimeAsync(300);
      expect(await p).toMatchObject({ code: 'NOT_FOUND' });
    });

    it('pages reviews: a first page with a token, then a last page without', async () => {
      const first = (await call('/stays/s1/reviews')) as { reviews: unknown[]; nextPageToken: string | null };
      expect(first.reviews).toHaveLength(3);
      expect(first.nextPageToken).toBe('p2');
      const second = (await call('/stays/s1/reviews?pageToken=p2')) as { reviews: unknown[]; nextPageToken: string | null };
      expect(second.reviews.length).toBeGreaterThan(0);
      expect(second.nextPageToken).toBeNull();
    });

    it('returns a price per start day', async () => {
      const r = (await call('/stays/s1/calendar?start=2027-03-01&end=2027-03-31')) as { currency: string; prices: { date: string; pricePerNight: number }[] };
      expect(r.prices).toHaveLength(31);
      expect(r.prices.every((p) => p.pricePerNight > 0)).toBe(true);
    });
  });

  describe('favorites', () => {
    const fav = { id: 's2', name: 'Casa Rossa', thumbnail: null, stars: 4, rating: 4.2, lat: 41.9, lng: 12.5 };

    it('starts empty, adds idempotently, lists newest first and removes', async () => {
      expect(await call('/me/favorites/stays')).toEqual({ favorites: [] });
      await call('/me/favorites/stays/s2', { method: 'PUT', body: fav });
      await call('/me/favorites/stays/s2', { method: 'PUT', body: { ...fav, name: 'Casa Rossa 2' } });
      await call('/me/favorites/stays/s3', { method: 'PUT', body: { ...fav, id: 's3', name: 'Harbour' } });
      const list = (await call('/me/favorites/stays')) as { favorites: { id: string; name: string }[] };
      expect(list.favorites.map((f) => f.id)).toEqual(['s3', 's2']);
      expect(list.favorites[1]!.name).toBe('Casa Rossa 2');
      await call('/me/favorites/stays/s2', { method: 'DELETE' });
      expect(((await call('/me/favorites/stays')) as { favorites: unknown[] }).favorites).toHaveLength(1);
    });

    it('answers NOT_FOUND when removing something that is not a favorite', async () => {
      const p = mockRequest('/me/favorites/stays/nope', { method: 'DELETE' }).then(() => null, (e: unknown) => e);
      await jest.advanceTimersByTimeAsync(300);
      expect(await p).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('saved flight searches', () => {
    const body = { from: 'TLV', to: 'CDG', date: '2027-03-10', adults: 2, cabin: 'business' };

    it('starts empty, saves (idempotently), lists newest first and deletes', async () => {
      expect(await call('/me/saved-searches')).toEqual({ searches: [] });
      const created = (await call('/me/saved-searches', { method: 'POST', body })) as { id: string };
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
      await call('/me/saved-searches', { method: 'POST', body });
      await call('/me/saved-searches', { method: 'POST', body: { ...body, to: 'LHR' } });
      const list = (await call('/me/saved-searches')) as { searches: { id: string; to: string }[] };
      expect(list.searches.map((s) => s.to)).toEqual(['LHR', 'CDG']);
      await call(`/me/saved-searches/${created.id}`, { method: 'DELETE' });
      expect(((await call('/me/saved-searches')) as { searches: unknown[] }).searches).toHaveLength(1);
    });

    it('answers NOT_FOUND when deleting something that is not saved', async () => {
      const p = mockRequest('/me/saved-searches/00000000-0000-4000-8000-000000000999', { method: 'DELETE' }).then(() => null, (e: unknown) => e);
      await jest.advanceTimersByTimeAsync(300);
      expect(await p).toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
