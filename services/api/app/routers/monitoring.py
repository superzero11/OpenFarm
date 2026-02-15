"""Monitoring router — raster layers, field stats, tile URLs."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context
from app.models.tables import FieldStat, RasterLayer
from app.schemas.common import PaginatedResponse
from app.schemas.monitoring import FieldStatOut, RasterLayerOut

router = APIRouter()


def _cog_uri_to_s3_path(cog_uri: str) -> str:
    """Convert s3://bucket/path to /vsis3/bucket/path for TiTiler."""
    if cog_uri.startswith("s3://"):
        return cog_uri.replace("s3://", "/vsis3/")
    return cog_uri


def _layer_to_out(layer: RasterLayer) -> RasterLayerOut:
    """Convert ORM RasterLayer to RasterLayerOut with tile_url."""
    s3_path = _cog_uri_to_s3_path(layer.cog_uri)
    # URL-encode the s3 path for the TiTiler query param
    from urllib.parse import quote
    encoded_url = quote(s3_path, safe="")
    tile_url = (
        f"{settings.titiler_public_url}/cog/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}.png"
        f"?url={encoded_url}"
        f"&colormap_name=rdylgn&rescale=-0.2,0.9"
    )
    return RasterLayerOut(
        id=layer.id,
        field_id=layer.field_id,
        layer_type=layer.layer_type,
        satellite=layer.satellite,
        date=layer.date,
        cog_uri=layer.cog_uri,
        tile_url=tile_url,
        min=float(layer.min) if layer.min is not None else None,
        max=float(layer.max) if layer.max is not None else None,
        provenance_json=layer.provenance_json,
        created_at=layer.created_at,
    )


@router.get("/fields/{field_id}/layers", response_model=list[RasterLayerOut])
async def list_layers(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    type: str = Query("NDVI"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    base = select(RasterLayer).where(
        RasterLayer.field_id == field_id,
        RasterLayer.org_id == ctx.org_id,
        RasterLayer.layer_type == type,
    )
    result = await db.execute(base.order_by(RasterLayer.date.desc()).limit(limit).offset(offset))
    layers = result.scalars().all()
    return [_layer_to_out(l) for l in layers]


@router.get("/fields/{field_id}/stats", response_model=list[FieldStatOut])
async def list_stats(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    type: str = Query("NDVI"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    base = (
        select(FieldStat)
        .join(RasterLayer, FieldStat.layer_id == RasterLayer.id)
        .where(
            FieldStat.field_id == field_id,
            FieldStat.org_id == ctx.org_id,
            RasterLayer.layer_type == type,
        )
    )
    result = await db.execute(base.order_by(FieldStat.date.asc()).limit(limit).offset(offset))
    return result.scalars().all()
