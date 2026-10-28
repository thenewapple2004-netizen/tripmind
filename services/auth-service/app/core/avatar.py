from typing import Optional

MAX_AVATAR_BYTES = 1024 * 1024  # 1 MB; the client downsizes pictures well below this.


def sniff_image_type(data: bytes) -> Optional[str]:
    """Identifies PNG, JPEG and WebP by their magic bytes. Anything else (SVG, GIF, HTML...) is rejected."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
