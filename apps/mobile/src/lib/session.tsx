import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

type SessionState = { session: Session | null; loading: boolean };

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ session, loading: false }),
    );

    // Pause token refresh while the app is in the background.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    void supabase.auth.startAutoRefresh();

    return () => {
      subscription.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionState => useContext(SessionContext);
