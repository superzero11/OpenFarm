"use client";

import React from "react";
import type { RasterLayer } from "@/lib/api";
import { useTranslations } from "next-intl";

/* ── rdylgn colormap (TiTiler / matplotlib) ──────────────────── */

const RESCALE_MIN = -0.2;
const RESCALE_MAX = 0.9;
const RESCALE_RANGE = RESCALE_MAX - RESCALE_MIN; // 1.1

/**
 * Standard RdYlGn divergent colormap – 11 stops evenly spaced.
 * Matches the `rdylgn` colormap used in TiTiler with `rescale=-0.2,0.9`.
 */
const RDYLGN_GRADIENT =
    "linear-gradient(to right, #a50026 0%, #d73027 10%, #f46d43 20%, #fdae61 30%, #fee08b 40%, #ffffbf 50%, #d9ef8b 60%, #a6d96a 70%, #66bd63 80%, #1a9850 90%, #006837 100%)";

/** Map an NDVI value to a percentage position on the gradient bar. */
function valueToPercent(value: number): number {
    return Math.max(0, Math.min(100, ((value - RESCALE_MIN) / RESCALE_RANGE) * 100));
}

/* ── Component ────────────────────────────────────────────────── */

interface NdviLegendProps {
    /** The active raster layer (must have tile_url to be shown on map). */
    layer: RasterLayer;
}

export default function NdviLegend({ layer }: NdviLegendProps) {
    const t = useTranslations("ndviLegend");

    const hasRange = layer.min != null && layer.max != null;
    const minPct = hasRange ? valueToPercent(layer.min!) : null;
    const maxPct = hasRange ? valueToPercent(layer.max!) : null;

    return (
        <div className="rounded-lg bg-background/90 backdrop-blur-sm shadow-md border border-border/50 px-3 py-2.5 w-[200px]">
            {/* Title */}
            <p className="text-[11px] font-semibold mb-2 tracking-wide">
                {t("title")}
            </p>

            {/* Gradient bar + markers */}
            <div className="relative">
                <div className="h-3 w-full rounded-sm border border-border/30 overflow-hidden">
                    <div
                        className="h-full w-full"
                        style={{ background: RDYLGN_GRADIENT }}
                    />
                </div>

                {/* Field min marker */}
                {minPct != null && (
                    <div
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${minPct}%` }}
                        title={`Min: ${layer.min!.toFixed(2)}`}
                    >
                        <div className="w-[2px] h-3 bg-foreground/80" />
                        <div
                            className="border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground/80"
                            style={{ width: 0, height: 0 }}
                        />
                    </div>
                )}

                {/* Field max marker */}
                {maxPct != null && (
                    <div
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${maxPct}%` }}
                        title={`Max: ${layer.max!.toFixed(2)}`}
                    >
                        <div className="w-[2px] h-3 bg-foreground/80" />
                        <div
                            className="border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground/80"
                            style={{ width: 0, height: 0 }}
                        />
                    </div>
                )}
            </div>

            {/* Fixed scale labels */}
            <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground font-mono">{RESCALE_MIN}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{RESCALE_MAX}</span>
            </div>

            {/* Field actual range */}
            {hasRange && (
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
                    {t("fieldRange")}: <span className="font-mono font-medium text-foreground/80">{layer.min!.toFixed(2)}</span>
                    {" – "}
                    <span className="font-mono font-medium text-foreground/80">{layer.max!.toFixed(2)}</span>
                </p>
            )}
        </div>
    );
}
