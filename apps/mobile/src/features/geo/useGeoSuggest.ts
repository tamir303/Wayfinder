import { GeoSuggestResponseSchema } from '@wayfinder/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useDebouncedValue } from './useDebouncedValue';

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const normalizeQuery = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();

export const useGeoSuggest = (text: string) => {
  const q = useDebouncedValue(normalizeQuery(text), DEBOUNCE_MS);

  return useQuery({
    queryKey: ['geo', 'suggest', q],
    queryFn: () =>
      apiFetch(`/geo/suggest?${new URLSearchParams({ q, kind: 'airport' }).toString()}`, GeoSuggestResponseSchema),
    enabled: q.length >= MIN_LENGTH,
    staleTime: ONE_DAY_MS,
    retry: false,
  });
};
