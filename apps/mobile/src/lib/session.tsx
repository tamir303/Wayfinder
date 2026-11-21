import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, type AuthSession } from './auth';

type SessionState = { session: AuthSession | null; loading: boolean };

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    void auth.getSession().then((session) => setState({ session, loading: false }));
    return auth.onChange((session) => setState({ session, loading: false }));
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionState => useContext(SessionContext);
