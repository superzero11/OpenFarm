"""Celery worker configuration — broker=Redis, per PRD Section 7.4."""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "openfarm",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    # At-least-once delivery
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Visibility timeout > max job duration
    broker_transport_options={"visibility_timeout": 7200},
    # Concurrency — match 8 vCPU / 16 GB RAM spec
    worker_concurrency=4,
    # Timeouts
    task_time_limit=1800,  # 30 min hard kill
    task_soft_time_limit=1500,  # 25 min soft warning
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Task discovery
    include=["app.tasks.ndvi"],
)
