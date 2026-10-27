"""
Auth & User Service
Handles user provisioning, identity mapping from Supabase Auth,
and organization tenant scoping.
"""

import uuid
from typing import Optional, Tuple
from sqlalchemy import select
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
        # 1. Check if user already exists
        stmt = select(User).where(User.auth_id == auth_id, User.is_deleted == False)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
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
            plan="developer",
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
