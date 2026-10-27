import os
from celery import Celery
from app.core.config import settings

# Ensure reports directory exists
try:
    os.makedirs(settings.reports_dir, exist_ok=True)
except (PermissionError, OSError):
    pass

# Initialize Celery app with Redis broker and result backend
celery_app = Celery(
    "tripmind_trip_service",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.report_tasks"],
)

# Standardized Celery configuration
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,  # Retain task results for 1 hour
    worker_prefetch_multiplier=1,  # Fair task distribution across workers
    task_acks_late=True,  # Acknowledge task only after completion (prevents lost tasks on worker crash)
)
