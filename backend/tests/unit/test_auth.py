from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock
import bcrypt

from src.core.auth import (
    verify_password,
    hash_password,
    validate_password_strength,
    create_access_token,
    create_refresh_token,
    decode_token,
    build_token_pair,
    TokenError,
    PASSWORD_PATTERN,
)


class TestPasswordHashing:
    def test_hash_password_returns_different_hash(self):
        password = "ValidPass123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2
        assert hash1.startswith("$2")
        assert hash2.startswith("$2")

    def test_verify_password_correct(self):
        password = "ValidPass123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        password = "ValidPass123"
        hashed = hash_password(password)
        assert verify_password("WrongPass123", hashed) is False

    def test_hash_password_raises_on_weak_password(self):
        with pytest.raises(ValueError, match="Password must be at least 8 characters"):
            hash_password("weak")


class TestPasswordValidation:
    @pytest.mark.parametrize(
        "password",
        [
            "ValidPass1",
            "A1bcdefgh",
            "SuperSecure123",
            "Test1234",
        ],
    )
    def test_valid_passwords(self, password):
        validate_password_strength(password)

    @pytest.mark.parametrize(
        "password,reason",
        [
            ("short1A", "too short"),
            ("alllowercase1", "no uppercase"),
            ("ALLUPPERCASE1", "no lowercase"),
            ("NoNumbersHere", "no digit"),
            ("", "empty"),
            ("       ", "only spaces"),
        ],
    )
    def test_invalid_passwords(self, password, reason):
        with pytest.raises(ValueError):
            validate_password_strength(password)

    def test_password_pattern_matches_valid(self):
        assert PASSWORD_PATTERN.match("ValidPass1") is not None

    def test_password_pattern_rejects_invalid(self):
        assert PASSWORD_PATTERN.match("invalid") is None


class TestTokenCreation:
    @patch("src.core.auth.settings")
    def test_create_access_token(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_access_expire_minutes = 60

        token = create_access_token("user-123")
        assert isinstance(token, str)
        assert len(token) > 0

    @patch("src.core.auth.settings")
    def test_create_refresh_token(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_refresh_expire_days = 7

        token = create_refresh_token("user-123")
        assert isinstance(token, str)
        assert len(token) > 0

    @patch("src.core.auth.settings")
    def test_access_and_refresh_tokens_differ(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_access_expire_minutes = 60
        mock_settings.jwt_refresh_expire_days = 7

        access = create_access_token("user-123")
        refresh = create_refresh_token("user-123")
        assert access != refresh


class TestTokenDecoding:
    @patch("src.core.auth.settings")
    def test_decode_valid_access_token(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_access_expire_minutes = 60

        token = create_access_token("user-123")
        payload = decode_token(token, expected_type="access")
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"

    @patch("src.core.auth.settings")
    def test_decode_valid_refresh_token(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_refresh_expire_days = 7

        token = create_refresh_token("user-123")
        payload = decode_token(token, expected_type="refresh")
        assert payload["sub"] == "user-123"
        assert payload["type"] == "refresh"

    @patch("src.core.auth.settings")
    def test_decode_token_wrong_type_raises(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_access_expire_minutes = 60

        token = create_access_token("user-123")
        with pytest.raises(TokenError, match="Token has invalid type"):
            decode_token(token, expected_type="refresh")

    @patch("src.core.auth.settings")
    def test_decode_invalid_token_raises(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"

        with pytest.raises(TokenError, match="Invalid or expired token"):
            decode_token("invalid.token.here")

    @patch("src.core.auth.settings")
    def test_decode_token_wrong_secret_raises(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_access_expire_minutes = 60

        token = create_access_token("user-123")

        mock_settings.jwt_secret = "different-secret-key-32-characters"
        with pytest.raises(TokenError, match="Invalid or expired token"):
            decode_token(token)


class TestBuildTokenPair:
    @patch("src.core.auth.settings")
    def test_build_token_pair_structure(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_access_expire_minutes = 60
        mock_settings.jwt_refresh_expire_days = 7

        pair = build_token_pair("user-123")

        assert "access_token" in pair
        assert "refresh_token" in pair
        assert "token_type" in pair
        assert "expires_in" in pair
        assert pair["token_type"] == "bearer"
        assert pair["expires_in"] == 3600

    @patch("src.core.auth.settings")
    def test_build_token_pair_tokens_are_valid(self, mock_settings):
        mock_settings.jwt_secret = "test-secret-key-minimum-32-characters"
        mock_settings.jwt_algorithm = "HS256"
        mock_settings.jwt_access_expire_minutes = 60
        mock_settings.jwt_refresh_expire_days = 7

        pair = build_token_pair("user-123")

        access_payload = decode_token(pair["access_token"], expected_type="access")
        refresh_payload = decode_token(pair["refresh_token"], expected_type="refresh")

        assert access_payload["sub"] == "user-123"
        assert refresh_payload["sub"] == "user-123"
