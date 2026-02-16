"""Orgs router — CRUD, members, invites, audit events."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import (
    CurrentUser,
    OrgContext,
    get_current_user,
    get_org_context,
    require_roles,
)
from app.models.tables import AuditEvent, Farm, Invite, Org, OrgMember, User
from app.schemas.auth import (
    InviteCreate,
    InviteOut,
    MemberOut,
    MemberRoleUpdate,
    OrgCreate,
    OrgDetailOut,
    OrgOut,
    OrgUpdate,
    TransferOwnershipRequest,
)
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
    logger.info(
        "org_created", org_id=str(org.id), name=body.name, user_id=str(current_user.id)
    )

    # Creator becomes owner
    membership = OrgMember(org_id=org.id, user_id=current_user.id, role="owner")
    db.add(membership)

    # Audit
    db.add(
        AuditEvent(
            org_id=org.id,
            user_id=current_user.id,
            event_type="org_created",
            metadata_json={"name": body.name},
        )
    )
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

    member_count = (
        await db.execute(select(func.count()).where(OrgMember.org_id == org_id))
    ).scalar() or 0
    farm_count = (
        await db.execute(
            select(func.count()).where(Farm.org_id == org_id, Farm.deleted_at.is_(None))
        )
    ).scalar() or 0

    return OrgDetailOut(
        id=org.id,
        name=org.name,
        created_by=org.created_by,
        created_at=org.created_at,
        member_count=member_count,
        farm_count=farm_count,
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


@router.get("/orgs/{org_id}/members", response_model=PaginatedResponse[MemberOut])
async def list_members(
    org_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    base = (
        select(OrgMember, User.email, User.name)
        .join(User, OrgMember.user_id == User.id)
        .where(OrgMember.org_id == org_id)
    )
    total = (
        await db.execute(
            select(func.count()).select_from(
                select(OrgMember.id).where(OrgMember.org_id == org_id).subquery()
            )
        )
    ).scalar() or 0
    result = await db.execute(
        base.order_by(OrgMember.created_at.asc()).limit(limit).offset(offset)
    )
    return PaginatedResponse(
        items=[
            MemberOut(
                id=row.OrgMember.id,
                user_id=row.OrgMember.user_id,
                email=row.email,
                name=row.name,
                role=row.OrgMember.role,
                created_at=row.OrgMember.created_at,
            )
            for row in result.all()
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/orgs/{org_id}/members/{user_id}")
async def change_member_role(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    body: MemberRoleUpdate,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}"
        )

    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.role = body.role
    await db.flush()

    db.add(
        AuditEvent(
            org_id=org_id,
            user_id=ctx.user.id,
            event_type="role_changed",
            metadata_json={"target_user": str(user_id), "new_role": body.role},
        )
    )
    logger.info(
        "role_changed", org_id=str(org_id), target_user=str(user_id), new_role=body.role
    )

    # Notify the affected member (best-effort)
    try:
        from app.core.email import send_role_changed_email

        target_user = await db.get(User, user_id)
        org = await db.get(Org, org_id)
        if target_user:
            await send_role_changed_email(
                to_email=target_user.email,
                org_name=org.name if org else "OpenFarm",
                new_role=body.role,
                changed_by_name=ctx.user.name,
            )
    except Exception as exc:
        logger.warning("role_changed_email_failed", error=str(exc))

    return {"ok": True}


@router.delete(
    "/orgs/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if user_id == ctx.user.id and ctx.role == "owner":
        raise HTTPException(status_code=400, detail="Owner cannot remove themselves")

    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)


# ── Invites ──────────────────────────────────────────────────────────


@router.post(
    "/orgs/{org_id}/invites",
    response_model=InviteOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_invite(
    org_id: uuid.UUID,
    body: InviteCreate,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.role not in VALID_ROLES or body.role == "owner":
        raise HTTPException(
            status_code=400,
            detail="Invalid role. Must be one of: admin, member, viewer",
        )

    # Prevent self-invite
    if body.email == ctx.user.email:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    # Check if already a member
    existing_member = await db.execute(
        select(OrgMember)
        .join(User, OrgMember.user_id == User.id)
        .where(OrgMember.org_id == org_id, User.email == body.email)
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member")

    # Check for duplicate pending invite
    existing_invite = await db.execute(
        select(Invite).where(
            Invite.org_id == org_id,
            Invite.email == body.email,
            Invite.status == "pending",
        )
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail="A pending invite already exists for this email"
        )

    invite = Invite(
        org_id=org_id, email=body.email, role=body.role, invited_by=ctx.user.id
    )
    db.add(invite)

    db.add(
        AuditEvent(
            org_id=org_id,
            user_id=ctx.user.id,
            event_type="member_invited",
            metadata_json={"email": body.email, "role": body.role},
        )
    )
    logger.info("member_invited", org_id=str(org_id), email=body.email, role=body.role)
    await db.flush()

    # Send invite email (best-effort — don't fail the request)
    try:
        from app.core.email import send_invite_email

        org = await db.get(Org, org_id)
        await send_invite_email(
            to_email=body.email,
            org_name=org.name if org else "OpenFarm",
            role=body.role,
            invited_by_name=ctx.user.name,
        )
    except Exception as exc:
        logger.warning("invite_email_failed", email=body.email, error=str(exc))

    return invite


@router.get("/orgs/{org_id}/invites", response_model=list[InviteOut])
async def list_org_invites(
    org_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str = Query("pending", alias="status"),
):
    """List invites for an org, filtered by status (default: pending)."""
    query = (
        select(Invite, User.name.label("inviter_name"))
        .outerjoin(User, Invite.invited_by == User.id)
        .where(Invite.org_id == org_id)
    )
    if status_filter != "all":
        query = query.where(Invite.status == status_filter)
    query = query.order_by(Invite.created_at.desc())
    result = await db.execute(query)
    return [
        InviteOut(
            id=row.Invite.id,
            org_id=row.Invite.org_id,
            email=row.Invite.email,
            role=row.Invite.role,
            status=row.Invite.status,
            invited_by_name=row.inviter_name,
            created_at=row.Invite.created_at,
        )
        for row in result.all()
    ]


@router.delete(
    "/orgs/{org_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def cancel_invite(
    org_id: uuid.UUID,
    invite_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cancel (delete) a pending invite."""
    invite = await db.get(Invite, invite_id)
    if not invite or invite.org_id != org_id:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.status != "pending":
        raise HTTPException(
            status_code=400, detail="Only pending invites can be cancelled"
        )
    await db.delete(invite)

    db.add(
        AuditEvent(
            org_id=org_id,
            user_id=ctx.user.id,
            event_type="invite_cancelled",
            metadata_json={"email": invite.email, "role": invite.role},
        )
    )
    logger.info("invite_cancelled", org_id=str(org_id), email=invite.email)
    await db.flush()

    # Notify the invited person (best-effort)
    try:
        from app.core.email import send_invite_cancelled_email

        org = await db.get(Org, org_id)
        await send_invite_cancelled_email(
            to_email=invite.email,
            org_name=org.name if org else "OpenFarm",
        )
    except Exception as exc:
        logger.warning("invite_cancelled_email_failed", error=str(exc))


