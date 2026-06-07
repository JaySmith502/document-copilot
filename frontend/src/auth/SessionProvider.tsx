/**
 * Session context — the SPA's source of truth for "is anyone logged in?".
 *
 * Subscribes to Supabase auth state once at the root and broadcasts the
 * current session + a stable ``signOut`` so child components don't each have
 * to wire their own listeners.
 */

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "@/lib/supabase";

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Hydrate from storage on mount — avoids a flash of /login for returning users.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
