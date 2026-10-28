"""
Conversations API Routes
Manages incident investigations, message sequencing,
and real-time SSE streaming for live AI agent investigations.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.services.auth_service import AuthService
from app.services.conversation_service import ConversationService
from app.services.investigation_service import InvestigationAgentService
from app.schemas.conversation import (
    ConversationCreate, ConversationResponse, ConversationDetailResponse,
    ConversationListResponse, MessageCreate, MessageResponse
)


router = APIRouter()


@router.get("", response_model=ConversationListResponse, summary="List investigations")
async def list_conversations(
    project_id: Optional[uuid.UUID] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List investigations, optionally filtered by project_id."""
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    conv_service = ConversationService(db)
    convs = await conv_service.list_conversations(user_id=user.id, project_id=project_id)

    return ConversationListResponse(
        conversations=[
            ConversationResponse(
                id=c.id,
                project_id=c.project_id,
                project_name=c.project.name if c.project else "Main Workspace",
                creator_id=c.user_id,
                title=c.title,
                status=c.status,
                severity=c.severity,
                message_count=c.message_count,
                last_message_at=c.last_message_at,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in convs
        ],
        total=len(convs),
    )


@router.post(
    "",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start an incident investigation",
)
async def create_conversation(
    data: ConversationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an incident investigation session."""
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    conv_service = ConversationService(db)
    conv = await conv_service.create_conversation(user_id=user.id, data=data)

    return ConversationResponse(
        id=conv.id,
        project_id=conv.project_id,
        creator_id=conv.user_id,
        title=conv.title,
        status=conv.status,
        severity=conv.severity,
        message_count=conv.message_count,
        last_message_at=conv.last_message_at,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Get conversation detail with messages",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get investigation conversation detail and chronological message history."""
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    conv_service = ConversationService(db)
    conv, messages = await conv_service.get_conversation(
        user_id=user.id, conversation_id=conversation_id
    )

    return ConversationDetailResponse(
        id=conv.id,
        project_id=conv.project_id,
        creator_id=conv.user_id,
        title=conv.title,
        status=conv.status,
        severity=conv.severity,
        message_count=conv.message_count,
        last_message_at=conv.last_message_at,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                sender_id=None,
                sender_display_name=m.sender_display_name,
                role=m.role,
                content=m.content,
                content_type=m.content_type,
                sequence_number=m.sequence_number,
                metadata=m.extra_metadata,
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Post message into investigation",
)
async def post_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Post user or assistant message into an existing investigation."""
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    conv_service = ConversationService(db)
    # Verify access first
    await conv_service.get_conversation(user_id=user.id, conversation_id=conversation_id)

    msg_role = data.role or "user"
    sender_name = "DevResolve AI" if msg_role == "assistant" else user.display_name
    sender_id = None if msg_role == "assistant" else user.id

    msg = await conv_service.add_message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        sender_display_name=sender_name,
        role=msg_role,
        content=data.content,
        content_type=data.content_type,
        metadata=data.metadata,
    )

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=sender_id,
        sender_display_name=msg.sender_display_name,
        role=msg.role,
        content=msg.content,
        content_type=msg.content_type,
        sequence_number=msg.sequence_number,
        metadata=msg.extra_metadata,
        created_at=msg.created_at,
    )


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an investigation conversation",
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete an investigation and exclude it from the active recent chats stack."""
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    conv_service = ConversationService(db)
    await conv_service.delete_conversation(user_id=user.id, conversation_id=conversation_id)
    return None


@router.get("/{conversation_id}/stream", summary="Stream agent investigation events")
async def stream_investigation(
    conversation_id: str,
    project_name: Optional[str] = "Service Backend",
    error_summary: Optional[str] = "Production Error",
):
    """
    Server-Sent Events (SSE) endpoint providing real-time streaming progress
    of the AI investigation pipeline (retrieve → analyze → inspect → hypothesize → fix → test).
    """
    agent = InvestigationAgentService()

    return StreamingResponse(
        agent.run_investigation_stream(
            conversation_id=conversation_id,
            project_name=project_name,
            incident_description=error_summary,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
