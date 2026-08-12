"""JWT authentication and RBAC dependencies."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db


@dataclass
class CurrentUser:
    """Authenticated user extracted from JWT."""

    id: uuid.UUID
    email: str
    name: str


@dataclass
class OrgContext:
    """Validated org context for the request."""

    user: CurrentUser
    org_id: uuid.UUID
    role: str  # owner | admin | member | viewer


async def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> CurrentUser:
    """Extract and validate JWT from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(
            token, settings.openfarm_jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject"
        )

    return CurrentUser(
        id=uuid.UUID(user_id),
        email=payload.get("email", ""),
        name=payload.get("name", ""),
    )


async def get_org_context(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_org_id: Annotated[str | None, Header(alias="X-Org-Id")] = None,
) -> OrgContext:
    """Validate X-Org-Id header and check membership."""
    if not x_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Org-Id header is required",
        )

    try:
        org_uuid = uuid.UUID(x_org_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Org-Id format"
        )

    # Check membership. The join to Org is what stops a soft-deleted
    # workspace from staying fully reachable: membership rows survive the
    # delete, so checking OrgMember alone would still let every
    # org-scoped endpoint through.
    from app.models.tables import Org, OrgMember

    result = await db.execute(
        select(OrgMember.role)
        .join(Org, Org.id == OrgMember.org_id)
        .where(
            OrgMember.org_id == org_uuid,
            OrgMember.user_id == user.id,
            Org.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this org"
        )

    return OrgContext(user=user, org_id=org_uuid, role=row)


def require_roles(*allowed_roles: str):
    """Dependency factory - restrict endpoint to specific roles."""

    async def _check(
        ctx: Annotated[OrgContext, Depends(get_org_context)],
    ) -> OrgContext:
        if ctx.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{ctx.role}' not permitted. Required: {', '.join(allowed_roles)}",
            )
        return ctx

    return _check
