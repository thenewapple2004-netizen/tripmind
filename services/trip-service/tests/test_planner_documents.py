import base64
from uuid import uuid4

import pytest

from app.core.files import (
    MAX_DOCUMENT_BYTES,
    MAX_DOCUMENTS_PER_TRIP,
    clean_filename,
    content_disposition,
    sniff_document_type,
)

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 40
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 20


def url(trip, suffix=""):
    return f"/api/v1/trips/{trip.id}/documents{suffix}"


def upload(client, trip, headers, body=PDF, filename="passport.pdf", kind="passport", content_type="application/pdf"):
    return client.post(
        url(trip), params={"filename": filename, "kind": kind}, content=body, headers={**headers, "Content-Type": content_type}
    )


# ── Upload & download ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "body,expected",
    [(PDF, "application/pdf"), (PNG, "image/png"), (JPEG, "image/jpeg"), (WEBP, "image/webp")],
)
def test_accepts_each_supported_type(planner_client, alice_trip, alice, body, expected):
    res = upload(planner_client, alice_trip, alice, body=body, filename="scan")
    assert res.status_code == 201, res.text
    assert res.json()["content_type"] == expected and res.json()["size_bytes"] == len(body)


def test_upload_response_and_list_never_include_file_contents(planner_client, alice_trip, alice):
    doc = upload(planner_client, alice_trip, alice, filename="Ticket.pdf", kind="ticket").json()
    assert doc["filename"] == "Ticket.pdf" and doc["kind"] == "ticket"
    assert "data" not in doc
    listing = planner_client.get(url(alice_trip), headers=alice).json()
    assert [d["id"] for d in listing] == [doc["id"]] and "data" not in listing[0]


def test_download_returns_the_exact_bytes_with_safe_headers(planner_client, alice_trip, alice):
    doc = upload(planner_client, alice_trip, alice, body=PNG, filename="visa.png", kind="visa", content_type="image/png").json()
    res = planner_client.get(url(alice_trip, f"/{doc['id']}/download"), headers=alice)
    assert res.status_code == 200 and res.content == PNG
    assert res.headers["content-type"] == "image/png"
    assert res.headers["content-disposition"].startswith("attachment;")
    assert "visa.png" in res.headers["content-disposition"]
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["cache-control"] == "private, no-store"
    assert "sandbox" in res.headers["content-security-policy"]


def test_delete_removes_the_document(planner_client, alice_trip, alice):
    doc = upload(planner_client, alice_trip, alice).json()
    assert planner_client.delete(url(alice_trip, f"/{doc['id']}"), headers=alice).status_code == 204
    assert planner_client.get(url(alice_trip), headers=alice).json() == []
    assert planner_client.get(url(alice_trip, f"/{doc['id']}/download"), headers=alice).status_code == 404


# ── Validation: the bytes decide, not the name or the declared type ─────


@pytest.mark.parametrize(
    "body",
    [
        b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
        b"<html><script>alert(1)</script></html>",
        b"GIF89a\x01\x00\x01\x00",
        b"MZ\x90\x00\x03\x00\x00\x00",  # a Windows executable
        b"PK\x03\x04 pretend zip",
        b"plain text pretending to be a pdf",
    ],
)
def test_rejects_other_file_types_even_when_named_and_declared_as_a_pdf(planner_client, alice_trip, alice, body):
    res = upload(planner_client, alice_trip, alice, body=body, filename="totally-a-passport.pdf", content_type="application/pdf")
    assert res.status_code == 415
    assert planner_client.get(url(alice_trip), headers=alice).json() == []


def test_rejects_empty_and_oversized_files(planner_client, alice_trip, alice):
    assert upload(planner_client, alice_trip, alice, body=b"").status_code == 400
    too_big = PDF + b"0" * (MAX_DOCUMENT_BYTES + 1)
    assert upload(planner_client, alice_trip, alice, body=too_big).status_code == 413
    assert upload(planner_client, alice_trip, alice, body=PDF + b"0" * (MAX_DOCUMENT_BYTES - len(PDF))).status_code == 201


def test_rejects_unknown_kind(planner_client, alice_trip, alice):
    assert upload(planner_client, alice_trip, alice, kind="secrets").status_code == 422


def test_per_trip_document_limit(planner_client, alice_trip, alice):
    for n in range(MAX_DOCUMENTS_PER_TRIP):
        assert upload(planner_client, alice_trip, alice, filename=f"d{n}.pdf").status_code == 201
    res = upload(planner_client, alice_trip, alice, filename="extra.pdf")
    assert res.status_code == 400 and "at most" in res.json()["detail"]


