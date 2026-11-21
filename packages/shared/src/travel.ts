import { z } from 'zod';

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const today = () => new Date().toISOString().slice(0, 10);
const futureDate = (d: string) => !Number.isNaN(Date.parse(d)) && d >= today();

export const FlightSearchQueryBase = z.object({
  from: z.string().regex(/^[A-Z]{3}$/),
  to: z.string().regex(/^[A-Z]{3}$/),
  date: IsoDate.refine(futureDate, 'date must be today or later'),
  /** Present for a round trip; the search then returns outbound options. */
  returnDate: IsoDate.optional(),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z.enum(['economy', 'premium', 'business', 'first']).default('economy'),
});
const returnAfter = (v: { date: string; returnDate?: string | undefined }) => v.returnDate === undefined || v.returnDate > v.date;

export const FlightSearchQuerySchema = FlightSearchQueryBase.refine(returnAfter, {
  message: 'returnDate must be after date',
  path: ['returnDate'],
});
export type FlightSearchQuery = z.infer<typeof FlightSearchQuerySchema>;

/** Second step of a round trip: pick the return flight for a chosen outbound (its returnToken). */
export const FlightReturnQuerySchema = FlightSearchQueryBase.extend({
  returnDate: IsoDate,
  token: z.string().min(1).max(4000),
}).refine(returnAfter, { message: 'returnDate must be after date', path: ['returnDate'] });
export type FlightReturnQuery = z.infer<typeof FlightReturnQuerySchema>;

export const FlightCalendarQuerySchema = z
  .object({
    from: z.string().regex(/^[A-Z]{3}$/),
    to: z.string().regex(/^[A-Z]{3}$/),
    start: IsoDate.refine(futureDate, 'start must be today or later'),
    end: IsoDate,
  })
  .refine((v) => v.end >= v.start, { message: 'end must not be before start', path: ['end'] })
  .refine((v) => (Date.parse(v.end) - Date.parse(v.start)) / 86_400_000 <= 61, { message: 'range is limited to about two months', path: ['end'] });
export type FlightCalendarQuery = z.infer<typeof FlightCalendarQuerySchema>;

export const FlightCalendarResponseSchema = z.object({
  currency: z.string(),
  /** One-way price per departure day; days without a price are left out. */
  prices: z.array(z.object({ date: z.string(), price: z.number() })),
});
export type FlightCalendarResponse = z.infer<typeof FlightCalendarResponseSchema>;

export const FlightLegSchema = z.object({
  fromCode: z.string(),
  toCode: z.string(),
  departTime: z.string(),
  arriveTime: z.string(),
  airline: z.string(),
  flightNumber: z.string(),
  durationMin: z.number(),
});

export const FlightLayoverSchema = z.object({ code: z.string(), name: z.string(), durationMin: z.number() });

export const FlightEmissionsSchema = z.object({
  grams: z.number(),
  typicalGrams: z.number(),
  diffPercent: z.number(),
});

export const FlightOfferSchema = z.object({
  id: z.string(),
  group: z.enum(['best', 'other']),
  price: z.number(),
  currency: z.string(),
  airline: z.string(),
  totalDurationMin: z.number(),
  stops: z.number(),
  legs: z.array(FlightLegSchema),
  layovers: z.array(FlightLayoverSchema).default([]),
  emissions: FlightEmissionsSchema.nullable().default(null),
  /** Opaque token for step two of a round trip (the return flight). Null once the offer is bookable. */
  returnToken: z.string().nullable().default(null),
  /** Signed link to the provider booking page. Null for round-trip outbound options: choose a return flight first. */
  handoffUrl: z.string().nullable(),
});
export type FlightOffer = z.infer<typeof FlightOfferSchema>;

export const FlightSearchResponseSchema = z.object({
  offers: z.array(FlightOfferSchema),
  insights: z.object({ lowestPrice: z.number(), level: z.enum(['low', 'typical', 'high']) }).nullable(),
});
export type FlightSearchResponse = z.infer<typeof FlightSearchResponseSchema>;

export const StaySearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(80),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.coerce.number().int().min(1).max(9).default(2),
    pageToken: z.string().max(200).optional(),
  })
  .refine((v) => !Number.isNaN(Date.parse(v.checkIn)) && v.checkIn >= new Date().toISOString().slice(0, 10), {
    message: 'checkIn must be today or later',
    path: ['checkIn'],
  })
  .refine((v) => v.checkOut > v.checkIn, { message: 'checkOut must be after checkIn', path: ['checkOut'] })
  .refine((v) => (Date.parse(v.checkOut) - Date.parse(v.checkIn)) / 86_400_000 <= 30, {
    message: 'stays are limited to 30 nights',
    path: ['checkOut'],
  });
export type StaySearchQuery = z.infer<typeof StaySearchQuerySchema>;

export const StaySchema = z.object({
  /** Provider property token; stable per property. */
  id: z.string(),
  name: z.string(),
  type: z.string().default('hotel'),
  stars: z.number().nullable().default(null),
  /** 0-5 guest rating. */
  rating: z.number().nullable().default(null),
  reviewCount: z.number().default(0),
  /** Optional human label such as "Excellent"; the real API leaves wording to the client. */
  ratingLabel: z.string().optional(),
  distance: z.string().optional(),
  pricePerNight: z.number(),
  /** Total for the whole stay, when the provider gives one. */
  totalPrice: z.number().nullable().default(null),
  currency: z.string(),
  lat: z.number(),
  lng: z.number(),
  /** 0-100 position for the placeholder map, until a real map is wired in. */
  mapX: z.number().optional(),
  mapY: z.number().optional(),
  amenities: z.array(z.string()),
  thumbnail: z.string().nullable().default(null),
  deal: z.string().nullable().default(null),
  /** Signed handoff link (logs the click, then redirects to the provider). */
  dealUrl: z.string(),
});
export type Stay = z.infer<typeof StaySchema>;
export const StaySearchResponseSchema = z.object({
  stays: z.array(StaySchema),
  nextPageToken: z.string().nullable().default(null),
});
export type StaySearchResponse = z.infer<typeof StaySearchResponseSchema>;

