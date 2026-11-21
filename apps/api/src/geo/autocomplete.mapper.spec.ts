import fixture from '../../test/fixtures/google_flights_autocomplete/tel-aviv.json';
import { mapAutocomplete } from './autocomplete.mapper';

describe('mapAutocomplete', () => {
  it('maps the real tel-aviv fixture to the airport list', () => {
    expect(mapAutocomplete(fixture)).toEqual({
      suggestions: [{ code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv-Yafo' }],
    });
  });

  it('skips regions and non-IATA ids', () => {
    const raw = {
      suggestions: [
        { type: 'region', name: 'Some District', id: '/m/1' },
        { type: 'city', name: 'X', id: '/m/2', airports: [{ id: 'toolong', name: 'Bad', city: 'X' }] },
      ],
    };
    expect(mapAutocomplete(raw)).toEqual({ suggestions: [] });
  });

  it('flattens multiple airports and de-duplicates by code', () => {
    const raw = {
      suggestions: [
        {
          type: 'city',
          name: 'London, United Kingdom',
          id: '/m/1',
          airports: [
            { id: 'LHR', name: 'Heathrow Airport', city: 'London' },
            { id: 'LGW', name: 'Gatwick Airport', city: 'London' },
          ],
        },
        {
          type: 'city',
          name: 'London Area',
          id: '/m/2',
          airports: [{ id: 'LHR', name: 'Heathrow Airport', city: 'London' }],
        },
      ],
    };
    expect(mapAutocomplete(raw).suggestions.map((s) => s.code)).toEqual(['LHR', 'LGW']);
  });

  it('falls back to the suggestion name when an airport has no city', () => {
    const raw = {
      suggestions: [
        { type: 'city', name: 'Paris, France', id: '/m/1', airports: [{ id: 'CDG', name: 'Charles de Gaulle' }] },
      ],
    };
    expect(mapAutocomplete(raw).suggestions[0]).toEqual({
      code: 'CDG',
      name: 'Charles de Gaulle',
      city: 'Paris, France',
    });
  });

  it('handles a top-level airport suggestion with an IATA id (unverified shape)', () => {
    const raw = { suggestions: [{ type: 'airport', name: 'Ben Gurion Airport', id: 'TLV' }] };
    expect(mapAutocomplete(raw).suggestions).toEqual([
      { code: 'TLV', name: 'Ben Gurion Airport', city: 'Ben Gurion Airport' },
    ]);
  });

  it('returns an empty list when the provider reports a no-results error string', () => {
    expect(mapAutocomplete({ error: "Google hasn't returned any results for this query." })).toEqual({
      suggestions: [],
    });
  });

  it('throws PROVIDER_DOWN on an unexpected shape', () => {
    expect(() => mapAutocomplete({ foo: 1 })).toThrow(
      expect.objectContaining({ code: 'PROVIDER_DOWN' }),
    );
    expect(() => mapAutocomplete(null)).toThrow(expect.objectContaining({ code: 'PROVIDER_DOWN' }));
    expect(() => mapAutocomplete({ suggestions: 'nope' })).toThrow(
      expect.objectContaining({ code: 'PROVIDER_DOWN' }),
    );
  });
});
