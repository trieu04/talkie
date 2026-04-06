from __future__ import annotations

import uuid
from unittest.mock import patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.auth import build_token_pair, create_access_token, create_refresh_token
from src.models import Host


MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


def mock_hash_password(password: str) -> str:
    return MOCK_PASSWORD_HASH


def mock_verify_password(plain_password: str, password_hash: str) -> bool:
    return plain_password == "StrongPass1" and password_hash == MOCK_PASSWORD_HASH


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


@patch("src.api.auth.hash_password", side_effect=mock_hash_password)
async def test_register_success(mock_hash, integration_client: AsyncClient):
    response = await integration_client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "StrongPass1",
            "display_name": "New User",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "newuser@example.com"
    assert body["display_name"] == "New User"
    assert "id" in body
    assert "created_at" in body


@patch("src.api.auth.hash_password", side_effect=mock_hash_password)
async def test_register_duplicate_email(
    mock_hash,
    integration_client: AsyncClient,
    integration_db_session: AsyncSession,
):
    host = Host(
        id=uuid.uuid4(),
        email="dup@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Existing",
    )
    integration_db_session.add(host)
    await integration_db_session.commit()

    response = await integration_client.post(
        "/api/v1/auth/register",
        json={
            "email": "dup@example.com",
            "password": "StrongPass1",
            "display_name": "Another",
        },
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


async def test_register_weak_password(integration_client: AsyncClient):
    """Registration rejects passwords that don't match strength rules."""
    response = await integration_client.post(
        "/api/v1/auth/register",
        json={
            "email": "weak@example.com",
            "password": "short",
            "display_name": "Weak Pass",
        },
    )
    assert response.status_code == 422


async def test_register_invalid_email(integration_client: AsyncClient):
    """Registration rejects malformed emails."""
    response = await integration_client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "password": "StrongPass1",
            "display_name": "Bad Email",
        },
    )
    assert response.status_code == 422


async def test_register_empty_display_name(integration_client: AsyncClient):
    """Registration rejects empty display names."""
    response = await integration_client.post(
        "/api/v1/auth/register",
        json={
            "email": "empty@example.com",
            "password": "StrongPass1",
            "display_name": "   ",
        },
    )
    assert response.status_code == 422


async def test_register_missing_fields(integration_client: AsyncClient):
    """Registration rejects missing required fields."""
    response = await integration_client.post(
        "/api/v1/auth/register",
        json={"email": "partial@example.com"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@patch("src.api.auth.verify_password", side_effect=mock_verify_password)
async def test_login_success(
    mock_verify,
    integration_client: AsyncClient,
    integration_db_session: AsyncSession,
):
    host = Host(
        id=uuid.uuid4(),
        email="login@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Login User",
    )
    integration_db_session.add(host)
    await integration_db_session.commit()

    response = await integration_client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "StrongPass1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0


@patch("src.api.auth.verify_password", side_effect=mock_verify_password)
async def test_login_invalid_credentials(
    mock_verify,
    integration_client: AsyncClient,
    integration_db_session: AsyncSession,
):
    host = Host(
        id=uuid.uuid4(),
        email="badlogin@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Bad Login",
    )
    integration_db_session.add(host)
    await integration_db_session.commit()

    response = await integration_client.post(
        "/api/v1/auth/login",
        json={"email": "badlogin@example.com", "password": "WrongPass1"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_ERROR"


async def test_login_nonexistent_user(integration_client: AsyncClient):
    """Login with email that doesn't exist returns 401."""
    response = await integration_client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": "StrongPass1"},
    )
    assert response.status_code == 401


async def test_login_invalid_email_format(integration_client: AsyncClient):
    """Login with malformed email returns 422."""
    response = await integration_client.post(
        "/api/v1/auth/login",
        json={"email": "bad-email", "password": "StrongPass1"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Token Refresh
# ---------------------------------------------------------------------------


async def test_refresh_valid_token(
    integration_client: AsyncClient, integration_db_session: AsyncSession
):
    host = Host(
        id=uuid.uuid4(),
        email="refresh@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Refresh User",
    )
    integration_db_session.add(host)
    await integration_db_session.commit()

    refresh_token = create_refresh_token(str(host.id))
    response = await integration_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["expires_in"] > 0


async def test_refresh_invalid_token(integration_client: AsyncClient):
    response = await integration_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid.token.value"},
    )
    assert response.status_code == 401


async def test_refresh_with_access_token_rejected(
    integration_client: AsyncClient, integration_db_session: AsyncSession
):
    """Using an access token as refresh token should fail."""
    host = Host(
        id=uuid.uuid4(),
        email="wrongtype@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Wrong Type",
    )
    integration_db_session.add(host)
    await integration_db_session.commit()

    access_token = create_access_token(str(host.id))
    response = await integration_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# GET /hosts/me
# ---------------------------------------------------------------------------


async def test_get_me_authenticated(
    integration_client: AsyncClient, integration_db_session: AsyncSession
):
    """GET /hosts/me returns the current user."""
    host = Host(
        id=uuid.uuid4(),
        email="me@example.com",
        password_hash=MOCK_PASSWORD_HASH,
        display_name="Me User",
    )
    integration_db_session.add(host)
    await integration_db_session.commit()

    access_token = create_access_token(str(host.id))
    response = await integration_client.get(
        "/api/v1/hosts/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "me@example.com"
    assert body["display_name"] == "Me User"
    assert body["id"] == str(host.id)


async def test_get_me_unauthenticated(integration_client: AsyncClient):
    """GET /hosts/me without token returns 401."""
    response = await integration_client.get("/api/v1/hosts/me")
    assert response.status_code == 401


async def test_get_me_invalid_token(integration_client: AsyncClient):
    """GET /hosts/me with bad token returns 401."""
    response = await integration_client.get(
        "/api/v1/hosts/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Full registration → login → me flow
# ---------------------------------------------------------------------------


@patch("src.api.auth.hash_password", side_effect=mock_hash_password)
@patch("src.api.auth.verify_password", side_effect=mock_verify_password)
async def test_full_registration_login_flow(
    mock_verify,
    mock_hash,
    integration_client: AsyncClient,
):
    """Register → login → use token to fetch /hosts/me."""
    # 1. Register
    reg = await integration_client.post(
        "/api/v1/auth/register",
        json={
            "email": "flow@example.com",
            "password": "StrongPass1",
            "display_name": "Flow User",
        },
    )
    assert reg.status_code == 201
    user_id = reg.json()["id"]

    # 2. Login
    login_resp = await integration_client.post(
        "/api/v1/auth/login",
        json={"email": "flow@example.com", "password": "StrongPass1"},
    )
    assert login_resp.status_code == 200
    tokens = login_resp.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    # 3. GET /hosts/me with access token
    me = await integration_client.get(
        "/api/v1/hosts/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me.status_code == 200
    assert me.json()["id"] == user_id
    assert me.json()["email"] == "flow@example.com"

    # 4. Refresh token
    refresh_resp = await integration_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200
    new_access_token = refresh_resp.json()["access_token"]

    # 5. GET /hosts/me with refreshed token
    me2 = await integration_client.get(
        "/api/v1/hosts/me",
        headers={"Authorization": f"Bearer {new_access_token}"},
    )
    assert me2.status_code == 200
    assert me2.json()["id"] == user_id