# ── Filenames ────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,content_type,expected",
    [
        ("passport.pdf", "application/pdf", "passport.pdf"),
        ("../../etc/passwd.pdf", "application/pdf", "passwd.pdf"),
        ("..\\..\\windows\\system32\\boarding pass.PDF", "application/pdf", "boarding pass.pdf"),
        ("photo.exe", "image/png", "photo.exe.png"),  # extension doesn't match the contents
        ("scan", "image/jpeg", "scan.jpg"),
        ("holiday.jpeg", "image/jpeg", "holiday.jpeg"),
        ("", "application/pdf", "document.pdf"),
        ("...", "image/webp", "document.webp"),
        ("bad\x00na\nme.pdf", "application/pdf", "badname.pdf"),
        ("تذكرة.pdf", "application/pdf", "تذكرة.pdf"),
    ],
)
def test_clean_filename(raw, content_type, expected):
    assert clean_filename(raw, content_type) == expected


def test_clean_filename_limits_length_and_keeps_extension():
    name = clean_filename("a" * 400 + ".pdf", "application/pdf")
    assert len(name) <= 120 and name.endswith(".pdf")


def test_stored_filename_is_cleaned(planner_client, alice_trip, alice):
    doc = upload(planner_client, alice_trip, alice, filename="../../etc/passwd").json()
    assert doc["filename"] == "passwd.pdf"


def test_content_disposition_is_always_an_attachment_and_header_safe():
    header = content_disposition('evil"\r\nSet-Cookie: x=1.pdf')
    assert header.startswith("attachment;") and "\r" not in header and "\n" not in header
    assert "filename*=UTF-8''" in content_disposition("تذكرة.pdf")


def test_sniffing():
    assert sniff_document_type(PDF) == "application/pdf" and sniff_document_type(PNG) == "image/png"
    assert sniff_document_type(JPEG) == "image/jpeg" and sniff_document_type(WEBP) == "image/webp"
    assert sniff_document_type(b"RIFF\x00\x00\x00\x00WAVEfmt ") is None
    assert sniff_document_type(b"") is None


# ── Authorisation: files stay with their owner ──────────────────────────


def test_requires_authentication(planner_client, alice_trip, alice):
    doc = upload(planner_client, alice_trip, alice).json()
    assert planner_client.get(url(alice_trip)).status_code == 401
    assert planner_client.get(url(alice_trip, f"/{doc['id']}/download")).status_code == 401
    assert planner_client.post(url(alice_trip), content=PDF).status_code == 401
    assert planner_client.delete(url(alice_trip, f"/{doc['id']}")).status_code == 401


def test_other_users_cannot_list_download_upload_or_delete(planner_client, alice_trip, alice, bob):
    doc = upload(planner_client, alice_trip, alice).json()
    assert planner_client.get(url(alice_trip), headers=bob).status_code == 404
    assert planner_client.get(url(alice_trip, f"/{doc['id']}/download"), headers=bob).status_code == 404
    assert upload(planner_client, alice_trip, bob).status_code == 404
    assert planner_client.delete(url(alice_trip, f"/{doc['id']}"), headers=bob).status_code == 404
    # ...and it is all still there, untouched.
    res = planner_client.get(url(alice_trip, f"/{doc['id']}/download"), headers=alice)
    assert res.status_code == 200 and res.content == PDF


def test_a_document_id_only_works_under_its_own_trip(planner_client, make_trip, alice):
    one, two = make_trip(title="One"), make_trip(title="Two")
    doc = upload(planner_client, one, alice).json()
    assert planner_client.get(url(two, f"/{doc['id']}/download"), headers=alice).status_code == 404
    assert planner_client.delete(url(two, f"/{doc['id']}"), headers=alice).status_code == 404
    assert planner_client.get(url(one, f"/{uuid4()}/download"), headers=alice).status_code == 404


def test_owner_vault_lists_only_my_documents_with_trip_titles(planner_client, alice_trip, bob_trip, alice, bob):
    upload(planner_client, alice_trip, alice, filename="mine.pdf")
    upload(planner_client, bob_trip, bob, filename="bobs.pdf")
    mine = planner_client.get("/api/v1/owner/documents", headers=alice).json()
    assert [(d["filename"], d["trip_title"]) for d in mine] == [("mine.pdf", "Planner Trip")]
    assert all("data" not in d for d in mine)
    assert planner_client.get("/api/v1/owner/documents").status_code == 401


def test_documents_are_deleted_with_their_trip(planner_client, alice_trip, alice, planner_db):
    from app.models.document import TripDocument

    upload(planner_client, alice_trip, alice)
    assert planner_client.delete(f"/api/v1/trips/{alice_trip.id}", headers=alice).status_code in (200, 204)
    planner_db.expire_all()
    assert planner_db.query(TripDocument).count() == 0
