"""
Conversation Service
Handles incident investigation conversations, message sequencing,
and chat history retrieval.
"""

import uuid
from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy import select, func, desc, asc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.models import Conversation, Message, Project, OrganizationMember
from app.schemas.conversation import ConversationCreate, MessageCreate


class ConversationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _verify_project_access(self, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
        stmt = (
            select(Project)
            .join(
                OrganizationMember,
                OrganizationMember.organization_id == Project.organization_id,
            )
            .where(
                Project.id == project_id,
                OrganizationMember.user_id == user_id,
                Project.is_deleted == False,
            )
        )
        result = await self.db.execute(stmt)
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or access denied",
            )
        return project

    async def create_conversation(
        self, user_id: uuid.UUID, data: ConversationCreate
    ) -> Conversation:
        target_project_id = data.project_id
        if not target_project_id:
            org_stmt = select(OrganizationMember.organization_id).where(
                OrganizationMember.user_id == user_id
            )
            org_id = (await self.db.execute(org_stmt)).scalars().first()
            if not org_id:
                raise HTTPException(status_code=400, detail="User has no workspace organization")

            proj_name = data.project_name or f"Investigation Workspace ({data.title[:24]})"
            project = Project(
                organization_id=org_id,
                name=proj_name,
                slug=f"proj-{str(uuid.uuid4())[:8]}",
                description=f"Workspace for incident investigation: {data.title}",
                incident_count=0,
                open_incident_count=0,
            )
            self.db.add(project)
            await self.db.flush()
            target_project_id = project.id
        else:
            try:
                project = await self._verify_project_access(user_id, target_project_id)
            except HTTPException:
                org_stmt = select(OrganizationMember.organization_id).where(
                    OrganizationMember.user_id == user_id
                )
                org_id = (await self.db.execute(org_stmt)).scalars().first()
                if not org_id:
                    raise HTTPException(status_code=400, detail="User has no workspace organization")

                proj_name = data.project_name or f"Investigation Workspace ({data.title[:24]})"
                project = Project(
                    organization_id=org_id,
                    name=proj_name,
                    slug=f"proj-{str(uuid.uuid4())[:8]}",
                    description=f"Workspace for incident investigation: {data.title}",
                    incident_count=0,
                    open_incident_count=0,
                )
                self.db.add(project)
                await self.db.flush()
                target_project_id = project.id

        retention = getattr(data, "retention_mode", "persistent") or "persistent"
        exp_at = datetime.utcnow() + timedelta(days=5) if retention == "temporary" else None

        conv = Conversation(
            project_id=target_project_id,
            user_id=user_id,
            title=data.title,
            status="investigating",
            severity=data.severity,
            retention_mode=retention,
            expires_at=exp_at,
            message_count=0,
            last_message_at=datetime.utcnow(),
        )
        self.db.add(conv)
        await self.db.flush()

        # Update project activity and count
        project.incident_count += 1
        project.open_incident_count += 1
        project.last_activity_at = datetime.utcnow()

        # If an initial prompt was provided, create the first user message
        if data.initial_message:
            msg = Message(
                conversation_id=conv.id,
                sender_display_name="You",
                role="user",
                content=data.initial_message,
                content_type="text",
                sequence_number=1,
            )
            self.db.add(msg)
            conv.message_count = 1

        await self.db.commit()
        await self.db.refresh(conv)
        return conv

    async def list_conversations(
        self, user_id: uuid.UUID, project_id: Optional[uuid.UUID] = None
    ) -> List[Conversation]:
        stmt = (
            select(Conversation)
            .options(selectinload(Conversation.project))
            .outerjoin(Project, Project.id == Conversation.project_id)
            .outerjoin(OrganizationMember, OrganizationMember.organization_id == Project.organization_id)
            .where(
                ((Conversation.user_id == user_id) | (OrganizationMember.user_id == user_id)),
                Conversation.is_deleted == False,
            )
        )
        if project_id:
            stmt = stmt.where(Conversation.project_id == project_id)

        stmt = stmt.order_by(desc(Conversation.last_message_at)).distinct()
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_conversation(
        self, user_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> Tuple[Conversation, List[Message]]:
        stmt = (
            select(Conversation)
            .outerjoin(Project, Project.id == Conversation.project_id)
            .outerjoin(OrganizationMember, OrganizationMember.organization_id == Project.organization_id)
            .where(
                Conversation.id == conversation_id,
                ((Conversation.user_id == user_id) | (OrganizationMember.user_id == user_id)),
                Conversation.is_deleted == False,
            )
        )
        result = await self.db.execute(stmt)
        conv = result.scalars().first()
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investigation not found or access denied",
            )

        # Fetch messages ordered by sequence
        msg_stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(asc(Message.sequence_number))
        )
        msg_result = await self.db.execute(msg_stmt)
        messages = list(msg_result.scalars().all())

        return conv, messages

    async def add_message(
        self,
        conversation_id: uuid.UUID,
        sender_id: Optional[uuid.UUID],
        sender_display_name: str,
        role: str,
        content: str,
        content_type: str = "text",
        metadata: Optional[dict] = None,
    ) -> Message:
        # Get next sequence number
        seq_stmt = select(func.coalesce(func.max(Message.sequence_number), 0)).where(
            Message.conversation_id == conversation_id
        )
        next_seq = (await self.db.execute(seq_stmt)).scalar_one() + 1

        msg = Message(
            conversation_id=conversation_id,
            sender_display_name=sender_display_name,
            role=role,
            content=content,
            content_type=content_type,
            sequence_number=next_seq,
            extra_metadata=metadata,
        )
        self.db.add(msg)

        # Update conversation denormalized fields
        conv_stmt = select(Conversation).where(Conversation.id == conversation_id)
        conv = (await self.db.execute(conv_stmt)).scalar_one_or_none()
        if conv:
            conv.message_count += 1
            conv.last_message_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(msg)
        return msg

    async def delete_conversation(self, user_id: uuid.UUID, conversation_id: uuid.UUID) -> None:
        conv, _ = await self.get_conversation(user_id, conversation_id)
        conv.is_deleted = True
        await self.db.commit()
