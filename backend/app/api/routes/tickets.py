"""
Tickets & Support API Routes
Provides a user-facing ticketing and support mechanism for incident reporting,
service disruptions, and engineering escalations.
"""

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import random
import uuid

from app.core.security import get_current_user

router = APIRouter()


class TicketCreate(BaseModel):
    title: str = Field(..., description="Summary of the issue or ticket")
    description: str = Field(..., description="Detailed description of the issue")
    category: str = Field(default="ai_service", description="Category: ai_service, diagnostics, system, bug, other")
    priority: str = Field(default="high", description="Priority: low, medium, high, critical")
    metadata: Optional[Dict[str, Any]] = None


class TicketResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    priority: str
    status: str
    created_at: str
    estimated_resolution: str
    assigned_team: str
    user_email: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# Stateful in-memory ticket ledger
_TICKETS_STORE: List[dict] = []


@router.get("", response_model=List[TicketResponse], summary="List support tickets")
async def list_tickets(current_user: dict = Depends(get_current_user)):
    """Fetch all tickets raised by the current developer or organization."""
    return [TicketResponse(**t) for t in _TICKETS_STORE]


@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED, summary="Raise a support ticket")
async def create_ticket(
    payload: TicketCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Submits a new support or incident ticket, dispatches an automated notification,
    and returns a unique ticket tracking ID with peace-of-mind confirmation.
    """
    ticket_num = random.randint(1000, 9999)
    ticket_id = f"TIC-{ticket_num}"
    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    # Estimated resolution SLA based on priority
    sla_map = {
        "critical": "Immediate (< 15 mins)",
        "high": "Under 30 mins",
        "medium": "Under 2 hours",
        "low": "Within 24 hours",
    }
    resolution_sla = sla_map.get(payload.priority.lower(), "Under 1 hour")

    ticket_data = {
        "id": ticket_id,
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "category": payload.category,
        "priority": payload.priority,
        "status": "investigating",
        "created_at": created_at,
        "estimated_resolution": resolution_sla,
        "assigned_team": "On-Call Infrastructure & AI Reliability Team",
        "user_email": current_user.get("email", "user@devresolve.io"),
        "metadata": payload.metadata or {},
    }

    _TICKETS_STORE.insert(0, ticket_data)

    # Post notification to user's notifications feed for immediate feedback
    try:
        from app.api.routes.notifications import _NOTIFICATIONS
        _NOTIFICATIONS.insert(0, {
            "id": f"notif-ticket-{ticket_id}",
            "title": f"Ticket Created: #{ticket_id}",
            "message": f"Your ticket '{payload.title}' has been logged. {resolution_sla} SLA active.",
            "type": "info",
            "time": "Just now",
            "read": False,
            "actionUrl": "/app/chat",
        })
    except Exception:
        pass

    # Dispatch outbound email alert to devashish0716@gmail.com
    try:
        from app.services.email_service import EmailService
        email_svc = EmailService()
        import asyncio
        asyncio.create_task(email_svc.send_ticket_notification(ticket_data))
    except Exception as e:
        print(f"[Tickets] Could not trigger email dispatch: {e}")

    return TicketResponse(**ticket_data)

