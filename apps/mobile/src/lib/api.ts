import { ApiErrorSchema } from '@wayfinder/shared';
import type { z } from 'zod';
import { config } from '../config/app-config';
import { ApiClientError } from './api-error';
import { auth } from './auth';
import { log } from './logger';
import { mockRequest } from './mock/handlers';

export { ApiClientError } from './api-error';

const send = (path: string, token: string) =>
  fetch(`${config.apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });

const unauthenticated = async (): Promise<never> => {
  await auth.signOut();
  throw new ApiClientError('UNAUTHENTICATED', 'Session expired. Please sign in again.', 401);
};

export const apiFetch = async <S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> => {
  if (config.useMocks) {
    log.debug('mock request', { path });
    const body = await mockRequest(path);
    log.debug('mock response', body);
    return schema.parse(body);
  }

  const session = await auth.getSession();
  if (!session) throw new ApiClientError('UNAUTHENTICATED', 'Not signed in', 401);

  log.debug('request', { path, headers: { Authorization: `Bearer ${session.accessToken}` } });
  let response = await send(path, session.accessToken);

  if (response.status === 401) {
    const refreshed = await auth.refresh();
    if (!refreshed) return unauthenticated();
    response = await send(path, refreshed.accessToken);
    if (response.status === 401) return unauthenticated();
  }

  const body: unknown = await response.json().catch(() => null);
  log.debug('response', { path, status: response.status, body });

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    log.warn('request failed', { path, status: response.status });
    if (parsed.success) throw new ApiClientError(parsed.data.code, parsed.data.message, response.status);
    throw new ApiClientError('PROVIDER_DOWN', 'Unexpected response from the server', response.status);
  }
  log.info('request ok', { path, status: response.status });
  return schema.parse(body);
};
