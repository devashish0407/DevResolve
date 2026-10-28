"""
DevResolve Database Models — Normalized Schema with Security

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NORMALIZATION STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3NF (Third Normal Form) for core entities:
  • users, organizations, projects, repositories
  • Every non-key attribute depends on the key, the whole key,
    and nothing but the key.

Junction tables for M:N relationships:
  • organization_members (users ↔ organizations)
  • project_members (users ↔ projects)
  • No transitive dependencies.

CONTROLLED DENORMALIZATION for read-heavy paths:
  • projects.incident_count    — avoids COUNT(*) on every dashboard load
  • projects.last_activity_at  — avoids MAX() subquery for sorting
  • conversations.message_count — avoids counting messages for each chat
  • messages.sender_display_name — avoids JOIN on every chat message render
  These are updated via application-level triggers or service hooks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECURITY PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. UUID primary keys     — non-enumerable, prevents IDOR attacks
2. Soft deletes          — deleted_at timestamp, never hard-delete user data
3. Audit columns         — created_at, updated_at on every table
4. Encrypted secrets     — API keys stored with Fernet symmetric encryption
5. Row-Level Security    — enforced via Supabase RLS policies (SQL migrations)
6. Foreign key cascades  — carefully chosen: RESTRICT for critical refs,
                           CASCADE for owned children
7. Index strategy        — covering indexes for frequent query patterns
8. Check constraints     — enum-like fields validated at DB level
"""

import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    String, Text, Boolean, Integer, Float,
    DateTime, ForeignKey, UniqueConstraint,
    CheckConstraint, Index, Enum as SAEnum,
    func, Uuid, JSON,
)

# Cross-database compatible types (PostgreSQL in production, SQLite in local zero-docker mode)
UUID = Uuid
JSONB = JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# ─────────────────────────────────────────────────────────────────
# MIXINS — reusable column sets
# ─────────────────────────────────────────────────────────────────

class TimestampMixin:
    """Audit trail columns — applied to every table."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Soft delete — mark as deleted without removing data."""
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )


# ─────────────────────────────────────────────────────────────────
# USERS — synced from Supabase Auth
# ─────────────────────────────────────────────────────────────────

