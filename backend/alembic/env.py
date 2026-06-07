"""Alembic environment, wired to the app settings and SQLAlchemy metadata.

The database URL comes from app.config.settings (not alembic.ini) and is
normalized to the psycopg v3 driver. Use the direct or session-pooler Supabase
connection here, never the transaction pooler (port 6543).
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Objects created and owned by migrations, not by the SQLAlchemy models:
# the generated tsvector column and the HNSW/GIN indexes. Autogenerate must
# leave them alone instead of proposing to drop them on future revisions.
# (RLS policies and the vector extension are not tracked by autogenerate.)
MANUAL_INDEXES = {
    "ix_document_chunks_embedding",
    "ix_document_chunks_search_vector",
    "ix_document_chunks_metadata",
}
MANUAL_COLUMNS = {
    ("document_chunks", "search_vector"),
}


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    if type_ == "index" and name in MANUAL_INDEXES:
        return False
    if type_ == "column" and (getattr(obj.table, "name", None), name) in MANUAL_COLUMNS:
        return False
    return True


def _database_url() -> str:
    url = settings.database_url
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
