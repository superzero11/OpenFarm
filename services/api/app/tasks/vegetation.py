"""Vegetation index tasks - EVI, SAVI, NDWI.

Each task follows the same 7-step pipeline as NDVI but uses the
index registry for formula selection, band resolution, and alert defaults.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

import structlog

from app.worker import celery_app
from app.tasks.indices import get_index
from app.tasks.pipeline import (
    RETRY_DELAYS,
    get_db_session,
    update_job_progress,
    complete_step,
    search_scenes,
    compute_target_grid,
    process_scene,
)

logger = structlog.get_logger()


# ── Generic index processor ──────────────────────────────────────────


def _run_index_pipeline(self, job_id: str, index_key: str) -> dict:
    """Shared entry-point logic for any vegetation-index Celery task."""
    from app.models.tables import Job, Field, FieldStat

    index_def = get_index(index_key)
    session = get_db_session()
    try:
        job = session.get(Job, uuid.UUID(job_id))
        if not job:
            logger.error("job_not_found", job_id=job_id, index=index_key)
            return {"job_id": job_id, "status": "error", "detail": "Job not found"}

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.progress_json = {"current_step": "scene_search", "steps": {}}
        session.commit()

        field = session.get(Field, job.field_id)
        if not field:
            job.status = "failed"
            job.error = "Field not found"
            job.finished_at = datetime.now(timezone.utc)
            session.commit()
            return {"job_id": job_id, "status": "failed"}

        field_geom = to_shape(field.geom)
        field_geom_geojson = mapping(field_geom)

        params = job.params_json or {}
        date_from = date.fromisoformat(params["date_from"])
        date_to = date.fromisoformat(params["date_to"])
        org_id_str = str(job.org_id)
        field_id_str = str(job.field_id)

        # Extra params (e.g. savi_l)
        extra_params = {
            k: v for k, v in params.items() if k not in ("date_from", "date_to")
        }

        # Step 1: Scene Search
        update_job_progress(session, job, "scene_search")
        scenes = search_scenes(field_geom_geojson, date_from, date_to, index_def)
        complete_step(session, job, "scene_search", {"scene_count": len(scenes)})

        if not scenes:
            job.status = "completed"
            job.finished_at = datetime.now(timezone.utc)
            progress = job.progress_json or {}
            progress["current_step"] = "complete"
            progress["message"] = "No cloud-free scenes found for the date range."
            progress["layers_created"] = 0
            job.progress_json = progress
            flag_modified(job, "progress_json")
            session.commit()
            return {"job_id": job_id, "status": "completed", "scenes": 0}

        # Compute target grid
        target_transform, target_shape, field_mask, bounds = compute_target_grid(
            field_geom.bounds, field_geom
        )

        # Historical means for alerts
        existing_stats = (
            session.execute(
                select(FieldStat.mean)
                .where(FieldStat.field_id == job.field_id)
                .order_by(FieldStat.date.asc())
            )
            .scalars()
            .all()
        )
        historical_means = [float(m) for m in existing_stats if m is not None]

        layers_created = 0

        # Steps 2-6: Process each scene
        for i, scene in enumerate(scenes):
            try:
                result = process_scene(
                    session=session,
                    job=job,
                    scene=scene,
                    scene_idx=i,
                    total_scenes=len(scenes),
                    index_def=index_def,
                    target_transform=target_transform,
                    target_shape=target_shape,
                    field_mask=field_mask,
                    bounds=bounds,
                    org_id_str=org_id_str,
                    field_id_str=field_id_str,
                    date_from=date_from,
                    date_to=date_to,
                    historical_means=historical_means,
                    extra_params=extra_params,
                )
                if result is not None:
                    layers_created += 1
            except Exception as e:
                logger.error(
                    "scene_processing_error",
                    scene_id=scene["id"],
                    index=index_key,
                    error=str(e),
                )
                continue

        # Step 7: Complete
        job.status = "completed"
        job.finished_at = datetime.now(timezone.utc)
        progress = job.progress_json or {}
        progress["current_step"] = "complete"
        progress["layers_created"] = layers_created
        progress["total_scenes"] = len(scenes)
        job.progress_json = progress
        flag_modified(job, "progress_json")
        session.commit()

        logger.info(
            f"{index_key}_job_completed",
            job_id=job_id,
            layers_created=layers_created,
        )
        return {
            "job_id": job_id,
            "status": "completed",
            "layers_created": layers_created,
        }

    except Exception as e:
        logger.error(f"{index_key}_job_failed", job_id=job_id, error=str(e))
        try:
            job = session.get(Job, uuid.UUID(job_id))
            if job:
                job.status = "failed"
                job.error = str(e)
                job.finished_at = datetime.now(timezone.utc)
                session.commit()
        except Exception:
            pass
        retry_num = self.request.retries
        if retry_num < len(RETRY_DELAYS):
            raise self.retry(exc=e, countdown=RETRY_DELAYS[retry_num])
        raise

    finally:
        session.close()


# ── EVI ──────────────────────────────────────────────────────────────


@celery_app.task(
    name="app.tasks.vegetation.process_evi",
    bind=True,
    max_retries=3,
    time_limit=1800,
    soft_time_limit=1500,
)
def process_evi(self, job_id: str) -> dict:
    """Process EVI for a field."""
    return _run_index_pipeline(self, job_id, "evi")


# ── SAVI ─────────────────────────────────────────────────────────────


@celery_app.task(
    name="app.tasks.vegetation.process_savi",
    bind=True,
    max_retries=3,
    time_limit=1800,
    soft_time_limit=1500,
)
def process_savi(self, job_id: str) -> dict:
    """Process SAVI for a field."""
    return _run_index_pipeline(self, job_id, "savi")


# ── NDWI ─────────────────────────────────────────────────────────────


@celery_app.task(
    name="app.tasks.vegetation.process_ndwi",
    bind=True,
    max_retries=3,
    time_limit=1800,
    soft_time_limit=1500,
)
def process_ndwi(self, job_id: str) -> dict:
    """Process NDWI for a field."""
    return _run_index_pipeline(self, job_id, "ndwi")
