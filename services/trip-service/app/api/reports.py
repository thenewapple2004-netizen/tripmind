import logging
import os
from uuid import UUID
from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_db
from app.models.schemas import ReportJobResponse, ReportStatusResponse
from app.services.trip_service import trip_repository
from app.tasks.report_tasks import generate_trip_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips/{trip_id}/reports", tags=["Reports"])


@router.post("", response_model=ReportJobResponse, status_code=status.HTTP_202_ACCEPTED)
def request_trip_report(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Enqueue an asynchronous background job to generate a CSV report for the specified trip.
    Immediately returns HTTP 202 Accepted with a task ID.
    """
    trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )

    task = generate_trip_report.delay(str(trip_id), str(user_id))
    logger.info(f"Dispatched trip report task: task_id={task.id}, trip_id={trip_id}, user_id={user_id}")

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "task_id": task.id,
            "trip_id": str(trip_id),
            "status": "PENDING",
            "message": "Trip report generation initiated. Poll the status endpoint for progress.",
        },
    )


@router.get("/{task_id}/status", response_model=ReportStatusResponse)
def get_report_status(
    trip_id: UUID,
    task_id: str,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Check the current execution status of a background report generation job.
    """
    trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )

    async_result = AsyncResult(task_id, app=celery_app)
    state = async_result.state

    if state == "SUCCESS":
        result_data = async_result.result or {}
        # Ownership and trip isolation check
        if result_data.get("user_id") != str(user_id) or result_data.get("trip_id") != str(trip_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized access to this report task",
            )

        return ReportStatusResponse(
            task_id=task_id,
            trip_id=trip_id,
            status="SUCCESS",
            message="Report generation completed successfully.",
            result={
                "filename": result_data.get("filename"),
                "file_size": result_data.get("file_size"),
                "generated_at": result_data.get("generated_at"),
                "row_counts": result_data.get("row_counts"),
            },
        )

    if state == "FAILURE":
        error_msg = str(async_result.result) if async_result.result else "Report generation failed"
        return ReportStatusResponse(
            task_id=task_id,
            trip_id=trip_id,
            status="FAILURE",
            error=error_msg,
        )

    # In-progress states: PENDING, STARTED, RETRY
    status_messages = {
        "PENDING": "Job is queued waiting for an available worker.",
        "STARTED": "Worker is currently generating the CSV report.",
        "RETRY": "Transient error occurred; job is scheduled for automatic retry.",
    }

    return ReportStatusResponse(
        task_id=task_id,
        trip_id=trip_id,
        status=state,
        message=status_messages.get(state, f"Job status: {state}"),
    )


@router.get("/{task_id}/download")
def download_trip_report(
    trip_id: UUID,
    task_id: str,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Download the generated CSV report file once the background task has succeeded.
    """
    trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )

    async_result = AsyncResult(task_id, app=celery_app)
    if async_result.state != "SUCCESS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report is not ready yet. Current status: '{async_result.state}'",
        )

    result_data = async_result.result or {}
    if result_data.get("user_id") != str(user_id) or result_data.get("trip_id") != str(trip_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized access to this report file",
        )

    file_path = result_data.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found on disk or has expired",
        )

    # Prevent directory traversal attacks
    normalized_path = os.path.abspath(file_path)
    allowed_dir = os.path.abspath(settings.reports_dir)
    if not normalized_path.startswith(allowed_dir):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid file path access",
        )

    filename = result_data.get("filename", f"trip_report_{trip_id}.csv")
    return FileResponse(
        path=normalized_path,
        media_type="text/csv",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def cleanup_trip_report(
    trip_id: UUID,
    task_id: str,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Cleanup and delete the generated report file from server storage.
    """
    trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )

    async_result = AsyncResult(task_id, app=celery_app)
    if async_result.state == "SUCCESS":
        result_data = async_result.result or {}
        if result_data.get("user_id") == str(user_id) and result_data.get("trip_id") == str(trip_id):
            file_path = result_data.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError as exc:
                    logger.warning(f"Failed to delete report file '{file_path}': {exc}")
