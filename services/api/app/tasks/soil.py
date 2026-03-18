"""Soil data tasks — fetch from SoilGrids (WCS) / POLARIS (S3), compute summaries.

Triggered on field creation + manual refresh.
"""

from __future__ import annotations

import io
import math
import uuid
from collections import Counter
from datetime import datetime, timezone

import httpx
import rasterio
import structlog
from pyproj import Transformer
from geoalchemy2.shape import to_shape
from sqlalchemy import delete, select

from app.core.config import settings
from sqlalchemy.orm.attributes import flag_modified

from app.models.tables import (
    AuditEvent,
    Field,
    Job,
    SoilFieldSummary,
    SoilLayer,
    SoilProfile,
)
from app.worker import celery_app

logger = structlog.get_logger()

# ── SoilGrids constants ─────────────────────────────────────────────

# GlobalSoilMap standard depth intervals (cm)
SOIL_DEPTHS = [
    (0, 5),
    (5, 15),
    (15, 30),
    (30, 60),
    (60, 100),
    (100, 200),
]

# SoilGrids depth labels used in WCS coverage IDs
_DEPTH_LABELS = ["0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm", "100-200cm"]

# SoilGrids properties and their WCS map file names
# Format: (property_key, map_file_name)
SOILGRIDS_PROPERTIES = [
    ("sand", "sand"),
    ("silt", "silt"),
    ("clay", "clay"),
    ("phh2o", "phh2o"),
    ("soc", "soc"),
    ("bdod", "bdod"),
    ("cec", "cec"),
    ("nitrogen", "nitrogen"),
    ("cfvo", "cfvo"),
    ("ocd", "ocd"),
]

# SoilGrids unit conversion: stored_value × factor = conventional unit
# Source: https://www.isric.org/explore/soilgrids/faq-soilgrids
SOILGRIDS_CONVERSIONS: dict[str, dict] = {
    "sand": {"factor": 0.1, "unit": "%"},  # g/kg → % (/10)
    "silt": {"factor": 0.1, "unit": "%"},
    "clay": {"factor": 0.1, "unit": "%"},
    "phh2o": {"factor": 0.1, "unit": ""},  # pH×10 → pH
    "soc": {"factor": 0.1, "unit": "g/kg"},  # dg/kg → g/kg
    "bdod": {"factor": 0.01, "unit": "kg/dm³"},  # cg/cm³ → kg/dm³
    "cec": {"factor": 0.1, "unit": "cmol/kg"},  # mmol(c)/kg → cmol/kg
    "nitrogen": {"factor": 0.01, "unit": "g/kg"},  # cg/kg → g/kg
    "cfvo": {"factor": 0.1, "unit": "%"},  # cm³/dm³ → %
    "ocd": {"factor": 0.1, "unit": "t/ha"},  # hg/m³ → t/ha (approx)
}

# SoilGrids → unified schema field mapping
_SOILGRIDS_FIELD_MAP = {
    "sand": "sand_pct",
    "silt": "silt_pct",
    "clay": "clay_pct",
    "phh2o": "ph",
    "soc": "soc_g_kg",
    "bdod": "bd_kg_dm3",
    "cec": "cec_cmol_kg",
    "nitrogen": "nitrogen_g_kg",
    "cfvo": "cfvo_pct",
}

# POLARIS property names and S3 path prefixes
POLARIS_PROPERTIES = [
    ("sand", "sand"),
    ("silt", "silt"),
    ("clay", "clay"),
    ("ph", "ph"),
    ("om", "om"),  # organic matter %
    ("bd", "bd"),  # bulk density g/cm³
    ("theta_s", "theta_s"),  # saturated water content
    ("theta_r", "theta_r"),  # residual water content
    ("ksat", "ksat"),  # saturated hydraulic conductivity log10(cm/day)
]

# POLARIS depth labels
_POLARIS_DEPTH_LABELS = ["0_5", "5_15", "15_30", "30_60", "60_100", "100_200"]

# CONUS bounding box for POLARIS eligibility
_CONUS_BOUNDS = {"lat_min": 24.0, "lat_max": 50.0, "lon_min": -125.0, "lon_max": -66.0}


def _get_db_session():
    from app.core.database_sync import SyncSession

    return SyncSession()


