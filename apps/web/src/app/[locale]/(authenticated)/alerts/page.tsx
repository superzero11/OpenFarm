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
    Filter,
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
import { AlertRow } from "@/components/alert-row";

/* ── (severity config and rule labels moved to alert-row.tsx) ─── */

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
                    icon={<ShieldAlert className="h-5 w-5 text-sev-high" />}
                    accent="sev-high"
                />
                <SummaryCard
                    label={t("medium")}
                    count={mediumCount}
                    icon={<AlertTriangle className="h-5 w-5 text-sev-medium" />}
                    accent="sev-medium"
                />
                <SummaryCard
                    label={t("low")}
                    count={lowCount}
                    icon={<Bell className="h-5 w-5 text-sev-low" />}
                    accent="sev-low"
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
                <div className="ml-auto text-sm text-muted-foreground tabular-nums">
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
                <div className="space-y-2">
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
                <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{count}</p>
            </CardContent>
        </Card>
    );
}
