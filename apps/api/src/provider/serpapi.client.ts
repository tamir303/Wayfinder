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
      await this.ledger.reserve(opts.userId);
      let mapped: T;
      try {
        const raw = await this.fetchWithRetry(opts.engine, canonical);
        mapped = this.mapOrLog(opts, raw);
      } catch (error) {
        await this.ledger.refund(opts.userId);
        throw error;
      }
      await this.writeCache(key, mapped, opts.ttlSeconds);
      await this.searchLog.record({
        userId: opts.userId,
        engine: opts.engine,
        cacheHit: false,
        credits: 1,
      });
      return mapped;
    } finally {
      if (gotLock) await this.releaseLock(lockKey);
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

  // A broken cache must never block the request: treat read/parse errors as a miss.
  private async readCache<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.warn(`cache read failed: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async writeCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(`cache write failed: ${(error as Error).message}`);
    }
  }

  private async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.redis.del(lockKey);
    } catch (error) {
      this.logger.warn(`lock release failed: ${(error as Error).message}`);
    }
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
