import type { ErrorCode, GeoSuggestResponse, GeoSuggestion } from '@wayfinder/shared';
import i18n from '../../i18n';
import { ApiClientError } from '../../lib/api';

export type SuggestUiState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'results'; items: GeoSuggestion[] }
  | { kind: 'error'; code: ErrorCode; message: string };

export const errorMessage = (code: ErrorCode): string => i18n.t(`errors.${code}`);

type Input = { text: string; isFetching: boolean; error: unknown; data?: GeoSuggestResponse };

export const toSuggestUiState = ({ text, error, data }: Input): SuggestUiState => {
  if (text.trim().length < 2) return { kind: 'idle' };
  if (error) {
    const code = error instanceof ApiClientError ? error.code : 'PROVIDER_DOWN';
    return { kind: 'error', code, message: errorMessage(code) };
  }
  if (!data) // Text is long enough but the debounced query has not started yet: still loading, not idle.
  return { kind: 'loading' };
  return data.suggestions.length === 0 ? { kind: 'empty' } : { kind: 'results', items: data.suggestions };
};
