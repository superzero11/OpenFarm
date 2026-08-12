"use client";

import { useId } from "react";
import {
    FIELD_OUTLINE,
    IMAGERY,
    IMAGERY_FLAT,
    RDBU,
    RDYLGN,
    clamp01,
    rampColor,
    vigour,
} from "./imagery";

/* React components for the generated Sentinel-2 stand-ins. The data
   itself, including the colormaps and the field geometry, lives in
   ./imagery so the server-rendered Open Graph card can share it. */

export { IMAGERY, IMAGERY_FLAT };

export interface FieldRasterProps {
    /** Cell grid. More cells reads as finer ground resolution. */
    cols?: number;
    rows?: number;
    /** Scales vigour, which is how a scene earlier in the season is drawn. */
    scale?: number;
    /**
     * vegetation renders vigour on rdylgn. water renders NDWI on rdbu:
     * a narrow band either side of zero, drying where vigour drops.
     */
    ramp?: "vegetation" | "water";
    className?: string;
}

/** Index raster clipped to the field boundary, drawn over imagery. */
export function FieldRaster({
    cols = 12,
    rows = 8,
    scale = 1,
    ramp = "vegetation",
    className,
}: FieldRasterProps) {
    const clipId = `field-${useId().replace(/:/g, "")}`;
    const water = ramp === "water";
    const stops = water ? RDBU : RDYLGN;
    const stepX = 100 / cols;
    const stepY = 100 / rows;

    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const raw = vigour((c + 0.5) / cols, (r + 0.5) / rows);
            const value = water ? 0.5 + (raw - 0.5) * 0.55 * scale : raw * scale;
            cells.push(
                <rect
                    key={`${r}-${c}`}
                    x={c * stepX}
                    y={r * stepY}
                    width={stepX * 1.04}
                    height={stepY * 1.04}
                    fill={rampColor(value, stops)}
                />,
            );
        }
    }

    return (
        <div className={className} aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block h-full w-full">
                <defs>
                    <clipPath id={clipId}>
                        <polygon points={FIELD_OUTLINE} />
                    </clipPath>
                </defs>
                <g clipPath={`url(#${clipId})`}>{cells}</g>
            </svg>
        </div>
    );
}

/** Field boundary alone, the way layer A stores it before any index runs. */
export function FieldOutline({ className }: { className?: string }) {
    return (
        <div className={className} aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block h-full w-full">
                <polygon
                    points={FIELD_OUTLINE}
                    fill="hsl(var(--map-field-stroke) / 0.16)"
                    stroke="hsl(var(--map-field-stroke))"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
        </div>
    );
}
