"""Pydantic schemas - soil data."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

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
    ksat_q05: float | None = None
    ksat_q95: float | None = None

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
    waterlogging_risk: float | None = None

    # Carbon
    topsoil_soc_stock_t_ha: float | None = None

    data_quality_score: float | None = None
    computed_at: datetime

    model_config = {"from_attributes": True}


class SoilRefreshResponse(BaseModel):
    field_id: str
    job_id: str
    status: str
    message: str


# ── Intelligence Schemas ─────────────────────────────────────────────


class SamplingZoneFeature(BaseModel):
    type: str = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any]


class SamplingZonesResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[SamplingZoneFeature] = []


class CropSuitabilityItem(BaseModel):
    crop: str
    name: str  # human-readable display name
    score: float  # 0-100
    rating: str  # excellent / good / moderate / poor
    limiting_factors: list[str] = []


class CropSuitabilityResponse(BaseModel):
    crops: list[CropSuitabilityItem] = []
    field_crop_type: str | None = None
    field_crop_suitability: CropSuitabilityItem | None = None
    weather_available: bool = True
    message: str | None = None


class NutrientContextResponse(BaseModel):
    zone_class: str
    confidence: float
    factors: list[str] = []
    interpretation: str
    disclaimer: str = (
        "This is soil context for planning purposes, not a fertilizer recommendation. "
        "Consult a local agronomist for specific nutrient management advice."
    )


class CarbonEstimateResponse(BaseModel):
    current_soc_stock_t_ha: float | None = None
    topsoil_soc_stock_t_ha: float | None = None
    estimated_soc_saturation_t_ha: float | None = None
    saturation_pct: float | None = None
    sequestration_potential_low_t_ha: float | None = None
    sequestration_potential_high_t_ha: float | None = None
    climate_zone: str | None = None
    disclaimer: str = ""


class SoilWeatherStressResponse(BaseModel):
    status: str  # drought_stress | optimal | wet_stress | approaching_drought | unknown
    severity: float
    moisture_status: str
    awc_rootzone_mm: float | None = None
    water_balance_30d_mm: float | None = None
    factors: list[str] = []
