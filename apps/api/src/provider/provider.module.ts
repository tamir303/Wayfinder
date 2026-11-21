import { Module } from '@nestjs/common';
import type Redis from 'ioredis';
import { ENV, REDIS } from '../common/tokens';
import type { Env } from '../config/env';
import { CreditLedger } from './credit-ledger';
import { FixtureSerpApiClient } from './fixture-serpapi.client';
import { SearchLogService } from './search-log.service';
import { SerpApiClient } from './serpapi.client';

@Module({
  providers: [
    CreditLedger,
    SearchLogService,
    {
      provide: SerpApiClient,
      inject: [ENV, REDIS, CreditLedger, SearchLogService],
      // Mock backend (dev) answers from fixtures; every other environment calls SerpAPI.
      useFactory: (env: Env, redis: Redis, ledger: CreditLedger, log: SearchLogService) =>
        new (env.MOCK_DATA ? FixtureSerpApiClient : SerpApiClient)(env, redis, ledger, log),
    },
  ],
  exports: [SerpApiClient, CreditLedger],
})
export class ProviderModule {}
