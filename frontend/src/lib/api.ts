/**
 * Typed API surface for the FastAPI backend.
 *
 * Phase 3 has only the chat stream endpoint — threads/messages CRUD lands in
 * Phase 7 alongside the history UI. Add helpers here as endpoints come online
 * so call sites stay free of URL strings.
 */

import { env } from "@/lib/env";

/** Absolute URL passed to the AI SDK's ``DefaultChatTransport``. */
export const chatStreamUrl = (): string => `${env.apiBaseUrl}/chat/stream`;
