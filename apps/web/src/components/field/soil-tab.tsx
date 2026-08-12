"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { soilApi, jobsApi } from "@/lib/api";
import type {
    SoilProfile,
    SoilFieldSummary,
    SoilLayer,
    NdviJob,
    CropSuitabilityResponse,
    NutrientContextResponse,
    CarbonEstimateResponse,
    SoilWeatherStressResponse,
    SamplingZonesResponse,
} from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw, Info, Layers, Check, Leaf, Droplets, AlertTriangle, Sprout, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tokenColor } from "@/lib/design-tokens";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

/* ── Helpers ─────────────────────────────────────────────── */

function depthLabel(top: number, bottom: number): string {
    return `${top}–${bottom} cm`;
}

function phColor(ph: number): string {
    if (ph < 5.5) return "text-danger";
    if (ph < 6.5) return "text-warning";
    if (ph <= 7.5) return "text-success";
    return "text-warning";
}

function phBg(ph: number): string {
    if (ph < 5.5) return "bg-danger-subtle";
    if (ph < 6.5) return "bg-warning-subtle";
    if (ph <= 7.5) return "bg-success-subtle";
    return "bg-warning-subtle";
}

function riskColor(score: number): string {
    if (score < 0.3) return "bg-success";
    if (score < 0.6) return "bg-warning";
    return "bg-danger";
}

function riskTextColor(score: number): string {
    if (score < 0.3) return "text-success";
    if (score < 0.6) return "text-warning";
    return "text-danger";
}

function bdColor(bd: number): string {
    if (bd < 1.4) return "text-success";
    if (bd <= 1.6) return "text-warning";
    return "text-danger";
}

function awcLevel(mm: number): "low" | "moderate" | "good" {
    if (mm < 100) return "low";
    if (mm < 175) return "moderate";
    return "good";
}

function awcColor(mm: number): string {
    const level = awcLevel(mm);
    if (level === "low") return "bg-danger";
    if (level === "moderate") return "bg-warning";
    return "bg-success";
}

function qualityLabel(score: number | null, t: (key: string) => string): string {
    if (score == null) return "-";
    if (score >= 0.7) return t("qualityHigh");
    if (score >= 0.4) return t("qualityMedium");
    return t("qualityLow");
}

/* ── Component ───────────────────────────────────────────── */

/* ── Map layer constants ──────────────────────────────────── */

const SAMPLING_SOURCE = "sampling-zones";
const SAMPLING_LAYER = "sampling-inner";
const SAMPLING_LAYER_RING = "sampling-ring";
const SAMPLING_LAYER_CENTER = "sampling-center";

// Priority hues resolved from the token layer (sev-high / sev-medium / info)
const PRIORITY_TOKEN_VARS: Record<number, string> = {
    1: "--sev-high",
    2: "--sev-medium",
    3: "--info",
};

/* ── Component ───────────────────────────────────────────── */

interface SoilTabProps {
    fieldId: string;
    mapInstance?: maplibregl.Map | null;
    activeTab?: string;
}

