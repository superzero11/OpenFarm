"""Orgs router — CRUD, members, invites, audit events."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import CurrentUser, OrgContext, get_current_user, get_org_context, require_roles
from app.models.tables import AuditEvent, Farm, Invite, Org, OrgMember, User
from app.schemas.auth import InviteCreate, InviteOut, MemberOut, MemberRoleUpdate, OrgCreate, OrgDetailOut, OrgOut, OrgUpdate
from app.schemas.common import PaginatedResponse
from app.schemas.monitoring import AuditEventOut

router = APIRouter()

VALID_ROLES = {"owner", "admin", "member", "viewer"}


# ── Org CRUD ─────────────────────────────────────────────────────────

@router.get("/orgs", response_model=list[OrgOut])
async def list_orgs(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Org)
        .join(OrgMember, OrgMember.org_id == Org.id)
        .where(OrgMember.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/orgs", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
async def create_org(
    body: OrgCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = Org(name=body.name, created_by=current_user.id)
    db.add(org)
    await db.flush()
    logger.info("org_created", org_id=str(org.id), name=body.name, user_id=str(current_user.id))

    # Creator becomes owner
    membership = OrgMember(org_id=org.id, user_id=current_user.id, role="owner")
    db.add(membership)

    # Audit
    db.add(AuditEvent(org_id=org.id, user_id=current_user.id, event_type="org_created", metadata_json={"name": body.name}))
    await db.flush()
    return org


@router.get("/orgs/{org_id}", response_model=OrgDetailOut)
async def get_org(
    org_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await db.get(Org, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")

    member_count = (await db.execute(select(func.count()).where(OrgMember.org_id == org_id))).scalar() or 0
    farm_count = (await db.execute(select(func.count()).where(Farm.org_id == org_id, Farm.deleted_at.is_(None)))).scalar() or 0

    return OrgDetailOut(
        id=org.id, name=org.name, created_by=org.created_by,
        created_at=org.created_at, member_count=member_count, farm_count=farm_count,
    )


@router.patch("/orgs/{org_id}", response_model=OrgOut)
async def update_org(
    org_id: uuid.UUID,
    body: OrgUpdate,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    org = await db.get(Org, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")
    org.name = body.name
    await db.flush()
    return org


# ── Members ──────────────────────────────────────────────────────────

@router.get("/orgs/{org_id}/members", response_model=list[MemberOut])
async def list_members(
    org_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(OrgMember, User.email, User.name)
        .join(User, OrgMember.user_id == User.id)
        .where(OrgMember.org_id == org_id)
    )
    return [
        MemberOut(id=row.OrgMember.id, user_id=row.OrgMember.user_id, email=row.email, name=row.name, role=row.OrgMember.role, created_at=row.OrgMember.created_at)
        for row in result.all()
    ]


@router.patch("/orgs/{org_id}/members/{user_id}")
async def change_member_role(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    body: MemberRoleUpdate,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.role = body.role
    await db.flush()

    db.add(AuditEvent(org_id=org_id, user_id=ctx.user.id, event_type="role_changed", metadata_json={"target_user": str(user_id), "new_role": body.role}))
    logger.info("role_changed", org_id=str(org_id), target_user=str(user_id), new_role=body.role)
    return {"ok": True}


@router.delete("/orgs/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user_id == ctx.user.id and ctx.role == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot remove themselves")

    result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)


# ── Invites ──────────────────────────────────────────────────────────

@router.post("/orgs/{org_id}/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
async def create_invite(
    org_id: uuid.UUID,
    body: InviteCreate,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    invite = Invite(org_id=org_id, email=body.email, role=body.role, invited_by=ctx.user.id)
    db.add(invite)

    db.add(AuditEvent(org_id=org_id, user_id=ctx.user.id, event_type="member_invited", metadata_json={"email": body.email, "role": body.role}))
    logger.info("member_invited", org_id=str(org_id), email=body.email, role=body.role)
    await db.flush()
    return invite


@router.get("/invites/pending", response_model=list[InviteOut])
async def list_pending_invites(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Invite).where(Invite.email == current_user.email, Invite.status == "pending")
    )
    return result.scalars().all()


@router.post("/invites/{invite_id}/accept")
async def accept_invite(
    invite_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invite = await db.get(Invite, invite_id)
    if not invite or invite.email != current_user.email or invite.status != "pending":
        raise HTTPException(status_code=404, detail="Invite not found or already used")

    # Check if already a member
    existing = await db.execute(
        select(OrgMember).where(OrgMember.org_id == invite.org_id, OrgMember.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        invite.status = "accepted"
        return {"ok": True, "detail": "Already a member"}

    membership = OrgMember(org_id=invite.org_id, user_id=current_user.id, role=invite.role)
    db.add(membership)
    invite.status = "accepted"
    from datetime import datetime, timezone
    invite.accepted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"ok": True}


# ── Audit Events ─────────────────────────────────────────────────────

@router.get("/orgs/{org_id}/audit-events", response_model=PaginatedResponse[AuditEventOut])
async def list_audit_events(
    org_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    total = (await db.execute(select(func.count()).where(AuditEvent.org_id == org_id))).scalar() or 0
    result = await db.execute(
        select(AuditEvent)
        .where(AuditEvent.org_id == org_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit).offset(offset)
    )
    return PaginatedResponse(items=result.scalars().all(), total=total, limit=limit, offset=offset)