# ── WCS Client ───────────────────────────────────────────────────────


def _fetch_soilgrids_wcs(lat: float, lon: float, buffer_m: int = 500) -> dict:
    """Fetch soil properties from SoilGrids via WCS for all depths.

    Returns dict keyed by (property_name, depth_label) with values being
    dicts of {"mean": float, "Q0.05": float, "Q0.95": float}.
    """
    # Transform WGS84 to Homolosine (EPSG:152160) used by SoilGrids WCS
    transformer = Transformer.from_crs("EPSG:4326", "ESRI:54052", always_xy=True)
    x_center, y_center = transformer.transform(lon, lat)

    # Build a small bbox around the centroid
    x_min = x_center - buffer_m
    x_max = x_center + buffer_m
    y_min = y_center - buffer_m
    y_max = y_center + buffer_m

    results: dict = {}
    timeout = settings.soil_fetch_timeout_seconds

    for prop_key, map_name in SOILGRIDS_PROPERTIES:
        for depth_label in _DEPTH_LABELS:
            for quantile in ["mean", "Q0.05", "Q0.95"]:
                coverage_id = f"{prop_key}_{depth_label}_{quantile}"
                wcs_url = settings.soilgrids_wcs_base_url

                params = {
                    "map": f"/map/{map_name}.map",
                    "SERVICE": "WCS",
                    "VERSION": "2.0.1",
                    "REQUEST": "GetCoverage",
                    "COVERAGEID": coverage_id,
                    "FORMAT": "image/tiff",
                    "SUBSET": f"X({x_min},{x_max})",
                    "SUBSETY": f"Y({y_min},{y_max})",
                    "SUBSETTINGCRS": "http://www.opengis.net/def/crs/EPSG/0/152160",
                }

                value = _fetch_wcs_pixel(wcs_url, params, timeout)
                if value is not None:
                    key = (prop_key, depth_label)
                    if key not in results:
                        results[key] = {}
                    results[key][quantile] = value

    return results


