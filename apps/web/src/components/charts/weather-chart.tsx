"use client";

import React, { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { WeatherDaily } from "@/lib/api";
import { useTranslations } from "next-intl";

echarts.use([
    LineChart,
    BarChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent,
    CanvasRenderer,
]);

interface WeatherChartProps {
    data: WeatherDaily[];
    height?: number;
}

export default function WeatherChart({ data, height = 220 }: WeatherChartProps) {
    const t = useTranslations("weather");

    const option = useMemo(() => {
        const dates = data.map((d) => d.date);
        const tempMin = data.map((d) => d.temperature_2m_min);
        const tempMax = data.map((d) => d.temperature_2m_max);
        const precip = data.map((d) => d.precipitation_sum);

        return {
            grid: { top: 30, right: 50, bottom: 40, left: 45 },
            legend: {
                data: [t("tempRange"), t("precipitation")],
                top: 0,
                textStyle: { fontSize: 10 },
            },
            tooltip: {
                trigger: "axis" as const,
                formatter: (params: any) => {
                    const idx = params[0]?.dataIndex;
                    if (idx == null) return "";
                    const d = data[idx];
                    const lines = [`<b>${d.date}</b>`];
                    if (d.temperature_2m_min != null && d.temperature_2m_max != null)
                        lines.push(`${t("temperature")}: ${d.temperature_2m_min.toFixed(1)}° – ${d.temperature_2m_max.toFixed(1)}°C`);
                    if (d.precipitation_sum != null)
                        lines.push(`${t("precipitation")}: ${d.precipitation_sum.toFixed(1)} mm`);
                    return lines.join("<br/>");
                },
            },
            xAxis: {
                type: "category" as const,
                data: dates,
                axisLabel: { fontSize: 9, rotate: 30 },
                axisTick: { alignWithLabel: true },
            },
            yAxis: [
                {
                    type: "value" as const,
                    name: "°C",
                    nameTextStyle: { fontSize: 9 },
                    axisLabel: { fontSize: 9 },
                    splitLine: { lineStyle: { type: "dashed" as const, color: "#e5e7eb" } },
                },
                {
                    type: "value" as const,
                    name: "mm",
                    nameTextStyle: { fontSize: 9 },
                    axisLabel: { fontSize: 9 },
                    splitLine: { show: false },
                },
            ],
            dataZoom: [{ type: "inside" as const, start: 0, end: 100 }],
            series: [
                // Temperature band (min as invisible base)
                {
                    name: "tempBase",
                    type: "line",
                    data: tempMin,
                    stack: "temp",
                    lineStyle: { opacity: 0 },
                    symbol: "none",
                    areaStyle: { opacity: 0 },
                    emphasis: { disabled: true },
                    tooltip: { show: false },
                },
                {
                    name: t("tempRange"),
                    type: "line",
                    data: tempMax.map((max, i) => {
                        const min = tempMin[i];
                        if (max == null || min == null) return null;
                        return max - min;
                    }),
                    stack: "temp",
                    lineStyle: { opacity: 0 },
                    symbol: "none",
                    areaStyle: { color: "rgba(251, 146, 60, 0.25)" },
                    emphasis: { disabled: true },
                },
                // Precipitation bars
                {
                    name: t("precipitation"),
                    type: "bar",
                    yAxisIndex: 1,
                    data: precip,
                    barMaxWidth: 8,
                    itemStyle: { color: "rgba(59, 130, 246, 0.6)", borderRadius: [2, 2, 0, 0] },
                },
            ],
        };
    }, [data, t]);

    if (data.length === 0) {
        return (
            <div
                className="flex items-center justify-center text-xs text-muted-foreground"
                style={{ height }}
            >
                {t("noData")}
            </div>
        );
    }

    return (
        <ReactEChartsCore
            echarts={echarts}
            option={option}
            style={{ height, width: "100%" }}
            notMerge
            lazyUpdate
        />
    );
}