@router.get("/invites/pending", response_model=list[InviteOut])
async def list_pending_invites(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Invite).where(
            Invite.email == current_user.email, Invite.status == "pending"
        )
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
        select(OrgMember).where(
            OrgMember.org_id == invite.org_id, OrgMember.user_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        invite.status = "accepted"
        return {"ok": True, "detail": "Already a member"}

    membership = OrgMember(
        org_id=invite.org_id, user_id=current_user.id, role=invite.role
    )
    db.add(membership)
    invite.status = "accepted"
    from datetime import datetime, timezone

    invite.accepted_at = datetime.now(timezone.utc)
    await db.flush()

    # Send email to both parties (best-effort)
    try:
        from app.core.email import send_invite_accepted_email

        org = await db.get(Org, invite.org_id)
        org_name = org.name if org else "OpenFarm"
        # Email to the user who accepted
        await send_invite_accepted_email(
            to_email=current_user.email,
            org_name=org_name,
            accepted_by_name=current_user.name,
            role=invite.role,
            notify_admin=False,
        )
        # Email to the person who sent the invite
        if invite.invited_by:
            inviter = await db.get(User, invite.invited_by)
            if inviter:
                await send_invite_accepted_email(
                    to_email=inviter.email,
                    org_name=org_name,
                    accepted_by_name=current_user.name,
                    role=invite.role,
                    notify_admin=True,
                )
    except Exception as exc:
        logger.warning("invite_accepted_email_failed", error=str(exc))

    return {"ok": True}


# ── Transfer Ownership ────────────────────────────────────────────────


@router.post("/orgs/{org_id}/transfer-ownership")
async def transfer_ownership(
    org_id: uuid.UUID,
    body: TransferOwnershipRequest,
    ctx: Annotated[OrgContext, Depends(require_roles("owner"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Transfer org ownership to another member. Only the current owner can do this."""
    if body.new_owner_user_id == ctx.user.id:
        raise HTTPException(status_code=400, detail="You are already the owner")

    # Find the target member
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id,
            OrgMember.user_id == body.new_owner_user_id,
        )
    )
    new_owner = result.scalar_one_or_none()
    if not new_owner:
        raise HTTPException(status_code=404, detail="Member not found")

    # Find the current owner membership
    result = await db.execute(
        select(OrgMember).where(
            OrgMember.org_id == org_id, OrgMember.user_id == ctx.user.id
        )
    )
    current_owner = result.scalar_one_or_none()
    if not current_owner:
        raise HTTPException(
            status_code=404, detail="Current owner membership not found"
        )

    # Swap roles atomically
    old_role = new_owner.role
    new_owner.role = "owner"
    current_owner.role = "admin"

    db.add(
        AuditEvent(
            org_id=org_id,
            user_id=ctx.user.id,
            event_type="ownership_transferred",
            metadata_json={
                "new_owner_id": str(body.new_owner_user_id),
                "previous_role": old_role,
            },
        )
    )
    logger.info(
        "ownership_transferred",
        org_id=str(org_id),
        new_owner=str(body.new_owner_user_id),
    )
    await db.flush()

    # Send email to both parties (best-effort)
    try:
        from app.core.email import send_ownership_transferred_email

        org = await db.get(Org, org_id)
        org_name = org.name if org else "OpenFarm"
        new_owner_user = await db.get(User, body.new_owner_user_id)
        # Email to new owner
        if new_owner_user:
            await send_ownership_transferred_email(
                to_email=new_owner_user.email,
                org_name=org_name,
                is_new_owner=True,
                other_party_name=ctx.user.name,
            )
        # Email to previous owner
        await send_ownership_transferred_email(
            to_email=ctx.user.email,
            org_name=org_name,
            is_new_owner=False,
            other_party_name=new_owner_user.name if new_owner_user else "Unknown",
        )
    except Exception as exc:
        logger.warning("ownership_transfer_email_failed", error=str(exc))

    return {"ok": True}


# ── Audit Events ─────────────────────────────────────────────────────


@router.get(
    "/orgs/{org_id}/audit-events", response_model=PaginatedResponse[AuditEventOut]
)
async def list_audit_events(
    org_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(require_roles("owner", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    total = (
        await db.execute(select(func.count()).where(AuditEvent.org_id == org_id))
    ).scalar() or 0
    result = await db.execute(
        select(AuditEvent)
        .where(AuditEvent.org_id == org_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return PaginatedResponse(
        items=result.scalars().all(), total=total, limit=limit, offset=offset
    )
