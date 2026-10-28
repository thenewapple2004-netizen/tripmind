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


# ── Celery Observability Signals ─────────────────────────────────────────────

import time
from celery.signals import (
    before_task_publish,
    task_failure,
    task_postrun,
    task_prerun,
    task_retry,
    worker_process_init,
)
from app.core.observability import (
    configure_logging,
    get_correlation_id,
    inject_trace_context,
    record_celery_task_event,
    set_correlation_id,
    setup_tracing,
)


@before_task_publish.connect
def on_before_task_publish(sender=None, headers=None, body=None, **kwargs):
    """Propagate correlation ID and trace context into Celery message headers before publishing."""
    if headers is not None:
        cid = get_correlation_id()
        if cid:
            headers["correlation_id"] = cid
        inject_trace_context(headers)


@task_prerun.connect
def on_task_prerun(sender=None, task_id=None, task=None, args=None, kwargs=None, **other):
    """Restore correlation ID and record task start on worker."""
    task_headers = getattr(task.request, "headers", None) or {}
    cid = task_headers.get("correlation_id") or get_correlation_id() or f"celery-{task_id}"
    set_correlation_id(cid)
    setattr(task, "_task_start_time", time.perf_counter())
    record_celery_task_event(task.name, "started")


@task_postrun.connect
def on_task_postrun(sender=None, task_id=None, task=None, state=None, retval=None, **other):
    """Record task completion duration and status."""
    start_time = getattr(task, "_task_start_time", None)
    duration_s = (time.perf_counter() - start_time) if start_time else None
    if state == "SUCCESS":
        record_celery_task_event(task.name, "succeeded", duration_s)


@task_failure.connect
def on_task_failure(sender=None, task_id=None, exception=None, **other):
    """Record task failure metric on error."""
    start_time = getattr(sender, "_task_start_time", None)
    duration_s = (time.perf_counter() - start_time) if start_time else None
    task_name = getattr(sender, "name", "unknown_task")
    record_celery_task_event(task_name, "failed", duration_s)


@task_retry.connect
def on_task_retry(sender=None, task_id=None, exception=None, **other):
    """Record task retry metric."""
    task_name = getattr(sender, "name", "unknown_task")
    record_celery_task_event(task_name, "retried")


@worker_process_init.connect
def on_worker_init(**kwargs):
    """Configure structured logging and tracing when worker process starts."""
    configure_logging(
        service_name="celery-worker",
        log_level=settings.log_level,
        log_format=settings.log_format,
    )
    setup_tracing(
        service_name="celery-worker",
        otlp_endpoint=settings.otlp_endpoint,
        enabled=settings.tracing_enabled,
    )

