"use client";

import React, { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    MarkLineComponent,
    DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { FieldStat, IndexType, WeatherDaily } from "@/lib/api";
import { INDEX_CONFIG } from "@/lib/api";
import { tokenColor } from "@/lib/design-tokens";
import {
    axisLabel,
    baseTooltip,
    indexBandColor,
    indexLineColor,
    legendStyle,
    secondaryValueAxis,
    sig,
    thresholdMarkLine,
    valueAxis,
} from "./chart-base";

// Register only the modules we need (tree-shake friendly)
echarts.use([
    LineChart,
    BarChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    MarkLineComponent,
    DataZoomComponent,
    CanvasRenderer,
]);

interface NdviChartProps {
    stats: FieldStat[];
    /** Currently selected date (highlights point) */
    selectedDate?: string | null;
    /** Callback when a chart point is clicked */
    onDateSelect?: (date: string) => void;
    /** Height in pixels */
    height?: number;
    /** Which vegetation index to display */
    indexType?: IndexType;
    /** Optional weather data for overlay (precip bars + ET₀ line) */
    weatherData?: WeatherDaily[];
    /** Whether to show weather overlay (default false) */
    showWeatherOverlay?: boolean;
}

export default function NdviChart({
    stats,
    selectedDate,
    onDateSelect,
    height = 200,
    indexType = "NDVI",
    weatherData,
    showWeatherOverlay = false,
}: NdviChartProps) {
    const config = INDEX_CONFIG[indexType];
    const seriesName = `Mean ${config.label}`;

    // Weather data sorted by date for overlay
    const weatherSorted = useMemo(() => {
        if (!weatherData || !showWeatherOverlay || weatherData.length === 0) return null;
        return [...weatherData].sort((a, b) => a.date.localeCompare(b.date));
    }, [weatherData, showWeatherOverlay]);

    const option = useMemo(() => {
        // NDVI data as [date, value] pairs for time axis
        const ndviData = stats.map((s) => [s.date, s.mean ?? null] as [string, number | null]);
        const bandLowData = stats.map((s) => [s.date, s.p10 ?? null] as [string, number | null]);
        const bandHighData = stats.map((s) => {
            const p90 = s.p90 ?? null;
            const p10 = s.p10 ?? null;
            return [s.date, p90 != null && p10 != null ? p90 - p10 : null] as [string, number | null];
        });

        // Weather overlay: daily precip bars and ET₀ line on their actual dates
        const hasWeather = !!weatherSorted && weatherSorted.length > 0;
        const precipData = weatherSorted
            ? weatherSorted.map((w) => [w.date, w.precipitation_sum ?? 0] as [string, number])
            : [];
        const et0Data = weatherSorted
            ? weatherSorted.map((w) => [w.date, w.et0_fao_mm ?? 0] as [string, number])
            : [];

        return {
            grid: { top: hasWeather ? 30 : 10, right: hasWeather ? 50 : 10, bottom: 40, left: 40 },
            legend: hasWeather
                ? {
                    data: [seriesName, "Precip (mm)", "ET₀ (mm)"],
                    top: 0,
                    ...legendStyle(),
                }
                : undefined,
            tooltip: {
                ...baseTooltip(),
                trigger: "axis" as const,
                axisPointer: { type: "cross" as const },
                formatter: (params: any) => {
                    if (!Array.isArray(params) || params.length === 0) return "";
                    // Group by date from all series hitting this axis pointer
                    const date = params[0]?.axisValueLabel || params[0]?.value?.[0] || "";
                    const lines = [`<b>${date}</b>`];
                    for (const p of params) {
                        if (p.seriesName === "p10" || p.seriesName === "p90") continue;
                        const val = Array.isArray(p.value) ? p.value[1] : p.value;
                        if (val == null) continue;
                        const unit = p.seriesName === seriesName ? "" : " mm";
                        lines.push(`${p.marker} ${p.seriesName}: ${Number(val).toFixed(p.seriesName === seriesName ? 3 : 1)}${unit}`);
                    }
                    return lines.join("<br/>");
                },
            },
            xAxis: {
                type: "time" as const,
                axisLabel: axisLabel(),
                axisTick: { alignWithLabel: true },
            },
            yAxis: hasWeather
                ? [
                    valueAxis({ min: config.rescaleMin, max: config.rescaleMax + 0.1 }),
                    secondaryValueAxis({ name: "mm", nameTextStyle: axisLabel() }),
                ]
                : valueAxis({ min: config.rescaleMin, max: config.rescaleMax + 0.1 }),
            dataZoom: [
                {
                    type: "inside" as const,
                    start: 0,
                    end: 100,
                },
            ],
            series: [
                // p10 band (invisible base)
                {
                    name: "p10",
                    type: "line",
                    data: bandLowData,
                    stack: "band",
                    lineStyle: { opacity: 0 },
                    symbol: "none",
                    areaStyle: { opacity: 0 },
                    emphasis: { disabled: true },
                },
                // p90 band (visible range area)
                {
                    name: "p90",
                    type: "line",
                    data: bandHighData,
                    stack: "band",
                    lineStyle: { opacity: 0 },
                    symbol: "none",
                    areaStyle: {
                        color: indexBandColor(indexType),
                    },
                    emphasis: { disabled: true },
                },
                // Mean line
                {
                    name: seriesName,
                    type: "line",
                    data: ndviData,
                    smooth: true,
                    lineStyle: { color: indexLineColor(indexType), width: 2 },
                    itemStyle: {
                        color: (params: any) => {
                            const d = Array.isArray(params.value) ? params.value[0] : stats[params.dataIndex]?.date;
                            return d === selectedDate ? tokenColor("--danger") : indexLineColor(indexType);
                        },
                    },
                    symbolSize: (value: any) => {
                        const d = Array.isArray(value) ? value[0] : null;
                        return d === selectedDate ? 10 : 4;
                    },
                    markLine: {
                        silent: true,
                        data: [thresholdMarkLine(config.threshold, "Threshold")],
                    },
                },
                // Weather overlay: daily precipitation bars on actual dates
                ...(hasWeather
                    ? [
                        {
                            name: "Precip (mm)",
                            type: "bar",
                            yAxisIndex: 1,
                            data: precipData,
                            barMaxWidth: 6,
                            itemStyle: { color: sig("precip", 0.45) },
                            emphasis: { itemStyle: { color: sig("precip", 0.8) } },
                        },
                        {
                            name: "ET₀ (mm)",
                            type: "line",
                            yAxisIndex: 1,
                            data: et0Data,
                            smooth: true,
                            symbol: "none",
                            lineStyle: { color: sig("et0"), width: 1.5, type: "dashed" as const },
                            itemStyle: { color: sig("et0") },
                        },
                    ]
                    : []),
            ],
        };
    }, [stats, selectedDate, config, seriesName, weatherSorted]);

    const onEvents = useMemo(
        () => ({
            click: (params: any) => {
                if (params.seriesName === seriesName && params.value != null) {
                    const date = Array.isArray(params.value) ? params.value[0] : null;
                    if (date) onDateSelect?.(date);
                }
            },
        }),
        [onDateSelect, seriesName],
    );

    if (stats.length === 0) {
        return (
            <div
                className="flex items-center justify-center text-xs text-muted-foreground"
                style={{ height }}
            >
                No {config.label} data yet.
            </div>
        );
    }

    return (
        <ReactEChartsCore
            echarts={echarts}
            option={option}
            style={{ height, width: "100%" }}
            onEvents={onEvents}
            notMerge
            lazyUpdate
        />
    );
}
