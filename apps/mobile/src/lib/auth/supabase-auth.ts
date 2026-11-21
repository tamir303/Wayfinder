import type { Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { getSupabase } from '../supabase';
import type { AuthService, AuthSession } from './types';

const toSession = (s: Session | null): AuthSession | null =>
  s ? { accessToken: s.access_token, email: s.user.email ?? '' } : null;

export const createSupabaseAuth = (): AuthService => ({
  getSession: async () => toSession((await getSupabase().auth.getSession()).data.session),
  onChange: (listener) => {
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((_e, s) => listener(toSession(s)));
    // Pause token refresh while the app is in the background.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    void supabase.auth.startAutoRefresh();
    return () => {
      data.subscription.unsubscribe();
      appState.remove();
    };
  },
  sendCode: async (email) => {
    const { error } = await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  },
  verifyCode: async (email, code) => {
    const { error } = await getSupabase().auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
  },
  refresh: async () => {
    const { data, error } = await getSupabase().auth.refreshSession();
    return error ? null : toSession(data.session);
  },
  signOut: async () => {
    await getSupabase().auth.signOut();
  },
});
