"""
Authentication API Routes
Provides genuine registration, login, and profile synchronization.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, create_access_token
from app.db.session import get_db
from app.services.auth_service import AuthService
from app.schemas.user import UserUpdate


router = APIRouter()


class UserProfile(BaseModel):
    id: str
    auth_id: str
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    organization_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


@router.post("/login", response_model=AuthResponse, summary="Log in with email and password")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user credentials and return a signed JWT access token."""
    auth_service = AuthService(db)
    user, org = await auth_service.authenticate_user(data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    profile = UserProfile(
        id=str(user.id),
        auth_id=user.auth_id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        organization_id=str(org.id) if org else None,
    )

    token = create_access_token({
        "sub": user.auth_id,
        "email": user.email,
        "role": "authenticated",
        "display_name": user.display_name,
    })

    return AuthResponse(access_token=token, user=profile)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED, summary="Register a new user")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user and provision an isolated tenant organization."""
    auth_service = AuthService(db)
    try:
        user, org = await auth_service.register_user(
            email=data.email,
            password=data.password,
            display_name=data.display_name,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    profile = UserProfile(
        id=str(user.id),
        auth_id=user.auth_id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        organization_id=str(org.id) if org else None,
    )

    token = create_access_token({
        "sub": user.auth_id,
        "email": user.email,
        "role": "authenticated",
        "display_name": user.display_name,
    })

    return AuthResponse(access_token=token, user=profile)


@router.get("/me", response_model=UserProfile, summary="Get current user profile")
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the authenticated user's profile.
    Provisions or synchronizes the user on first login.
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
