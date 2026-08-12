import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

const SIZE = { width: 1200, height: 630 };

/**
 * The share card, served from a dotted path (see app/og-en.png).
 *
 * Deliberately not Next's opengraph-image file convention: under a
 * [locale] segment that convention advertises /en/opengraph-image, which
 * redirects for the default locale, and it forces one hardcoded alt text
 * across every language. A plain renderer keeps both under our control.
 *
 * ImageResponse renders through Satori, which resolves no CSS
 * variables and no Tailwind, so the token values are written out as
 * literals here. This is a generated image asset, the same exception
 * icon.tsx takes, not UI chrome: keep the values in step with the dark
 * theme tokens in globals.css if those ever change.
 */
const BACKGROUND = "#0b0f0d"; // --background, dark
const FOREGROUND = "#f2f6f4"; // --foreground, dark
const MUTED = "#9ba6a1"; // --muted-foreground, dark
const PRIMARY = "#22c55e"; // --primary, dark
const BORDER = "#222a26"; // --border, dark

export async function renderOgCard(locale: string) {
    const t = await getTranslations({ locale, namespace: "seo" });

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: BACKGROUND,
                    padding: 72,
                    fontFamily: "sans-serif",
                }}
            >
                {/* Field parcels, the same idea the hero uses */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: 520,
                        height: 630,
                        display: "flex",
                        backgroundImage:
                            "linear-gradient(150deg, #3a452c, #55523a 55%, #3f4a30)",
                        opacity: 0.9,
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: 520,
                        height: 630,
                        display: "flex",
                        backgroundImage: `linear-gradient(90deg, ${BACKGROUND} 0%, rgba(11,15,13,0.82) 30%, rgba(11,15,13,0.35) 70%, rgba(11,15,13,0.15) 100%)`,
                    }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <svg
                        width="44"
                        height="44"
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
                    <div style={{ fontSize: 40, fontWeight: 700, color: FOREGROUND }}>OpenFarm</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
                    <div
                        style={{
                            fontSize: 62,
                            fontWeight: 700,
                            color: FOREGROUND,
                            lineHeight: 1.1,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        {t("ogHeadline")}
                    </div>
                    <div style={{ fontSize: 28, color: MUTED, marginTop: 24, lineHeight: 1.4 }}>
                        {t("ogSubhead")}
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 20,
                        borderTop: `1px solid ${BORDER}`,
                        paddingTop: 24,
                        fontSize: 22,
                        color: MUTED,
                    }}
                >
                    <span style={{ color: PRIMARY }}>openfarm.earth</span>
                    <span>BSD-3-Clause</span>
                    <span>Self-hostable</span>
                </div>
            </div>
        ),
        { ...SIZE },
    );
}
