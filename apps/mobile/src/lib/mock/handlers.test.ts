import { mockRequest } from './handlers';

describe('mockRequest (dev, no network)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const call = async (path: string) => {
    const p = mockRequest(path);
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
});
