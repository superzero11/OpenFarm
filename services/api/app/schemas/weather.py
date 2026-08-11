"""Pydantic schemas - weather data."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel


# ── Weather Daily Record ─────────────────────────────────────────────


class WeatherDailyOut(BaseModel):
    date: date
    temperature_2m_min: float | None = None
    temperature_2m_max: float | None = None
    temperature_2m_mean: float | None = None
    precipitation_sum: float | None = None
    et0_fao_mm: float | None = None
    soil_temperature_0cm: float | None = None
    soil_temperature_6cm: float | None = None
    soil_temperature_18cm: float | None = None
    soil_temperature_54cm: float | None = None
    soil_moisture_0_1cm: float | None = None
    soil_moisture_1_3cm: float | None = None
    soil_moisture_3_9cm: float | None = None
    soil_moisture_9_27cm: float | None = None
    soil_moisture_27_81cm: float | None = None
    vapor_pressure_deficit: float | None = None
    shortwave_radiation_sum: float | None = None
    wind_speed_10m_max: float | None = None
    cloud_cover_mean: int | None = None
    gdd_daily: float | None = None
    gdd_cumulative: float | None = None
    water_balance_30d_mm: float | None = None
    drought_index: float | None = None
    heat_stress_flag: bool | None = None

    model_config = {"from_attributes": True}


class WeatherForecastDay(BaseModel):
    date: date
    temperature_2m_min: float | None = None
    temperature_2m_max: float | None = None
    temperature_2m_mean: float | None = None
    precipitation_sum: float | None = None
    et0_fao_mm: float | None = None
    wind_speed_10m_max: float | None = None
    cloud_cover_mean: int | None = None


# ── Weather Summary ──────────────────────────────────────────────────


class WeatherSummaryOut(BaseModel):
    field_id: uuid.UUID
    period_start: date
    period_end: date
    avg_temperature: float | None = None
    min_temperature: float | None = None
    max_temperature: float | None = None
    total_precipitation: float | None = None
    total_et0: float | None = None
    water_deficit_mm: float | None = None
    gdd_cumulative: float | None = None
    frost_days: int = 0
    heat_stress_days: int = 0
    avg_soil_moisture_top: float | None = None
    drought_index: float | None = None
    data_source: str = "open-meteo"
    last_updated: datetime | None = None


# ── Response Envelopes ───────────────────────────────────────────────


class WeatherLocation(BaseModel):
    latitude: float
    longitude: float


class WeatherResponse(BaseModel):
    field_id: uuid.UUID
    location: WeatherLocation
    data: list[WeatherDailyOut]
    forecast: list[WeatherForecastDay] = []
    summary: WeatherSummaryOut


class WeatherBackfillRequest(BaseModel):
    days: int = 90


class WeatherBackfillResponse(BaseModel):
    field_id: uuid.UUID
    status: str
    message: str
