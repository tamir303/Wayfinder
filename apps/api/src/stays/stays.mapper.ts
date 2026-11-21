import type { Stay, StayCalendarResponse, StayDetail, StayOffer, StayReviewsResponse, StaySuggestResponse } from '@wayfinder/shared';
import { z } from 'zod';
import { AppError } from '../common/app-error';

const PriceSchema = z.object({
  extracted_display_price: z.number().optional(),
  extracted_lowest: z.number().optional(),
});
const RawPropertySchema = z.object({
  type: z.string().optional(),
  name: z.string().min(1),
  link: z.string().optional(),
  property_token: z.string().min(1),
  gps_coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
  rate_per_night: PriceSchema,
  total_rate: PriceSchema.optional(),
  deal: z.string().optional(),
  extracted_hotel_class: z.number().optional(),
  images: z.array(z.object({ thumbnail: z.string().optional() })).optional(),
  overall_rating: z.number().optional(),
  reviews: z.number().optional(),
  amenities: z.array(z.string()).optional(),
});

/** A stay before the per-user handoff link is attached. providerUrl never leaves the API. */
export type MappedStay = Omit<Stay, 'dealUrl'> & { providerUrl: string | null };
export type MappedHotels = { stays: MappedStay[]; nextPageToken: string | null };

// Only the provider's explicit "no results" message is an empty result; any other error must not be cached as one.
const NO_RESULTS = /hasn't returned any results/i;
const down = (message: string) => new AppError('PROVIDER_DOWN', message);
const stripPaid = (a: string) => a.replace(/\s*\(\$+\)\s*$/, '');
const price = (p?: z.infer<typeof PriceSchema>) => p?.extracted_display_price ?? p?.extracted_lowest;
const httpsOrNull = (url?: string) => (url && /^https:\/\//i.test(url) ? url : null);

const toStay = (raw: z.infer<typeof RawPropertySchema>, currency: string): MappedStay | undefined => {
  const nightly = price(raw.rate_per_night);
  if (nightly === undefined || nightly <= 0) return undefined; // nothing to show or sort by
  return {
    id: raw.property_token,
    name: raw.name,
    type: raw.type ?? 'hotel',
    stars: raw.extracted_hotel_class ?? null,
    rating: raw.overall_rating ?? null,
    reviewCount: raw.reviews ?? 0,
    pricePerNight: nightly,
    totalPrice: price(raw.total_rate) ?? null,
    currency,
    lat: raw.gps_coordinates.latitude,
    lng: raw.gps_coordinates.longitude,
    // Google marks paid extras with "($)"; the app shows plain names.
    amenities: (raw.amenities ?? []).map(stripPaid),
    thumbnail: raw.images?.[0]?.thumbnail ?? null,
    deal: raw.deal ?? null,
    providerUrl: httpsOrNull(raw.link),
  };
};

export const mapHotels = (raw: unknown, currency = 'USD'): MappedHotels => {
  if (typeof raw !== 'object' || raw === null) throw down('Unexpected hotels response');
  const body = raw as { error?: unknown; properties?: unknown; serpapi_pagination?: { next_page_token?: unknown } };
  if (typeof body.error === 'string') {
    if (NO_RESULTS.test(body.error)) return { stays: [], nextPageToken: null };
    throw down('Hotel search failed');
  }
  if (!Array.isArray(body.properties)) throw down('Unexpected hotels response');

  const stays: MappedStay[] = [];
  for (const item of body.properties) {
    const parsed = RawPropertySchema.safeParse(item);
    const stay = parsed.success ? toStay(parsed.data, currency) : undefined;
    if (stay) stays.push(stay);
  }
  // Skipping some properties is fine; every property failing means the response shape changed.
  if (body.properties.length > 0 && stays.length === 0) throw down('Unexpected hotels response');

  const next = body.serpapi_pagination?.next_page_token;
  return { stays, nextPageToken: typeof next === 'string' ? next : null };
};

// ---- autocomplete ----

const RawSuggestionSchema = z.object({
  value: z.string().min(1),
  type: z.string().default('place'),
  location: z.string().optional(),
  property_token: z.string().optional(),
});

export const mapSuggestions = (raw: unknown): StaySuggestResponse => {
  if (typeof raw !== 'object' || raw === null) throw down('Unexpected suggestions response');
  const body = raw as { error?: unknown; suggestions?: unknown };
  if (typeof body.error === 'string') {
    if (NO_RESULTS.test(body.error)) return { suggestions: [] };
    throw down('Suggestions failed');
  }
  if (!Array.isArray(body.suggestions)) throw down('Unexpected suggestions response');
  const suggestions: StaySuggestResponse['suggestions'] = [];
  for (const item of body.suggestions) {
    const parsed = RawSuggestionSchema.safeParse(item);
    if (parsed.success) {
      suggestions.push({
        text: parsed.data.value,
        kind: parsed.data.type,
        location: parsed.data.location ?? null,
        propertyToken: parsed.data.property_token ?? null,
      });
    }
  }
  return { suggestions };
};

// ---- property detail ----

const RawDetailSchema = z.object({
  type: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  property_token: z.string().min(1),
  gps_coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
  check_in_time: z.string().optional(),
  check_out_time: z.string().optional(),
  typical_price_range: z.object({ extracted_lowest: z.number(), extracted_highest: z.number() }).optional(),
  deal: z.string().optional(),
  extracted_hotel_class: z.number().optional(),
  images: z.array(z.object({ thumbnail: z.string().optional(), original_image: z.string().optional() })).optional(),
  overall_rating: z.number().optional(),
  reviews: z.number().optional(),
  location_rating: z.number().optional(),
  ratings: z.array(z.object({ stars: z.number(), count: z.number() })).optional(),
  amenities: z.array(z.string()).optional(),
  other_reviews: z
    .array(z.object({ source: z.string(), source_rating: z.object({ score: z.number(), max_score: z.number() }), reviews: z.number() }))
    .optional(),
  nearby_places: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().optional(),
        transportations: z.array(z.object({ type: z.string(), duration: z.string() })).optional(),
      }),
    )
    .optional(),
});
const RawPriceEntrySchema = z.object({
  source: z.string().min(1),
  link: z.string().optional(),
  logo: z.string().optional(),
  official: z.boolean().optional(),
  rate_per_night: PriceSchema,
  total_rate: PriceSchema.optional(),
});

