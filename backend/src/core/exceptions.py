from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int) -> None:
        self.message: str = message
        self.code: str = code
        self.status_code: int = status_code
        super().__init__(message)


class AuthenticationError(AppError):
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(
            message=message, code="AUTHENTICATION_ERROR", status_code=status.HTTP_401_UNAUTHORIZED
        )


class AuthorizationError(AppError):
    def __init__(self, message: str = "Permission denied") -> None:
        super().__init__(
            message=message, code="AUTHORIZATION_ERROR", status_code=status.HTTP_403_FORBIDDEN
        )


class ConflictError(AppError):
    def __init__(self, message: str = "Resource conflict") -> None:
        super().__init__(message=message, code="CONFLICT", status_code=status.HTTP_409_CONFLICT)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message=message, code="NOT_FOUND", status_code=status.HTTP_404_NOT_FOUND)


async def app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    app_error = exc if isinstance(exc, AppError) else AppError(str(exc), "APP_ERROR", 500)
    return JSONResponse(
        status_code=app_error.status_code,
        content={"error": {"code": app_error.code, "message": app_error.message}},
    )


async def validation_error_handler(_: Request, exc: Exception) -> JSONResponse:
    validation_error = (
        exc if isinstance(exc, RequestValidationError) else RequestValidationError([])
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": validation_error.errors(),
            }
        },
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled application error", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
            }
        },
    )


def install_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
