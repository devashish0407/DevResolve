"""
Project Service
Handles Project lifecycle, slug generation, organization tenancy checks,
and stats maintenance.
"""

import uuid
import re
from typing import List, Optional, Tuple
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.models import Project, OrganizationMember, User
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _generate_slug(self, name: str) -> str:
        slug = re.sub(r"[^\w\s-]", "", name).strip().lower()
        slug = re.sub(r"[-\s]+", "-", slug)
        return f"{slug}-{str(uuid.uuid4())[:6]}"

    async def verify_org_membership(self, user_id: uuid.UUID, org_id: uuid.UUID) -> OrganizationMember:
        stmt = select(OrganizationMember).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id == org_id,
        )
        result = await self.db.execute(stmt)
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this organization",
            )
        return member

    async def create_project(
        self, user_id: uuid.UUID, org_id: uuid.UUID, data: ProjectCreate
    ) -> Project:
        await self.verify_org_membership(user_id, org_id)

        project = Project(
            organization_id=org_id,
            name=data.name,
            slug=self._generate_slug(data.name),
            description=data.description,
            incident_count=0,
            open_incident_count=0,
        )
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def list_user_projects(
        self, user_id: uuid.UUID, page: int = 1, per_page: int = 20
    ) -> Tuple[List[Project], int]:
        # Subquery for user organizations
        user_orgs = select(OrganizationMember.organization_id).where(
            OrganizationMember.user_id == user_id
        )

        # Count total
        count_stmt = select(func.count(Project.id)).where(
            Project.organization_id.in_(user_orgs),
            Project.is_deleted == False,
        )
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        if total == 0:
            return [], 0

        # Query paginated
        stmt = (
            select(Project)
            .where(
                Project.organization_id.in_(user_orgs),
                Project.is_deleted == False,
            )
            .order_by(desc(Project.last_activity_at))
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        result = await self.db.execute(stmt)
        projects = list(result.scalars().all())

        return projects, len(projects)

    async def get_project_by_id(self, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
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

    async def update_project(
        self, user_id: uuid.UUID, project_id: uuid.UUID, data: ProjectUpdate
    ) -> Project:
        project = await self.get_project_by_id(user_id, project_id)
        if data.name is not None:
            project.name = data.name
        if data.description is not None:
            project.description = data.description
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def delete_project(self, user_id: uuid.UUID, project_id: uuid.UUID) -> None:
        project = await self.get_project_by_id(user_id, project_id)
        project.is_deleted = True
        project.deleted_at = func.now()
        await self.db.commit()
