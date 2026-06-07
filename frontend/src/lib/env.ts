/**
 * Validated browser-side environment.
 *
 * Imports anywhere in the SPA go through this module — never read
 * ``import.meta.env`` directly elsewhere. Missing or empty values throw at
 * module-load so we fail fast at startup instead of mid-render with a
 * confusing fetch error.
 */

type RawEnv = ImportMetaEnv & Record<string, string | undefined>;

const REQUIRED = [
  "VITE_API_BASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

function read(raw: RawEnv): Record<(typeof REQUIRED)[number], string> {
  const missing: string[] = [];
  const out = {} as Record<(typeof REQUIRED)[number], string>;
  for (const key of REQUIRED) {
    const value = raw[key];
    if (typeof value !== "string" || value.trim() === "") {
      missing.push(key);
      continue;
    }
    out[key] = value.trim();
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required frontend env vars: ${missing.join(", ")}. ` +
        `Copy frontend/.env.example to frontend/.env and fill them in.`,
    );
  }
  return out;
}

const parsed = read(import.meta.env as RawEnv);

export const env = {
  apiBaseUrl: parsed.VITE_API_BASE_URL.replace(/\/+$/, ""),
  supabaseUrl: parsed.VITE_SUPABASE_URL,
  supabaseAnonKey: parsed.VITE_SUPABASE_ANON_KEY,
} as const;

export type Env = typeof env;
