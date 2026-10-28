def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "healthy", "service": "Auth Service"}


def test_register_user_success(client):
    payload = {"email": "traveler@tripmind.com", "password": "securepassword123"}
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "traveler@tripmind.com"
    assert "id" in data
    assert "password" not in data
    assert "hashed_password" not in data


def test_register_duplicate_email(client):
    payload = {"email": "duplicate@tripmind.com", "password": "securepassword123"}
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_login_success(client):
    # Register first
    client.post("/api/v1/auth/register", json={"email": "login@tripmind.com", "password": "password123"})

    # Login
    res = client.post("/api/v1/auth/login", json={"email": "login@tripmind.com", "password": "password123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials(client):
    client.post("/api/v1/auth/register", json={"email": "valid@tripmind.com", "password": "password123"})

    # Wrong password
    res = client.post("/api/v1/auth/login", json={"email": "valid@tripmind.com", "password": "wrongpassword"})
    assert res.status_code == 401


def test_refresh_token(client):
    client.post("/api/v1/auth/register", json={"email": "refresh@tripmind.com", "password": "password123"})
    login_res = client.post("/api/v1/auth/login", json={"email": "refresh@tripmind.com", "password": "password123"})
    refresh_token = login_res.json()["refresh_token"]

    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200
    assert "access_token" in refresh_res.json()
    assert "refresh_token" in refresh_res.json()


def test_get_current_user_me(client):
    client.post("/api/v1/auth/register", json={"email": "me@tripmind.com", "password": "password123"})
    login_res = client.post("/api/v1/auth/login", json={"email": "me@tripmind.com", "password": "password123"})
    token = login_res.json()["access_token"]

    # Call /me with Bearer token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "me@tripmind.com"

    # Call /me without token -> 403 / 401
    unauth_res = client.get("/api/v1/auth/me")
    assert unauth_res.status_code in (401, 403)
