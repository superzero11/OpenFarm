"use client";

import React, { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useOrg } from "@/components/org-context";
import { farmsApi, orgsApi, alertsApi } from "@/lib/api";
import type { Farm, OrgDetail, Alert } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Tractor,
    Map,
    Users,
    Plus,
    ChevronRight,
    Bell,
    ShieldAlert,
    AlertTriangle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CreateFarmModal } from "@/components/create-farm-modal";

export default function DashboardPage() {
    const t = useTranslations("dashboard");
    const { currentOrg, loading: orgLoading } = useOrg();
    const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
    const [farms, setFarms] = useState<Farm[]>([]);
    const [totalFields, setTotalFields] = useState(0);
    const [openAlerts, setOpenAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentOrg) return;

        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [detail, farmRes, alertRes] = await Promise.all([
                    orgsApi.get(currentOrg.id),
                    farmsApi.list(10, 0),
                    alertsApi.list({ status: "open", limit: 10 }),
                ]);
                if (cancelled) return;
                setOrgDetail(detail);
                setFarms(farmRes.items);
                setOpenAlerts(alertRes.items);

                // Fetch field counts per farm in parallel
                const fieldCounts = await Promise.all(
                    farmRes.items.map((f) => farmsApi.fields(f.id, 1, 0).then((r) => r.total).catch(() => 0)),
                );
                if (!cancelled) {
                    setTotalFields(fieldCounts.reduce((sum, c) => sum + c, 0));
                }
            } catch (err) {
                console.error("Dashboard load failed:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [currentOrg]);

    if (orgLoading || loading) {
        return (
            <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-5 space-y-3">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-8 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
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
                    {t("welcomeTo", { orgName: currentOrg?.name ?? "" })}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    icon={<Tractor className="h-5 w-5 text-primary" />}
                    label={t("farms")}
                    value={orgDetail?.farm_count ?? 0}
                />
                <StatCard
                    icon={<Map className="h-5 w-5 text-primary" />}
                    label={t("fields")}
                    value={totalFields}
                    sublabel={t("acrossAllFarms")}
                />
                <StatCard
                    icon={<Users className="h-5 w-5 text-primary" />}
                    label={t("members")}
                    value={orgDetail?.member_count ?? 0}
                />
                <StatCard
                    icon={<Bell className="h-5 w-5 text-primary" />}
                    label={t("openAlerts")}
                    value={openAlerts.length}
                    sublabel={t("requireAttention")}
                />
            </div>

            {/* Open Alerts */}
            {openAlerts.length > 0 && (
                <Card className="mb-8">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Bell className="h-5 w-5 text-primary" />
                            {t("recentAlerts")}
                        </CardTitle>
                        <Button variant="link" className="h-auto p-0 text-xs" asChild>
                            <Link href="/alerts">{t("viewAllAlerts")}</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {openAlerts.slice(0, 5).map((alert) => {
                                const sevIcon =
                                    alert.severity === "high" ? <ShieldAlert className="h-4 w-4 text-red-500" /> :
                                    alert.severity === "medium" ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
                                    <Bell className="h-4 w-4 text-yellow-500" />;
                                return (
                                    <div
                                        key={alert.id}
                                        className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/20 transition-colors"
                                    >
                                        <div className="shrink-0">{sevIcon}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{alert.message}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge
                                                    variant={alert.severity === "high" ? "destructive" : "secondary"}
                                                    className="text-[9px] px-1.5 py-0 uppercase tracking-wider"
                                                >
                                                    {alert.severity}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(alert.date).toLocaleDateString(undefined, {
                                                        month: "short", day: "numeric",
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Actions */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="text-lg">{t("quickActions")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <CreateFarmModal>
                            <button
                                type="button"
                                className="flex items-center gap-3 rounded-lg border p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left w-full"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                    <Plus className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{t("createFarm")}</p>
                                    <p className="text-xs text-muted-foreground">{t("addFarmDesc")}</p>
                                </div>
                            </button>
                        </CreateFarmModal>
                        <Link
                            href="/settings?tab=team"
                            className="flex items-center gap-3 rounded-lg border p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{t("inviteMembers")}</p>
                                <p className="text-xs text-muted-foreground">{t("inviteMembersDesc")}</p>
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Farms List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-lg">{t("yourFarms")}</CardTitle>
                    <CreateFarmModal>
                        <Button variant="link" className="h-auto p-0">
                            <Plus className="h-4 w-4" /> {t("newFarm")}
                        </Button>
                    </CreateFarmModal>
                </CardHeader>
                <CardContent>
                    {farms.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed p-12 text-center">
                            <Tractor className="mx-auto h-12 w-12 text-muted-foreground/40" />
                            <p className="mt-4 text-sm font-medium">{t("noFarmsYet")}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t("createFirstFarm")}
                            </p>
                            <CreateFarmModal>
                                <Button className="mt-4">
                                    <Plus className="h-4 w-4" />
                                    {t("createFarm")}
                                </Button>
                            </CreateFarmModal>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {farms.map((farm) => (
                                <Link
                                    key={farm.id}
                                    href={`/farms/${farm.id}`}
                                    className="flex items-center justify-between rounded-lg border p-4 hover:border-primary/30 hover:shadow-md transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
                                            <Tractor className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{farm.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {[farm.region, farm.country].filter(Boolean).join(", ") || t("noLocation")}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    sublabel,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    sublabel?: string;
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
                {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
            </CardContent>
        </Card>
    );
}
