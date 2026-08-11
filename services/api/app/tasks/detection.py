"""Celery task - automatic field boundary detection using FTW model.

Pipeline:
  1. Validate bbox area ≤ 50 km²
  2. STAC search for bi-temporal Sentinel-2 scenes (two seasonal windows)
  3. Download B04, B03, B02, B08 × 2 windows → stack 8-band GeoTIFF
  4. Run FTW model inference (patch-based semantic segmentation)
  5. Polygonize 3-class raster output
  6. Convert to WGS84 MultiPolygon, compute area_ha
  7. Bulk insert detected boundaries into DB

Runs on the `ml-processor` service via the dedicated "ml" Celery queue.
"""

from __future__ import annotations

# ftw-tools 1.4.3 imports AugmentationSequential from torchgeo.transforms,
# but it was removed in torchgeo ≥0.7. Patch it in from kornia before any
# ftw import so the import chain doesn't break.
import torchgeo.transforms as _tgt
from kornia.augmentation import AugmentationSequential as _AS

if not hasattr(_tgt, "AugmentationSequential"):
    _tgt.AugmentationSequential = _AS

import os
import tempfile
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
import pyproj
import rasterio
from rasterio.features import shapes as rasterio_shapes
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import transform as shapely_transform
from shapely.validation import make_valid

import structlog

from app.worker import celery_app
from app.tasks.pipeline import (
    STAC_API_URL,
    STAC_COLLECTION,
    MAX_CLOUD_COVER,
    MINIO_BUCKET,
    get_minio_client,
    get_db_session,
    update_job_progress,
    complete_step,
)

logger = structlog.get_logger()

# ── Constants ────────────────────────────────────────────────────────

# FTW bands: B04(Red), B03(Green), B02(Blue), B08(NIR) per timestamp
SENTINEL_BANDS = ["B04", "B03", "B02", "B08"]
STAC_ASSET_MAP = {
    "B02": ("blue", "B02"),
    "B03": ("green", "B03"),
    "B04": ("red", "B04"),
    "B08": ("nir", "B08"),
}

# FTW 3-class output: 0=background, 1=field interior, 2=boundary
CLASS_FIELD_INTERIOR = 1

# Polygonization defaults
SIMPLIFY_TOLERANCE_M = 15.0
MIN_AREA_M2 = 500.0
MAX_AREA_M2 = 5_000 * 10_000  # 5000 ha in m²

# Projection for area computation (equal-area)
PROJ_4326 = pyproj.CRS("EPSG:4326")
PROJ_6933 = pyproj.CRS("EPSG:6933")


# ── Helpers ──────────────────────────────────────────────────────────


def _validate_bbox_area(bbox: list[float], max_km2: float) -> float:
    """Validate bbox area is within limit. Returns area in km²."""
    minx, miny, maxx, maxy = bbox
    corners = Polygon(
        [(minx, miny), (maxx, miny), (maxx, maxy), (minx, maxy), (minx, miny)]
    )
    project = pyproj.Transformer.from_crs(
        PROJ_4326, PROJ_6933, always_xy=True
    ).transform
    projected = shapely_transform(project, corners)
    area_km2 = projected.area / 1e6
    if area_km2 > max_km2:
        raise ValueError(f"Bbox area {area_km2:.1f} km² exceeds limit of {max_km2} km²")
    return area_km2


def _search_stac_bbox(
    bbox: list[float],
    date_from: date,
    date_to: date,
    max_scenes: int = 5,
) -> list[dict]:
    """Search STAC for Sentinel-2 scenes intersecting bbox."""
    from pystac_client import Client as STACClient

    catalog = STACClient.open(STAC_API_URL)
    search = catalog.search(
        collections=[STAC_COLLECTION],
        bbox=bbox,
        datetime=f"{date_from.isoformat()}/{date_to.isoformat()}",
        query={"eo:cloud_cover": {"lt": MAX_CLOUD_COVER}},
        max_items=50,
    )
    items = sorted(
        search.items(),
        key=lambda it: it.properties.get("eo:cloud_cover", 100),
    )

    scenes = []
    for item in items[:max_scenes]:
        band_hrefs: dict[str, str | None] = {}
        for band_key in SENTINEL_BANDS:
            href = None
            for asset_name in STAC_ASSET_MAP.get(band_key, (band_key,)):
                asset = item.assets.get(asset_name)
                if asset:
                    href = asset.href
                    break
            band_hrefs[band_key] = href

        if all(band_hrefs.values()):
            scenes.append(
                {
                    "id": item.id,
                    "date": (item.datetime.date() if item.datetime else date_from),
                    "cloud_cover": item.properties.get("eo:cloud_cover", 100),
                    "band_hrefs": band_hrefs,
                }
            )

    return scenes


