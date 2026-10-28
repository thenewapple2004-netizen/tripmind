"""Helpers for safely accepting uploaded travel documents."""

import re
from typing import Optional
from urllib.parse import quote

MAX_DOCUMENT_BYTES = 5 * 1024 * 1024  # 5 MB per file
MAX_DOCUMENTS_PER_TRIP = 30
MAX_TRIP_DOCUMENT_BYTES = 50 * 1024 * 1024  # 50 MB per trip

# Only formats we can identify by their contents. SVG, HTML, Office files and archives can carry
# active content, so they are not accepted.
EXTENSIONS = {
    "application/pdf": (".pdf",),
    "image/png": (".png",),
    "image/jpeg": (".jpg", ".jpeg"),
    "image/webp": (".webp",),
}

_CONTROL = re.compile(r"[\x00-\x1f\x7f]")


def sniff_document_type(data: bytes) -> Optional[str]:
    """Identifies the file from its first bytes. The declared type and the filename are ignored."""
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def clean_filename(raw: Optional[str], content_type: str) -> str:
    """A display-safe name: no directories, no control characters, a sensible length, and an
    extension that matches the real file type. It is only ever shown to the user, never used as
    a path, but a clean name keeps downloads and the UI tidy."""
    name = (raw or "").replace("\\", "/").split("/")[-1]
    name = _CONTROL.sub("", name).strip().strip(".")
    name = re.sub(r"\s+", " ", name)

    allowed = EXTENSIONS[content_type]
    stem, dot, ext = name.rpartition(".")
    if not dot or f".{ext.lower()}" not in allowed:
        stem = name  # the "extension" wasn't really one, or doesn't match the content
        name = f"{stem or 'document'}{allowed[0]}"
    else:
        name = f"{stem or 'document'}.{ext.lower()}"

    if len(name) > 120:
        base, _, ext2 = name.rpartition(".")
        name = f"{base[: 120 - len(ext2) - 1]}.{ext2}"
    return name


def content_disposition(filename: str) -> str:
    """Always `attachment`, so a browser downloads the file instead of rendering it."""
    ascii_fallback = re.sub(r'[^A-Za-z0-9._ -]', "_", filename) or "document"
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"
