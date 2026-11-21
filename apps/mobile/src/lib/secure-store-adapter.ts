import * as SecureStore from 'expo-secure-store';

// SecureStore values are limited to about 2 KB on iOS and Supabase sessions are larger,
// so a value is split into chunks stored under `${key}.${index}` plus a `${key}.n` count.
const CHUNK_SIZE = 1800;

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

export const chunkedSecureStore = { getItem, setItem, removeItem };
