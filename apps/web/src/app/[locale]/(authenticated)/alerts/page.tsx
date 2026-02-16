"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { useOrg } from "@/components/org-context";
import { alertsApi, farmsApi, fieldsApi } from "@/lib/api";
import type { Alert, Farm, Field } from "@/lib/api";
import { toast } from "sonner";
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    ChevronRight,
    Filter,
    Loader2,
    RotateCcw,
    ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/* ── Severity config ─────────────────────────────────────────── */

const SEVERITY_CONFIG: Record<string, {
    dotClass: string;
    bgClass: string;
    textClass: string;
    icon: React.ReactNode;
    label: string;
}> = {
    high: {
        dotClass: "bg-red-500",
        bgClass: "bg-red-500/8 border-red-500/20 hover:border-red-500/40",
        textClass: "text-red-700 dark:text-red-400",
        icon: <ShieldAlert className="h-4 w-4" />,
        label: "High",
    },
    medium: {
        dotClass: "bg-amber-500",
        bgClass: "bg-amber-500/8 border-amber-500/20 hover:border-amber-500/40",
        textClass: "text-amber-700 dark:text-amber-400",
        icon: <AlertTriangle className="h-4 w-4" />,
        label: "Medium",
    },
    low: {
        dotClass: "bg-yellow-500",
        bgClass: "bg-yellow-500/8 border-yellow-500/20 hover:border-yellow-500/40",
        textClass: "text-yellow-700 dark:text-yellow-400",
        icon: <Bell className="h-4 w-4" />,
        label: "Low",
    },
};

const RULE_LABELS: Record<string, string> = {
    ndvi_drop: "NDVI Drop",
    ndvi_threshold: "Low NDVI",
};

