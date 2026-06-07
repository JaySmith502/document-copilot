"""Supabase client construction.

Two client kinds, matching the architecture security boundary:

- admin_client(): uses the service-role key and bypasses RLS. Backend-only
  privileged work (reading the deny-all corpus tables, persisting chat records).
  Never exposed to the browser.
- user_client(access_token): uses the anon key plus the caller's JWT, so
  PostgREST runs as that user and RLS is enforced.
"""

from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from app.config import settings


@lru_cache(maxsize=1)
def admin_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def user_client(access_token: str) -> Client:
    options = ClientOptions(
        headers={"Authorization": f"Bearer {access_token}"},
        auto_refresh_token=False,
        persist_session=False,
    )
    return create_client(settings.supabase_url, settings.supabase_anon_key, options)
