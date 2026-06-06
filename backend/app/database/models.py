"""SQLAlchemy models — the source of truth for the Document Copilot schema.

Alembic autogenerate reads Base.metadata from this module. Postgres and Supabase
specific objects that autogenerate cannot infer reliably — the vector extension,
the generated tsvector search column, HNSW and GIN indexes, and RLS policies —
are written explicitly in the migration, not here.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Must match OPENAI_EMBEDDING_DIMENSIONS in app/config.py and the vector column
# created in the migration. Changing it requires a new migration.
EMBEDDING_DIM = 1536


class Base(DeclarativeBase):
    pass


def uuid_pk():
    return mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    # Equals Supabase auth.users.id; supplied on insert, not generated here.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)

    threads: Mapped[list[ChatThread]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class ChatThread(Base, TimestampMixin):
    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(Text)

    owner: Mapped[User] = relationship(back_populates="threads")
    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = uuid_pk()
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # "user" or "assistant"; validated at the API boundary, not by the database.
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional AI SDK-compatible message JSON when the raw shape is worth keeping.
    message_json: Mapped[dict | None] = mapped_column(JSONB)

    thread: Mapped[ChatThread] = relationship(back_populates="messages")
    citations: Mapped[list[MessageCitation]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class MessageCitation(Base, TimestampMixin):
    __tablename__ = "message_citations"

    id: Mapped[uuid.UUID] = uuid_pk()
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Exact passage span the assistant cited, when narrower than the whole chunk.
    quote: Mapped[str | None] = mapped_column(Text)

    message: Mapped[ChatMessage] = relationship(back_populates="citations")
    chunk: Mapped[DocumentChunk] = relationship()


class SourceDocument(Base, TimestampMixin):
    __tablename__ = "source_documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    ticker: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(Text, nullable=False)
    filing_type: Mapped[str] = mapped_column(String(16), nullable=False)
    filing_date: Mapped[date] = mapped_column(Date, nullable=False)
    fiscal_year: Mapped[int] = mapped_column(Integer, nullable=False)
    accession_number: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    # Normalized Markdown of the filing, so chunks can be regenerated and cited
    # without reaching back into the downloaded HTML.
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)

    chunks: Mapped[list[DocumentChunk]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentChunk.chunk_index",
    )


class DocumentChunk(Base, TimestampMixin):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_doc_idx"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer)
    page: Mapped[int | None] = mapped_column(Integer)
    section: Mapped[str | None] = mapped_column(Text)
    # Retrieval-time filters and display: ticker, company, filing_type,
    # filing_date, year, accession_number, page, section, source offsets.
    chunk_metadata: Mapped[dict | None] = mapped_column(JSONB)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    # search_vector (generated tsvector) plus the HNSW and GIN indexes are added
    # explicitly in the migration, not declared here.

    document: Mapped[SourceDocument] = relationship(back_populates="chunks")
