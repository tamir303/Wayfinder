import type { Stay } from '@wayfinder/shared';

export type StaySort = 'recommended' | 'cheapest' | 'topRated';
type Located = Pick<Stay, 'id' | 'lat' | 'lng'>;

const PAD = 10; // keep pins away from the edges of the placeholder map

/** Positions (0-100) for the placeholder map until a real MapLibre map replaces it. North is up. */
export const projectPins = (stays: Located[]): { id: string; x: number; y: number }[] => {
  if (stays.length === 0) return [];
  const lats = stays.map((s) => s.lat);
  const lngs = stays.map((s) => s.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const place = (v: number, min: number, max: number) => (max === min ? 50 : PAD + ((v - min) / (max - min)) * (100 - 2 * PAD));
  return stays.map((s) => ({ id: s.id, x: place(s.lng, minLng, maxLng), y: 100 - place(s.lat, minLat, maxLat) }));
};

// Array.prototype.sort is stable, so ties keep the provider's own order.
export const sortStays = <T extends Pick<Stay, 'pricePerNight' | 'rating'>>(stays: T[], sort: StaySort): T[] => {
  const copy = [...stays];
  if (sort === 'cheapest') return copy.sort((a, b) => a.pricePerNight - b.pricePerNight);
  if (sort === 'topRated') return copy.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  return copy;
};
