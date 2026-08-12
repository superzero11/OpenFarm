"use client";

/**
 * Shared ECharts option fragments implementing the design system's chart
 * rules (AGENTS.md section 6). Every chart component composes these
 * instead of restating grid, axis, tooltip or colour choices.
 *
 * Colours resolve from the token layer at render time via tokenColor -
 * ECharts paints to canvas, so CSS classes and var() are not available
 * there. One quantity, one colour: named quantities take their sig-*
 * token; anonymous categorical series take viz-1..8 in order.
 */

import { tokenColor } from "@/lib/design-tokens";
import type { IndexType } from "@/lib/api";

export type SignalName =
    | "vegetation"
    | "water"
    | "precip"
    | "temp"
    | "et0"
    | "vpd"
    | "carbon"
    | "yield";

/** Permanent signal colour for a measured quantity. */
export function sig(name: SignalName, alpha?: number): string {
    return tokenColor(`--sig-${name}`, alpha);
}

/** Categorical series colour n (1-based, wraps after 8). Use in order. */
export function viz(n: number, alpha?: number): string {
    const i = ((n - 1) % 8) + 1;
    return tokenColor(`--viz-${i}`, alpha);
}

/** Vegetation indices share sig-vegetation; NDWI is a water quantity. */
export function indexLineColor(indexType: IndexType): string {
    return indexType === "NDWI" ? sig("water") : sig("vegetation");
}

/** p10-p90 distribution band: series colour at 15% opacity. */
export function indexBandColor(indexType: IndexType): string {
    return indexType === "NDWI" ? sig("water", 0.15) : sig("vegetation", 0.15);
}

/** Axis labels: 11px, muted. */
export function axisLabel(extra: Record<string, unknown> = {}) {
    return { fontSize: 11, color: tokenColor("--muted-foreground"), ...extra };
}

/** Horizontal gridlines only: 1px dashed hairline. */
export function splitLine() {
    return {
        lineStyle: {
            type: "dashed" as const,
            color: tokenColor("--border"),
            width: 1,
        },
    };
}

/** Value axis: hidden axis line, hairline horizontal grid, 11px labels. */
export function valueAxis(extra: Record<string, unknown> = {}) {
    return {
        type: "value" as const,
        axisLine: { show: false },
        axisLabel: axisLabel(),
        splitLine: splitLine(),
        ...extra,
    };
}

/** Secondary value axis (right side): no gridlines of its own. */
export function secondaryValueAxis(extra: Record<string, unknown> = {}) {
    return {
        type: "value" as const,
        axisLine: { show: false },
        axisLabel: axisLabel(),
        splitLine: { show: false },
        ...extra,
    };
}

/** Tooltip chrome reuses the popover tokens; values render in mono. */
export function baseTooltip(extra: Record<string, unknown> = {}) {
    return {
        backgroundColor: tokenColor("--surface-3"),
        borderColor: tokenColor("--border"),
        borderWidth: 1,
        textStyle: {
            color: tokenColor("--foreground"),
            fontSize: 12,
            fontFamily: "var(--font-mono)",
        },
        extraCssText: "border-radius: 6px; box-shadow: var(--shadow-md);",
        ...extra,
    };
}

/** Legend: 11px muted, compact swatches. */
export function legendStyle(extra: Record<string, unknown> = {}) {
    return {
        textStyle: { fontSize: 11, color: tokenColor("--muted-foreground") },
        itemWidth: 12,
        itemHeight: 8,
        ...extra,
    };
}

/** Threshold: dashed 1px danger line with an inline label. */
export function thresholdMarkLine(
    yValue: number,
    label: string,
    position: string = "insideMiddleBottom",
) {
    return {
        yAxis: yValue,
        lineStyle: {
            color: tokenColor("--danger"),
            type: "dashed" as const,
            width: 1,
        },
        label: {
            formatter: label,
            fontSize: 11,
            color: tokenColor("--danger"),
            position,
        },
    };
}
