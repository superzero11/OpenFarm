"""Fields router — CRUD, import, with geometry handling."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon, shape
from shapely.validation import explain_validity
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.geo import wkb_to_geojson
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import AuditEvent, Farm, Field
from app.schemas.farm import FieldCreate, FieldImportResponse, FieldOut, FieldUpdate

router = APIRouter()

# Dependency: restrict write operations to owner/admin/member (viewers are read-only)
_writer = require_roles("owner", "admin", "member")


def _geojson_to_multi(geojson: dict[str, Any]) -> MultiPolygon:
    """Convert GeoJSON geometry to Shapely MultiPolygon (auto-wrap Polygon)."""
    geom = shape(geojson)
    if geom.geom_type == "Polygon":
        geom = MultiPolygon([geom])
    elif geom.geom_type != "MultiPolygon":
        raise ValueError(f"Expected Polygon or MultiPolygon, got {geom.geom_type}")
    if not geom.is_valid:
        raise ValueError(f"Invalid geometry: {explain_validity(geom)}")
    return geom


def _field_to_out(field: Field) -> FieldOut:
    """Convert ORM Field to FieldOut with GeoJSON geometry."""
    return FieldOut(
        id=field.id,
        org_id=field.org_id,
        farm_id=field.farm_id,
        name=field.name,
        geom=wkb_to_geojson(field.geom),
        area_ha=float(field.area_ha) if field.area_ha else None,
        crop_type=field.crop_type,
        season=field.season,
        tags=field.tags_json,
        created_by=field.created_by,
        created_at=field.created_at,
        updated_at=field.updated_at,
    )


@router.post("/fields", response_model=FieldOut, status_code=status.HTTP_201_CREATED)
async def create_field(
    body: FieldCreate,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify farm belongs to org
    farm = await db.get(Farm, body.farm_id)
    if not farm or farm.org_id != ctx.org_id or farm.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Farm not found")

    try:
        multi = _geojson_to_multi(body.geom)
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"Invalid geometry: {e}")

    # Compute area in hectares (approximate using geodesic area)
    from shapely.ops import transform
    import pyproj

    project = pyproj.Transformer.from_crs(
        "EPSG:4326", "EPSG:6933", always_xy=True
    ).transform
    area_m2 = transform(project, multi).area
    area_ha = area_m2 / 10_000

    field = Field(
        org_id=ctx.org_id,
        farm_id=body.farm_id,
        name=body.name,
        geom=from_shape(multi, srid=4326),
        area_ha=round(area_ha, 4),
        crop_type=body.crop_type,
        season=body.season,
        tags_json=body.tags,
        created_by=ctx.user.id,
    )
    db.add(field)
    await db.flush()

    # Audit event: field_created (per PRD Section 5.1)
    db.add(
        AuditEvent(
            org_id=ctx.org_id,
            user_id=ctx.user.id,
            event_type="field_created",
            metadata_json={
                "field_id": str(field.id),
                "farm_id": str(body.farm_id),
                "name": body.name,
            },
        )
    )
    await db.flush()
    logger.info(
        "field_created",
        field_id=str(field.id),
        farm_id=str(body.farm_id),
        name=body.name,
    )
    return _field_to_out(field)


@router.get("/fields/{field_id}", response_model=FieldOut)
async def get_field(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")
    return _field_to_out(field)


@router.put("/fields/{field_id}", response_model=FieldOut)
async def update_field(
    field_id: uuid.UUID,
    body: FieldUpdate,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")

    if body.name is not None:
        field.name = body.name
    if body.crop_type is not None:
        field.crop_type = body.crop_type
    if body.season is not None:
        field.season = body.season
    if body.tags is not None:
        field.tags_json = body.tags
    if body.geom is not None:
        try:
            multi = _geojson_to_multi(body.geom)
        except (ValueError, Exception) as e:
            raise HTTPException(status_code=400, detail=f"Invalid geometry: {e}")
        field.geom = from_shape(multi, srid=4326)

        # Recompute area
        from shapely.ops import transform
        import pyproj

        project = pyproj.Transformer.from_crs(
            "EPSG:4326", "EPSG:6933", always_xy=True
        ).transform
        area_m2 = transform(project, multi).area
        field.area_ha = round(area_m2 / 10_000, 4)

    await db.flush()
    return _field_to_out(field)


@router.delete("/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")
    field.deleted_at = datetime.now(timezone.utc)
    await db.flush()


@router.post("/fields/import", response_model=FieldImportResponse)
async def import_fields(
    file: UploadFile,
    farm_id: uuid.UUID = Query(...),
    ctx: OrgContext = Depends(_writer),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import fields from GeoJSON file."""
    farm = await db.get(Farm, farm_id)
    if not farm or farm.org_id != ctx.org_id or farm.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Farm not found")

    content = await file.read()
    try:
        geojson = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    features = geojson.get("features", [])
    if not features:
        raise HTTPException(status_code=400, detail="No features found in GeoJSON")

    imported = 0
    errors: list[str] = []

    for i, feature in enumerate(features):
        try:
            geom = feature.get("geometry")
            props = feature.get("properties", {})
            name = props.get("name", f"Field {i + 1}")

            multi = _geojson_to_multi(geom)

            from shapely.ops import transform
            import pyproj

            project = pyproj.Transformer.from_crs(
                "EPSG:4326", "EPSG:6933", always_xy=True
            ).transform
            area_m2 = transform(project, multi).area
            area_ha = round(area_m2 / 10_000, 4)

            field = Field(
                org_id=ctx.org_id,
                farm_id=farm_id,
                name=name,
                geom=from_shape(multi, srid=4326),
                area_ha=area_ha,
                crop_type=props.get("crop_type"),
                season=props.get("season"),
                created_by=ctx.user.id,
            )
            db.add(field)
            imported += 1
        except Exception as e:
            errors.append(f"Feature {i}: {e}")

    if imported:
        await db.flush()

    return FieldImportResponse(imported=imported, errors=errors)
