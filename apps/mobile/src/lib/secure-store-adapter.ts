import * as SecureStore from 'expo-secure-store';

// SecureStore values are limited to about 2 KB on iOS and Supabase sessions are larger,
// so a value is split into chunks stored under `${key}.${index}` plus a `${key}.n` count.
// Chunk size is in UTF-16 units; 600 keeps even 3-byte characters under the ~2 KB limit.
const CHUNK_SIZE = 600;

const removeItem = async (key: string): Promise<void> => {
  const count = await SecureStore.getItemAsync(`${key}.n`);
  if (count !== null) {
    for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}.n`);
};

const getItem = async (key: string): Promise<string | null> => {
  const count = await SecureStore.getItemAsync(`${key}.n`);
  if (count === null) return null;
  const parts: string[] = [];
  for (let i = 0; i < Number(count); i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
};

const setItem = async (key: string, value: string): Promise<void> => {
  await removeItem(key);
  const chunks = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
  await SecureStore.setItemAsync(`${key}.n`, String(chunks));
};

// Supabase can write concurrently (refresh + sign-in); serialize writes so chunks never interleave.
let queue: Promise<unknown> = Promise.resolve();
const serialized = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => {
  return (...args: A): Promise<R> => {
    const run = queue.then(() => fn(...args));
    queue = run.catch(() => undefined);
    return run;
  };
};

export const chunkedSecureStore = {
  getItem,
  setItem: serialized(setItem),
  removeItem: serialized(removeItem),
};
