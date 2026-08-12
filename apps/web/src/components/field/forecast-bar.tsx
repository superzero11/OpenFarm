"use client";

import React from "react";
import type { WeatherForecastDay } from "@/lib/api";
import { useTranslations } from "next-intl";
import {
    Cloud,
    CloudRain,
    Sun,
    Wind,
} from "lucide-react";

interface ForecastBarProps {
    forecast: WeatherForecastDay[];
}

function weatherIcon(precip: number | null, cloud: number | null) {
    if (precip != null && precip > 1) return <CloudRain className="h-4 w-4 text-sig-precip" />;
    if (cloud != null && cloud > 60) return <Cloud className="h-4 w-4 text-muted-foreground" />;
    return <Sun className="h-4 w-4 text-sig-temp" />;
}

function formatDay(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short" });
}

export default function ForecastBar({ forecast }: ForecastBarProps) {
    const t = useTranslations("weather");

    if (forecast.length === 0) {
        return (
            <div className="text-xs text-muted-foreground text-center py-3">
                {t("noForecast")}
            </div>
        );
    }

    return (
        <div className="flex gap-1 overflow-x-auto pb-1">
            {forecast.map((day) => (
                <div
                    key={day.date}
                    className="flex flex-col items-center gap-1 rounded-lg border bg-card p-2 min-w-[60px] shadow-sm"
                >
                    <span className="text-[10px] font-medium text-muted-foreground">
                        {formatDay(day.date)}
                    </span>
                    {weatherIcon(day.precipitation_sum, day.cloud_cover_mean)}
                    <div className="text-center">
                        <span className="text-xs font-semibold tabular-nums">
                            {day.temperature_2m_max != null ? `${Math.round(day.temperature_2m_max)}°` : "-"}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-0.5 tabular-nums">
                            {day.temperature_2m_min != null ? `${Math.round(day.temperature_2m_min)}°` : ""}
                        </span>
                    </div>
                    {day.precipitation_sum != null && day.precipitation_sum > 0 && (
                        <span className="text-[9px] text-sig-precip font-medium tabular-nums">
                            {day.precipitation_sum.toFixed(1)}mm
                        </span>
                    )}
                    {day.wind_speed_10m_max != null && day.wind_speed_10m_max > 5 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground tabular-nums">
                            <Wind className="h-2.5 w-2.5" />
                            {Math.round(day.wind_speed_10m_max)}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
