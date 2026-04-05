from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

from fastapi import APIRouter, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import select

from src.core.auth import (
    build_token_pair,
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from src.core.dependencies import DBSession
from src.core.exceptions import AuthenticationError, ConflictError
from src.models import Host

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str = Field(min_length=1, max_length=100)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Display name cannot be empty")
        return stripped


class HostResponse(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    expires_in: int


@router.post("/register", response_model=HostResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: DBSession) -> HostResponse:
    existing_user = await session.execute(select(Host).where(Host.email == payload.email))
    if existing_user.scalar_one_or_none() is not None:
        raise ConflictError("Email already registered")

    user = Host(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return HostResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: DBSession) -> TokenResponse:
    result = await session.execute(select(Host).where(Host.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise AuthenticationError("Invalid credentials")

    return TokenResponse(**build_token_pair(str(user.id)))


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(payload: RefreshRequest) -> RefreshResponse:
    token_payload = decode_token(payload.refresh_token, expected_type="refresh")
    access_token = create_access_token(token_payload["sub"])
    return RefreshResponse(access_token=access_token, expires_in=60 * 60)
