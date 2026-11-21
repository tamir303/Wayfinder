import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { createTrip, type LocalTrip } from './model';

const KEY = 'wf.trips';
type State = { trips: LocalTrip[]; ready: boolean };

let state: State = { trips: [], ready: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const persist = () => {
  void AsyncStorage.setItem(KEY, JSON.stringify(state.trips)).catch(() => undefined); // a storage failure must not break the UI
};

const set = (trips: LocalTrip[]) => {
  state = { trips, ready: true };
  persist();
  emit();
};

let loading: Promise<void> | undefined;
const load = () =>
  (loading ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      state = { trips: Array.isArray(parsed) ? (parsed as LocalTrip[]) : [], ready: true };
    })
    .catch(() => {
      state = { trips: [], ready: true };
    })
    .then(emit));

const subscribe = (l: () => void) => {
  listeners.add(l);
  void load();
  return () => void listeners.delete(l);
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const tripActions = {
  create: (name: string, dayCount: number): LocalTrip => {
    const trip = createTrip(newId(), name, dayCount);
    set([trip, ...state.trips]);
    return trip;
  },
  update: (id: string, fn: (t: LocalTrip) => LocalTrip) => set(state.trips.map((t) => (t.id === id ? fn(t) : t))),
  remove: (id: string) => set(state.trips.filter((t) => t.id !== id)),
};

export const useTripStore = () => useSyncExternalStore(subscribe, () => state, () => state);

/** Test helper: back to a clean, loaded store. */
export const resetTripStore = () => {
  state = { trips: [], ready: true };
  loading = Promise.resolve();
  emit();
};
