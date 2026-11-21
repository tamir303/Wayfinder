import type { FlightSearchQuery, GeoSuggestion } from '@wayfinder/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRecents } from './recents';

export type RecentSearch = {
  from: GeoSuggestion;
  to: GeoSuggestion;
  date: string;
  returnDate?: string | undefined;
  adults: number;
  cabin: FlightSearchQuery['cabin'];
};

const airports = createRecents<GeoSuggestion>(AsyncStorage, 'wf.recentAirports', 6, (a, b) => a.code === b.code);
const searches = createRecents<RecentSearch>(
  AsyncStorage,
  'wf.recentSearches',
  5,
  (a, b) => a.from.code === b.from.code && a.to.code === b.to.code && a.date === b.date && a.returnDate === b.returnDate,
);

const useList = <T,>(recents: { load: () => Promise<T[]>; add: (i: T) => Promise<T[]> }) => {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let alive = true;
    void recents.load().then((l) => alive && setItems(l));
    return () => {
      alive = false;
    };
  }, [recents]);
  const add = useCallback((item: T) => void recents.add(item).then(setItems), [recents]);
  return useMemo(() => ({ items, add }), [items, add]);
};

export const useRecentAirports = () => useList(airports);
export const useRecentSearches = () => useList(searches);
