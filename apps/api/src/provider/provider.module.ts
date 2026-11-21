import { Module } from '@nestjs/common';
import { CreditLedger } from './credit-ledger';
import { SearchLogService } from './search-log.service';
import { SerpApiClient } from './serpapi.client';

@Module({
  providers: [CreditLedger, SearchLogService, SerpApiClient],
  exports: [SerpApiClient, CreditLedger],
})
export class ProviderModule {}
