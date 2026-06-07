/**
 * Browser Supabase client — owns session storage and token refresh.
 *
 * Use this everywhere the SPA needs the current user, the access token (for
 * forwarding to FastAPI), or auth state changes. Backend privileged work uses
 * the Python service-role client in ``backend/app/database/supabase.py`` and
 * never goes through here.
 */

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Current access token, or null if no session. Used by the http wrapper. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
