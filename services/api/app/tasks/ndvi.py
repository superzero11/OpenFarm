"""NDVI processing task — full Milestone 2 implementation.

Pipeline:
1. scene_search  — Query Element84 STAC for Sentinel-2 scenes
2. download_bands — Read B04/B08 via windowed COG reads
3. compute_ndvi  — NDVI = (NIR - Red) / (NIR + Red)
4. write_cog     — Write per-field clipped COG to MinIO
5. compute_stats — Zonal stats: mean, median, min, max, stddev, p10, p90
6. run_alerts    — Evaluate ndvi_drop and ndvi_threshold rules
7. complete      — Mark job done
"""

from __future__ import annotations

import os
import tempfile
import uuid
from datetime import date, datetime, timezone
from typing import Any

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
from minio import Minio
from pystac_client import Client as STACClient
from shapely.geometry import mapping
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

import structlog

from app.worker import celery_app

logger = structlog.get_logger()

# ── Configuration ────────────────────────────────────────────────────

STAC_API_URL = os.environ.get(
    "STAC_API_URL", "https://earth-search.aws.element84.com/v1"
)
STAC_COLLECTION = "sentinel-2-l2a"
MAX_CLOUD_COVER = 20
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "openfarm")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "openfarm_dev_secret")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET", "openfarm")
MINIO_SECURE = os.environ.get("MINIO_SECURE", "false").lower() == "true"

# GDAL environment for reading remote COGs
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif,.TIF,.tiff")
os.environ.setdefault("GDAL_HTTP_MERGE_CONSECUTIVE_RANGES", "YES")
os.environ.setdefault("GDAL_HTTP_MULTIPLEX", "YES")
os.environ.setdefault("VSI_CACHE", "TRUE")
os.environ.setdefault("VSI_CACHE_SIZE", "5000000")


def _get_minio_client() -> Minio:
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
    )


def _get_db_session():
    from app.core.database_sync import SyncSession

    return SyncSession()


