"use client";

/**
 * PMTiles protocol registration for MapLibre GL JS.
 *
 * Per PRD: "MapLibre JS pmtiles protocol plugin reads tiles via HTTP range
 * requests directly from object storage — no tile server needed."
 *
 * Usage: Import and call once before creating any MapLibre map instances.
 * If NEXT_PUBLIC_PROTOMAPS_URL is set, maps will use the PMTiles basemap.
 * Otherwise, falls back to OpenStreetMap raster tiles.
 */

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

let registered = false;

/** Register the PMTiles protocol with MapLibre GL JS (idempotent). */
export function registerPMTilesProtocol(): void {
    if (registered) return;

    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    registered = true;
}

/** PMTiles basemap URL from environment, or null if not configured. */
export const PMTILES_BASEMAP_URL =
    typeof window !== "undefined"
        ? process.env.NEXT_PUBLIC_PROTOMAPS_URL || null
        : null;

/**
 * Returns a MapLibre style spec.
 *
 * Always returns the OSM raster fallback for instant map display.
 * Use `tryUpgradeToPMTiles(map)` after map creation to switch to
 * PMTiles vector tiles if the basemap file is available.
 */
export function getBasemapStyle(): maplibregl.StyleSpecification {
    return getOsmFallbackStyle();
}

/**
 * Returns the PMTiles vector basemap style, or null if not configured.
 */
export function getPMTilesStyle(): maplibregl.StyleSpecification | null {
    if (!PMTILES_BASEMAP_URL) return null;
    return {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
            protomaps: {
                type: "vector",
                url: `pmtiles://${PMTILES_BASEMAP_URL}`,
                attribution:
                    '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
            },
        },
        layers: [
            {
                id: "background",
                type: "background",
                paint: { "background-color": "#f8f4f0" },
            },
            {
                id: "earth",
                type: "fill",
                source: "protomaps",
                "source-layer": "earth",
                paint: { "fill-color": "#f0e9e1" },
            },
            {
                id: "water",
                type: "fill",
                source: "protomaps",
                "source-layer": "water",
                paint: { "fill-color": "#aad3df" },
            },
            {
                id: "landuse-park",
                type: "fill",
                source: "protomaps",
                "source-layer": "landuse",
                filter: ["in", "pmap:kind", "park", "nature_reserve", "forest"],
                paint: { "fill-color": "#c8facc", "fill-opacity": 0.5 },
            },
            {
                id: "landuse-farm",
                type: "fill",
                source: "protomaps",
                "source-layer": "landuse",
                filter: [
                    "in",
                    "pmap:kind",
                    "farmland",
                    "farm",
                    "orchard",
                    "vineyard",
                ],
                paint: { "fill-color": "#eef0d5", "fill-opacity": 0.6 },
            },
            {
                id: "roads-highway",
                type: "line",
                source: "protomaps",
                "source-layer": "roads",
                filter: ["in", "pmap:kind", "highway", "major_road"],
                paint: {
                    "line-color": "#ffb347",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 12, 2],
                },
            },
            {
                id: "roads-minor",
                type: "line",
                source: "protomaps",
                "source-layer": "roads",
                filter: ["in", "pmap:kind", "minor_road", "medium_road"],
                paint: {
                    "line-color": "#ddd",
                    "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 15, 1],
                },
                minzoom: 10,
            },
            {
                id: "buildings",
                type: "fill",
                source: "protomaps",
                "source-layer": "buildings",
                paint: { "fill-color": "#d9d0c9", "fill-opacity": 0.6 },
                minzoom: 13,
            },
            {
                id: "place-labels",
                type: "symbol",
                source: "protomaps",
                "source-layer": "places",
                layout: {
                    "text-field": ["get", "name"],
                    "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 14],
                },
                paint: {
                    "text-color": "#333",
                    "text-halo-color": "#fff",
                    "text-halo-width": 1,
                },
            },
        ],
    };
}

/** Cache the availability check so we only probe once per page load. */
let pmtilesAvailable: boolean | null = null;

/**
 * Asynchronously check if the PMTiles basemap file exists, then upgrade
 * the map style from OSM raster to PMTiles vector tiles.
 *
 * Safe to call even if NEXT_PUBLIC_PROTOMAPS_URL is not set — it no-ops.
 */
export async function tryUpgradeToPMTiles(map: maplibregl.Map): Promise<void> {
    if (!PMTILES_BASEMAP_URL) return;

    // Only probe once per page load
    if (pmtilesAvailable === false) return;

    if (pmtilesAvailable === null) {
        try {
            const resp = await fetch(PMTILES_BASEMAP_URL, {
                method: "HEAD",
                cache: "no-store",
            });
            pmtilesAvailable = resp.ok;
        } catch {
            pmtilesAvailable = false;
        }
    }

    if (!pmtilesAvailable) {
        console.warn("[OpenFarm] PMTiles basemap not found at", PMTILES_BASEMAP_URL, "— using OSM tiles");
        return;
    }

    const style = getPMTilesStyle();
    if (style && map.getCanvas()) {
        map.setStyle(style);
    }
}

/** OSM raster tile style — used as fallback when PMTiles is unavailable. */
export function getOsmFallbackStyle(): maplibregl.StyleSpecification {
    return {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
            osm: {
                type: "raster",
                tiles: [
                    "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
                ],
                tileSize: 256,
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
        },
        layers: [
            {
                id: "osm-layer",
                type: "raster",
                source: "osm",
                minzoom: 0,
                maxzoom: 19,
            },
        ],
    };
}

export type MapStyleId = "street" | "terrain" | "satellite" | "dark";

export interface MapStyleOption {
    id: MapStyleId;
    label: string;
    icon: string; // emoji or short label
    style: maplibregl.StyleSpecification;
}

export const MAP_STYLES: MapStyleOption[] = [
    {
        id: "street",
        label: "Street",
        icon: "🗺️",
        style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
                osm: {
                    type: "raster",
                    tiles: [
                        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                },
            },
            layers: [{ id: "osm-layer", type: "raster", source: "osm", minzoom: 0, maxzoom: 19 }],
        },
    },
    {
        id: "terrain",
        label: "Terrain",
        icon: "⛰️",
        style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
                topo: {
                    type: "raster",
                    tiles: [
                        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
                        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
                        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
                },
            },
            layers: [{ id: "topo-layer", type: "raster", source: "topo", minzoom: 0, maxzoom: 17 }],
        },
    },
    {
        id: "satellite",
        label: "Satellite",
        icon: "🛰️",
        style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
                esri: {
                    type: "raster",
                    tiles: [
                        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
                },
            },
            layers: [{ id: "esri-layer", type: "raster", source: "esri", minzoom: 0, maxzoom: 19 }],
        },
    },
    {
        id: "dark",
        label: "Dark",
        icon: "🌙",
        style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
                carto: {
                    type: "raster",
                    tiles: [
                        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://carto.com">CARTO</a>',
                },
            },
            layers: [{ id: "carto-layer", type: "raster", source: "carto", minzoom: 0, maxzoom: 19 }],
        },
    },
];
