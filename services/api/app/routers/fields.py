"""Fields router — CRUD, import, with geometry handling."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon, shape
from shapely.validation import explain_validity
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.geo import wkb_to_geojson
from app.core.logging import logger
from app.core.rate_limit import limiter
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import AuditEvent, Farm, Field, Job
from app.schemas.farm import (
    BackfillIndicesRequest,
    BackfillIndicesResponse,
    BackfillStatusResponse,
    FieldCreate,
    FieldImportResponse,
    FieldOut,
    FieldUpdate,
)

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

    # Trigger weather backfill for new field (90 days of history)
    from app.tasks.weather import backfill_weather_for_field

    backfill_weather_for_field.delay(str(field.id))

    # Trigger index backfill for new field (24 months of all vegetation indices)
    # Create a sentinel job so the backfill-status endpoint immediately
    # reports an active backfill (avoids race with async task startup).
    sentinel = Job(
        org_id=ctx.org_id,
        field_id=field.id,
        type="backfill",
        status="pending",
        params_json={"is_backfill": True, "sentinel": True},
        created_by=ctx.user.id,
    )
    db.add(sentinel)
    await db.flush()

    from app.tasks.backfill import backfill_indices_for_field

    backfill_indices_for_field.delay(str(field.id), sentinel_job_id=str(sentinel.id))

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


# ── Manual index backfill ────────────────────────────────────────────

_admin = require_roles("owner", "admin")


@router.post(
    "/fields/{field_id}/backfill-indices",
    response_model=BackfillIndicesResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("1/minute")
async def backfill_field_indices(
    request: Request,
    field_id: uuid.UUID,
    body: BackfillIndicesRequest | None = None,
    ctx: OrgContext = Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trigger historical index backfill for one field (admin/owner only)."""
    from sqlalchemy import select as sa_select

    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")

    # Check for existing pending/running backfill jobs
    active_count = (
        (
            await db.execute(
                sa_select(Job.id).where(
                    Job.field_id == field_id,
                    Job.status.in_(["pending", "running"]),
                    Job.params_json["is_backfill"].as_boolean().is_(True),
                )
            )
        )
        .scalars()
        .all()
    )
    if active_count:
        raise HTTPException(
            status_code=409,
            detail=f"Backfill already in progress ({len(active_count)} jobs pending/running).",
        )

    months = body.months if body else 24

    # Create sentinel job so status endpoint immediately reflects active backfill
    sentinel = Job(
        org_id=ctx.org_id,
        field_id=field_id,
        type="backfill",
        status="pending",
        params_json={"is_backfill": True, "sentinel": True},
        created_by=ctx.user.id,
    )
    db.add(sentinel)
    await db.flush()

    from app.tasks.backfill import backfill_indices_for_field

    backfill_indices_for_field.delay(
        str(field_id), months=months, sentinel_job_id=str(sentinel.id)
    )

    return BackfillIndicesResponse(
        field_id=field_id,
        status="dispatched",
        message=f"Backfill of {months} months started. Data will appear over the next few hours.",
    )


@router.get(
    "/fields/{field_id}/backfill-status",
    response_model=BackfillStatusResponse,
)
async def get_backfill_status(
    field_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
    db: AsyncSession = Depends(get_db),
):
    """Check whether a backfill is active for this field."""
    from sqlalchemy import func, select as sa_select

    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")

    rows = (
        await db.execute(
            sa_select(
                func.count().filter(Job.status == "pending").label("pending"),
                func.count().filter(Job.status == "running").label("running"),
                func.count().filter(Job.status == "completed").label("completed"),
            ).where(
                Job.field_id == field_id,
                Job.params_json["is_backfill"].as_boolean().is_(True),
            )
        )
    ).one()

    return BackfillStatusResponse(
        field_id=field_id,
        has_active_backfill=(rows.pending + rows.running) > 0,
        pending_jobs=rows.pending,
        running_jobs=rows.running,
        completed_jobs=rows.completed,
    )


@router.post(
    "/admin/backfill-all-fields",
    status_code=status.HTTP_202_ACCEPTED,
)
async def backfill_all_fields(
    request: Request,
    body: BackfillIndicesRequest | None = None,
    ctx: OrgContext = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
):
    """Trigger backfill for ALL active fields (owner only, one-time migration)."""
    months = body.months if body else 24

    from app.tasks.backfill import backfill_all_existing_fields

    backfill_all_existing_fields.delay(months=months)

    return {
        "status": "dispatched",
        "message": f"Bulk backfill of {months} months dispatched for all active fields.",
    }
