/**
 * Phase 3 tracer-bullet chat UI.
 *
 * Pipes ``useChat`` through ``DefaultChatTransport`` to the FastAPI
 * ``/chat/stream`` stub. Intentionally minimal — Phase 7 owns thread history,
 * citation rendering, error-state polish, and the real product UX.
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useSession } from "@/auth/SessionProvider";
import { Button } from "@/components/ui/button";
import { chatStreamUrl } from "@/lib/api";

/** Concatenate all text parts in a UI message — Phase 3 only emits text. */
function messageText(parts: ReadonlyArray<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
}

export function ChatPage() {
  const { session, signOut } = useSession();

  // Rebuild the transport when the access token rotates so streaming requests
  // always carry a fresh bearer.
  const transport = useMemo(() => {
    const token = session?.access_token ?? "";
    return new DefaultChatTransport({
      api: chatStreamUrl(),
      headers: () => ({
        Authorization: `Bearer ${token}`,
      }),
    });
  }, [session?.access_token]);

  const { messages, sendMessage, status, error } = useChat({ transport });

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status === "submitted" || status === "streaming";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    void sendMessage({ text });
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold">Document Copilot</h1>
          <p className="text-xs text-muted-foreground">
            {session?.user.email ?? "Signed in"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-6">
        <div className="flex-1 space-y-4 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ask a question to test the streaming round-trip. The backend is a
              Phase 3 stub — it echoes you for now.
            </p>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[80%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
                  : "mr-auto max-w-[80%] rounded-lg border border-border bg-card px-4 py-2 text-sm whitespace-pre-wrap"
              }
            >
              {messageText(m.parts)}
            </div>
          ))}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error.message}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a filing…"
            className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={busy}
          />
          <Button type="submit" disabled={busy || input.trim() === ""}>
            {busy ? "…" : "Send"}
          </Button>
        </form>
      </main>
    </div>
  );
}