def _update_job_progress(session, job, step: str, details: dict | None = None):
    progress = job.progress_json or {}
    progress["current_step"] = step
    progress.setdefault("steps", {})[step] = {
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    if details:
        progress["steps"][step].update(details)
    job.progress_json = progress
    flag_modified(job, "progress_json")
    session.commit()


def _complete_step(session, job, step: str, details: dict | None = None):
    progress = job.progress_json or {}
    if step in progress.get("steps", {}):
        progress["steps"][step]["status"] = "completed"
        progress["steps"][step]["finished_at"] = datetime.now(timezone.utc).isoformat()
        if details:
            progress["steps"][step].update(details)
    flag_modified(job, "progress_json")
    session.commit()


def _search_scenes(
    field_geom_geojson: dict, date_from: date, date_to: date
) -> list[dict]:
    """Search Element84 STAC for Sentinel-2 scenes covering the field."""
    catalog = STACClient.open(STAC_API_URL)
    search = catalog.search(
        collections=[STAC_COLLECTION],
        intersects=field_geom_geojson,
        datetime=f"{date_from.isoformat()}/{date_to.isoformat()}",
        query={"eo:cloud_cover": {"lt": MAX_CLOUD_COVER}},
        max_items=100,
    )
    items = list(search.items())
    logger.info(
        "stac_search_results",
        count=len(items),
        date_from=str(date_from),
        date_to=str(date_to),
    )

    if not items:
        return []

    # Group by week and pick best (lowest cloud cover) per week
    weekly: dict[str, Any] = {}
    for item in items:
        item_date = item.datetime.date() if item.datetime else date_from
        week_key = item_date.isocalendar()[:2]
        week_str = f"{week_key[0]}-W{week_key[1]:02d}"
        cloud = item.properties.get("eo:cloud_cover", 100)
        if week_str not in weekly or cloud < weekly[week_str]["cloud"]:
            weekly[week_str] = {"item": item, "cloud": cloud, "date": item_date}

    scenes = []
    for week_str in sorted(weekly.keys()):
        entry = weekly[week_str]
        item = entry["item"]
        red_asset = item.assets.get("red") or item.assets.get("B04")
        nir_asset = item.assets.get("nir") or item.assets.get("B08")
        scenes.append(
            {
                "id": item.id,
                "date": entry["date"],
                "cloud_cover": entry["cloud"],
                "red_href": red_asset.href if red_asset else None,
                "nir_href": nir_asset.href if nir_asset else None,
            }
        )
    return scenes


def _read_band_windowed(
    href: str, bounds: tuple, target_shape: tuple, target_transform
) -> np.ndarray:
    """Read a band from a remote COG, windowed to field extent.

    bounds are in EPSG:4326.  The source COG is typically in UTM, so we
    reproject bounds → src CRS before computing the rasterio window.
    """
    from rasterio.warp import transform_bounds

    with rasterio.open(href) as src:
        # Reproject EPSG:4326 bounds to the source CRS (e.g. UTM)
        src_bounds = transform_bounds("EPSG:4326", src.crs, *bounds)
        window = rasterio.windows.from_bounds(*src_bounds, transform=src.transform)
        data = src.read(1, window=window, boundless=True, fill_value=0)

        # Always reproject to the EPSG:4326 target grid
        dst = np.zeros(target_shape, dtype=np.float32)
        reproject(
            source=data.astype(np.float32),
            destination=dst,
            src_transform=rasterio.windows.transform(window, src.transform),
            src_crs=src.crs,
            dst_transform=target_transform,
            dst_crs="EPSG:4326",
            resampling=Resampling.bilinear,
        )
        return dst


def _compute_ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (nir - red) / (nir + red)
    ndvi = np.clip(ndvi, -1.0, 1.0)
    ndvi[~np.isfinite(ndvi)] = np.nan
    return ndvi


def _write_cog(
    ndvi: np.ndarray, transform, crs: str, org_id: str, field_id: str, scene_date: date
) -> str:
    """Write NDVI array as COG to MinIO. Returns the cog_uri."""
    object_key = f"cogs/{org_id}/{field_id}/{scene_date.isoformat()}/ndvi.tif"
    tmp_src_path = tempfile.mktemp(suffix="_src.tif")
    tmp_dst_path = tempfile.mktemp(suffix="_cog.tif")

    try:
        profile = {
            "driver": "GTiff",
            "dtype": "float32",
            "width": ndvi.shape[1],
            "height": ndvi.shape[0],
            "count": 1,
            "crs": crs,
            "transform": transform,
            "nodata": np.nan,
        }
        with rasterio.open(tmp_src_path, "w", **profile) as dst:
            dst.write(ndvi, 1)

        output_profile = cog_profiles.get("deflate")
        cog_translate(
            tmp_src_path, tmp_dst_path, output_profile, overview_level=2, quiet=True
        )

        _get_minio_client().fput_object(
            MINIO_BUCKET, object_key, tmp_dst_path, content_type="image/tiff"
        )
        logger.info("cog_uploaded", object_key=object_key)
        return f"s3://{MINIO_BUCKET}/{object_key}"
    finally:
        for p in [tmp_src_path, tmp_dst_path]:
            try:
                os.unlink(p)
            except OSError:
                pass


def _compute_zonal_stats(ndvi: np.ndarray) -> dict:
    valid = ndvi[np.isfinite(ndvi)]
    if len(valid) == 0:
        return {
            "mean": None,
            "median": None,
            "min": None,
            "max": None,
            "stddev": None,
            "p10": None,
            "p90": None,
            "quality_score": 0.0,
        }
    total_pixels = ndvi.size
    return {
        "mean": float(np.nanmean(valid)),
        "median": float(np.nanmedian(valid)),
        "min": float(np.nanmin(valid)),
        "max": float(np.nanmax(valid)),
        "stddev": float(np.nanstd(valid)),
        "p10": float(np.nanpercentile(valid, 10)),
        "p90": float(np.nanpercentile(valid, 90)),
        "quality_score": round(len(valid) / total_pixels, 4) if total_pixels else 0.0,
    }


def _run_alerts(
    session,
    field_id,
    org_id,
    scene_date: date,
    stats: dict,
    historical_means: list[float],
):
    from app.models.tables import Alert

    current_mean = stats.get("mean")
    if current_mean is None:
        return

    # ndvi_threshold
    threshold_params = {"threshold": 0.3}
    if current_mean < threshold_params["threshold"]:
        severity = "high" if current_mean < 0.15 else "medium"
        session.add(
            Alert(
                org_id=org_id,
                field_id=field_id,
                date=scene_date,
                severity=severity,
                rule_name="ndvi_threshold",
                rule_params_json=threshold_params,
                message=f"NDVI mean ({current_mean:.3f}) below threshold ({threshold_params['threshold']}). Consider scouting.",
                status="open",
            )
        )

    # ndvi_drop
    drop_params = {"drop_pct": 15, "window": 4}
    if len(historical_means) >= 2:
        window = historical_means[-drop_params["window"] :]
        rolling_avg = sum(window) / len(window)
        if rolling_avg > 0:
            drop_pct = ((rolling_avg - current_mean) / rolling_avg) * 100
            if drop_pct >= drop_params["drop_pct"]:
                severity = (
                    "high" if drop_pct >= 30 else "medium" if drop_pct >= 20 else "low"
                )
                session.add(
                    Alert(
                        org_id=org_id,
                        field_id=field_id,
                        date=scene_date,
                        severity=severity,
                        rule_name="ndvi_drop",
                        rule_params_json=drop_params,
                        message=f"NDVI dropped {drop_pct:.1f}% (from avg {rolling_avg:.3f} to {current_mean:.3f}). Investigate crop stress.",
                        status="open",
                    )
                )
    session.commit()


RETRY_DELAYS = [60, 300, 900]  # Per PRD Section 7.4: 1 min, 5 min, 15 min


@celery_app.task(
    name="app.tasks.ndvi.process_ndvi",
    bind=True,
    max_retries=3,
    time_limit=1800,
    soft_time_limit=1500,
)
def process_ndvi(self, job_id: str) -> dict:
    """Process NDVI for a field — full pipeline."""
    from app.models.tables import Job, Field, RasterLayer, FieldStat

    session = _get_db_session()
    try:
        job = session.get(Job, uuid.UUID(job_id))
        if not job:
            logger.error("job_not_found", job_id=job_id)
            return {"job_id": job_id, "status": "error", "detail": "Job not found"}

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.progress_json = {"current_step": "scene_search", "steps": {}}
        session.commit()

        field = session.get(Field, job.field_id)
        if not field:
            job.status = "failed"
            job.error = "Field not found"
            job.finished_at = datetime.now(timezone.utc)
            session.commit()
            return {"job_id": job_id, "status": "failed"}

        field_geom = to_shape(field.geom)
        field_geom_geojson = mapping(field_geom)
        field_bounds = field_geom.bounds

        params = job.params_json or {}
        date_from = date.fromisoformat(params["date_from"])
        date_to = date.fromisoformat(params["date_to"])
        org_id_str = str(job.org_id)
        field_id_str = str(job.field_id)

        # Step 1: Scene Search
        _update_job_progress(session, job, "scene_search")
        scenes = _search_scenes(field_geom_geojson, date_from, date_to)
        _complete_step(session, job, "scene_search", {"scene_count": len(scenes)})

        if not scenes:
            job.status = "completed"
            job.finished_at = datetime.now(timezone.utc)
            progress = job.progress_json or {}
            progress["current_step"] = "complete"
            progress["message"] = "No cloud-free scenes found for the date range."
            progress["layers_created"] = 0
            job.progress_json = progress
            flag_modified(job, "progress_json")
            session.commit()
            return {"job_id": job_id, "status": "completed", "scenes": 0}

        # Compute target grid (~10m resolution)
        minx, miny, maxx, maxy = field_bounds
        buf = 0.001
        minx -= buf
        miny -= buf
        maxx += buf
        maxy += buf
        pixel_size = 0.0001
        width = max(int((maxx - minx) / pixel_size), 1)
        height = max(int((maxy - miny) / pixel_size), 1)
        max_dim = 5000
        if width > max_dim or height > max_dim:
            scale = max_dim / max(width, height)
            width = max(int(width * scale), 1)
            height = max(int(height * scale), 1)

        target_transform = from_bounds(minx, miny, maxx, maxy, width, height)
        target_shape = (height, width)
        field_mask = geometry_mask(
            [field_geom],
            out_shape=target_shape,
            transform=target_transform,
            invert=True,
        )

        # Historical means for alerts
        existing_stats = (
            session.execute(
                select(FieldStat.mean)
                .where(FieldStat.field_id == job.field_id)
                .order_by(FieldStat.date.asc())
            )
            .scalars()
            .all()
        )
        historical_means = [float(m) for m in existing_stats if m is not None]

        layers_created = 0

        # Steps 2-6: Process each scene
        for i, scene in enumerate(scenes):
            scene_id = scene["id"]
            scene_date = scene["date"]
            red_href = scene.get("red_href")
            nir_href = scene.get("nir_href")

            if not red_href or not nir_href:
                logger.warning("missing_bands", scene_id=scene_id)
                continue

            try:
                _update_job_progress(
                    session,
                    job,
                    "download_bands",
                    {"scene": i + 1, "total_scenes": len(scenes), "scene_id": scene_id},
                )

                red = _read_band_windowed(
                    red_href, (minx, miny, maxx, maxy), target_shape, target_transform
                )
                nir = _read_band_windowed(
                    nir_href, (minx, miny, maxx, maxy), target_shape, target_transform
                )
                _complete_step(session, job, "download_bands")

                _update_job_progress(session, job, "compute_ndvi")
                ndvi = _compute_ndvi(red, nir)
                ndvi[~field_mask] = np.nan
                _complete_step(session, job, "compute_ndvi")

                _update_job_progress(session, job, "write_cog")
                cog_uri = _write_cog(
                    ndvi,
                    target_transform,
                    "EPSG:4326",
                    org_id_str,
                    field_id_str,
                    scene_date,
                )
                _complete_step(session, job, "write_cog")

                _update_job_progress(session, job, "compute_stats")
                stats = _compute_zonal_stats(ndvi)
                valid = ndvi[np.isfinite(ndvi)]
                ndvi_min = float(np.nanmin(valid)) if len(valid) > 0 else None
                ndvi_max = float(np.nanmax(valid)) if len(valid) > 0 else None

                layer = RasterLayer(
                    org_id=job.org_id,
                    field_id=job.field_id,
                    layer_type="NDVI",
                    satellite="S2",
                    date=scene_date,
                    cog_uri=cog_uri,
                    min=ndvi_min,
                    max=ndvi_max,
                    params_json={
                        "date_from": str(date_from),
                        "date_to": str(date_to),
                        "cloud_cover": scene["cloud_cover"],
                    },
                    provenance_json={
                        "scene_id": scene_id,
                        "red_href": red_href,
                        "nir_href": nir_href,
                        "processed_at": datetime.now(timezone.utc).isoformat(),
                        "pipeline_version": "1.0.0",
                    },
                )
                session.add(layer)
                session.flush()

                field_stat = FieldStat(
                    org_id=job.org_id,
                    field_id=job.field_id,
                    layer_id=layer.id,
                    date=scene_date,
                    mean=stats["mean"],
                    median=stats["median"],
                    min=stats["min"],
                    max=stats["max"],
                    p10=stats["p10"],
                    p90=stats["p90"],
                    stddev=stats["stddev"],
                    quality_score=stats["quality_score"],
                )
                session.add(field_stat)
                session.commit()
                _complete_step(session, job, "compute_stats")

                _update_job_progress(session, job, "run_alerts")
                if stats["mean"] is not None:
                    historical_means.append(stats["mean"])
                _run_alerts(
                    session,
                    job.field_id,
                    job.org_id,
                    scene_date,
                    stats,
                    historical_means,
                )
                _complete_step(session, job, "run_alerts")

                layers_created += 1
                logger.info(
                    "scene_processed",
                    scene_id=scene_id,
                    date=str(scene_date),
                    mean_ndvi=stats["mean"],
                )

            except Exception as e:
                logger.error("scene_processing_error", scene_id=scene_id, error=str(e))
                continue

        # Step 7: Complete
        job.status = "completed"
        job.finished_at = datetime.now(timezone.utc)
        progress = job.progress_json or {}
        progress["current_step"] = "complete"
        progress["layers_created"] = layers_created
        progress["total_scenes"] = len(scenes)
        job.progress_json = progress
        flag_modified(job, "progress_json")
        session.commit()

        logger.info("ndvi_job_completed", job_id=job_id, layers_created=layers_created)
        return {
            "job_id": job_id,
            "status": "completed",
            "layers_created": layers_created,
        }

    except Exception as e:
        logger.error("ndvi_job_failed", job_id=job_id, error=str(e))
        try:
            job = session.get(Job, uuid.UUID(job_id))
            if job:
                job.status = "failed"
                job.error = str(e)
                job.finished_at = datetime.now(timezone.utc)
                session.commit()
        except Exception:
            pass
        # Manual retry with exact PRD backoff: 60s, 300s, 900s
        retry_num = self.request.retries
        if retry_num < len(RETRY_DELAYS):
            raise self.retry(exc=e, countdown=RETRY_DELAYS[retry_num])
        raise

    finally:
        session.close()
