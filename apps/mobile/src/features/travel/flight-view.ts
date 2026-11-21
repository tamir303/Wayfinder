import type { FlightOffer } from '@wayfinder/shared';

export type FlightSort = 'best' | 'cheapest' | 'fastest';
export type FlightViewOptions = { sort: FlightSort; directOnly: boolean };

// Array.prototype.sort is stable, so ties keep the API's own (best-first) order.
export const applyFlightView = (offers: FlightOffer[], { sort, directOnly }: FlightViewOptions): FlightOffer[] => {
  const shown = directOnly ? offers.filter((o) => o.stops === 0) : [...offers];
  if (sort === 'cheapest') return shown.sort((a, b) => a.price - b.price);
  if (sort === 'fastest') return shown.sort((a, b) => a.totalDurationMin - b.totalDurationMin);
  return shown;
};
