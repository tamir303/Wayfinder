import type { FavoriteStay, FavoriteStayInput, StayDetail, StaySuggestion } from '@wayfinder/shared';
import { ApiClientError } from '../api-error';
import { STAYS } from './data';

const SUGGESTIONS: StaySuggestion[] = [
  { text: 'Rome', kind: 'destination', location: 'Italy', propertyToken: null },
  { text: 'Rome hotels', kind: 'destination', location: 'Italy', propertyToken: null },
  { text: 'Roma Termini area', kind: 'destination', location: 'Rome, Italy', propertyToken: null },
  { text: 'Hotel Eden', kind: 'accommodation', location: 'Rome, Italy', propertyToken: 's1' },
  { text: 'Paris', kind: 'destination', location: 'France', propertyToken: null },
  { text: 'Athens', kind: 'destination', location: 'Greece', propertyToken: null },
  { text: 'London', kind: 'destination', location: 'United Kingdom', propertyToken: null },
];

export const suggestStays = (q: string): { suggestions: StaySuggestion[] } => ({
  suggestions: SUGGESTIONS.filter((s) => s.text.toLowerCase().includes(q.toLowerCase())),
});

export const buildStayDetail = (id: string): StayDetail => {
  const stay = STAYS.find((s) => s.id === id);
  if (!stay) throw new ApiClientError('NOT_FOUND', 'Property not found', 404);
  const nightly = stay.pricePerNight;
  const offer = (provider: string, official: boolean, factor: number, slug: string) => ({
    provider,
    official,
    pricePerNight: Math.round(nightly * factor),
    totalPrice: Math.round(nightly * factor * 4),
    logo: null,
    dealUrl: `https://example.com/mock-stay?id=${id}&via=${slug}`,
  });
  return {
    id,
    name: stay.name,
    type: stay.type,
    description: `${stay.name} is a well-reviewed stay close to the sights, with comfortable rooms and helpful staff.`,
    address: 'Via Roma 1, Rome, Italy',
    phone: '+39 06 1234 5678',
    lat: stay.lat,
    lng: stay.lng,
    stars: stay.stars,
    rating: stay.rating,
    reviewCount: stay.reviewCount,
    locationRating: 4.6,
    ratingBreakdown: [
      { stars: 5, count: 620 },
      { stars: 4, count: 210 },
      { stars: 3, count: 60 },
      { stars: 2, count: 20 },
      { stars: 1, count: 10 },
    ],
    reviewSources: [{ source: 'Tripadvisor', rating: 4.4, maxRating: 5, count: 852 }],
    checkInTime: '3:00 PM',
    checkOutTime: '11:00 AM',
    amenities: stay.amenities,
    images: [],
    nearby: [
      { name: 'Colosseum', category: 'Point of interest', transport: [{ type: 'Walking', duration: '12 min' }, { type: 'Taxi', duration: '5 min' }] },
      { name: 'Termini Station', category: 'Train station', transport: [{ type: 'Public transport', duration: '9 min' }] },
    ],
    currency: stay.currency,
    typicalPriceRange: { low: nightly - 40, high: nightly + 60 },
    deal: null,
    offers: [offer('Booking.com', false, 0.97, 'booking'), offer(`${stay.name} (official)`, true, 1.04, 'official'), offer('Expedia.com', false, 1.0, 'expedia')].sort(
      (a, b) => a.pricePerNight - b.pricePerNight,
    ),
  };
};

const REVIEW_PAGES: Record<string, { reviews: object[]; nextPageToken: string | null }> = {
  '': {
    reviews: [
      { author: 'Dana', source: 'Google', rating: 5, date: 'a week ago', text: 'Great location, steps from the metro. Spotless rooms.', subratings: { rooms: 5, service: 5, location: 5 }, images: [] },
      { author: 'Yossi', source: 'Google', rating: 4, date: '2 weeks ago', text: 'Comfortable and quiet. Breakfast could be better.', subratings: null, images: [] },
      { author: 'Maria', source: 'Tripadvisor', rating: 4.5, date: 'a month ago', text: 'Friendly staff and a lovely terrace.', subratings: null, images: [] },
    ],
    nextPageToken: 'p2',
  },
  p2: {
    reviews: [
      { author: 'Lior', source: 'Google', rating: 3, date: '2 months ago', text: 'Decent value, a little noisy on weekends.', subratings: null, images: [] },
      { author: 'Sam', source: 'Google', rating: 5, date: '3 months ago', text: 'Would stay again.', subratings: null, images: [] },
    ],
    nextPageToken: null,
  },
};
export const stayReviews = (pageToken: string): { reviews: object[]; nextPageToken: string | null } => REVIEW_PAGES[pageToken] ?? { reviews: [], nextPageToken: null };

export const stayCalendar = (id: string, start: string, end: string) => {
  const base = buildStayDetail(id).offers[0]!.pricePerNight;
  const prices: { date: string; pricePerNight: number }[] = [];
  const last = new Date(`${end}T00:00:00Z`).getTime();
  for (let t = new Date(`${start}T00:00:00Z`).getTime(), n = 0; t <= last && n < 62; t += 86_400_000, n++) {
    prices.push({ date: new Date(t).toISOString().slice(0, 10), pricePerNight: Math.round(base * (0.85 + ((n * 7 + 3) % 10) / 20)) });
  }
  return { currency: buildStayDetail(id).currency, prices };
};

// ---- favorites (in memory; resets on reload, like the rest of the dev mock) ----
let favorites: FavoriteStay[] = [];
let clock = 0;

export const resetFavorites = (): void => {
  favorites = [];
  clock = 0;
};
export const listFavorites = (): { favorites: FavoriteStay[] } => ({ favorites: [...favorites].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });

export const putFavorite = (id: string, input: FavoriteStayInput): FavoriteStay => {
  if (input.id !== id) throw new ApiClientError('BAD_QUERY', 'Path id and body id must match', 400);
  const existing = favorites.find((f) => f.id === id);
  const row: FavoriteStay = { ...input, createdAt: existing?.createdAt ?? new Date(Date.UTC(2027, 0, 1) + ++clock * 1000).toISOString() };
  favorites = existing ? favorites.map((f) => (f.id === id ? row : f)) : [...favorites, row];
  return row;
};

export const removeFavorite = (id: string): void => {
  if (!favorites.some((f) => f.id === id)) throw new ApiClientError('NOT_FOUND', 'Favorite not found', 404);
  favorites = favorites.filter((f) => f.id !== id);
};
