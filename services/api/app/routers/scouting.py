"""Scouting router — CRUD for scouting observations."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2.shape import from_shape
from shapely.geometry import shape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.geo import wkb_to_geojson
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import Field, ScoutingObservation, WeatherDaily
from app.schemas.common import PaginatedResponse
from app.schemas.monitoring import ScoutingCreate, ScoutingOut, ScoutingUpdate

router = APIRouter()

# Dependency: restrict write operations to owner/admin/member (viewers are read-only)
_writer = require_roles("owner", "admin", "member")


async def _get_weather_snapshot(
    db: AsyncSession, field_id: uuid.UUID
) -> dict | None:
    """Query recent weather data to build a snapshot JSONB for scouting."""
    today = date.today()
    start = today - timedelta(days=7)
    result = await db.execute(
        select(WeatherDaily)
        .where(
            WeatherDaily.field_id == field_id,
            WeatherDaily.date >= start,
            WeatherDaily.date <= today,
        )
        .order_by(WeatherDaily.date.desc())
    )
    rows = result.scalars().all()
    if not rows:
        return None

    latest = rows[0]
    precip_7d = sum(float(r.precipitation_sum or 0) for r in rows)
    et0_7d = sum(float(r.et0_fao_mm or 0) for r in rows)

    ctx: dict = {
        "date": today.isoformat(),
        "period": f"{start.isoformat()} to {today.isoformat()}",
        "precipitation_7d_mm": round(precip_7d, 1),
        "et0_7d_mm": round(et0_7d, 1),
    }
    if latest.temperature_2m_max is not None:
        ctx["temp_max_c"] = round(float(latest.temperature_2m_max), 1)
    if latest.temperature_2m_min is not None:
        ctx["temp_min_c"] = round(float(latest.temperature_2m_min), 1)
    if latest.soil_moisture_0_1cm is not None:
        ctx["soil_moisture_top"] = round(float(latest.soil_moisture_0_1cm), 3)
    if latest.wind_speed_10m_max is not None:
        ctx["wind_max_kmh"] = round(float(latest.wind_speed_10m_max), 1)
    if latest.drought_index is not None:
        ctx["drought_index"] = round(float(latest.drought_index), 2)
    return ctx


def _obs_to_out(obs: ScoutingObservation) -> ScoutingOut:
    return ScoutingOut(
        id=obs.id,
        field_id=obs.field_id,
        alert_id=obs.alert_id,
        geom_point=wkb_to_geojson(obs.geom_point),
        title=obs.title,
        note=obs.note,
        tags=obs.tags_json,
        photo_uri=obs.photo_uri,
        weather_snapshot=obs.weather_snapshot,
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
    ctx: Annotated[OrgContext, Depends(_writer)],
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

    # Build weather snapshot from recent weather data
    weather_snapshot = await _get_weather_snapshot(db, field_id)

    obs = ScoutingObservation(
        org_id=ctx.org_id,
        field_id=field_id,
        alert_id=body.alert_id,
        geom_point=from_shape(point, srid=4326),
        title=body.title,
        note=body.note,
        tags_json=body.tags,
        photo_uri=body.photo_uri,
        weather_snapshot=weather_snapshot,
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
    ctx: Annotated[OrgContext, Depends(_writer)],
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
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    obs = await db.get(ScoutingObservation, obs_id)
    if not obs or obs.org_id != ctx.org_id or obs.field_id != field_id:
        raise HTTPException(status_code=404, detail="Scouting observation not found")
    await db.delete(obs)