def _download_bands(
    scene: dict,
    bbox: list[float],
    target_shape: tuple[int, int],
    target_transform,
) -> np.ndarray:
    """Download 4 bands for one scene, return (4, H, W) float32 array."""
    bands = np.zeros((4, *target_shape), dtype=np.float32)
    for i, band_key in enumerate(SENTINEL_BANDS):
        href = scene["band_hrefs"][band_key]
        with rasterio.open(href) as src:
            src_bounds = transform_bounds("EPSG:4326", src.crs, *bbox)
            window = rasterio.windows.from_bounds(*src_bounds, transform=src.transform)
            data = src.read(1, window=window, boundless=True, fill_value=0)

            reproject(
                source=data.astype(np.float32),
                destination=bands[i],
                src_transform=rasterio.windows.transform(window, src.transform),
                src_crs=src.crs,
                dst_transform=target_transform,
                dst_crs="EPSG:4326",
                resampling=Resampling.bilinear,
            )
    return bands


def _stack_bitemporal(
    bands_a: np.ndarray,
    bands_b: np.ndarray,
) -> np.ndarray:
    """Stack two 4-band arrays into 8-band (B04,B03,B02,B08 × 2)."""
    return np.concatenate([bands_a, bands_b], axis=0)  # (8, H, W)


