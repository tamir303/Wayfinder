import {
  AttractionListResponseSchema,
  FlightSearchResponseSchema,
  StaySearchResponseSchema,
  TripListResponseSchema,
  UsageResponseSchema,
  type FlightSearchQuery,
} from '@wayfinder/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

const FIVE_MIN = 5 * 60_000;
const params = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();

export const useFlightSearch = (q: FlightSearchQuery) =>
  useQuery({
    queryKey: ['flights', q],
    queryFn: () => apiFetch(`/flights/search?${params(q)}`, FlightSearchResponseSchema),
    staleTime: FIVE_MIN,
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
