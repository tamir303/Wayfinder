import { SavedSearchListResponseSchema, SavedSearchSchema, type FlightSearchQuery, type SavedSearch } from '@wayfinder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiSend } from '../../lib/api';

const KEY = ['saved-searches'] as const;

export const useSavedSearches = () =>
  useQuery({ queryKey: KEY, queryFn: () => apiFetch('/me/saved-searches', SavedSearchListResponseSchema), staleTime: 5 * 60_000, retry: false });

export const sameSearch = (s: SavedSearch, q: Pick<FlightSearchQuery, 'from' | 'to' | 'date' | 'adults' | 'cabin'>): boolean =>
  s.from === q.from && s.to === q.to && s.date === q.date && s.adults === q.adults && s.cabin === q.cabin;

export const useSaveSearch = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (q: Pick<FlightSearchQuery, 'from' | 'to' | 'date' | 'adults' | 'cabin'>) => apiFetch('/me/saved-searches', SavedSearchSchema, { method: 'POST', body: q }),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
};

export const useDeleteSavedSearch = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend(`/me/saved-searches/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
};
