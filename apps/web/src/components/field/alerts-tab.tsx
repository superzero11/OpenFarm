"use client";

import React, { useState, useCallback, useEffect } from "react";
import { alertsApi, type Alert } from "@/lib/api";
import { toast } from "sonner";
import {
    CheckCircle2,
    Eye,
    EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { AlertRow } from "@/components/alert-row";

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
                        className="px-2 text-xs"
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
            <div className="space-y-2">
                {visibleAlerts.map((alert) => (
                    <AlertRow
                        key={alert.id}
                        alert={alert}
                        compact
                        showActions
                        onToggleStatus={toggleStatus}
                        togglingId={togglingId}
                        actionLabels={{ close: t("close"), reopen: t("reopen") }}
                    />
                ))}
            </div>
        </div>
    );
}
