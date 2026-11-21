import type { Stay } from '@wayfinder/shared';
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
    amenities: (raw.amenities ?? []).map((a) => a.replace(/\s*\(\$+\)\s*$/, '')),
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
