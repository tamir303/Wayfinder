import type { FlightSearchQuery, SavedSearch } from '@wayfinder/shared';
import { ApiClientError } from '../api-error';

let rows: SavedSearch[] = [];
let n = 0;

export const resetSaved = (): void => {
  rows = [];
  n = 0;
};

export const listSaved = (): { searches: SavedSearch[] } => ({ searches: [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });

export const createSaved = (q: FlightSearchQuery): SavedSearch => {
  const found = rows.find((r) => r.from === q.from && r.to === q.to && r.date === q.date && r.adults === q.adults && r.cabin === q.cabin);
  if (found) return found; // saving the same search twice is a no-op, as on the real API
  n += 1;
  const row: SavedSearch = {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    from: q.from,
    to: q.to,
    date: q.date,
    adults: q.adults,
    cabin: q.cabin,
    createdAt: new Date(Date.UTC(2027, 0, 1) + n * 1000).toISOString(),
  };
  rows.push(row);
  return row;
};

export const removeSaved = (id: string): void => {
  if (!rows.some((r) => r.id === id)) throw new ApiClientError('NOT_FOUND', 'Saved search not found', 404);
  rows = rows.filter((r) => r.id !== id);
};
