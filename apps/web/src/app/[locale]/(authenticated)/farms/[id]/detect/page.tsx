"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import {
    detectionApi,
    jobsApi,
    type DetectedBoundary,
} from "@/lib/api";
import { useOrg } from "@/components/org-context";
import { toast } from "sonner";
import {
    ArrowLeft,
    Check,
    ChevronDown,
    ChevronUp,
    Edit,
    Loader2,
    ScanSearch,
    Trash2,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MAP_STYLES, type MapStyleId } from "@/lib/pmtiles";

const BaseMap = dynamic(() => import("@/components/map/base-map"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    ),
});

const DrawMap = dynamic(() => import("@/components/map/draw-map"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    ),
});

const LocationSearch = dynamic(
    () => import("@/components/map/location-search"),
    { ssr: false }
);

const MapStyleSwitcher = dynamic(
    () => import("@/components/map/map-style-switcher"),
    { ssr: false }
);

// ── Constants ────────────────────────────────────────────────────────
const MAX_AREA_KM2 = 50;
const MIN_AREA_KM2 = 2; // FTW model needs ≥128px per side at 10m → ~1.28km → ~2 km²
const POLL_INTERVAL = 5000;

const PROGRESS_STEPS = [
    "validate",
    "stac_search",
    "download_bands",
    "prepare_input",
    "inference",
    "polygonize",
    "store_results",
] as const;

// Bbox overlay layer IDs (shown during detecting phase)
const BBOX_SOURCE = "detect-bbox";
const BBOX_FILL = "detect-bbox-fill";
const BBOX_LINE = "detect-bbox-line";

// Results layer IDs
const SOURCE_ID = "detected-boundaries";
const FILL_LAYER = "detected-boundaries-fill";
const LINE_LAYER = "detected-boundaries-line";
const HIGHLIGHT_LAYER = "detected-boundaries-highlight";

type Phase = "draw" | "detecting" | "review";

function confidenceColor(c: number | null): string {
    if (c === null) return "#6b7280";
    if (c >= 0.8) return "#22c55e";
    if (c >= 0.5) return "#eab308";
    return "#ef4444";
}