export default function AlertsPage() {
    const t = useTranslations("alertsPage");
    const { currentOrg, loading: orgLoading } = useOrg();

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>("open");
    const [severityFilter, setSeverityFilter] = useState<string>("all");

    // Field/Farm lookup maps
    const [fieldMap, setFieldMap] = useState<Record<string, Field>>({});
    const [farmMap, setFarmMap] = useState<Record<string, Farm>>({});

    const loadAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await alertsApi.list({
                status: statusFilter === "all" ? undefined : statusFilter,
                limit: 200,
            });
            setAlerts(res.items);
        } catch (err) {
            console.error("Failed to load alerts:", err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    // Load farms and fields for lookup
    const loadLookups = useCallback(async () => {
        try {
            const farmRes = await farmsApi.list(200, 0);
            const fMap: Record<string, Farm> = {};
            farmRes.items.forEach((f) => { fMap[f.id] = f; });
            setFarmMap(fMap);

            // Load fields per farm
            const allFields: Field[] = [];
            await Promise.all(
                farmRes.items.map(async (farm) => {
                    try {
                        const fieldRes = await farmsApi.fields(farm.id, 200, 0);
                        allFields.push(...fieldRes.items);
                    } catch { /* silent */ }
                }),
            );
            const fiMap: Record<string, Field> = {};
            allFields.forEach((f) => { fiMap[f.id] = f; });
            setFieldMap(fiMap);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        if (!currentOrg) return;
        loadLookups();
    }, [currentOrg, loadLookups]);

    useEffect(() => {
        if (!currentOrg) return;
        loadAlerts();
    }, [currentOrg, loadAlerts]);

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

    // Apply severity filter
    const filteredAlerts = severityFilter === "all"
        ? alerts
        : alerts.filter((a) => a.severity === severityFilter);

    // Group by severity for the summary
    const openCount = alerts.filter((a) => a.status === "open").length;
    const highCount = alerts.filter((a) => a.severity === "high" && a.status === "open").length;
    const mediumCount = alerts.filter((a) => a.severity === "medium" && a.status === "open").length;
    const lowCount = alerts.filter((a) => a.severity === "low" && a.status === "open").length;

    if (orgLoading || loading) {
        return (
            <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t("subtitle")}
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <SummaryCard
                    label={t("totalOpen")}
                    count={openCount}
                    icon={<Bell className="h-5 w-5 text-primary" />}
                    accent="primary"
                />
                <SummaryCard
                    label={t("high")}
                    count={highCount}
                    icon={<ShieldAlert className="h-5 w-5 text-red-500" />}
                    accent="red"
                />
                <SummaryCard
                    label={t("medium")}
                    count={mediumCount}
                    icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                    accent="amber"
                />
                <SummaryCard
                    label={t("low")}
                    count={lowCount}
                    icon={<Bell className="h-5 w-5 text-yellow-500" />}
                    accent="yellow"
                />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    {t("filters")}
                </div>
                <div className="flex gap-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("allStatuses")}</SelectItem>
                            <SelectItem value="open">{t("openOnly")}</SelectItem>
                            <SelectItem value="closed">{t("closedOnly")}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t("allSeverities")}</SelectItem>
                            <SelectItem value="high">{t("high")}</SelectItem>
                            <SelectItem value="medium">{t("medium")}</SelectItem>
                            <SelectItem value="low">{t("low")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                    {filteredAlerts.length} {t("alertsShown")}
                </div>
            </div>

            {/* Alert List */}
            {filteredAlerts.length === 0 ? (
                <Card className="border-2 border-dashed">
                    <CardContent className="p-12 text-center">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-primary/30" />
                        <p className="mt-4 text-sm font-medium">{t("noAlerts")}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t("noAlertsDesc")}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredAlerts.map((alert) => {
                        const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
                        const field = fieldMap[alert.field_id];
                        const farm = field ? farmMap[field.farm_id] : null;
                        const isClosed = alert.status === "closed";

                        return (
                            <Card
                                key={alert.id}
                                className={cn(
                                    "transition-all duration-200 border",
                                    isClosed ? "opacity-60 bg-muted/30" : severity.bgClass,
                                )}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        {/* Severity indicator */}
                                        <div className={cn(
                                            "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                            isClosed ? "bg-muted" : `${severity.dotClass}/15`,
                                        )}>
                                            <span className={cn(isClosed ? "text-muted-foreground" : severity.textClass)}>
                                                {severity.icon}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge
                                                    variant={alert.severity === "high" && !isClosed ? "destructive" : "secondary"}
                                                    className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-semibold"
                                                >
                                                    {alert.severity}
                                                </Badge>
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    {RULE_LABELS[alert.rule_name] || alert.rule_name}
                                                </span>
                                                {isClosed && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground"
                                                    >
                                                        {t("closed")}
                                                    </Badge>
                                                )}
                                                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                                    {new Date(alert.date).toLocaleDateString(undefined, {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    })}
                                                </span>
                                            </div>

                                            <p className="text-sm mt-1.5 leading-relaxed text-foreground/90">
                                                {alert.message}
                                            </p>

                                            {/* Context: field + farm */}
                                            <div className="flex items-center gap-3 mt-2">
                                                {field && (
                                                    <Link
                                                        href={`/farms/${field.farm_id}/fields/${field.id}`}
                                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                                    >
                                                        {field.name}
                                                        <ChevronRight className="h-3 w-3" />
                                                    </Link>
                                                )}
                                                {farm && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {farm.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <div className="shrink-0">
                                            <Button
                                                variant={isClosed ? "outline" : "secondary"}
                                                size="sm"
                                                className="h-8 text-xs"
                                                disabled={togglingId === alert.id}
                                                onClick={() => toggleStatus(alert)}
                                            >
                                                {togglingId === alert.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : isClosed ? (
                                                    <><RotateCcw className="h-3.5 w-3.5 mr-1.5" />{t("reopen")}</>
                                                ) : (
                                                    <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{t("close")}</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ── Summary Card ─────────────────────────────────────────── */

function SummaryCard({
    label,
    count,
    icon,
    accent,
}: {
    label: string;
    count: number;
    icon: React.ReactNode;
    accent: string;
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight">{count}</p>
            </CardContent>
        </Card>
    );
}
