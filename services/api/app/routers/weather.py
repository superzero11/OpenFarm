"""Weather router — field weather data, summary, backfill."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import logger
from app.middleware.auth import OrgContext, get_org_context, require_roles
from app.models.tables import Field, WeatherDaily
from app.schemas.weather import (
    WeatherBackfillRequest,
    WeatherBackfillResponse,
    WeatherDailyOut,
    WeatherForecastDay,
    WeatherLocation,
    WeatherResponse,
    WeatherSummaryOut,
)

router = APIRouter()

_writer = require_roles("owner", "admin", "member")

# Daily variables requested from Open-Meteo forecast API
_FORECAST_VARIABLES = [
    "temperature_2m_min",
    "temperature_2m_max",
    "temperature_2m_mean",
    "precipitation_sum",
    "et0_fao_evapotranspiration",
    "wind_speed_10m_max",
    "cloud_cover_mean",
]


async def _get_field_or_404(
    field_id: uuid.UUID,
    org_id: uuid.UUID,
    db: AsyncSession,
) -> Field:
    field = await db.get(Field, field_id)
    if not field or field.org_id != org_id or field.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


async def _fetch_forecast(
    latitude: float, longitude: float, days: int = 7
) -> list[WeatherForecastDay]:
    """Fetch forecast from Open-Meteo (async, for API layer)."""
    params: dict = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": ",".join(_FORECAST_VARIABLES),
        "forecast_days": days,
        "timezone": "UTC",
        "models": "best_match",
    }
    if settings.open_meteo_api_key:
        params["apikey"] = settings.open_meteo_api_key

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(settings.open_meteo_forecast_url, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError:
        logger.warning("weather_forecast_fetch_failed", lat=latitude, lon=longitude)
        return []

    daily = data.get("daily")
    if not daily or "time" not in daily:
        return []

    forecast = []
    today = date.today()
    for i, date_str in enumerate(daily["time"]):
        d = date.fromisoformat(date_str)
        if d <= today:
            continue  # Only future dates
        forecast.append(
            WeatherForecastDay(
                date=d,
                temperature_2m_min=_safe_get(daily, "temperature_2m_min", i),
                temperature_2m_max=_safe_get(daily, "temperature_2m_max", i),
                temperature_2m_mean=_safe_get(daily, "temperature_2m_mean", i),
                precipitation_sum=_safe_get(daily, "precipitation_sum", i),
                et0_fao_mm=_safe_get(daily, "et0_fao_evapotranspiration", i),
                wind_speed_10m_max=_safe_get(daily, "wind_speed_10m_max", i),
                cloud_cover_mean=_safe_int(daily, "cloud_cover_mean", i),
            )
        )
    return forecast


def _safe_get(daily: dict, key: str, idx: int) -> float | None:
    values = daily.get(key)
    if values and idx < len(values):
        return values[idx]
    return None


def _safe_int(daily: dict, key: str, idx: int) -> int | None:
    val = _safe_get(daily, key, idx)
    return int(val) if val is not None else None


@router.get("/fields/{field_id}/weather", response_model=WeatherResponse)
async def get_field_weather(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    start_date: date = Query(..., description="Start date (ISO 8601)"),
    end_date: date = Query(..., description="End date (ISO 8601)"),
    include_forecast: bool = Query(True, description="Include 7-day forecast"),
):
    """Get weather data for a field within a date range."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    # Validate date range (max 365 days)
    if (end_date - start_date).days > 365:
        raise HTTPException(status_code=400, detail="Date range exceeds 365 days")
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    # Fetch historical data from DB
    result = await db.execute(
        select(WeatherDaily)
        .where(
            WeatherDaily.field_id == field_id,
            WeatherDaily.date >= start_date,
            WeatherDaily.date <= end_date,
        )
        .order_by(WeatherDaily.date)
    )
    rows = result.scalars().all()
    data = [WeatherDailyOut.model_validate(r) for r in rows]

    # Get centroid for forecast + location
    centroid_result = await db.execute(
        select(
            func.ST_Y(func.ST_Centroid(Field.geom)).label("lat"),
            func.ST_X(func.ST_Centroid(Field.geom)).label("lon"),
        ).where(Field.id == field_id)
    )
    centroid_row = centroid_result.one()
    lat, lon = float(centroid_row.lat), float(centroid_row.lon)

    # Fetch forecast if requested
    forecast: list[WeatherForecastDay] = []
    if include_forecast:
        forecast = await _fetch_forecast(lat, lon)

    # Compute summary from DB data
    summary = await _compute_summary(db, field_id, start_date, end_date)

    return WeatherResponse(
        field_id=field_id,
        location=WeatherLocation(latitude=lat, longitude=lon),
        data=data,
        forecast=forecast,
        summary=summary,
    )


