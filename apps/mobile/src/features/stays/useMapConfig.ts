import { MapConfigResponseSchema } from '@wayfinder/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export const useMapConfig = () =>
  useQuery({ queryKey: ['maps', 'config'], queryFn: () => apiFetch('/maps/config', MapConfigResponseSchema), staleTime: 60 * 60_000, retry: false });