class User(TimestampMixin, SoftDeleteMixin, Base):
    """
    User accounts. The auth_id maps to Supabase Auth user UUID.
    
    Normalization: 1NF — atomic values, no repeating groups.
    The user's memberships are in separate junction tables.
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    auth_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False,
        comment="Supabase Auth user UUID — foreign identity reference"
    )
    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False,
        comment="RFC 5321 max email length"
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    
    # Preferences (JSONB for flexible schema without extra table)
    preferences: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # ── Relationships ──
    organization_memberships: Mapped[List["OrganizationMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    project_memberships: Mapped[List["ProjectMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        back_populates="user"
    )

    __table_args__ = (
        Index("ix_users_auth_id", "auth_id"),
        Index("ix_users_email", "email"),
        Index("ix_users_not_deleted", "is_deleted",
              postgresql_where="is_deleted = false"),
    )


# ─────────────────────────────────────────────────────────────────
# ORGANIZATIONS — multi-tenancy boundary
# ─────────────────────────────────────────────────────────────────

class Organization(TimestampMixin, SoftDeleteMixin, Base):
    """
    Organization/team — the top-level tenant boundary.
    All projects belong to exactly one organization.
    
    Normalization: 2NF — no partial dependencies on composite keys.
    """
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(80), unique=True, nullable=False,
        comment="URL-safe unique identifier"
    )
    logo_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    # ── Relationships ──
    members: Mapped[List["OrganizationMember"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    projects: Mapped[List["Project"]] = relationship(
        back_populates="organization"
    )

    __table_args__ = (
        Index("ix_organizations_slug", "slug"),
    )


# ─────────────────────────────────────────────────────────────────
# ORGANIZATION MEMBERS — junction table (M:N normalized)
# ─────────────────────────────────────────────────────────────────

class OrganizationMember(TimestampMixin, Base):
    """
    Junction table: users ↔ organizations with role.
    
    Normalization: resolves M:N into two 1:N relationships.
    Role is an attribute of the relationship, not of user or org.
    """
    __tablename__ = "organization_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="member",
        comment="owner | admin | member | viewer"
    )

    # ── Relationships ──
    user: Mapped["User"] = relationship(back_populates="organization_memberships")
    organization: Mapped["Organization"] = relationship(back_populates="members")

    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_org_member"),
        CheckConstraint(
            "role IN ('owner', 'admin', 'member', 'viewer')",
            name="ck_org_member_role"
        ),
        Index("ix_org_members_user", "user_id"),
        Index("ix_org_members_org", "organization_id"),
    )


# ─────────────────────────────────────────────────────────────────
# PROJECTS — investigation workspace
# ─────────────────────────────────────────────────────────────────

class Project(TimestampMixin, SoftDeleteMixin, Base):
    """
    A project groups repositories, conversations and incidents.
    Belongs to exactly one organization (1:N — normalized).
    
    DENORMALIZED fields:
      • incident_count   — avoids COUNT(*) on dashboard queries
      • last_activity_at — avoids MAX(updated_at) subquery for sorting
    These are maintained by the application service layer.
    """
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        comment="RESTRICT: cannot delete org while projects exist"
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)

    # ── Denormalized counters (updated by service layer) ──
    incident_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    open_incident_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_activity_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ──
    organization: Mapped["Organization"] = relationship(back_populates="projects")
    members: Mapped[List["ProjectMember"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    repositories: Mapped[List["Repository"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    conversations: Mapped[List["Conversation"]] = relationship(
        back_populates="project"
    )
    integrations: Mapped[List["Integration"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_project_org_slug"),
        Index("ix_projects_org", "organization_id"),
        Index("ix_projects_last_activity", "last_activity_at"),
        Index("ix_projects_not_deleted", "organization_id", "is_deleted",
              postgresql_where="is_deleted = false"),
    )


# ─────────────────────────────────────────────────────────────────
# PROJECT MEMBERS — junction table with RBAC
# ─────────────────────────────────────────────────────────────────

class ProjectMember(TimestampMixin, Base):
    """
    Junction table: users ↔ projects with role.
    Separate from org membership — a user might be in the org
    but only have access to specific projects.
    
    Security: this is the authorization check point.
    """
    __tablename__ = "project_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="member",
        comment="owner | admin | member | viewer"
    )

    # ── Relationships ──
    user: Mapped["User"] = relationship(back_populates="project_memberships")
    project: Mapped["Project"] = relationship(back_populates="members")

    __table_args__ = (
        UniqueConstraint("user_id", "project_id", name="uq_project_member"),
        CheckConstraint(
            "role IN ('owner', 'admin', 'member', 'viewer')",
            name="ck_project_member_role"
        ),
        Index("ix_project_members_user", "user_id"),
        Index("ix_project_members_project", "project_id"),
    )


# ─────────────────────────────────────────────────────────────────
# REPOSITORIES — connected source code
# ─────────────────────────────────────────────────────────────────

class Repository(TimestampMixin, Base):
    """
    A connected GitHub (or other) repository.
    1:N with Project — each repo belongs to one project.
    
    The github_installation_id and access token are separate
    from user-level OAuth (separation of concerns).
    """
    __tablename__ = "repositories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(
        String(20), nullable=False, default="github",
        comment="github | gitlab | bitbucket"
    )
    owner: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    full_name: Mapped[str] = mapped_column(
        String(301), nullable=False,
        comment="owner/name — used for API calls"
    )
    default_branch: Mapped[str] = mapped_column(String(100), default="main")
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Indexing status
    last_indexed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_indexed_commit: Mapped[Optional[str]] = mapped_column(
        String(40), nullable=True,
        comment="SHA of last indexed commit"
    )
    indexing_status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="pending | indexing | indexed | failed"
    )

    # ── Relationships ──
    project: Mapped["Project"] = relationship(back_populates="repositories")
    documents: Mapped[List["Document"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("project_id", "full_name", name="uq_repo_project"),
        CheckConstraint(
            "provider IN ('github', 'gitlab', 'bitbucket')",
            name="ck_repo_provider"
        ),
        CheckConstraint(
            "indexing_status IN ('pending', 'indexing', 'indexed', 'failed')",
            name="ck_repo_indexing_status"
        ),
        Index("ix_repos_project", "project_id"),
    )


# ─────────────────────────────────────────────────────────────────
# DOCUMENTS — ingested source files, logs, docs
# ─────────────────────────────────────────────────────────────────

class Document(TimestampMixin, Base):
    """
    A source document that has been ingested for RAG.
    Could be a code file, log file, documentation page, etc.
    
    Normalization: document metadata is separated from chunks.
    The document stores the source identity; chunks store content.
    """
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    repository_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=True,
        comment="NULL for uploaded docs not from a repo"
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # Source identity
    source_type: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="code | log | documentation | config | test | other"
    )
    file_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True,
        comment="Programming language or format"
    )
    commit_sha: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    
    # Content hash for deduplication
    content_hash: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="SHA-256 of content — skip re-indexing unchanged files"
    )
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)

    # ── Document Lifecycle & Retention Mode ────────────────────────
    retention_mode: Mapped[str] = mapped_column(
        String(20), default="temporary", nullable=False,
        comment="temporary (auto-expires in 5 days) | persistent (kept until deleted)"
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Timestamp when temporary document and its embeddings auto-expire"
    )
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Relationships ──
    repository: Mapped[Optional["Repository"]] = relationship(back_populates="documents")
    chunks: Mapped[List["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('code', 'log', 'documentation', 'config', 'test', 'other')",
            name="ck_doc_source_type"
        ),
        Index("ix_documents_project", "project_id"),
        Index("ix_documents_repo", "repository_id"),
        Index("ix_documents_content_hash", "content_hash"),
        Index("ix_documents_file_path", "project_id", "file_path"),
    )


# ─────────────────────────────────────────────────────────────────
# DOCUMENT CHUNKS — RAG search targets with embeddings
# ─────────────────────────────────────────────────────────────────

class DocumentChunk(TimestampMixin, Base):
    """
    A chunk of a document, with its embedding vector stored in pgvector.
    
    This is the fundamental unit of RAG retrieval.
    Metadata preserved: file path, line range, language, commit SHA.
    
    The embedding column uses pgvector's Vector type.
    Indexes use IVFFlat or HNSW for approximate nearest neighbor search.
    """
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        comment="Denormalized from document for direct project-scoped queries"
    )
    
    # Content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Position within the parent document"
    )
    
    # Source location metadata
    start_line: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    end_line: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Chunk type for AST-aware chunking
    chunk_type: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True,
        comment="function | class | method | block | section | log_event"
    )
    symbol_name: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True,
        comment="Function/class name for code chunks"
    )
    
    # Token count for context window management
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    # The embedding vector — stored via pgvector extension
    # Actual column created in migration with:
    #   Column('embedding', Vector(1536))
    # Not declared here because Vector type needs pgvector import in migration

    # Full-text search vector — populated by PostgreSQL trigger
    # tsvector column for hybrid search (keyword + semantic)

    # ── Relationships ──
    document: Mapped["Document"] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_document", "document_id"),
        Index("ix_chunks_project", "project_id"),
        Index("ix_chunks_symbol", "symbol_name",
              postgresql_where="symbol_name IS NOT NULL"),
        # pgvector HNSW index created in migration:
        #   CREATE INDEX ix_chunks_embedding ON document_chunks
        #   USING hnsw (embedding vector_cosine_ops);
        # Full-text search GIN index created in migration:
        #   CREATE INDEX ix_chunks_fts ON document_chunks
        #   USING gin (search_vector);
    )


# ─────────────────────────────────────────────────────────────────
# CONVERSATIONS — investigation sessions
# ─────────────────────────────────────────────────────────────────

class Conversation(TimestampMixin, SoftDeleteMixin, Base):
    """
    An investigation conversation/session.
    
    DENORMALIZED: message_count avoids COUNT(*) for display.
    """
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    title: Mapped[str] = mapped_column(
        String(300), nullable=False,
        default="New Investigation"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active",
        comment="active | investigating | resolved | archived"
    )
    severity: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="critical | high | medium | low"
    )
    
    # ── Retention & Storage Lifecycle ──
    retention_mode: Mapped[str] = mapped_column(
        String(20), default="persistent", nullable=False,
        comment="persistent (kept until deleted) | temporary (auto-expire)"
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="Expiration timestamp for temporary chats"
    )
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # ── Denormalized ──
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_message_preview: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True,
        comment="First 200 chars of last message for list previews"
    )

    # ── Relationships ──
    user: Mapped["User"] = relationship(back_populates="conversations")
    project: Mapped["Project"] = relationship(back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan",
        order_by="Message.sequence_number"
    )
    investigation_report: Mapped[Optional["InvestigationReport"]] = relationship(
        back_populates="conversation", uselist=False
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'investigating', 'resolved', 'archived')",
            name="ck_conv_status"
        ),
        Index("ix_conversations_user", "user_id"),
        Index("ix_conversations_project", "project_id"),
        Index("ix_conversations_status", "project_id", "status"),
        Index("ix_conversations_recent", "project_id", "last_message_at"),
    )


# ─────────────────────────────────────────────────────────────────
# MESSAGES — individual chat messages
# ─────────────────────────────────────────────────────────────────

class Message(TimestampMixin, Base):
    """
    A single message within a conversation.
    
    DENORMALIZED: sender_display_name avoids JOIN with users
    on every chat render (critical for performance).
    
    sequence_number ensures ordering even with identical timestamps.
    """
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # Sender
    role: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="user | assistant | system | tool"
    )
    sender_display_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="DENORMALIZED: avoids user JOIN for chat rendering"
    )
    
    # Content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="text",
        comment="text | markdown | code | diff | error"
    )
    
    # Ordering
    sequence_number: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Monotonic sequence for deterministic ordering"
    )
    
    # Metadata for tool calls and evidence
    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True,
        comment="Tool call params, evidence refs, model info"
    )
    
    # Token usage tracking
    token_count_input: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    token_count_output: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ── Relationships ──
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    sources: Mapped[List["MessageSource"]] = relationship(
        back_populates="message", cascade="all, delete-orphan",
        order_by="MessageSource.created_at"
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'assistant', 'system', 'tool')",
            name="ck_message_role"
        ),
        UniqueConstraint(
            "conversation_id", "sequence_number",
            name="uq_message_sequence"
        ),
        Index("ix_messages_conversation_seq", "conversation_id", "sequence_number"),
    )


# ─────────────────────────────────────────────────────────────────
# MESSAGE SOURCES — decoupled references to RAG documents & chunks
# ─────────────────────────────────────────────────────────────────

class MessageSource(TimestampMixin, Base):
    """
    Decoupled reference linking a message to a retrieved document chunk.
    
    DECOUPLING GUARANTEE:
    A chat message refers to a document chunk without owning the content.
    When a temporary document expires after 5 days:
    - The document and its chunks/embeddings are deleted.
    - The message history remains intact.
    - The message_source is marked is_source_available = False with
      retention_notice = "Source Document Expired (5-day temporary analysis policy)".
    """
    __tablename__ = "message_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Nullified if the underlying document expires or is deleted"
    )
    chunk_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Nullified if chunk is deleted"
    )
    
    source_title: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Document name or file path preserved even if document is purged"
    )
    chunk_snippet: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Brief citation snippet (up to 300 chars) preserved for context"
    )
    relevance_score: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True,
        comment="RAG hybrid cosine/keyword similarity score"
    )
    is_source_available: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
        comment="Set to False when underlying document expires or is purged"
    )
    retention_notice: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, default="Active Source",
        comment="Status message e.g. Active or Expired per 5-day policy"
    )

    # ── Relationships ──
    message: Mapped["Message"] = relationship(back_populates="sources")
    document: Mapped[Optional["Document"]] = relationship()
    chunk: Mapped[Optional["DocumentChunk"]] = relationship()

    __table_args__ = (
        Index("ix_message_sources_msg", "message_id"),
        Index("ix_message_sources_doc", "document_id"),
    )


# ─────────────────────────────────────────────────────────────────
# INVESTIGATION REPORTS — structured findings
# ─────────────────────────────────────────────────────────────────

class InvestigationReport(TimestampMixin, Base):
    """
    Structured investigation report — the final output.
    1:1 with Conversation.
    
    Uses JSONB for flexible nested data (evidence citations,
    test results) that doesn't warrant its own normalized table.
    """
    __tablename__ = "investigation_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    
    # Diagnosis
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_level: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="verified | high | medium | low | unverified"
    )
    
    # Evidence (JSONB — flexible, nested, variable-length)
    evidence_citations: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True,
        comment="Array of {file, lines, content, relevance_score}"
    )
    files_involved: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True,
        comment="Array of file paths with line ranges"
    )
    
    # Proposed fix
    proposed_patch: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Unified diff format"
    )
    patch_language: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    
    # Test results (JSONB — variable structure per test runner)
    test_results: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True,
        comment="{status, exit_code, stdout, stderr, duration_ms, tests_passed, tests_failed}"
    )
    test_status: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="passed | failed | error | timeout | not_run"
    )
    
    # Recommendations
    next_steps: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    uncertainties: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    # ── Relationships ──
    conversation: Mapped["Conversation"] = relationship(
        back_populates="investigation_report"
    )

    __table_args__ = (
        CheckConstraint(
            "confidence_level IS NULL OR confidence_level IN "
            "('verified', 'high', 'medium', 'low', 'unverified')",
            name="ck_report_confidence"
        ),
        Index("ix_reports_conversation", "conversation_id"),
    )


# ─────────────────────────────────────────────────────────────────
# INTEGRATIONS — external service connections
# ─────────────────────────────────────────────────────────────────

class Integration(TimestampMixin, Base):
    """
    Connected external services (GitHub, Sentry, Datadog, etc.)
    
    Security: access tokens are encrypted at rest using Fernet.
    The encrypted_credentials column NEVER stores plaintext secrets.
    Decryption happens only in the service layer, never exposed via API.
    """
    __tablename__ = "integrations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    provider: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="github | sentry | datadog | confluence | notion | custom_mcp"
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Encrypted credentials — Fernet symmetric encryption
    encrypted_credentials: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True,
        comment="Fernet-encrypted JSON blob of tokens/keys — NEVER plaintext"
    )
    
    # Configuration (non-secret settings)
    config: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True,
        comment="Non-secret settings: webhook URLs, scopes, filters"
    )
    
    # Sync status
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="syncing | synced | failed"
    )

    # ── Relationships ──
    project: Mapped["Project"] = relationship(back_populates="integrations")

    __table_args__ = (
        UniqueConstraint("project_id", "provider", name="uq_integration_provider"),
        CheckConstraint(
            "provider IN ('github', 'sentry', 'datadog', 'confluence', "
            "'notion', 'custom_mcp')",
            name="ck_integration_provider"
        ),
        Index("ix_integrations_project", "project_id"),
    )


# ─────────────────────────────────────────────────────────────────
# TOOL EXECUTIONS — audit log of agent actions
# ─────────────────────────────────────────────────────────────────

class ToolExecution(TimestampMixin, Base):
    """
    Audit log of every tool call made by the AI agent.
    
    This serves both observability AND security:
    • What did the agent do and when?
    • What data did it access?
    • How long did it take?
    
    JSONB for inputs/outputs — structure varies by tool.
    """
    __tablename__ = "tool_executions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    tool_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="search_code | read_file | run_tests | search_logs | etc."
    )
    tool_input: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    tool_output: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending",
        comment="pending | running | success | error | timeout"
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Performance tracking
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'running', 'success', 'error', 'timeout')",
            name="ck_tool_status"
        ),
        Index("ix_tool_exec_conversation", "conversation_id"),
        Index("ix_tool_exec_tool", "tool_name"),
        Index("ix_tool_exec_status", "status",
              postgresql_where="status IN ('pending', 'running')"),
    )


# ─────────────────────────────────────────────────────────────────
# API KEYS — user-managed secrets
# ─────────────────────────────────────────────────────────────────

class ApiKey(TimestampMixin, Base):
    """
    User's API keys for LLM providers.
    
    Security:
    • key_encrypted: Fernet-encrypted, never stored in plaintext
    • key_prefix: first 8 chars for display (sk-proj-xxxx****)
    • key_hash: SHA-256 for lookup without decryption
    """
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    provider: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="openai | anthropic | google"
    )
    label: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Default"
    )
    
    # Encrypted storage
    key_encrypted: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Fernet-encrypted API key — NEVER plaintext"
    )
    key_prefix: Mapped[str] = mapped_column(
        String(12), nullable=False,
        comment="First 8 chars for display: sk-proj-xxxx"
    )
    key_hash: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="SHA-256 hash for lookup without decryption"
    )
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_api_keys_user", "user_id"),
        Index("ix_api_keys_hash", "key_hash"),
    )
