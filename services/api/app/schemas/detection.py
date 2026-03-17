"""Pydantic schemas — boundary detection."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class DetectBoundariesRequest(BaseModel):
    """Request to trigger a boundary detection job."""

    bbox: list[float] = Field(..., min_length=4, max_length=4)
    window_a: str | None = Field(
        None,
        description="Planting season date range (ISO: YYYY-MM-DD/YYYY-MM-DD)",
    )
    window_b: str | None = Field(
        None,
        description="Harvest season date range (ISO: YYYY-MM-DD/YYYY-MM-DD)",
    )
    farm_id: uuid.UUID

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, v: list[float]) -> list[float]:
        if len(v) != 4:
            raise ValueError(
                "bbox must have exactly 4 values: [minx, miny, maxx, maxy]"
            )
        minx, miny, maxx, maxy = v
        if not (-180 <= minx <= 180 and -180 <= maxx <= 180):
            raise ValueError("longitude must be between -180 and 180")
        if not (-90 <= miny <= 90 and -90 <= maxy <= 90):
            raise ValueError("latitude must be between -90 and 90")
        if minx >= maxx or miny >= maxy:
            raise ValueError("min values must be less than max values")
        return v

    @field_validator("window_a", "window_b")
    @classmethod
    def validate_window(cls, v: str | None) -> str | None:
        if v is None:
            return v
        parts = v.split("/")
        if len(parts) != 2:
            raise ValueError("Date window must be in format YYYY-MM-DD/YYYY-MM-DD")
        for part in parts:
            date.fromisoformat(part)  # raises ValueError if invalid
        return v


class DetectedBoundaryOut(BaseModel):
    """Response schema for a detected boundary."""

    id: uuid.UUID
    org_id: uuid.UUID
    job_id: uuid.UUID
    geom: dict[str, Any] | None = None
    area_ha: float | None = None
    confidence: float | None = None
    status: str
    detection_date: date | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("geom", mode="before")
    @classmethod
    def convert_wkb_to_geojson(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        # Already a GeoJSON dict (e.g. from _boundary_to_out)
        if isinstance(v, dict):
            return v
        # Handle WKBElement from GeoAlchemy2
        try:
            from app.core.geo import wkb_to_geojson

            return wkb_to_geojson(v)
        except Exception:
            return None


class AcceptBoundaryRequest(BaseModel):
    """Request to accept a detected boundary as a new field."""

    name: str = Field(..., min_length=1, max_length=255)
    farm_id: uuid.UUID
    geom: dict[str, Any] | None = Field(
        None,
        description="Optional GeoJSON geometry override (for edit-and-accept)",
    )
