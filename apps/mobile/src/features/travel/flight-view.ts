import type { FlightOffer } from '@wayfinder/shared';

export type FlightSort = 'best' | 'cheapest' | 'fastest';
export type FlightViewOptions = { sort: FlightSort; directOnly: boolean; /** Empty means every airline. */ airlines: string[] };

/** The airlines operating an offer, from its legs (falls back to the offer's own airline). */
export const airlinesOf = (o: FlightOffer): string[] => {
  const fromLegs = [...new Set(o.legs.map((l) => l.airline))];
  return fromLegs.length > 0 ? fromLegs : [o.airline];
};

// Array.prototype.sort is stable, so ties keep the API's own (best-first) order.
export const applyFlightView = (offers: FlightOffer[], { sort, directOnly, airlines }: FlightViewOptions): FlightOffer[] => {
  let shown = directOnly ? offers.filter((o) => o.stops === 0) : [...offers];
  if (airlines.length > 0) shown = shown.filter((o) => airlinesOf(o).some((a) => airlines.includes(a)));
  if (sort === 'cheapest') return shown.sort((a, b) => a.price - b.price);
  if (sort === 'fastest') return shown.sort((a, b) => a.totalDurationMin - b.totalDurationMin);
  return shown;
};
