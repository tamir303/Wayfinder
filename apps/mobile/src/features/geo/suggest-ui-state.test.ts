import { ApiClientError } from '../../lib/api';
import { toSuggestUiState } from './suggest-ui-state';

jest.mock('../../lib/auth', () => ({ auth: {} }));

const results = { suggestions: [{ code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' }] };

describe('toSuggestUiState', () => {
  it('is idle for text shorter than 2 characters', () => {
    expect(toSuggestUiState({ text: 'a', isFetching: false, error: null })).toEqual({ kind: 'idle' });
    expect(toSuggestUiState({ text: '  ', isFetching: false, error: null })).toEqual({ kind: 'idle' });
  });

  it('is loading while fetching without data', () => {
    expect(toSuggestUiState({ text: 'tel', isFetching: true, error: null })).toEqual({ kind: 'loading' });
  });

  it('is loading, not idle, while the debounced query has not started yet', () => {
    expect(toSuggestUiState({ text: 'tel', isFetching: false, error: null })).toEqual({ kind: 'loading' });
  });

  it('is results when data has suggestions', () => {
    expect(toSuggestUiState({ text: 'tel', isFetching: false, error: null, data: results })).toEqual({
      kind: 'results',
      items: results.suggestions,
    });
  });

  it('is empty when data has no suggestions', () => {
    expect(
      toSuggestUiState({ text: 'zzz', isFetching: false, error: null, data: { suggestions: [] } }),
    ).toEqual({ kind: 'empty' });
  });

  it.each([
    ['RATE_LIMITED', 'daily search limit'],
    ['PROVIDER_DOWN', 'temporarily unavailable'],
    ['BAD_QUERY', 'valid search'],
    ['NO_RESULTS', 'no matches'],
    ['UNAUTHENTICATED', 'sign in'],
  ] as const)('maps %s to a friendly message', (code, fragment) => {
    const state = toSuggestUiState({
      text: 'tel',
      isFetching: false,
      error: new ApiClientError(code, 'server text', 400),
    });
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.code).toBe(code);
      expect(state.message.toLowerCase()).toContain(fragment);
    }
  });

  it('maps a non-API error to PROVIDER_DOWN', () => {
    const state = toSuggestUiState({ text: 'tel', isFetching: false, error: new Error('network') });
    expect(state).toMatchObject({ kind: 'error', code: 'PROVIDER_DOWN' });
  });
});
