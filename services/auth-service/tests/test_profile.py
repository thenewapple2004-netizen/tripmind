import base64

import pytest

from app.core.security import verify_password
from app.models.user import User

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
PASSWORD = "oldpassword1"


def register_and_login(client, email="owner@tripmind.com", password=PASSWORD):
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    tokens = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()
    return tokens, {"Authorization": f"Bearer {tokens['access_token']}"}


# ── GET /me ─────────────────────────────────────────────────────────────


def test_me_returns_defaults_for_new_user(client):
    _, headers = register_and_login(client)
    data = client.get("/api/v1/auth/me", headers=headers).json()
    assert data["display_name"] is None
    assert data["currency"] == "USD"
    assert data["timezone"] == "UTC"
    assert data["travel_interests"] == []
    assert data["travel_pace"] == "balanced"
    assert data["budget_style"] == "mid_range"
    assert data["theme"] == "dark"
    assert data["sidebar_collapsed"] is False
    assert data["avatar_version"] is None
    assert "hashed_password" not in data and "token_version" not in data


def test_profile_endpoints_require_authentication(client):
    for method, path in [
        ("patch", "/api/v1/auth/me"),
        ("patch", "/api/v1/auth/me/preferences"),
        ("post", "/api/v1/auth/me/password"),
        ("put", "/api/v1/auth/me/avatar"),
        ("get", "/api/v1/auth/me/avatar"),
        ("delete", "/api/v1/auth/me/avatar"),
    ]:
        res = getattr(client, method)(path)
        assert res.status_code in (401, 403), f"{method} {path} -> {res.status_code}"


# ── PATCH /me ───────────────────────────────────────────────────────────


def test_update_profile(client):
    _, headers = register_and_login(client)
    res = client.patch(
        "/api/v1/auth/me",
        headers=headers,
        json={"display_name": "  Ammar Khan ", "bio": "Slow travel.\nGood coffee.", "location": "Lahore, Pakistan"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["display_name"] == "Ammar Khan"
    assert data["bio"] == "Slow travel.\nGood coffee."
    assert data["location"] == "Lahore, Pakistan"
    assert client.get("/api/v1/auth/me", headers=headers).json()["display_name"] == "Ammar Khan"


def test_partial_update_leaves_other_fields_alone(client):
    _, headers = register_and_login(client)
    client.patch("/api/v1/auth/me", headers=headers, json={"display_name": "Ammar", "location": "Lahore"})
    res = client.patch("/api/v1/auth/me", headers=headers, json={"location": "Berlin"})
    assert res.json()["display_name"] == "Ammar"
    assert res.json()["location"] == "Berlin"


def test_blank_or_null_clears_optional_profile_fields(client):
    _, headers = register_and_login(client)
    client.patch("/api/v1/auth/me", headers=headers, json={"display_name": "Ammar", "bio": "Hi"})
    res = client.patch("/api/v1/auth/me", headers=headers, json={"display_name": "   ", "bio": None})
    assert res.json()["display_name"] is None
    assert res.json()["bio"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"display_name": "x" * 81},
        {"bio": "x" * 281},
        {"location": "x" * 101},
        {"display_name": "line one\nline two"},
        {"display_name": "bad\x00name"},
        {"email": "hijack@tripmind.com"},
        {"token_version": 99},
        {"unknown": "field"},
    ],
)
def test_update_profile_validation(client, payload):
    _, headers = register_and_login(client)
    assert client.patch("/api/v1/auth/me", headers=headers, json=payload).status_code == 422


def test_users_cannot_change_each_others_profile(client):
    _, a_headers = register_and_login(client, "a@tripmind.com")
    _, b_headers = register_and_login(client, "b@tripmind.com")
    client.patch("/api/v1/auth/me", headers=a_headers, json={"display_name": "Alice"})
    assert client.get("/api/v1/auth/me", headers=b_headers).json()["display_name"] is None


