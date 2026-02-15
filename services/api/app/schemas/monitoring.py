"""Pydantic schemas — monitoring, alerts, scouting, jobs, share links."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


# ── Raster / NDVI Layers ─────────────────────────────────────────────

class RasterLayerOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    layer_type: str
    satellite: str
    date: date
    cog_uri: str
    tile_url: str | None = None
    min: float | None = None
    max: float | None = None
    provenance_json: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Field Stats ──────────────────────────────────────────────────────

class FieldStatOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    date: date
    mean: float | None = None
    median: float | None = None
    min: float | None = None
    max: float | None = None
    p10: float | None = None
    p90: float | None = None
    stddev: float | None = None
    quality_score: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Jobs ─────────────────────────────────────────────────────────────

class JobCreateNDVI(BaseModel):
    date_from: date
    date_to: date


class JobOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    type: str
    status: str
    progress_json: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Alerts ───────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    date: date
    severity: str
    rule_name: str
    rule_params_json: dict[str, Any] | None = None
    message: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertUpdate(BaseModel):
    status: str  # open | closed


# ── Scouting ─────────────────────────────────────────────────────────

class ScoutingCreate(BaseModel):
    geom_point: dict[str, Any]  # GeoJSON Point
    title: str
    note: str | None = None
    tags: list[str] | None = None
    photo_uri: str | None = None
    alert_id: uuid.UUID | None = None


class ScoutingUpdate(BaseModel):
    title: str | None = None
    note: str | None = None
    tags: list[str] | None = None


class ScoutingOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    alert_id: uuid.UUID | None = None
    geom_point: dict[str, Any] | None = None
    title: str
    note: str | None = None
    tags: list[str] | None = None
    photo_uri: str | None = None
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Share Links ──────────────────────────────────────────────────────

class ShareCreate(BaseModel):
    scope: str = "field_report"
    expires_in_days: int | None = 30  # 7, 30, or None (never)


class ShareOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    token: str
    scope: str
    expires_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ShareReportOut(BaseModel):
    """Public share link data — no auth required."""
    field: dict[str, Any]
    latest_layer: RasterLayerOut | None = None
    stats: list[FieldStatOut] = []
    alerts: list[AlertOut] = []
    scouting: list[ScoutingOut] = []


# ── Presigned Upload ─────────────────────────────────────────────────

class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"


class PresignedUploadOut(BaseModel):
    upload_url: str
    object_key: str


# ── Audit Events ─────────────────────────────────────────────────────

class AuditEventOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    event_type: str
    metadata_json: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
