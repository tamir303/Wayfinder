import { ApiClientError } from '../api-error';
import { AIRPORTS, ATTRACTIONS, buildCalendar, buildFlights, buildOutbound, buildReturn, STAYS, TRIPS } from './data';

const LATENCY_MS = 250;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// dev only. Special queries make error states easy to see: q=limit (rate limited), q=down (provider down), q=zzz (empty).
export const mockRequest = async (path: string): Promise<unknown> => {
  await sleep(LATENCY_MS);
  const url = new URL(path, 'http://mock.local');
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  switch (url.pathname) {
    case '/geo/suggest': {
      if (q === 'limit') throw new ApiClientError('RATE_LIMITED', 'Daily search limit reached', 429);
      if (q === 'down') throw new ApiClientError('PROVIDER_DOWN', 'Provider request failed', 502);
      return {
        suggestions: AIRPORTS.filter((a) => [a.code, a.name, a.city].some((f) => f.toLowerCase().includes(q))),
      };
    }
    case '/flights/search': {
      const p = url.searchParams;
      const [from, to, date] = [p.get('from') ?? '', p.get('to') ?? '', p.get('date') ?? ''];
      if (from === to) return { offers: [], insights: null };
      const adults = Number(p.get('adults') ?? 1);
      const offers = p.get('returnDate') ? buildOutbound(from, to, date, adults) : buildFlights(from, to, date, adults);
      return { offers, insights: { lowestPrice: 163, level: 'low' } };
    }
    case '/flights/return': {
      const p = url.searchParams;
      if (!p.get('token')) throw new ApiClientError('BAD_QUERY', 'Missing token', 400);
      return {
        offers: buildReturn(p.get('from') ?? '', p.get('to') ?? '', p.get('returnDate') ?? '', Number(p.get('adults') ?? 1)),
        insights: null,
      };
    }
    case '/flights/calendar': {
      const p = url.searchParams;
      return { currency: 'USD', prices: buildCalendar(p.get('start') ?? '', p.get('end') ?? '') };
    }
    case '/stays/search':
      return { stays: STAYS };
    case '/attractions':
      return { attractions: ATTRACTIONS };
    case '/trips':
      return { trips: TRIPS };
    case '/me/usage':
      return { used: 12, cap: 200 };
    default:
      throw new ApiClientError('BAD_QUERY', `No mock for ${url.pathname}`, 404);
  }
};
