import { ApiErrorSchema, ERROR_CODES, HTTP_STATUS_BY_CODE } from './errors';

describe('errors', () => {
  it('lists exactly the five agreed codes', () => {
    expect([...ERROR_CODES]).toEqual([
      'NO_RESULTS',
      'RATE_LIMITED',
      'PROVIDER_DOWN',
      'BAD_QUERY',
      'UNAUTHENTICATED',
    ]);
  });

  it('maps every code to an HTTP status', () => {
    expect(HTTP_STATUS_BY_CODE).toEqual({
      NO_RESULTS: 404,
      RATE_LIMITED: 429,
      PROVIDER_DOWN: 502,
      BAD_QUERY: 400,
      UNAUTHENTICATED: 401,
    });
  });

  it('accepts a valid error body and rejects an unknown code', () => {
    expect(ApiErrorSchema.safeParse({ code: 'BAD_QUERY', message: 'x' }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ code: 'NOPE', message: 'x' }).success).toBe(false);
  });
});
