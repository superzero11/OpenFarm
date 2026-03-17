"use client";

import React from "react";
import type { WeatherSummary } from "@/lib/api";
import { useTranslations } from "next-intl";

interface WeatherCardsProps {
    summary: WeatherSummary;
}

export default function WeatherCards({ summary }: WeatherCardsProps) {
    const t = useTranslations("weather");

    const cards = [
        {
            label: t("avgTemp"),
            value: summary.avg_temperature != null ? `${summary.avg_temperature.toFixed(1)}°C` : "—",
            sub:
                summary.min_temperature != null && summary.max_temperature != null
                    ? `${summary.min_temperature.toFixed(1)}° – ${summary.max_temperature.toFixed(1)}°`
                    : undefined,
            color: "text-orange-600 dark:text-orange-400",
        },
        {
            label: t("totalPrecip"),
            value: summary.total_precipitation != null ? `${summary.total_precipitation.toFixed(1)} mm` : "—",
            color: "text-blue-600 dark:text-blue-400",
        },
        {
            label: t("waterDeficit"),
            value: summary.water_deficit_mm != null ? `${summary.water_deficit_mm.toFixed(1)} mm` : "—",
            color:
                summary.water_deficit_mm != null && summary.water_deficit_mm < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400",
        },
        {
            label: t("gddCumulative"),
            value: summary.gdd_cumulative != null ? `${summary.gdd_cumulative.toFixed(0)}` : "—",
            color: "text-amber-600 dark:text-amber-400",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-2">
            {cards.map((c) => (
                <div
                    key={c.label}
                    className="rounded-lg border bg-card p-2.5 shadow-sm"
                >
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        {c.label}
                    </p>
                    <p className={`text-lg font-bold leading-tight mt-0.5 ${c.color}`}>
                        {c.value}
                    </p>
                    {c.sub && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
                    )}
                </div>
            ))}
        </div>
    );
}
