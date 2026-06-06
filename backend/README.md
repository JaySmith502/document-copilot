# Backend — Document Copilot API

FastAPI service for Document Copilot. This is a quick operational reference.
For deeper setup (migrations, Jupyter, imports) see
[../docs/guides/backend-setup.md](../docs/guides/backend-setup.md). For coding
conventions read [AGENTS.md](AGENTS.md).

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (dependency + environment manager)

## Setup

```bash
cd backend
cp .env.example .env   # then fill in real values
uv sync                # install deps + the local `app` package (editable)
```

Config is read once at startup from `.env` by `app/config.py`. Missing required
variables fail fast on boot — that's intentional, not a bug.

## Run the dev server

```bash
uv run uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000
- Health check: http://127.0.0.1:8000/health → `{"status": "ok"}`
- Interactive docs: http://127.0.0.1:8000/docs (Swagger) and `/redoc`

Direct execution also works (`uv run python app/main.py`).

## Common commands

```bash
uv sync                          # sync deps after pyproject changes
uv add <package>                 # add a runtime dependency
uv add --dev <package>           # add a dev dependency
uv run pytest                    # run the test suite
uv run pytest -m "not integration"  # fast unit tests only (no network/DB)
uv run ruff check .              # lint
uv run ruff format .             # format
```

## Configuration

`app/config.py` is the single source of truth for environment config. Import
`settings` from it; never call `os.getenv` or `load_dotenv` in app code.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase auth + API |
| `DATABASE_URL` | Direct/session Postgres connection (Alembic + DB access) |
| `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS` | LLM + embeddings |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed via CORS |

See `.env.example` for the full template.

## Project layout

```text
app/
├── main.py      # FastAPI entrypoint (app, CORS, /health, logging)
├── config.py    # Pydantic settings — single source of truth for env
└── ...           # api/, auth/, chat/, assistant/, retrieval/, grounding/, database/ (added as built)
```

## Database migrations

Schema is managed with SQLAlchemy models + Alembic (not yet initialized — see
Phase 2). Migrations must use the **direct/session** Supabase connection, not
the transaction pooler. Full workflow: [../docs/guides/backend-setup.md](../docs/guides/backend-setup.md).
