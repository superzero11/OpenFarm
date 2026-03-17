"use client";

import React from "react";
import type { WeatherDaily } from "@/lib/api";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const DEPTH_LAYERS = [
    { key: "soil_moisture_0_1cm" as const, label: "soilDepth0_1" },
    { key: "soil_moisture_1_3cm" as const, label: "soilDepth1_3" },
    { key: "soil_moisture_3_9cm" as const, label: "soilDepth3_9" },
    { key: "soil_moisture_9_27cm" as const, label: "soilDepth9_27" },
    { key: "soil_moisture_27_81cm" as const, label: "soilDepth27_81" },
] as const;

function getMoistureColor(value: number): string {
    if (value >= 0.35) return "bg-green-500";
    if (value >= 0.25) return "bg-yellow-500";
    if (value >= 0.15) return "bg-orange-500";
    return "bg-red-500";
}

function getMoistureTextColor(value: number): string {
    if (value >= 0.35) return "text-green-600 dark:text-green-400";
    if (value >= 0.25) return "text-yellow-600 dark:text-yellow-400";
    if (value >= 0.15) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
}

interface SoilMoistureGaugeProps {
    /** Most recent weather data entry (to read soil moisture values from) */
    data: WeatherDaily;
}

export default function SoilMoistureGauge({ data }: SoilMoistureGaugeProps) {
    const t = useTranslations("weather");

    return (
        <div className="space-y-1.5">
            {DEPTH_LAYERS.map((layer) => {
                const value = data[layer.key];
                if (value == null) return null;
                const pct = Math.min(value * 100, 100);
                return (
                    <div key={layer.key} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0 text-right">
                            {t(layer.label)}
                        </span>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden relative">
                            <div
                                className={cn("h-full rounded-full transition-all", getMoistureColor(value))}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span
                            className={cn(
                                "text-[10px] font-semibold w-10 shrink-0",
                                getMoistureTextColor(value),
                            )}
                        >
                            {pct.toFixed(0)}%
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