# ── PATCH /me/preferences ───────────────────────────────────────────────


def test_update_preferences(client):
    _, headers = register_and_login(client)
    res = client.patch(
        "/api/v1/auth/me/preferences",
        headers=headers,
        json={
            "currency": "eur",
            "timezone": "Europe/Berlin",
            "travel_interests": ["food", "culture", "food"],
            "travel_pace": "relaxed",
            "budget_style": "luxury",
            "theme": "light",
            "sidebar_collapsed": True,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["currency"] == "EUR"
    assert data["timezone"] == "Europe/Berlin"
    assert data["travel_interests"] == ["food", "culture"]
    assert data["travel_pace"] == "relaxed"
    assert data["budget_style"] == "luxury"
    assert data["theme"] == "light"
    assert data["sidebar_collapsed"] is True


@pytest.mark.parametrize("theme", ["dark", "light", "ocean", "dusk", "twilight", "sand"])
def test_every_theme_can_be_saved_and_read_back(client, theme):
    _, headers = register_and_login(client)
    assert client.patch("/api/v1/auth/me/preferences", headers=headers, json={"theme": theme}).json()["theme"] == theme
    assert client.get("/api/v1/auth/me", headers=headers).json()["theme"] == theme


def test_partial_preference_update(client):
    _, headers = register_and_login(client)
    client.patch("/api/v1/auth/me/preferences", headers=headers, json={"currency": "GBP"})
    res = client.patch("/api/v1/auth/me/preferences", headers=headers, json={"theme": "light"})
    assert res.json()["currency"] == "GBP"
    assert res.json()["theme"] == "light"


@pytest.mark.parametrize(
    "payload",
    [
        {"currency": "XXX"},
        {"currency": "US"},
        {"timezone": "Mars/Olympus"},
        {"travel_interests": ["skydiving"]},
        {"travel_pace": "frantic"},
        {"budget_style": "free"},
        {"theme": "neon"},
        {"currency": None},
        {"theme": None},
        {"sidebar_collapsed": "maybe"},
        {"is_admin": True},
    ],
)
def test_update_preferences_validation(client, payload):
    _, headers = register_and_login(client)
    assert client.patch("/api/v1/auth/me/preferences", headers=headers, json=payload).status_code == 422


# ── POST /me/password ───────────────────────────────────────────────────


def test_change_password_success_and_rehash(client, db_session):
    _, headers = register_and_login(client)
    before = db_session.query(User).one().hashed_password

    res = client.post(
        "/api/v1/auth/me/password",
        headers=headers,
        json={"current_password": PASSWORD, "new_password": "brandnewpass2"},
    )
    assert res.status_code == 200
    assert {"access_token", "refresh_token"} <= set(res.json())

    user = db_session.query(User).one()
    assert user.hashed_password != before
    assert user.hashed_password.startswith("$argon2")
    assert "brandnewpass2" not in user.hashed_password
    assert verify_password("brandnewpass2", user.hashed_password)

    # The new password logs in; the old one no longer does.
    login = lambda pw: client.post("/api/v1/auth/login", json={"email": "owner@tripmind.com", "password": pw})
    assert login("brandnewpass2").status_code == 200
    assert login(PASSWORD).status_code == 401


def test_change_password_wrong_current_password(client, db_session):
    _, headers = register_and_login(client)
    before = db_session.query(User).one().hashed_password
    res = client.post(
        "/api/v1/auth/me/password",
        headers=headers,
        json={"current_password": "not-my-password1", "new_password": "brandnewpass2"},
    )
    assert res.status_code == 400
    assert "incorrect" in res.json()["detail"].lower()
    assert db_session.query(User).one().hashed_password == before


@pytest.mark.parametrize(
    "new_password",
    ["short1", "onlyletterspassword", "1234567890", "oldpassword1", "x" * 129 + "1"],
)
def test_change_password_validation(client, new_password):
    _, headers = register_and_login(client)
    res = client.post(
        "/api/v1/auth/me/password",
        headers=headers,
        json={"current_password": PASSWORD, "new_password": new_password},
    )
    assert res.status_code == 422


def test_change_password_requires_current_password_field(client):
    _, headers = register_and_login(client)
    res = client.post("/api/v1/auth/me/password", headers=headers, json={"new_password": "brandnewpass2"})
    assert res.status_code == 422


def test_password_change_signs_out_other_sessions(client):
    old_tokens, old_headers = register_and_login(client)
    res = client.post(
        "/api/v1/auth/me/password",
        headers=old_headers,
        json={"current_password": PASSWORD, "new_password": "brandnewpass2"},
    )
    new_tokens = res.json()

    # Old access and refresh tokens stop working...
    assert client.get("/api/v1/auth/me", headers=old_headers).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": old_tokens["refresh_token"]}).status_code == 401
    # ...while the tokens returned by the change keep this session going.
    new_headers = {"Authorization": f"Bearer {new_tokens['access_token']}"}
    assert client.get("/api/v1/auth/me", headers=new_headers).status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}).status_code == 200


