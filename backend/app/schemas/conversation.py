"""
Conversation & Message Pydantic Schemas
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class MessageBase(BaseModel):
    content: str
    content_type: str = "text"  # text, code_snippet, test_result, diff, status_update


class MessageCreate(MessageBase):
    role: Optional[str] = "user"
    metadata: Optional[Dict[str, Any]] = None


class MessageResponse(MessageBase):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: Optional[uuid.UUID] = None
    sender_display_name: str
    role: str  # user, assistant, system
    sequence_number: int
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationBase(BaseModel):
    title: str = Field("New Incident Investigation", max_length=255)
    severity: str = "medium"  # critical, high, medium, low


class ConversationCreate(ConversationBase):
    project_id: Optional[uuid.UUID] = None
    project_name: Optional[str] = None
    initial_message: Optional[str] = None

    @field_validator("project_id", mode="before")
    @classmethod
    def parse_project_id(cls, v):
        if not v or v in ("undefined", "null", ""):
            return None
        if isinstance(v, uuid.UUID):
            return v
        try:
            return uuid.UUID(str(v))
        except (ValueError, AttributeError):
            return None


class ConversationResponse(ConversationBase):
    id: uuid.UUID
    project_id: uuid.UUID
    creator_id: uuid.UUID
    status: str  # investigating, hypothesized, testing, resolved, closed
    message_count: int = 0
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int
