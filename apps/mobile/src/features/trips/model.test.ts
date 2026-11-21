import { addItem, createTrip, estimate, itemsOfDay, moveItem, removeItem, setItemDay, type TripItem } from './model';

const item = (id: string, day: number | null = null, extra: Partial<TripItem> = {}): TripItem => ({ id, kind: 'attraction', title: id, meta: '', day, ...extra });
const trip = (...items: TripItem[]) => items.reduce(addItem, createTrip('t', 'Rome', 3));

describe('trip model', () => {
  it('clamps the number of days and names an empty trip', () => {
    expect(createTrip('t', '  ', 99)).toMatchObject({ name: 'Trip', dayCount: 14 });
    expect(createTrip('t', 'x', 0).dayCount).toBe(1);
  });

  it('does not add the same item twice', () => {
    expect(trip(item('a'), item('a')).items).toHaveLength(1);
  });

  it('moves an item to a day, last in that day, and ignores days that do not exist', () => {
    const t = setItemDay(trip(item('a', 0), item('b', 0), item('c')), 'c', 0);
    expect(itemsOfDay(t, 0).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(setItemDay(t, 'a', 3)).toBe(t);
    expect(itemsOfDay(setItemDay(t, 'a', null), null).map((i) => i.id)).toEqual(['a']);
  });

  it('reorders within a day only, and stops at the ends', () => {
    const t = trip(item('a', 0), item('x', 1), item('b', 0), item('c', 0));
    expect(itemsOfDay(moveItem(t, 'c', 'up'), 0).map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(itemsOfDay(moveItem(t, 'a', 'down'), 0).map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(moveItem(t, 'a', 'up')).toBe(t);
    expect(moveItem(t, 'c', 'down')).toBe(t);
    expect(itemsOfDay(moveItem(t, 'c', 'up'), 1).map((i) => i.id)).toEqual(['x']);
  });

  it('removes an item', () => {
    expect(removeItem(trip(item('a'), item('b')), 'a').items.map((i) => i.id)).toEqual(['b']);
  });

  it('estimates per currency from priced items only', () => {
    const t = trip(item('a', 0, { price: 100, currency: 'USD' }), item('b', 0, { price: 50, currency: 'USD' }), item('c', 0, { price: 40, currency: 'EUR' }), item('d'));
    expect(estimate(t)).toEqual([{ currency: 'USD', total: 150 }, { currency: 'EUR', total: 40 }]);
  });
});
