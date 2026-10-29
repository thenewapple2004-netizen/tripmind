from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.files import MAX_DOCUMENT_BYTES, content_disposition
from app.models.schemas import DocumentResponse, DocumentUpdate
from app.services.document_service import document_service

router = APIRouter(prefix="/trips/{trip_id}/documents", tags=["Documents"])

_TOO_LARGE = HTTPException(
    status_code=413,
    detail=f"File is too large (max {MAX_DOCUMENT_BYTES // (1024 * 1024)} MB)",
)


@router.get("", response_model=List[DocumentResponse])
def list_documents(trip_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)):
    return document_service.list_documents(db, trip_id, user_id)


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    trip_id: UUID,
    request: Request,
    filename: str = Query("", max_length=255, description="Original file name (display only)"),
    kind: str = Query("other", description="passport, visa, ticket, booking, insurance or other"),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Upload a travel document as the raw request body (PDF, PNG, JPEG or WebP, up to 5 MB)."""
    # Authorise and validate the cheap things before reading a single byte of the body.
    document_service.verify_trip(db, trip_id, user_id)
    document_service.check_kind(kind)

    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_DOCUMENT_BYTES:
        raise _TOO_LARGE

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_DOCUMENT_BYTES:  # also covers chunked uploads with no Content-Length
            raise _TOO_LARGE
    return document_service.store(db, trip_id, filename, kind, bytes(body))


@router.get("/{document_id}/download")
def download_document(
    trip_id: UUID,
    document_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Download a document. Requires the owner's token, so it can't be fetched by link alone."""
    doc = document_service.get_document(db, trip_id, document_id, user_id)
    return Response(
        content=doc.data,
        media_type=doc.content_type,
        headers={
            "Content-Disposition": content_disposition(doc.filename),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(
    trip_id: UUID,
    document_id: UUID,
    patch: DocumentUpdate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Rename a document or change its category. The stored file is never copied or replaced."""
    return document_service.update_document(db, trip_id, document_id, user_id, patch)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    trip_id: UUID,
    document_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    document_service.delete_document(db, trip_id, document_id, user_id)
    return None
