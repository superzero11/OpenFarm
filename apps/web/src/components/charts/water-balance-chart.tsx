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
import { axisLabel, baseTooltip, legendStyle, sig, thresholdMarkLine, valueAxis } from "./chart-base";

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
                ...legendStyle(),
            },
            tooltip: {
                ...baseTooltip(),
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
                axisLabel: axisLabel({ rotate: 30 }),
                axisTick: { alignWithLabel: true },
            },
            yAxis: valueAxis({ name: "mm", nameTextStyle: axisLabel() }),
            dataZoom: [{ type: "inside" as const, start: 0, end: 100 }],
            series: [
                {
                    name: t("et0"),
                    type: "line",
                    data: et0,
                    smooth: true,
                    lineStyle: { color: sig("et0"), width: 1.5 },
                    itemStyle: { color: sig("et0") },
                    symbolSize: 3,
                },
                {
                    name: t("waterBalance30d"),
                    type: "line",
                    data: balance,
                    smooth: true,
                    lineStyle: { color: sig("water"), width: 2 },
                    itemStyle: { color: sig("water") },
                    symbolSize: 3,
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: sig("water", 0.12) },
                            { offset: 1, color: sig("water", 0) },
                        ]),
                    },
                    markLine: {
                        silent: true,
                        data: [thresholdMarkLine(0, t("deficit"), "insideEndBottom")],
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
