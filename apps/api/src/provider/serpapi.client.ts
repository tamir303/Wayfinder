import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { AppError } from '../common/app-error';
import { ENV, REDIS } from '../common/tokens';
import type { Env } from '../config/env';
import { cacheKey, canonicalize, type Params } from './canonicalize';
import { CreditLedger } from './credit-ledger';
import { SearchLogService } from './search-log.service';

const SERPAPI_URL = 'https://serpapi.com/search.json';
const REQUEST_TIMEOUT_MS = 15_000;
const LOCK_TTL_MS = 20_000;
const LOCK_WAIT_MS = 8_000;
const LOCK_POLL_MS = 50;

export type CallOptions<T> = {
  engine: string;
  params: Params;
  ttlSeconds: number;
  userId: string;
  map: (raw: unknown) => T;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class SerpApiClient {
  private readonly logger = new Logger(SerpApiClient.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly ledger: CreditLedger,
    private readonly searchLog: SearchLogService,
  ) {}

  async call<T>(opts: CallOptions<T>): Promise<T> {
    const canonical = canonicalize(opts.params);
    const key = cacheKey(opts.engine, canonical);

    const cached = await this.readCache<T>(key);
    if (cached !== undefined) return this.hit(opts, cached);

    const lockKey = `${key}:lock`;
    const gotLock = (await this.redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX')) === 'OK';
    if (!gotLock) {
      const waited = await this.waitForCache<T>(key);
      if (waited !== undefined) return this.hit(opts, waited);
      // The lock holder failed or timed out. Fall through and fetch ourselves.
    }

    try {
      await this.ledger.assertAvailable(opts.userId);
      const raw = await this.fetchWithRetry(opts.engine, canonical);
      const mapped = this.mapOrLog(opts, raw);
      await this.redis.set(key, JSON.stringify(mapped), 'EX', opts.ttlSeconds);
      await this.ledger.consume(opts.userId);
      await this.searchLog.record({
        userId: opts.userId,
        engine: opts.engine,
        cacheHit: false,
        credits: 1,
      });
      return mapped;
    } finally {
      if (gotLock) await this.redis.del(lockKey);
    }
  }

  private async hit<T>(opts: CallOptions<T>, value: T): Promise<T> {
    await this.searchLog.record({
      userId: opts.userId,
      engine: opts.engine,
      cacheHit: true,
      credits: 0,
    });
    return value;
  }

  private async readCache<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  }

  private async waitForCache<T>(key: string): Promise<T | undefined> {
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(LOCK_POLL_MS);
      const value = await this.readCache<T>(key);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private mapOrLog<T>(opts: CallOptions<T>, raw: unknown): T {
    try {
      return opts.map(raw);
    } catch (error) {
      // Log a bounded snippet of the payload to debug shape changes. The API key is never in the body.
      this.logger.error(
        `mapper failed for ${opts.engine}: ${JSON.stringify(raw).slice(0, 1000)}`,
      );
      throw error;
    }
  }

  private async fetchWithRetry(engine: string, canonical: Record<string, string>): Promise<unknown> {
    const url = new URL(SERPAPI_URL);
    url.search = new URLSearchParams({ ...canonical, engine, api_key: this.env.SERPAPI_KEY }).toString();

    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      } catch {
        if (attempt === 0) continue;
        throw new AppError('PROVIDER_DOWN', 'Provider request failed');
      }
      if (response.status >= 500) {
        if (attempt === 0) continue;
        throw new AppError('PROVIDER_DOWN', 'Provider request failed');
      }
      if (response.status === 400) throw new AppError('BAD_QUERY', 'Provider rejected the query');
      if (response.status >= 400) throw new AppError('PROVIDER_DOWN', 'Provider request failed');
      return response.json();
    }
    throw new AppError('PROVIDER_DOWN', 'Provider request failed');
  }
}
