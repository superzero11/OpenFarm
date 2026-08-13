"use client";

import React, { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useOrg } from "@/components/org-context";
import { farmsApi, orgsApi, alertsApi } from "@/lib/api";
import type { Farm, OrgDetail, Alert, Field } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Tractor,
    Map,
    Users,
    Plus,
    ChevronRight,
    Bell,
    CheckCircle2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CreateFarmModal } from "@/components/create-farm-modal";
import { AlertRow } from "@/components/alert-row";
import { cn } from "@/lib/utils";

/** How many alert rows the panel shows before deferring to the alerts page. */
const ALERT_PREVIEW = 4;

/** Farm rows shown before deferring to the farms page. Four fills the
 *  column against the four alerts on the right; three left a row's worth
 *  of dead space inside the card. */
const FARM_PREVIEW = 4;

/** Field count and total area per farm, so a row carries its own numbers. */
interface FarmStats {
    fieldCount: number;
    areaHa: number;
}

export default function DashboardPage() {
    const t = useTranslations("dashboard");
    const { currentOrg, loading: orgLoading } = useOrg();
    const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
    const [farms, setFarms] = useState<Farm[]>([]);
    const [farmStats, setFarmStats] = useState<Record<string, FarmStats>>({});
    const [openAlerts, setOpenAlerts] = useState<Alert[]>([]);
    const [openAlertTotal, setOpenAlertTotal] = useState(0);
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
                // The list is capped at 10 rows; the metric must count them all.
                setOpenAlertTotal(alertRes.total);

                // One request per farm, for the count and the hectares each
                // row carries. The alert rows below get their field and farm
                // names from the API now, so nothing else needs this.
                const perFarm = await Promise.all(
                    farmRes.items.map(async (f) => {
                        try {
                            const r = await farmsApi.fields(f.id, 200, 0);
                            return { farm: f, total: r.total, items: r.items };
                        } catch {
                            return { farm: f, total: 0, items: [] as Field[] };
                        }
                    }),
                );
                if (cancelled) return;

                const stats: Record<string, FarmStats> = {};
                for (const { farm, total, items } of perFarm) {
                    stats[farm.id] = {
                        fieldCount: total,
                        areaHa: items.reduce((sum, f) => sum + (f.area_ha ?? 0), 0),
                    };
                }
                setFarmStats(stats);
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
            <div className="p-6 lg:p-8 max-w-6xl mx-auto">
                <div className="mb-8 space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-[108px] w-full rounded-lg" />
                    ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <div className="flex flex-col gap-4">
                        <Skeleton className="h-[268px] w-full rounded-lg" />
                        <Skeleton className="h-[164px] w-full rounded-lg" />
                    </div>
                    <Skeleton className="h-[448px] w-full rounded-lg" />
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
                    {t("welcomeTo", { orgName: currentOrg?.name ?? "" })}
                </p>
            </div>

            {/* Stats. Open alerts is the only tinted metric - one coloured
                number in a row of neutral ones is what makes it read first. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    icon={<Tractor className="h-5 w-5 text-primary" />}
                    label={t("farms")}
                    value={orgDetail?.farm_count ?? 0}
                />
                <StatCard
                    icon={<Map className="h-5 w-5 text-primary" />}
                    label={t("fields")}
                    value={orgDetail?.field_count ?? 0}
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
                    value={openAlertTotal}
                    sublabel={t("requireAttention")}
                    tone={openAlertTotal > 0 ? "danger" : "default"}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                {/* ── Left column ─────────────────────────────────── */}
                <div className="flex flex-col gap-4">
                    {/* Farms. flex-1 lets this card take up the slack so the
                        column ends level with the alerts panel beside it,
                        whatever the farm and alert counts happen to be. */}
                    <Card className="flex flex-col lg:flex-1">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle>{t("yourFarms")}</CardTitle>
                            <CreateFarmModal>
                                <Button variant="link" className="h-auto p-0">
                                    <Plus className="h-4 w-4" /> {t("newFarm")}
                                </Button>
                            </CreateFarmModal>
                        </CardHeader>
                        <CardContent className="flex-1">
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
                                <div className="flex flex-col gap-2">
                                    {farms.slice(0, FARM_PREVIEW).map((farm) => (
                                        <FarmRow
                                            key={farm.id}
                                            farm={farm}
                                            stats={farmStats[farm.id]}
                                            noLocationLabel={t("noLocation")}
                                            fieldCountLabel={(count) => t("fieldCount", { count })}
                                        />
                                    ))}
                                    {(orgDetail?.farm_count ?? 0) > FARM_PREVIEW && (
                                        <Link
                                            href="/farms"
                                            className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80"
                                        >
                                            {t("viewAllFarms")}
                                            <ChevronRight className="h-4 w-4" />
                                        </Link>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick actions sit below the farms they act on, so a
                        returning user is not stepping over them daily. */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("quickActions")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <CreateFarmModal>
                                    <button
                                        type="button"
                                        className="flex items-center gap-3 rounded-lg border p-4 hover:border-primary/30 hover:bg-primary-subtle transition-colors text-left w-full"
                                    >
                                        <IconWell><Plus className="h-5 w-5 text-primary" /></IconWell>
                                        <div>
                                            <p className="text-sm font-medium">{t("createFarm")}</p>
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">{t("addFarmDesc")}</p>
                                        </div>
                                    </button>
                                </CreateFarmModal>
                                <Link
                                    href="/settings?tab=team"
                                    className="flex items-center gap-3 rounded-lg border p-4 hover:border-primary/30 hover:bg-primary-subtle transition-colors"
                                >
                                    <IconWell><Users className="h-5 w-5 text-primary" /></IconWell>
                                    <div>
                                        <p className="text-sm font-medium">{t("inviteMembers")}</p>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">{t("inviteMembersDesc")}</p>
                                    </div>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Right column: the one thing a farm manager opens
                       the app to see. ─────────────────────────────── */}
                <Card className="flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <CardTitle>{t("openAlerts")}</CardTitle>
                        {openAlertTotal > 0 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                                {openAlertTotal}
                            </span>
                        )}
                    </CardHeader>
                    <CardContent className="flex-1">
                        {openAlerts.length === 0 ? (
                            <div className="py-10 text-center">
                                <CheckCircle2 className="mx-auto h-5 w-5 text-success" />
                                <p className="mt-3 text-sm font-medium">{t("noOpenAlerts")}</p>
                                <p className="mt-1 text-[13px] text-muted-foreground">
                                    {t("noOpenAlertsDesc")}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {openAlerts.slice(0, ALERT_PREVIEW).map((alert) => (
                                    <AlertRow
                                        key={alert.id}
                                        alert={alert}
                                        fieldName={alert.field_name ?? undefined}
                                        farmId={alert.farm_id ?? undefined}
                                        farmName={alert.farm_name ?? undefined}
                                    />
                                ))}
                                {openAlertTotal > ALERT_PREVIEW && (
                                    <Link
                                        href="/alerts"
                                        className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80"
                                    >
                                        {t("viewAllAlerts")}
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

/* ── Pieces ───────────────────────────────────────────────── */

/** 40px tinted square that carries a 20px icon. */
function IconWell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle">
            {children}
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    sublabel,
    tone = "default",
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    sublabel?: string;
    tone?: "default" | "danger";
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-center gap-3">
                    {icon}
                    <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <p
                    className={cn(
                        "mt-3 text-2xl font-bold tracking-tight tabular-nums",
                        tone === "danger" && "text-danger",
                    )}
                >
                    {value}
                </p>
                {sublabel && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{sublabel}</p>
                )}
            </CardContent>
        </Card>
    );
}

/** A farm row that shows only a name wastes the row: it carries its
 *  region, its field count and its area, measured values in mono. */
function FarmRow({
    farm,
    stats,
    noLocationLabel,
    fieldCountLabel,
}: {
    farm: Farm;
    stats?: FarmStats;
    noLocationLabel: string;
    fieldCountLabel: (count: number) => string;
}) {
    const location = [farm.region, farm.country].filter(Boolean).join(", ");

    return (
        <Link
            href={`/farms/${farm.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border p-4 hover:border-primary/30 hover:shadow-md transition-all"
        >
            <div className="flex min-w-0 items-center gap-3">
                <IconWell><Tractor className="h-5 w-5 text-primary" /></IconWell>
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{farm.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {location || noLocationLabel}
                        {stats && (
                            <>
                                {" · "}
                                {fieldCountLabel(stats.fieldCount)}
                                {stats.areaHa > 0 && (
                                    <>
                                        {" · "}
                                        <span className="font-mono tabular-nums">
                                            {stats.areaHa.toFixed(2)} ha
                                        </span>
                                    </>
                                )}
                            </>
                        )}
                    </p>
                </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
    );
}
