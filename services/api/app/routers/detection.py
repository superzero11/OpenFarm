"""Detection router — trigger boundary detection, list/accept/discard results."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

import pyproj
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import MultiPolygon, shape
from shapely.ops import transform
from shapely.validation import explain_validity
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.geo import wkb_to_geojson
from app.core.logging import logger
from app.core.rate_limit import limiter
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import AuditEvent, DetectedBoundary, Farm, Field, Job
from app.schemas.common import PaginatedResponse
from app.schemas.detection import (
    AcceptBoundaryRequest,
    DetectBoundariesRequest,
    DetectedBoundaryOut,
)

router = APIRouter()

_writer = require_roles("owner", "admin", "member")


def _boundary_to_out(b: DetectedBoundary) -> DetectedBoundaryOut:
    """Convert ORM DetectedBoundary to response schema."""
    return DetectedBoundaryOut(
        id=b.id,
        org_id=b.org_id,
        job_id=b.job_id,
        geom=wkb_to_geojson(b.geom),
        area_ha=float(b.area_ha) if b.area_ha else None,
        confidence=float(b.confidence) if b.confidence is not None else None,
        status=b.status,
        detection_date=b.detection_date,
        created_at=b.created_at,
    )


def _geojson_to_multi(geojson: dict[str, Any]) -> MultiPolygon:
    """Convert GeoJSON geometry to Shapely MultiPolygon."""
    geom = shape(geojson)
    if geom.geom_type == "Polygon":
        geom = MultiPolygon([geom])
    elif geom.geom_type != "MultiPolygon":
        raise ValueError(f"Expected Polygon or MultiPolygon, got {geom.geom_type}")
    if not geom.is_valid:
        raise ValueError(f"Invalid geometry: {explain_validity(geom)}")
    return geom


# ── Trigger detection ────────────────────────────────────────────────


@router.post(
    "/orgs/{org_id}/detect-boundaries",
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("2/minute")
async def trigger_detection(
    request: Request,
    org_id: uuid.UUID,
    body: DetectBoundariesRequest,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a boundary detection job for a geographic area."""
    if ctx.org_id != org_id:
        raise HTTPException(status_code=403, detail="Org mismatch")

    # Verify farm belongs to org
    farm = await db.get(Farm, body.farm_id)
    if not farm or farm.org_id != ctx.org_id or farm.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Farm not found")

    # Validate bbox area server-side
    from shapely.geometry import Polygon as ShapelyPolygon
    from shapely.ops import transform as shapely_transform

    minx, miny, maxx, maxy = body.bbox
    corners = ShapelyPolygon(
        [(minx, miny), (maxx, miny), (maxx, maxy), (minx, maxy), (minx, miny)]
    )
    project = pyproj.Transformer.from_crs(
        "EPSG:4326", "EPSG:6933", always_xy=True
    ).transform
    area_km2 = shapely_transform(project, corners).area / 1e6
    if area_km2 > settings.detection_max_area_km2:
        raise HTTPException(
            status_code=400,
            detail=f"Bbox area {area_km2:.1f} km² exceeds limit of {settings.detection_max_area_km2} km²",
        )

    # Create job — field_id is nullable for detection jobs, use a sentinel approach:
    # detection jobs don't have a single field_id, so we store bbox in params_json.
    # The Job model requires field_id, so we must handle this.
    # For detection jobs, we'll use a "virtual" association via farm_id in params.
    params = {
        "bbox": body.bbox,
        "farm_id": str(body.farm_id),
    }
    if body.window_a:
        params["window_a"] = body.window_a
    if body.window_b:
        params["window_b"] = body.window_b

    job = Job(
        org_id=ctx.org_id,
        field_id=None,  # area-based detection jobs don't target a specific field
        type="boundary_detection",
        status="pending",
        params_json=params,
        created_by=ctx.user.id,
    )
    db.add(job)
    await db.flush()

    # Dispatch to ml queue
    from app.worker import celery_app

    celery_app.send_task(
        "app.tasks.detection.detect_field_boundaries",
        args=[str(job.id)],
        queue="ml",
    )

    logger.info(
        "detection_job_dispatched",
        job_id=str(job.id),
        org_id=str(ctx.org_id),
        bbox=body.bbox,
    )

    db.add(
        AuditEvent(
            org_id=ctx.org_id,
            user_id=ctx.user.id,
            event_type="detection_triggered",
            metadata_json={"job_id": str(job.id), "bbox": body.bbox},
        )
    )
    await db.commit()

    return {"job_id": str(job.id), "status": "pending"}


