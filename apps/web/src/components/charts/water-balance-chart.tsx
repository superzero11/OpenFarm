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
import type { WeatherDaily } from "@/lib/api";
import { useTranslations } from "next-intl";

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

interface WaterBalanceChartProps {
    data: WeatherDaily[];
    height?: number;
}

export default function WaterBalanceChart({ data, height = 200 }: WaterBalanceChartProps) {
    const t = useTranslations("weather");

    const option = useMemo(() => {
        const dates = data.map((d) => d.date);
        const et0 = data.map((d) => d.et0_fao_mm);
        const balance = data.map((d) => d.water_balance_30d_mm);

        return {
            grid: { top: 30, right: 15, bottom: 40, left: 45 },
            legend: {
                data: [t("et0"), t("waterBalance30d")],
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
                    if (d.et0_fao_mm != null)
                        lines.push(`${t("et0")}: ${d.et0_fao_mm.toFixed(1)} mm`);
                    if (d.water_balance_30d_mm != null)
                        lines.push(`${t("waterBalance30d")}: ${d.water_balance_30d_mm.toFixed(1)} mm`);
                    return lines.join("<br/>");
                },
            },
            xAxis: {
                type: "category" as const,
                data: dates,
                axisLabel: { fontSize: 9, rotate: 30 },
                axisTick: { alignWithLabel: true },
            },
            yAxis: {
                type: "value" as const,
                name: "mm",
                nameTextStyle: { fontSize: 9 },
                axisLabel: { fontSize: 9 },
                splitLine: { lineStyle: { type: "dashed" as const, color: "#e5e7eb" } },
            },
            dataZoom: [{ type: "inside" as const, start: 0, end: 100 }],
            series: [
                {
                    name: t("et0"),
                    type: "line",
                    data: et0,
                    smooth: true,
                    lineStyle: { color: "#f59e0b", width: 1.5 },
                    itemStyle: { color: "#f59e0b" },
                    symbolSize: 3,
                },
                {
                    name: t("waterBalance30d"),
                    type: "line",
                    data: balance,
                    smooth: true,
                    lineStyle: { color: "#3b82f6", width: 2 },
                    itemStyle: { color: "#3b82f6" },
                    symbolSize: 3,
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: "rgba(59, 130, 246, 0.15)" },
                            { offset: 1, color: "rgba(59, 130, 246, 0)" },
                        ]),
                    },
                    markLine: {
                        silent: true,
                        data: [
                            {
                                yAxis: 0,
                                lineStyle: { color: "#ef4444", type: "dashed" as const, width: 1 },
                                label: { formatter: t("deficit"), fontSize: 9, position: "insideEndBottom" as const },
                            },
                        ],
                    },
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
