"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { shareApi, getPhotoUrl, INDEX_CONFIG, ALL_INDEX_TYPES } from "@/lib/api";
import type { ShareReport, FieldStat, Alert, ScoutingObservation, IndexType, RasterLayer } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    Bell,
    ChevronDown,
    CloudRain,
    Leaf,
    Loader2,
    MapPin,
    ShieldAlert,
    XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { tokenColor } from "@/lib/design-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { ruleLabel } from "@/lib/alert-rules";

const NdviChart = dynamic(() => import("@/components/charts/ndvi-chart"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
    ),
});

const NdviLegend = dynamic(() => import("@/components/field/ndvi-legend"), {
    ssr: false,
});

/* ── Severity config ───────────────────────────────────────── */

const SEVERITY_CONFIG: Record<string, { dotClass: string; textClass: string; icon: React.ReactNode }> = {
    high: {
        dotClass: "bg-sev-high",
        textClass: "text-sev-high",
        icon: <ShieldAlert className="h-4 w-4" />,
    },
    medium: {
        dotClass: "bg-sev-medium",
        textClass: "text-sev-medium",
        icon: <AlertTriangle className="h-4 w-4" />,
    },
    low: {
        dotClass: "bg-sev-low",
        textClass: "text-sev-low",
        icon: <Bell className="h-4 w-4" />,
    },
};

/* ── Page Component ────────────────────────────────────────── */

