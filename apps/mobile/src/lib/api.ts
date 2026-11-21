import { ApiErrorSchema } from '@wayfinder/shared';
import type { z } from 'zod';
import { config } from '../config/app-config';
import { ApiClientError } from './api-error';
import { auth } from './auth';
import { log } from './logger';
import { mockRequest } from './mock/handlers';

export { ApiClientError } from './api-error';

export type ApiInit = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown };

const send = (path: string, token: string, init?: ApiInit) =>
  fetch(`${config.apiUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

const unauthenticated = async (): Promise<never> => {
  await auth.signOut();
  throw new ApiClientError('UNAUTHENTICATED', 'Session expired. Please sign in again.', 401);
};

// One authenticated request: refreshes the session once on 401, then signs out. Throws ApiClientError on failure.
const request = async (path: string, init?: ApiInit): Promise<unknown> => {
  const session = await auth.getSession();
  if (!session) throw new ApiClientError('UNAUTHENTICATED', 'Not signed in', 401);

  log.debug('request', { path, method: init?.method ?? 'GET', headers: { Authorization: `Bearer ${session.accessToken}` } });
  let response = await send(path, session.accessToken, init);

  if (response.status === 401) {
    const refreshed = await auth.refresh();
    if (!refreshed) return unauthenticated();
    response = await send(path, refreshed.accessToken, init);
    if (response.status === 401) return unauthenticated();
  }

  const body: unknown = await response.json().catch(() => null); // 204 has no body
  log.debug('response', { path, status: response.status, body });

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    log.warn('request failed', { path, status: response.status });
    if (parsed.success) throw new ApiClientError(parsed.data.code, parsed.data.message, response.status);
    throw new ApiClientError('PROVIDER_DOWN', 'Unexpected response from the server', response.status);
  }
  log.info('request ok', { path, status: response.status });
  return body;
};

export const apiFetch = async <S extends z.ZodTypeAny>(path: string, schema: S, init?: ApiInit): Promise<z.infer<S>> => {
  if (config.useMocks) {
    log.debug('mock request', { path, method: init?.method ?? 'GET' });
    const body = await mockRequest(path, init);
    log.debug('mock response', body);
    return schema.parse(body);
  }
  return schema.parse(await request(path, init));
};

/** For calls whose response has no body (204), such as removing a favorite. */
export const apiSend = async (path: string, init: ApiInit): Promise<void> => {
  if (config.useMocks) {
    await mockRequest(path, init);
    return;
  }
  await request(path, init);
};