export default function DetectBoundariesPage() {
    const t = useTranslations("detection");
    const params = useParams();
    const router = useRouter();
    const { currentOrg } = useOrg();
    const farmId = params.id as string;

    // Phase state
    const [phase, setPhase] = useState<Phase>("draw");

    // Draw phase
    const [bbox, setBbox] = useState<number[] | null>(null);
    const [bboxArea, setBboxArea] = useState(0);
    const [drawnGeom, setDrawnGeom] = useState<GeoJSON.Geometry | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Detecting phase
    const [jobId, setJobId] = useState<string | null>(null);
    const [progress, setProgress] = useState<Record<string, any>>({});

    // Review phase
    const [boundaries, setBoundaries] = useState<DetectedBoundary[]>([]);
    const [selected, setSelected] = useState<DetectedBoundary | null>(null);
    const [acceptName, setAcceptName] = useState("");
    const [accepting, setAccepting] = useState(false);
    const [discarding, setDiscarding] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editGeom, setEditGeom] = useState<GeoJSON.Geometry | null>(null);

    // Shared
    const [panelOpen, setPanelOpen] = useState(true);
    const [mapStyle, setMapStyle] = useState<MapStyleId>("satellite");

    const mapRef = useRef<maplibregl.Map | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const viewportRef = useRef<{ center: [number, number]; zoom: number }>({
        center: [78.9629, 20.5937],
        zoom: 5,
    });
    const drawnGeomRef = useRef<GeoJSON.Geometry | null>(null);
    const phaseRef = useRef<Phase>("draw");
    const boundariesRef = useRef<DetectedBoundary[]>([]);
    const editModeRef = useRef(false);

    // Keep refs in sync
    useEffect(() => { phaseRef.current = phase; }, [phase]);
    useEffect(() => { boundariesRef.current = boundaries; }, [boundaries]);
    useEffect(() => { editModeRef.current = editMode; }, [editMode]);

    // Clean up poll on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ── Draw phase: geometry → bbox conversion ──────────────────────

    const handleDrawGeometryChange = useCallback(
        (geom: GeoJSON.Geometry | null) => {
            if (!geom) {
                setBbox(null);
                setBboxArea(0);
                setDrawnGeom(null);
                return;
            }
            const [minx, miny, maxx, maxy] = turf.bbox(geom);
            const bounds = [minx, miny, maxx, maxy];
            const poly = turf.bboxPolygon(bounds as [number, number, number, number]);
            const area = turf.area(poly) / 1e6;
            setBbox(bounds);
            setBboxArea(area);
            setDrawnGeom(geom);
            drawnGeomRef.current = geom;
        },
        []
    );

    // ── Bbox overlay helper (detecting phase) ────────────────────

    const addBboxOverlay = useCallback((map: maplibregl.Map) => {
        const geom = drawnGeomRef.current;
        if (!geom) return;
        const geojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: geom }],
        };
        if (map.getSource(BBOX_SOURCE)) {
            (map.getSource(BBOX_SOURCE) as maplibregl.GeoJSONSource).setData(geojson);
        } else {
            map.addSource(BBOX_SOURCE, { type: "geojson", data: geojson });
            map.addLayer({
                id: BBOX_FILL,
                type: "fill",
                source: BBOX_SOURCE,
                paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
            });
            map.addLayer({
                id: BBOX_LINE,
                type: "line",
                source: BBOX_SOURCE,
                paint: { "line-color": "#3b82f6", "line-width": 2, "line-dasharray": [2, 2] },
            });
        }
    }, []);

    // ── Results layer helpers ────────────────────────────────────────

    const setupResultLayers = useCallback(
        (map: maplibregl.Map, results: DetectedBoundary[]) => {
            const pending = results.filter(
                (b) => b.status === "pending" && b.geom
            );

            const geojson: GeoJSON.FeatureCollection = {
                type: "FeatureCollection",
                features: pending.map((b) => ({
                    type: "Feature" as const,
                    properties: {
                        id: b.id,
                        confidence: b.confidence,
                        area_ha: b.area_ha,
                    },
                    geometry: b.geom!,
                })),
            };

            if (map.getSource(SOURCE_ID)) {
                (
                    map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource
                ).setData(geojson);
            } else {
                map.addSource(SOURCE_ID, { type: "geojson", data: geojson });

                map.addLayer({
                    id: FILL_LAYER,
                    type: "fill",
                    source: SOURCE_ID,
                    paint: {
                        "fill-color": [
                            "case",
                            [">=", ["get", "confidence"], 0.8],
                            "#22c55e",
                            [">=", ["get", "confidence"], 0.5],
                            "#eab308",
                            "#ef4444",
                        ],
                        "fill-opacity": 0.3,
                    },
                });

                map.addLayer({
                    id: LINE_LAYER,
                    type: "line",
                    source: SOURCE_ID,
                    paint: {
                        "line-color": [
                            "case",
                            [">=", ["get", "confidence"], 0.8],
                            "#16a34a",
                            [">=", ["get", "confidence"], 0.5],
                            "#ca8a04",
                            "#dc2626",
                        ],
                        "line-width": 2,
                    },
                });

                map.addLayer({
                    id: HIGHLIGHT_LAYER,
                    type: "line",
                    source: SOURCE_ID,
                    paint: { "line-color": "#3b82f6", "line-width": 3 },
                    filter: ["==", ["get", "id"], ""],
                });

                // Click handler
                map.on("click", FILL_LAYER, (e) => {
                    const feat = e.features?.[0];
                    if (!feat) return;
                    const bid = feat.properties?.id;
                    const boundary = results.find((b) => b.id === bid);
                    if (boundary) {
                        setSelected(boundary);
                        setAcceptName(
                            `Field ${results.indexOf(boundary) + 1}`
                        );
                        setEditMode(false);
                    }
                });

                map.on("mouseenter", FILL_LAYER, () => {
                    map.getCanvas().style.cursor = "pointer";
                });
                map.on("mouseleave", FILL_LAYER, () => {
                    map.getCanvas().style.cursor = "";
                });
            }

            // Fit to bounds
            if (pending.length > 0) {
                const coords = pending.flatMap((b) => {
                    const g = b.geom as GeoJSON.Polygon | GeoJSON.MultiPolygon;
                    if (g.type === "Polygon") return g.coordinates[0];
                    return g.coordinates.flatMap((ring) => ring[0]);
                });
                if (coords.length > 0) {
                    const lngs = coords.map((c) => c[0]);
                    const lats = coords.map((c) => c[1]);
                    map.fitBounds(
                        [
                            [Math.min(...lngs), Math.min(...lats)],
                            [Math.max(...lngs), Math.max(...lats)],
                        ],
                        { padding: 60, maxZoom: 16 }
                    );
                }
            }
        },
        []
    );

    // Zoom to a boundary's geometry
    const zoomToBoundary = useCallback((geom: GeoJSON.Geometry) => {
        const map = mapRef.current;
        if (!map) return;
        const [minx, miny, maxx, maxy] = turf.bbox(geom);
        map.fitBounds([[minx, miny], [maxx, maxy]], { padding: 80, maxZoom: 17 });
    }, []);

    // Update highlight when selected changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.getCanvas()?.isConnected) return;
        if (map.getLayer(HIGHLIGHT_LAYER)) {
            map.setFilter(HIGHLIGHT_LAYER, [
                "==",
                ["get", "id"],
                selected?.id || "",
            ]);
        }
        if (selected?.geom) zoomToBoundary(selected.geom);
    }, [selected, zoomToBoundary]);

    // Re-render results layers when boundaries change
    useEffect(() => {
        if (phase !== "review") return;
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        setupResultLayers(map, boundaries);
    }, [boundaries, phase, setupResultLayers]);

    // ── Map ready handler ─────────────────────────────────────────

    const handleMapReady = useCallback(
        (map: maplibregl.Map) => {
            mapRef.current = map;
            // Track viewport so phase transitions preserve center/zoom
            const syncViewport = () => {
                const c = map.getCenter();
                viewportRef.current = {
                    center: [c.lng, c.lat],
                    zoom: map.getZoom(),
                };
            };
            map.on("moveend", syncViewport);
            syncViewport();

            // Show bbox overlay when entering detecting phase
            if (phaseRef.current === "detecting") {
                addBboxOverlay(map);
            }
            // Restore result layers when returning to review phase (not during edit)
            if (phaseRef.current === "review" && !editModeRef.current) {
                setupResultLayers(map, boundariesRef.current);
            }
        },
        [addBboxOverlay, setupResultLayers]
    );

    const handleLocationSelect = useCallback(
        (lngLat: [number, number]) => {
            mapRef.current?.flyTo({ center: lngLat, zoom: 16, duration: 1500 });
        },
        []
    );

    const handleStyleChange = useCallback(
        (styleId: MapStyleId) => {
            const map = mapRef.current;
            if (!map) return;
            const styleDef = MAP_STYLES.find((s) => s.id === styleId);
            if (styleDef) {
                map.setStyle(styleDef.style);
                setMapStyle(styleId);
                map.once("style.load", () => {
                    if (phase === "detecting") {
                        addBboxOverlay(map);
                    }
                    if (phase === "review") {
                        setupResultLayers(map, boundaries);
                    }
                });
            }
        },
        [phase, boundaries, setupResultLayers, addBboxOverlay]
    );

    // ── Trigger detection ────────────────────────────────────────────

    const handleTrigger = async () => {
        if (!bbox || bboxArea > MAX_AREA_KM2) return;
        setSubmitting(true);

        try {
            const result = await detectionApi.trigger(currentOrg!.id, bbox, farmId);
            setJobId(result.job_id);
            setPhase("detecting");
            toast.success(t("jobCreated"));
            startPolling(result.job_id);
        } catch (err: any) {
            toast.error(err?.detail || t("jobFailed"));
        } finally {
            setSubmitting(false);
        }
    };

    const startPolling = (jid: string) => {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            try {
                const job = await jobsApi.get(jid);
                if (job.progress_json) setProgress(job.progress_json);

                if (job.status === "completed" || job.status === "failed") {
                    clearInterval(pollRef.current!);
                    pollRef.current = null;

                    if (job.status === "completed") {
                        const res = await detectionApi.list(currentOrg!.id, {
                            job_id: jid,
                            status: "pending",
                            limit: 200,
                        });
                        if (res.total > 0) {
                            toast.success(
                                t("jobComplete", { count: res.total })
                            );
                            setBoundaries(res.items);
                            setPhase("review");
                        } else {
                            toast.info(t("noBoundaries"));
                            setPhase("draw");
                        }
                    } else {
                        toast.error(
                            job.progress_json?.error || t("jobFailed")
                        );
                        setPhase("draw");
                    }
                }
            } catch {
                // ignore
            }
        }, POLL_INTERVAL);
    };

    // ── Review actions ───────────────────────────────────────────────

    const handleAccept = async () => {
        if (!selected || !acceptName.trim()) return;
        setAccepting(true);
        try {
            const geom = editMode && editGeom ? editGeom : undefined;
            const result = await detectionApi.accept(
                currentOrg!.id,
                selected.id,
                acceptName.trim(),
                farmId,
                geom
            );
            toast.success(
                t("acceptSuccess", { area: result.area_ha.toFixed(2) })
            );
            setBoundaries((prev) =>
                prev.filter((b) => b.id !== selected.id)
            );
            setSelected(null);
            setEditMode(false);
        } catch (err: any) {
            toast.error(err?.detail || "Failed to accept");
        } finally {
            setAccepting(false);
        }
    };

    const handleDiscard = async () => {
        if (!selected) return;
        setDiscarding(true);
        try {
            await detectionApi.discard(currentOrg!.id, selected.id);
            toast.success(t("discardSuccess"));
            setBoundaries((prev) =>
                prev.filter((b) => b.id !== selected.id)
            );
            setSelected(null);
        } catch (err: any) {
            toast.error(err?.detail || "Failed to discard");
        } finally {
            setDiscarding(false);
        }
    };

    const handleAcceptAll = async () => {
        const pending = boundaries.filter((b) => b.status === "pending");
        let count = 0;
        for (const b of pending) {
            try {
                await detectionApi.accept(currentOrg!.id, b.id, `Field ${count + 1}`, farmId);
                count++;
            } catch {
                // continue
            }
        }
        toast.success(`Accepted ${count} boundaries as fields`);
        setBoundaries([]);
        setSelected(null);
    };

    const handleDiscardAll = async () => {
        const pending = boundaries.filter((b) => b.status === "pending");
        for (const b of pending) {
            try {
                await detectionApi.discard(currentOrg!.id, b.id);
            } catch {
                // continue
            }
        }
        toast.success(`Discarded ${pending.length} boundaries`);
        setBoundaries([]);
        setSelected(null);
    };

    // ── Derived state ────────────────────────────────────────────────

    const pendingCount = boundaries.filter(
        (b) => b.status === "pending"
    ).length;
    const canSubmit =
        bbox !== null &&
        bboxArea >= MIN_AREA_KM2 &&
        bboxArea <= MAX_AREA_KM2 &&
        !submitting &&
        phase === "draw";

    // ── Render ───────────────────────────────────────────────────────

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Full-screen map */}
            <div className="absolute inset-0">
                {phase === "draw" ? (
                    <DrawMap
                        center={viewportRef.current.center}
                        zoom={viewportRef.current.zoom}
                        onGeometryChange={handleDrawGeometryChange}
                        onMapReady={handleMapReady}
                    />
                ) : editMode && selected ? (
                    <DrawMap
                        center={viewportRef.current.center}
                        zoom={viewportRef.current.zoom}
                        initialGeometry={selected.geom}
                        onGeometryChange={setEditGeom}
                        onMapReady={handleMapReady}
                    />
                ) : (
                    <BaseMap
                        center={viewportRef.current.center}
                        zoom={viewportRef.current.zoom}
                        onMapReady={handleMapReady}
                        fill
                    />
                )}
            </div>

            {/* Top-left controls */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <Link
                    href={`/farms/${farmId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-background/90 backdrop-blur-sm px-3 py-2 text-sm font-medium text-foreground shadow-md border border-border/50 hover:bg-background transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Farm
                </Link>
                <MapStyleSwitcher
                    currentStyle={mapStyle}
                    onStyleChange={handleStyleChange}
                />
                <LocationSearch onSelect={handleLocationSelect} />
            </div>

            {/* Floating sidebar panel — right side */}
            <div className="absolute top-4 right-4 z-10 w-80 max-h-[calc(100vh-2rem)] flex flex-col">
                <div className="rounded-xl bg-background/95 backdrop-blur-sm shadow-lg border border-border/50 overflow-hidden flex flex-col max-h-full">
                    {/* Panel header */}
                    <button
                        type="button"
                        onClick={() => setPanelOpen(!panelOpen)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors shrink-0"
                    >
                        <div className="flex items-center gap-2">
                            <ScanSearch className="h-4 w-4" />
                            <span className="text-sm font-semibold">
                                {t("title")}
                            </span>
                            {phase === "review" && pendingCount > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="text-xs"
                                >
                                    {pendingCount}
                                </Badge>
                            )}
                        </div>
                        {panelOpen ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>

                    {panelOpen && (
                        <div className="border-t border-border/50 flex flex-col overflow-hidden">
                            {/* ─── Draw phase ─── */}
                            {phase === "draw" && (
                                <div className="p-4 space-y-3">
                                    <p className="text-xs text-muted-foreground">
                                        {t("drawBboxHint")}
                                    </p>

                                    {/* Bbox area feedback */}
                                    {bbox && (
                                        <div className="flex items-center gap-2 text-sm">
                                            {bboxArea >= MIN_AREA_KM2 &&
                                                bboxArea <= MAX_AREA_KM2 ? (
                                                <Check className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <X className="h-4 w-4 text-red-600" />
                                            )}
                                            <span
                                                className={
                                                    bboxArea > MAX_AREA_KM2 ||
                                                        bboxArea < MIN_AREA_KM2
                                                        ? "text-red-600"
                                                        : "text-muted-foreground"
                                                }
                                            >
                                                {t("bboxArea", {
                                                    area: bboxArea.toFixed(1),
                                                })}
                                                {bboxArea > MAX_AREA_KM2 &&
                                                    ` — ${t("bboxTooLarge")}`}
                                                {bboxArea < MIN_AREA_KM2 &&
                                                    ` — ${t("bboxTooSmall")}`}
                                            </span>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleTrigger}
                                        disabled={!canSubmit}
                                        className="w-full"
                                    >
                                        {submitting ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <ScanSearch className="h-4 w-4 mr-2" />
                                        )}
                                        {submitting
                                            ? t("detecting")
                                            : t("startDetection")}
                                    </Button>
                                </div>
                            )}

                            {/* ─── Detecting phase ─── */}
                            {phase === "detecting" && (
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {t("detecting")}
                                    </div>
                                    <div className="space-y-1">
                                        {PROGRESS_STEPS.map((step) => {
                                            const stepData = progress?.steps?.[step];
                                            const status = stepData?.status;
                                            const isDone = status === "completed";
                                            const isActive =
                                                status === "running";
                                            return (
                                                <div
                                                    key={step}
                                                    className={`flex items-center gap-2 text-xs ${isDone
                                                        ? "text-green-600"
                                                        : isActive
                                                            ? "text-blue-600 font-medium"
                                                            : "text-muted-foreground"
                                                        }`}
                                                >
                                                    {isDone ? (
                                                        <Check className="h-3 w-3" />
                                                    ) : isActive ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <div className="h-3 w-3" />
                                                    )}
                                                    {t(`progress.${step}`)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ─── Review phase ─── */}
                            {phase === "review" && (
                                <>
                                    {selected ? (
                                        <div className="p-4 space-y-3 overflow-y-auto">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-medium">
                                                    Boundary Details
                                                </h3>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => {
                                                        setSelected(null);
                                                        setEditMode(false);
                                                    }}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="space-y-1 text-sm">
                                                <p>
                                                    {t("areaHa", {
                                                        area:
                                                            selected.area_ha?.toFixed(
                                                                2
                                                            ) || "—",
                                                    })}
                                                </p>
                                                <p
                                                    style={{
                                                        color: confidenceColor(
                                                            selected.confidence
                                                        ),
                                                    }}
                                                >
                                                    {t("confidence", {
                                                        value: (
                                                            (selected.confidence ??
                                                                0) * 100
                                                        ).toFixed(0),
                                                    })}
                                                </p>
                                                {selected.detection_date && (
                                                    <p className="text-muted-foreground">
                                                        {t("detectedOn", {
                                                            date: new Date(
                                                                selected.detection_date
                                                            ).toLocaleDateString(),
                                                        })}
                                                    </p>
                                                )}
                                            </div>

                                            <Separator />

                                            <div className="space-y-2">
                                                <Label
                                                    htmlFor="accept-name"
                                                    className="text-xs"
                                                >
                                                    {t("fieldName")}
                                                </Label>
                                                <Input
                                                    id="accept-name"
                                                    value={acceptName}
                                                    onChange={(e) =>
                                                        setAcceptName(
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder={t(
                                                        "fieldNamePlaceholder"
                                                    )}
                                                    className="h-8"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={handleAccept}
                                                    disabled={
                                                        accepting ||
                                                        !acceptName.trim()
                                                    }
                                                >
                                                    {accepting ? (
                                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                    ) : (
                                                        <Check className="h-4 w-4 mr-1" />
                                                    )}
                                                    {editMode
                                                        ? t("edit")
                                                        : t("accept")}
                                                </Button>
                                                {!editMode && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setEditMode(true)
                                                        }
                                                    >
                                                        <Edit className="h-4 w-4 mr-1" />
                                                        {t("edit")}
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={handleDiscard}
                                                    disabled={discarding}
                                                >
                                                    {discarding ? (
                                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                    )}
                                                    {t("discard")}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-y-auto">
                                            {pendingCount === 0 ? (
                                                <div className="p-6 text-center space-y-3">
                                                    <p className="text-sm text-muted-foreground">
                                                        {t("noBoundaries")}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`/farms/${farmId}`}
                                                        >
                                                            Back to Farm
                                                        </Link>
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="p-3 flex gap-2 border-b border-border/50">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 text-xs"
                                                            onClick={
                                                                handleAcceptAll
                                                            }
                                                        >
                                                            <Check className="h-3 w-3 mr-1" />
                                                            {t("acceptAll")}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 text-xs text-destructive hover:text-destructive"
                                                            onClick={
                                                                handleDiscardAll
                                                            }
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1" />
                                                            {t("discardAll")}
                                                        </Button>
                                                    </div>

                                                    <div className="divide-y divide-border/50">
                                                        {boundaries
                                                            .filter(
                                                                (b) =>
                                                                    b.status ===
                                                                    "pending"
                                                            )
                                                            .map((b, i) => (
                                                                <button
                                                                    key={b.id}
                                                                    type="button"
                                                                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                                                                    onClick={() => {
                                                                        setSelected(
                                                                            b
                                                                        );
                                                                        setAcceptName(
                                                                            `Field ${i + 1}`
                                                                        );
                                                                        setEditMode(
                                                                            false
                                                                        );
                                                                    }}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-medium">
                                                                            Boundary{" "}
                                                                            {i +
                                                                                1}
                                                                        </span>
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="text-xs"
                                                                            style={{
                                                                                borderColor:
                                                                                    confidenceColor(
                                                                                        b.confidence
                                                                                    ),
                                                                                color: confidenceColor(
                                                                                    b.confidence
                                                                                ),
                                                                            }}
                                                                        >
                                                                            {(
                                                                                (b.confidence ??
                                                                                    0) *
                                                                                100
                                                                            ).toFixed(
                                                                                0
                                                                            )}
                                                                            %
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {b.area_ha?.toFixed(
                                                                            2
                                                                        ) ||
                                                                            "—"}{" "}
                                                                        ha
                                                                    </p>
                                                                </button>
                                                            ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
