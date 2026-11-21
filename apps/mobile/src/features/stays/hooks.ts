import {
  FavoriteStayListResponseSchema,
  FavoriteStaySchema,
  StayCalendarResponseSchema,
  StayDetailSchema,
  StayReviewsResponseSchema,
  StaySearchResponseSchema,
  StaySuggestResponseSchema,
  type FavoriteStayInput,
  type StaySearchQuery,
} from '@wayfinder/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '../../lib/api';
import { useDebouncedValue } from '../geo/useDebouncedValue';

const FIVE_MIN = 5 * 60_000;
const qs = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(o).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)] as [string, string]]))).toString();
const enc = encodeURIComponent;

export type StayTrip = Pick<StaySearchQuery, 'q' | 'checkIn' | 'checkOut' | 'adults'>;

export const useStaySuggest = (text: string) => {
  const q = useDebouncedValue(text.trim().toLowerCase(), 300);
  return useQuery({
    queryKey: ['stays', 'suggest', q],
    queryFn: () => apiFetch(`/stays/suggest?${qs({ q })}`, StaySuggestResponseSchema),
    enabled: q.length >= 2,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
};

/** Runs once a search has been submitted (trip is null before that). */
export const useStaySearch = (trip: StayTrip | null) =>
  useQuery({
    queryKey: ['stays', 'search', trip],
    queryFn: () => apiFetch(`/stays/search?${qs({ ...trip! })}`, StaySearchResponseSchema),
    enabled: trip !== null,
    staleTime: FIVE_MIN,
    retry: false,
  });

export const useStayDetail = (id: string, trip: StayTrip) =>
  useQuery({
    queryKey: ['stays', 'detail', id, trip],
    queryFn: () => apiFetch(`/stays/${enc(id)}?${qs(trip)}`, StayDetailSchema),
    staleTime: FIVE_MIN,
    retry: false,
  });

export const useStayReviews = (id: string) =>
  useInfiniteQuery({
    queryKey: ['stays', 'reviews', id],
    initialPageParam: '',
    queryFn: ({ pageParam }) => apiFetch(`/stays/${enc(id)}/reviews${pageParam ? `?${qs({ pageToken: pageParam })}` : ''}`, StayReviewsResponseSchema),
    getNextPageParam: (last) => last.nextPageToken ?? undefined,
    staleTime: 60 * 60_000,
    retry: false,
  });

export const useStayCalendar = (id: string, q: { start: string; end: string; adults: number }) =>
  useQuery({
    queryKey: ['stays', 'calendar', id, q],
    queryFn: () => apiFetch(`/stays/${enc(id)}/calendar?${qs(q)}`, StayCalendarResponseSchema),
    staleTime: 60 * 60_000,
    retry: false,
  });

const FAVORITES_KEY = ['favorites', 'stays'] as const;

export const useFavorites = () =>
  useQuery({ queryKey: FAVORITES_KEY, queryFn: () => apiFetch('/me/favorites/stays', FavoriteStayListResponseSchema), staleTime: FIVE_MIN, retry: false });

/** Add or remove a favorite, then refresh the list. */
export const useToggleFavorite = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ stay, on }: { stay: FavoriteStayInput; on: boolean }) => {
      const path = `/me/favorites/stays/${enc(stay.id)}`;
      if (on) await apiFetch(path, FavoriteStaySchema, { method: 'PUT', body: stay });
      else await apiSend(path, { method: 'DELETE' });
    },
    onSettled: () => client.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });
};
