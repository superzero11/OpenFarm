"use client";

import React from "react";
import { Link } from "@/i18n/navigation";
import type { Alert } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    ChevronRight,
    CloudRain,
    Loader2,
    RotateCcw,
    ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Severity config ───────────────────────────────────────── */

const SEVERITY_CONFIG: Record<
    string,
    {
        dotClass: string;
        textClass: string;
        icon: React.ReactNode;
    }
> = {
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
    evi_drop: "EVI Drop",
    evi_threshold: "Low EVI",
    savi_drop: "SAVI Drop",
    savi_threshold: "Low SAVI",
    ndwi_drop: "NDWI Drop",
    ndwi_threshold: "Low NDWI",
};

/* ── Props ─────────────────────────────────────────────────── */

interface AlertRowProps {
    alert: Alert;
    /** Optional field name to show as context link. */
    fieldName?: string;
    /** Farm ID for building field link. */
    farmId?: string;
    /** Optional farm name to show as context. */
    farmName?: string;
    /** Show close/reopen action button. */
    showActions?: boolean;
    /** Called when toggling alert status. */
    onToggleStatus?: (alert: Alert) => void;
    /** ID of the alert currently being toggled (shows spinner). */
    togglingId?: string | null;
    /** i18n labels for close/reopen buttons. */
    actionLabels?: { close: string; reopen: string };
    /** Compact mode — reduced padding and smaller text. */
    compact?: boolean;
}

/* ── Component ─────────────────────────────────────────────── */

export function AlertRow({
    alert,
    fieldName,
    farmId,
    farmName,
    showActions = false,
    onToggleStatus,
    togglingId,
    actionLabels,
    compact = false,
}: AlertRowProps) {
    const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
    const isClosed = alert.status === "closed";

    /* ── Compact layout (field detail sidebar — narrow) ───── */
    if (compact) {
        return (
            <div
                className={cn(
                    "rounded-lg border bg-card shadow-sm p-2.5 transition-colors",
                    isClosed ? "opacity-60 bg-muted/30" : "hover:border-primary/20",
                )}
            >
                {/* Top row: icon + badge + rule + date */}
                <div className="flex items-center gap-1.5">
                    <span className={cn("shrink-0", severity.textClass)}>
                        {severity.icon}
                    </span>
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
                        {new Date(alert.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                </div>

                {/* Message */}
                <p className="text-xs leading-relaxed text-foreground/90 mt-1">
                    {alert.message}
                </p>

                {/* Weather context */}
                {alert.weather_context && (
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <CloudRain className="h-3 w-3 shrink-0" />
                        <span>
                            Precip 7d: {alert.weather_context.precipitation_7d_mm ?? "—"}mm
                            {alert.weather_context.water_deficit_mm != null && (
                                <> · Deficit: {alert.weather_context.water_deficit_mm}mm</>
                            )}
                        </span>
                    </div>
                )}

                {/* Action row */}
                {showActions && onToggleStatus && (
                    <div className="flex items-center justify-end mt-1.5">
                        <Button
                            variant={isClosed ? "outline" : "secondary"}
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            disabled={togglingId === alert.id}
                            onClick={() => onToggleStatus(alert)}
                        >
                            {togglingId === alert.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isClosed ? (
                                <><RotateCcw className="h-3 w-3 mr-1" />{actionLabels?.reopen ?? "Reopen"}</>
                            ) : (
                                <><CheckCircle2 className="h-3 w-3 mr-1" />{actionLabels?.close ?? "Close"}</>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    /* ── Normal layout (dashboard, alerts page, farm page) ── */
    return (
        <div
            className={cn(
                "flex items-start gap-3 rounded-lg border bg-card shadow-sm p-3 transition-colors",
                isClosed
                    ? "opacity-60 bg-muted/30"
                    : "hover:border-primary/20",
            )}
        >
            {/* Severity icon */}
            <div className={cn("mt-0.5 shrink-0", severity.textClass)}>
                {severity.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                        variant={
                            alert.severity === "high" && !isClosed
                                ? "destructive"
                                : "secondary"
                        }
                        className="text-[9px] px-1.5 py-0 uppercase tracking-wider font-semibold"
                    >
                        {alert.severity}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">
                        {RULE_LABELS[alert.rule_name] || alert.rule_name}
                    </span>
                    {isClosed && (
                        <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground"
                        >
                            Closed
                        </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                        {new Date(alert.date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                        })}
                    </span>
                </div>

                <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                    {alert.message}
                </p>

                {/* Weather context */}
                {alert.weather_context && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                            <CloudRain className="h-3 w-3" />
                            Precip 7d: {alert.weather_context.precipitation_7d_mm ?? "—"}mm
                        </span>
                        {alert.weather_context.et0_7d_mm != null && (
                            <span>ET₀ 7d: {alert.weather_context.et0_7d_mm}mm</span>
                        )}
                        {alert.weather_context.water_deficit_mm != null && (
                            <span>Deficit: {alert.weather_context.water_deficit_mm}mm</span>
                        )}
                        {alert.weather_context.soil_moisture_top != null && (
                            <span>Soil: {(alert.weather_context.soil_moisture_top * 100).toFixed(0)}%</span>
                        )}
                    </div>
                )}

                {/* Context links: field / farm */}
                {(fieldName || farmName) && (
                    <div className="flex items-center gap-3 mt-1.5">
                        {fieldName && farmId && (
                            <Link
                                href={`/farms/${farmId}/fields/${alert.field_id}`}
                                className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline font-medium"
                            >
                                {fieldName}
                                <ChevronRight className="h-3 w-3" />
                            </Link>
                        )}
                        {farmName && (
                            <span className="text-xs text-muted-foreground">
                                {farmName}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Action button */}
            {showActions && onToggleStatus && (
                <div className="shrink-0">
                    <Button
                        variant={isClosed ? "outline" : "secondary"}
                        size="sm"
                        className="h-7 text-xs"
                        disabled={togglingId === alert.id}
                        onClick={() => onToggleStatus(alert)}
                    >
                        {togglingId === alert.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isClosed ? (
                            <>
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                {actionLabels?.reopen ?? "Reopen"}
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                {actionLabels?.close ?? "Close"}
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Chevron hint when no actions (navigable rows) */}
            {!showActions && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
        </div>
    );
}
