import type { ApiInit } from '../api';
import { ApiClientError } from '../api-error';
import { createSaved, listSaved, removeSaved, resetSaved } from './saved';
import { buildStayDetail, listFavorites, putFavorite, removeFavorite, resetFavorites, stayCalendar, stayReviews, suggestStays } from './stays';
import { AIRPORTS, ATTRACTIONS, buildCalendar, buildFlights, buildOutbound, buildReturn, STAYS } from './data';

const LATENCY_MS = 250;

// 30 days of prices ending today, drifting around the typical range.
const MOCK_INSIGHTS = () => ({
  lowestPrice: 163,
  level: 'low' as const,
  typicalRange: { low: 180, high: 260 },
  history: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
    price: 170 + ((i * 17 + 5) % 70),
  })),
});
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// dev only. Special queries make error states easy to see: q=limit (rate limited), q=down (provider down), q=zzz (empty).
export const resetMockState = (): void => {
  resetFavorites();
  resetSaved();
};

export const mockRequest = async (path: string, init?: ApiInit): Promise<unknown> => {
  await sleep(LATENCY_MS);
  const url = new URL(path, 'http://mock.local');
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  // Stays and favorites use path parameters, so match them before the fixed routes.
  const stayMatch = /^\/stays\/([^/]+)(?:\/(calendar|reviews))?$/.exec(url.pathname);
  if (stayMatch && !['search', 'suggest', 'handoff'].includes(stayMatch[1]!)) {
    const id = decodeURIComponent(stayMatch[1]!);
    if (stayMatch[2] === 'reviews') return stayReviews(url.searchParams.get('pageToken') ?? '');
    if (stayMatch[2] === 'calendar') return stayCalendar(id, url.searchParams.get('start') ?? '', url.searchParams.get('end') ?? '');
    return buildStayDetail(id);
  }
  const savedMatch = /^\/me\/saved-searches\/([^/]+)$/.exec(url.pathname);
  if (savedMatch && init?.method === 'DELETE') return removeSaved(decodeURIComponent(savedMatch[1]!));
  const favMatch = /^\/me\/favorites\/stays\/([^/]+)$/.exec(url.pathname);
  if (favMatch) {
    const id = decodeURIComponent(favMatch[1]!);
    if (init?.method === 'PUT') return putFavorite(id, init.body as never);
    if (init?.method === 'DELETE') return removeFavorite(id);
  }

  switch (url.pathname) {
    case '/maps/config':
      // Dev can try the real map by setting EXPO_PUBLIC_MAP_STYLE_URL; otherwise the placeholder is used.
      return { styleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL || null };
    case '/stays/suggest':
      return suggestStays(q);
    case '/me/favorites/stays':
      return listFavorites();
    case '/me/saved-searches':
      return init?.method === 'POST' ? createSaved(init.body as never) : listSaved();
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
      if (from === to) return { offers: [], insights: null, asOf: new Date().toISOString() };
      const adults = Number(p.get('adults') ?? 1);
      const offers = p.get('returnDate') ? buildOutbound(from, to, date, adults) : buildFlights(from, to, date, adults);
      return { offers, insights: MOCK_INSIGHTS(), asOf: new Date().toISOString() };
    }
    case '/flights/return': {
      const p = url.searchParams;
      if (!p.get('token')) throw new ApiClientError('BAD_QUERY', 'Missing token', 400);
      return {
        offers: buildReturn(p.get('from') ?? '', p.get('to') ?? '', p.get('returnDate') ?? '', Number(p.get('adults') ?? 1)),
        insights: null,
        asOf: new Date().toISOString(),
      };
    }
    case '/flights/calendar': {
      const p = url.searchParams;
      return { currency: 'USD', prices: buildCalendar(p.get('start') ?? '', p.get('end') ?? '') };
    }
    case '/stays/search':
      return { stays: q === 'zzz' ? [] : STAYS, nextPageToken: null };
    case '/attractions':
      return { attractions: ATTRACTIONS };
    case '/me/usage':
      return { used: 12, cap: 200 };
    default:
      throw new ApiClientError('BAD_QUERY', `No mock for ${url.pathname}`, 404);
  }
};
