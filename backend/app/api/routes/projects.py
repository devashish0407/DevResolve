"""
Projects API Routes
CRUD operations for projects with tenant scoping and authorization checks.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, List
from datetime import datetime
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.services.auth_service import AuthService
from app.services.project_service import ProjectService
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
)


router = APIRouter()


@router.get("", response_model=ProjectListResponse, summary="List user's projects")
async def list_projects(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all projects the current user has access to.
    Paginated and sorted by last activity timestamp.
    """
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    project_service = ProjectService(db)
    projects, total = await project_service.list_user_projects(
        user_id=user.id, page=page, per_page=per_page
    )

    return ProjectListResponse(
        projects=[
            ProjectResponse(
                id=p.id,
                organization_id=p.organization_id,
                name=p.name,
                description=p.description,
                slug=p.slug,
                incident_count=p.incident_count,
                open_incident_count=p.open_incident_count,
                last_activity_at=p.last_activity_at,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in projects
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
)
async def create_project(
    data: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a project scoped to the user's active organization.
    """
    auth_service = AuthService(db)
    user, org = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    org_id = data.organization_id or org.id
    project_service = ProjectService(db)
    project = await project_service.create_project(
        user_id=user.id, org_id=org_id, data=data
    )

    return ProjectResponse(
        id=project.id,
        organization_id=project.organization_id,
        name=project.name,
        description=project.description,
        slug=project.slug,
        incident_count=project.incident_count,
        open_incident_count=project.open_incident_count,
        last_activity_at=project.last_activity_at,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/{project_id}", response_model=ProjectResponse, summary="Get project details")
async def get_project(
    project_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get project by UUID with membership verification."""
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    project_service = ProjectService(db)
    project = await project_service.get_project_by_id(user_id=user.id, project_id=project_id)

    return ProjectResponse(
        id=project.id,
        organization_id=project.organization_id,
        name=project.name,
        description=project.description,
        slug=project.slug,
        incident_count=project.incident_count,
        open_incident_count=project.open_incident_count,
        last_activity_at=project.last_activity_at,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.patch("/{project_id}", response_model=ProjectResponse, summary="Update project")
async def update_project(
    project_id: uuid.UUID,
    updates: ProjectUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update project name or description."""
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    project_service = ProjectService(db)
    project = await project_service.update_project(
        user_id=user.id, project_id=project_id, data=updates
    )

    return ProjectResponse(
        id=project.id,
        organization_id=project.organization_id,
        name=project.name,
        description=project.description,
        slug=project.slug,
        incident_count=project.incident_count,
        open_incident_count=project.open_incident_count,
        last_activity_at=project.last_activity_at,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete project")
async def delete_project(
    project_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a project."""
    auth_service = AuthService(db)
    user, _ = await auth_service.get_or_create_user(
        auth_id=current_user["auth_id"],
        email=current_user.get("email", ""),
    )

    project_service = ProjectService(db)
    await project_service.delete_project(user_id=user.id, project_id=project_id)
