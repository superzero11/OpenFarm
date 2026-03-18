"""Pydantic schemas — soil data."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class SoilLayerOut(BaseModel):
    depth_top_cm: int
    depth_bottom_cm: int

    # Baseline properties
    sand_pct: float | None = None
    silt_pct: float | None = None
    clay_pct: float | None = None
    ph: float | None = None
    soc_g_kg: float | None = None
    bd_kg_dm3: float | None = None
    cec_cmol_kg: float | None = None
    nitrogen_g_kg: float | None = None
    cfvo_pct: float | None = None

    # Water retention
    fc_vol_pct: float | None = None
    wp_vol_pct: float | None = None
    awc_mm: float | None = None
    ksat_cm_day: float | None = None

    # Texture
    texture_class: str | None = None

    # Uncertainty (90% CI)
    sand_q05: float | None = None
    sand_q95: float | None = None
    clay_q05: float | None = None
    clay_q95: float | None = None
    ph_q05: float | None = None
    ph_q95: float | None = None
    soc_q05: float | None = None
    soc_q95: float | None = None

    model_config = {"from_attributes": True}


class SoilProfileOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    source: str
    source_resolution_m: int | None = None
    fetched_at: datetime
    layers: list[SoilLayerOut] = []

    model_config = {"from_attributes": True}


class SoilFieldSummaryOut(BaseModel):
    id: uuid.UUID
    field_id: uuid.UUID
    dominant_texture: str | None = None
    avg_ph: float | None = None
    total_soc_stock_t_ha: float | None = None
    rootzone_awc_mm: float | None = None
    drainage_class: str | None = None

    # Risk scores (0–1)
    acidification_risk: float | None = None
    compaction_risk: float | None = None
    leaching_risk: float | None = None
    rooting_constraint: float | None = None

    data_quality_score: float | None = None
    computed_at: datetime

    model_config = {"from_attributes": True}


class SoilRefreshResponse(BaseModel):
    field_id: str
    job_id: str
    status: str
    message: str
