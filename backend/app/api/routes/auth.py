"""
Authentication API Routes
Handles user profile sync after Supabase Auth login.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.services.auth_service import AuthService
from app.schemas.user import UserResponse, UserUpdate


router = APIRouter()


class UserProfile(BaseModel):
    id: str
    auth_id: str
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    organization_id: Optional[str] = None


@router.get("/me", response_model=UserProfile, summary="Get current user profile")
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the authenticated user's profile.
    Provisions or synchronizes the user in PostgreSQL on first login.
    """
    auth_service = AuthService(db)
    user, org = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
        display_name=current_user.get("email", "").split("@")[0],
    )

    return UserProfile(
        id=str(user.id),
        auth_id=user.auth_id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        organization_id=str(org.id) if org else None,
    )


@router.put("/me", response_model=UserProfile, summary="Update user profile")
async def update_profile(
    updates: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile attributes."""
    auth_service = AuthService(db)
    user, org = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    if updates.display_name is not None:
        user.display_name = updates.display_name
    if updates.avatar_url is not None:
        user.avatar_url = updates.avatar_url

    await db.commit()
    await db.refresh(user)

    return UserProfile(
        id=str(user.id),
        auth_id=user.auth_id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        organization_id=str(org.id) if org else None,
    )
