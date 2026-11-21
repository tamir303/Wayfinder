import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { FakeRedis } from '../../test/fake-redis';
import { testEnv } from '../../test/test-env';
import { CreditLedger } from './credit-ledger';
import { cacheKey, canonicalize } from './canonicalize';
import { SerpApiClient } from './serpapi.client';
import type { SearchLogService } from './search-log.service';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response('{}', { status: code });

const setup = (cap = 200, appEnv: 'dev' | 'staging' | 'prod' = 'dev') => {
  const redis = new FakeRedis();
  const env = { ...testEnv, DAILY_CREDIT_CAP: cap, APP_ENV: appEnv };
  const ledger = new CreditLedger(env, redis as unknown as Redis);
  const searchLog = { record: jest.fn().mockResolvedValue(undefined) };
  const client = new SerpApiClient(
    env,
    redis as unknown as Redis,
    ledger,
    searchLog as unknown as SearchLogService,
  );
  return { redis, client, searchLog };
};

const call = (client: SerpApiClient, q = 'tel aviv', map = (raw: unknown) => raw) =>
  client.call({
    engine: 'google_flights_autocomplete',
    params: { q, hl: 'en' },
    ttlSeconds: 60,
    userId: 'u1',
    map,
  });

describe('SerpApiClient', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());

  it('fetches, maps, caches, and logs a miss with 1 credit', async () => {
    const { client, searchLog, redis } = setup();
    fetchSpy.mockResolvedValue(ok({ hello: 'world' }));

    const result = await call(client);

    expect(result).toEqual({ hello: 'world' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://serpapi.com/search.json');
    expect(url.searchParams.get('engine')).toBe('google_flights_autocomplete');
    expect(url.searchParams.get('api_key')).toBe('test-key');
    expect(url.searchParams.get('q')).toBe('tel aviv');
    expect(searchLog.record).toHaveBeenCalledWith({
      userId: 'u1',
      engine: 'google_flights_autocomplete',
      cacheHit: false,
      credits: 1,
    });
    const key = cacheKey('google_flights_autocomplete', canonicalize({ q: 'tel aviv', hl: 'en' }));
    expect(await redis.get(key)).toBe(JSON.stringify({ hello: 'world' }));
  });

  it('serves an equivalent query from cache with 0 credits and no fetch', async () => {
    const { client, searchLog } = setup();
    fetchSpy.mockResolvedValue(ok({ n: 1 }));
    await call(client, 'tel aviv');
    fetchSpy.mockClear();

    const second = await call(client, '  Tel   Aviv'.toLowerCase());

    expect(second).toEqual({ n: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(searchLog.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ cacheHit: true, credits: 0 }),
    );
  });

  it('retries once on a 5xx and then succeeds', async () => {
    const { client } = setup();
    fetchSpy.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok({ n: 2 }));
    await expect(call(client)).resolves.toEqual({ n: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws PROVIDER_DOWN after two 5xx responses', async () => {
    const { client } = setup();
    fetchSpy.mockResolvedValue(status(500));
    await expect(call(client)).rejects.toMatchObject({ code: 'PROVIDER_DOWN' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx: 400 maps to BAD_QUERY, 401/429 map to PROVIDER_DOWN', async () => {
    const a = setup();
    fetchSpy.mockResolvedValue(status(400));
    await expect(call(a.client)).rejects.toMatchObject({ code: 'BAD_QUERY' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();
    const b = setup();
    fetchSpy.mockResolvedValue(status(401));
    await expect(call(b.client)).rejects.toMatchObject({ code: 'PROVIDER_DOWN' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries once on a network error then throws PROVIDER_DOWN', async () => {
    const { client } = setup();
    fetchSpy.mockRejectedValue(new Error('boom'));
    await expect(call(client)).rejects.toMatchObject({ code: 'PROVIDER_DOWN' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws RATE_LIMITED without fetching once the daily cap is used', async () => {
    const { client } = setup(1);
    fetchSpy.mockResolvedValue(ok({ n: 1 }));
    await call(client, 'paris');
    fetchSpy.mockClear();
    await expect(call(client, 'london')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never exceeds the cap under parallel distinct queries', async () => {
    const { client } = setup(2);
    fetchSpy.mockImplementation(async () => ok({ n: 1 }));
    const results = await Promise.allSettled(
      ['a1', 'b2', 'c3', 'd4', 'e5'].map((q) => call(client, q)),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(3);
  });

  it('refunds the reserved credit when the provider call fails', async () => {
    const { client } = setup(1);
    fetchSpy.mockResolvedValueOnce(status(400));
    await expect(call(client, 'paris')).rejects.toMatchObject({ code: 'BAD_QUERY' });
    fetchSpy.mockResolvedValueOnce(ok({ n: 1 }));
    await expect(call(client, 'london')).resolves.toEqual({ n: 1 });
  });

  it('treats a corrupt cache entry as a miss and refetches', async () => {
    const { client, redis } = setup();
    const key = cacheKey('google_flights_autocomplete', canonicalize({ q: 'tel aviv', hl: 'en' }));
    await redis.set(key, '{not json');
    fetchSpy.mockResolvedValue(ok({ fresh: true }));
    await expect(call(client)).resolves.toEqual({ fresh: true });
    expect(await redis.get(key)).toBe(JSON.stringify({ fresh: true }));
  });

  it('does not cache or charge when the mapper throws', async () => {
    const { client, redis, searchLog } = setup();
    fetchSpy.mockResolvedValue(ok({ bad: true }));
    const map = () => {
      throw new Error('mapper failed');
    };
    await expect(call(client, 'tel aviv', map)).rejects.toThrow('mapper failed');
    const entries = [...redis.store.entries()];
    expect(entries.filter(([k]) => !k.startsWith('credits:'))).toEqual([]);
    expect(entries.filter(([k]) => k.startsWith('credits:')).map(([, v]) => v)).toEqual(['0']);
    expect(searchLog.record).not.toHaveBeenCalled();
  });

  it('logs the payload snippet outside prod but never in prod', async () => {
    const run = async (appEnv: 'staging' | 'prod') => {
      const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { client } = setup(200, appEnv);
      fetchSpy.mockResolvedValue(ok({ secretField: 'SENSITIVE-VALUE' }));
      await call(client, 'tel aviv', () => {
        throw new Error('bad shape');
      }).catch(() => undefined);
      const out = spy.mock.calls.map((c) => String(c[0])).join('\n');
      spy.mockRestore();
      return out;
    };
    expect(await run('staging')).toContain('SENSITIVE-VALUE');
    const prod = await run('prod');
    expect(prod).not.toContain('SENSITIVE-VALUE');
    expect(prod).toContain('google_flights_autocomplete');
  });

  it('waits for a concurrent holder of the lock and reuses its cached result', async () => {
    const { client, redis, searchLog } = setup();
    const key = cacheKey('google_flights_autocomplete', canonicalize({ q: 'tel aviv', hl: 'en' }));
    await redis.set(`${key}:lock`, '1');
    setTimeout(() => void redis.set(key, JSON.stringify({ from: 'other' })), 120);

    const result = await call(client);

    expect(result).toEqual({ from: 'other' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(searchLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ cacheHit: true, credits: 0 }),
    );
  });

  it('releases its own lock after a successful call', async () => {
    const { client, redis } = setup();
    fetchSpy.mockResolvedValue(ok({ n: 1 }));
    await call(client);
    const lockKeys = [...redis.store.keys()].filter((k) => k.endsWith(':lock'));
    expect(lockKeys).toEqual([]);
  });
});
