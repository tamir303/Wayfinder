import { z } from 'zod';

export const FlightSearchQuerySchema = z.object({
  from: z.string().regex(/^[A-Z]{3}$/),
  to: z.string().regex(/^[A-Z]{3}$/),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => !Number.isNaN(Date.parse(d)) && d >= new Date().toISOString().slice(0, 10), 'date must be today or later'),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z.enum(['economy', 'premium', 'business', 'first']).default('economy'),
});
export type FlightSearchQuery = z.infer<typeof FlightSearchQuerySchema>;

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
  handoffUrl: z.string(),
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

export const SavedSearchSchema = FlightSearchQuerySchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
});
export type SavedSearch = z.infer<typeof SavedSearchSchema>;
export const SavedSearchListResponseSchema = z.object({ searches: z.array(SavedSearchSchema) });
export type SavedSearchListResponse = z.infer<typeof SavedSearchListResponseSchema>;