# ── Avatar ──────────────────────────────────────────────────────────────


def test_avatar_upload_download_and_delete(client):
    _, headers = register_and_login(client)
    assert client.get("/api/v1/auth/me/avatar", headers=headers).status_code == 404

    res = client.put("/api/v1/auth/me/avatar", headers={**headers, "Content-Type": "image/png"}, content=PNG)
    assert res.status_code == 200
    assert res.json()["avatar_version"] is not None

    got = client.get("/api/v1/auth/me/avatar", headers=headers)
    assert got.status_code == 200
    assert got.content == PNG
    assert got.headers["content-type"] == "image/png"
    assert got.headers["x-content-type-options"] == "nosniff"

    res = client.delete("/api/v1/auth/me/avatar", headers=headers)
    assert res.status_code == 200
    assert res.json()["avatar_version"] is None
    assert client.get("/api/v1/auth/me/avatar", headers=headers).status_code == 404


def test_avatar_replace(client):
    _, headers = register_and_login(client)
    client.put("/api/v1/auth/me/avatar", headers=headers, content=PNG)
    jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 32
    res = client.put("/api/v1/auth/me/avatar", headers=headers, content=jpeg)
    assert res.status_code == 200
    got = client.get("/api/v1/auth/me/avatar", headers=headers)
    assert got.headers["content-type"] == "image/jpeg"


@pytest.mark.parametrize(
    "body",
    [
        b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
        b"<html><script>alert(1)</script></html>",
        b"GIF89a\x01\x00\x01\x00",
        b"just some text pretending to be a picture",
    ],
)
def test_avatar_rejects_non_images_regardless_of_declared_type(client, body):
    _, headers = register_and_login(client)
    res = client.put("/api/v1/auth/me/avatar", headers={**headers, "Content-Type": "image/png"}, content=body)
    assert res.status_code == 415


def test_avatar_rejects_empty_and_oversized(client):
    _, headers = register_and_login(client)
    assert client.put("/api/v1/auth/me/avatar", headers=headers, content=b"").status_code == 400
    too_big = PNG + b"\x00" * (1024 * 1024 + 1)
    assert client.put("/api/v1/auth/me/avatar", headers=headers, content=too_big).status_code == 413


def test_avatars_are_private_to_their_owner(client):
    _, a = register_and_login(client, "a@tripmind.com")
    _, b = register_and_login(client, "b@tripmind.com")
    client.put("/api/v1/auth/me/avatar", headers=a, content=PNG)
    assert client.get("/api/v1/auth/me/avatar", headers=b).status_code == 404
    assert client.get("/api/v1/auth/me", headers=b).json()["avatar_version"] is None


def test_every_theme_id_fits_the_database_column():
    from app.core.preferences import THEMES
    from app.models.user import User

    assert max(len(t) for t in THEMES) <= User.__table__.c.theme.type.length
