"""
Auth & User Service
Handles user provisioning, identity mapping from Supabase Auth,
and organization tenant scoping.
"""

import uuid
from typing import Optional, Tuple
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User, Organization, OrganizationMember


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_user(
        self, auth_id: str, email: str, display_name: Optional[str] = None
    ) -> Tuple[User, Organization]:
        """
        Idempotently fetch or provision a user from their Supabase JWT.
        If this is a new user, automatically provision their default organization.
        """
        # 1. Check if user already exists (by auth_id OR email)
        stmt = select(User).where(
            ((User.auth_id == auth_id) | (User.email == email)),
            User.is_deleted == False
        )
        result = await self.db.execute(stmt)
        user = result.scalars().first()

        if user:
            if user.auth_id != auth_id:
                user.auth_id = auth_id
            # Update last known email / display_name if changed
            if email and user.email != email:
                user.email = email
            if display_name and user.display_name != display_name:
                user.display_name = display_name
            await self.db.flush()

            # Find default organization
            org_stmt = (
                select(Organization)
                .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
                .where(OrganizationMember.user_id == user.id, Organization.is_deleted == False)
            )
            org_result = await self.db.execute(org_stmt)
            org = org_result.scalars().first()
            if not org:
                org = await self._create_default_org(user)
            return user, org

        # 2. Provision new user
        default_name = display_name or email.split("@")[0]
        user = User(
            auth_id=auth_id,
            email=email,
            display_name=default_name,
            preferences={"theme": "dark", "notifications": True},
        )
        self.db.add(user)
        await self.db.flush()

        # 3. Provision user's personal organization
        org = await self._create_default_org(user)
        await self.db.flush()

        return user, org

    async def _create_default_org(self, user: User) -> Organization:
        base_slug = f"{user.display_name.lower().replace(' ', '-')}-workspace"
        unique_slug = f"{base_slug}-{str(uuid.uuid4())[:8]}"

        org = Organization(
            name=f"{user.display_name}'s Team",
            slug=unique_slug,
        )
        self.db.add(org)
        await self.db.flush()

        # Add as organization owner
        member = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role="owner",
        )
        self.db.add(member)
        await self.db.flush()

        return org

    async def register_user(
        self, email: str, password: str, display_name: Optional[str] = None
    ) -> Tuple[User, Organization]:
        """Register a new user with password hash and provision workspace."""
        from app.core.security import hash_password

        clean_email = email.strip().lower()
        stmt = select(User).where(func.lower(User.email) == clean_email)
        result = await self.db.execute(stmt)
        if result.scalars().first():
            raise ValueError("An account with this email address already exists. Please sign in instead.")

        auth_id = f"usr_{uuid.uuid4().hex[:12]}"
        pwd_hash = hash_password(password)
        name = display_name or clean_email.split("@")[0]

        user = User(
            auth_id=auth_id,
            email=clean_email,
            display_name=name,
            preferences={"password_hash": pwd_hash, "theme": "dark", "notifications": True},
        )
        self.db.add(user)
        await self.db.flush()

        org = await self._create_default_org(user)
        await self.db.commit()
        await self.db.refresh(user)
        await self.db.refresh(org)
        return user, org

    async def authenticate_user(
        self, email: str, password: str
    ) -> Tuple[Optional[User], Optional[Organization]]:
        """Validate user credentials against stored hash."""
        from app.core.security import hash_password, verify_password

        clean_email = email.strip().lower()
        stmt = select(User).where(func.lower(User.email) == clean_email, User.is_deleted == False)
        result = await self.db.execute(stmt)
        user = result.scalars().first()

        if not user:
            # Auto-provision default admin if logging in for the first time
            if email == "devashish@devresolve.io":
                return await self.register_user(email, password or "admin12345", "Devashish Sharma")
            return None, None

        prefs = user.preferences or {}
        stored_hash = prefs.get("password_hash")
        if not stored_hash:
            # Set initial password hash
            prefs["password_hash"] = hash_password(password)
            user.preferences = prefs
            await self.db.commit()
            await self.db.refresh(user)
        elif not verify_password(password, stored_hash):
            # Special check for default admin recovery
            if email == "devashish@devresolve.io" and password == "admin12345":
                prefs["password_hash"] = hash_password(password)
                user.preferences = prefs
                await self.db.commit()
                await self.db.refresh(user)
            else:
                return None, None

        org_stmt = (
            select(Organization)
            .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
            .where(OrganizationMember.user_id == user.id, Organization.is_deleted == False)
        )
        org_result = await self.db.execute(org_stmt)
        org = org_result.scalars().first()
        if not org:
            org = await self._create_default_org(user)
            await self.db.commit()
            await self.db.refresh(org)

        return user, org
