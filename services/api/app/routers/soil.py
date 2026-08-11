"""Soil router - field soil profile, summary, refresh, intelligence endpoints."""

from __future__ import annotations

import uuid
from datetime import timedelta, timezone, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.logging import logger
from app.core.rate_limit import limiter
from app.core.soil_intelligence import (
    assess_crop_suitability,
    classify_nutrient_risk,
    compute_sampling_zones,
    compute_soil_weather_stress,
    estimate_sequestration_potential,
)
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import Field, Job, SoilFieldSummary, SoilProfile, WeatherDaily
from app.schemas.soil import (
    CarbonEstimateResponse,
    CropSuitabilityItem,
    CropSuitabilityResponse,
    NutrientContextResponse,
    SamplingZonesResponse,
    SoilFieldSummaryOut,
    SoilProfileOut,
    SoilRefreshResponse,
    SoilWeatherStressResponse,
)

router = APIRouter()

_writer = require_roles("owner", "admin")


async def _get_field_or_404(
    field_id: uuid.UUID,
    org_id: uuid.UUID,
    db: AsyncSession,
) -> Field:
    field = await db.get(Field, field_id)
    if not field or field.org_id != org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


@router.get("/fields/{field_id}/soil", response_model=SoilProfileOut)
async def get_soil_profile(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return the soil profile with all layers for a field."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    result = await db.execute(
        select(SoilProfile)
        .options(selectinload(SoilProfile.layers))
        .where(SoilProfile.field_id == field_id)
        .order_by(SoilProfile.fetched_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Soil profile not yet available")

    return profile


@router.get("/fields/{field_id}/soil/summary", response_model=SoilFieldSummaryOut)
async def get_soil_summary(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return the aggregated soil summary for a field."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    result = await db.execute(
        select(SoilFieldSummary).where(SoilFieldSummary.field_id == field_id)
    )
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Soil summary not yet available")

    return summary


@router.post(
    "/fields/{field_id}/soil/refresh",
    response_model=SoilRefreshResponse,
    status_code=202,
)
@limiter.limit("1/minute")
async def refresh_soil(
    request: Request,
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Trigger a re-fetch of soil data for a field."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    # Create a Job row for progress tracking
    job = Job(
        org_id=ctx.org_id,
        field_id=field_id,
        type="soil_fetch",
        status="pending",
        created_by=ctx.user.id,
    )
    db.add(job)
    await db.flush()

    from app.tasks.soil import fetch_soil_for_field

    fetch_soil_for_field.delay(str(field_id), str(job.id))

    logger.info(
        "soil_refresh_triggered",
        field_id=str(field_id),
        job_id=str(job.id),
        user_id=str(ctx.user.id),
    )

    return SoilRefreshResponse(
        field_id=str(field_id),
        job_id=str(job.id),
        status="accepted",
        message="Soil data refresh queued.",
    )


# ── Intelligence Endpoints ───────────────────────────────────────────


async def _get_profile_and_summary(
    field_id: uuid.UUID, db: AsyncSession
) -> tuple[SoilProfile, SoilFieldSummary]:
    """Load profile with layers + summary, or raise 404."""
    result = await db.execute(
        select(SoilProfile)
        .options(selectinload(SoilProfile.layers))
        .where(SoilProfile.field_id == field_id)
        .order_by(SoilProfile.fetched_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Soil data not yet available")

    s_result = await db.execute(
        select(SoilFieldSummary).where(SoilFieldSummary.field_id == field_id)
    )
    summary = s_result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Soil summary not yet available")

    return profile, summary


def _layers_to_dicts(layers) -> list[dict]:
    """Convert SoilLayer ORM objects to plain dicts for intelligence functions."""
    return [
        {
            "depth_top_cm": lyr.depth_top_cm,
            "depth_bottom_cm": lyr.depth_bottom_cm,
            "sand_pct": lyr.sand_pct,
            "silt_pct": lyr.silt_pct,
            "clay_pct": lyr.clay_pct,
            "ph": lyr.ph,
            "soc_g_kg": lyr.soc_g_kg,
            "bd_kg_dm3": lyr.bd_kg_dm3,
            "cec_cmol_kg": lyr.cec_cmol_kg,
            "nitrogen_g_kg": lyr.nitrogen_g_kg,
            "cfvo_pct": lyr.cfvo_pct,
            "fc_vol_pct": lyr.fc_vol_pct,
            "wp_vol_pct": lyr.wp_vol_pct,
            "awc_mm": lyr.awc_mm,
            "ksat_cm_day": lyr.ksat_cm_day,
            "texture_class": lyr.texture_class,
            "sand_q05": lyr.sand_q05,
            "sand_q95": lyr.sand_q95,
            "clay_q05": lyr.clay_q05,
            "clay_q95": lyr.clay_q95,
            "ph_q05": lyr.ph_q05,
            "ph_q95": lyr.ph_q95,
            "soc_q05": lyr.soc_q05,
            "soc_q95": lyr.soc_q95,
        }
        for lyr in layers
    ]


def _summary_to_dict(s: SoilFieldSummary) -> dict:
    """Convert SoilFieldSummary ORM object to plain dict."""
    return {
        "dominant_texture": s.dominant_texture,
        "avg_ph": float(s.avg_ph) if s.avg_ph is not None else None,
        "total_soc_stock_t_ha": float(s.total_soc_stock_t_ha)
        if s.total_soc_stock_t_ha is not None
        else None,
        "topsoil_soc_stock_t_ha": float(s.topsoil_soc_stock_t_ha)
        if s.topsoil_soc_stock_t_ha is not None
        else None,
        "rootzone_awc_mm": float(s.rootzone_awc_mm)
        if s.rootzone_awc_mm is not None
        else None,
        "drainage_class": s.drainage_class,
        "acidification_risk": float(s.acidification_risk)
        if s.acidification_risk is not None
        else None,
        "compaction_risk": float(s.compaction_risk)
        if s.compaction_risk is not None
        else None,
        "leaching_risk": float(s.leaching_risk)
        if s.leaching_risk is not None
        else None,
        "rooting_constraint": float(s.rooting_constraint)
        if s.rooting_constraint is not None
        else None,
        "waterlogging_risk": float(s.waterlogging_risk)
        if s.waterlogging_risk is not None
        else None,
    }


@router.get(
    "/fields/{field_id}/soil/sampling-zones",
    response_model=SamplingZonesResponse,
)
async def get_sampling_zones(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return suggested sampling zone GeoJSON based on soil variability."""
    field = await _get_field_or_404(field_id, ctx.org_id, db)
    profile, _summary = await _get_profile_and_summary(field_id, db)

    layer_dicts = _layers_to_dicts(profile.layers)

    # Get centroid from profile metadata or field geometry
    meta = profile.metadata_json or {}
    centroid_lat = meta.get("centroid_lat")
    centroid_lon = meta.get("centroid_lon")
    if centroid_lat is None or centroid_lon is None:
        from geoalchemy2.shape import to_shape

        geom = to_shape(field.geom)
        centroid = geom.centroid
        centroid_lat, centroid_lon = centroid.y, centroid.x

    area_ha = float(field.area_ha) if field.area_ha else None

    zones = compute_sampling_zones(layer_dicts, centroid_lat, centroid_lon, area_ha)
    return SamplingZonesResponse(features=zones)


@router.get(
    "/fields/{field_id}/soil/crop-suitability",
    response_model=CropSuitabilityResponse,
)
async def get_crop_suitability(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return crop suitability scores for the field's soil conditions."""
    field = await _get_field_or_404(field_id, ctx.org_id, db)
    profile, summary = await _get_profile_and_summary(field_id, db)

    summary_dict = _summary_to_dict(summary)
    layer_dicts = _layers_to_dicts(profile.layers)

    # ── Build weather summary for 4-pillar scoring ─────────────
    weather_summary: dict | None = None
    now = datetime.now(timezone.utc).date()
    one_year_ago = now - timedelta(days=365)

    # Annual aggregation (full year for proper rainfall totals)
    annual_result = await db.execute(
        select(
            func.sum(WeatherDaily.precipitation_sum),
            func.avg(WeatherDaily.temperature_2m_mean),
            func.min(WeatherDaily.temperature_2m_min),
            func.max(WeatherDaily.temperature_2m_max),
            func.count(),
        ).where(
            WeatherDaily.field_id == field_id,
            WeatherDaily.date >= one_year_ago,
        )
    )
    arow = annual_result.one_or_none()
    day_count = int(arow[4]) if arow and arow[4] else 0
    # Need 90+ days for meaningful annual extrapolation
    has_weather = day_count >= 90

    if has_weather:
        weather_summary = {
            "annual_rainfall_mm": float(arow[0]) * (365 / day_count)
            if arow[0]
            else None,
            "avg_temp_c": float(arow[1]) if arow[1] else None,
            "min_temp_c": float(arow[2]) if arow[2] else None,
            "max_temp_c": float(arow[3]) if arow[3] else None,
            "water_balance_30d_mm": None,
            "drought_index": None,
            "drought_severity": None,
        }

        # Latest 30-day stress data
        recent_result = await db.execute(
            select(WeatherDaily)
            .where(
                WeatherDaily.field_id == field_id,
                WeatherDaily.date >= now - timedelta(days=30),
            )
            .order_by(WeatherDaily.date.desc())
            .limit(1)
        )
        latest = recent_result.scalar_one_or_none()
        if latest:
            if latest.water_balance_30d_mm is not None:
                weather_summary["water_balance_30d_mm"] = float(
                    latest.water_balance_30d_mm
                )
            if latest.drought_index is not None:
                weather_summary["drought_index"] = float(latest.drought_index)
                # Convert drought_index to severity: 0 = normal, 1 = extreme
                # Negative drought_index = water deficit (drought)
                di = float(latest.drought_index)
                if di < 0:
                    weather_summary["drought_severity"] = min(1.0, abs(di) / 3.0)

    results = assess_crop_suitability(summary_dict, layer_dicts, weather_summary)

    if not has_weather:
        return CropSuitabilityResponse(
            crops=[],
            field_crop_type=field.crop_type,
            field_crop_suitability=None,
            weather_available=False,
            message="Crop suitability requires weather data. Run the weather pipeline first.",
        )

    crops_out = [
        CropSuitabilityItem(
            crop=r.crop,
            name=r.name,
            score=r.score,
            rating=r.rating,
            limiting_factors=r.limiting_factors,
        )
        for r in results
    ]

    # Highlight current crop if set (search full list before truncating)
    field_crop = field.crop_type
    field_crop_item = None
    if field_crop:
        crop_key = field_crop.lower().replace(" ", "_").replace("/", "_")
        for item in crops_out:
            if item.crop == crop_key:
                field_crop_item = item
                break

    return CropSuitabilityResponse(
        crops=crops_out[:10],
        field_crop_type=field_crop,
        field_crop_suitability=field_crop_item,
        weather_available=True,
    )


@router.get(
    "/fields/{field_id}/soil/nutrient-context",
    response_model=NutrientContextResponse,
)
async def get_nutrient_context(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return nutrient risk zone classification for the field."""
    await _get_field_or_404(field_id, ctx.org_id, db)
    profile, summary = await _get_profile_and_summary(field_id, db)

    summary_dict = _summary_to_dict(summary)
    layer_dicts = _layers_to_dicts(profile.layers)

    result = classify_nutrient_risk(summary_dict, layer_dicts)

    return NutrientContextResponse(
        zone_class=result.zone_class,
        confidence=result.confidence,
        factors=result.factors,
        interpretation=result.interpretation,
    )


@router.get(
    "/fields/{field_id}/soil/carbon",
    response_model=CarbonEstimateResponse,
)
async def get_carbon_estimate(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return SOC stock, saturation estimate, and sequestration potential."""
    await _get_field_or_404(field_id, ctx.org_id, db)
    profile, summary = await _get_profile_and_summary(field_id, db)

    summary_dict = _summary_to_dict(summary)
    layer_dicts = _layers_to_dicts(profile.layers)

    # Gather annual climate data from weather_daily
    annual_precip = None
    annual_temp = None
    one_year_ago = datetime.now(timezone.utc).date() - timedelta(days=365)
    wd_result = await db.execute(
        select(
            func.sum(WeatherDaily.precipitation_sum),
            func.avg(WeatherDaily.temperature_2m_mean),
            func.count(),
        ).where(
            WeatherDaily.field_id == field_id,
            WeatherDaily.date >= one_year_ago,
        )
    )
    row = wd_result.one_or_none()
    if row and row[2] and row[2] > 180:  # need at least 6 months of data
        annual_precip = float(row[0]) * (365 / int(row[2])) if row[0] else None
        annual_temp = float(row[1]) if row[1] else None

    result = estimate_sequestration_potential(
        summary_dict, layer_dicts, annual_precip, annual_temp
    )

    seq_low = None
    seq_high = None
    if result.sequestration_potential_t_ha:
        seq_low, seq_high = result.sequestration_potential_t_ha

    return CarbonEstimateResponse(
        current_soc_stock_t_ha=result.current_soc_stock_t_ha,
        topsoil_soc_stock_t_ha=result.topsoil_soc_stock_t_ha,
        estimated_soc_saturation_t_ha=result.estimated_soc_saturation_t_ha,
        saturation_pct=result.saturation_pct,
        sequestration_potential_low_t_ha=seq_low,
        sequestration_potential_high_t_ha=seq_high,
        climate_zone=result.climate_zone,
        disclaimer=result.disclaimer,
    )


@router.get(
    "/fields/{field_id}/soil/weather-stress",
    response_model=SoilWeatherStressResponse,
)
async def get_soil_weather_stress(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return current root-zone moisture stress assessment."""
    await _get_field_or_404(field_id, ctx.org_id, db)
    _profile, summary = await _get_profile_and_summary(field_id, db)

    summary_dict = _summary_to_dict(summary)

    # Get latest weather data for stress calculation
    now = datetime.now(timezone.utc).date()
    wd_result = await db.execute(
        select(WeatherDaily)
        .where(
            WeatherDaily.field_id == field_id,
            WeatherDaily.date >= now - timedelta(days=30),
        )
        .order_by(WeatherDaily.date.desc())
    )
    weather_rows = wd_result.scalars().all()

    water_balance = None
    drought_idx = None
    soil_moisture = None

    if weather_rows:
        latest = weather_rows[0]
        if latest.water_balance_30d_mm is not None:
            water_balance = float(latest.water_balance_30d_mm)
        if latest.drought_index is not None:
            drought_idx = float(latest.drought_index)
        if latest.soil_moisture_0_1cm is not None:
            soil_moisture = float(latest.soil_moisture_0_1cm)

        # Fallback: compute water balance from last 30 days
        if water_balance is None:
            total_precip = sum(float(r.precipitation_sum or 0) for r in weather_rows)
            total_et0 = sum(float(r.et0_fao_mm or 0) for r in weather_rows)
            water_balance = round(total_precip - total_et0, 1)

    result = compute_soil_weather_stress(
        summary_dict, water_balance, drought_idx, soil_moisture
    )

    return SoilWeatherStressResponse(
        status=result.status,
        severity=result.severity,
        moisture_status=result.moisture_status,
        awc_rootzone_mm=result.awc_rootzone_mm,
        water_balance_30d_mm=result.water_balance_30d_mm,
        factors=result.factors,
    )
