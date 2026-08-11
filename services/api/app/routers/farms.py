"""Farms router - CRUD with soft-delete."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import Farm, Field
from app.schemas.common import PaginatedResponse
from app.schemas.farm import FarmCreate, FarmOut, FarmUpdate, FieldOut

router = APIRouter()

# Dependency: restrict write operations to owner/admin/member (viewers are read-only)
_writer = require_roles("owner", "admin", "member")


def _not_deleted():
    return Farm.deleted_at.is_(None)


@router.get("/farms", response_model=PaginatedResponse[FarmOut])
async def list_farms(
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    base = select(Farm).where(Farm.org_id == ctx.org_id, _not_deleted())
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    result = await db.execute(
        base.order_by(Farm.created_at.desc()).limit(limit).offset(offset)
    )
    return PaginatedResponse(
        items=result.scalars().all(), total=total, limit=limit, offset=offset
    )


@router.post("/farms", response_model=FarmOut, status_code=status.HTTP_201_CREATED)
async def create_farm(
    body: FarmCreate,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    farm = Farm(
        org_id=ctx.org_id,
        name=body.name,
        country=body.country,
        region=body.region,
        timezone=body.timezone,
    )
    db.add(farm)
    await db.flush()
    logger.info(
        "farm_created", farm_id=str(farm.id), name=body.name, org_id=str(ctx.org_id)
    )
    return farm


@router.get("/farms/{farm_id}", response_model=FarmOut)
async def get_farm(
    farm_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    farm = await db.get(Farm, farm_id)
    if not farm or farm.org_id != ctx.org_id or farm.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


@router.put("/farms/{farm_id}", response_model=FarmOut)
async def update_farm(
    farm_id: uuid.UUID,
    body: FarmUpdate,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    farm = await db.get(Farm, farm_id)
    if not farm or farm.org_id != ctx.org_id or farm.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Farm not found")

    if body.name is not None:
        farm.name = body.name
    if body.country is not None:
        farm.country = body.country
    if body.region is not None:
        farm.region = body.region
    if body.timezone is not None:
        farm.timezone = body.timezone

    await db.flush()
    return farm


@router.delete("/farms/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm(
    farm_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Soft-delete farm and cascade soft-delete all its fields."""
    farm = await db.get(Farm, farm_id)
    if not farm or farm.org_id != ctx.org_id or farm.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Farm not found")

    now = datetime.now(timezone.utc)
    farm.deleted_at = now

    # Cascade soft-delete fields (atomic bulk update)
    await db.execute(
        update(Field)
        .where(Field.farm_id == farm_id, Field.deleted_at.is_(None))
        .values(deleted_at=now)
    )

    await db.flush()


@router.get("/farms/{farm_id}/fields", response_model=PaginatedResponse[FieldOut])
async def list_farm_fields(
    farm_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    # Verify farm access
    farm = await db.get(Farm, farm_id)
    if not farm or farm.org_id != ctx.org_id or farm.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Farm not found")

    base = select(Field).where(Field.farm_id == farm_id, Field.deleted_at.is_(None))
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    result = await db.execute(
        base.order_by(Field.created_at.desc()).limit(limit).offset(offset)
    )
    return PaginatedResponse(
        items=result.scalars().all(), total=total, limit=limit, offset=offset
    )