@router.get("/fields/{field_id}/weather/summary", response_model=WeatherSummaryOut)
async def get_field_weather_summary(
    field_id: uuid.UUID,
    ctx: Annotated[OrgContext, Depends(get_org_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=365, description="Number of past days"),
):
    """Quick weather summary for dashboard cards."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    return await _compute_summary(db, field_id, start_date, end_date)


@router.post(
    "/fields/{field_id}/weather/backfill",
    response_model=WeatherBackfillResponse,
    status_code=202,
)
async def trigger_weather_backfill(
    field_id: uuid.UUID,
    body: WeatherBackfillRequest,
    ctx: Annotated[OrgContext, Depends(_writer)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Trigger a manual weather backfill for a field."""
    await _get_field_or_404(field_id, ctx.org_id, db)

    if body.days < 1 or body.days > 365:
        raise HTTPException(status_code=400, detail="days must be between 1 and 365")

    from app.tasks.weather import backfill_weather_for_field

    backfill_weather_for_field.delay(str(field_id), days=body.days)

    logger.info(
        "weather_backfill_triggered",
        field_id=str(field_id),
        days=body.days,
        user_id=str(ctx.user.id),
    )
    return WeatherBackfillResponse(
        field_id=field_id,
        status="accepted",
        message=f"Weather backfill for {body.days} days queued.",
    )


async def _compute_summary(
    db: AsyncSession,
    field_id: uuid.UUID,
    start_date: date,
    end_date: date,
) -> WeatherSummaryOut:
    """Compute aggregated weather summary from stored records."""
    result = await db.execute(
        select(
            func.avg(WeatherDaily.temperature_2m_mean).label("avg_temp"),
            func.min(WeatherDaily.temperature_2m_min).label("min_temp"),
            func.max(WeatherDaily.temperature_2m_max).label("max_temp"),
            func.sum(WeatherDaily.precipitation_sum).label("total_precip"),
            func.sum(WeatherDaily.et0_fao_mm).label("total_et0"),
            func.max(WeatherDaily.gdd_cumulative).label("gdd_cumulative"),
            func.avg(WeatherDaily.soil_moisture_0_1cm).label("avg_sm_top"),
            func.count()
            .filter(WeatherDaily.temperature_2m_min < 0)
            .label("frost_days"),
            func.count()
            .filter(WeatherDaily.heat_stress_flag.is_(True))
            .label("heat_days"),
            func.max(WeatherDaily.updated_at).label("last_updated"),
        ).where(
            WeatherDaily.field_id == field_id,
            WeatherDaily.date >= start_date,
            WeatherDaily.date <= end_date,
        )
    )
    row = result.one()

    avg_temp = _to_float(row.avg_temp)
    total_precip = _to_float(row.total_precip)
    total_et0 = _to_float(row.total_et0)
    water_deficit = None
    if total_precip is not None and total_et0 is not None:
        water_deficit = round(total_et0 - total_precip, 2)

    # Latest drought index
    latest_drought = await db.execute(
        select(WeatherDaily.drought_index)
        .where(
            WeatherDaily.field_id == field_id,
            WeatherDaily.drought_index.isnot(None),
        )
        .order_by(WeatherDaily.date.desc())
        .limit(1)
    )
    drought_row = latest_drought.scalar()

    return WeatherSummaryOut(
        field_id=field_id,
        period_start=start_date,
        period_end=end_date,
        avg_temperature=_round_opt(avg_temp, 1),
        min_temperature=_to_float(row.min_temp),
        max_temperature=_to_float(row.max_temp),
        total_precipitation=_round_opt(total_precip, 1),
        total_et0=_round_opt(total_et0, 1),
        water_deficit_mm=water_deficit,
        gdd_cumulative=_to_float(row.gdd_cumulative),
        frost_days=row.frost_days or 0,
        heat_stress_days=row.heat_days or 0,
        avg_soil_moisture_top=_round_opt(_to_float(row.avg_sm_top), 3),
        drought_index=_to_float(drought_row) if drought_row else None,
        last_updated=row.last_updated,
    )


def _to_float(val) -> float | None:
    return float(val) if val is not None else None


def _round_opt(val: float | None, digits: int) -> float | None:
    return round(val, digits) if val is not None else None
