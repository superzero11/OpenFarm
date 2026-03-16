"""Geometry helpers shared across routers."""

from __future__ import annotations

from typing import Any

from geoalchemy2.shape import to_shape
from shapely.geometry import mapping


def wkb_to_geojson(wkb_element) -> dict[str, Any] | None:
    """Convert a GeoAlchemy2 WKB element to a GeoJSON dict, or None on failure."""
    if wkb_element is None:
        return None
    try:
        return mapping(to_shape(wkb_element))
    except Exception:
        return None
