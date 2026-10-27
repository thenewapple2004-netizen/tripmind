from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks.report_tasks import ping_task


def test_celery_app_configuration():
    assert celery_app.conf.task_serializer == "json"
    assert celery_app.conf.result_serializer == "json"
    assert celery_app.conf.timezone == "UTC"
    assert celery_app.conf.task_track_started is True
    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.worker_prefetch_multiplier == 1


def test_celery_task_registration():
    assert "tasks.ping" in celery_app.tasks
    task = celery_app.tasks["tasks.ping"]
    assert task.name == ping_task.name
    assert task.run == ping_task.run


def test_ping_task_local_execution():
    # Calling directly without broker (eager execution)
    result = ping_task()
    assert result == "pong"
