"""FastAPI auth dependency.

Verifies the request's Supabase bearer token by calling Supabase Auth's user
endpoint (GET /auth/v1/user), then exposes the authenticated user. Requests
without a valid token are rejected with 401 before any retrieval or LLM work.
"""

from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: str
    email: str | None
    access_token: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = credentials.credentials
    base = settings.supabase_url.rstrip("/")
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{base}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = response.json()
    return CurrentUser(id=user["id"], email=user.get("email"), access_token=token)
