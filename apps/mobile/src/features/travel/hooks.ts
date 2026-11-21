import {
  AttractionListResponseSchema,
  FlightCalendarResponseSchema,
  FlightSearchResponseSchema,
  StaySearchResponseSchema,
  TripListResponseSchema,
  UsageResponseSchema,
  type FlightCalendarQuery,
  type FlightSearchQuery,
} from '@wayfinder/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

const FIVE_MIN = 5 * 60_000;
// Undefined values (like an absent returnDate) are left out of the query string.
const params = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(o).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)] as [string, string]]))).toString();

/**
 * One-way: bookable offers. Round trip without a token: outbound options. Round trip with a token
 * (the chosen outbound's returnToken): the return flights, priced as the whole trip.
 */
export const useFlightOffers = (q: FlightSearchQuery & { token?: string }) =>
  useQuery({
    queryKey: ['flights', q],
    queryFn: () => apiFetch(`${q.token ? '/flights/return' : '/flights/search'}?${params(q)}`, FlightSearchResponseSchema),
    staleTime: FIVE_MIN,
    retry: false,
  });

export const useFlightCalendar = (q: FlightCalendarQuery) =>
  useQuery({
    queryKey: ['flight-calendar', q],
    queryFn: () => apiFetch(`/flights/calendar?${params(q)}`, FlightCalendarResponseSchema),
    staleTime: 60 * 60_000,
    retry: false,
  });

export const useStays = () =>
  useQuery({ queryKey: ['stays'], queryFn: () => apiFetch('/stays/search', StaySearchResponseSchema), staleTime: FIVE_MIN, retry: false });

export const useAttractions = () =>
  useQuery({ queryKey: ['attractions'], queryFn: () => apiFetch('/attractions', AttractionListResponseSchema), staleTime: FIVE_MIN, retry: false });

export const useTrips = () =>
  useQuery({ queryKey: ['trips'], queryFn: () => apiFetch('/trips', TripListResponseSchema), staleTime: FIVE_MIN, retry: false });

export const useUsage = () =>
  useQuery({ queryKey: ['usage'], queryFn: () => apiFetch('/me/usage', UsageResponseSchema), retry: false });
