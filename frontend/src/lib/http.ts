/**
 * Typed fetch wrapper for the FastAPI backend.
 *
 * Responsibilities:
 *   - Resolve relative paths against ``VITE_API_BASE_URL``.
 *   - Inject the current Supabase access token as a bearer header.
 *   - Distinguish network/CORS failures (``NetworkError``) from HTTP errors
 *     (``HttpError``) so the UI can render the right message.
 *
 * The chat stream is consumed via the AI SDK's transport (which needs a raw
 * ``fetch``) — use ``authHeaders()`` there instead of ``apiFetch``.
 */

import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/supabase";

export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NetworkError";
  }
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Bearer + JSON headers for fetch calls that bypass ``apiFetch`` (e.g. SSE). */
export async function authHeaders(
  extra?: HeadersInit,
): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (extra) Object.assign(headers, Object.fromEntries(new Headers(extra)));
  return headers;
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: HeadersInit;
  /** When true, return the raw Response instead of parsing JSON. */
  raw?: boolean;
}

/** Typed JSON fetch. Returns parsed body for 2xx, throws ``HttpError`` otherwise. */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { raw, headers, ...rest } = options;
  const merged = await authHeaders(headers);

  let response: Response;
  try {
    response = await fetch(resolveUrl(path), { ...rest, headers: merged });
  } catch (cause) {
    // fetch() only rejects for network / CORS failures, not HTTP status codes.
    throw new NetworkError(
      "Could not reach the API. Check your connection or CORS settings.",
      { cause },
    );
  }

  if (raw) return response as unknown as T;

  const text = await response.text();
  const body: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    const message = extractErrorMessage(body) ?? `HTTP ${response.status}`;
    throw new HttpError(response.status, message, body);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (body && typeof body === "object") {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first === "object" && "msg" in first) {
        return String((first as { msg: unknown }).msg);
      }
    }
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return null;
}
