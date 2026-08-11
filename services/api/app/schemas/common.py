"""Pydantic schemas - shared envelope and pagination."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class PaginationParams(BaseModel):
    limit: int = 50
    offset: int = 0

    def clamp(self) -> "PaginationParams":
        return PaginationParams(
            limit=max(1, min(self.limit, 200)),
            offset=max(0, min(self.offset, 100_000)),
        )
