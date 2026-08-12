"use client";

import React from "react";
import type { RasterLayer, IndexType } from "@/lib/api";
import { INDEX_CONFIG } from "@/lib/api";
import { useTranslations } from "next-intl";
import { MAP_CHROME } from "@/lib/design-tokens";

/* ── Component ────────────────────────────────────────────────── */

interface NdviLegendProps {
    /** The active raster layer (must have tile_url to be shown on map). */
    layer: RasterLayer;
    /** Which vegetation index is shown. */
    indexType?: IndexType;
    /** Render a smaller variant for tight spaces. */
    compact?: boolean;
}

export default function NdviLegend({ layer, indexType = "NDVI", compact = false }: NdviLegendProps) {
    const t = useTranslations("ndviLegend");
    const config = INDEX_CONFIG[indexType];
    const rescaleRange = config.rescaleMax - config.rescaleMin;

    /** Map a value to a percentage position on the gradient bar. */
    function valueToPercent(value: number): number {
        return Math.max(0, Math.min(100, ((value - config.rescaleMin) / rescaleRange) * 100));
    }

    const hasRange = layer.min != null && layer.max != null;
    const minPct = hasRange ? valueToPercent(layer.min!) : null;
    const maxPct = hasRange ? valueToPercent(layer.max!) : null;

    return (
        <div className={`${MAP_CHROME} rounded-lg ${compact ? "px-2 py-1.5 w-[140px]" : "px-3 py-2.5 w-[200px]"
            }`}>
            {/* Title */}
            <p className={`font-semibold tracking-wide ${compact ? "text-[11px] mb-1" : "text-[11px] mb-2"
                }`}>
                {config.label}
            </p>

            {/* Gradient bar + markers */}
            <div className="relative">
                <div className={`w-full rounded-sm border border-border overflow-hidden ${compact ? "h-2" : "h-3"
                    }`}>
                    <div
                        className="h-full w-full"
                        style={{ background: config.gradient }}
                    />
                </div>

                {/* Field min marker */}
                {minPct != null && (
                    <div
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${minPct}%` }}
                        title={`Min: ${layer.min!.toFixed(2)}`}
                    >
                        <div className={`w-[2px] bg-foreground/80 ${compact ? "h-2" : "h-3"}`} />
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
                        <div className={`w-[2px] bg-foreground/80 ${compact ? "h-2" : "h-3"}`} />
                        <div
                            className="border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground/80"
                            style={{ width: 0, height: 0 }}
                        />
                    </div>
                )}
            </div>

            {/* Fixed scale labels */}
            <div className="flex justify-between mt-1">
                <span className="text-muted-foreground font-mono text-[11px]">{config.rescaleMin}</span>
                <span className="text-muted-foreground font-mono text-[11px]">{config.rescaleMax}</span>
            </div>

            {/* Field actual range */}
            {hasRange && (
                <p className={`text-muted-foreground leading-tight ${compact ? "text-[11px] mt-1" : "text-[11px] mt-1.5"
                    }`}>
                    {t("fieldRange")}: <span className="font-mono font-medium text-foreground/80">{layer.min!.toFixed(2)}</span>
                    {" – "}
                    <span className="font-mono font-medium text-foreground/80">{layer.max!.toFixed(2)}</span>
                </p>
            )}
        </div>
    );
}
