"""Jobs router — create vegetation index jobs, get job status."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.core.rate_limit import limiter
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import Field, Job
from app.schemas.monitoring import JobCreateIndex, JobCreateNDVI, JobOut
from app.tasks.indices import INDEX_REGISTRY

router = APIRouter()

# Dependency: restrict write operations to owner/admin/member (viewers are read-only)
_writer = require_roles("owner", "admin", "member")

# Derive task names from the index registry — single source of truth.
# The ndvi task lives in its own legacy module; others share the vegetation module.
_INDEX_TASK_MAP = {
    key: f"app.tasks.{'ndvi' if key == 'ndvi' else 'vegetation'}.process_{key}"
    for key in INDEX_REGISTRY
}


async def _create_index_job(
    field_id: uuid.UUID,
    index_type: str,
    date_from: str,
    date_to: str,
    ctx: OrgContext,
    db: AsyncSession,
    extra_params: dict | None = None,
) -> Job:
    """Shared logic: validate field, create Job row, dispatch Celery task."""
    from datetime import date as date_type

    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")

    d_from = date_type.fromisoformat(date_from)
    d_to = date_type.fromisoformat(date_to)
    delta = (d_to - d_from).days
    if delta < 0:
        raise HTTPException(status_code=400, detail="date_to must be >= date_from")
    if delta > 180:
        raise HTTPException(status_code=400, detail="Date range max 180 days")

    params_json = {"date_from": date_from, "date_to": date_to}
    if extra_params:
        params_json.update(extra_params)

    job = Job(
        org_id=ctx.org_id,
        field_id=field_id,
        type=index_type,
        status="pending",
        params_json=params_json,
        created_by=ctx.user.id,
    )
    db.add(job)
    await db.flush()

    task_name = _INDEX_TASK_MAP.get(index_type)
    if not task_name:
        raise HTTPException(status_code=400, detail=f"Unknown index type: {index_type}")
    try:
        from app.worker import celery_app

        celery_app.send_task(task_name, args=[str(job.id)])
        logger.info(
            "index_job_dispatched",
            job_id=str(job.id),
            field_id=str(field_id),
            index_type=index_type,
        )
    except Exception as e:
        logger.error(
            "index_job_dispatch_failed",
            job_id=str(job.id),
            index_type=index_type,
            error=str(e),
        )

    return job


# ── Generalized index endpoint ───────────────────────────────────────


@router.post("/fields/{field_id}/jobs/index", response_model=JobOut, status_code=201)
@limiter.limit("5/minute")
async def create_index_job(
    request: Request,
    field_id: uuid.UUID,
    body: JobCreateIndex,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    extra = {}
    if body.index_type == "savi" and body.savi_l is not None:
        extra["savi_l"] = body.savi_l

    return await _create_index_job(
        field_id=field_id,
        index_type=body.index_type,
        date_from=str(body.date_from),
        date_to=str(body.date_to),
        ctx=ctx,
        db=db,
        extra_params=extra or None,
    )


# ── Backward-compatible NDVI endpoint ────────────────────────────────


@router.post("/fields/{field_id}/jobs/ndvi", response_model=JobOut, status_code=201)
@limiter.limit("5/minute")
async def create_ndvi_job(
    request: Request,
    field_id: uuid.UUID,
    body: JobCreateNDVI,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await _create_index_job(
        field_id=field_id,
        index_type="ndvi",
        date_from=str(body.date_from),
        date_to=str(body.date_to),
        ctx=ctx,
        db=db,
    )


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(
    job_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    job = await db.get(Job, job_id)
    if not job or job.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
