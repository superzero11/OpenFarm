"use client";

import { useId } from "react";

/* ------------------------------------------------------------------ *
 * Generated stand-ins for Sentinel-2 scenes.
 *
 * Everything in this file is map data, not UI chrome. The imagery wash
 * imitates a true-colour Sentinel-2 tile, and the raster cells come
 * from the rdylgn / rdbu scientific colormaps: the same stops as the
 * --ramp-vegetation / --ramp-water tokens and the TiTiler colormap,
 * discretised for per-cell rendering. They must not be swapped for
 * theme tokens - a colormap that changed with the theme would make two
 * fields incomparable, which is the whole point of a fixed scale.
 *
 * Values are deterministic (a hash, never Math.random) so the server
 * and client renders agree.
 * ------------------------------------------------------------------ */

/** rdylgn stops, as served for NDVI / EVI / SAVI. */
const RDYLGN = [
    "#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf",
    "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837",
];

/** rdbu stops, as served for NDWI. */
const RDBU = [
    "#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7",
    "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061",
];

/** Parcel striping: the diagonal banding of adjacent fields under sun angle. */
const PARCEL_STRIPES = [
    "linear-gradient(115deg, rgba(0,0,0,0.22) 0 12%, rgba(255,255,255,0.05) 12% 22%, rgba(0,0,0,0.14) 22% 38%, rgba(255,255,255,0.03) 38% 50%, rgba(0,0,0,0.2) 50% 63%, rgba(255,255,255,0.06) 63% 74%, rgba(0,0,0,0.12) 74% 88%, rgba(255,255,255,0.04) 88% 100%)",
    "linear-gradient(28deg, rgba(0,0,0,0.18) 0 9%, rgba(255,255,255,0.04) 9% 19%, rgba(0,0,0,0.1) 19% 32%, rgba(255,255,255,0.05) 32% 44%, rgba(0,0,0,0.16) 44% 58%, rgba(255,255,255,0.03) 58% 71%, rgba(0,0,0,0.11) 71% 86%, rgba(255,255,255,0.05) 86% 100%)",
];

/** Ground wash: canopy green shading into bare-soil ochre. */
const GROUND = [
    "radial-gradient(circle at 22% 30%, #3e4a2e, transparent 46%)",
    "radial-gradient(circle at 74% 66%, #4a4832, transparent 52%)",
    "linear-gradient(150deg, #3a452c, #55523a 55%, #3f4a30)",
];

/** Full imagery wash for large frames (hero, scene tiles). */
export const IMAGERY = [...PARCEL_STRIPES, ...GROUND].join(", ");

/** Two-layer variant for tiles under about 100px tall. */
export const IMAGERY_FLAT = [PARCEL_STRIPES[0], GROUND[2]].join(", ");

/**
 * Field outline shared by every raster on the page, in viewBox units.
 * One geometry seen four ways is the argument the section is making.
 */
const FIELD_OUTLINE = "14,0 66,5 100,30 88,82 42,100 4,74";

function clamp01(n: number): number {
    return Math.min(1, Math.max(0, n));
}

function hash01(x: number, y: number): number {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

/**
 * Vigour surface for the demo field: dense canopy in the south-west,
 * a stressed patch in the north-east, per-cell grain on top. The patch
 * is what every index in the multi-index section has to agree on.
 */
function vigour(u: number, v: number): number {
    const base = 0.74 - 0.14 * u + 0.1 * v;
    const dx = u - 0.82;
    const dy = v - 0.16;
    const patch = 0.66 * Math.exp(-(dx * dx + dy * dy) / 0.05);
    const grain = (hash01(Math.round(u * 64), Math.round(v * 64)) - 0.5) * 0.14;
    return clamp01(base - patch + grain);
}

function rampColor(value01: number, stops: string[]): string {
    const i = Math.round(clamp01(value01) * (stops.length - 1));
    return stops[i];
}

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