export const AttractionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  rating: z.number(),
  reviews: z.string(),
  blurb: z.string(),
  hours: z.string(),
});
export type Attraction = z.infer<typeof AttractionSchema>;
export const AttractionListResponseSchema = z.object({ attractions: z.array(AttractionSchema) });
export type AttractionListResponse = z.infer<typeof AttractionListResponseSchema>;

export const TripStopSchema = z.object({ time: z.string(), title: z.string(), meta: z.string() });
export const TripDaySchema = z.object({ label: z.string(), stops: z.array(TripStopSchema) });
export const TripSchema = z.object({
  id: z.string(),
  name: z.string(),
  dates: z.string(),
  itemCount: z.number(),
  days: z.array(TripDaySchema),
});
export type Trip = z.infer<typeof TripSchema>;
export const TripListResponseSchema = z.object({ trips: z.array(TripSchema) });
export type TripListResponse = z.infer<typeof TripListResponseSchema>;

export const UsageResponseSchema = z.object({ used: z.number(), cap: z.number() });
export type UsageResponse = z.infer<typeof UsageResponseSchema>;

export const SavedSearchSchema = FlightSearchQueryBase.omit({ returnDate: true }).extend({
  id: z.string().uuid(),
  createdAt: z.string(),
});
export type SavedSearch = z.infer<typeof SavedSearchSchema>;
export const SavedSearchListResponseSchema = z.object({ searches: z.array(SavedSearchSchema) });
export type SavedSearchListResponse = z.infer<typeof SavedSearchListResponseSchema>;

export const StaySuggestQuerySchema = z.object({ q: z.string().trim().min(2).max(80) });
export type StaySuggestQuery = z.infer<typeof StaySuggestQuerySchema>;

export const StaySuggestionSchema = z.object({
  /** Text to put in the search box and send as q. */
  text: z.string(),
  /** 'accommodation' for a specific property; other values are places and regions. */
  kind: z.string(),
  location: z.string().nullable().default(null),
  propertyToken: z.string().nullable().default(null),
});
export type StaySuggestion = z.infer<typeof StaySuggestionSchema>;
export const StaySuggestResponseSchema = z.object({ suggestions: z.array(StaySuggestionSchema) });
export type StaySuggestResponse = z.infer<typeof StaySuggestResponseSchema>;

/** Property detail uses the same trip parameters as a search (dates drive the prices). */
export const StayDetailQuerySchema = StaySearchQuerySchema;
export type StayDetailQuery = z.infer<typeof StayDetailQuerySchema>;

export const StayOfferSchema = z.object({
  provider: z.string(),
  official: z.boolean(),
  pricePerNight: z.number(),
  totalPrice: z.number().nullable().default(null),
  logo: z.string().nullable().default(null),
  /** Signed handoff link (logs the click, then redirects to this provider). */
  dealUrl: z.string(),
});

export const StayDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  lat: z.number(),
  lng: z.number(),
  stars: z.number().nullable().default(null),
  rating: z.number().nullable().default(null),
  reviewCount: z.number().default(0),
  locationRating: z.number().nullable().default(null),
  /** Guests per star level (5 to 1). */
  ratingBreakdown: z.array(z.object({ stars: z.number(), count: z.number() })).default([]),
  /** Ratings from other sites, e.g. Tripadvisor. */
  reviewSources: z.array(z.object({ source: z.string(), rating: z.number(), maxRating: z.number(), count: z.number() })).default([]),
  checkInTime: z.string().nullable().default(null),
  checkOutTime: z.string().nullable().default(null),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  nearby: z
    .array(z.object({ name: z.string(), category: z.string().nullable().default(null), transport: z.array(z.object({ type: z.string(), duration: z.string() })).default([]) }))
    .default([]),
  currency: z.string(),
  /** Usual nightly price range for this property and dates, when known. */
  typicalPriceRange: z.object({ low: z.number(), high: z.number() }).nullable().default(null),
  deal: z.string().nullable().default(null),
  /** Prices by provider, cheapest first. */
  offers: z.array(StayOfferSchema),
});
export type StayDetail = z.infer<typeof StayDetailSchema>;
export type StayOffer = z.infer<typeof StayOfferSchema>;

export const FavoriteStayInputSchema = z.object({
  /** The stay's id (provider property token). */
  id: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  thumbnail: z.string().url().max(2000).nullable().default(null),
  stars: z.number().min(0).max(5).nullable().default(null),
  rating: z.number().min(0).max(5).nullable().default(null),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type FavoriteStayInput = z.infer<typeof FavoriteStayInputSchema>;
export const FavoriteStaySchema = FavoriteStayInputSchema.extend({ createdAt: z.string() });
export type FavoriteStay = z.infer<typeof FavoriteStaySchema>;
export const FavoriteStayListResponseSchema = z.object({ favorites: z.array(FavoriteStaySchema) });
export type FavoriteStayListResponse = z.infer<typeof FavoriteStayListResponseSchema>;

export const MapConfigResponseSchema = z.object({
  /** MapLibre style URL (tiles), or null when no tile provider is configured yet. */
  styleUrl: z.string().url().nullable(),
});
export type MapConfigResponse = z.infer<typeof MapConfigResponseSchema>;
