export type AuthSession = { accessToken: string; email: string };

export type AuthService = {
  getSession(): Promise<AuthSession | null>;
  /** Returns an unsubscribe function. */
  onChange(listener: (session: AuthSession | null) => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  refresh(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
};