const MAX_IMAGES = 12;
const MAX_NEARBY = 8;

/** An offer before the per-user handoff link is attached. providerUrl never leaves the API. */
export type MappedOffer = Omit<StayOffer, 'dealUrl'> & { providerUrl: string };
export type MappedStayDetail = { detail: Omit<StayDetail, 'offers'>; offers: MappedOffer[] };

const NOT_FOUND = /not found|no results|hasn't returned/i;

export const mapStayDetail = (raw: unknown, currency = 'USD'): MappedStayDetail => {
  if (typeof raw !== 'object' || raw === null) throw down('Unexpected property response');
  const body = raw as { error?: unknown; prices?: unknown };
  if (typeof body.error === 'string') {
    throw NOT_FOUND.test(body.error) ? new AppError('NOT_FOUND', 'Property not found') : down('Property lookup failed');
  }
  const parsed = RawDetailSchema.safeParse(raw);
  if (!parsed.success) throw down('Unexpected property response');
  const d = parsed.data;

  const offers: MappedOffer[] = [];
  for (const item of Array.isArray(body.prices) ? body.prices : []) {
    const p = RawPriceEntrySchema.safeParse(item);
    const providerUrl = p.success ? httpsOrNull(p.data.link) : null;
    const nightly = p.success ? price(p.data.rate_per_night) : undefined;
    if (!p.success || !providerUrl || nightly === undefined || nightly <= 0) continue;
    offers.push({
      provider: p.data.source,
      official: p.data.official ?? false,
      pricePerNight: nightly,
      totalPrice: price(p.data.total_rate) ?? null,
      logo: httpsOrNull(p.data.logo),
      providerUrl,
    });
  }
  offers.sort((a, b) => a.pricePerNight - b.pricePerNight);

  return {
    detail: {
      id: d.property_token,
      name: d.name,
      type: d.type ?? 'hotel',
      description: d.description ?? null,
      address: d.address ?? null,
      phone: d.phone ?? null,
      lat: d.gps_coordinates.latitude,
      lng: d.gps_coordinates.longitude,
      stars: d.extracted_hotel_class ?? null,
      rating: d.overall_rating ?? null,
      reviewCount: d.reviews ?? 0,
      locationRating: d.location_rating ?? null,
      ratingBreakdown: (d.ratings ?? []).map((r) => ({ stars: r.stars, count: r.count })),
      reviewSources: (d.other_reviews ?? []).map((r) => ({ source: r.source, rating: r.source_rating.score, maxRating: r.source_rating.max_score, count: r.reviews })),
      checkInTime: d.check_in_time ?? null,
      checkOutTime: d.check_out_time ?? null,
      amenities: (d.amenities ?? []).map(stripPaid),
      images: (d.images ?? [])
        .map((i) => httpsOrNull(i.original_image) ?? httpsOrNull(i.thumbnail))
        .filter((u): u is string => u !== null)
        .slice(0, MAX_IMAGES),
      nearby: (d.nearby_places ?? [])
        .slice(0, MAX_NEARBY)
        .map((n) => ({ name: n.name, category: n.category ?? null, transport: n.transportations ?? [] })),
      currency,
      typicalPriceRange: d.typical_price_range ? { low: d.typical_price_range.extracted_lowest, high: d.typical_price_range.extracted_highest } : null,
      deal: d.deal ?? null,
    },
    offers,
  };
};

