"""Jobs router — create NDVI job, get job status."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context
from app.models.tables import Field, Job
from app.schemas.monitoring import JobCreateNDVI, JobOut

router = APIRouter()


@router.post("/fields/{field_id}/jobs/ndvi", response_model=JobOut, status_code=201)
async def create_ndvi_job(
    field_id: uuid.UUID,
    body: JobCreateNDVI,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify field belongs to org
    field = await db.get(Field, field_id)
    if not field or field.org_id != ctx.org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")

    # Max 60-day range
    delta = (body.date_to - body.date_from).days
    if delta < 0:
        raise HTTPException(status_code=400, detail="date_to must be >= date_from")
    if delta > 60:
        raise HTTPException(status_code=400, detail="Date range max 60 days")

    job = Job(
        org_id=ctx.org_id,
        field_id=field_id,
        type="ndvi",
        status="pending",
        params_json={"date_from": str(body.date_from), "date_to": str(body.date_to)},
        created_by=ctx.user.id,
    )
    db.add(job)
    await db.flush()

    # Dispatch Celery task
    try:
        from app.worker import celery_app

        celery_app.send_task(
            "app.tasks.ndvi.process_ndvi",
            args=[str(job.id)],
        )
        logger.info("ndvi_job_dispatched", job_id=str(job.id), field_id=str(field_id))
    except Exception as e:
        logger.error("ndvi_job_dispatch_failed", job_id=str(job.id), error=str(e))
        pass

    return job


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
