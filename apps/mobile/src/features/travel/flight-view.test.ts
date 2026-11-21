import type { FlightOffer } from '@wayfinder/shared';
import { addDays } from '../../lib/format';
import { airlinesOf, applyFlightView } from './flight-view';
import { sparklinePoints } from './sparkline';

const offer = (id: string, price: number, durationMin: number, stops: number, group: 'best' | 'other' = 'other', airline = 'X'): FlightOffer => ({
  id,
  group,
  price,
  currency: 'USD',
  airline,
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
    expect(ids(applyFlightView(offers, { sort: 'best', directOnly: false, airlines: [] }))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sorts by price, keeping the API order for ties', () => {
    expect(ids(applyFlightView(offers, { sort: 'cheapest', directOnly: false, airlines: [] }))).toEqual(['b', 'd', 'c', 'a']);
  });

  it('sorts by duration', () => {
    expect(ids(applyFlightView(offers, { sort: 'fastest', directOnly: false, airlines: [] }))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('filters to direct flights', () => {
    expect(ids(applyFlightView(offers, { sort: 'best', directOnly: true, airlines: [] }))).toEqual(['a', 'c']);
    expect(ids(applyFlightView(offers, { sort: 'cheapest', directOnly: true, airlines: [] }))).toEqual(['c', 'a']);
  });

  it('does not mutate its input and handles an empty list', () => {
    const copy = [...offers];
    applyFlightView(offers, { sort: 'cheapest', directOnly: false, airlines: [] });
    expect(offers).toEqual(copy);
    expect(applyFlightView([], { sort: 'fastest', directOnly: true, airlines: [] })).toEqual([]);
  });
});

describe('addDays', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2027-03-10', 7)).toBe('2027-03-17');
    expect(addDays('2027-12-30', 5)).toBe('2028-01-04');
    expect(addDays('2027-03-10', -10)).toBe('2027-02-28');
  });
});

describe('airline filter', () => {
  const list = [offer('a', 300, 300, 0, 'best', 'El Al'), offer('b', 150, 600, 1, 'other', 'Aegean'), offer('c', 200, 310, 0, 'other', 'El Al')];
  const idsOf = (o: FlightOffer[]) => o.map((x) => x.id);

  it('keeps only the chosen airlines, and everything when none is chosen', () => {
    expect(idsOf(applyFlightView(list, { sort: 'best', directOnly: false, airlines: ['El Al'] }))).toEqual(['a', 'c']);
    expect(idsOf(applyFlightView(list, { sort: 'best', directOnly: false, airlines: ['El Al', 'Aegean'] }))).toEqual(['a', 'b', 'c']);
    expect(idsOf(applyFlightView(list, { sort: 'best', directOnly: false, airlines: [] }))).toEqual(['a', 'b', 'c']);
  });

  it('combines with the direct-only filter and sorting', () => {
    expect(idsOf(applyFlightView(list, { sort: 'cheapest', directOnly: true, airlines: ['El Al'] }))).toEqual(['c', 'a']);
  });

  it('lists an offer’s airlines from its legs, falling back to the offer airline', () => {
    const withLegs = { ...offer('x', 1, 1, 1), airline: 'Lufthansa + Lufthansa City Airlines', legs: [{ airline: 'Lufthansa' }, { airline: 'Lufthansa City Airlines' }] } as unknown as FlightOffer;
    expect(airlinesOf(withLegs)).toEqual(['Lufthansa', 'Lufthansa City Airlines']);
    expect(airlinesOf(offer('y', 1, 1, 0, 'other', 'Wizz Air'))).toEqual(['Wizz Air']);
  });
});

describe('sparklinePoints', () => {
  it('scales values into the box with the highest value at the top', () => {
    expect(sparklinePoints([10, 20, 30], 100, 40)).toBe('0,40 50,20 100,0');
  });
  it('draws a flat line in the middle when all values are equal', () => {
    expect(sparklinePoints([5, 5, 5], 100, 40)).toBe('0,20 50,20 100,20');
  });
  it('handles a single value and no values', () => {
    expect(sparklinePoints([7], 100, 40)).toBe('50,20');
    expect(sparklinePoints([], 100, 40)).toBe('');
  });
});
