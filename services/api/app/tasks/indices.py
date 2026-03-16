"""Vegetation index registry — formulas, bands, colormaps, alert defaults.

Every Celery task, API endpoint, and tile URL builder references this
registry so index behaviour is defined in exactly one place.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np


# ── Formula functions ────────────────────────────────────────────────


def _ndvi(bands: dict[str, np.ndarray], **_kw) -> np.ndarray:
    nir, red = bands["B08"], bands["B04"]
    with np.errstate(divide="ignore", invalid="ignore"):
        result = (nir - red) / (nir + red)
    return np.clip(result, -1.0, 1.0)


def _evi(bands: dict[str, np.ndarray], **_kw) -> np.ndarray:
    nir, red, blue = bands["B08"], bands["B04"], bands["B02"]
    with np.errstate(divide="ignore", invalid="ignore"):
        result = 2.5 * (nir - red) / (nir + 6.0 * red - 7.5 * blue + 1.0)
    return np.clip(result, -1.0, 1.0)


def _savi(bands: dict[str, np.ndarray], **_kw) -> np.ndarray:
    nir, red = bands["B08"], bands["B04"]
    L = _kw.get("savi_l", 0.5)
    with np.errstate(divide="ignore", invalid="ignore"):
        result = ((nir - red) / (nir + red + L)) * (1.0 + L)
    return np.clip(result, -1.5, 1.5)


def _ndwi(bands: dict[str, np.ndarray], **_kw) -> np.ndarray:
    green, nir = bands["B03"], bands["B08"]
    with np.errstate(divide="ignore", invalid="ignore"):
        result = (green - nir) / (green + nir)
    return np.clip(result, -1.0, 1.0)


# ── Alert configuration ─────────────────────────────────────────────


@dataclass(frozen=True)
class AlertDefaults:
    threshold: float
    threshold_high: float  # below this → high severity (else medium)
    drop_pct: float
    drop_window: int = 4


# ── Index definition ─────────────────────────────────────────────────


@dataclass(frozen=True)
class IndexDef:
    """Complete definition for one vegetation index."""

    key: str  # lowercase, used in COG paths and job types
    label: str  # uppercase, stored in raster_layers.layer_type
    bands: tuple[str, ...]  # Sentinel-2 asset keys required
    formula: Callable[[dict[str, np.ndarray]], np.ndarray]
    colormap: str  # TiTiler colormap name
    rescale: tuple[float, float]  # min, max for tile rendering
    alerts: AlertDefaults
    stac_asset_map: dict[str, tuple[str, ...]] = field(default_factory=dict)
    # stac_asset_map: band_key → (primary_asset, fallback_asset, ...)


# ── Registry ─────────────────────────────────────────────────────────

INDEX_REGISTRY: dict[str, IndexDef] = {}


def _register(idx: IndexDef) -> None:
    INDEX_REGISTRY[idx.key] = idx


_register(
    IndexDef(
        key="ndvi",
        label="NDVI",
        bands=("B04", "B08"),
        formula=_ndvi,
        colormap="rdylgn",
        rescale=(-0.2, 0.9),
        alerts=AlertDefaults(threshold=0.3, threshold_high=0.15, drop_pct=15),
        stac_asset_map={
            "B04": ("red", "B04"),
            "B08": ("nir", "B08"),
        },
    )
)

_register(
    IndexDef(
        key="evi",
        label="EVI",
        bands=("B02", "B04", "B08"),
        formula=_evi,
        colormap="rdylgn",
        rescale=(-0.2, 0.8),
        alerts=AlertDefaults(threshold=0.2, threshold_high=0.1, drop_pct=15),
        stac_asset_map={
            "B02": ("blue", "B02"),
            "B04": ("red", "B04"),
            "B08": ("nir", "B08"),
        },
    )
)

_register(
    IndexDef(
        key="savi",
        label="SAVI",
        bands=("B04", "B08"),
        formula=_savi,
        colormap="rdylgn",
        rescale=(-0.2, 0.8),
        alerts=AlertDefaults(threshold=0.25, threshold_high=0.1, drop_pct=15),
        stac_asset_map={
            "B04": ("red", "B04"),
            "B08": ("nir", "B08"),
        },
    )
)

_register(
    IndexDef(
        key="ndwi",
        label="NDWI",
        bands=("B03", "B08"),
        formula=_ndwi,
        colormap="rdbu",
        rescale=(-1.0, 1.0),
        alerts=AlertDefaults(threshold=0.0, threshold_high=-0.2, drop_pct=20),
        stac_asset_map={
            "B03": ("green", "B03"),
            "B08": ("nir", "B08"),
        },
    )
)


def get_index(key: str) -> IndexDef:
    """Look up an index definition; raises ValueError if unknown."""
    try:
        return INDEX_REGISTRY[key.lower()]
    except KeyError:
        valid = ", ".join(sorted(INDEX_REGISTRY))
        raise ValueError(f"Unknown index '{key}'. Valid: {valid}")


VALID_INDEX_KEYS = tuple(sorted(INDEX_REGISTRY.keys()))
