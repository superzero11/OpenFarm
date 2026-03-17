"""Weather data tasks — fetch from Open-Meteo, compute agricultural indices.

Daily polling + historical backfill via Celery Beat.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import httpx
import structlog
from celery import group
from geoalchemy2.shape import to_shape
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import settings
from app.worker import celery_app

logger = structlog.get_logger()

# Open-Meteo daily variables (natively available as daily aggregates)
DAILY_VARIABLES = [
    "temperature_2m_min",
    "temperature_2m_max",
    "temperature_2m_mean",
    "precipitation_sum",
    "et0_fao_evapotranspiration",
    "shortwave_radiation_sum",
    "wind_speed_10m_max",
]

# Open-Meteo hourly variables (soil, VPD, cloud — aggregated to daily by us)
HOURLY_VARIABLES = [
    "soil_temperature_0cm",
    "soil_temperature_6cm",
    "soil_temperature_18cm",
    "soil_temperature_54cm",
    "soil_moisture_0_to_1cm",
    "soil_moisture_1_to_3cm",
    "soil_moisture_3_to_9cm",
    "soil_moisture_9_to_27cm",
    "soil_moisture_27_to_81cm",
    "vapour_pressure_deficit",
    "cloud_cover",
]

# Mapping from Open-Meteo response keys to our DB column names
DAILY_VARIABLE_MAP = {
    "temperature_2m_min": "temperature_2m_min",
    "temperature_2m_max": "temperature_2m_max",
    "temperature_2m_mean": "temperature_2m_mean",
    "precipitation_sum": "precipitation_sum",
    "et0_fao_evapotranspiration": "et0_fao_mm",
    "shortwave_radiation_sum": "shortwave_radiation_sum",
    "wind_speed_10m_max": "wind_speed_10m_max",
}

HOURLY_VARIABLE_MAP = {
    "soil_temperature_0cm": "soil_temperature_0cm",
    "soil_temperature_6cm": "soil_temperature_6cm",
    "soil_temperature_18cm": "soil_temperature_18cm",
    "soil_temperature_54cm": "soil_temperature_54cm",
    "soil_moisture_0_to_1cm": "soil_moisture_0_1cm",
    "soil_moisture_1_to_3cm": "soil_moisture_1_3cm",
    "soil_moisture_3_to_9cm": "soil_moisture_3_9cm",
    "soil_moisture_9_to_27cm": "soil_moisture_9_27cm",
    "soil_moisture_27_to_81cm": "soil_moisture_27_81cm",
    "vapour_pressure_deficit": "vapor_pressure_deficit",
    "cloud_cover": "cloud_cover_mean",
}


def _get_db_session():
    from app.core.database_sync import SyncSession

    return SyncSession()


def _calculate_gdd(
    t_max: float | None, t_min: float | None, base: float = 10.0
) -> float | None:
    """Calculate daily Growing Degree Days."""
    if t_max is None or t_min is None:
        return None
    avg = (float(t_max) + float(t_min)) / 2.0
    return max(0.0, avg - base)


def _fetch_open_meteo(
    latitude: float,
    longitude: float,
    start_date: date,
    end_date: date,
    *,
    use_archive: bool = False,
) -> dict:
    """Fetch weather data from Open-Meteo API (synchronous for Celery).

    Requests daily variables natively and hourly variables (soil, VPD, cloud)
    separately, then aggregates hourly → daily averages.
    """
    base_url = (
        settings.open_meteo_archive_url
        if use_archive
        else settings.open_meteo_forecast_url
    )

    params: dict = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": ",".join(DAILY_VARIABLES),
        "hourly": ",".join(HOURLY_VARIABLES),
        "timezone": "UTC",
    }
    if settings.open_meteo_api_key:
        params["apikey"] = settings.open_meteo_api_key

    with httpx.Client(timeout=30.0) as client:
        response = client.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

    # Aggregate hourly → daily for soil/VPD/cloud variables
    hourly = data.get("hourly", {})
    hourly_times = hourly.get("time", [])
    if hourly_times:
        # Group hourly values by date, compute daily mean
        from collections import defaultdict
        daily_agg: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        for i, ts in enumerate(hourly_times):
            day = ts[:10]  # "YYYY-MM-DD"
            for var in HOURLY_VARIABLES:
                vals = hourly.get(var)
                if vals and i < len(vals) and vals[i] is not None:
                    daily_agg[day][var].append(vals[i])

        # Inject aggregated hourly data into the daily section
        daily = data.setdefault("daily", {})
        daily_dates = daily.get("time", [])
        for var in HOURLY_VARIABLES:
            daily[var] = [
                round(sum(daily_agg[d][var]) / len(daily_agg[d][var]), 4)
                if daily_agg[d][var]
                else None
                for d in daily_dates
            ]

    return data


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def fetch_weather_for_field(
    self,
    field_id: str,
    backfill_days: int = 0,
) -> dict:
    """Fetch weather data from Open-Meteo for a single field.

    Args:
        field_id: UUID of the field.
        backfill_days: If >0, fetch last N days via archive API.
            If 0, fetch yesterday + today via forecast API.

    Returns:
        dict with field_id, rows_upserted, status.
    """
    from app.models.tables import Field, WeatherDaily

    session = _get_db_session()
    try:
        field = session.get(Field, uuid.UUID(field_id))
        if not field:
            logger.warning("weather_field_not_found", field_id=field_id)
            return {"field_id": field_id, "rows_upserted": 0, "status": "skipped"}

        if field.deleted_at is not None:
            logger.info("weather_field_deleted", field_id=field_id)
            return {"field_id": field_id, "rows_upserted": 0, "status": "skipped"}

        # Compute centroid from field geometry
        geom_shape = to_shape(field.geom)
        centroid = geom_shape.centroid
        lat, lon = centroid.y, centroid.x

        today = date.today()
        if backfill_days > 0:
            start_date = today - timedelta(days=backfill_days)
            end_date = today - timedelta(days=1)
            use_archive = True
        else:
            start_date = today - timedelta(days=1)
            end_date = today
            use_archive = False

        logger.info(
            "weather_fetch_start",
            field_id=field_id,
            lat=lat,
            lon=lon,
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            archive=use_archive,
        )

        data = _fetch_open_meteo(
            lat, lon, start_date, end_date, use_archive=use_archive
        )

        daily = data.get("daily")
        if not daily or "time" not in daily:
            logger.warning("weather_no_daily_data", field_id=field_id)
            return {"field_id": field_id, "rows_upserted": 0, "status": "no_data"}

        # Get last known cumulative GDD for this field
        last_gdd_row = session.execute(
            select(WeatherDaily.gdd_cumulative, WeatherDaily.date)
            .where(
                WeatherDaily.field_id == uuid.UUID(field_id),
                WeatherDaily.gdd_cumulative.isnot(None),
            )
            .order_by(WeatherDaily.date.desc())
            .limit(1)
        ).first()
        cumulative_gdd = float(last_gdd_row[0]) if last_gdd_row else 0.0

        gdd_base = settings.weather_gdd_base_temp
        heat_threshold = settings.weather_heat_stress_threshold
        rows_upserted = 0

        for i, date_str in enumerate(daily["time"]):
            row_date = date.fromisoformat(date_str)

            # Extract raw variables from API response
            record: dict = {
                "field_id": uuid.UUID(field_id),
                "org_id": field.org_id,
                "date": row_date,
                "latitude": Decimal(str(round(lat, 8))),
                "longitude": Decimal(str(round(lon, 8))),
                "source": "open-meteo",
                "model_used": "best_match",
                "updated_at": datetime.now(timezone.utc),
            }

            for api_key, db_col in DAILY_VARIABLE_MAP.items():
                values = daily.get(api_key)
                val = values[i] if values and i < len(values) else None
                record[db_col] = val

            for api_key, db_col in HOURLY_VARIABLE_MAP.items():
                values = daily.get(api_key)
                val = values[i] if values and i < len(values) else None
                record[db_col] = val

            # Compute derived indices
            t_max = record.get("temperature_2m_max")
            t_min = record.get("temperature_2m_min")
            gdd = _calculate_gdd(t_max, t_min, gdd_base)
            record["gdd_daily"] = gdd

            if gdd is not None:
                cumulative_gdd += gdd
            record["gdd_cumulative"] = round(cumulative_gdd, 1)

            # Heat stress flag
            if t_max is not None:
                record["heat_stress_flag"] = float(t_max) > heat_threshold
            else:
                record["heat_stress_flag"] = None

            # Upsert via INSERT ... ON CONFLICT DO UPDATE
            stmt = pg_insert(WeatherDaily).values(**record)
            stmt = stmt.on_conflict_do_update(
                constraint="uq_weather_field_date",
                set_={k: v for k, v in record.items() if k not in ("field_id", "date")},
            )
            session.execute(stmt)
            rows_upserted += 1

        session.commit()

        # Compute water balance and drought index via SQL update
        _update_water_balance(session, field_id)

        logger.info(
            "weather_fetch_complete",
            field_id=field_id,
            rows_upserted=rows_upserted,
        )
        return {
            "field_id": field_id,
            "rows_upserted": rows_upserted,
            "status": "success",
        }

    except httpx.HTTPStatusError as e:
        logger.error(
            "weather_api_error",
            field_id=field_id,
            status=e.response.status_code,
            detail=str(e),
        )
        session.rollback()
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))

    except Exception as e:
        logger.error(
            "weather_fetch_error",
            field_id=field_id,
            error=str(e),
            exc_info=True,
        )
        session.rollback()
        return {
            "field_id": field_id,
            "rows_upserted": 0,
            "status": "failed",
            "error": str(e),
        }
    finally:
        session.close()


def _update_water_balance(session, field_id: str) -> None:
    """Update 30-day water balance and drought index for recent records."""
    fid = uuid.UUID(field_id)
    cutoff = date.today() - timedelta(days=90)

    # Compute 30-day rolling water balance (precip - ET0)
    session.execute(
        text("""
            UPDATE weather_daily w
            SET water_balance_30d_mm = sub.wb,
                drought_index = CASE
                    WHEN sub.stddev_wb > 0
                    THEN sub.wb / sub.stddev_wb
                    ELSE 0
                END,
                updated_at = NOW()
            FROM (
                SELECT
                    id,
                    SUM(COALESCE(precipitation_sum, 0) - COALESCE(et0_fao_mm, 0))
                        OVER (
                            PARTITION BY field_id
                            ORDER BY date
                            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                        ) AS wb,
                    STDDEV(COALESCE(precipitation_sum, 0) - COALESCE(et0_fao_mm, 0))
                        OVER (
                            PARTITION BY field_id
                            ORDER BY date
                            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                        ) AS stddev_wb
                FROM weather_daily
                WHERE field_id = :field_id AND date >= :cutoff
            ) sub
            WHERE w.id = sub.id
        """),
        {"field_id": fid, "cutoff": cutoff},
    )
    session.commit()


@celery_app.task
def schedule_daily_weather_fetch() -> dict:
    """Scheduled task (Celery Beat, 08:00 UTC).

    Fetches weather for all active fields in batches.
    """
    from app.models.tables import Field

    session = _get_db_session()
    try:
        field_ids = (
            session.execute(select(Field.id).where(Field.deleted_at.is_(None)))
            .scalars()
            .all()
        )

        if not field_ids:
            logger.info("weather_schedule_no_fields")
            return {"fields": 0, "batches": 0}

        batch_size = settings.weather_batch_size
        batches = []
        for i in range(0, len(field_ids), batch_size):
            batch = field_ids[i : i + batch_size]
            task_group = group(fetch_weather_for_field.s(str(fid)) for fid in batch)
            batches.append(task_group)

        # Execute batches sequentially to avoid API stampede
        for batch in batches:
            batch.apply_async()

        logger.info(
            "weather_schedule_dispatched",
            fields=len(field_ids),
            batches=len(batches),
        )
        return {"fields": len(field_ids), "batches": len(batches)}

    finally:
        session.close()


@celery_app.task
def backfill_weather_for_field(field_id: str, days: int | None = None) -> dict:
    """Trigger a historical weather backfill for a field.

    Called on field creation or manually via API.
    """
    backfill = days or settings.weather_backfill_days
    logger.info(
        "weather_backfill_start",
        field_id=field_id,
        days=backfill,
    )
    return fetch_weather_for_field(field_id, backfill_days=backfill)
