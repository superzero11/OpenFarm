"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
    monitoringApi,
    jobsApi,
    weatherApi,
    type RasterLayer,
    type FieldStat,
    type NdviJob,
    type IndexType,
    type WeatherDaily,
    INDEX_CONFIG,
    ALL_INDEX_TYPES,
} from "@/lib/api";
import { toast } from "sonner";
import {
    PlayCircle,
    Loader2,
    Calendar,
    ChevronDown,
    ChevronUp,
    Check,
    AlertTriangle,
    Eye,
    EyeOff,
    CloudRain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NdviChart = dynamic(() => import("@/components/charts/ndvi-chart"), {
    ssr: false,
    loading: () => (
        <div className="flex flex-col items-center justify-center h-[200px] gap-2">
            <Skeleton className="h-[160px] w-full rounded-md" />
        </div>
    ),
});

/* ── Util: dd days ago as YYYY-MM-DD ─────────────────────────── */
function daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/* ── Job sub-step labels ─────────────────────────────────────── */
function getStepLabels(indexType: IndexType): Record<string, string> {
    const label = INDEX_CONFIG[indexType].label;
    return {
        scene_search: "Searching satellite scenes",
        download_bands: "Downloading bands",
        [`compute_${indexType.toLowerCase()}`]: `Computing ${label}`,
        write_cog: "Writing COG",
        compute_stats: "Computing statistics",
        run_alerts: "Checking alert rules",
        complete: "Complete",
    };
}

/* ── Props ────────────────────────────────────────────────────── */

interface NdviTabProps {
    fieldId: string;
    /** Called when a tile layer should be shown on the map */
    onShowLayer?: (layer: RasterLayer | null, indexType: IndexType) => void;
    /** Called when the active index changes — parent renders the selector */
    onActiveIndexChange?: (index: IndexType) => void;
    /** Externally controlled active index (from parent floating selector) */
    activeIndexOverride?: IndexType;
    /** Called after data loads so parent can refresh available index types */
    onDataLoaded?: () => void;
}

export default function NdviTab({ fieldId, onShowLayer, onActiveIndexChange, activeIndexOverride, onDataLoaded }: NdviTabProps) {
    // ── Index selector ───────────────────────────────
    const [activeIndex, setActiveIndex] = useState<IndexType>("NDVI");
    const config = INDEX_CONFIG[activeIndex];

    // ── Data ─────────────────────────────────────────
    const [layers, setLayers] = useState<RasterLayer[]>([]);
    const [stats, setStats] = useState<FieldStat[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Selected date ────────────────────────────────
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [layerVisible, setLayerVisible] = useState(true);

    // ── Job creation form ────────────────────────────
    const [showJobForm, setShowJobForm] = useState(false);
    const [dateFrom, setDateFrom] = useState(daysAgo(30));
    const [dateTo, setDateTo] = useState(today());
    const [submitting, setSubmitting] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState<Set<IndexType>>(new Set(["NDVI"]));
    const [saviL, setSaviL] = useState(0.5);

    // ── Weather overlay ──────────────────────────────
    const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);
    const [weatherData, setWeatherData] = useState<WeatherDaily[]>([]);

    // ── Active job tracking ──────────────────────────
    const [activeJob, setActiveJob] = useState<NdviJob | null>(null);
    const [jobIndices, setJobIndices] = useState<IndexType[]>([]);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const loadGenRef = useRef(0); // prevents stale fetch results

    // ── Load layers + stats for active index ─────────
    const loadData = useCallback(async () => {
        const gen = ++loadGenRef.current;
        setLoading(true);
        try {
            const [layersRes, statsRes] = await Promise.all([
                monitoringApi.layers(fieldId, activeIndex),
                monitoringApi.stats(fieldId, activeIndex),
            ]);
            if (gen !== loadGenRef.current) return; // stale — discard
            setLayers(layersRes.items);
            setStats(statsRes.items);
            onDataLoaded?.();
            // Auto-select latest date
            if (layersRes.items.length > 0) {
                setSelectedDate(layersRes.items[layersRes.items.length - 1].date);
            } else {
                setSelectedDate(null);
            }
        } catch {
            // silent — may simply have no data
        } finally {
            if (gen === loadGenRef.current) setLoading(false);
        }
    }, [fieldId, activeIndex]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Fetch weather data when overlay is toggled on ──
    useEffect(() => {
        if (!showWeatherOverlay || stats.length === 0) return;
        const dates = stats.map((s) => s.date).sort();
        const start = dates[0];
        const end = dates[dates.length - 1];
        weatherApi
            .get(fieldId, start, end, false)
            .then((res) => setWeatherData(res.data))
            .catch(() => setWeatherData([]));
    }, [showWeatherOverlay, fieldId, stats]);

    // ── Show layer on map when selectedDate or visibility changes ──
    useEffect(() => {
        if (!onShowLayer) return;
        if (!layerVisible || !selectedDate) {
            onShowLayer(null, activeIndex);
            return;
        }
        const layer = layers.find((l) => l.date === selectedDate);
        onShowLayer(layer ?? null, activeIndex);
    }, [selectedDate, layerVisible, layers, onShowLayer, activeIndex]);

    // ── Job polling ─────────────────────────────────
    const pollJob = useCallback(
        async (jobId: string) => {
            try {
                const job = await jobsApi.get(jobId);
                setActiveJob(job);
                if (job.status === "completed" || job.status === "failed") {
                    if (pollRef.current) clearInterval(pollRef.current);
                    pollRef.current = null;
                    const names = jobIndices.map((i) => INDEX_CONFIG[i].label).join(", ") || config.label;
                    if (job.status === "completed") {
                        toast.success(`${names} processing complete!`);
                        loadData();
                        onDataLoaded?.();
                    } else {
                        toast.error(`${names} job failed: ${job.error || "Unknown error"}`);
                    }
                    setActiveJob(null);
                }
            } catch {
                // poll error — keep trying
            }
        },
        [loadData, config.label, jobIndices, onDataLoaded],
    );

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ── Toggle index in job form selection ───────────
    const toggleJobIndex = (idx: IndexType) => {
        setSelectedIndices((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) {
                if (next.size > 1) next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    // ── Submit jobs (one per selected index) ─────────
    const handleSubmitJob = async () => {
        setSubmitting(true);
        try {
            const indices = Array.from(selectedIndices);
            let lastJob: NdviJob | null = null;

            for (const idx of indices) {
                const params = idx === "SAVI" ? { savi_l: saviL } : undefined;
                const job = await jobsApi.createIndex(fieldId, idx, dateFrom, dateTo, params);
                lastJob = job;
            }

            if (lastJob) {
                setActiveJob(lastJob);
                setJobIndices(indices);
                setShowJobForm(false);
                const names = indices.map((i) => INDEX_CONFIG[i].label).join(", ");
                toast.success(`${names} job${indices.length > 1 ? "s" : ""} started`);

                // Poll the last submitted job
                if (pollRef.current) clearInterval(pollRef.current);
                pollRef.current = setInterval(() => pollJob(lastJob!.id), 5000);
            }
        } catch (err: any) {
            toast.error(err.detail || "Failed to start job");
        } finally {
            setSubmitting(false);
        }
    };

    // ── Date select from chart ───────────────────────
    const handleChartDateSelect = (date: string) => {
        setSelectedDate(date);
        setLayerVisible(true);
    };

    // ── Job progress helper ─────────────────────────
    const getJobProgress = () => {
        if (!activeJob?.progress_json) return null;
        const p = activeJob.progress_json as Record<string, string>;
        const lastIdx = jobIndices[jobIndices.length - 1] || activeIndex;
        const stepLabels = getStepLabels(lastIdx);
        const steps = Object.entries(stepLabels);
        return steps.map(([key, label]) => {
            const status = p[key] || "pending";
            return { key, label, status };
        });
    };

    // ── Switch active index ──────────────────────────
    const handleIndexChange = (idx: IndexType) => {
        if (idx === activeIndex) return;
        // Clear data immediately to prevent stale overlay
        setLayers([]);
        setStats([]);
        setSelectedDate(null);
        setActiveIndex(idx);
        onActiveIndexChange?.(idx);
        setActiveJob(null);
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    // Sync when parent overrides active index
    useEffect(() => {
        if (activeIndexOverride && activeIndexOverride !== activeIndex) {
            setLayers([]);
            setStats([]);
            setSelectedDate(null);
            setActiveIndex(activeIndexOverride);
            setActiveJob(null);
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }
    }, [activeIndexOverride]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return (
            <div className="space-y-4 py-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-[200px] w-full rounded-lg" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-full rounded" />
                    <Skeleton className="h-8 w-full rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── Section: Run Analysis Job ────────────── */}
            <div>
                <Button
                    variant="outline"
                    onClick={() => setShowJobForm(!showJobForm)}
                    className="w-full flex items-center justify-between"
                >
                    <span className="flex items-center gap-1.5">
                        <PlayCircle className="h-4 w-4 text-primary" />
                        Run Analysis
                    </span>
                    {showJobForm ? (
                        <ChevronUp className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </Button>

                {showJobForm && (
                    <Card className="mt-2">
                        <CardContent className="space-y-3 pt-4">
                            {/* Index checkboxes */}
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                                    Indices to compute
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {ALL_INDEX_TYPES.map((idx) => (
                                        <Button
                                            key={idx}
                                            type="button"
                                            variant={selectedIndices.has(idx) ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => toggleJobIndex(idx)}
                                            className={cn(
                                                "h-7 text-xs px-2.5",
                                                selectedIndices.has(idx) && "shadow-sm",
                                            )}
                                        >
                                            {INDEX_CONFIG[idx].label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* SAVI L factor */}
                            {selectedIndices.has("SAVI") && (
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        SAVI L factor
                                    </label>
                                    <input
                                        type="number"
                                        value={saviL}
                                        onChange={(e) => setSaviL(Number(e.target.value))}
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Soil brightness correction (0–1, default 0.5)
                                    </p>
                                </div>
                            )}

                            {/* Date range */}
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        <Calendar className="inline h-3 w-3 mr-0.5" />
                                        From
                                    </label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        max={dateTo}
                                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        <Calendar className="inline h-3 w-3 mr-0.5" />
                                        To
                                    </label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        min={dateFrom}
                                        max={today()}
                                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Maximum 180-day range.</p>
                            <Button
                                onClick={handleSubmitJob}
                                disabled={submitting || !!activeJob}
                                className="w-full"
                            >
                                {submitting ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <PlayCircle className="h-4 w-4 mr-2" />
                                )}
                                {submitting ? "Starting…" : "Start Processing"}
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Section: Active Job Progress ─────────── */}
            {activeJob && (activeJob.status === "pending" || activeJob.status === "running") && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2 pt-3 px-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            Processing {jobIndices.map((i) => INDEX_CONFIG[i].label).join(", ")}…
                        </CardTitle>
                    </CardHeader>
                    {getJobProgress() && (
                        <CardContent className="px-3 pb-3 pt-0">
                            <ul className="space-y-1">
                                {getJobProgress()!.map((step) => (
                                    <li
                                        key={step.key}
                                        className={cn(
                                            "flex items-center gap-1.5 text-xs",
                                            step.status === "done" && "text-primary",
                                            step.status === "running" && "text-foreground font-medium",
                                            step.status !== "done" && step.status !== "running" && "text-muted-foreground",
                                        )}
                                    >
                                        {step.status === "done" ? (
                                            <Check className="h-3 w-3 text-primary" />
                                        ) : step.status === "running" ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-foreground" />
                                        ) : (
                                            <span className="h-3 w-3 rounded-full border border-muted-foreground/40 inline-block" />
                                        )}
                                        {step.label}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* ── Job failed banner ────────────────────── */}
            {activeJob && activeJob.status === "failed" && (
                <Card className="border-destructive/50 bg-destructive/10">
                    <CardContent className="flex items-start gap-2 p-3">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-destructive">Job failed</p>
                            <p className="text-xs text-destructive/80">{activeJob.error || "Unknown error"}</p>
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => setActiveJob(null)}
                                className="h-auto p-0 text-xs text-destructive underline mt-1"
                            >
                                Dismiss
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Section: Chart ────────────────────────── */}
            <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold">{config.label} Time Series</CardTitle>
                        <Button
                            variant={showWeatherOverlay ? "secondary" : "ghost"}
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1"
                            onClick={() => setShowWeatherOverlay(!showWeatherOverlay)}
                            title={showWeatherOverlay ? "Hide weather overlay" : "Show weather overlay"}
                        >
                            <CloudRain className="h-3 w-3" />
                            Weather
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                    <NdviChart
                        stats={stats}
                        selectedDate={selectedDate}
                        onDateSelect={handleChartDateSelect}
                        height={showWeatherOverlay ? 240 : 200}
                        indexType={activeIndex}
                        weatherData={weatherData}
                        showWeatherOverlay={showWeatherOverlay}
                    />
                </CardContent>
            </Card>

            {/* ── Section: Layer Selector ───────────────── */}
            {layers.length > 0 && (
                <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-semibold">
                                {config.label} Layers
                                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                                    {layers.length}
                                </Badge>
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLayerVisible(!layerVisible)}
                                className="h-6 w-6 p-0"
                                title={layerVisible ? `Hide ${config.label} overlay` : `Show ${config.label} overlay`}
                            >
                                {layerVisible ? (
                                    <Eye className="h-3.5 w-3.5" />
                                ) : (
                                    <EyeOff className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0">
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                            {layers.map((layer) => {
                                const isSelected = layer.date === selectedDate;
                                const stat = stats.find((s) => s.date === layer.date);
                                return (
                                    <Button
                                        key={layer.id}
                                        variant={isSelected ? "default" : "outline"}
                                        onClick={() => {
                                            setSelectedDate(layer.date);
                                            setLayerVisible(true);
                                        }}
                                        className={cn(
                                            "w-full justify-between h-auto py-1.5 px-2 text-xs",
                                            isSelected
                                                ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
                                                : "text-muted-foreground",
                                        )}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-medium">{layer.date}</span>
                                            <span className="text-muted-foreground text-[10px]">
                                                {layer.satellite}
                                                {activeIndex === "SAVI" && layer.params_json?.savi_l != null && (
                                                    <> · L={layer.params_json.savi_l}</>
                                                )}
                                            </span>
                                        </div>
                                        {stat?.mean != null && (
                                            <Badge
                                                variant={stat.mean < config.threshold ? "destructive" : "default"}
                                                className={cn(
                                                    "font-mono text-[10px] px-1.5",
                                                    stat.mean >= config.threshold && "bg-primary hover:bg-primary/90",
                                                )}
                                            >
                                                {stat.mean.toFixed(3)}
                                            </Badge>
                                        )}
                                    </Button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── No data message ──────────────────────── */}
            {layers.length === 0 && !activeJob && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-sm text-muted-foreground mb-2">No {config.label} data yet.</p>
                        <p className="text-xs text-muted-foreground">
                            Click &quot;Run Analysis&quot; to process satellite imagery.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
