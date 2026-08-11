"use client";

import React, { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { registerPMTilesProtocol, getBasemapStyle, tryUpgradeToPMTiles } from "@/lib/pmtiles";
import { createTransformRequest, refreshMapToken } from "@/lib/map-auth";

export interface BaseMapProps {
    /** CSS class for the container div */
    className?: string;
    /** Initial center [lng, lat] */
    center?: [number, number];
    /** Initial zoom */
    zoom?: number;
    /** Callback when map is loaded */
    onMapReady?: (map: maplibregl.Map) => void;
    /** If true, the map fills its parent container */
    fill?: boolean;
}

/**
 * Base MapLibre GL JS component.
 *
 * Per PRD: Uses PMTiles basemap from MinIO when NEXT_PUBLIC_PROTOMAPS_URL
 * is set. Falls back to OSM raster tiles otherwise.
 */
export default function BaseMap({
    className = "",
    center = [78.9629, 20.5937], // India center
    zoom = 5,
    onMapReady,
    fill = true,
}: BaseMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    const onReadyCb = useCallback(
        (map: maplibregl.Map) => onMapReady?.(map),
        [onMapReady],
    );

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
            attributionControl: {
                compact: true,
            },
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
                                this._marker = new maplibregl.Marker({ color: "#22c55e" })
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

        map.on("load", () => {
            // Try upgrading to PMTiles vector tiles (no-ops if unavailable)
            tryUpgradeToPMTiles(map).then(() => onReadyCb(map));
        });

        mapRef.current = map;

        return () => {
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            clearInterval(tokenRefresh);
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount once

    return (
        <div
            ref={containerRef}
            className={`${fill ? "w-full h-full" : ""} ${className}`}
        />
    );
}
