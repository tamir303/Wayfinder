// Trips are local-first: they live on the device (so they work offline) until the B3 trips API exists.
// All functions are pure and return a new trip.
export type TripItemKind = 'flight' | 'stay' | 'attraction';

export type TripItem = {
  id: string;
  kind: TripItemKind;
  title: string;
  meta: string;
  /** 0-based day index, or null while unscheduled. */
  day: number | null;
  price?: number | undefined;
  currency?: string | undefined;
};

export type LocalTrip = { id: string; name: string; dayCount: number; items: TripItem[] };

export const MAX_DAYS = 14;
const clampDays = (n: number) => Math.min(MAX_DAYS, Math.max(1, Math.round(n)));

export const createTrip = (id: string, name: string, dayCount: number): LocalTrip => ({ id, name: name.trim() || 'Trip', dayCount: clampDays(dayCount), items: [] });

export const addItem = (trip: LocalTrip, item: TripItem): LocalTrip =>
  trip.items.some((i) => i.id === item.id) ? trip : { ...trip, items: [...trip.items, item] };

export const removeItem = (trip: LocalTrip, itemId: string): LocalTrip => ({ ...trip, items: trip.items.filter((i) => i.id !== itemId) });

/** Moves an item to another day (or null = unscheduled), placing it last in that day. */
export const setItemDay = (trip: LocalTrip, itemId: string, day: number | null): LocalTrip => {
  const item = trip.items.find((i) => i.id === itemId);
  if (!item || (day !== null && (day < 0 || day >= trip.dayCount))) return trip;
  return { ...trip, items: [...trip.items.filter((i) => i.id !== itemId), { ...item, day }] };
};

/** Swaps an item with its neighbour within the same day. */
export const moveItem = (trip: LocalTrip, itemId: string, direction: 'up' | 'down'): LocalTrip => {
  const item = trip.items.find((i) => i.id === itemId);
  if (!item) return trip;
  const peers = trip.items.filter((i) => i.day === item.day);
  const at = peers.findIndex((i) => i.id === itemId);
  const other = peers[direction === 'up' ? at - 1 : at + 1];
  if (!other) return trip;
  const items = [...trip.items];
  const a = items.findIndex((i) => i.id === itemId);
  const b = items.findIndex((i) => i.id === other.id);
  [items[a], items[b]] = [items[b] as TripItem, items[a] as TripItem];
  return { ...trip, items };
};

export const itemsOfDay = (trip: LocalTrip, day: number | null): TripItem[] => trip.items.filter((i) => i.day === day);

/** Indicative cost per currency, from the items that have a price (never mixes currencies). */
export const estimate = (trip: LocalTrip): { currency: string; total: number }[] => {
  const totals = new Map<string, number>();
  for (const i of trip.items) if (i.price !== undefined && i.currency) totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.price);
  return [...totals].map(([currency, total]) => ({ currency, total }));
};
