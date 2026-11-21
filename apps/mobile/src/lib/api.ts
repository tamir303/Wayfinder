import { ApiErrorSchema, type ErrorCode } from '@wayfinder/shared';
import type { z } from 'zod';
import { supabase } from './supabase';

export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const apiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) throw new Error('EXPO_PUBLIC_API_URL is required');
  return url;
};

const send = (path: string, token: string) =>
  fetch(`${apiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

const unauthenticated = async (): Promise<never> => {
  await supabase.auth.signOut();
  throw new ApiClientError('UNAUTHENTICATED', 'Session expired. Please sign in again.', 401);
};

export const apiFetch = async <S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiClientError('UNAUTHENTICATED', 'Not signed in', 401);

  let response = await send(path, data.session.access_token);

  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) return unauthenticated();
    response = await send(path, refreshed.data.session.access_token);
    if (response.status === 401) return unauthenticated();
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) throw new ApiClientError(parsed.data.code, parsed.data.message, response.status);
    throw new ApiClientError('PROVIDER_DOWN', 'Unexpected response from the server', response.status);
  }

  return schema.parse(body);
};