// ---- price calendar ----

const RawCalendarEntrySchema = z.object({
  date: z.string(),
  extracted_display_price: z.number().optional(),
  extracted_lowest: z.number().optional(),
});

export const mapStayCalendar = (raw: unknown, currency = 'USD'): StayCalendarResponse => {
  if (typeof raw !== 'object' || raw === null) throw down('Unexpected calendar response');
  const body = raw as { error?: unknown; prices?: unknown };
  if (typeof body.error === 'string') {
    if (NO_RESULTS.test(body.error)) return { currency, prices: [] };
    throw down('Price calendar failed');
  }
  if (!Array.isArray(body.prices)) throw down('Unexpected calendar response');
  const prices: StayCalendarResponse['prices'] = [];
  for (const item of body.prices) {
    const p = RawCalendarEntrySchema.safeParse(item);
    const nightly = p.success ? (p.data.extracted_display_price ?? p.data.extracted_lowest) : undefined;
    if (p.success && nightly !== undefined && nightly > 0) prices.push({ date: p.data.date, pricePerNight: nightly });
  }
  prices.sort((a, b) => a.date.localeCompare(b.date));
  return { currency, prices };
};

// ---- reviews ----

const RawReviewSchema = z.object({
  user: z.object({ name: z.string().optional() }).optional(),
  source: z.string().default('Google'),
  rating: z.number(),
  best_rating: z.number().positive().optional(),
  date: z.string().optional(),
  snippet: z.string().min(1),
  images: z.array(z.string()).optional(),
  subratings: z.record(z.number()).optional(),
});

const MAX_REVIEW_IMAGES = 3;

export const mapReviews = (raw: unknown): StayReviewsResponse => {
  if (typeof raw !== 'object' || raw === null) throw down('Unexpected reviews response');
  const body = raw as { error?: unknown; reviews?: unknown; serpapi_pagination?: { next_page_token?: unknown } };
  if (typeof body.error === 'string') {
    throw NOT_FOUND.test(body.error) ? new AppError('NOT_FOUND', 'Property not found') : down('Reviews lookup failed');
  }
  if (!Array.isArray(body.reviews)) throw down('Unexpected reviews response');

  const reviews: StayReviewsResponse['reviews'] = [];
  for (const item of body.reviews) {
    const p = RawReviewSchema.safeParse(item);
    if (!p.success) continue;
    const r = p.data;
    reviews.push({
      author: r.user?.name ?? 'Guest', // reviewer profile links and avatars are deliberately not passed on
      source: r.source,
      rating: Math.round(Math.min(5, Math.max(0, (r.rating / (r.best_rating ?? 5)) * 5)) * 10) / 10,
      date: r.date ?? null,
      text: r.snippet,
      subratings: r.subratings ?? null,
      images: (r.images ?? []).filter((u) => /^https:\/\//i.test(u)).slice(0, MAX_REVIEW_IMAGES),
    });
  }
  const next = body.serpapi_pagination?.next_page_token;
  return { reviews, nextPageToken: typeof next === 'string' ? next : null };
};
