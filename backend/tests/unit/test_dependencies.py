from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from src.core.auth import TokenError
from src.core.dependencies import get_current_user, get_optional_user
from src.core.exceptions import AuthenticationError
from src.models import Host


def make_scalar_result(value: object) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=value)
    return result


class TestGetCurrentUser:
    async def test_get_current_user_raises_authentication_error_when_credentials_none(
        self,
        mock_db_session: AsyncMock,
    ):
        with pytest.raises(AuthenticationError, match="Authentication required"):
            _ = await get_current_user(None, mock_db_session)

    @patch("src.core.dependencies.decode_token", side_effect=TokenError("Invalid or expired token"))
    async def test_get_current_user_raises_authentication_error_on_invalid_token(
        self,
        mock_decode_token: MagicMock,
        mock_db_session: AsyncMock,
    ):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")

        with pytest.raises(AuthenticationError, match="Invalid or expired token"):
            _ = await get_current_user(credentials, mock_db_session)

        mock_decode_token.assert_called_once_with("invalid-token", expected_type="access")

    @patch("src.core.dependencies.decode_token")
    async def test_get_current_user_raises_authentication_error_when_user_not_found(
        self,
        mock_decode_token: MagicMock,
        mock_db_session: AsyncMock,
    ):
        user_id = uuid.uuid4()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        mock_decode_token.return_value = {"sub": str(user_id), "type": "access"}
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(None))

        with pytest.raises(AuthenticationError, match="Authenticated user no longer exists"):
            _ = await get_current_user(credentials, mock_db_session)

    @patch("src.core.dependencies.decode_token")
    async def test_get_current_user_returns_host_on_valid_credentials(
        self,
        mock_decode_token: MagicMock,
        mock_db_session: AsyncMock,
    ):
        user_id = uuid.uuid4()
        host = Host(
            id=user_id,
            email="host@example.com",
            password_hash="hashed-password",
            display_name="Host User",
        )
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        mock_decode_token.return_value = {"sub": str(user_id), "type": "access"}
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(host))

        current_user = await get_current_user(credentials, mock_db_session)

        assert current_user is host


class TestGetOptionalUser:
    async def test_get_optional_user_returns_none_when_credentials_none(
        self,
        mock_db_session: AsyncMock,
    ):
        user = await get_optional_user(None, mock_db_session)

        assert user is None

    @patch("src.core.dependencies.decode_token", side_effect=TokenError("Invalid or expired token"))
    async def test_get_optional_user_returns_none_on_invalid_token(
        self,
        mock_decode_token: MagicMock,
        mock_db_session: AsyncMock,
    ):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token")

        user = await get_optional_user(credentials, mock_db_session)

        assert user is None
        mock_decode_token.assert_called_once_with("invalid-token", expected_type="access")

    @patch("src.core.dependencies.decode_token")
    async def test_get_optional_user_returns_host_on_valid_credentials(
        self,
        mock_decode_token: MagicMock,
        mock_db_session: AsyncMock,
    ):
        user_id = uuid.uuid4()
        host = Host(
            id=user_id,
            email="host@example.com",
            password_hash="hashed-password",
            display_name="Host User",
        )
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
        mock_decode_token.return_value = {"sub": str(user_id), "type": "access"}
        mock_db_session.execute = AsyncMock(return_value=make_scalar_result(host))

        user = await get_optional_user(credentials, mock_db_session)

        assert user is host
