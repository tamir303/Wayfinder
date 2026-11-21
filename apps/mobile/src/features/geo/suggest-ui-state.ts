import type { ErrorCode, GeoSuggestResponse, GeoSuggestion } from '@wayfinder/shared';
import { ApiClientError } from '../../lib/api';

export type SuggestUiState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'results'; items: GeoSuggestion[] }
  | { kind: 'error'; code: ErrorCode; message: string };

const MESSAGES: Record<ErrorCode, string> = {
  RATE_LIMITED: "You've reached today's daily search limit. Try again tomorrow.",
  PROVIDER_DOWN: 'Search is temporarily unavailable. Please try again in a moment.',
  BAD_QUERY: 'Please enter a valid search.',
  NO_RESULTS: 'No matches found.',
  UNAUTHENTICATED: 'Please sign in again.',
};

type Input = { text: string; isFetching: boolean; error: unknown; data?: GeoSuggestResponse };

export const toSuggestUiState = ({ text, error, data }: Input): SuggestUiState => {
  if (text.trim().length < 2) return { kind: 'idle' };
  if (error) {
    const code = error instanceof ApiClientError ? error.code : 'PROVIDER_DOWN';
    return { kind: 'error', code, message: MESSAGES[code] };
  }
  if (!data) // Text is long enough but the debounced query has not started yet: still loading, not idle.
  return { kind: 'loading' };
  return data.suggestions.length === 0 ? { kind: 'empty' } : { kind: 'results', items: data.suggestions };
};
