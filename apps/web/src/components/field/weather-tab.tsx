"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { weatherApi } from "@/lib/api";
import type { WeatherDaily, WeatherForecastDay, WeatherSummary } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import ForecastBar from "@/components/field/forecast-bar";
import WeatherChart from "@/components/charts/weather-chart";
import WaterBalanceChart from "@/components/charts/water-balance-chart";
import SoilMoistureGauge from "@/components/field/soil-moisture-gauge";

type RangeOption = "30d" | "90d" | "season";

function getDateRange(range: RangeOption): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    switch (range) {
        case "30d":
            start.setDate(end.getDate() - 30);
            break;
        case "90d":
            start.setDate(end.getDate() - 90);
            break;
        case "season":
            start.setDate(end.getDate() - 180);
            break;
    }
    return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
    };
}

interface WeatherTabProps {
    fieldId: string;
}

export default function WeatherTab({ fieldId }: WeatherTabProps) {
    const t = useTranslations("weather");

    const [range, setRange] = useState<RangeOption>("30d");
    const [loading, setLoading] = useState(true);
    const [backfilling, setBackfilling] = useState(false);
    const [data, setData] = useState<WeatherDaily[]>([]);
    const [forecast, setForecast] = useState<WeatherForecastDay[]>([]);
    const [summary, setSummary] = useState<WeatherSummary | null>(null);

    const rangeOptions: { value: RangeOption; label: string }[] = useMemo(
        () => [
            { value: "30d", label: t("range30d") },
            { value: "90d", label: t("range90d") },
            { value: "season", label: t("rangeSeason") },
        ],
        [t],
    );

    const loadWeather = useCallback(async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange(range);
            const res = await weatherApi.get(fieldId, start, end, true);
            setData(res.data);
            setForecast(res.forecast);
            setSummary(res.summary);
        } catch {
            // silent - empty state shown
        } finally {
            setLoading(false);
        }
    }, [fieldId, range]);

    useEffect(() => {
        loadWeather();
    }, [loadWeather]);

    const handleBackfill = async () => {
        setBackfilling(true);
        try {
            await weatherApi.backfill(fieldId, 90);
            toast.success(t("backfillStarted"));
        } catch {
            toast.error(t("backfillFailed"));
        } finally {
            setBackfilling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (data.length === 0 && forecast.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <CloudOff className="h-8 w-8 text-muted-foreground/50" />
                <div>
                    <p className="text-sm font-medium">{t("noWeatherData")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("noWeatherDataDesc")}</p>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBackfill}
                    disabled={backfilling}
                >
                    {backfilling ? (
                        <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    )}
                    {t("fetchWeather")}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Range selector */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 rounded-lg border bg-muted/50 p-0.5">
                    {rangeOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRange(opt.value)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${range === opt.value
                                ? "bg-background shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={data.length === 0 ? async () => { await handleBackfill(); setTimeout(loadWeather, 5000); } : loadWeather}
                    disabled={backfilling}
                    title={data.length === 0 ? t("fetchWeather") : t("refresh")}
                >
                    {backfilling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                    )}
                </Button>
            </div>

            {/* Unified weather stats grid */}
            {summary && (() => {
                const latest = data.length > 0 ? data[data.length - 1] : null;
                const vpd = latest?.vapor_pressure_deficit;
                const vpdZone = vpd != null ? (vpd < 0.4 ? "low" : vpd < 0.8 ? "ideal" : vpd < 1.2 ? "moderate" : "high") : null;
                const vpdColor = vpdZone ? {
                    low: "text-blue-600 dark:text-blue-400",
                    ideal: "text-green-600 dark:text-green-400",
                    moderate: "text-yellow-600 dark:text-yellow-400",
                    high: "text-red-600 dark:text-red-400",
                }[vpdZone] : "";

                return (
                    <div className="grid grid-cols-4 gap-2">
                        {/* Row 1: Temp (2 cols) + Precip (2 cols) */}
                        <div className="col-span-2 rounded-lg border bg-card p-2.5 shadow-sm">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("avgTemp")}</p>
                            <p className="text-lg font-bold leading-tight mt-0.5 text-orange-600 dark:text-orange-400">
                                {summary.avg_temperature != null ? `${summary.avg_temperature.toFixed(1)}°C` : "-"}
                            </p>
                            {summary.min_temperature != null && summary.max_temperature != null && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{summary.min_temperature.toFixed(1)}° – {summary.max_temperature.toFixed(1)}°</p>
                            )}
                        </div>
                        <div className="col-span-2 rounded-lg border bg-card p-2.5 shadow-sm">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("totalPrecip")}</p>
                            <p className="text-lg font-bold leading-tight mt-0.5 text-blue-600 dark:text-blue-400">
                                {summary.total_precipitation != null ? `${summary.total_precipitation.toFixed(1)} mm` : "-"}
                            </p>
                        </div>

                        {/* Row 2: Water Deficit + GDD + Soil Moisture + Frost/Heat */}
                        <div className="col-span-2 rounded-lg border bg-card p-2.5 shadow-sm">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("waterDeficit")}</p>
                            <p className={`text-lg font-bold leading-tight mt-0.5 ${summary.water_deficit_mm != null && summary.water_deficit_mm < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {summary.water_deficit_mm != null ? `${summary.water_deficit_mm.toFixed(1)} mm` : "-"}
                            </p>
                        </div>
                        <div className="col-span-1 rounded-lg border bg-card p-2.5 shadow-sm">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("gddCumulative")}</p>
                            <p className="text-lg font-bold leading-tight mt-0.5 text-amber-600 dark:text-amber-400">
                                {summary.gdd_cumulative != null ? `${summary.gdd_cumulative.toFixed(0)}` : "-"}
                            </p>
                        </div>
                        <div className="col-span-1 rounded-lg border bg-card p-2.5 shadow-sm">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("soilMoisture")}</p>
                            <p className="text-lg font-bold leading-tight mt-0.5 text-cyan-600 dark:text-cyan-400">
                                {summary.avg_soil_moisture_top != null ? `${(summary.avg_soil_moisture_top * 100).toFixed(0)}%` : "-"}
                            </p>
                        </div>

                        {/* Row 3: VPD (3 cols) + Frost + Heat */}
                        {vpd != null && vpdZone && (
                            <div className="col-span-2 rounded-lg border bg-card p-2.5 shadow-sm">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">VPD</p>
                                <p className={`text-lg font-bold leading-tight mt-0.5 ${vpdColor}`}>{vpd.toFixed(2)} kPa</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{t(`vpd${vpdZone.charAt(0).toUpperCase() + vpdZone.slice(1)}`)}</p>
                            </div>
                        )}
                        <div className="col-span-1 rounded-lg border bg-card p-2.5 shadow-sm">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("frostDays")}</p>
                            <p className="text-lg font-bold leading-tight mt-0.5 text-blue-600 dark:text-blue-400">
                                {summary.frost_days}
                            </p>
                        </div>
                        <div className="col-span-1 rounded-lg border bg-card p-2.5 shadow-sm">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("heatStressDays")}</p>
                            <p className="text-lg font-bold leading-tight mt-0.5 text-red-600 dark:text-red-400">
                                {summary.heat_stress_days}
                            </p>
                        </div>
                    </div>
                );
            })()}

            {/* 7-day forecast */}
            {forecast.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {t("forecast7d")}
                    </h4>
                    <ForecastBar forecast={forecast} />
                </div>
            )}

            {/* Temperature & Precipitation chart - in card */}
            <div className="rounded-lg border bg-card p-3 shadow-sm">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t("tempAndPrecip")}
                </h4>
                <WeatherChart data={data} height={200} />
            </div>

            {/* ET₀ & Water Balance chart - in card */}
            <div className="rounded-lg border bg-card p-3 shadow-sm">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t("waterBalanceTitle")}
                </h4>
                <WaterBalanceChart data={data} height={180} />
            </div>

            {/* Soil Moisture by Depth - in card */}
            {data.length > 0 && data[data.length - 1].soil_moisture_0_1cm != null && (
                <div className="rounded-lg border bg-card p-3 shadow-sm">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {t("soilMoistureDepth")}
                    </h4>
                    <SoilMoistureGauge data={data[data.length - 1]} />
                </div>
            )}

            {/* Soil Temperature by Depth - in card */}
            {data.length > 0 && data[data.length - 1].soil_temperature_0cm != null && (
                <div className="rounded-lg border bg-card p-3 shadow-sm">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {t("soilTempDepth")}
                    </h4>
                    <div className="space-y-1.5">
                        {([
                            { key: "soil_temperature_0cm" as const, label: t("soilTempSurface") },
                            { key: "soil_temperature_6cm" as const, label: t("soilTemp6cm") },
                            { key: "soil_temperature_18cm" as const, label: t("soilTemp18cm") },
                            { key: "soil_temperature_54cm" as const, label: t("soilTemp54cm") },
                        ] as const).map(({ key, label }) => {
                            const val = data[data.length - 1][key];
                            if (val == null) return null;
                            return (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">
                                        {label}
                                    </span>
                                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden relative">
                                        <div
                                            className={`h-full rounded-full transition-all ${val > 30 ? "bg-red-500" : val > 20 ? "bg-orange-400" : val > 10 ? "bg-yellow-400" : val > 0 ? "bg-blue-400" : "bg-blue-600"
                                                }`}
                                            style={{ width: `${Math.min(Math.max(((val + 10) / 50) * 100, 5), 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-semibold w-12 shrink-0 text-right">
                                        {val.toFixed(1)}°C
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
