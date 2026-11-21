import {
  GeoSuggestResponseSchema,
  type GeoSuggestion,
  type GeoSuggestResponse,
} from '@wayfinder/shared';
import { z } from 'zod';
import { AppError } from '../common/app-error';

const RawAirportSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().optional(),
});

const RawSuggestionSchema = z.object({
  type: z.string(),
  name: z.string(),
  id: z.string().optional(),
  airports: z.array(RawAirportSchema).optional(),
});

const RawResponseSchema = z.object({ suggestions: z.array(RawSuggestionSchema) });

const IATA = /^[A-Z]{3}$/;

// Only SerpAPI's explicit "no results" message is an empty result. Any other error (bad key,
// quota) must surface as PROVIDER_DOWN so it is not cached as "no matches".
const NO_RESULTS = /hasn't returned any results/i;

const isNoResults = (raw: unknown): boolean => {
  const error = typeof raw === 'object' && raw !== null ? (raw as { error?: unknown }).error : undefined;
  return typeof error === 'string' && NO_RESULTS.test(error);
};

export const mapAutocomplete = (raw: unknown): GeoSuggestResponse => {
  const parsed = RawResponseSchema.safeParse(raw);
  if (!parsed.success) {
    if (isNoResults(raw)) return { suggestions: [] };
    throw new AppError('PROVIDER_DOWN', 'Unexpected autocomplete response');
  }

  const seen = new Set<string>();
  const suggestions: GeoSuggestion[] = [];
  const add = (suggestion: GeoSuggestion) => {
    if (seen.has(suggestion.code)) return;
    seen.add(suggestion.code);
    suggestions.push(suggestion);
  };

  for (const item of parsed.data.suggestions) {
    if (item.type === 'city') {
      for (const airport of item.airports ?? []) {
        if (IATA.test(airport.id)) {
          add({ code: airport.id, name: airport.name, city: airport.city ?? item.name });
        }
      }
    } else if (item.type === 'airport' && item.id && IATA.test(item.id)) {
      add({ code: item.id, name: item.name, city: item.name });
    }
  }

  const checked = GeoSuggestResponseSchema.safeParse({ suggestions });
  if (!checked.success) throw new AppError('PROVIDER_DOWN', 'Autocomplete mapping failed');
  return checked.data;
};