# ── List detected boundaries ────────────────────────────────────────


@router.get(
    "/orgs/{org_id}/detected-boundaries",
    response_model=PaginatedResponse[DetectedBoundaryOut],
)
async def list_detected_boundaries(
    org_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    job_id: uuid.UUID | None = Query(None),
    boundary_status: str | None = Query(None, alias="status"),
    farm_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List detected boundaries for an org, with optional filters."""
    if ctx.org_id != org_id:
        raise HTTPException(status_code=403, detail="Org mismatch")

    query = (
        select(DetectedBoundary)
        .where(DetectedBoundary.org_id == org_id)
        .where(DetectedBoundary.deleted_at.is_(None))
    )
    count_query = (
        select(func.count(DetectedBoundary.id))
        .where(DetectedBoundary.org_id == org_id)
        .where(DetectedBoundary.deleted_at.is_(None))
    )

    if job_id:
        query = query.where(DetectedBoundary.job_id == job_id)
        count_query = count_query.where(DetectedBoundary.job_id == job_id)
    if boundary_status:
        query = query.where(DetectedBoundary.status == boundary_status)
        count_query = count_query.where(DetectedBoundary.status == boundary_status)

    total = (await db.execute(count_query)).scalar() or 0

    query = (
        query.order_by(DetectedBoundary.created_at.desc()).offset(offset).limit(limit)
    )
    result = await db.execute(query)
    boundaries = result.scalars().all()

    return PaginatedResponse(
        items=[_boundary_to_out(b) for b in boundaries],
        total=total,
        limit=limit,
        offset=offset,
    )


# ── Accept boundary (promote to field) ──────────────────────────────


@router.post(
    "/orgs/{org_id}/detected-boundaries/{boundary_id}/accept",
    status_code=status.HTTP_201_CREATED,
)
async def accept_boundary(
    org_id: uuid.UUID,
    boundary_id: uuid.UUID,
    body: AcceptBoundaryRequest,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept a detected boundary — creates a new field."""
    if ctx.org_id != org_id:
        raise HTTPException(status_code=403, detail="Org mismatch")

    boundary = await db.get(DetectedBoundary, boundary_id)
    if not boundary or boundary.org_id != ctx.org_id or boundary.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Detected boundary not found")

    if boundary.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Boundary already {boundary.status}",
        )

    # Verify farm belongs to org
    farm = await db.get(Farm, body.farm_id)
    if not farm or farm.org_id != ctx.org_id or farm.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Farm not found")

    # Use provided geometry (edit-and-accept) or boundary's original geometry
    if body.geom:
        try:
            multi = _geojson_to_multi(body.geom)
        except (ValueError, Exception) as e:
            raise HTTPException(status_code=400, detail=f"Invalid geometry: {e}")
    else:
        multi = (
            MultiPolygon([to_shape(boundary.geom)])
            if to_shape(boundary.geom).geom_type == "Polygon"
            else to_shape(boundary.geom)
        )

    # Compute area
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
        created_by=ctx.user.id,
    )
    db.add(field)
    await db.flush()

    # Update boundary status
    boundary.status = "accepted"
    boundary.accepted_field_id = field.id
    await db.flush()

    db.add(
        AuditEvent(
            org_id=ctx.org_id,
            user_id=ctx.user.id,
            event_type="boundary_accepted",
            metadata_json={
                "boundary_id": str(boundary_id),
                "field_id": str(field.id),
                "farm_id": str(body.farm_id),
            },
        )
    )
    await db.commit()

    logger.info(
        "boundary_accepted",
        boundary_id=str(boundary_id),
        field_id=str(field.id),
    )

    return {"field_id": str(field.id), "area_ha": round(area_ha, 4)}


# ── Discard boundary ────────────────────────────────────────────────


@router.post(
    "/orgs/{org_id}/detected-boundaries/{boundary_id}/discard",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def discard_boundary(
    org_id: uuid.UUID,
    boundary_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Discard a detected boundary."""
    if ctx.org_id != org_id:
        raise HTTPException(status_code=403, detail="Org mismatch")

    boundary = await db.get(DetectedBoundary, boundary_id)
    if not boundary or boundary.org_id != ctx.org_id or boundary.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Detected boundary not found")

    if boundary.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Boundary already {boundary.status}",
        )

    boundary.status = "discarded"
    await db.commit()
