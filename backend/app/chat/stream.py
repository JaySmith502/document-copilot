"""POST /chat/stream — Phase 3 tracer-bullet stub.

Emits an echoed reply using the AI SDK v6 UI message stream protocol so the
frontend's ``useChat`` hook can consume it unchanged once the real PydanticAI
agent replaces this stub in Phase 6.

Wire format (Server-Sent Events, ``text/event-stream``):
    data: {"type":"start"}\\n\\n
    data: {"type":"text-start","id":"<id>"}\\n\\n
    data: {"type":"text-delta","id":"<id>","delta":"..."}\\n\\n
    ... more text-delta ...
    data: {"type":"text-end","id":"<id>"}\\n\\n
    data: {"type":"finish"}\\n\\n
    data: [DONE]\\n\\n
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict

from app.auth.dependencies import CurrentUser, get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


class _ChatRequest(BaseModel):
    """Permissive shape — ``useChat`` posts ``{ id, messages, trigger, ... }``.

    We only need ``messages`` for the stub; ignore the rest so frontend version
    bumps don't break the contract.
    """

    model_config = ConfigDict(extra="allow")

    messages: list[dict[str, Any]] = []


def _last_user_text(messages: list[dict[str, Any]]) -> str:
    """Pull the text from the most recent user message's parts array."""
    for msg in reversed(messages):
        if msg.get("role") != "user":
            continue
        parts = msg.get("parts") or []
        chunks = [p.get("text", "") for p in parts if p.get("type") == "text"]
        text = "".join(chunks).strip()
        if text:
            return text
    return ""


def _sse(part: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(part, separators=(',', ':'))}\n\n".encode()


async def _stub_stream(prompt: str, user_id: str) -> AsyncIterator[bytes]:
    """Stream an echoed reply word-by-word as AI SDK UI message parts."""
    text_id = f"txt_{uuid.uuid4().hex[:12]}"
    reply = (
        f"(stub) You said: {prompt}\n\n"
        "Phase 3 tracer bullet — auth + streaming work end-to-end. "
        "Retrieval and the grounded agent arrive in Phase 6."
    ) if prompt else "(stub) Hello — I didn't see a message in your turn."

    yield _sse({"type": "start"})
    yield _sse({"type": "text-start", "id": text_id})

    # Stream word-by-word so the UI visibly tokenizes.
    for i, word in enumerate(reply.split(" ")):
        delta = word if i == 0 else " " + word
        yield _sse({"type": "text-delta", "id": text_id, "delta": delta})
        await asyncio.sleep(0.02)

    yield _sse({"type": "text-end", "id": text_id})
    yield _sse({"type": "finish"})
    yield b"data: [DONE]\n\n"


@router.post("/stream")
async def chat_stream(
    body: _ChatRequest,
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    prompt = _last_user_text(body.messages)
    return StreamingResponse(
        _stub_stream(prompt, user.id),
        media_type="text/event-stream",
        headers={
            # Hint to the AI SDK that this is the v1 UI message stream protocol.
            "x-vercel-ai-ui-message-stream": "v1",
            # Disable buffering on proxies that otherwise hold SSE chunks.
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
