import type { Stay } from '@wayfinder/shared';
import { nightsBetween } from '../../lib/format';
import { projectPins, sortStays } from './map';

const stay = (id: string, lat: number, lng: number, price = 100, rating: number | null = 4): Pick<Stay, 'id' | 'lat' | 'lng' | 'pricePerNight' | 'rating'> => ({ id, lat, lng, pricePerNight: price, rating });

describe('projectPins', () => {
  it('maps coordinates into the 0-100 box with north at the top and padding at the edges', () => {
    const pins = projectPins([stay('nw', 50, 0), stay('se', 40, 10), stay('mid', 45, 5)]);
    const by = Object.fromEntries(pins.map((p) => [p.id, p]));
    expect(by.nw).toMatchObject({ x: 10, y: 10 });
    expect(by.se).toMatchObject({ x: 90, y: 90 });
    expect(by.mid).toMatchObject({ x: 50, y: 50 });
  });

  it('centres a single stay and handles identical coordinates', () => {
    expect(projectPins([stay('a', 48, 2)])).toEqual([{ id: 'a', x: 50, y: 50 }]);
    expect(projectPins([stay('a', 48, 2), stay('b', 48, 2)]).every((p) => p.x === 50 && p.y === 50)).toBe(true);
  });

  it('returns nothing for no stays', () => {
    expect(projectPins([])).toEqual([]);
  });
});

describe('sortStays', () => {
  const list = [stay('a', 0, 0, 300, 4.5), stay('b', 0, 0, 100, null), stay('c', 0, 0, 200, 4.9)];
  const ids = (s: typeof list) => s.map((x) => x.id);

  it('keeps the provider order for "recommended"', () => {
    expect(ids(sortStays(list, 'recommended'))).toEqual(['a', 'b', 'c']);
  });
  it('sorts by price ascending', () => {
    expect(ids(sortStays(list, 'cheapest'))).toEqual(['b', 'c', 'a']);
  });
  it('sorts by rating descending with unrated stays last', () => {
    expect(ids(sortStays(list, 'topRated'))).toEqual(['c', 'a', 'b']);
  });
  it('does not mutate its input', () => {
    const copy = [...list];
    sortStays(list, 'cheapest');
    expect(list).toEqual(copy);
  });
});

describe('nightsBetween', () => {
  it('counts nights between two dates', () => {
    expect(nightsBetween('2027-03-10', '2027-03-14')).toBe(4);
    expect(nightsBetween('2027-02-27', '2027-03-02')).toBe(3);
    expect(nightsBetween('2027-03-10', '2027-03-10')).toBe(0);
  });
});
