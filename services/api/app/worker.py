"""Celery worker configuration — broker=Redis, per PRD Section 7.4."""

from celery import Celery
from celery.schedules import crontab

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
    include=[
        "app.tasks.ndvi",
        "app.tasks.vegetation",
        "app.tasks.weather",
        "app.tasks.backfill",
    ],
    # Route ML tasks to the dedicated "ml" queue
    task_routes={
        "app.tasks.detection.*": {"queue": "ml"},
    },
    # Celery Beat schedule
    beat_schedule={
        "compute-indices-weekly": {
            "task": "app.tasks.backfill.schedule_weekly_index_compute",
            "schedule": crontab(hour=6, minute=0, day_of_week=1),
        },
        "fetch-weather-daily": {
            "task": "app.tasks.weather.schedule_daily_weather_fetch",
            "schedule": crontab(hour=8, minute=0),
        },
    },
)

# Conditionally register ML detection tasks (requires torchgeo, only on ml-processor)
try:
    import torchgeo  # noqa: F401

    celery_app.conf.include.append("app.tasks.detection")
except ImportError:
    pass
