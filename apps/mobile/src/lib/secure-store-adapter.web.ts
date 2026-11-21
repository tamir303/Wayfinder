// SecureStore is native-only. On web the Supabase session lives in localStorage, as supabase-js does by default.
const storage = () => (typeof window === 'undefined' ? null : window.localStorage);

export const chunkedSecureStore = {
  getItem: async (key: string): Promise<string | null> => storage()?.getItem(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    storage()?.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    storage()?.removeItem(key);
  },
};
