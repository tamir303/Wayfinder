import { GeoSuggestQuerySchema, GeoSuggestResponseSchema } from './geo';

describe('GeoSuggestQuerySchema', () => {
  it('trims q and defaults kind to airport', () => {
    expect(GeoSuggestQuerySchema.parse({ q: '  tel aviv ' })).toEqual({
      q: 'tel aviv',
      kind: 'airport',
    });
  });

  it('rejects q shorter than 2 characters', () => {
    expect(GeoSuggestQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
  });

  it('rejects q longer than 80 characters', () => {
    expect(GeoSuggestQuerySchema.safeParse({ q: 'a'.repeat(81) }).success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(GeoSuggestQuerySchema.safeParse({ q: 'paris', kind: 'hotel' }).success).toBe(false);
  });
});

describe('GeoSuggestResponseSchema', () => {
  it('accepts a valid suggestion', () => {
    const body = { suggestions: [{ code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' }] };
    expect(GeoSuggestResponseSchema.parse(body)).toEqual(body);
  });

  it('rejects a non-IATA code', () => {
    const body = { suggestions: [{ code: 'tlv1', name: 'x', city: 'y' }] };
    expect(GeoSuggestResponseSchema.safeParse(body).success).toBe(false);
  });
});
