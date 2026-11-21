import { cacheKey, canonicalize } from './canonicalize';

describe('canonicalize', () => {
  it('sorts keys, trims, collapses spaces, stringifies and drops empty values', () => {
    expect(canonicalize({ q: '  tel   aviv ', hl: 'en', n: 2, skip: undefined, nil: null, ok: true })).toEqual({
      hl: 'en',
      n: '2',
      ok: 'true',
      q: 'tel aviv',
    });
    expect(Object.keys(canonicalize({ z: 'a', a: 'b' }))).toEqual(['a', 'z']);
  });
});

describe('cacheKey', () => {
  it('is identical for equivalent queries regardless of key order or spacing', () => {
    const a = cacheKey('e', canonicalize({ q: 'tel  aviv', hl: 'en' }));
    const b = cacheKey('e', canonicalize({ hl: 'en', q: ' tel aviv ' }));
    expect(a).toBe(b);
  });

  it('differs by engine and by params', () => {
    expect(cacheKey('a', { q: 'x' })).not.toBe(cacheKey('b', { q: 'x' }));
    expect(cacheKey('a', { q: 'x' })).not.toBe(cacheKey('a', { q: 'y' }));
  });

  it('starts with the serp:<engine>: prefix', () => {
    expect(cacheKey('google_flights', { q: 'x' })).toMatch(/^serp:google_flights:[a-f0-9]{64}$/);
  });
});
