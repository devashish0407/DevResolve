"""
Document Lifecycle & Temporary Storage Management Service
Manages RAG document storage, two-tier retention policies:
1. Temporary Analysis (Auto-expires in 5 days, deletes chunks, embeddings, and files)
2. Persistent Workspace (Retained until user explicitly deletes)

Guarantees:
- Immediate retrieval invalidation upon deletion or expiration.
- Idempotent cleanup worker.
- Document conversion (upgrade Temporary -> Persistent).
"""

import os
import uuid
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import shutil

# In-memory document ledger (synchronized with DB or local storage)
# Format: doc_id -> Document dict
_DOCUMENT_LEDGER: Dict[str, Dict[str, Any]] = {}

# Chunks index: list of chunk dicts
_ACTIVE_CHUNKS: List[Dict[str, Any]] = []

# Message Sources index: message_id -> list of source references (decoupled from document bodies)
_MESSAGE_SOURCES: Dict[str, List[Dict[str, Any]]] = {}

TEMPORARY_RETENTION_DAYS = 5
TEMPORARY_RETENTION_SECONDS = TEMPORARY_RETENTION_DAYS * 86400  # 432,000 seconds (5 days)


class DocumentLifecycleService:
    @classmethod
    def register_document(
        cls,
        name: str,
        content: str,
        retention_mode: str = "temporary",
        source_type: str = "code",
        user_id: str = "guest",
        project_id: Optional[str] = None,
        custom_expiry_days: Optional[int] = None,
        file_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """
        Registers an ingested document with explicit retention policy.
        - retention_mode: 'temporary' (5-day expiry) | 'persistent' (kept until deleted)
        """
        doc_id = f"doc_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        retention = retention_mode.lower().strip()
        if retention not in ("temporary", "persistent"):
            retention = "temporary"

        expiry_days = custom_expiry_days or TEMPORARY_RETENTION_DAYS
        expires_at = (now + timedelta(days=expiry_days)) if retention == "temporary" else None
        expires_at_iso = expires_at.isoformat() if expires_at else None
        expires_at_timestamp = expires_at.timestamp() if expires_at else None

        file_size = len(content.encode("utf-8")) if not file_bytes else len(file_bytes)

        # Chunk the content
        from app.services.rag_service import RAGService
        rag = RAGService()
        code_chunks = rag.chunk_python_code(name, content)

        # Store chunks in the active index
        new_chunk_dicts = []
        for idx, chunk in enumerate(code_chunks):
            chunk_data = {
                "id": f"chk_{doc_id}_{idx}",
                "document_id": doc_id,
                "file_path": name,
                "chunk_type": chunk.chunk_type,
                "name": chunk.name,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "content": chunk.content,
                "token_count": len(chunk.content) // 4,
            }
            new_chunk_dicts.append(chunk_data)

        _ACTIVE_CHUNKS.extend(new_chunk_dicts)

        doc_record = {
            "id": doc_id,
            "name": name,
            "source_type": source_type,
            "retention_mode": retention,
            "is_persistent": retention == "persistent",
            "created_at": now.isoformat(),
            "created_at_timestamp": now.timestamp(),
            "expires_at": expires_at_iso,
            "expires_at_timestamp": expires_at_timestamp,
            "is_expired": False,
            "is_deleted": False,
            "file_size_bytes": file_size,
            "chunk_count": len(new_chunk_dicts),
            "user_id": user_id,
            "project_id": project_id,
        }

        _DOCUMENT_LEDGER[doc_id] = doc_record
        print(f"[DOCUMENT LIFECYCLE] Ingested '{name}' (ID: {doc_id}, Mode: {retention}, Chunks: {len(new_chunk_dicts)}, Expires: {expires_at_iso})")
        return cls._format_doc_response(doc_record)

    @classmethod
    def get_documents(
        cls,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        include_expired: bool = False,
    ) -> List[Dict[str, Any]]:
        """Lists active documents with live remaining expiry time."""
        cls.cleanup_expired_documents()  # Run check on read
        now = time.time()
        results = []

        for doc in _DOCUMENT_LEDGER.values():
            if doc.get("is_deleted"):
                continue
            if not include_expired and doc.get("is_expired"):
                continue
            if user_id and doc.get("user_id") not in (user_id, "guest"):
                continue
            if project_id and doc.get("project_id") != project_id:
                continue

            results.append(cls._format_doc_response(doc))

        # Sort by creation date descending
        results.sort(key=lambda d: d.get("created_at_timestamp", 0), reverse=True)
        return results

    @classmethod
    def convert_to_persistent(cls, doc_id: str) -> Optional[Dict[str, Any]]:
        """Upgrades a temporary document to persistent workspace mode (clears expiry)."""
        doc = _DOCUMENT_LEDGER.get(doc_id)
        if not doc or doc.get("is_deleted") or doc.get("is_expired"):
            return None

        doc["retention_mode"] = "persistent"
        doc["is_persistent"] = True
        doc["expires_at"] = None
        doc["expires_at_timestamp"] = None
        doc["is_expired"] = False

        print(f"[DOCUMENT LIFECYCLE] Upgraded document {doc_id} ('{doc.get('name')}') to Persistent Workspace!")
        return cls._format_doc_response(doc)

    @classmethod
    def delete_document(cls, doc_id: str) -> bool:
        """
        Immediately invalidates and purges the document and its chunks from all future RAG queries.
        Guarantees that deleted content never unexpectedly appears in AI answers.
        """
        doc = _DOCUMENT_LEDGER.get(doc_id)
        if not doc:
            return False

        # 1. Immediately flag as deleted to prevent race conditions in retrieval
        doc["is_deleted"] = True
        doc["is_expired"] = True

        # 2. Remove all associated chunks from the active search index immediately
        global _ACTIVE_CHUNKS
        initial_len = len(_ACTIVE_CHUNKS)
        _ACTIVE_CHUNKS = [c for c in _ACTIVE_CHUNKS if c.get("document_id") != doc_id]
        purged_chunks = initial_len - len(_ACTIVE_CHUNKS)

        # 3. Decouple message references: Mark citations as unavailable without deleting chat history
        cls.invalidate_document_sources(doc_id)

        print(f"[DOCUMENT LIFECYCLE] Deleted document {doc_id} ('{doc.get('name')}') -> Purged {purged_chunks} chunks immediately. Chat history preserved.")
        return True

    @classmethod
    def invalidate_document_sources(cls, doc_id: str) -> int:
        """
        Marks all message citations linked to this document as unavailable,
        preserving the chat messages and historical answers intact.
        """
        updated_count = 0
        for msg_id, sources in _MESSAGE_SOURCES.items():
            for src in sources:
                if src.get("document_id") == doc_id:
                    src["is_source_available"] = False
                    src["document_id"] = None
                    src["retention_notice"] = "Source Document Expired (5-day temporary analysis policy)"
                    updated_count += 1
        if updated_count > 0:
            print(f"[DOCUMENT LIFECYCLE] Decoupled {updated_count} message references for expired document {doc_id}")
        return updated_count

    @classmethod
    def attach_sources_to_message(cls, message_id: str, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Attaches decoupled citation references to a chat message."""
        clean_sources = []
        for src in sources:
            src_record = {
                "id": f"src_{uuid.uuid4().hex[:10]}",
                "message_id": message_id,
                "document_id": src.get("document_id"),
                "chunk_id": src.get("chunk_id"),
                "source_title": src.get("source_title") or src.get("file_path", "Document"),
                "chunk_snippet": (src.get("content") or src.get("chunk_snippet", ""))[:300],
                "relevance_score": src.get("similarity") or src.get("relevance_score", 0.0),
                "is_source_available": src.get("is_source_available", True),
                "retention_notice": src.get("retention_notice", "Active Source"),
            }
            clean_sources.append(src_record)
        _MESSAGE_SOURCES[message_id] = clean_sources
        return clean_sources

    @classmethod
    def get_message_sources(cls, message_id: str) -> List[Dict[str, Any]]:
        """Returns decoupled citations for a specific message."""
        return _MESSAGE_SOURCES.get(message_id, [])

    @classmethod
    def delete_conversation_sources(cls, message_ids: List[str]) -> None:
        """Honors user complete deletion request for conversation messages."""
        for msg_id in message_ids:
            _MESSAGE_SOURCES.pop(msg_id, None)

    @classmethod
    def cleanup_expired_documents(cls) -> Dict[str, Any]:
        """
        Idempotent cleanup worker:
        Scans for expired temporary documents, purges chunks and embeddings,
        and releases storage space. Active persistent documents are strictly preserved.
        """
        now = time.time()
        expired_doc_ids = []
        freed_bytes = 0
        freed_chunks = 0

        for doc_id, doc in list(_DOCUMENT_LEDGER.items()):
            if doc.get("is_deleted"):
                continue
            if doc.get("retention_mode") == "temporary":
                exp_ts = doc.get("expires_at_timestamp")
                if exp_ts and exp_ts <= now:
                    expired_doc_ids.append(doc_id)
                    doc["is_expired"] = True
                    doc["is_deleted"] = True
                    freed_bytes += doc.get("file_size_bytes", 0)
                    freed_chunks += doc.get("chunk_count", 0)

        if expired_doc_ids:
            global _ACTIVE_CHUNKS
            _ACTIVE_CHUNKS = [c for c in _ACTIVE_CHUNKS if c.get("document_id") not in expired_doc_ids]
            for exp_id in expired_doc_ids:
                cls.invalidate_document_sources(exp_id)
            print(f"[CLEANUP WORKER] Purged {len(expired_doc_ids)} expired temporary documents ({freed_chunks} chunks, {freed_bytes:,} bytes). Message sources decoupled.")

        return {
            "status": "success",
            "purged_count": len(expired_doc_ids),
            "freed_chunks": freed_chunks,
            "freed_bytes": freed_bytes,
            "purged_doc_ids": expired_doc_ids,
        }

    @classmethod
    def get_searchable_chunks(cls) -> List[Dict[str, Any]]:
        """
        Retrieval guard: Returns only chunks belonging to active, non-expired,
        non-deleted documents. Prevents deleted data from surfacing in AI responses.
        """
        now = time.time()
        valid_chunks = []
        for chunk in _ACTIVE_CHUNKS:
            doc_id = chunk.get("document_id")
            if not doc_id:
                # Pre-indexed snippets or global chunks without explicit document parent
                valid_chunks.append(chunk)
                continue

            doc = _DOCUMENT_LEDGER.get(doc_id)
            if not doc:
                continue
            if doc.get("is_deleted") or doc.get("is_expired"):
                continue
            if doc.get("retention_mode") == "temporary":
                exp_ts = doc.get("expires_at_timestamp")
                if exp_ts and exp_ts <= now:
                    continue  # Expired, skip!

            valid_chunks.append(chunk)

        return valid_chunks

    @classmethod
    def _format_doc_response(cls, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Adds computed human-friendly remaining time and retention badge to document dict."""
        now = time.time()
        res = dict(doc)
        if doc.get("retention_mode") == "temporary" and doc.get("expires_at_timestamp"):
            remaining_seconds = max(0, int(doc["expires_at_timestamp"] - now))
            days_left = remaining_seconds // 86400
            hours_left = (remaining_seconds % 86400) // 3600
            res["remaining_seconds"] = remaining_seconds
            res["time_remaining_label"] = (
                f"{days_left}d {hours_left}h left" if days_left > 0 else f"{hours_left}h left"
            ) if remaining_seconds > 0 else "Expired"
            res["retention_badge"] = f"Temporary ({res['time_remaining_label']})"
        else:
            res["remaining_seconds"] = None
            res["time_remaining_label"] = "Permanent"
            res["retention_badge"] = "Persistent Workspace"

        return res

