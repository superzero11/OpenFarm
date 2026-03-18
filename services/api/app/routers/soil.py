"""Soil router — field soil profile, summary, refresh."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.logging import logger
from app.core.rate_limit import limiter
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import Field, Job, SoilFieldSummary, SoilProfile
from app.schemas.soil import SoilFieldSummaryOut, SoilProfileOut, SoilRefreshResponse

router = APIRouter()

_writer = require_roles("owner", "admin")


async def _get_field_or_404(
    field_id: uuid.UUID,
    org_id: uuid.UUID,
    db: AsyncSession,
) -> Field:
    field = await db.get(Field, field_id)
    if not field or field.org_id != org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


@router.get("/fields/{field_id}/soil", response_model=SoilProfileOut)
async def get_soil_profile(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return the soil profile with all layers for a field."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    result = await db.execute(
        select(SoilProfile)
        .options(selectinload(SoilProfile.layers))
        .where(SoilProfile.field_id == field_id)
        .order_by(SoilProfile.fetched_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Soil profile not yet available")

    return profile


@router.get("/fields/{field_id}/soil/summary", response_model=SoilFieldSummaryOut)
async def get_soil_summary(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return the aggregated soil summary for a field."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    result = await db.execute(
        select(SoilFieldSummary).where(SoilFieldSummary.field_id == field_id)
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Soil summary not yet available")

    return summary


@router.post(
    "/fields/{field_id}/soil/refresh",
    response_model=SoilRefreshResponse,
    status_code=202,
)
@limiter.limit("1/minute")
async def refresh_soil(
    request: Request,
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Trigger a re-fetch of soil data for a field."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    # Create a Job row for progress tracking
    job = Job(
        org_id=ctx.org_id,
        field_id=field_id,
        type="soil_fetch",
        status="pending",
        created_by=ctx.user.id,
    )
    db.add(job)
    await db.flush()

    from app.tasks.soil import fetch_soil_for_field

    fetch_soil_for_field.delay(str(field_id), str(job.id))

    logger.info(
        "soil_refresh_triggered",
        field_id=str(field_id),
        job_id=str(job.id),
        user_id=str(ctx.user.id),
    )

    return SoilRefreshResponse(
        field_id=str(field_id),
        job_id=str(job.id),
        status="accepted",
        message="Soil data refresh queued.",
    )
