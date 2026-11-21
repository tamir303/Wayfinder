export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

/** A small "most recent first" list kept in a key-value store. Storage problems never break the UI. */
export const createRecents = <T>(store: KeyValueStore, key: string, max: number, same: (a: T, b: T) => boolean) => {
  const load = async (): Promise<T[]> => {
    try {
      const raw = await store.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as T[]).slice(0, max) : [];
    } catch {
      return [];
    }
  };
  const add = async (item: T): Promise<T[]> => {
    const next = [item, ...(await load()).filter((x) => !same(x, item))].slice(0, max);
    try {
      await store.setItem(key, JSON.stringify(next));
    } catch {
      // keep the in-memory result; losing a recent is harmless
    }
    return next;
  };
  return { load, add };
};
