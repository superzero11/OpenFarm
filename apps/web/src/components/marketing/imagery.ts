/* ------------------------------------------------------------------ *
 * Generated stand-ins for Sentinel-2 scenes: the data, with no React.
 *
 * Everything here is map data, not UI chrome. The imagery wash imitates
 * a true-colour Sentinel-2 tile, and the raster cells come from the
 * rdylgn / rdbu scientific colormaps: the same stops as the
 * --ramp-vegetation / --ramp-water tokens and the TiTiler colormap,
 * discretised for per-cell rendering. They must not be swapped for
 * theme tokens - a colormap that changed with the theme would make two
 * fields incomparable, which is the whole point of a fixed scale.
 *
 * Values are deterministic (a hash, never Math.random) so the server
 * and client renders agree.
 *
 * Kept free of "use client" and of JSX so the Open Graph card, which
 * renders on the server through Satori, draws the same field from the
 * same numbers as the hero.
 * ------------------------------------------------------------------ */

/** rdylgn stops, as served for NDVI / EVI / SAVI. */
export const RDYLGN = [
    "#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf",
    "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837",
];

/** rdbu stops, as served for NDWI. */
export const RDBU = [
    "#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7",
    "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061",
];

/**
 * Parcel striping: the diagonal banding of adjacent fields under sun
 * angle. Hard stops are written out in full (`c 0%, c 12%, d 12%`)
 * rather than the shorthand double-position form, because Satori's
 * gradient parser does not accept the shorthand and this file has to
 * render in both a browser and an image.
 */
const PARCEL_STRIPES = [
    "linear-gradient(115deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.22) 12%, rgba(255,255,255,0.05) 12%, rgba(255,255,255,0.05) 22%, rgba(0,0,0,0.14) 22%, rgba(0,0,0,0.14) 38%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2) 63%, rgba(255,255,255,0.06) 63%, rgba(255,255,255,0.06) 74%, rgba(0,0,0,0.12) 74%, rgba(0,0,0,0.12) 88%, rgba(255,255,255,0.04) 88%, rgba(255,255,255,0.04) 100%)",
    "linear-gradient(28deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.18) 9%, rgba(255,255,255,0.04) 9%, rgba(255,255,255,0.04) 19%, rgba(0,0,0,0.1) 19%, rgba(0,0,0,0.1) 32%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0.05) 44%, rgba(0,0,0,0.16) 44%, rgba(0,0,0,0.16) 58%, rgba(255,255,255,0.03) 58%, rgba(255,255,255,0.03) 71%, rgba(0,0,0,0.11) 71%, rgba(0,0,0,0.11) 86%, rgba(255,255,255,0.05) 86%, rgba(255,255,255,0.05) 100%)",
];

/** Ground wash: canopy green shading into bare-soil ochre. */
const GROUND = [
    "radial-gradient(circle at 22% 30%, #3e4a2e, transparent 46%)",
    "radial-gradient(circle at 74% 66%, #4a4832, transparent 52%)",
    "linear-gradient(150deg, #3a452c, #55523a 55%, #3f4a30)",
];

/** Full imagery wash for large frames (hero, scene tiles, share card). */
export const IMAGERY = [...PARCEL_STRIPES, ...GROUND].join(", ");

/** Two-layer variant for tiles under about 100px tall. */
export const IMAGERY_FLAT = [PARCEL_STRIPES[0], GROUND[2]].join(", ");

/**
 * Field outline shared by every raster on the page, in a 0-100 box.
 * One geometry seen four ways is the argument the page is making.
 */
export const FIELD_POINTS: ReadonlyArray<readonly [number, number]> = [
    [14, 0], [66, 5], [100, 30], [88, 82], [42, 100], [4, 74],
];

/** The same outline as an SVG points attribute. */
export const FIELD_OUTLINE = FIELD_POINTS.map(([x, y]) => `${x},${y}`).join(" ");

export function clamp01(n: number): number {
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
export function vigour(u: number, v: number): number {
    const base = 0.74 - 0.14 * u + 0.1 * v;
    const dx = u - 0.82;
    const dy = v - 0.16;
    const patch = 0.66 * Math.exp(-(dx * dx + dy * dy) / 0.05);
    const grain = (hash01(Math.round(u * 64), Math.round(v * 64)) - 0.5) * 0.14;
    return clamp01(base - patch + grain);
}

export function rampColor(value01: number, stops: string[]): string {
    const i = Math.round(clamp01(value01) * (stops.length - 1));
    return stops[i];
}

/**
 * Ray casting against the field outline, in the same 0-100 box.
 *
 * The page clips its rasters with an SVG clipPath, which Satori does not
 * support, so the share card tests each cell centre instead and simply
 * omits the ones outside the boundary. Same shape, no clipping.
 */
export function insideField(x: number, y: number): boolean {
    let inside = false;
    for (let i = 0, j = FIELD_POINTS.length - 1; i < FIELD_POINTS.length; j = i++) {
        const [xi, yi] = FIELD_POINTS[i];
        const [xj, yj] = FIELD_POINTS[j];
        const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
}
