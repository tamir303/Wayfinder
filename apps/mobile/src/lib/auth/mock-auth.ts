import type { AuthService, AuthSession } from './types';

// dev only: no network. Any email is accepted and the code is always 123456.
export const MOCK_CODE = '123456';

export const createMockAuth = (): AuthService => {
  let session: AuthSession | null = null;
  const listeners = new Set<(s: AuthSession | null) => void>();
  const set = (next: AuthSession | null) => {
    session = next;
    listeners.forEach((l) => l(next));
  };
  return {
    getSession: async () => session,
    onChange: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    sendCode: async (email) => {
      if (!/\S+@\S+\.\S+/.test(email)) throw new Error('invalid email');
    },
    verifyCode: async (email, code) => {
      if (code !== MOCK_CODE) throw new Error('invalid code');
      set({ accessToken: 'mock-access-token', email });
    },
    refresh: async () => session,
    signOut: async () => set(null),
  };
};
