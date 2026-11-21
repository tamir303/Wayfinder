import { Injectable } from '@nestjs/common';
import type { GeoSuggestResponse } from '@wayfinder/shared';
import { SerpApiClient } from '../provider/serpapi.client';
import { mapAutocomplete } from './autocomplete.mapper';

const AUTOCOMPLETE_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class GeoService {
  constructor(private readonly serpApi: SerpApiClient) {}

  suggestAirports(userId: string, q: string): Promise<GeoSuggestResponse> {
    return this.serpApi.call({
      engine: 'google_flights_autocomplete',
      params: { q: q.toLowerCase(), hl: 'en', gl: 'us' },
      ttlSeconds: AUTOCOMPLETE_TTL_SECONDS,
      userId,
      map: mapAutocomplete,
    });
  }
}
