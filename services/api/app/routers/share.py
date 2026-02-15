"""Share links router — create, list, revoke, public read."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context
from app.models.tables import (
    Alert,
    AuditEvent,
    Field,
    FieldStat,
    RasterLayer,
    ScoutingObservation,
    ShareLink,
)
from app.schemas.monitoring import ShareCreate, ShareOut, ShareReportOut

router = APIRouter()


@router.get("/fields/{field_id}/share", response_model=list[ShareOut])
async def list_share_links(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ShareLink).where(
            ShareLink.field_id == field_id,
            ShareLink.org_id == ctx.org_id,
            ShareLink.revoked_at.is_(None),
        )
    )
    # Filter out expired links
    now = datetime.now(timezone.utc)
    return [
        link
        for link in result.scalars().all()
        if link.expires_at is None or link.expires_at > now
    ]


@router.post(
    "/fields/{field_id}/share",
    response_model=ShareOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_share_link(
    field_id: uuid.UUID,
    body: ShareCreate,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")

    expires_at = None
    if body.expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)

    link = ShareLink(
        org_id=ctx.org_id,
        field_id=field_id,
        token=secrets.token_urlsafe(32),
        scope=body.scope,
        expires_at=expires_at,
        created_by=ctx.user.id,
    )
    db.add(link)

    # Audit event: report_shared (per PRD Section 5.1)
    db.add(
        AuditEvent(
            org_id=ctx.org_id,
            user_id=ctx.user.id,
            event_type="report_shared",
            metadata_json={
                "field_id": str(field_id),
                "scope": body.scope,
                "token": link.token,
            },
        )
    )
    await db.flush()
    logger.info("report_shared", field_id=str(field_id), scope=body.scope)
    return link


@router.delete(
    "/fields/{field_id}/share/{token}", status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_share_link(
    field_id: uuid.UUID,
    token: str,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ShareLink).where(
            ShareLink.field_id == field_id,
            ShareLink.org_id == ctx.org_id,
            ShareLink.token == token,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    link.revoked_at = datetime.now(timezone.utc)
    link.revoked_by = ctx.user.id
    await db.flush()


@router.get("/share/{token}", response_model=ShareReportOut)
async def get_shared_report(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Public endpoint — no auth required."""
    result = await db.execute(select(ShareLink).where(ShareLink.token == token))
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    now = datetime.now(timezone.utc)
    if link.revoked_at is not None:
        raise HTTPException(status_code=410, detail="Share link has been revoked")
    if link.expires_at is not None and link.expires_at < now:
        raise HTTPException(status_code=410, detail="Share link has expired")

    # Load field
    field = await db.get(Field, link.field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    from geoalchemy2.shape import to_shape
    from shapely.geometry import mapping

    field_data = {
        "id": str(field.id),
        "name": field.name,
        "area_ha": float(field.area_ha) if field.area_ha else None,
        "crop_type": field.crop_type,
        "geom": mapping(to_shape(field.geom)) if field.geom else None,
    }

    # Latest layer
    layer_result = await db.execute(
        select(RasterLayer)
        .where(RasterLayer.field_id == field.id, RasterLayer.layer_type == "NDVI")
        .order_by(RasterLayer.date.desc())
        .limit(1)
    )
    latest_layer = layer_result.scalar_one_or_none()

    # Stats (last 12)
    stats_result = await db.execute(
        select(FieldStat)
        .where(FieldStat.field_id == field.id)
        .order_by(FieldStat.date.desc())
        .limit(12)
    )
    stats = stats_result.scalars().all()

    # Recent alerts (last 10)
    alerts_result = await db.execute(
        select(Alert)
        .where(Alert.field_id == field.id)
        .order_by(Alert.created_at.desc())
        .limit(10)
    )
    alerts = alerts_result.scalars().all()

    # Recent scouting (last 10)
    scouting_result = await db.execute(
        select(ScoutingObservation)
        .where(ScoutingObservation.field_id == field.id)
        .order_by(ScoutingObservation.created_at.desc())
        .limit(10)
    )
    scouting_entries = scouting_result.scalars().all()

    return ShareReportOut(
        field=field_data,
        latest_layer=latest_layer,
        stats=stats,
        alerts=alerts,
        scouting=scouting_entries,
    )
