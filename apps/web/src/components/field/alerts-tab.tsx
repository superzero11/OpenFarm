"use client";

import React, { useState, useCallback, useEffect } from "react";
import { alertsApi, type Alert } from "@/lib/api";
import { toast } from "sonner";
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    Loader2,
    RotateCcw,
    ShieldAlert,
    Eye,
    EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/* ── Human-readable rule names ───────────────────────────────── */

const RULE_LABELS: Record<string, string> = {
    ndvi_drop: "NDVI Drop",
    ndvi_threshold: "Low NDVI",
};

/* ── Severity config ─────────────────────────────────────────── */

const SEVERITY_CONFIG: Record<string, { class: string; icon: React.ReactNode }> = {
    high: {
        class: "bg-destructive/10 text-destructive border-destructive/20",
        icon: <ShieldAlert className="h-4 w-4 text-destructive" />,
    },
    medium: {
        class: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    },
    low: {
        class: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
        icon: <Bell className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />,
    },
};

/* ── Props ────────────────────────────────────────────────────── */

interface AlertsTabProps {
    fieldId: string;
    /** Called with the count of open alerts (for badge). */
    onOpenCountChange?: (count: number) => void;
}

export default function AlertsTab({ fieldId, onOpenCountChange }: AlertsTabProps) {
    const t = useTranslations("alertsTab");
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [showClosed, setShowClosed] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const loadAlerts = useCallback(async () => {
        try {
            const res = await alertsApi.listForField(fieldId, 200);
            setAlerts(res.items);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [fieldId]);

    useEffect(() => {
        loadAlerts();
    }, [loadAlerts]);

    // Report open count to parent for badge
    useEffect(() => {
        const openCount = alerts.filter((a) => a.status === "open").length;
        onOpenCountChange?.(openCount);
    }, [alerts, onOpenCountChange]);

    const toggleStatus = async (alert: Alert) => {
        const newStatus = alert.status === "open" ? "closed" : "open";
        setTogglingId(alert.id);
        try {
            const updated = await alertsApi.update(alert.id, { status: newStatus });
            setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            toast.success(
                newStatus === "closed" ? t("alertClosed") : t("alertReopened"),
            );
        } catch (err: any) {
            toast.error(err.detail || t("failedUpdate"));
        } finally {
            setTogglingId(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    const openAlerts = alerts.filter((a) => a.status === "open");
    const closedAlerts = alerts.filter((a) => a.status === "closed");
    const visibleAlerts = showClosed ? alerts : openAlerts;

    if (alerts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-12">
                <CheckCircle2 className="h-8 w-8 text-primary/40 mb-2" />
                <p className="text-sm font-medium">{t("noAlerts")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                    {t("noAlertsDesc")}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Summary + filter */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{openAlerts.length}</span>{" "}
                    {t("open")}
                    {closedAlerts.length > 0 && (
                        <span className="ml-1">
                            · {closedAlerts.length} {t("closed")}
                        </span>
                    )}
                </p>
                {closedAlerts.length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowClosed(!showClosed)}
                        className="h-6 px-2 text-[10px]"
                    >
                        {showClosed ? (
                            <><EyeOff className="h-3 w-3 mr-1" />{t("hideClosed")}</>
                        ) : (
                            <><Eye className="h-3 w-3 mr-1" />{t("showClosed")}</>
                        )}
                    </Button>
                )}
            </div>

            {/* Alert list */}
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                {visibleAlerts.map((alert) => {
                    const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
                    const isClosed = alert.status === "closed";

                    return (
                        <Card
                            key={alert.id}
                            className={cn(
                                "border transition-opacity",
                                severity.class,
                                isClosed && "opacity-50",
                            )}
                        >
                            <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                    <div className="mt-0.5 shrink-0">{severity.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge
                                                variant={alert.severity === "high" ? "destructive" : "secondary"}
                                                className="text-[10px] px-1.5 py-0"
                                            >
                                                {alert.severity}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground">
                                                {RULE_LABELS[alert.rule_name] || alert.rule_name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground ml-auto">
                                                {alert.date}
                                            </span>
                                        </div>
                                        <p className="text-xs mt-1 leading-relaxed">
                                            {alert.message}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[10px] px-1.5 py-0",
                                                    isClosed
                                                        ? "border-muted-foreground/30 text-muted-foreground"
                                                        : "border-primary/30 text-primary",
                                                )}
                                            >
                                                {isClosed ? t("closed") : t("open")}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[10px]"
                                                disabled={togglingId === alert.id}
                                                onClick={() => toggleStatus(alert)}
                                            >
                                                {togglingId === alert.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : isClosed ? (
                                                    <><RotateCcw className="h-3 w-3 mr-1" />{t("reopen")}</>
                                                ) : (
                                                    <><CheckCircle2 className="h-3 w-3 mr-1" />{t("close")}</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
