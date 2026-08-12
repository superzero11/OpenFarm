import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { IMAGERY, RDYLGN, insideField, rampColor, vigour } from "./imagery";

const SIZE = { width: 1200, height: 630 };

/**
 * The share card, served from a dotted path (see app/og-en.png).
 *
 * It is the hero, rebuilt for a 1200x630 frame: the same imagery wash,
 * the same graticule, the same field geometry carrying the same NDVI
 * raster, under the same scrim, with an echo of the explainability card
 * that the hero leads on. Someone who clicks the link should recognise
 * the page they land on.
 *
 * Deliberately not Next's opengraph-image file convention: under a
 * [locale] segment that convention advertises /en/opengraph-image, which
 * redirects for the default locale, and it forces one hardcoded alt text
 * across every language.
 *
 * ImageResponse renders through Satori, which resolves no CSS variables
 * and no Tailwind, so token values are written out as literals below.
 * This is a generated image asset, the same exception icon.tsx takes,
 * not UI chrome: keep them in step with the dark theme in globals.css.
 * Satori also has no SVG clipPath, no repeating gradients and no `inset`
 * shorthand, which is why the raster is built from positioned cells, the
 * graticule from drawn lines, and every overlay is sized explicitly.
 */
const BACKGROUND = "#0b0f0d"; // --background, dark
const FOREGROUND = "#f2f6f4"; // --foreground, dark
const MUTED = "#9ba6a1"; // --muted-foreground, dark
const PRIMARY = "#22c55e"; // --primary, dark
const BORDER = "#222a26"; // --border, dark
const SURFACE_3 = "27,33,30"; // --surface-3, dark, as rgb for the card wash
const DANGER = "#ef4444"; // --danger, dark

/* Where the field sits in the frame, mirroring the hero's right-hand placement. */
const FIELD = { left: 612, top: 40, width: 560, height: 470 };
const COLS = 13;
const ROWS = 16;

/** Graticule lines. Satori has no repeating gradients, so they are drawn. */
function graticule() {
    const lines = [];
    for (let x = 88; x < SIZE.width; x += 88) {
        lines.push(
            <div
                key={`v${x}`}
                style={{
                    position: "absolute",
                    left: x,
                    top: 0,
                    width: 1,
                    height: SIZE.height,
                    background: "rgba(11,15,13,0.16)",
                }}
            />,
        );
    }
    for (let y = 104; y < SIZE.height; y += 104) {
        lines.push(
            <div
                key={`h${y}`}
                style={{
                    position: "absolute",
                    left: 0,
                    top: y,
                    width: SIZE.width,
                    height: 1,
                    background: "rgba(11,15,13,0.12)",
                }}
            />,
        );
    }
    return lines;
}

/** The field raster, one positioned cell per pixel inside the boundary. */
function fieldCells() {
    const cellW = FIELD.width / COLS;
    const cellH = FIELD.height / ROWS;
    const cells = [];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const u = (c + 0.5) / COLS;
            const v = (r + 0.5) / ROWS;
            if (!insideField(u * 100, v * 100)) continue;
            cells.push(
                <div
                    key={`${r}-${c}`}
                    style={{
                        position: "absolute",
                        left: FIELD.left + c * cellW,
                        top: FIELD.top + r * cellH,
                        width: cellW + 1,
                        height: cellH + 1,
                        background: rampColor(vigour(u, v), RDYLGN),
                    }}
                />,
            );
        }
    }
    return cells;
}

export async function renderOgCard(locale: string) {
    const t = await getTranslations({ locale, namespace: "seo" });
    const alert = await getTranslations({ locale, namespace: "landing" });

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    position: "relative",
                    background: BACKGROUND,
                    backgroundImage: IMAGERY,
                    fontFamily: "sans-serif",
                }}
            >
                {graticule()}

                {fieldCells()}

                {/* Scrim: the headline stays at full contrast over imagery */}
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: SIZE.width,
                        height: SIZE.height,
                        display: "flex",
                        backgroundImage:
                            "linear-gradient(100deg, #0b0f0d 30%, rgba(11,15,13,0.88) 46%, rgba(11,15,13,0.34) 68%, rgba(11,15,13,0.5) 100%)",
                    }}
                />

                {/* Alert chip: the explainability card, reduced to its claim */}
                <div
                    style={{
                        position: "absolute",
                        left: 640,
                        top: 404,
                        width: 470,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 12,
                        border: `1px solid ${BORDER}`,
                        background: `rgba(${SURFACE_3},0.94)`,
                        padding: "16px 18px",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                            style={{
                                display: "flex",
                                background: DANGER,
                                color: "#ffffff",
                                borderRadius: 999,
                                padding: "3px 10px",
                                fontSize: 15,
                                fontWeight: 600,
                            }}
                        >
                            {alert("cardSeverity")}
                        </div>
                        <div style={{ display: "flex", fontSize: 15, color: MUTED }}>
                            {alert("cardField")}
                        </div>
                    </div>
                    <div style={{ display: "flex", fontSize: 21, color: FOREGROUND, marginTop: 12 }}>
                        {alert("cardAlert")}
                    </div>
                </div>

                {/* Content column */}
                <div
                    style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        width: 700,
                        padding: 72,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <svg
                            width="42"
                            height="42"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={PRIMARY}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                        </svg>
                        <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: FOREGROUND }}>
                            OpenFarm
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                display: "flex",
                                fontSize: 58,
                                fontWeight: 700,
                                color: FOREGROUND,
                                lineHeight: 1.08,
                                letterSpacing: "-0.03em",
                            }}
                        >
                            {t("ogHeadline")}
                        </div>
                        <div style={{ display: "flex", fontSize: 25, color: MUTED, marginTop: 20, lineHeight: 1.4 }}>
                            {t("ogSubhead")}
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 20,
                            fontSize: 21,
                            color: MUTED,
                        }}
                    >
                        <div style={{ display: "flex", color: PRIMARY }}>openfarm.earth</div>
                        <div style={{ display: "flex" }}>BSD-3-Clause</div>
                        <div style={{ display: "flex" }}>Self-hostable</div>
                    </div>
                </div>
            </div>
        ),
        { ...SIZE },
    );
}
