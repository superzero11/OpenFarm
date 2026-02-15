"""Users router — GET /users/me."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import CurrentUser, get_current_user
from app.models.tables import Org, OrgMember, User
from app.schemas.auth import OrgBrief, UserMeOut

router = APIRouter()


@router.get("/users/me", response_model=UserMeOut)
async def get_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return authenticated user profile with org list."""
    logger.info("get_me", user_id=str(current_user.id))
    user = await db.get(User, current_user.id)
    if not user:
        # User exists in JWT but not in DB — shouldn't happen post-bootstrap
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    # Fetch memberships
    result = await db.execute(
        select(OrgMember.role, Org.id, Org.name)
        .join(Org, OrgMember.org_id == Org.id)
        .where(OrgMember.user_id == current_user.id)
    )
    orgs = [OrgBrief(id=row.id, name=row.name, role=row.role) for row in result.all()]

    return UserMeOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        orgs=orgs,
    )
