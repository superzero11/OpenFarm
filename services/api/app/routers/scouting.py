"""Scouting router — CRUD for scouting observations."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping, shape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context
from app.models.tables import Field, ScoutingObservation
from app.schemas.common import PaginatedResponse
from app.schemas.monitoring import ScoutingCreate, ScoutingOut, ScoutingUpdate

router = APIRouter()


def _obs_to_out(obs: ScoutingObservation) -> ScoutingOut:
    geom_json = None
    if obs.geom_point is not None:
        try:
            geom_json = mapping(to_shape(obs.geom_point))
        except Exception:
            pass

    return ScoutingOut(
        id=obs.id,
        field_id=obs.field_id,
        alert_id=obs.alert_id,
        geom_point=geom_json,
        title=obs.title,
        note=obs.note,
        tags=obs.tags_json,
        photo_uri=obs.photo_uri,
        created_by=obs.created_by,
        created_at=obs.created_at,
    )


@router.get(
    "/fields/{field_id}/scouting", response_model=PaginatedResponse[ScoutingOut]
)
async def list_scouting(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    base = select(ScoutingObservation).where(
        ScoutingObservation.field_id == field_id,
        ScoutingObservation.org_id == ctx.org_id,
    )
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    result = await db.execute(
        base.order_by(ScoutingObservation.created_at.desc()).limit(limit).offset(offset)
    )
    return PaginatedResponse(
        items=[_obs_to_out(o) for o in result.scalars().all()],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/fields/{field_id}/scouting",
    response_model=ScoutingOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_scouting(
    field_id: uuid.UUID,
    body: ScoutingCreate,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")

    try:
        point = shape(body.geom_point)
        if point.geom_type != "Point":
            raise ValueError("Expected Point geometry")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid geometry: {e}")

    obs = ScoutingObservation(
        org_id=ctx.org_id,
        field_id=field_id,
        alert_id=body.alert_id,
        geom_point=from_shape(point, srid=4326),
        title=body.title,
        note=body.note,
        tags_json=body.tags,
        photo_uri=body.photo_uri,
        created_by=ctx.user.id,
    )
    db.add(obs)
    await db.flush()
    logger.info("scouting_created", obs_id=str(obs.id), field_id=str(field_id))
    return _obs_to_out(obs)


@router.patch("/fields/{field_id}/scouting/{obs_id}", response_model=ScoutingOut)
async def update_scouting(
    field_id: uuid.UUID,
    obs_id: uuid.UUID,
    body: ScoutingUpdate,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    obs = await db.get(ScoutingObservation, obs_id)
    if not obs or obs.org_id != ctx.org_id or obs.field_id != field_id:
        raise HTTPException(status_code=404, detail="Scouting observation not found")

    if body.title is not None:
        obs.title = body.title
    if body.note is not None:
        obs.note = body.note
    if body.tags is not None:
        obs.tags_json = body.tags

    await db.flush()
    return _obs_to_out(obs)


@router.delete(
    "/fields/{field_id}/scouting/{obs_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_scouting(
    field_id: uuid.UUID,
    obs_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    obs = await db.get(ScoutingObservation, obs_id)
    if not obs or obs.org_id != ctx.org_id or obs.field_id != field_id:
        raise HTTPException(status_code=404, detail="Scouting observation not found")
    await db.delete(obs)
