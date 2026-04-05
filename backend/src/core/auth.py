from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import TypedDict

from jose import JWTError, jwt
from passlib.context import CryptContext

from src.core.config import settings

PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(ValueError):
    pass


class TokenPayload(TypedDict):
    sub: str
    type: str


class TokenPair(TypedDict):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_password(password: str) -> str:
    validate_password_strength(password)
    return pwd_context.hash(password)


def validate_password_strength(password: str) -> None:
    if not PASSWORD_PATTERN.match(password):
        raise ValueError(
            "Password must be at least 8 characters and include uppercase, lowercase, and number"
        )


def _create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    expires_at = datetime.now(UTC) + expires_delta
    payload: dict[str, str | datetime] = {
        "sub": subject,
        "type": token_type,
        "exp": expires_at,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str) -> str:
    return _create_token(
        subject=subject,
        token_type="access",
        expires_delta=timedelta(minutes=settings.jwt_access_expire_minutes),
    )


def create_refresh_token(subject: str) -> str:
    return _create_token(
        subject=subject,
        token_type="refresh",
        expires_delta=timedelta(days=settings.jwt_refresh_expire_days),
    )


def decode_token(token: str, expected_type: str | None = None) -> TokenPayload:
    try:
        payload_raw = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError("Invalid or expired token") from exc

    subject = payload_raw.get("sub")
    token_type = payload_raw.get("type")
    if not isinstance(subject, str) or not subject:
        raise TokenError("Token missing subject")
    if expected_type is not None and token_type != expected_type:
        raise TokenError("Token has invalid type")
    return {"sub": subject, "type": str(token_type)}


def build_token_pair(subject: str) -> TokenPair:
    return {
        "access_token": create_access_token(subject),
        "refresh_token": create_refresh_token(subject),
        "token_type": "bearer",
        "expires_in": settings.jwt_access_expire_minutes * 60,
    }
