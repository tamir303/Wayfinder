import { z } from 'zod';
import { ApiClientError, apiFetch, apiSend } from './api';

const mockGetSession = jest.fn();
const mockRefresh = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../config/app-config', () => ({ config: { useMocks: false, apiUrl: 'http://api.test', logLevel: 'debug', redact: false } }));
jest.mock('./logger', () => ({ log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('./auth', () => ({
  auth: {
    getSession: (...a: unknown[]) => mockGetSession(...a),
    refresh: (...a: unknown[]) => mockRefresh(...a),
    signOut: (...a: unknown[]) => mockSignOut(...a),
  },
}));

const Schema = z.object({ ok: z.boolean() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const unauth = () => json({ code: 'UNAUTHENTICATED', message: 'x' }, 401);

describe('apiFetch', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    mockGetSession.mockResolvedValue({ accessToken: 'tok1', email: 'a@b.co' });
    mockRefresh.mockReset();
    mockSignOut.mockReset().mockResolvedValue(undefined);
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the bearer token and parses the response with the schema', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await expect(apiFetch('/x', Schema)).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/x');
    expect(init.headers.Authorization).toBe('Bearer tok1');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    fetchMock.mockResolvedValueOnce(unauth()).mockResolvedValueOnce(json({ ok: true }));
    mockRefresh.mockResolvedValue({ accessToken: 'tok2', email: 'a@b.co' });
    await expect(apiFetch('/x', Schema)).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok2');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs out and throws UNAUTHENTICATED when the refresh fails', async () => {
    fetchMock.mockResolvedValue(unauth());
    mockRefresh.mockResolvedValue(null);
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('signs out when the retry is still 401', async () => {
    fetchMock.mockResolvedValue(unauth());
    mockRefresh.mockResolvedValue({ accessToken: 'tok2', email: 'a@b.co' });
    await expect(apiFetch('/x', Schema)).rejects.toBeInstanceOf(ApiClientError);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('turns an API error body into ApiClientError with the code and status', async () => {
    fetchMock.mockResolvedValue(json({ code: 'RATE_LIMITED', message: 'Daily search limit reached' }, 429));
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429, message: 'Daily search limit reached' });
  });

  it('maps an unparseable error body to PROVIDER_DOWN', async () => {
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status: 502 }));
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'PROVIDER_DOWN', status: 502 });
  });

  it('throws UNAUTHENTICATED without calling the API when there is no session', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a JSON body with a content type for writes', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await expect(apiFetch('/x', Schema, { method: 'PUT', body: { a: 1 } })).resolves.toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('apiSend accepts an empty 204 response and still surfaces API errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiSend('/x', { method: 'DELETE' })).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();

    fetchMock.mockResolvedValueOnce(json({ code: 'NOT_FOUND', message: 'Favorite not found' }, 404));
    await expect(apiSend('/x', { method: 'DELETE' })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
