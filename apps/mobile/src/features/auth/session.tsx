import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { purchases } from '@/lib/purchases';
import { track } from '@/lib/track';
import { supabase } from '@/lib/supabase';

type SessionState = { session: Session | null; isLoading: boolean };

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, isLoading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, isLoading: false });
      // RevenueCat'in appUserID'si Supabase kullanıcı kimliğidir; webhook krediyi bu
      // kimliğe yazar. Anahtar yoksa katman sessizce devre dışı kalır (D1).
      void (session ? purchases.configure(session.user.id) : purchases.signOut()).catch(() => {});

      // Ölçüm (E4): kimlik Supabase kullanıcı kimliği; e-posta gönderilmez.
      if (session) {
        track.identify(session.user.id);
        track.capture('signed_in');
      } else {
        track.reset();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
