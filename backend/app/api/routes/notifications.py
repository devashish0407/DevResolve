"""
Notifications API Routes
Manages incident alerts, sandbox run completions, and workflow notifications.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.security import get_current_user


router = APIRouter()


class NotificationItem(BaseModel):
    id: str
    title: str
    message: str
    type: str  # alert | success | info
    time: str
    read: bool = False
    actionUrl: Optional[str] = None


# Stateful user notifications
_NOTIFICATIONS: List[dict] = [
    {
        "id": "notif-1",
        "title": "Docker Sandbox Ready",
        "message": "Ephemeral test runner container initialized with safe isolated execution mode.",
        "type": "success",
        "time": "Just now",
        "read": False,
        "actionUrl": "/app/integrations",
    },
    {
        "id": "notif-2",
        "title": "GitHub Sync Active",
        "message": "Repository AST definitions and commit trees are indexed in RAG vector store.",
        "type": "info",
        "time": "10 mins ago",
        "read": False,
        "actionUrl": "/app/integrations",
    },
    {
        "id": "notif-3",
        "title": "Investigation Completed",
        "message": "RCA generated for connection pool bottleneck with automated pytest validation.",
        "type": "alert",
        "time": "1 hour ago",
        "read": True,
        "actionUrl": "/app/chat",
    },
]


@router.get("", response_model=List[NotificationItem], summary="Get all user notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Fetch notifications for the authenticated developer."""
    return [NotificationItem(**n) for n in _NOTIFICATIONS]


@router.post("/{notification_id}/read", summary="Mark notification as read")
async def mark_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read."""
    for n in _NOTIFICATIONS:
        if n["id"] == notification_id:
            n["read"] = True
            break
    return {"status": "ok"}


@router.post("/read-all", summary="Mark all notifications as read")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read."""
    for n in _NOTIFICATIONS:
        n["read"] = True
    return {"status": "ok", "message": "All notifications marked as read"}


@router.post("/clear", summary="Clear all notifications")
async def clear_notifications(current_user: dict = Depends(get_current_user)):
    """Clear notifications list."""
    _NOTIFICATIONS.clear()
    return {"status": "ok", "cleared": True}
