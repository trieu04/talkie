from __future__ import annotations

import json
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.exceptions import RequestValidationError

from src.core.exceptions import (
    AppError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    app_error_handler,
    unhandled_exception_handler,
    validation_error_handler,
)


def parse_json_body(body: bytes | memoryview[int]) -> dict[str, object]:
    return cast(dict[str, object], json.loads(bytes(body)))


class TestAppErrors:
    def test_app_error_stores_message_code_and_status_code(self):
        error = AppError("Meeting failed", "MEETING_FAILED", 418)

        assert error.message == "Meeting failed"
        assert error.code == "MEETING_FAILED"
        assert error.status_code == 418

    @pytest.mark.parametrize(
        ("error_class", "expected_code", "expected_status_code"),
        [
            (AuthenticationError, "AUTHENTICATION_ERROR", 401),
            (AuthorizationError, "AUTHORIZATION_ERROR", 403),
            (ConflictError, "CONFLICT", 409),
            (NotFoundError, "NOT_FOUND", 404),
        ],
    )
    def test_specialized_errors_use_expected_defaults(
        self,
        error_class: type[AuthenticationError]
        | type[AuthorizationError]
        | type[ConflictError]
        | type[NotFoundError],
        expected_code: str,
        expected_status_code: int,
    ) -> None:
        error = error_class()

        assert error.code == expected_code
        assert error.status_code == expected_status_code

    async def test_app_error_handler_returns_expected_json_response(self):
        request = AsyncMock()

        response = await app_error_handler(request, AppError("Denied", "DENIED", 409))
        body = parse_json_body(response.body)

        assert response.status_code == 409
        assert body == {"error": {"code": "DENIED", "message": "Denied"}}

    async def test_validation_error_handler_returns_validation_error_payload(self):
        request = AsyncMock()
        error = RequestValidationError(
            [{"type": "missing", "loc": ("body", "title"), "msg": "Field required", "input": None}]
        )

        response = await validation_error_handler(request, error)
        body = parse_json_body(response.body)

        assert response.status_code == 422
        assert body == {
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": [
                    {
                        "type": "missing",
                        "loc": ["body", "title"],
                        "msg": "Field required",
                        "input": None,
                    }
                ],
            }
        }

    @patch("src.core.exceptions.logger")
    async def test_unhandled_exception_handler_returns_internal_server_error(
        self,
        _mock_logger: MagicMock,
    ):
        request = AsyncMock()
        error = RuntimeError("boom")

        response = await unhandled_exception_handler(request, error)
        body = parse_json_body(response.body)

        assert response.status_code == 500
        assert body == {
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
            }
        }
