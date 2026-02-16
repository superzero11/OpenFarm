/** @type {import('next').NextConfig} */

const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/*
 * CSP per PRD §7.6 with necessary runtime additions:
 *  - 'unsafe-inline' in script-src: Next.js injects inline <script> tags
 *  - 'unsafe-eval' in script-src: MapLibre GL JS uses new Function()
 *  - 'unsafe-inline' in style-src: Next.js + MapLibre dynamic styles
 *  - OSM tile domains: fallback when PMTiles basemap is not configured
 *  - Google domains: OAuth sign-in flow + profile images
 *  - MapLibre demo glyphs: font rendering for map labels
 */
const TITILER = process.env.NEXT_PUBLIC_TITILER_URL || "";
const PROTOMAPS = process.env.NEXT_PUBLIC_PROTOMAPS_URL || "";
const API_RAW = process.env.NEXT_PUBLIC_API_URL || "";
const MINIO_RAW = process.env.NEXT_PUBLIC_MINIO_URL || "";

// CSP needs origins only (no paths) — extract scheme+host+port
function toOrigin(url) {
    try { return new URL(url).origin; } catch { return ""; }
}
const API = toOrigin(API_RAW);
const PROTOMAPS_ORIGIN = toOrigin(PROTOMAPS);
const MINIO = toOrigin(MINIO_RAW);

const nextConfig = {
    output: "standalone",
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                            "style-src 'self' 'unsafe-inline'",
                            `img-src 'self' blob: data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.tile.opentopomap.org https://server.arcgisonline.com https://*.basemaps.cartocdn.com https://lh3.googleusercontent.com ${API} ${TITILER} ${PROTOMAPS_ORIGIN} ${MINIO}`.trim(),
                            `connect-src 'self' https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.tile.opentopomap.org https://server.arcgisonline.com https://*.basemaps.cartocdn.com https://nominatim.openstreetmap.org https://demotiles.maplibre.org https://accounts.google.com ${API} ${TITILER} ${PROTOMAPS_ORIGIN} ${MINIO}`.trim(),
                            "worker-src 'self' blob:",
                            "child-src 'self' blob:",
                            "form-action 'self' https://accounts.google.com",
                            "frame-ancestors 'none'",
                        ].join("; "),
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "X-Frame-Options",
                        value: "DENY",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
                    },
                ],
            },
        ];
    },
};

module.exports = withNextIntl(nextConfig);
