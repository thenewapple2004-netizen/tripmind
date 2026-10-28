"""The sample documents must be genuinely valid files, and seeding must be safe to repeat."""

import re
import struct
import zlib
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.files import MAX_DOCUMENT_BYTES, clean_filename, sniff_document_type
from app.models.document import TripDocument
from app.models.schemas import DOCUMENT_KINDS
from app.models.trip import Trip
from app.scripts import seed_documents as seeder
from app.scripts.seed_trips import _trip_id
from app.seeds.documents_data import DOCUMENTS, make_pass_png, make_pdf
from app.seeds.trips_data import TRIPS
from tests.conftest import ALICE, BOB, auth_header

ALL = [(key, name, kind, build) for key, docs in DOCUMENTS.items() for name, kind, build in docs]


def test_documents_belong_to_real_seed_trips_and_cover_every_kind():
    keys = {t["key"] for t in TRIPS}
    assert set(DOCUMENTS) <= keys
    assert len(ALL) >= 15
    assert {kind for _, _, kind, _ in ALL} == set(DOCUMENT_KINDS)  # every document type can be tried
    assert any(name.endswith(".png") for _, name, _, _ in ALL) and any(name.endswith(".pdf") for _, name, _, _ in ALL)


def test_filenames_are_unique_per_trip_and_already_clean():
    for key, docs in DOCUMENTS.items():
        names = [n for n, _, _ in docs]
        assert len(set(names)) == len(names), key
    for _, name, _, build in ALL:
        assert clean_filename(name, sniff_document_type(build())) == name  # what we store is what the user sees


@pytest.mark.parametrize("key,name,kind,build", ALL, ids=[f"{k}:{n}" for k, n, _, _ in ALL])
def test_every_sample_is_a_valid_supported_file(key, name, kind, build):
    data = build()
    assert sniff_document_type(data) is not None
    assert 0 < len(data) < MAX_DOCUMENT_BYTES
    assert data == build()  # deterministic, so re-seeding never changes a file


def _pdfs():
    return [(n, b()) for _, n, _, b in ALL if n.endswith(".pdf")]


@pytest.mark.parametrize("name,data", _pdfs(), ids=[n for n, _ in _pdfs()])
def test_pdfs_are_structurally_valid(name, data):
    assert data.startswith(b"%PDF-1.4") and data.rstrip().endswith(b"%%EOF")
    # Every cross-reference entry must point at its own object.
    startxref = int(re.search(rb"startxref\n(\d+)\n", data).group(1))
    table = data[startxref:].split(b"\n")
    count = int(table[1].split()[1])
    for number in range(1, count):
        offset = int(table[2 + number].split()[0])
        assert data[offset:].startswith(f"{number} 0 obj".encode()), (name, number)
    assert b"SAMPLE" in data  # clearly marked as not real


def test_pdf_text_with_special_characters_stays_valid():
    data = make_pdf("Title (with) brackets \\ and é", ["# Heading", "Line with (parentheses) and \\ slash"])
    assert b"\\(with\\)" in data and b"\\\\" in data


def _png_chunks(data):
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos = 8
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        kind, body = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
        (crc,) = struct.unpack(">I", data[pos + 8 + length:pos + 12 + length])
        assert crc == zlib.crc32(kind + body) & 0xFFFFFFFF, kind  # corrupt chunks would fail here
        yield kind, body
        pos += 12 + length


def test_pngs_decode_to_the_declared_size():
    for seed in (11, 23, 37, 41, 53):
        chunks = dict(_png_chunks(make_pass_png(seed)))
        width, height = struct.unpack(">II", chunks[b"IHDR"][:8])
        assert (width, height) == (640, 240)
        assert len(zlib.decompress(chunks[b"IDAT"])) == height * (1 + 3 * width)


def test_different_passes_look_different():
    assert make_pass_png(11) != make_pass_png(23)


# ── Seeding ──────────────────────────────────────────────────────────────