def _ensure_model_checkpoint() -> str:
    """Ensure FTW model checkpoint is available locally. Download from MinIO if needed."""
    from app.core.config import settings

    cache_dir = Path(settings.ftw_model_cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    model_filename = Path(settings.ftw_model_path).name
    local_path = cache_dir / model_filename

    if local_path.exists():
        logger.info("model_cache_hit", path=str(local_path))
        return str(local_path)

    logger.info("downloading_model", minio_path=settings.ftw_model_path)
    client = get_minio_client()
    client.fget_object(MINIO_BUCKET, settings.ftw_model_path, str(local_path))
    logger.info("model_downloaded", path=str(local_path))
    return str(local_path)


def _run_ftw_inference(
    stack_path: str,
    checkpoint_path: str,
    output_path: str,
) -> np.ndarray:
    """Run FTW model inference on an 8-band GeoTIFF.

    Inline implementation compatible with torchgeo >=0.8 (GeoSlice bounds)
    and safe for Celery daemon workers (num_workers=0).
    Returns a 2D numpy array with class labels (0=bg, 1=field, 2=boundary).
    """
    import math
    import time
    import torch
    import torch.nn as nn
    import kornia.geometry.transform as K
    from torch.utils.data import DataLoader
    from torchgeo.samplers import GridGeoSampler
    from torchgeo.datasets import stack_samples
    from ftw.datasets import SingleRasterDataset
    from ftw.datamodules import preprocess

    # ── Patch: checkpoint uses unsupported loss; skip for inference ──
    from ftw.trainers import CustomSemanticSegmentationTask

    def _noop_configure_losses(self):
        self.criterion = nn.CrossEntropyLoss()

    CustomSemanticSegmentationTask.configure_losses = _noop_configure_losses

    # ── Read input dimensions ──
    with rasterio.open(stack_path) as src:
        input_height, input_width = src.shape
        profile = src.profile
        tfm = profile["transform"]
        tags = src.tags()

    logger.info("ftw_input_size", height=input_height, width=input_width)

    # ── Determine patch size ──
    resize_factor = 2
    patch_size = None
    for step in [1024, 512, 256, 128]:
        if step <= min(input_height, input_width):
            patch_size = step
            break
    if patch_size is None:
        raise ValueError(
            f"Input image too small: {input_height}x{input_width}px, need ≥128"
        )

    padding = math.ceil(min(1024, patch_size) / 16)
    stride = patch_size - padding * 2

    # ── Load model ──
    tic = time.time()
    task = CustomSemanticSegmentationTask.load_from_checkpoint(
        checkpoint_path, map_location="cpu"
    )
    task.freeze()
    model = task.model.eval()

    up_sample = K.Resize((patch_size * resize_factor, patch_size * resize_factor))
    down_sample = K.Resize((patch_size, patch_size), interpolation="nearest")

    # ── DataLoader with num_workers=0 (safe for Celery daemons) ──
    dataset = SingleRasterDataset(stack_path, transforms=preprocess)
    sampler = GridGeoSampler(dataset, size=patch_size, stride=stride)
    dataloader = DataLoader(
        dataset,
        sampler=sampler,
        batch_size=2,
        num_workers=0,
        collate_fn=stack_samples,
    )

    # ── Inference loop ──
    output_mask = np.zeros((input_height, input_width), dtype=np.uint8)

    for batch in dataloader:
        images = batch["image"]
        images = up_sample(images)

        # Get bounding boxes - handle both torchgeo >=0.8 and <0.7
        bboxes = batch.get("bounds") or batch.get("bbox")

        with torch.inference_mode():
            predictions = model(images)
            predictions = predictions.argmax(axis=1).unsqueeze(0)
            predictions = down_sample(predictions.float()).int().cpu().numpy()[0]

        for i in range(len(bboxes)):
            bb = bboxes[i]
            # torchgeo >=0.8: GeoSlice = tuple of slices
            if isinstance(bb, tuple):
                bb_minx, bb_maxx = bb[0].start, bb[0].stop
                bb_miny, bb_maxy = bb[1].start, bb[1].stop
            else:
                # torchgeo <0.7: BoundingBox namedtuple
                bb_minx, bb_maxx = bb.minx, bb.maxx
                bb_miny, bb_maxy = bb.miny, bb.maxy

            left, top = ~tfm * (bb_minx, bb_maxy)
            right, bottom = ~tfm * (bb_maxx, bb_miny)
            left = int(np.round(left))
            right = int(np.round(right))
            top = int(np.round(top))
            bottom = int(np.round(bottom))

            pleft = left + padding
            pright = right - padding
            ptop = top + padding
            pbottom = bottom - padding
            dest_h, dest_w = output_mask[ptop:pbottom, pleft:pright].shape
            inp = predictions[i][
                padding : padding + dest_h,
                padding : padding + dest_w,
            ]
            output_mask[ptop:pbottom, pleft:pright] = inp

    # ── Save output ──
    profile.update(
        {
            "driver": "GTiff",
            "count": 1,
            "dtype": "uint8",
            "compress": "lzw",
            "nodata": 0,
            "blockxsize": 512,
            "blockysize": 512,
            "tiled": True,
            "interleave": "pixel",
        }
    )
    with rasterio.open(output_path, "w", **profile) as dst:
        dst.update_tags(**tags)
        dst.write(output_mask, 1)

    elapsed = time.time() - tic
    logger.info("ftw_inference_complete", elapsed_s=round(elapsed, 2))

    return output_mask


def _polygonize_predictions(
    prediction: np.ndarray,
    transform,
    crs: str = "EPSG:4326",
) -> list[dict]:
    """Convert 3-class raster to field boundary polygons.

    Extracts field interior pixels (class 1), polygonizes, simplifies,
    and filters by area.
    """
    # Create binary mask: field interior = 1, everything else = 0
    field_mask = (prediction == CLASS_FIELD_INTERIOR).astype(np.uint8)

    # Optional morphological opening to remove noise
    try:
        from scipy.ndimage import binary_opening

        field_mask = binary_opening(field_mask, iterations=1).astype(np.uint8)
    except ImportError:
        pass

    # Polygonize
    polygons = []
    for geom_dict, value in rasterio_shapes(
        field_mask, mask=(field_mask == 1), transform=transform
    ):
        if value != 1:
            continue

        poly = shape(geom_dict)
        if not poly.is_valid:
            poly = make_valid(poly)
        if poly.is_empty:
            continue

        # Simplify in projected CRS for metric tolerance
        project_fwd = pyproj.Transformer.from_crs(
            PROJ_4326, PROJ_6933, always_xy=True
        ).transform
        project_inv = pyproj.Transformer.from_crs(
            PROJ_6933, PROJ_4326, always_xy=True
        ).transform

        poly_proj = shapely_transform(project_fwd, poly)
        area_m2 = poly_proj.area

        if area_m2 < MIN_AREA_M2 or area_m2 > MAX_AREA_M2:
            continue

        poly_simplified = shapely_transform(
            project_inv,
            poly_proj.simplify(SIMPLIFY_TOLERANCE_M, preserve_topology=True),
        )

        if poly_simplified.is_empty:
            continue

        # Ensure MultiPolygon
        if poly_simplified.geom_type == "Polygon":
            multi = MultiPolygon([poly_simplified])
        elif poly_simplified.geom_type == "MultiPolygon":
            multi = poly_simplified
        else:
            continue

        area_ha = area_m2 / 10_000
        # Confidence: ratio of field pixels within polygon bounds
        confidence = min(1.0, area_m2 / (area_m2 + 1000))

        polygons.append(
            {
                "geom": multi,
                "area_ha": round(area_ha, 4),
                "confidence": round(confidence, 3),
            }
        )

    logger.info("polygonization_complete", polygon_count=len(polygons))
    return polygons


# ── Main Celery Task ─────────────────────────────────────────────────


@celery_app.task(
    name="app.tasks.detection.detect_field_boundaries",
    bind=True,
    max_retries=2,
    time_limit=1800,
    soft_time_limit=1500,
)
def detect_field_boundaries(self, job_id: str) -> dict:
    """Detect field boundaries from Sentinel-2 imagery using FTW model."""
    from app.models.tables import Job, DetectedBoundary
    from geoalchemy2.shape import from_shape

    session = get_db_session()
    try:
        job = session.get(Job, uuid.UUID(job_id))
        if not job:
            logger.error("job_not_found", job_id=job_id)
            return {"job_id": job_id, "status": "error", "detail": "Job not found"}

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        job.progress_json = {"current_step": "validate", "steps": {}}
        session.commit()

        params = job.params_json or {}
        bbox = params["bbox"]  # [minx, miny, maxx, maxy]
        org_id = job.org_id

        # ── Step 1: Validate bbox area ──
        update_job_progress(session, job, "validate")
        from app.core.config import settings

        area_km2 = _validate_bbox_area(bbox, settings.detection_max_area_km2)
        complete_step(session, job, "validate", {"area_km2": round(area_km2, 2)})

        # ── Step 2: STAC search for bi-temporal scenes ──
        update_job_progress(session, job, "stac_search")

        window_a_str = params.get("window_a", "")
        window_b_str = params.get("window_b", "")

        # Parse temporal windows (ISO date ranges: "YYYY-MM-DD/YYYY-MM-DD")
        if window_a_str and "/" in window_a_str:
            wa_from, wa_to = [date.fromisoformat(d) for d in window_a_str.split("/")]
        else:
            # Default: planting season (previous year Mar-May)
            year = datetime.now().year - 1
            wa_from, wa_to = date(year, 3, 1), date(year, 5, 31)

        if window_b_str and "/" in window_b_str:
            wb_from, wb_to = [date.fromisoformat(d) for d in window_b_str.split("/")]
        else:
            # Default: harvest season (previous year Aug-Oct)
            year = datetime.now().year - 1
            wb_from, wb_to = date(year, 8, 1), date(year, 10, 31)

        scenes_a = _search_stac_bbox(bbox, wa_from, wa_to, max_scenes=1)
        scenes_b = _search_stac_bbox(bbox, wb_from, wb_to, max_scenes=1)

        if not scenes_a or not scenes_b:
            job.status = "failed"
            job.error = "No suitable Sentinel-2 scenes found for both temporal windows"
            job.finished_at = datetime.now(timezone.utc)
            session.commit()
            return {"job_id": job_id, "status": "failed", "detail": job.error}

        complete_step(
            session,
            job,
            "stac_search",
            {
                "scene_a": scenes_a[0]["id"],
                "scene_b": scenes_b[0]["id"],
            },
        )

        # ── Step 3: Download bands ──
        update_job_progress(session, job, "download_bands")

        minx, miny, maxx, maxy = bbox
        # Target grid at ~10m resolution (Sentinel-2 native)
        # Use latitude-aware pixel size for accurate dimensions
        import math

        center_lat = (miny + maxy) / 2
        pixel_size_x = 0.0001  # ~10m in longitude degrees at equator
        pixel_size_y = 0.0001 / math.cos(math.radians(center_lat))  # adjust for lat
        # Keep uniform pixel size using the smaller (finer) of the two
        pixel_size = min(pixel_size_x, pixel_size_y)
        width = max(int((maxx - minx) / pixel_size), 1)
        height = max(int((maxy - miny) / pixel_size), 1)
        # Cap at reasonable size
        max_dim = 10000
        if width > max_dim or height > max_dim:
            scale = max_dim / max(width, height)
            width = max(int(width * scale), 1)
            height = max(int(height * scale), 1)

        # FTW model requires minimum 128px in each dimension - pad bbox if needed
        min_dim = 128
        if width < min_dim:
            pad_deg = (min_dim - width) * pixel_size / 2
            minx -= pad_deg
            maxx += pad_deg
            width = min_dim
        if height < min_dim:
            pad_deg = (min_dim - height) * pixel_size / 2
            miny -= pad_deg
            maxy += pad_deg
            height = min_dim

        target_transform = from_bounds(minx, miny, maxx, maxy, width, height)
        target_shape = (height, width)

        bands_a = _download_bands(scenes_a[0], bbox, target_shape, target_transform)
        bands_b = _download_bands(scenes_b[0], bbox, target_shape, target_transform)

        complete_step(
            session,
            job,
            "download_bands",
            {
                "shape": list(target_shape),
                "bands_per_window": 4,
            },
        )

        # ── Step 4: Stack and write 8-band GeoTIFF ──
        update_job_progress(session, job, "prepare_input")

        stack = _stack_bitemporal(bands_a, bands_b)  # (8, H, W)

        stack_path = tempfile.mktemp(suffix="_ftw_input.tif")
        output_path = tempfile.mktemp(suffix="_ftw_output.tif")
        try:
            profile = {
                "driver": "GTiff",
                "dtype": "float32",
                "width": width,
                "height": height,
                "count": 8,
                "crs": "EPSG:4326",
                "transform": target_transform,
            }
            with rasterio.open(stack_path, "w", **profile) as dst:
                for i in range(8):
                    dst.write(stack[i], i + 1)

            complete_step(session, job, "prepare_input", {"stack_path": stack_path})

            # ── Step 5: FTW model inference ──
            update_job_progress(session, job, "inference")

            checkpoint_path = _ensure_model_checkpoint()
            prediction = _run_ftw_inference(stack_path, checkpoint_path, output_path)

            complete_step(
                session,
                job,
                "inference",
                {
                    "unique_classes": [int(c) for c in np.unique(prediction)],
                },
            )

        finally:
            for path in (stack_path, output_path):
                try:
                    os.unlink(path)
                except OSError:
                    pass

        # ── Step 6: Polygonize ──
        update_job_progress(session, job, "polygonize")

        detected = _polygonize_predictions(prediction, target_transform)
        complete_step(session, job, "polygonize", {"polygon_count": len(detected)})

        # ── Step 7: Store detected boundaries ──
        update_job_progress(session, job, "store_results")

        detection_date = scenes_a[0]["date"]
        for poly_data in detected:
            boundary = DetectedBoundary(
                org_id=org_id,
                job_id=job.id,
                geom=from_shape(poly_data["geom"], srid=4326),
                area_ha=poly_data["area_ha"],
                confidence=poly_data["confidence"],
                status="pending",
                detection_date=detection_date,
            )
            session.add(boundary)

        job.status = "completed"
        job.finished_at = datetime.now(timezone.utc)
        complete_step(
            session,
            job,
            "store_results",
            {
                "boundaries_stored": len(detected),
            },
        )
        session.commit()

        logger.info(
            "detection_complete",
            job_id=job_id,
            boundaries=len(detected),
            area_km2=round(area_km2, 2),
        )
        return {
            "job_id": job_id,
            "status": "complete",
            "boundaries_detected": len(detected),
        }

    except Exception as exc:
        logger.exception("detection_failed", job_id=job_id)
        try:
            job.status = "failed"
            job.error = str(exc)[:1000]
            job.finished_at = datetime.now(timezone.utc)
            session.commit()
        except Exception:
            session.rollback()
        return {"job_id": job_id, "status": "failed", "detail": str(exc)[:500]}
    finally:
        session.close()
