import type { FlightOffer } from '@wayfinder/shared';
import { addDays } from '../../lib/format';
import { applyFlightView } from './flight-view';

const offer = (id: string, price: number, durationMin: number, stops: number, group: 'best' | 'other' = 'other'): FlightOffer => ({
  id,
  group,
  price,
  currency: 'USD',
  airline: 'X',
  totalDurationMin: durationMin,
  stops,
  legs: [],
  layovers: [],
  emissions: null,
  returnToken: null,
  handoffUrl: 'https://x.example',
});

const offers = [offer('a', 300, 300, 0, 'best'), offer('b', 150, 600, 1), offer('c', 200, 310, 0), offer('d', 150, 500, 1)];
const ids = (o: FlightOffer[]) => o.map((x) => x.id);

describe('applyFlightView', () => {
  it('keeps the API order for "best"', () => {
    expect(ids(applyFlightView(offers, { sort: 'best', directOnly: false }))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sorts by price, keeping the API order for ties', () => {
    expect(ids(applyFlightView(offers, { sort: 'cheapest', directOnly: false }))).toEqual(['b', 'd', 'c', 'a']);
  });

  it('sorts by duration', () => {
    expect(ids(applyFlightView(offers, { sort: 'fastest', directOnly: false }))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('filters to direct flights', () => {
    expect(ids(applyFlightView(offers, { sort: 'best', directOnly: true }))).toEqual(['a', 'c']);
    expect(ids(applyFlightView(offers, { sort: 'cheapest', directOnly: true }))).toEqual(['c', 'a']);
  });

  it('does not mutate its input and handles an empty list', () => {
    const copy = [...offers];
    applyFlightView(offers, { sort: 'cheapest', directOnly: false });
    expect(offers).toEqual(copy);
    expect(applyFlightView([], { sort: 'fastest', directOnly: true })).toEqual([]);
  });
});

describe('addDays', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2027-03-10', 7)).toBe('2027-03-17');
    expect(addDays('2027-12-30', 5)).toBe('2028-01-04');
    expect(addDays('2027-03-10', -10)).toBe('2027-02-28');
  });
});
