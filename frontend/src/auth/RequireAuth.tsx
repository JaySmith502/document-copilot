/**
 * Route guard — redirects unauthenticated visitors to /login.
 *
 * Waits for the initial session hydration so we never bounce a logged-in user
 * to /login on a hard refresh.
 */

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "@/auth/SessionProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
