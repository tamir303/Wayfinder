import { z } from 'zod';
import { ApiClientError, apiFetch } from './api';

const mockGetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockSignOut = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      refreshSession: (...a: unknown[]) => mockRefreshSession(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
  },
}));

const Schema = z.object({ ok: z.boolean() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('apiFetch', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok1' } } });
    mockRefreshSession.mockReset();
    mockSignOut.mockReset().mockResolvedValue({});
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

  it('refreshes the session once on 401 and retries with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ code: 'UNAUTHENTICATED', message: 'x' }, 401))
      .mockResolvedValueOnce(json({ ok: true }));
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'tok2' } }, error: null });

    await expect(apiFetch('/x', Schema)).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok2');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs out and throws UNAUTHENTICATED when the refresh fails', async () => {
    fetchMock.mockResolvedValue(json({ code: 'UNAUTHENTICATED', message: 'x' }, 401));
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: new Error('nope') });

    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('signs out when the retry is still 401', async () => {
    fetchMock.mockResolvedValue(json({ code: 'UNAUTHENTICATED', message: 'x' }, 401));
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'tok2' } }, error: null });

    await expect(apiFetch('/x', Schema)).rejects.toBeInstanceOf(ApiClientError);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('turns an API error body into ApiClientError with the code and status', async () => {
    fetchMock.mockResolvedValue(json({ code: 'RATE_LIMITED', message: 'Daily search limit reached' }, 429));
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      message: 'Daily search limit reached',
    });
  });

  it('maps an unparseable error body to PROVIDER_DOWN', async () => {
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status: 502 }));
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'PROVIDER_DOWN', status: 502 });
  });

  it('throws UNAUTHENTICATED without calling the API when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(apiFetch('/x', Schema)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
