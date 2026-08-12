"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useOrg } from "@/components/org-context";
import { alertsApi, farmsApi } from "@/lib/api";
import type { Alert, AlertSummary, Farm, Field } from "@/lib/api";
import { toast } from "sonner";
import {
    AlertTriangle,
    Bell,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

/** Rows per page. The API caps a single request at 200. */
const PAGE_SIZE = 25;

export default function AlertsPage() {
    const t = useTranslations("alertsPage");
    const { currentOrg, loading: orgLoading } = useOrg();

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState<AlertSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // Filters. Both are applied server-side now: severity used to be a
    // client-side filter over a capped fetch, which is why the page could
    // only ever see the first 200 alerts.
    const [statusFilter, setStatusFilter] = useState<string>("open");
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [page, setPage] = useState(0);

    // Field/Farm lookup maps
    const [fieldMap, setFieldMap] = useState<Record<string, Field>>({});
    const [farmMap, setFarmMap] = useState<Record<string, Farm>>({});

    const loadAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await alertsApi.list({
                status: statusFilter === "all" ? undefined : statusFilter,
                severity: severityFilter === "all" ? undefined : severityFilter,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setAlerts(res.items);
            setTotal(res.total);
        } catch (err) {
            console.error("Failed to load alerts:", err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, severityFilter, page]);

    /** Counts come from the server so they describe the workspace, not
     *  whatever page of rows the client is holding. */
    const loadSummary = useCallback(async () => {
        try {
            setSummary(await alertsApi.summary());
        } catch {
            setSummary(null);
        }
    }, []);

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

    useEffect(() => {
        if (!currentOrg) return;
        loadSummary();
    }, [currentOrg, loadSummary]);

    // A filter change invalidates the current offset: page 8 of "all"
    // is not page 8 of "high".
    useEffect(() => {
        setPage(0);
    }, [statusFilter, severityFilter]);

    const toggleStatus = async (alert: Alert) => {
        const newStatus = alert.status === "open" ? "closed" : "open";
        setTogglingId(alert.id);
        try {
            const updated = await alertsApi.update(alert.id, { status: newStatus });
            setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            toast.success(
                newStatus === "closed" ? t("alertClosed") : t("alertReopened"),
            );
            // The row may no longer belong on this page, and the open
            // counts have certainly changed.
            loadSummary();
            if (statusFilter !== "all") loadAlerts();
        } catch (err: any) {
            toast.error(err.detail || t("failedUpdate"));
        } finally {
            setTogglingId(null);
        }
    };

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const rangeFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
    const rangeTo = Math.min(total, (page + 1) * PAGE_SIZE);

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
                    count={summary?.open_total ?? 0}
                    icon={<Bell className="h-5 w-5 text-primary" />}
                />
                <SummaryCard
                    label={t("high")}
                    count={summary?.high ?? 0}
                    icon={<ShieldAlert className="h-5 w-5 text-sev-high" />}
                    countClass="text-sev-high"
                />
                <SummaryCard
                    label={t("medium")}
                    count={summary?.medium ?? 0}
                    icon={<AlertTriangle className="h-5 w-5 text-sev-medium" />}
                    countClass="text-sev-medium"
                />
                <SummaryCard
                    label={t("low")}
                    count={summary?.low ?? 0}
                    icon={<Bell className="h-5 w-5 text-sev-low" />}
                    countClass="text-sev-low"
                />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                {/* Severity as a segmented control: four mutually exclusive
                    options are cheaper to read than a closed dropdown. */}
                {/* bg-muted, not bg-surface-2: the page wash is already
                    surface-2, so the track was the exact same colour as the
                    page behind it and the group read as loose text. */}
                <div
                    role="group"
                    aria-label={t("filters")}
                    className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-muted p-1"
                >
                    {SEVERITY_TABS.map((sev) => (
                        <button
                            key={sev}
                            type="button"
                            onClick={() => setSeverityFilter(sev)}
                            aria-pressed={severityFilter === sev}
                            className={cn(
                                "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                severityFilter === sev
                                    ? "bg-primary text-primary-foreground shadow-sm"
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
                    {t("showingRange", { from: rangeFrom, to: rangeTo, total })}
                </span>
            </div>

            {/* Alert List */}
            {alerts.length === 0 ? (
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
                    {alerts.map((alert) => {
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

            {/* Page controls. Shown whenever there is more than one page,
                so the list never silently ends at a boundary. */}
            {pageCount > 1 && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {t("pageOf", { page: page + 1, pages: pageCount })}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 0 || loading}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            {t("previousPage")}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page + 1 >= pageCount || loading}
                            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        >
                            {t("nextPage")}
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
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
