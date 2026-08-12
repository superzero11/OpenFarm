"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { tokenColor, MAP_CHROME } from "@/lib/design-tokens";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { registerPMTilesProtocol, getBasemapStyle, tryUpgradeToPMTiles } from "@/lib/pmtiles";
import { createTransformRequest, refreshMapToken } from "@/lib/map-auth";
import { useTranslations } from "next-intl";

interface DrawMapProps {
    /** Existing geometry (GeoJSON) to load for editing */
    initialGeometry?: GeoJSON.Geometry | null;
    /** Called whenever the drawn geometry changes. Null if all features deleted. */
    onGeometryChange: (geom: GeoJSON.Geometry | null) => void;
    /** Called when the map instance is ready */
    onMapReady?: (map: maplibregl.Map) => void;
    /** Map center [lng, lat] */
    center?: [number, number];
    /** Map zoom */
    zoom?: number;
    className?: string;
}

/**
 * Map component with polygon draw/edit tools.
 *
 * Per PRD: Uses PMTiles basemap when NEXT_PUBLIC_PROTOMAPS_URL is set.
 * Falls back to OSM raster tiles otherwise.
 */
export default function DrawMap({
    initialGeometry,
    onGeometryChange,
    onMapReady,
    center = [78.9629, 20.5937],
    zoom = 5,
    className = "",
}: DrawMapProps) {
    const t = useTranslations("mapControls");
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const drawRef = useRef<MapboxDraw | null>(null);
    const [ready, setReady] = useState(false);

    const handleUpdate = useCallback(() => {
        if (!drawRef.current) return;
        const data = drawRef.current.getAll();
        if (data.features.length === 0) {
            onGeometryChange(null);
            return;
        }
        // Return the first polygon
        const geom = data.features[0].geometry;
        onGeometryChange(geom);
    }, [onGeometryChange]);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        // Suppress AbortError from MapLibre cancelling in-flight tile requests
        const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
            if (e.reason instanceof DOMException && e.reason.name === "AbortError") {
                e.preventDefault();
            }
        };
        window.addEventListener("unhandledrejection", handleUnhandledRejection);

        // Register PMTiles protocol (idempotent)
        registerPMTilesProtocol();

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: getBasemapStyle(),
            center,
            zoom,
            transformRequest: createTransformRequest(),
        });

        // Refresh JWT for tile requests every 10 minutes
        const tokenRefresh = setInterval(() => refreshMapToken(), 10 * 60_000);

        map.addControl(new maplibregl.NavigationControl(), "top-left");

        // My Location button - custom control below nav controls
        const geolocateCtrl = {
            _container: null as HTMLDivElement | null,
            _marker: null as maplibregl.Marker | null,
            onAdd() {
                const container = document.createElement("div");
                container.className = "maplibregl-ctrl maplibregl-ctrl-group";
                const btn = document.createElement("button");
                btn.type = "button";
                btn.title = "My location";
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (!navigator.geolocation) return;
                    btn.style.opacity = "0.5";
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            btn.style.opacity = "1";
                            const { longitude, latitude } = pos.coords;
                            map.flyTo({ center: [longitude, latitude], zoom: 17, duration: 1500 });
                            if (this._marker) {
                                this._marker.setLngLat([longitude, latitude]);
                            } else {
                                this._marker = new maplibregl.Marker({ color: tokenColor("--primary") })
                                    .setLngLat([longitude, latitude])
                                    .addTo(map);
                            }
                        },
                        () => { btn.style.opacity = "1"; },
                        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                    );
                });
                container.appendChild(btn);
                this._container = container;
                return container;
            },
            onRemove() {
                if (this._marker) { this._marker.remove(); this._marker = null; }
                this._container?.remove();
            },
        };
        map.addControl(geolocateCtrl as any, "top-left");

        const draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: false,
                trash: false,
            },
            defaultMode: "simple_select",
            // Override styles to fix MapLibre incompatibility:
            // MapboxDraw v1.5 uses expression-based line-dasharray which
            // MapLibre doesn't support. Use literal arrays instead.
            styles: [
                // Polygon fill (active)
                { id: "gl-draw-polygon-fill-active", type: "fill", filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]], paint: { "fill-color": tokenColor("--map-draw-line"), "fill-outline-color": tokenColor("--map-draw-line"), "fill-opacity": 0.1 } },
                // Polygon fill (inactive)
                { id: "gl-draw-polygon-fill-inactive", type: "fill", filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "false"]], paint: { "fill-color": tokenColor("--map-field-stroke"), "fill-outline-color": tokenColor("--map-field-stroke"), "fill-opacity": 0.1 } },
                // Polygon stroke (active)
                { id: "gl-draw-polygon-stroke-active", type: "line", filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": tokenColor("--map-draw-line"), "line-dasharray": [0.2, 2], "line-width": 2 } },
                // Polygon stroke (inactive)
                { id: "gl-draw-polygon-stroke-inactive", type: "line", filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "false"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": tokenColor("--map-field-stroke"), "line-dasharray": [0.2, 2], "line-width": 2 } },
                // Line (active)
                { id: "gl-draw-line-active", type: "line", filter: ["all", ["==", "$type", "LineString"], ["==", "active", "true"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": tokenColor("--map-draw-line"), "line-dasharray": [0.2, 2], "line-width": 2 } },
                // Line (inactive)
                { id: "gl-draw-line-inactive", type: "line", filter: ["all", ["==", "$type", "LineString"], ["==", "active", "false"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": tokenColor("--map-field-stroke"), "line-dasharray": [0.2, 2], "line-width": 2 } },
                // Vertex point (active)
                { id: "gl-draw-point-active", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["==", "active", "true"]], paint: { "circle-radius": 6, "circle-color": tokenColor("--map-draw-vertex"), "circle-stroke-color": tokenColor("--map-draw-line"), "circle-stroke-width": 2 } },
                // Vertex point (inactive)
                { id: "gl-draw-point-inactive", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["==", "active", "false"]], paint: { "circle-radius": 4, "circle-color": tokenColor("--map-draw-vertex"), "circle-stroke-color": tokenColor("--map-field-stroke"), "circle-stroke-width": 2 } },
                // Midpoint
                { id: "gl-draw-midpoint", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]], paint: { "circle-radius": 3, "circle-color": tokenColor("--map-draw-line") } },
            ],
        });

        // MapboxDraw works with MapLibre via duck-typing - no UI, just map integration
        map.addControl(draw as any);

        map.on("load", () => {
            // Try upgrading to PMTiles vector tiles (no-ops if unavailable)
            tryUpgradeToPMTiles(map);

            // Load existing geometry if provided
            if (initialGeometry) {
                const fc: GeoJSON.FeatureCollection = {
                    type: "FeatureCollection",
                    features: [
                        {
                            type: "Feature",
                            properties: {},
                            geometry: initialGeometry,
                        },
                    ],
                };
                draw.set(fc);

                // Fit to geometry bounds
                try {
                    const bounds = new maplibregl.LngLatBounds();
                    const coords = getAllCoords(initialGeometry);
                    coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
                    if (!bounds.isEmpty()) {
                        map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
                    }
                } catch { }
            } else {
                // Start in draw mode for new fields
                draw.changeMode("draw_polygon");
            }

            setReady(true);
            onMapReady?.(map);
        });

        map.on("draw.create", handleUpdate);
        map.on("draw.update", handleUpdate);
        map.on("draw.delete", handleUpdate);

        // Re-add draw layers after style change (e.g., switching basemap)
        let firstLoad = true;
        map.on("style.load", () => {
            if (firstLoad) { firstLoad = false; return; }
            // MapboxDraw loses its sources/layers on style change - re-add
            map.removeControl(draw as any);
            map.addControl(draw as any);
            // Restore any existing geometry
            const currentData = draw.getAll();
            if (currentData.features.length > 0) {
                draw.set(currentData);
            }
        });

        // Delete key to remove selected polygon
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                // Don't delete when user is typing in an input
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
                if (!drawRef.current) return;
                const selected = (drawRef.current as any).getSelectedIds();
                if (selected.length > 0) {
                    e.preventDefault();
                    drawRef.current.trash();
                }
            }
        };
        document.addEventListener("keydown", handleKeyDown);

        mapRef.current = map;
        drawRef.current = draw;

        return () => {
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            document.removeEventListener("keydown", handleKeyDown);
            clearInterval(tokenRefresh);
            map.remove();
            mapRef.current = null;
            drawRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={`relative h-full w-full ${className}`}>
            <div ref={containerRef} className="w-full h-full" />
            {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
                    <p className="text-sm text-muted-foreground">{t("loadingMap")}</p>
                </div>
            )}
            <div className={`${MAP_CHROME} absolute bottom-4 left-4 rounded-lg px-3 py-2 text-xs text-muted-foreground`}>
                Click map to draw polygon • Double-click to finish • Press Delete to remove
            </div>
        </div>
    );
}

/** Extract all coordinates from a GeoJSON geometry for bounds calculation. */
function getAllCoords(geom: GeoJSON.Geometry): number[][] {
    if (geom.type === "Point") return [geom.coordinates as number[]];
    if (geom.type === "MultiPoint") return geom.coordinates as number[][];
    if (geom.type === "LineString") return geom.coordinates as number[][];
    if (geom.type === "MultiLineString") return (geom.coordinates as number[][][]).flat();
    if (geom.type === "Polygon") return (geom.coordinates as number[][][]).flat();
    if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).flat(2);
    if (geom.type === "GeometryCollection") return geom.geometries.flatMap(getAllCoords);
    return [];
}
