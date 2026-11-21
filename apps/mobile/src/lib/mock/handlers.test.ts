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
});
