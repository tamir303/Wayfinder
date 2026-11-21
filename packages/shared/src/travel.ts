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

export const StaySchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number(),
  ratingLabel: z.string(),
  distance: z.string(),
  pricePerNight: z.number(),
  currency: z.string(),
  // 0-100 position on the map placeholder until a real map is wired in.
  mapX: z.number(),
  mapY: z.number(),
  amenities: z.array(z.string()),
  dealUrl: z.string(),
});
export type Stay = z.infer<typeof StaySchema>;
export const StaySearchResponseSchema = z.object({ stays: z.array(StaySchema) });
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