export default function ShareReportPage() {
    const params = useParams();
    const token = params.token as string;
    const t = useTranslations("shareReport");

    const [report, setReport] = useState<ShareReport | null>(null);
    const [error, setError] = useState<"expired" | "not_found" | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState<IndexType>("NDVI");

    useEffect(() => {
        if (!token) return;
        shareApi
            .getReport(token)
            .then((r) => {
                setReport(r);
                // Default to first available index if NDVI isn't available
                if (r.available_index_types.length > 0) {
                    const upper = r.available_index_types.map((t) => t.toUpperCase());
                    if (!upper.includes("NDVI") && upper.length > 0) {
                        setActiveIndex(upper[0] as IndexType);
                    }
                }
            })
            .catch((err: Error) => {
                if (err.message === "expired") setError("expired");
                else if (err.message === "not_found") setError("not_found");
                else setError("not_found");
            })
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-2">
                <header className="border-b bg-background">
                    <div className="mx-auto flex max-w-[45rem] items-center justify-between px-4 py-4">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-5 w-28 rounded-full" />
                    </div>
                </header>
                <main className="mx-auto flex max-w-[45rem] flex-col gap-6 px-4 py-6">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-8 w-56" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                    <Skeleton className="h-[148px] w-full rounded-lg" />
                    <Skeleton className="h-[260px] w-full rounded-lg" />
                    <Skeleton className="h-[220px] w-full rounded-lg" />
                </main>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <XCircle className="h-12 w-12 text-destructive mb-4" />
                <h1 className="text-lg font-semibold mb-2">
                    {error === "expired" ? t("linkExpired") : t("linkNotFound")}
                </h1>
            </div>
        );
    }

    const availableIndices = report.available_index_types
        .map((t) => t.toUpperCase() as IndexType)
        .filter((t) => ALL_INDEX_TYPES.includes(t));
    const config = INDEX_CONFIG[activeIndex];
    const activeLayer = report.layers_by_type[activeIndex] ?? report.layers_by_type[activeIndex.toLowerCase()] ?? null;
    const activeStats = report.stats_by_type[activeIndex] ?? report.stats_by_type[activeIndex.toLowerCase()] ?? [];

    return (
        <div className="min-h-screen bg-surface-2">
            {/* Header */}
            <header className="border-b bg-background">
                <div className="mx-auto flex max-w-[45rem] items-center justify-between gap-4 px-4 py-4">
                    <div className="flex items-center gap-2.5">
                        <Leaf className="h-6 w-6 text-primary" />
                        <span className="text-base font-bold tracking-tight">OpenFarm</span>
                    </div>
                    {/* A recipient with no account needs to know what they
                        are holding. One badge does it - no disabled
                        buttons, no greyed-out chrome. */}
                    <Badge
                        variant="outline"
                        className="shrink-0 whitespace-nowrap border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                        {t("readOnlyBadge")}
                    </Badge>
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto flex max-w-[45rem] flex-col gap-6 px-4 py-6">
                {/* Title */}
                <div>
                    <h1 className="text-2xl font-bold">
                        {t("fieldHealthReport")}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {report.field.name}
                        {report.field.crop_type && ` · ${report.field.crop_type}`}
                    </p>
                </div>

                {/* Field Info + Map */}
                <div className="flex flex-col gap-4">
                    {/* Info card */}
                    <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                        <h2 className="text-sm font-semibold">{t("fieldInfo")}</h2>
                        <dl className="space-y-2 text-sm">
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">{t("area")}</dt>
                                <dd className="mt-0.5">
                                    {report.field.area_ha != null
                                        ? `${report.field.area_ha.toFixed(2)} ha`
                                        : t("na")}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">{t("cropType")}</dt>
                                <dd className="mt-0.5">{report.field.crop_type || t("na")}</dd>
                            </div>
                        </dl>
                        <p className="border-t pt-2 text-[11px] text-muted-foreground">
                            {t("generatedOn")} {new Date().toLocaleDateString()}
                        </p>
                    </div>

                    {/* Map card */}
                    <div className="rounded-lg border bg-card shadow-sm overflow-hidden relative">
                        <div className="text-xs font-medium px-3 py-2 border-b text-muted-foreground">
                            {t("fieldBoundary")}
                        </div>
                        <FieldMap geom={report.field.geom} token={token} hasLayer={!!activeLayer} activeIndex={activeIndex} />
                        {activeLayer && (
                            <div className="absolute bottom-2 left-2 z-10">
                                <NdviLegend layer={activeLayer} indexType={activeIndex} compact />
                            </div>
                        )}
                    </div>
                </div>

                {/* Weather Summary */}
                {report.weather_summary && (
                    <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CloudRain className="h-4 w-4 text-sig-precip" />
                            <h2 className="text-sm font-semibold">{t("weatherSummary")}</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <dt className="text-xs text-muted-foreground">{t("totalPrecip")}</dt>
                                <dd className="text-sm font-medium mt-0.5">{report.weather_summary.total_precip_mm} mm</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{t("totalET0")}</dt>
                                <dd className="text-sm font-medium mt-0.5">{report.weather_summary.total_et0_mm} mm</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">{t("waterBalance")}</dt>
                                <dd className={`text-sm font-medium mt-0.5 tabular-nums ${(report.weather_summary.water_balance_mm ?? 0) < 0 ? "text-danger" : "text-success"}`}>
                                    {report.weather_summary.water_balance_mm > 0 ? "+" : ""}{report.weather_summary.water_balance_mm} mm
                                </dd>
                            </div>
                            {report.weather_summary.avg_temp_c != null && (
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t("avgTemp")}</dt>
                                    <dd className="text-sm font-medium mt-0.5">{report.weather_summary.avg_temp_c}°C</dd>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            {t("last30Days", { days: report.weather_summary.period_days })}
                        </p>
                    </div>
                )}

                {/* Soil Summary */}
                {report.soil_summary && (
                    <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                        <h2 className="text-sm font-semibold flex items-center gap-1.5">
                            <Leaf className="h-4 w-4" />
                            {t("soilSummary")}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {report.soil_summary.dominant_texture && (
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t("soilTexture")}</dt>
                                    <dd className="text-sm font-medium mt-0.5 capitalize">{report.soil_summary.dominant_texture}</dd>
                                </div>
                            )}
                            {report.soil_summary.avg_ph != null && (
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t("soilPh")}</dt>
                                    <dd className="text-sm font-medium mt-0.5">{report.soil_summary.avg_ph.toFixed(1)}</dd>
                                </div>
                            )}
                            {report.soil_summary.rootzone_awc_mm != null && (
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t("soilAwc")}</dt>
                                    <dd className="text-sm font-medium mt-0.5">{report.soil_summary.rootzone_awc_mm.toFixed(0)} mm</dd>
                                </div>
                            )}
                            {report.soil_summary.total_soc_stock_t_ha != null && (
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t("soilSoc")}</dt>
                                    <dd className="text-sm font-medium mt-0.5">{report.soil_summary.total_soc_stock_t_ha.toFixed(1)} t/ha</dd>
                                </div>
                            )}
                            {report.soil_summary.drainage_class && (
                                <div>
                                    <dt className="text-xs text-muted-foreground">{t("soilDrainage")}</dt>
                                    <dd className="text-sm font-medium mt-0.5 capitalize">{report.soil_summary.drainage_class}</dd>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Index Toggle */}
                {availableIndices.length > 1 && (
                    <div className="flex items-center gap-1 flex-wrap">
                        {availableIndices.map((idx) => {
                            const c = INDEX_CONFIG[idx];
                            return (
                                <button
                                    key={idx}
                                    onClick={() => setActiveIndex(idx)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeIndex === idx
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-surface-2 text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Index Chart */}
                <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                    <h2 className="text-sm font-semibold">{config.label} {t("timeSeries")}</h2>
                    {activeStats.length > 0 ? (
                        <NdviChart
                            stats={[...activeStats].reverse()}
                            height={250}
                            indexType={activeIndex}
                            weatherData={report.weather_data}
                            showWeatherOverlay={report.weather_data.length > 0}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            {t("noIndexData", { index: config.label })}
                        </p>
                    )}
                </div>

                {/* Alerts */}
                <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                    <h2 className="text-sm font-semibold">{t("recentAlerts")}</h2>
                    {report.alerts.length > 0 ? (
                        <div className="space-y-2">
                            {report.alerts.map((alert) => (
                                <ReportAlertRow key={alert.id} alert={alert} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            {t("noAlerts")}
                        </p>
                    )}
                </div>

                {/* Scouting */}
                <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                    <h2 className="text-sm font-semibold">{t("recentScouting")}</h2>
                    {report.scouting.length > 0 ? (
                        <div className="space-y-2">
                            {report.scouting.map((obs) => (
                                <ReportScoutingRow key={obs.id} obs={obs} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            {t("noScouting")}
                        </p>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-8 border-t bg-background">
                <div className="mx-auto flex max-w-[45rem] flex-col gap-3 px-4 py-6">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("sourcesTitle")}
                    </p>
                    <ul className="flex flex-col gap-1">
                        {[
                            report.available_index_types.length > 0 && t("sourceSatellite"),
                            report.weather_summary && t("sourceWeather"),
                            report.soil_summary && t("sourceSoil"),
                            report.field.geom && t("sourceBasemap"),
                        ]
                            .filter(Boolean)
                            .map((source) => (
                                <li key={source as string} className="text-[11px] text-muted-foreground">
                                    {source}
                                </li>
                            ))}
                    </ul>
                    <p className="border-t pt-3 text-[11px] text-muted-foreground">
                        {t("generatedOn")} <span className="font-mono">{new Date().toISOString().slice(0, 10)}</span>
                        {" · "}
                        {t("poweredBy")}
                    </p>
                </div>
            </footer>
        </div>
    );
}

/* ── Sub-components ────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/v1";

function FieldMap({ geom, token, hasLayer, activeIndex }: { geom: GeoJSON.Geometry | null; token: string; hasLayer: boolean; activeIndex: IndexType }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const activeIndexRef = useRef(activeIndex);
    activeIndexRef.current = activeIndex;

    const initMap = useCallback(() => {
        if (!containerRef.current || mapRef.current) return;
        if (!geom) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: {
                version: 8,
                sources: {
                    esri: {
                        type: "raster",
                        tiles: [
                            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                        ],
                        tileSize: 256,
                        attribution: "Esri, Maxar, Earthstar Geographics",
                        maxzoom: 18,
                    },
                },
                layers: [{ id: "satellite", type: "raster", source: "esri" }],
            },
            center: [0, 0],
            zoom: 2,
            interactive: false,
            attributionControl: false,
        });

        map.on("load", () => {
            const geojson: GeoJSON.Feature = {
                type: "Feature",
                properties: {},
                geometry: geom,
            };

            map.addSource("field", {
                type: "geojson",
                data: geojson,
            });

            map.addLayer({
                id: "field-fill",
                type: "fill",
                source: "field",
                paint: {
                    "fill-color": tokenColor("--map-field-stroke"),
                    "fill-opacity": 0.2,
                },
            });

            map.addLayer({
                id: "field-outline",
                type: "line",
                source: "field",
                paint: {
                    "line-color": tokenColor("--map-field-stroke"),
                    "line-width": 2,
                },
            });

            // Index tile overlay (proxied through API - no JWT needed)
            if (hasLayer) {
                const idx = activeIndexRef.current;
                map.addSource("index-tiles", {
                    type: "raster",
                    tiles: [`${API_BASE}/share/${token}/tiles/{z}/{x}/{y}.png?index_type=${idx}`],
                    tileSize: 256,
                });
                map.addLayer(
                    {
                        id: "index-raster",
                        type: "raster",
                        source: "index-tiles",
                        paint: { "raster-opacity": 0.75 },
                        minzoom: 10,
                        maxzoom: 18,
                    },
                    "field-outline",
                );
            }

            // Fit to bounds
            const coords = getAllCoords(geom);
            if (coords.length > 0) {
                const bounds = new maplibregl.LngLatBounds();
                coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
                map.fitBounds(bounds, { padding: 40, maxZoom: 16, animate: false });
            }
        });

        mapRef.current = map;
    }, [geom, token, hasLayer]);

    // Swap tile source when activeIndex changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !hasLayer) return;
        if (!map.isStyleLoaded()) return;

        // Remove old overlay
        if (map.getLayer("index-raster")) map.removeLayer("index-raster");
        if (map.getSource("index-tiles")) map.removeSource("index-tiles");

        // Add new overlay
        map.addSource("index-tiles", {
            type: "raster",
            tiles: [`${API_BASE}/share/${token}/tiles/{z}/{x}/{y}.png?index_type=${activeIndex}`],
            tileSize: 256,
        });
        map.addLayer(
            {
                id: "index-raster",
                type: "raster",
                source: "index-tiles",
                paint: { "raster-opacity": 0.75 },
                minzoom: 10,
                maxzoom: 18,
            },
            "field-outline",
        );
    }, [activeIndex, token, hasLayer]);

    useEffect(() => {
        initMap();
        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [initMap]);

    if (!geom) {
        return (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No geometry data
            </div>
        );
    }

    return <div ref={containerRef} className="h-48 w-full" />;
}

function ReportAlertRow({ alert }: { alert: Alert }) {
    const tRules = useTranslations("alertRules");
    const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
    const isClosed = alert.status === "closed";

    return (
        <div
            className={`rounded-lg border p-2.5 transition-colors ${isClosed ? "opacity-60 bg-surface-2" : ""
                }`}
        >
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 ${sev.textClass}`}>{sev.icon}</span>
                <Badge
                    variant={alert.severity === "high" && !isClosed ? "destructive" : "secondary"}
                    className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-semibold"
                >
                    {alert.severity}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground truncate">
                    {ruleLabel(alert.rule_name, tRules)}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                    {new Date(alert.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                    })}
                </span>
            </div>
            <p className="text-xs leading-relaxed text-foreground/90 mt-1">{alert.message}</p>
            {alert.weather_context && (
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <CloudRain className="h-3 w-3 shrink-0" />
                    <span>
                        Precip 7d: {alert.weather_context.precipitation_7d_mm ?? "-"}mm
                        {alert.weather_context.water_deficit_mm != null && (
                            <> · Deficit: {alert.weather_context.water_deficit_mm}mm</>
                        )}
                    </span>
                </div>
            )}
            {isClosed && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-semibold mt-1">
                    Closed
                </Badge>
            )}
        </div>
    );
}

function ReportScoutingRow({ obs }: { obs: ScoutingObservation }) {
    return (
        <div className="rounded-lg border p-2.5">
            <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold truncate">{obs.title}</h4>
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                            {new Date(obs.created_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                            })}
                        </span>
                    </div>
                    {obs.note && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {obs.note}
                        </p>
                    )}
                    {obs.weather_snapshot && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                            <CloudRain className="h-3 w-3 shrink-0" />
                            {obs.weather_snapshot.precipitation_7d_mm != null && (
                                <span>Precip 7d: {obs.weather_snapshot.precipitation_7d_mm}mm</span>
                            )}
                            {obs.weather_snapshot.temp_max_c != null && (
                                <span>{obs.weather_snapshot.temp_min_c}–{obs.weather_snapshot.temp_max_c}°C</span>
                            )}
                            {obs.weather_snapshot.soil_moisture_top != null && (
                                <span>Soil: {(obs.weather_snapshot.soil_moisture_top * 100).toFixed(0)}%</span>
                            )}
                        </div>
                    )}
                    {obs.photo_uri && (
                        <div className="mt-1.5 rounded-md overflow-hidden border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={getPhotoUrl(obs.photo_uri)}
                                alt={obs.title}
                                className="w-full h-20 object-cover"
                                loading="lazy"
                            />
                        </div>
                    )}
                    {obs.tags && obs.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {obs.tags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-[11px] px-1.5 py-0"
                                >
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Geometry helpers ──────────────────────────────────────── */

function getAllCoords(geom: GeoJSON.Geometry): number[][] {
    if (geom.type === "Point") return [geom.coordinates as number[]];
    if (geom.type === "Polygon") return (geom.coordinates as number[][][]).flat();
    if (geom.type === "MultiPolygon") return (geom.coordinates as number[][][][]).flat(2);
    return [];
}
