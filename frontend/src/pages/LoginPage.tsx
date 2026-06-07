/**
 * Email + password sign-in / sign-up.
 *
 * Email+password (rather than magic links) keeps local dev frictionless — no
 * SMTP wiring needed before the tracer bullet works end-to-end. Pilot analysts
 * can later switch to whatever Supabase Auth flow product wants.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "@/auth/SessionProvider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type Mode = "sign-in" | "sign-up";

export function LoginPage() {
  const { session, loading } = useSession();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!loading && session) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation required by the Supabase project's auth config.
          setInfo("Check your inbox to confirm your email, then sign in.");
          setMode("sign-in");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Document Copilot</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "sign-in" ? "Sign in to continue." : "Create an account."}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="text-sm text-muted-foreground" role="status">
            {info}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Working…" : mode === "sign-in" ? "Sign in" : "Sign up"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
            setInfo(null);
          }}
          className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "sign-in"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
