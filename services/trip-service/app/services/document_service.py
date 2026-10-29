from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.files import (
    MAX_DOCUMENTS_PER_TRIP,
    MAX_DOCUMENT_BYTES,
    MAX_TRIP_DOCUMENT_BYTES,
    clean_filename,
    sniff_document_type,
)
from app.models.document import TripDocument
from app.models.schemas import DOCUMENT_KINDS, DocumentUpdate
from app.models.trip import Trip
from app.services.trip_service import trip_repository


class DocumentService:
    def verify_trip(self, db: Session, trip_id: UUID, user_id: UUID):
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with id '{trip_id}' not found or you do not have permission",
            )
        return trip

    def list_documents(self, db: Session, trip_id: UUID, user_id: UUID) -> List[TripDocument]:
        self.verify_trip(db, trip_id, user_id)
        # `data` is a deferred column, so this never loads file contents.
        return (
            db.query(TripDocument)
            .filter(TripDocument.trip_id == trip_id)
            .order_by(TripDocument.uploaded_at.desc(), TripDocument.id.asc())
            .all()
        )

    def list_for_owner(self, db: Session, user_id: UUID):
        return (
            db.query(TripDocument, Trip.title)
            .options(selectinload(TripDocument.bookings))  # which reservations each document is attached to
            .join(Trip, TripDocument.trip_id == Trip.id)
            .filter(Trip.user_id == user_id)
            .order_by(TripDocument.uploaded_at.desc(), TripDocument.id.asc())
            .all()
        )

    def check_kind(self, kind: str) -> str:
        if kind not in DOCUMENT_KINDS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"kind must be one of: {', '.join(DOCUMENT_KINDS)}",
            )
        return kind

    def store(self, db: Session, trip_id: UUID, filename: str, kind: str, data: bytes) -> TripDocument:
        """Validates the bytes themselves, enforces per-trip limits and saves the document."""
        if not data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file was uploaded")
        if len(data) > MAX_DOCUMENT_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File is too large (max {MAX_DOCUMENT_BYTES // (1024 * 1024)} MB)",
            )
        content_type = sniff_document_type(data)
        if content_type is None:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Unsupported file. Upload a PDF, PNG, JPEG or WebP.",
            )

        count, total = (
            db.query(func.count(TripDocument.id), func.coalesce(func.sum(TripDocument.size_bytes), 0))
            .filter(TripDocument.trip_id == trip_id)
            .one()
        )
        if count >= MAX_DOCUMENTS_PER_TRIP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A trip can hold at most {MAX_DOCUMENTS_PER_TRIP} documents",
            )
        if total + len(data) > MAX_TRIP_DOCUMENT_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This trip's documents would exceed {MAX_TRIP_DOCUMENT_BYTES // (1024 * 1024)} MB",
            )

        doc = TripDocument(
            trip_id=trip_id,
            filename=clean_filename(filename, content_type),
            content_type=content_type,
            size_bytes=len(data),
            kind=kind,
            data=data,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    def get_document(self, db: Session, trip_id: UUID, document_id: UUID, user_id: UUID) -> TripDocument:
        self.verify_trip(db, trip_id, user_id)
        doc = (
            db.query(TripDocument)
            .filter(TripDocument.id == document_id, TripDocument.trip_id == trip_id)
            .first()
        )
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{document_id}' not found for this trip",
            )
        return doc

    def update_document(
        self, db: Session, trip_id: UUID, document_id: UUID, user_id: UUID, patch: DocumentUpdate
    ) -> TripDocument:
        """Renames and/or recategorises a document. The bytes, type and links are left exactly as they are."""
        doc = self.get_document(db, trip_id, document_id, user_id)
        if patch.filename is None and patch.kind is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nothing to change")
        if patch.kind is not None:
            doc.kind = self.check_kind(patch.kind)
        if patch.filename is not None:
            if not patch.filename.strip().strip("."):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a file name")
            doc.filename = clean_filename(patch.filename, doc.content_type)
        db.commit()
        db.refresh(doc)
        return doc

    def delete_document(self, db: Session, trip_id: UUID, document_id: UUID, user_id: UUID) -> None:
        db.delete(self.get_document(db, trip_id, document_id, user_id))
        db.commit()


document_service = DocumentService()