export default function SoilTab({ fieldId, mapInstance, activeTab }: SoilTabProps) {
    const t = useTranslations("soil");

    const [profile, setProfile] = useState<SoilProfile | null>(null);
    const [summary, setSummary] = useState<SoilFieldSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cropSuitability, setCropSuitability] = useState<CropSuitabilityResponse | null>(null);
    const [nutrientContext, setNutrientContext] = useState<NutrientContextResponse | null>(null);
    const [carbonEstimate, setCarbonEstimate] = useState<CarbonEstimateResponse | null>(null);
    const [weatherStress, setWeatherStress] = useState<SoilWeatherStressResponse | null>(null);
    const [samplingZones, setSamplingZones] = useState<SamplingZonesResponse | null>(null);

    /* ── Sampling zone map markers (target / bullseye style) ── */

    useEffect(() => {
        const map = mapInstance;
        if (!map || !samplingZones) return;

        const geojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: samplingZones.features.map((f, i) => ({
                type: "Feature" as const,
                geometry: f.geometry,
                properties: {
                    idx: i,
                    zone_type: f.properties.zone_type,
                    priority: f.properties.priority,
                    rationale: f.properties.rationale,
                    color: tokenColor(PRIORITY_TOKEN_VARS[f.properties.priority] ?? "--muted-foreground"),
                },
            })),
        };

        const addLayers = () => {
            try {
                if (!map.getSource(SAMPLING_SOURCE)) {
                    map.addSource(SAMPLING_SOURCE, { type: "geojson", data: geojson });
                } else {
                    (map.getSource(SAMPLING_SOURCE) as maplibregl.GeoJSONSource).setData(geojson);
                }

                if (!map.getLayer(SAMPLING_LAYER)) {
                    // Outer ring
                    map.addLayer({
                        id: SAMPLING_LAYER_RING,
                        type: "circle",
                        source: SAMPLING_SOURCE,
                        paint: {
                            "circle-radius": 12,
                            "circle-color": "transparent",
                            "circle-stroke-width": 2,
                            "circle-stroke-color": ["get", "color"],
                        },
                    });
                    // Filled inner disc
                    map.addLayer({
                        id: SAMPLING_LAYER,
                        type: "circle",
                        source: SAMPLING_SOURCE,
                        paint: {
                            "circle-radius": 6,
                            "circle-color": ["get", "color"],
                            "circle-opacity": 0.85,
                        },
                    });
                    // White center dot
                    map.addLayer({
                        id: SAMPLING_LAYER_CENTER,
                        type: "circle",
                        source: SAMPLING_SOURCE,
                        paint: {
                            "circle-radius": 2,
                            "circle-color": tokenColor("--map-draw-vertex"),
                        },
                    });
                }
            } catch (e) {
                console.warn("Failed to add sampling zone layers", e);
            }
        };

        if (map.isStyleLoaded()) {
            addLayers();
        } else {
            map.once("style.load", addLayers);
        }

        return () => {
            // Don't remove on unmount - keep markers while tab switches
        };
    }, [mapInstance, samplingZones]);

    // Toggle sampling layer visibility based on active tab
    useEffect(() => {
        const map = mapInstance;
        if (!map) return;
        const visible = activeTab === "soil" ? "visible" : "none";
        try {
            if (map.getLayer(SAMPLING_LAYER)) map.setLayoutProperty(SAMPLING_LAYER, "visibility", visible);
            if (map.getLayer(SAMPLING_LAYER_RING)) map.setLayoutProperty(SAMPLING_LAYER_RING, "visibility", visible);
            if (map.getLayer(SAMPLING_LAYER_CENTER)) map.setLayoutProperty(SAMPLING_LAYER_CENTER, "visibility", visible);
        } catch { /* layers may not exist yet */ }
    }, [mapInstance, activeTab]);

    /* ── Sampling zone popup on map click ─────────────────── */

    useEffect(() => {
        const map = mapInstance;
        if (!map) return;

        const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "260px", className: "openfarm-popup" });

        const onClick = (e: maplibregl.MapMouseEvent) => {
            const features = map.queryRenderedFeatures(e.point, { layers: [SAMPLING_LAYER] });
            if (!features.length) return;
            const props = features[0].properties!;
            const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
            const priorityLabel =
                props.priority === 1
                    ? t("priorityHigh")
                    : props.priority === 2
                        ? t("priorityMedium")
                        : t("priorityLow");
            const zoneLabel = (props.zone_type as string).replace(/_/g, " ");
            const html = `<div class="openfarm-popup-body">
                <div class="openfarm-popup-title">${t("samplingZone")}</div>
                <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${props.color}"></span>
                    <span style="font-weight:500;text-transform:capitalize">${zoneLabel}</span>
                </div>
                <div class="openfarm-popup-meta"><b>${t("priority")}:</b> ${priorityLabel} (P${props.priority})</div>
                <div class="openfarm-popup-note">${props.rationale}</div>
            </div>`;
            popup.setLngLat(coords).setHTML(html).addTo(map);
        };

        const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
        const onLeave = () => { map.getCanvas().style.cursor = ""; };

        map.on("click", SAMPLING_LAYER, onClick);
        map.on("mouseenter", SAMPLING_LAYER, onEnter);
        map.on("mouseleave", SAMPLING_LAYER, onLeave);

        return () => {
            popup.remove();
            map.off("click", SAMPLING_LAYER, onClick);
            map.off("mouseenter", SAMPLING_LAYER, onEnter);
            map.off("mouseleave", SAMPLING_LAYER, onLeave);
        };
    }, [mapInstance, t]);

    /* ── Fly to sampling zone on sidebar click ────────────── */

    const flyToZone = useCallback(
        (feature: SamplingZonesResponse["features"][number]) => {
            if (!mapInstance || !feature.geometry) return;
            const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
            mapInstance.flyTo({ center: coords, zoom: 17, duration: 1000 });
        },
        [mapInstance],
    );

    // Job tracking
    const [activeJob, setActiveJob] = useState<NdviJob | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadData = useCallback(async (isInitial = true) => {
        if (isInitial) setLoading(true);
        try {
            const [p, s] = await Promise.allSettled([
                soilApi.get(fieldId),
                soilApi.getSummary(fieldId),
            ]);
            if (p.status === "fulfilled") setProfile(p.value);
            if (s.status === "fulfilled") setSummary(s.value);

            // Load intelligence data (only if soil data exists)
            if (p.status === "fulfilled" && p.value) {
                const [cs, nc, ce, ws, sz] = await Promise.allSettled([
                    soilApi.getCropSuitability(fieldId),
                    soilApi.getNutrientContext(fieldId),
                    soilApi.getCarbon(fieldId),
                    soilApi.getWeatherStress(fieldId),
                    soilApi.getSamplingZones(fieldId),
                ]);
                if (cs.status === "fulfilled") setCropSuitability(cs.value);
                if (nc.status === "fulfilled") setNutrientContext(nc.value);
                if (ce.status === "fulfilled") setCarbonEstimate(ce.value);
                if (ws.status === "fulfilled") setWeatherStress(ws.value);
                if (sz.status === "fulfilled") setSamplingZones(sz.value);
            }
        } catch {
            // empty state shown
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [fieldId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Job polling
    const pollJob = useCallback(
        async (jobId: string) => {
            try {
                const job = await jobsApi.get(jobId);
                setActiveJob(job);
                if (job.status === "completed" || job.status === "failed") {
                    if (pollRef.current) clearInterval(pollRef.current);
                    pollRef.current = null;
                    if (job.status === "completed") {
                        toast.success(t("refreshComplete"));
                        // Reload data with retry - API may be briefly busy
                        const reload = async (retries = 3) => {
                            for (let i = 0; i < retries; i++) {
                                try {
                                    await loadData(false);
                                    return;
                                } catch {
                                    if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
                                }
                            }
                        };
                        reload();
                    } else {
                        toast.error(t("refreshFailed"));
                    }
                    // Clear job UI after a short delay
                    setTimeout(() => setActiveJob(null), 3000);
                }
            } catch {
                // poll error - keep trying
            }
        },
        [loadData, t],
    );

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const handleRefresh = async () => {
        if (activeJob && (activeJob.status === "pending" || activeJob.status === "running")) {
            return; // already in progress
        }
        setRefreshing(true);
        try {
            const res = await soilApi.refresh(fieldId);
            toast.success(t("refreshStarted"));
            // Start polling the job
            if (pollRef.current) clearInterval(pollRef.current);
            const jobId = res.job_id;
            setActiveJob({ id: jobId, status: "pending", type: "soil_fetch", created_at: new Date().toISOString() } as NdviJob);
            pollRef.current = setInterval(() => pollJob(jobId), 3000);
        } catch (err: unknown) {
            const status = (err as { status?: number })?.status;
            if (status === 429) {
                toast.error(t("refreshCooldown"));
            } else {
                toast.error(t("refreshFailed"));
            }
        } finally {
            setRefreshing(false);
        }
    };

    /* Helper: is job actively running? */
    const jobActive = activeJob && (activeJob.status === "pending" || activeJob.status === "running");

    /* Helper: job progress steps */
    const SOIL_STEPS = [
        { key: "source_detection", label: t("stepSourceDetection") },
        { key: "data_fetch", label: t("stepDataFetch") },
        { key: "layer_processing", label: t("stepLayerProcessing") },
        { key: "rosetta_ptf", label: t("stepRosettaPtf") },
        { key: "compute_summary", label: t("stepComputeSummary") },
        { key: "save_results", label: t("stepSaveResults") },
        { key: "complete", label: t("stepComplete") },
    ];

    const getJobProgress = () => {
        if (!activeJob?.progress_json) return null;
        const p = activeJob.progress_json as Record<string, unknown>;
        const steps = (p.steps || {}) as Record<string, { status: string }>;
        return SOIL_STEPS.map((s) => ({
            ...s,
            status: steps[s.key]?.status || "pending",
        }));
    };

    /* Loading state */
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    /* Empty state - no soil profile yet */
    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">{t("noData")}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">
                    {t("noDataDesc")}
                </p>

                {/* Job progress */}
                {jobActive && (
                    <div className="mt-4 w-full max-w-[260px] rounded-lg border border-primary-border bg-primary-subtle p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-xs font-medium text-primary">{t("processingTitle")}</span>
                        </div>
                        {getJobProgress() && (
                            <ul className="space-y-1">
                                {getJobProgress()!.map((step) => (
                                    <li
                                        key={step.key}
                                        className={cn(
                                            "flex items-center gap-1.5 text-[11px]",
                                            step.status === "completed" && "text-primary",
                                            step.status === "running" && "text-foreground font-medium",
                                            step.status !== "completed" && step.status !== "running" && "text-muted-foreground",
                                        )}
                                    >
                                        {step.status === "completed" ? (
                                            <Check className="h-3 w-3 text-primary" />
                                        ) : step.status === "running" ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <span className="h-3 w-3 rounded-full border border-muted-foreground/40 inline-block" />
                                        )}
                                        {step.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Job failed */}
                {activeJob?.status === "failed" && (
                    <div className="mt-4 w-full max-w-[260px] rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-xs font-medium text-destructive">{t("refreshFailed")}</p>
                        {activeJob.error && (
                            <p className="text-[11px] text-destructive/70 mt-1">{activeJob.error}</p>
                        )}
                    </div>
                )}

                {!jobActive && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        {refreshing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        {t("refresh")}
                    </Button>
                )}
            </div>
        );
    }

    const layers = profile.layers
        .slice()
        .sort((a, b) => a.depth_top_cm - b.depth_top_cm);

    return (
        <div className="space-y-4">
            {/* Disclaimer banner */}
            <div className="flex items-start gap-2 rounded-lg border bg-info-subtle p-2.5 text-xs text-info">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t("disclaimer")}</span>
            </div>

            {/* Depth profile: sand/silt/clay stacked bars */}
            <section>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold">{t("depthProfile")}</h3>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-soil-sand" />
                            {t("sand")}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-soil-silt" />
                            {t("silt")}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-soil-clay" />
                            {t("clay")}
                        </span>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <TooltipProvider delayDuration={200}>
                        {layers.map((layer) => (
                            <DepthBar key={layer.depth_top_cm} layer={layer} t={t} />
                        ))}
                    </TooltipProvider>
                </div>
            </section>

            {/* Property cards */}
            <section>
                <h3 className="text-xs font-semibold mb-2">{t("properties")}</h3>
                <div className="grid grid-cols-2 gap-2">
                    <PhCard layer={layers[0]} t={t} />
                    <SocCard layer={layers[0]} t={t} />
                    <CecCard layer={layers[0]} t={t} />
                    <BdCard layer={layers[0]} t={t} />
                </div>
            </section>

            {/* AWC & Summary */}
            {summary && (
                <section>
                    <h3 className="text-xs font-semibold mb-2">{t("summary")}</h3>
                    <div className="space-y-2">
                        {/* Summary badges */}
                        <div className="flex flex-wrap gap-1.5">
                            {summary.dominant_texture && (
                                <Badge label={t("textureClass")} value={summary.dominant_texture} />
                            )}
                            {summary.drainage_class && (
                                <DrainageBadge drainageClass={summary.drainage_class} t={t} />
                            )}
                            <Badge
                                label={t("dataQuality")}
                                value={qualityLabel(summary.data_quality_score, t)}
                            />
                        </div>

                        {/* AWC bar */}
                        {summary.rootzone_awc_mm != null && (
                            <AwcBar awc={summary.rootzone_awc_mm} t={t} />
                        )}

                        {/* SOC stock card */}
                        {summary.total_soc_stock_t_ha != null && (
                            <SocStockCard
                                total={summary.total_soc_stock_t_ha}
                                topsoil={summary.topsoil_soc_stock_t_ha}
                                t={t}
                            />
                        )}

                        {/* Risk indicators */}
                        <div>
                            <h4 className="text-[11px] font-medium text-muted-foreground mb-1.5">
                                {t("risks")}
                            </h4>
                            <div className="grid grid-cols-2 gap-1.5">
                                <RiskBadge
                                    label={t("acidification")}
                                    score={summary.acidification_risk}
                                    t={t}
                                />
                                <RiskBadge
                                    label={t("compaction")}
                                    score={summary.compaction_risk}
                                    t={t}
                                />
                                <RiskBadge
                                    label={t("leaching")}
                                    score={summary.leaching_risk}
                                    t={t}
                                />
                                <RiskBadge
                                    label={t("rootingConstraint")}
                                    score={summary.rooting_constraint}
                                    t={t}
                                />
                                <RiskBadge
                                    label={t("waterlogging")}
                                    score={summary.waterlogging_risk}
                                    t={t}
                                />
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ── Intelligence Sections ──────────────────────── */}

            {/* Weather × Soil Stress */}
            {weatherStress && (
                <section className="space-y-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <Droplets className="h-4 w-4" />
                        {t("weatherStress")}
                    </h4>
                    <div className="rounded-lg border bg-card p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={cn(
                                "h-2.5 w-2.5 rounded-full shrink-0",
                                weatherStress.status === "optimal" ? "bg-success" :
                                    weatherStress.status === "drought_stress" ? "bg-danger" :
                                        weatherStress.status === "wet_stress" ? "bg-sig-water" :
                                            weatherStress.status === "approaching_drought" ? "bg-warning" :
                                                "bg-muted-foreground"
                            )} />
                            <span className="text-sm font-medium capitalize">
                                {t(`stressStatus_${weatherStress.status}`, { defaultMessage: weatherStress.status.replace(/_/g, " ") })}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                                {t("severity")}: {(weatherStress.severity * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                            <div
                                className={cn("h-full rounded-full transition-all",
                                    weatherStress.severity < 0.3 ? "bg-success" :
                                        weatherStress.severity < 0.6 ? "bg-warning" : "bg-danger"
                                )}
                                style={{ width: `${Math.min(weatherStress.severity * 100, 100)}%` }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                            {weatherStress.awc_rootzone_mm != null && (
                                <span>{t("rootzoneAwc")}: {weatherStress.awc_rootzone_mm.toFixed(0)} mm</span>
                            )}
                            {weatherStress.water_balance_30d_mm != null && (
                                <span>{t("waterBalance30d")}: {weatherStress.water_balance_30d_mm.toFixed(0)} mm</span>
                            )}
                        </div>
                        {weatherStress.factors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {weatherStress.factors.map((f) => (
                                    <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{f}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Crop Suitability */}
            {cropSuitability && !cropSuitability.weather_available && (
                <section className="space-y-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <Sprout className="h-4 w-4" />
                        {t("cropSuitability")}
                    </h4>
                    <div className="rounded-lg border bg-warning-subtle p-3">
                        <p className="text-[11px] text-warning">
                            {t("cropSuitabilityWeatherRequired")}
                        </p>
                    </div>
                </section>
            )}
            {cropSuitability && cropSuitability.weather_available && cropSuitability.crops.length > 0 && (
                <section className="space-y-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <Sprout className="h-4 w-4" />
                        {t("cropSuitability")}
                    </h4>
                    {cropSuitability.field_crop_suitability && (
                        <div className={cn(
                            "rounded-lg border p-2.5",
                            cropSuitability.field_crop_suitability.score >= 70 ? "border-success/30 bg-success-subtle" :
                                cropSuitability.field_crop_suitability.score >= 40 ? "border-warning/30 bg-warning-subtle" :
                                    "border-danger/30 bg-danger-subtle"
                        )}>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium">{cropSuitability.field_crop_suitability.name}</span>
                                <span className={cn("text-xs font-bold tabular-nums",
                                    cropSuitability.field_crop_suitability.score >= 70 ? "text-success" :
                                        cropSuitability.field_crop_suitability.score >= 40 ? "text-warning" :
                                            "text-danger"
                                )}>
                                    {cropSuitability.field_crop_suitability.score.toFixed(0)}%
                                </span>
                            </div>
                            {cropSuitability.field_crop_suitability.limiting_factors.length > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {t("limitingFactors")}: {cropSuitability.field_crop_suitability.limiting_factors.join(", ")}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="rounded-lg border bg-white dark:bg-card p-3 max-h-[280px] overflow-y-auto space-y-1.5">
                        {cropSuitability.crops.map((c) => (
                            <div key={c.crop} className="flex items-center gap-2 text-[11px]">
                                <span className="w-28 shrink-0 truncate font-medium">{c.name}</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full",
                                            c.score >= 70 ? "bg-success" :
                                                c.score >= 40 ? "bg-warning" : "bg-danger"
                                        )}
                                        style={{ width: `${c.score}%` }}
                                    />
                                </div>
                                <span className="w-8 text-right tabular-nums text-muted-foreground">{c.score.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Sampling Zones */}
            {samplingZones && samplingZones.features.length > 0 && (
                <section className="space-y-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" />
                        {t("samplingZones")}
                    </h4>
                    <div className="rounded-lg border bg-white dark:bg-card p-3 space-y-2">
                        {samplingZones.features.map((f, i) => {
                            const p = f.properties;
                            const priorityColor = p.priority === 1
                                ? "bg-sev-high" : p.priority === 2
                                    ? "bg-sev-medium" : "bg-info";
                            return (
                                <div
                                    key={i}
                                    className="flex items-start gap-2 text-[11px] cursor-pointer rounded-md px-1 py-0.5 hover:bg-surface-2 transition-colors"
                                    onClick={() => flyToZone(f)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === "Enter") flyToZone(f); }}
                                >
                                    <span className={cn("mt-0.5 h-2.5 w-2.5 rounded-full shrink-0", priorityColor)} />
                                    <div className="min-w-0">
                                        <span className="font-medium">
                                            {t(`zoneType_${p.zone_type}`, { defaultMessage: p.zone_type.replace(/_/g, " ") })}
                                        </span>
                                        <p className="text-[10px] text-muted-foreground">{p.rationale}</p>
                                    </div>
                                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
                                        P{p.priority}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Nutrient Context */}
            {nutrientContext && (
                <section className="space-y-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        {t("nutrientContext")}
                    </h4>
                    <div className="rounded-lg border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn(
                                "h-2.5 w-2.5 rounded-full shrink-0",
                                nutrientContext.zone_class === "nutrient_retentive" ? "bg-success" :
                                    nutrientContext.zone_class === "nutrient_responsive" ? "bg-warning" :
                                        "bg-danger"
                            )} />
                            <span className="text-sm font-medium">
                                {t(`nutrientZone_${nutrientContext.zone_class}`, { defaultMessage: nutrientContext.zone_class.replace(/_/g, " ") })}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                                {(nutrientContext.confidence * 100).toFixed(0)}% {t("confidence")}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">{nutrientContext.interpretation}</p>
                        {nutrientContext.factors.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {nutrientContext.factors.map((f) => (
                                    <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{f}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Carbon & Sequestration */}
            {carbonEstimate && (
                <section className="space-y-2">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <Leaf className="h-4 w-4" />
                        {t("carbonSequestration")}
                    </h4>
                    <div className="rounded-lg border bg-card p-3">
                        {carbonEstimate.saturation_pct != null && (
                            <div className="mb-2">
                                <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-[10px] text-muted-foreground">{t("carbonSaturation")}</span>
                                    <span className="text-xs font-semibold tabular-nums">
                                        {carbonEstimate.saturation_pct.toFixed(0)}%
                                    </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all",
                                            carbonEstimate.saturation_pct < 50 ? "bg-success" :
                                                carbonEstimate.saturation_pct < 80 ? "bg-warning" : "bg-danger"
                                        )}
                                        style={{ width: `${Math.min(carbonEstimate.saturation_pct, 100)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {carbonEstimate.saturation_pct >= 80
                                        ? t("socHintHigh")
                                        : carbonEstimate.saturation_pct >= 50
                                            ? t("socHintModerate")
                                            : t("socHintLow")}
                                </p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                            {carbonEstimate.current_soc_t_ha != null && (
                                <div>
                                    <span className="text-muted-foreground">{t("currentSoc")}</span>
                                    <span className="font-medium ml-1">{carbonEstimate.current_soc_t_ha.toFixed(1)} t/ha</span>
                                </div>
                            )}
                            {carbonEstimate.saturation_t_ha != null && (
                                <div>
                                    <span className="text-muted-foreground">{t("saturationCapacity")}</span>
                                    <span className="font-medium ml-1">{carbonEstimate.saturation_t_ha.toFixed(1)} t/ha</span>
                                </div>
                            )}
                            {carbonEstimate.seq_potential_low_t_ha_yr != null && carbonEstimate.seq_potential_high_t_ha_yr != null && (
                                <div className="col-span-2 mt-1">
                                    <span className="text-muted-foreground">{t("seqPotential")}</span>
                                    <span className="font-medium ml-1">
                                        {carbonEstimate.seq_potential_low_t_ha_yr.toFixed(2)}–{carbonEstimate.seq_potential_high_t_ha_yr.toFixed(2)} t/ha/yr
                                    </span>
                                </div>
                            )}
                        </div>
                        {carbonEstimate.climate_zone && (
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                                {t("climateZone")}: {carbonEstimate.climate_zone}
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* Active job progress (during re-fetch with existing data) */}
            {jobActive && (
                <div className="rounded-lg border border-primary-border bg-primary-subtle p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs font-medium text-primary">{t("processingTitle")}</span>
                    </div>
                    {getJobProgress() && (
                        <ul className="space-y-1">
                            {getJobProgress()!.map((step) => (
                                <li
                                    key={step.key}
                                    className={cn(
                                        "flex items-center gap-1.5 text-[11px]",
                                        step.status === "completed" && "text-primary",
                                        step.status === "running" && "text-foreground font-medium",
                                        step.status !== "completed" && step.status !== "running" && "text-muted-foreground",
                                    )}
                                >
                                    {step.status === "completed" ? (
                                        <Check className="h-3 w-3 text-primary" />
                                    ) : step.status === "running" ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <span className="h-3 w-3 rounded-full border border-muted-foreground/40 inline-block" />
                                    )}
                                    {step.label}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Source metadata + refresh */}
            <section className="border-t pt-3">
                <div className="flex items-center justify-between">
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                        <p>
                            {t("source")}: <span className="font-medium">{profile.source}</span>
                            {profile.source_resolution_m != null && (
                                <> · {profile.source_resolution_m}m</>
                            )}
                        </p>
                        <p>
                            {t("fetchedAt")}:{" "}
                            {new Date(profile.fetched_at).toLocaleDateString()}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="px-2 text-xs"
                        onClick={handleRefresh}
                        disabled={refreshing || !!jobActive}
                    >
                        {refreshing || jobActive ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        {t("refresh")}
                    </Button>
                </div>
            </section>
        </div>
    );
}

/* ── Sub-components ──────────────────────────────────────── */

function DepthBar({
    layer,
    t,
}: {
    layer: SoilLayer;
    t: (key: string, values?: Record<string, string | number>) => string;
}) {
    const sand = layer.sand_pct ?? 0;
    const silt = layer.silt_pct ?? 0;
    const clay = layer.clay_pct ?? 0;

    const tooltipContent = (
        <div className="text-xs space-y-1 py-0.5">
            <p className="font-semibold">{depthLabel(layer.depth_top_cm, layer.depth_bottom_cm)}</p>
            <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-soil-sand shrink-0" />
                <span>
                    {t("sand")}: {sand.toFixed(0)}%
                    {layer.sand_q05 != null && layer.sand_q95 != null && (
                        <span className="text-muted-foreground">
                            {" "}[{layer.sand_q05.toFixed(0)}–{layer.sand_q95.toFixed(0)}%]
                        </span>
                    )}
                </span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-soil-silt shrink-0" />
                <span>{t("silt")}: {silt.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-soil-clay shrink-0" />
                <span>
                    {t("clay")}: {clay.toFixed(0)}%
                    {layer.clay_q05 != null && layer.clay_q95 != null && (
                        <span className="text-muted-foreground">
                            {" "}[{layer.clay_q05.toFixed(0)}–{layer.clay_q95.toFixed(0)}%]
                        </span>
                    )}
                </span>
            </div>
            {layer.texture_class && (
                <p className="font-medium pt-0.5 border-t border-border mt-1 pt-1">{layer.texture_class}</p>
            )}
        </div>
    );

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-[52px] shrink-0 text-right tabular-nums">
                {depthLabel(layer.depth_top_cm, layer.depth_bottom_cm)}
            </span>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex-1 h-5 rounded-full overflow-hidden flex cursor-default">
                        <div
                            className="h-full bg-soil-sand"
                            style={{ width: `${sand}%` }}
                        />
                        <div
                            className="h-full bg-soil-silt"
                            style={{ width: `${silt}%` }}
                        />
                        <div
                            className="h-full bg-soil-clay"
                            style={{ width: `${clay}%` }}
                        />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px]">
                    {tooltipContent}
                </TooltipContent>
            </Tooltip>
            <span className="text-[10px] text-muted-foreground w-[72px] shrink-0 truncate">
                {layer.texture_class ?? "-"}
            </span>
        </div>
    );
}

function PhCard({
    layer,
    t,
}: {
    layer: SoilLayer;
    t: (key: string) => string;
}) {
    if (layer.ph == null) return null;
    const ph = layer.ph;
    return (
        <div className={cn("rounded-lg p-2.5", phBg(ph))}>
            <p className="text-[10px] text-muted-foreground">{t("ph")}</p>
            <p className={cn("text-lg font-bold tabular-nums", phColor(ph))}>
                {ph.toFixed(1)}
            </p>
            {layer.ph_q05 != null && layer.ph_q95 != null && (
                <p className="text-[10px] text-muted-foreground">
                    {layer.ph_q05.toFixed(1)}–{layer.ph_q95.toFixed(1)}
                </p>
            )}
            <p className="text-[10px] mt-0.5">
                {ph < 5.5
                    ? t("phAcidic")
                    : ph < 6.5
                        ? t("phSlightlyAcidic")
                        : ph <= 7.5
                            ? t("phNeutral")
                            : t("phAlkaline")}
            </p>
        </div>
    );
}

function SocCard({
    layer,
    t,
}: {
    layer: SoilLayer;
    t: (key: string) => string;
}) {
    if (layer.soc_g_kg == null) return null;
    const soc = layer.soc_g_kg;
    const level = soc < 10 ? "socLow" : soc < 25 ? "socMedium" : "socHigh";
    const color =
        soc < 10
            ? "text-danger"
            : soc < 25
                ? "text-warning"
                : "text-success";
    return (
        <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground">{t("soc")}</p>
            <p className={cn("text-lg font-bold tabular-nums", color)}>
                {soc.toFixed(1)}
                <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                    {t("socUnit")}
                </span>
            </p>
            {layer.soc_q05 != null && layer.soc_q95 != null && (
                <p className="text-[10px] text-muted-foreground">
                    {layer.soc_q05.toFixed(1)}–{layer.soc_q95.toFixed(1)}
                </p>
            )}
            <p className="text-[10px] mt-0.5">{t(level)}</p>
        </div>
    );
}

function CecCard({
    layer,
    t,
}: {
    layer: SoilLayer;
    t: (key: string) => string;
}) {
    if (layer.cec_cmol_kg == null) return null;
    const cec = layer.cec_cmol_kg;
    const level = cec < 10 ? "cecLow" : cec < 20 ? "cecMedium" : "cecHigh";
    const color =
        cec < 10
            ? "text-danger"
            : cec < 20
                ? "text-warning"
                : "text-success";
    return (
        <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground">{t("cec")}</p>
            <p className={cn("text-lg font-bold tabular-nums", color)}>
                {cec.toFixed(1)}
                <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                    {t("cecUnit")}
                </span>
            </p>
            <p className="text-[10px] mt-0.5">{t(level)}</p>
        </div>
    );
}

function BdCard({
    layer,
    t,
}: {
    layer: SoilLayer;
    t: (key: string) => string;
}) {
    if (layer.bd_kg_dm3 == null) return null;
    const bd = layer.bd_kg_dm3;
    return (
        <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground">{t("bd")}</p>
            <p className={cn("text-lg font-bold tabular-nums", bdColor(bd))}>
                {bd.toFixed(2)}
                <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                    {t("bdUnit")}
                </span>
            </p>
            <p className="text-[10px] mt-0.5">
                {bd < 1.4
                    ? t("riskLow")
                    : bd <= 1.6
                        ? t("riskModerate")
                        : t("riskHigh")}
            </p>
        </div>
    );
}

function AwcBar({
    awc,
    t,
}: {
    awc: number;
    t: (key: string) => string;
}) {
    const level = awcLevel(awc);
    const pct = Math.min((awc / 250) * 100, 100);
    const labelKey = level === "low" ? "awcLow" : level === "moderate" ? "awcModerate" : "awcGood";
    return (
        <div className="rounded-lg border bg-card p-2.5">
            <div className="flex items-baseline justify-between mb-1">
                <p className="text-[10px] text-muted-foreground">{t("rootzoneAwc")}</p>
                <span className="text-xs font-semibold tabular-nums">
                    {awc.toFixed(0)} {t("awcUnit")}
                </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all", awcColor(awc))}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{t(labelKey)}</p>
        </div>
    );
}

function RiskBadge({
    label,
    score,
    t,
}: {
    label: string;
    score: number | null;
    t: (key: string) => string;
}) {
    if (score == null) return null;
    const labelKey = score < 0.3 ? "riskLow" : score < 0.6 ? "riskModerate" : "riskHigh";
    return (
        <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
            <span className={cn("h-2 w-2 rounded-full shrink-0", riskColor(score))} />
            <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{label}</p>
                <p className={cn("text-[11px] font-medium", riskTextColor(score))}>
                    {t(labelKey)}
                </p>
            </div>
        </div>
    );
}

function DrainageBadge({
    drainageClass,
    t,
}: {
    drainageClass: string;
    t: (key: string) => string;
}) {
    const colorMap: Record<string, string> = {
        "very poorly drained": "bg-sig-water",
        "poorly drained": "bg-sig-water",
        "somewhat poorly drained": "bg-info",
        "moderately well drained": "bg-success",
        "well drained": "bg-success",
        "somewhat excessively drained": "bg-caution",
        "excessively drained": "bg-warning",
    };
    const dot = colorMap[drainageClass] ?? "bg-muted-foreground";
    return (
        <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[11px]">
            <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
            <span className="text-muted-foreground">{t("drainageClass")}:</span>
            <span className="font-medium capitalize">{drainageClass}</span>
        </span>
    );
}

function SocStockCard({
    total,
    topsoil,
    t,
}: {
    total: number;
    topsoil: number | null;
    t: (key: string) => string;
}) {
    const level = total < 40 ? "socStockLow" : total < 80 ? "socStockMedium" : "socStockHigh";
    const color =
        total < 40
            ? "text-danger"
            : total < 80
                ? "text-warning"
                : "text-success";
    const pct = Math.min((total / 150) * 100, 100);
    const barColor =
        total < 40 ? "bg-danger" : total < 80 ? "bg-warning" : "bg-success";
    return (
        <div className="rounded-lg border bg-card p-2.5">
            <div className="flex items-baseline justify-between mb-1">
                <p className="text-[10px] text-muted-foreground">{t("socStock")}</p>
                <span className={cn("text-xs font-semibold tabular-nums", color)}>
                    {total.toFixed(1)} {t("socStockUnit")}
                </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all", barColor)}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-muted-foreground">{t(level)}</p>
                {topsoil != null && (
                    <p className="text-[10px] text-muted-foreground">
                        {t("topsoil")}: {topsoil.toFixed(1)} {t("socStockUnit")}
                    </p>
                )}
            </div>
        </div>
    );
}

function Badge({ label, value }: { label: string; value: string }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium capitalize">{value}</span>
        </span>
    );
}
