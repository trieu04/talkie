from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.auth import TokenError, decode_token
from src.core.database import get_async_session
from src.core.exceptions import AuthenticationError
from src.models import Host

bearer_scheme = HTTPBearer(auto_error=False)

DBSession = Annotated[AsyncSession, Depends(get_async_session)]
BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


async def get_current_user(
    credentials: BearerCredentials,
    session: DBSession,
) -> Host:
    if credentials is None:
        raise AuthenticationError()

    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except TokenError as exc:
        raise AuthenticationError(str(exc)) from exc

    user_id = UUID(payload["sub"])
    result = await session.execute(select(Host).where(Host.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise AuthenticationError("Authenticated user no longer exists")
    return user


async def get_optional_user(
    credentials: BearerCredentials,
    session: DBSession,
) -> Host | None:
    if credentials is None:
        return None

    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except TokenError:
        return None

    user_id = UUID(payload["sub"])
    result = await session.execute(select(Host).where(Host.id == user_id))
    return result.scalar_one_or_none()
