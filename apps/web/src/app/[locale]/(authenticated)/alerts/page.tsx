"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/components/org-context";
import { alertsApi, farmsApi } from "@/lib/api";
import type { Alert, Farm, Field } from "@/lib/api";
import { toast } from "sonner";
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { AlertRow } from "@/components/alert-row";

/* ── (severity config and rule labels moved to alert-row.tsx) ─── */

const SEVERITY_TABS = ["all", "high", "medium", "low"] as const;

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
                <p className="mt-1 text-[13px] text-muted-foreground">
                    {t("subtitle")}
                </p>
            </div>

            {/* Summary. Icon and count both read from the severity tokens,
                so the summary cannot drift from the rows below it. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <SummaryCard
                    label={t("totalOpen")}
                    count={openCount}
                    icon={<Bell className="h-5 w-5 text-primary" />}
                />
                <SummaryCard
                    label={t("high")}
                    count={highCount}
                    icon={<ShieldAlert className="h-5 w-5 text-sev-high" />}
                    countClass="text-sev-high"
                />
                <SummaryCard
                    label={t("medium")}
                    count={mediumCount}
                    icon={<AlertTriangle className="h-5 w-5 text-sev-medium" />}
                    countClass="text-sev-medium"
                />
                <SummaryCard
                    label={t("low")}
                    count={lowCount}
                    icon={<Bell className="h-5 w-5 text-sev-low" />}
                    countClass="text-sev-low"
                />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                {/* Severity as a segmented control: four mutually exclusive
                    options are cheaper to read than a closed dropdown. */}
                <div className="flex flex-wrap gap-0.5 rounded-lg bg-surface-2 p-1">
                    {SEVERITY_TABS.map((sev) => (
                        <button
                            key={sev}
                            type="button"
                            onClick={() => setSeverityFilter(sev)}
                            aria-pressed={severityFilter === sev}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                severityFilter === sev
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {sev === "all" ? t("severityAll") : t(sev)}
                        </button>
                    ))}
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t("allStatuses")}</SelectItem>
                        <SelectItem value="open">{t("openOnly")}</SelectItem>
                        <SelectItem value="closed">{t("closedOnly")}</SelectItem>
                    </SelectContent>
                </Select>

                {/* A filtered list with no total is a trap: the user reads
                    four alerts and thinks that is all of them. */}
                <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {t("showingCount", { shown: filteredAlerts.length, total: alerts.length })}
                </span>
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
                <div className="flex flex-col gap-2">
                    {filteredAlerts.map((alert) => {
                        const field = fieldMap[alert.field_id];
                        const farm = field ? farmMap[field.farm_id] : null;

                        return (
                            <AlertRow
                                key={alert.id}
                                alert={alert}
                                fieldName={field?.name}
                                farmId={field?.farm_id}
                                farmName={farm?.name}
                                showActions
                                onToggleStatus={toggleStatus}
                                togglingId={togglingId}
                                actionLabels={{ close: t("close"), reopen: t("reopen") }}
                                closedLabel={t("closed")}
                            />
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
    countClass,
}: {
    label: string;
    count: number;
    icon: React.ReactNode;
    /** Severity colour for the metric, matched to the icon. */
    countClass?: string;
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-start gap-3">
                    {icon}
                    <span className="text-sm leading-snug text-muted-foreground">{label}</span>
                </div>
                <p className={cn("mt-3 text-2xl font-bold tracking-tight tabular-nums", countClass)}>
                    {count}
                </p>
            </CardContent>
        </Card>
    );
}
