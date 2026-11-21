import { config } from '../config/app-config';

// SecureStore is native-only. dev/staging keep the session in localStorage as-is.
// prod encrypts it at rest (AES-GCM, non-extractable key kept in IndexedDB).
const local = () => (typeof window === 'undefined' ? null : window.localStorage);

const DB = 'wayfinder-keys';
const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const getKey = async (): Promise<CryptoKey> => {
  const db = await openDb();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const r = db.transaction('keys').objectStore('keys').get('session');
    r.onsuccess = () => resolve(r.result as CryptoKey | undefined);
    r.onerror = () => reject(r.error);
  });
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await new Promise<void>((resolve, reject) => {
    const r = db.transaction('keys', 'readwrite').objectStore('keys').put(key, 'session');
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  return key;
};

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const encrypt = async (plain: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(), new TextEncoder().encode(plain));
  return `${toB64(iv.buffer)}.${toB64(data)}`;
};

export const decrypt = async (stored: string): Promise<string | null> => {
  try {
    const [iv, data] = stored.split('.');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await getKey(), fromB64(data));
    return new TextDecoder().decode(plain);
  } catch {
    return null; // wrong key or tampered value: treat as signed out
  }
};

export const chunkedSecureStore = {
  getItem: async (key: string): Promise<string | null> => {
    const raw = local()?.getItem(key) ?? null;
    return raw !== null && config.encryptStorage ? decrypt(raw) : raw;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    local()?.setItem(key, config.encryptStorage ? await encrypt(value) : value);
  },
  removeItem: async (key: string): Promise<void> => {
    local()?.removeItem(key);
  },
};
