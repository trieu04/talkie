from __future__ import annotations

from typing import ClassVar, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class APIModel(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(from_attributes=True)


class BaseResponse(APIModel, Generic[T]):
    data: T


class ErrorDetail(APIModel):
    code: str
    message: str
    details: list[dict[str, object]] | None = None


class ErrorResponse(APIModel):
    error: ErrorDetail


class PaginatedResponse(APIModel, Generic[T]):
    items: list[T] = Field(default_factory=list)
    total: int
    limit: int
    offset: int
