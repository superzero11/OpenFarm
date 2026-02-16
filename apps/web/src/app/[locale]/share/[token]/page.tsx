"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { shareApi, getPhotoUrl } from "@/lib/api";
import type { ShareReport, FieldStat, Alert, ScoutingObservation } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    Bell,
    ChevronDown,
    Leaf,
    Loader2,
    MapPin,
    ShieldAlert,
    XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const NdviChart = dynamic(() => import("@/components/charts/ndvi-chart"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
    ),
});

/* ── Severity config ───────────────────────────────────────── */

const SEVERITY_CONFIG: Record<string, { dotClass: string; textClass: string; icon: React.ReactNode }> = {
    high: {
        dotClass: "bg-red-500",
        textClass: "text-red-600 dark:text-red-400",
        icon: <ShieldAlert className="h-4 w-4" />,
    },
    medium: {
        dotClass: "bg-amber-500",
        textClass: "text-amber-600 dark:text-amber-400",
        icon: <AlertTriangle className="h-4 w-4" />,
    },
    low: {
        dotClass: "bg-yellow-500",
        textClass: "text-yellow-600 dark:text-yellow-400",
        icon: <Bell className="h-4 w-4" />,
    },
};

const RULE_LABELS: Record<string, string> = {
    ndvi_drop: "NDVI Drop",
    ndvi_threshold: "Low NDVI",
};

/* ── Page Component ────────────────────────────────────────── */

export default function ShareReportPage() {
    const params = useParams();
    const token = params.token as string;
    const t = useTranslations("shareReport");

    const [report, setReport] = useState<ShareReport | null>(null);
    const [error, setError] = useState<"expired" | "not_found" | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        shareApi
            .getReport(token)
            .then(setReport)
            .catch((err: Error) => {
                if (err.message === "expired") setError("expired");
                else if (err.message === "not_found") setError("not_found");
                else setError("not_found");
            })
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
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

    return (
        <div className="min-h-screen bg-muted/30">
            {/* Header */}
            <header className="border-b bg-background">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Leaf className="h-7 w-7 text-primary" />
                        <span className="font-bold text-lg">OpenFarm</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{t("poweredBy")}</span>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <p className="text-[10px] text-muted-foreground pt-2 border-t">
                            {t("generatedOn")} {new Date().toLocaleDateString()}
                        </p>
                    </div>

                    {/* Map card */}
                    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                        <div className="text-xs font-medium px-3 py-2 border-b text-muted-foreground">
                            {t("fieldBoundary")}
                        </div>
                        <FieldMap geom={report.field.geom} token={token} hasNdvi={!!report.latest_layer} />
                    </div>
                </div>

                {/* NDVI Chart */}
                <div className="rounded-lg border bg-card shadow-sm p-4 space-y-3">
                    <h2 className="text-sm font-semibold">{t("ndviTimeSeries")}</h2>
                    {report.stats.length > 0 ? (
                        <NdviChart
                            stats={[...report.stats].reverse()}
                            height={250}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            {t("noNdviData")}
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
            <footer className="border-t bg-background mt-8">
                <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
                    {t("poweredBy")} · {new Date().getFullYear()}
                </div>
            </footer>
        </div>
    );
}

/* ── Sub-components ────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/v1";

function FieldMap({ geom, token, hasNdvi }: { geom: GeoJSON.Geometry | null; token: string; hasNdvi: boolean }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

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
                    "fill-color": "#16a34a",
                    "fill-opacity": 0.2,
                },
            });

            map.addLayer({
                id: "field-outline",
                type: "line",
                source: "field",
                paint: {
                    "line-color": "#16a34a",
                    "line-width": 2,
                },
            });

            // NDVI tile overlay (proxied through API — no JWT needed)
            if (hasNdvi) {
                map.addSource("ndvi-tiles", {
                    type: "raster",
                    tiles: [`${API_BASE}/share/${token}/tiles/{z}/{x}/{y}.png`],
                    tileSize: 256,
                });
                map.addLayer(
                    {
                        id: "ndvi-raster",
                        type: "raster",
                        source: "ndvi-tiles",
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
    }, [geom, token, hasNdvi]);

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
    const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
    const isClosed = alert.status === "closed";

    return (
        <div
            className={`rounded-lg border p-2.5 transition-colors ${
                isClosed ? "opacity-60 bg-muted/30" : ""
            }`}
        >
            <div className="flex items-center gap-1.5">
                <span className={`shrink-0 ${sev.textClass}`}>{sev.icon}</span>
                <Badge
                    variant={alert.severity === "high" && !isClosed ? "destructive" : "secondary"}
                    className="text-[9px] px-1.5 py-0 uppercase tracking-wider font-semibold"
                >
                    {alert.severity}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground truncate">
                    {RULE_LABELS[alert.rule_name] || alert.rule_name}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                    {new Date(alert.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                    })}
                </span>
            </div>
            <p className="text-xs leading-relaxed text-foreground/90 mt-1">{alert.message}</p>
            {isClosed && (
                <Badge variant="outline" className="text-[9px] mt-1">
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
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
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
                                    className="text-[9px] px-1.5 py-0 h-4"
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
