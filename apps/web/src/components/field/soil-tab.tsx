"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { soilApi, jobsApi } from "@/lib/api";
import type { SoilProfile, SoilFieldSummary, SoilLayer, NdviJob } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw, Info, Layers, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    if (ph < 5.5) return "text-red-600 dark:text-red-400";
    if (ph < 6.5) return "text-yellow-600 dark:text-yellow-400";
    if (ph <= 7.5) return "text-green-600 dark:text-green-400";
    return "text-yellow-600 dark:text-yellow-400";
}

function phBg(ph: number): string {
    if (ph < 5.5) return "bg-red-100 dark:bg-red-900/30";
    if (ph < 6.5) return "bg-yellow-100 dark:bg-yellow-900/30";
    if (ph <= 7.5) return "bg-green-100 dark:bg-green-900/30";
    return "bg-yellow-100 dark:bg-yellow-900/30";
}

function riskColor(score: number): string {
    if (score < 0.3) return "bg-green-500";
    if (score < 0.6) return "bg-yellow-500";
    return "bg-red-500";
}

function riskTextColor(score: number): string {
    if (score < 0.3) return "text-green-700 dark:text-green-400";
    if (score < 0.6) return "text-yellow-700 dark:text-yellow-400";
    return "text-red-700 dark:text-red-400";
}

function bdColor(bd: number): string {
    if (bd < 1.4) return "text-green-600 dark:text-green-400";
    if (bd <= 1.6) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
}

function awcLevel(mm: number): "low" | "moderate" | "good" {
    if (mm < 100) return "low";
    if (mm < 175) return "moderate";
    return "good";
}

function awcColor(mm: number): string {
    const level = awcLevel(mm);
    if (level === "low") return "bg-red-500";
    if (level === "moderate") return "bg-yellow-500";
    return "bg-green-500";
}

function qualityLabel(score: number | null, t: (key: string) => string): string {
    if (score == null) return "—";
    if (score >= 0.7) return t("qualityHigh");
    if (score >= 0.4) return t("qualityMedium");
    return t("qualityLow");
}

/* ── Component ───────────────────────────────────────────── */

interface SoilTabProps {
    fieldId: string;
}

export default function SoilTab({ fieldId }: SoilTabProps) {
    const t = useTranslations("soil");

    const [profile, setProfile] = useState<SoilProfile | null>(null);
    const [summary, setSummary] = useState<SoilFieldSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
                        // Reload data with retry — API may be briefly busy
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
                // poll error — keep trying
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

    /* Empty state — no soil profile yet */
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
                    <div className="mt-4 w-full max-w-[260px] rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
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
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-2" />
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
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-2.5 text-xs text-blue-800 dark:text-blue-300">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{t("disclaimer")}</span>
            </div>

            {/* Depth profile: sand/silt/clay stacked bars */}
            <section>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold">{t("depthProfile")}</h3>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 dark:bg-amber-500" />
                            {t("sand")}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-300 dark:bg-sky-500" />
                            {t("silt")}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-400 dark:bg-red-500" />
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
                        {/* AWC bar */}
                        {summary.rootzone_awc_mm != null && (
                            <AwcBar awc={summary.rootzone_awc_mm} t={t} />
                        )}

                        {/* Summary badges */}
                        <div className="flex flex-wrap gap-1.5">
                            {summary.dominant_texture && (
                                <Badge label={t("textureClass")} value={summary.dominant_texture} />
                            )}
                            {summary.drainage_class && (
                                <Badge label={t("drainageClass")} value={summary.drainage_class} />
                            )}
                            <Badge
                                label={t("dataQuality")}
                                value={qualityLabel(summary.data_quality_score, t)}
                            />
                        </div>

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
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Active job progress (during re-fetch with existing data) */}
            {jobActive && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
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
                        className="h-7 px-2 text-xs"
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
                <span className="inline-block w-2 h-2 rounded-sm bg-amber-400 dark:bg-amber-500 shrink-0" />
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
                <span className="inline-block w-2 h-2 rounded-sm bg-sky-300 dark:bg-sky-500 shrink-0" />
                <span>{t("silt")}: {silt.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm bg-red-400 dark:bg-red-500 shrink-0" />
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
                <p className="font-medium pt-0.5 border-t border-border/50 mt-1 pt-1">{layer.texture_class}</p>
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
                            className="h-full bg-amber-400 dark:bg-amber-500"
                            style={{ width: `${sand}%` }}
                        />
                        <div
                            className="h-full bg-sky-300 dark:bg-sky-500"
                            style={{ width: `${silt}%` }}
                        />
                        <div
                            className="h-full bg-red-400 dark:bg-red-500"
                            style={{ width: `${clay}%` }}
                        />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px]">
                    {tooltipContent}
                </TooltipContent>
            </Tooltip>
            <span className="text-[10px] text-muted-foreground w-[72px] shrink-0 truncate">
                {layer.texture_class ?? "—"}
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
            ? "text-red-600 dark:text-red-400"
            : soc < 25
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-green-600 dark:text-green-400";
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
            ? "text-red-600 dark:text-red-400"
            : cec < 20
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-green-600 dark:text-green-400";
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

function Badge({ label, value }: { label: string; value: string }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium capitalize">{value}</span>
        </span>
    );
}