def _fetch_wcs_pixel(
    url: str, params: dict, timeout: int, max_retries: int = 3
) -> float | None:
    """Fetch a single WCS coverage and extract centroid pixel value."""
    for attempt in range(max_retries):
        try:
            resp = httpx.get(url, params=params, timeout=timeout, follow_redirects=True)
            if resp.status_code != 200:
                logger.warning(
                    "soilgrids_wcs_error",
                    status=resp.status_code,
                    coverage=params.get("COVERAGEID"),
                    attempt=attempt + 1,
                )
                continue

            # Check if response is actually a TIFF (not an XML error)
            content_type = resp.headers.get("content-type", "")
            if "tiff" not in content_type and "image" not in content_type:
                logger.warning(
                    "soilgrids_wcs_non_tiff",
                    content_type=content_type,
                    coverage=params.get("COVERAGEID"),
                )
                continue

            with rasterio.open(io.BytesIO(resp.content)) as ds:
                data = ds.read(1)
                # Extract center pixel
                rows, cols = data.shape
                center_val = float(data[rows // 2, cols // 2])
                # SoilGrids nodata is typically -32768 or very large negative
                if center_val < -9990:
                    return None
                return center_val

        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            wait = 2 ** (attempt + 1)
            logger.warning(
                "soilgrids_wcs_timeout",
                coverage=params.get("COVERAGEID"),
                attempt=attempt + 1,
                wait_s=wait,
                error=str(exc),
            )
            if attempt < max_retries - 1:
                import time

                time.sleep(wait)
        except Exception:
            logger.exception(
                "soilgrids_wcs_unexpected",
                coverage=params.get("COVERAGEID"),
            )
            break

    return None


def _convert_soilgrids_units(raw: dict) -> dict:
    """Convert SoilGrids raw WCS values to conventional units.

    Input/output keyed by (property, depth_label) → {quantile: value}.
    """
    converted: dict = {}
    for (prop, depth), quantiles in raw.items():
        conv = SOILGRIDS_CONVERSIONS.get(prop)
        factor = conv["factor"] if conv else 1.0
        converted[(prop, depth)] = {
            q: v * factor for q, v in quantiles.items() if v is not None
        }
    return converted


# ── POLARIS Client ───────────────────────────────────────────────────


def _is_conus(lat: float, lon: float) -> bool:
    """Check if coordinates fall within CONUS bounds."""
    return (
        _CONUS_BOUNDS["lat_min"] <= lat <= _CONUS_BOUNDS["lat_max"]
        and _CONUS_BOUNDS["lon_min"] <= lon <= _CONUS_BOUNDS["lon_max"]
    )


def _fetch_polaris_s3(lat: float, lon: float) -> dict:
    """Fetch soil properties from POLARIS COGs on S3 for all depths.

    Returns dict keyed by (property_name, depth_label) with centroid pixel values.
    """
    import os

    os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
    os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")

    results: dict = {}
    bucket = settings.polaris_s3_bucket

    for prop_key, prop_name in POLARIS_PROPERTIES:
        for i, (d_top, d_bot) in enumerate(SOIL_DEPTHS):
            depth_label = _POLARIS_DEPTH_LABELS[i]
            for stat in ["mean", "p5", "p95"]:
                s3_path = f"s3://{bucket}/{prop_name}/{stat}/{depth_label}.tif"
                try:
                    with rasterio.open(s3_path) as ds:
                        # Sample at the given lat/lon
                        vals = list(ds.sample([(lon, lat)]))
                        if vals and len(vals[0]) > 0:
                            val = float(vals[0][0])
                            nodata = ds.nodata
                            if nodata is not None and val == nodata:
                                continue
                            if math.isnan(val):
                                continue
                            key = (prop_key, _DEPTH_LABELS[i])
                            if key not in results:
                                results[key] = {}
                            # Map p5/p95 to SoilGrids-compatible quantile keys
                            q_key = {"mean": "mean", "p5": "Q0.05", "p95": "Q0.95"}[
                                stat
                            ]
                            results[key][q_key] = val
                except Exception:
                    logger.warning(
                        "polaris_s3_read_error",
                        property=prop_key,
                        depth=depth_label,
                        stat=stat,
                    )

    return results


def _convert_polaris_units(raw: dict) -> dict:
    """Convert POLARIS values to unified schema units.

    POLARIS stores values in different units than SoilGrids.
    """
    converted: dict = {}
    for (prop, depth), quantiles in raw.items():
        new_vals: dict = {}
        for q, v in quantiles.items():
            if v is None:
                continue
            if prop == "om":
                # Organic matter % → SOC g/kg  (OM × 0.58 × 10)
                new_vals[q] = v * 0.58 * 10
            elif prop == "ksat":
                # log10(cm/day) → cm/day
                new_vals[q] = 10**v
            elif prop in ("sand", "silt", "clay"):
                # Already in % — no conversion
                new_vals[q] = v
            elif prop == "ph":
                # Already in natural pH units
                new_vals[q] = v
            elif prop == "bd":
                # g/cm³ → kg/dm³ (same number)
                new_vals[q] = v
            elif prop in ("theta_s", "theta_r"):
                # Volumetric fraction → keep as-is
                new_vals[q] = v
            else:
                new_vals[q] = v

        # Map POLARIS property names to unified keys
        unified_prop = {
            "sand": "sand",
            "silt": "silt",
            "clay": "clay",
            "ph": "phh2o",
            "om": "soc",  # converted to SOC above
            "bd": "bdod",
            "ksat": "ksat",
            "theta_s": "theta_s",
            "theta_r": "theta_r",
        }.get(prop, prop)

        converted[(unified_prop, depth)] = new_vals

    return converted


# ── Source Router ────────────────────────────────────────────────────


def _determine_source(lat: float, lon: float) -> str:
    """Determine which data source to use based on location and config."""
    priority = settings.soil_source_priority
    if priority == "soilgrids":
        return "soilgrids"
    if priority == "polaris":
        return "polaris"
    # auto: prefer POLARIS for CONUS (higher resolution), SoilGrids elsewhere
    if _is_conus(lat, lon):
        return "polaris"
    return "soilgrids"


# ── Texture Classification ──────────────────────────────────────────


def _classify_texture(sand: float, silt: float, clay: float) -> str | None:
    """Classify soil texture using the USDA soil texture triangle.

    Args:
        sand: Sand percentage (0-100)
        silt: Silt percentage (0-100)
        clay: Clay percentage (0-100)

    Returns:
        USDA texture class name, or None if inputs invalid.
    """
    if sand is None or silt is None or clay is None:
        return None

    # Normalize to handle rounding errors
    total = sand + silt + clay
    if total <= 0:
        return None
    sand = sand * 100 / total
    silt = silt * 100 / total
    clay = clay * 100 / total

    if clay >= 40:
        if silt >= 40:
            return "silty clay"
        if sand >= 45:
            return "sandy clay"
        return "clay"
    if clay >= 27:
        if sand >= 20 and sand < 45:
            return "clay loam"
        if sand < 20:
            return "silty clay loam"
        return "sandy clay loam"
    if clay >= 7 and clay < 27:
        if silt >= 28 and silt < 50 and sand <= 52:
            return "loam"
        if silt >= 50 and clay >= 12:
            return "silt loam"
        if silt >= 50 and clay < 12:
            return "silt"
        if silt >= 50:
            return "silt loam"
        if sand >= 43 and sand <= 52:
            return "loam" if silt >= 28 else "sandy loam"
        if sand > 52:
            return "sandy loam"
        return "loam"
    # clay < 7
    if silt >= 80:
        return "silt"
    if silt >= 50:
        return "silt loam"
    if sand >= 85:
        if sand >= 90:
            return "sand"
        return "loamy sand"
    return "sandy loam"


# ── AWC Computation ──────────────────────────────────────────────────


def _compute_awc(fc_vol_pct: float | None, wp_vol_pct: float | None) -> float | None:
    """Compute Available Water Capacity for a single layer (mm per cm depth)."""
    if fc_vol_pct is None or wp_vol_pct is None:
        return None
    awc = fc_vol_pct - wp_vol_pct
    return max(0.0, awc)


def _compute_layer_awc_mm(
    fc_vol_pct: float | None,
    wp_vol_pct: float | None,
    depth_top: int,
    depth_bottom: int,
) -> float | None:
    """Compute AWC in mm for a specific layer thickness."""
    awc_per_cm = _compute_awc(fc_vol_pct, wp_vol_pct)
    if awc_per_cm is None:
        return None
    thickness_cm = depth_bottom - depth_top
    # AWC per cm of depth × thickness; vol fraction × 10 mm/cm
    return awc_per_cm * thickness_cm * 0.1


# ── Field Summary Computation ────────────────────────────────────────


def _compute_field_summary(layers: list[dict]) -> dict:
    """Compute depth-weighted summary from layer data."""
    textures = []
    ph_values = []
    ph_weights = []
    soc_stocks = []
    awc_total = 0.0
    ksat_values = []
    sand_values = []
    clay_values = []
    bd_values = []
    cfvo_values = []
    cec_values = []

    for layer in layers:
        thickness = layer["depth_bottom_cm"] - layer["depth_top_cm"]
        weight = thickness / 200.0  # Normalize to total profile depth

        if layer.get("texture_class"):
            textures.append(layer["texture_class"])

        if layer.get("ph") is not None:
            ph_values.append(layer["ph"])
            ph_weights.append(weight)

        # SOC stock: soc_g_kg × BD_kg_dm3 × thickness_cm × 0.1 → t/ha
        if layer.get("soc_g_kg") is not None and layer.get("bd_kg_dm3") is not None:
            soc_stock = layer["soc_g_kg"] * layer["bd_kg_dm3"] * thickness * 0.01
            soc_stocks.append(soc_stock)

        if layer.get("awc_mm") is not None:
            # Only sum up to 100cm for rootzone AWC
            if layer["depth_top_cm"] < 100:
                effective_bottom = min(layer["depth_bottom_cm"], 100)
                effective_thickness = effective_bottom - layer["depth_top_cm"]
                original_thickness = layer["depth_bottom_cm"] - layer["depth_top_cm"]
                ratio = (
                    effective_thickness / original_thickness
                    if original_thickness > 0
                    else 0
                )
                awc_total += layer["awc_mm"] * ratio

        if layer.get("ksat_cm_day") is not None:
            ksat_values.append(layer["ksat_cm_day"])
        if layer.get("sand_pct") is not None:
            sand_values.append(layer["sand_pct"])
        if layer.get("clay_pct") is not None:
            clay_values.append(layer["clay_pct"])
        if layer.get("bd_kg_dm3") is not None:
            bd_values.append(layer["bd_kg_dm3"])
        if layer.get("cfvo_pct") is not None:
            cfvo_values.append(layer["cfvo_pct"])
        if layer.get("cec_cmol_kg") is not None:
            cec_values.append(layer["cec_cmol_kg"])

    # Dominant texture
    dominant_texture = None
    if textures:
        counter = Counter(textures)
        dominant_texture = counter.most_common(1)[0][0]

    # Weighted average pH
    avg_ph = None
    if ph_values and ph_weights:
        avg_ph = round(
            sum(p * w for p, w in zip(ph_values, ph_weights)) / sum(ph_weights), 2
        )

    # Total SOC stock
    total_soc = round(sum(soc_stocks), 2) if soc_stocks else None

    # Drainage class from Ksat
    drainage_class = _classify_drainage(ksat_values)

    # Risk scores
    acidification = _acidification_risk(avg_ph, cec_values)
    compaction = _compaction_risk(bd_values, clay_values)
    leaching = _leaching_risk(ksat_values, sand_values)
    rooting = _rooting_constraint(cfvo_values, bd_values)

    return {
        "dominant_texture": dominant_texture,
        "avg_ph": avg_ph,
        "total_soc_stock_t_ha": total_soc,
        "rootzone_awc_mm": round(awc_total, 1) if awc_total > 0 else None,
        "drainage_class": drainage_class,
        "acidification_risk": acidification,
        "compaction_risk": compaction,
        "leaching_risk": leaching,
        "rooting_constraint": rooting,
    }


def _classify_drainage(ksat_values: list[float]) -> str | None:
    """Classify drainage based on average Ksat."""
    if not ksat_values:
        return None
    avg_ksat = sum(ksat_values) / len(ksat_values)
    if avg_ksat > 100:
        return "excessively drained"
    if avg_ksat > 36:
        return "well drained"
    if avg_ksat > 3.6:
        return "moderately well drained"
    if avg_ksat > 0.36:
        return "somewhat poorly drained"
    return "poorly drained"


def _acidification_risk(avg_ph: float | None, cec_values: list[float]) -> float | None:
    """Acidification risk: f(pH, CEC). Low CEC + low pH = high risk."""
    if avg_ph is None:
        return None
    # pH component: risk increases below 6.5
    ph_risk = max(0.0, min(1.0, (6.5 - avg_ph) / 3.0))
    # CEC component: low CEC = poor buffering
    if cec_values:
        avg_cec = sum(cec_values) / len(cec_values)
        cec_risk = max(0.0, min(1.0, (20.0 - avg_cec) / 20.0))
    else:
        cec_risk = 0.5  # unknown
    return round(ph_risk * 0.6 + cec_risk * 0.4, 3)


def _compaction_risk(bd_values: list[float], clay_values: list[float]) -> float | None:
    """Compaction risk: f(BD, clay%). High BD + low clay = high risk."""
    if not bd_values:
        return None
    avg_bd = sum(bd_values) / len(bd_values)
    # BD component: risk increases above 1.4
    bd_risk = max(0.0, min(1.0, (avg_bd - 1.2) / 0.6))
    # Clay component: more clay = more structure resistance (lower risk)
    if clay_values:
        avg_clay = sum(clay_values) / len(clay_values)
        clay_factor = max(0.0, min(1.0, 1.0 - avg_clay / 50.0))
    else:
        clay_factor = 0.5
    return round(bd_risk * 0.7 + clay_factor * 0.3, 3)


def _leaching_risk(ksat_values: list[float], sand_values: list[float]) -> float | None:
    """Leaching risk: f(Ksat, sand%). High Ksat + high sand = high risk."""
    if not ksat_values and not sand_values:
        return None
    risk = 0.0
    count = 0
    if ksat_values:
        avg_ksat = sum(ksat_values) / len(ksat_values)
        # Normalize Ksat: high Ksat = high leaching risk
        risk += max(0.0, min(1.0, avg_ksat / 100.0))
        count += 1
    if sand_values:
        avg_sand = sum(sand_values) / len(sand_values)
        risk += max(0.0, min(1.0, avg_sand / 80.0))
        count += 1
    return round(risk / count, 3) if count > 0 else None


def _rooting_constraint(
    cfvo_values: list[float], bd_values: list[float]
) -> float | None:
    """Rooting constraint: f(cfvo, BD). High coarse fragments + high BD = constrained."""
    if not cfvo_values and not bd_values:
        return None
    risk = 0.0
    count = 0
    if cfvo_values:
        avg_cfvo = sum(cfvo_values) / len(cfvo_values)
        risk += max(0.0, min(1.0, avg_cfvo / 30.0))
        count += 1
    if bd_values:
        avg_bd = sum(bd_values) / len(bd_values)
        risk += max(0.0, min(1.0, (avg_bd - 1.3) / 0.5))
        count += 1
    return round(risk / count, 3) if count > 0 else None


# ── Data Quality Score ───────────────────────────────────────────────


def _compute_data_quality_score(layers: list[dict]) -> float | None:
    """Compute data quality score based on uncertainty spread.

    Lower uncertainty spread = higher quality score.
    Returns 0–1 where 1 = best quality.
    """
    spreads = []
    for layer in layers:
        for prop, q05_key, q95_key, mean_key in [
            ("sand", "sand_q05", "sand_q95", "sand_pct"),
            ("clay", "clay_q05", "clay_q95", "clay_pct"),
            ("ph", "ph_q05", "ph_q95", "ph"),
            ("soc", "soc_q05", "soc_q95", "soc_g_kg"),
        ]:
            q05 = layer.get(q05_key)
            q95 = layer.get(q95_key)
            mean = layer.get(mean_key)
            if q05 is not None and q95 is not None and mean is not None and mean > 0:
                relative_spread = (q95 - q05) / mean
                spreads.append(relative_spread)

    if not spreads:
        return None

    avg_spread = sum(spreads) / len(spreads)
    # Convert spread to quality: lower spread = higher quality
    # Typical spreads: 0.2 (good) to 1.5+ (poor)
    quality = max(0.0, min(1.0, 1.0 - avg_spread / 1.5))
    return round(quality, 3)


# ── Data Assembly ────────────────────────────────────────────────────


def _build_layers_from_data(data: dict, source: str) -> list[dict]:
    """Convert converted WCS/POLARIS data dict into a list of layer dicts."""
    layers: list[dict] = []

    for i, (d_top, d_bot) in enumerate(SOIL_DEPTHS):
        depth_label = _DEPTH_LABELS[i]
        layer: dict = {
            "depth_top_cm": d_top,
            "depth_bottom_cm": d_bot,
        }

        # Extract baseline properties
        for prop_key in [
            "sand",
            "silt",
            "clay",
            "phh2o",
            "soc",
            "bdod",
            "cec",
            "nitrogen",
            "cfvo",
        ]:
            field_name = _SOILGRIDS_FIELD_MAP.get(prop_key)
            if field_name:
                vals = data.get((prop_key, depth_label), {})
                layer[field_name] = vals.get("mean")

                # Uncertainty fields
                if prop_key in ("sand", "clay", "phh2o", "soc"):
                    # Map to the correct uncertainty column names
                    unc_prefix = {
                        "sand": "sand",
                        "clay": "clay",
                        "phh2o": "ph",
                        "soc": "soc",
                    }[prop_key]
                    layer[f"{unc_prefix}_q05"] = vals.get("Q0.05")
                    layer[f"{unc_prefix}_q95"] = vals.get("Q0.95")

        # POLARIS-specific: extract ksat and water retention
        if source == "polaris":
            ksat_vals = data.get(("ksat", depth_label), {})
            layer["ksat_cm_day"] = ksat_vals.get("mean")

            theta_s = data.get(("theta_s", depth_label), {}).get("mean")
            theta_r = data.get(("theta_r", depth_label), {}).get("mean")
            if theta_s is not None:
                # Approximate FC as ~0.7 × θs, WP as θr
                layer["fc_vol_pct"] = theta_s * 0.7 * 100  # fraction → %
            if theta_r is not None:
                layer["wp_vol_pct"] = theta_r * 100  # fraction → %

        # Texture classification
        layer["texture_class"] = _classify_texture(
            layer.get("sand_pct"),
            layer.get("silt_pct"),
            layer.get("clay_pct"),
        )

        # AWC
        layer["awc_mm"] = _compute_layer_awc_mm(
            layer.get("fc_vol_pct"),
            layer.get("wp_vol_pct"),
            d_top,
            d_bot,
        )

        layers.append(layer)

    return layers


# ── Celery Task ──────────────────────────────────────────────────────


def _update_soil_job(session, job: Job | None, step: str, status: str = "running"):
    """Update progress on the optional Job record."""
    if job is None:
        return
    progress = job.progress_json or {}
    progress["current_step"] = step
    steps = progress.setdefault("steps", {})
    now = datetime.now(timezone.utc).isoformat()
    if step not in steps:
        steps[step] = {"status": status, "started_at": now}
    else:
        steps[step]["status"] = status
    if status == "completed":
        steps[step]["finished_at"] = now
    job.progress_json = progress
    flag_modified(job, "progress_json")
    session.commit()


@celery_app.task(
    name="app.tasks.soil.fetch_soil_for_field",
    bind=True,
    max_retries=2,
    time_limit=300,
    soft_time_limit=240,
)
def fetch_soil_for_field(self, field_id: str, job_id: str | None = None) -> dict:
    """Fetch soil data for a field and store profile + layers + summary."""
    session = _get_db_session()
    job: Job | None = None
    try:
        # Load optional job for progress tracking
        if job_id:
            job = session.get(Job, uuid.UUID(job_id))
            if job:
                job.status = "running"
                job.started_at = datetime.now(timezone.utc)
                session.commit()

        field = session.get(Field, uuid.UUID(field_id))
        if not field:
            logger.error("soil_field_not_found", field_id=field_id)
            if job:
                job.status = "failed"
                job.error = "Field not found"
                job.finished_at = datetime.now(timezone.utc)
                session.commit()
            return {"status": "error", "message": "Field not found"}

        if field.deleted_at is not None:
            logger.info("soil_field_deleted", field_id=field_id)
            if job:
                job.status = "failed"
                job.error = "Field deleted"
                job.finished_at = datetime.now(timezone.utc)
                session.commit()
            return {"status": "skipped", "message": "Field deleted"}

        # Step 1: Determine source
        _update_soil_job(session, job, "source_detection")

        geom = to_shape(field.geom)
        centroid = geom.centroid
        lat, lon = centroid.y, centroid.x

        logger.info(
            "soil_fetch_start",
            field_id=field_id,
            lat=lat,
            lon=lon,
        )

        source = _determine_source(lat, lon)
        resolution = 30 if source == "polaris" else 250
        _update_soil_job(session, job, "source_detection", "completed")

        # Step 2: Fetch raw data
        _update_soil_job(session, job, "data_fetch")

        if source == "polaris":
            raw_data = _fetch_polaris_s3(lat, lon)
            converted = _convert_polaris_units(raw_data)
        else:
            raw_data = _fetch_soilgrids_wcs(lat, lon)
            converted = _convert_soilgrids_units(raw_data)

        if not converted:
            logger.warning("soil_no_data", field_id=field_id, source=source)
            if job:
                job.status = "failed"
                job.error = f"No soil data available from {source}"
                job.finished_at = datetime.now(timezone.utc)
                session.commit()
            return {"status": "error", "message": f"No soil data from {source}"}

        _update_soil_job(session, job, "data_fetch", "completed")

        # Step 3: Process layers
        _update_soil_job(session, job, "layer_processing")

        layer_dicts = _build_layers_from_data(converted, source)
        quality = _compute_data_quality_score(layer_dicts)

        _update_soil_job(session, job, "layer_processing", "completed")

        # Step 4: Compute summary
        _update_soil_job(session, job, "compute_summary")

        summary_data = _compute_field_summary(layer_dicts)

        # Step 4b: Persist to DB
        _update_soil_job(session, job, "save_results")
        # Delete old profile + layers + summary for this field (upsert pattern)
        old_profiles = (
            session.execute(
                select(SoilProfile).where(SoilProfile.field_id == uuid.UUID(field_id))
            )
            .scalars()
            .all()
        )

        for old_profile in old_profiles:
            session.execute(
                delete(SoilFieldSummary).where(
                    SoilFieldSummary.profile_id == old_profile.id
                )
            )
            session.delete(old_profile)  # CASCADE deletes layers
        session.flush()

        # Create new profile
        profile = SoilProfile(
            org_id=field.org_id,
            field_id=field.id,
            source=source,
            source_resolution_m=resolution,
            fetched_at=datetime.now(timezone.utc),
            metadata_json={
                "centroid_lat": lat,
                "centroid_lon": lon,
                "properties_fetched": len(converted),
            },
        )
        session.add(profile)
        session.flush()

        # Create layers
        for ld in layer_dicts:
            soil_layer = SoilLayer(
                profile_id=profile.id,
                depth_top_cm=ld["depth_top_cm"],
                depth_bottom_cm=ld["depth_bottom_cm"],
                sand_pct=ld.get("sand_pct"),
                silt_pct=ld.get("silt_pct"),
                clay_pct=ld.get("clay_pct"),
                ph=ld.get("ph"),
                soc_g_kg=ld.get("soc_g_kg"),
                bd_kg_dm3=ld.get("bd_kg_dm3"),
                cec_cmol_kg=ld.get("cec_cmol_kg"),
                nitrogen_g_kg=ld.get("nitrogen_g_kg"),
                cfvo_pct=ld.get("cfvo_pct"),
                fc_vol_pct=ld.get("fc_vol_pct"),
                wp_vol_pct=ld.get("wp_vol_pct"),
                awc_mm=ld.get("awc_mm"),
                ksat_cm_day=ld.get("ksat_cm_day"),
                texture_class=ld.get("texture_class"),
                sand_q05=ld.get("sand_q05"),
                sand_q95=ld.get("sand_q95"),
                clay_q05=ld.get("clay_q05"),
                clay_q95=ld.get("clay_q95"),
                ph_q05=ld.get("ph_q05"),
                ph_q95=ld.get("ph_q95"),
                soc_q05=ld.get("soc_q05"),
                soc_q95=ld.get("soc_q95"),
            )
            session.add(soil_layer)
        session.flush()

        # Create field summary
        summary = SoilFieldSummary(
            field_id=field.id,
            profile_id=profile.id,
            dominant_texture=summary_data.get("dominant_texture"),
            avg_ph=summary_data.get("avg_ph"),
            total_soc_stock_t_ha=summary_data.get("total_soc_stock_t_ha"),
            rootzone_awc_mm=summary_data.get("rootzone_awc_mm"),
            drainage_class=summary_data.get("drainage_class"),
            acidification_risk=summary_data.get("acidification_risk"),
            compaction_risk=summary_data.get("compaction_risk"),
            leaching_risk=summary_data.get("leaching_risk"),
            rooting_constraint=summary_data.get("rooting_constraint"),
            data_quality_score=quality,
        )
        # Upsert: delete old summary first
        session.execute(
            delete(SoilFieldSummary).where(
                SoilFieldSummary.field_id == uuid.UUID(field_id)
            )
        )
        session.add(summary)

        # Audit event
        session.add(
            AuditEvent(
                org_id=field.org_id,
                user_id=field.created_by,
                event_type="soil_profile_created",
                metadata_json={
                    "field_id": field_id,
                    "source": source,
                    "resolution_m": resolution,
                    "layers": len(layer_dicts),
                },
            )
        )

        session.commit()

        # Step 5: Complete
        _update_soil_job(session, job, "compute_summary", "completed")
        _update_soil_job(session, job, "complete", "completed")
        if job:
            job.status = "completed"
            job.finished_at = datetime.now(timezone.utc)
            session.commit()

        logger.info(
            "soil_fetch_complete",
            field_id=field_id,
            source=source,
            layers=len(layer_dicts),
            quality_score=quality,
        )

        return {
            "status": "success",
            "field_id": field_id,
            "source": source,
            "layers": len(layer_dicts),
        }

    except Exception as exc:
        session.rollback()
        logger.exception("soil_fetch_error", field_id=field_id)
        if job_id:
            try:
                job = session.get(Job, uuid.UUID(job_id))
                if job and job.status != "completed":
                    job.status = "failed"
                    job.error = str(exc)[:500]
                    job.finished_at = datetime.now(timezone.utc)
                    session.commit()
            except Exception:
                pass
        raise self.retry(exc=exc, countdown=60)
    finally:
        session.close()
