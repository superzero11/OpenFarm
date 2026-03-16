"use client";

import React, { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
    GridComponent,
    TooltipComponent,
    MarkLineComponent,
    DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { FieldStat, IndexType } from "@/lib/api";
import { INDEX_CONFIG } from "@/lib/api";

// Register only the modules we need (tree-shake friendly)
echarts.use([
    LineChart,
    GridComponent,
    TooltipComponent,
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
}

export default function NdviChart({
    stats,
    selectedDate,
    onDateSelect,
    height = 200,
    indexType = "NDVI",
}: NdviChartProps) {
    const config = INDEX_CONFIG[indexType];
    const seriesName = `Mean ${config.label}`;

    const option = useMemo(() => {
        const dates = stats.map((s) => s.date);
        const means = stats.map((s) => s.mean ?? null);
        const p10s = stats.map((s) => s.p10 ?? null);
        const p90s = stats.map((s) => s.p90 ?? null);

        // Band data for p10–p90 range (arearange hack: stack two series)
        const bandLow = p10s;
        const bandHigh = p90s.map((p90, i) => {
            if (p90 == null || p10s[i] == null) return null;
            return p90 - p10s[i]!;
        });

        return {
            grid: { top: 10, right: 10, bottom: 40, left: 40 },
            tooltip: {
                trigger: "axis" as const,
                formatter: (params: any) => {
                    const idx = params[0]?.dataIndex;
                    if (idx == null) return "";
                    const s = stats[idx];
                    const q = s.quality_score != null ? `${(s.quality_score * 100).toFixed(0)}%` : "—";
                    return [
                        `<b>${s.date}</b>`,
                        `Mean: ${s.mean?.toFixed(3) ?? "—"}`,
                        `Range: ${s.p10?.toFixed(3) ?? "—"} – ${s.p90?.toFixed(3) ?? "—"}`,
                        `Quality: ${q}`,
                    ].join("<br/>");
                },
            },
            xAxis: {
                type: "category" as const,
                data: dates,
                axisLabel: { fontSize: 10, rotate: 30 },
                axisTick: { alignWithLabel: true },
            },
            yAxis: {
                type: "value" as const,
                min: config.rescaleMin,
                max: config.rescaleMax + 0.1,
                axisLabel: { fontSize: 10 },
                splitLine: { lineStyle: { type: "dashed" as const, color: "#e5e7eb" } },
            },
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
                    data: bandLow,
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
                    data: bandHigh,
                    stack: "band",
                    lineStyle: { opacity: 0 },
                    symbol: "none",
                    areaStyle: {
                        color: config.bandColor,
                    },
                    emphasis: { disabled: true },
                },
                // Mean line
                {
                    name: seriesName,
                    type: "line",
                    data: means,
                    smooth: true,
                    lineStyle: { color: config.lineColor, width: 2 },
                    itemStyle: {
                        color: (params: any) => {
                            const d = dates[params.dataIndex];
                            return d === selectedDate ? "#ef4444" : config.lineColor;
                        },
                    },
                    symbolSize: (value: number, params: any) => {
                        const d = dates[params.dataIndex];
                        return d === selectedDate ? 10 : 4;
                    },
                    markLine: {
                        silent: true,
                        data: [
                            {
                                yAxis: config.threshold,
                                lineStyle: { color: "#ef4444", type: "dashed" as const, width: 1 },
                                label: { formatter: "Threshold", fontSize: 9, position: "insideMiddleBottom" as const },
                            },
                        ],
                    },
                },
            ],
        };
    }, [stats, selectedDate, config, seriesName]);

    const onEvents = useMemo(
        () => ({
            click: (params: any) => {
                if (params.seriesName === seriesName && params.dataIndex != null) {
                    const date = stats[params.dataIndex]?.date;
                    if (date) onDateSelect?.(date);
                }
            },
        }),
        [stats, onDateSelect, seriesName],
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