@pytest.fixture
def seeded_trips(planner_db, monkeypatch):
    """Trips with the same ids `seed_trips` would give Alice, plus the seeder pointed at the test DB."""
    for spec in TRIPS:
        start = date(2027, 5, 1) + timedelta(days=spec["start"])
        planner_db.add(Trip(
            id=_trip_id(ALICE, spec["key"]), user_id=ALICE, title=spec["title"], destination=spec["destination"],
            start_date=start, end_date=start + timedelta(days=spec["days"] - 1), budget=Decimal(spec["budget"]),
        ))
    planner_db.commit()
    monkeypatch.setattr(seeder, "SessionLocal", lambda: planner_db)
    return planner_db


def test_seeding_is_idempotent(seeded_trips, capsys):
    seeder.seed_documents(ALICE)
    assert seeded_trips.query(TripDocument).count() == len(ALL)
    seeder.seed_documents(ALICE)
    assert seeded_trips.query(TripDocument).count() == len(ALL)
    assert "0 added" in capsys.readouterr().out


def test_seeded_documents_download_through_the_real_api(planner_client, seeded_trips):
    seeder.seed_documents(ALICE)
    trip_id = _trip_id(ALICE, "kyoto-cherry-blossom")
    listing = planner_client.get(f"/api/v1/trips/{trip_id}/documents", headers=auth_header(ALICE)).json()
    assert {d["kind"] for d in listing} == {"passport", "visa", "ticket", "insurance"}
    for doc in listing:
        res = planner_client.get(f"/api/v1/trips/{trip_id}/documents/{doc['id']}/download", headers=auth_header(ALICE))
        assert res.status_code == 200 and res.headers["content-type"] == doc["content_type"]
        assert len(res.content) == doc["size_bytes"]
    vault = planner_client.get("/api/v1/owner/documents", headers=auth_header(ALICE)).json()
    assert len(vault) == len(ALL) and all(d["trip_title"] for d in vault)


def test_seeded_documents_stay_private(planner_client, seeded_trips):
    seeder.seed_documents(ALICE)
    trip_id = _trip_id(ALICE, "kyoto-cherry-blossom")
    assert planner_client.get(f"/api/v1/trips/{trip_id}/documents", headers=auth_header(BOB)).status_code == 404
    assert planner_client.get("/api/v1/owner/documents", headers=auth_header(BOB)).json() == []


def test_seeded_documents_can_be_deleted_in_the_app_and_stay_deleted(planner_client, seeded_trips):
    seeder.seed_documents(ALICE)
    trip_id = _trip_id(ALICE, "kyoto-cherry-blossom")
    doc = planner_client.get(f"/api/v1/trips/{trip_id}/documents", headers=auth_header(ALICE)).json()[0]
    assert planner_client.delete(f"/api/v1/trips/{trip_id}/documents/{doc['id']}", headers=auth_header(ALICE)).status_code == 204
    assert seeded_trips.query(TripDocument).count() == len(ALL) - 1


def test_trips_that_were_not_seeded_are_skipped(planner_db, monkeypatch, capsys):
    monkeypatch.setattr(seeder, "SessionLocal", lambda: planner_db)
    seeder.seed_documents(ALICE)
    assert planner_db.query(TripDocument).count() == 0
    assert "run seed_trips first" in capsys.readouterr().out


def test_another_users_trip_is_never_touched(seeded_trips):
    seeder.seed_documents(BOB)  # Bob owns none of the seeded trips
    assert seeded_trips.query(TripDocument).count() == 0


def test_remove_deletes_only_what_was_seeded(planner_client, seeded_trips):
    seeder.seed_documents(ALICE)
    trip_id = _trip_id(ALICE, "kyoto-cherry-blossom")
    planner_client.post(
        f"/api/v1/trips/{trip_id}/documents", params={"filename": "mine.pdf", "kind": "other"},
        content=b"%PDF-1.4\n%%EOF\n", headers=auth_header(ALICE),
    )
    seeder.remove_seeded_documents(ALICE)
    remaining = seeded_trips.query(TripDocument).all()
    assert [d.filename for d in remaining] == ["mine.pdf"]
