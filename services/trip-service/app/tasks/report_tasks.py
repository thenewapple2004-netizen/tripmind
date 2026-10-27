import logging
from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.ping")
def ping_task() -> str:
    """Worker verification health task."""
    logger.info("Executing Celery worker ping task")
    return "pong"
