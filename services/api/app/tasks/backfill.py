"""Historical index backfill - orchestration layer.

Chunks a multi-month date range into segments, creates one Job per
(chunk × index) pair, and dispatches them with staggered countdowns
to avoid overwhelming the STAC API.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import select

import structlog

from app.core.config import settings
from app.tasks.indices import INDEX_REGISTRY, INDEX_TASK_MAP
from app.tasks.pipeline import get_db_session
from app.worker import celery_app

logger = structlog.get_logger()


def _date_chunks(start: date, end: date, chunk_days: int) -> list[tuple[date, date]]:
    """Split [start, end] into non-overlapping segments of chunk_days."""
    chunks: list[tuple[date, date]] = []
    cursor = start
    while cursor < end:
        chunk_end = min(cursor + timedelta(days=chunk_days - 1), end)
        chunks.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return chunks


@celery_app.task(
    name="app.tasks.backfill.backfill_indices_for_field",
    bind=True,
    max_retries=1,
    time_limit=120,
    soft_time_limit=90,
)
def backfill_indices_for_field(
    self,
    field_id: str,
    months: int | None = None,
    sentinel_job_id: str | None = None,
) -> dict:
    """Backfill all 4 vegetation indices for *field_id* over *months*.

    Splits the date range into 90-day chunks and dispatches one
    pipeline job per (chunk × index) with staggered countdowns.
    """
    from app.models.tables import Field, Job, RasterLayer

    months = months or settings.index_backfill_months
    chunk_days = settings.index_backfill_chunk_days

    session = get_db_session()
    try:
        field = session.get(Field, uuid.UUID(field_id))
        if not field:
            logger.error("backfill_field_not_found", field_id=field_id)
            return {
                "field_id": field_id,
                "status": "error",
                "detail": "Field not found",
            }

        org_id = field.org_id

        end_date = date.today()
        start_date = end_date - timedelta(days=months * 30)

        # Determine which dates already have computed layers (per index)
        existing_dates: dict[str, set[date]] = {}
        for idx_key in INDEX_REGISTRY:
            idx_def = INDEX_REGISTRY[idx_key]
            rows = (
                session.execute(
                    select(RasterLayer.date).where(
                        RasterLayer.field_id == field.id,
                        RasterLayer.layer_type == idx_def.label,
                    )
                )
                .scalars()
                .all()
            )
            existing_dates[idx_key] = {d for d in rows if d is not None}

        chunks = _date_chunks(start_date, end_date, chunk_days)
        jobs_dispatched = 0
        chunks_skipped = 0
        stagger_seconds = 30  # seconds between chunk groups

        for chunk_idx, (chunk_start, chunk_end) in enumerate(chunks):
            # Skip chunk if all indices already have data within its range
            indices_covered = 0
            for idx_key in INDEX_REGISTRY:
                dates = existing_dates.get(idx_key, set())
                if any(chunk_start <= d <= chunk_end for d in dates):
                    indices_covered += 1
            if indices_covered == len(INDEX_REGISTRY):
                chunks_skipped += 1
                logger.info(
                    "backfill_chunk_skipped",
                    field_id=field_id,
                    chunk=f"{chunk_start} → {chunk_end}",
                    reason="all indices have data",
                )
                continue

            for idx_key in sorted(INDEX_REGISTRY.keys()):
                task_name = INDEX_TASK_MAP.get(idx_key)
                if not task_name:
                    continue

                # Skip individual index if it already has data in this chunk
                dates = existing_dates.get(idx_key, set())
                if any(chunk_start <= d <= chunk_end for d in dates):
                    logger.info(
                        "backfill_index_skipped",
                        field_id=field_id,
                        index=idx_key,
                        chunk=f"{chunk_start} → {chunk_end}",
                    )
                    continue

                params_json = {
                    "date_from": chunk_start.isoformat(),
                    "date_to": chunk_end.isoformat(),
                    "is_backfill": True,
                }

                job = Job(
                    org_id=org_id,
                    field_id=field.id,
                    type=idx_key,
                    status="pending",
                    params_json=params_json,
                    created_by=field.created_by,
                )
                session.add(job)
                session.flush()

                countdown = chunk_idx * stagger_seconds
                celery_app.send_task(
                    task_name,
                    args=[str(job.id)],
                    countdown=countdown,
                )
                jobs_dispatched += 1

                logger.info(
                    "backfill_job_dispatched",
                    job_id=str(job.id),
                    field_id=field_id,
                    index=idx_key,
                    chunk=f"{chunk_start} → {chunk_end}",
                    countdown=countdown,
                )

        # Mark sentinel job as completed now that real jobs are dispatched
        if sentinel_job_id:
            sentinel = session.get(Job, uuid.UUID(sentinel_job_id))
            if sentinel:
                sentinel.status = "completed"

        session.commit()

        logger.info(
            "backfill_orchestration_complete",
            field_id=field_id,
            chunks=len(chunks),
            chunks_skipped=chunks_skipped,
            indices=len(INDEX_REGISTRY),
            jobs_dispatched=jobs_dispatched,
        )
        return {
            "field_id": field_id,
            "status": "dispatched",
            "jobs": jobs_dispatched,
            "chunks": len(chunks),
            "chunks_skipped": chunks_skipped,
        }

    except Exception as e:
        logger.error("backfill_orchestration_failed", field_id=field_id, error=str(e))
        session.rollback()
        raise
    finally:
        session.close()


# ── Weekly auto-compute ──────────────────────────────────────────────


@celery_app.task(
    name="app.tasks.backfill.schedule_weekly_index_compute",
    bind=True,
    max_retries=1,
    time_limit=300,
    soft_time_limit=240,
)
def schedule_weekly_index_compute(self) -> dict:
    """Query all active fields, skip fresh ones, dispatch index jobs for stale ones.

    A field is considered *stale* if its latest raster layer is older than 7 days.
    """
    from sqlalchemy import func as sqla_func

    from app.models.tables import Field, Job, RasterLayer

    session = get_db_session()
    batch_size = settings.index_weekly_batch_size
    stale_threshold = date.today() - timedelta(days=7)

    try:
        # Fetch all active field IDs
        field_rows = session.execute(
            select(Field.id, Field.org_id, Field.created_by).where(
                Field.deleted_at.is_(None)
            )
        ).all()

        fields_checked = 0
        fields_dispatched = 0
        jobs_dispatched = 0
        stagger_seconds = 15

        for batch_start in range(0, len(field_rows), batch_size):
            batch = field_rows[batch_start : batch_start + batch_size]

            for field_id, org_id, created_by in batch:
                fields_checked += 1

                # Check staleness: latest raster layer date
                latest_date = session.execute(
                    select(sqla_func.max(RasterLayer.date)).where(
                        RasterLayer.field_id == field_id
                    )
                ).scalar_one_or_none()

                if latest_date is not None and latest_date > stale_threshold:
                    continue  # fresh - skip

                # Determine date range: latest_date+1 → today (or 7 days back if none)
                date_from = (
                    (latest_date + timedelta(days=1))
                    if latest_date
                    else (date.today() - timedelta(days=7))
                )
                date_to = date.today()
                if date_from >= date_to:
                    continue

                # Dispatch one job per index
                for idx_key in sorted(INDEX_REGISTRY.keys()):
                    task_name = INDEX_TASK_MAP.get(idx_key)
                    if not task_name:
                        continue

                    job = Job(
                        org_id=org_id,
                        field_id=field_id,
                        type=idx_key,
                        status="pending",
                        params_json={
                            "date_from": date_from.isoformat(),
                            "date_to": date_to.isoformat(),
                        },
                        created_by=created_by,
                    )
                    session.add(job)
                    session.flush()

                    countdown = fields_dispatched * stagger_seconds
                    celery_app.send_task(
                        task_name,
                        args=[str(job.id)],
                        countdown=countdown,
                    )
                    jobs_dispatched += 1

                fields_dispatched += 1

        session.commit()

        logger.info(
            "weekly_index_compute_complete",
            fields_checked=fields_checked,
            fields_dispatched=fields_dispatched,
            jobs_dispatched=jobs_dispatched,
        )
        return {
            "status": "completed",
            "fields_checked": fields_checked,
            "fields_dispatched": fields_dispatched,
            "jobs_dispatched": jobs_dispatched,
        }

    except Exception as e:
        logger.error("weekly_index_compute_failed", error=str(e))
        session.rollback()
        raise
    finally:
        session.close()


# ── Bulk backfill (all existing fields) ──────────────────────────────


@celery_app.task(
    name="app.tasks.backfill.backfill_all_existing_fields",
    bind=True,
    max_retries=1,
    time_limit=300,
    soft_time_limit=240,
)
def backfill_all_existing_fields(self, months: int | None = None) -> dict:
    """Iterate all active fields and dispatch backfill for each one.

    Used as a one-time migration task for existing deployments that
    were set up before the auto-backfill feature.
    """
    from app.models.tables import Field

    months = months or settings.index_backfill_months
    stagger_seconds = 60  # 1 minute between fields to spread load

    session = get_db_session()
    try:
        field_ids = (
            session.execute(select(Field.id).where(Field.deleted_at.is_(None)))
            .scalars()
            .all()
        )

        for i, fid in enumerate(field_ids):
            backfill_indices_for_field.apply_async(
                args=[str(fid)],
                kwargs={"months": months},
                countdown=i * stagger_seconds,
            )

        logger.info(
            "bulk_backfill_dispatched",
            total_fields=len(field_ids),
            months=months,
        )
        return {
            "status": "dispatched",
            "total_fields": len(field_ids),
            "months": months,
        }

    except Exception as e:
        logger.error("bulk_backfill_failed", error=str(e))
        session.rollback()
        raise
    finally:
        session.close()
