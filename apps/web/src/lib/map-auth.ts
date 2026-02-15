/**
 * MapLibre transformRequest helper for JWT-authenticated tile requests.
 *
 * Per PRD: All TiTiler tile requests must include the user's JWT so that
 * only authenticated users can view NDVI imagery. This function is passed
 * to MapLibre's `transformRequest` option to inject the Authorization header
 * on requests to the TiTiler domain.
 */

import type { RequestParameters } from "maplibre-gl";

const TITILER_URL = process.env.NEXT_PUBLIC_TITILER_URL || "http://localhost:8080";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/** Fetch (or re-use) the API JWT from the NextAuth bridge endpoint. */
async function ensureToken(): Promise<string | null> {
    const now = Date.now();
    if (cachedToken && tokenExpiresAt - now > 60_000) {
        return cachedToken;
    }

    try {
        const res = await fetch("/api/auth/token", { method: "POST" });
        if (!res.ok) return null;
        const data = await res.json();
        cachedToken = data.token;
        tokenExpiresAt = new Date(data.expires_at).getTime();
        return cachedToken;
    } catch {
        return null;
    }
}

/**
 * MapLibre transformRequest callback.
 *
 * Adds `Authorization: Bearer <jwt>` header to outgoing requests that
 * target the TiTiler service. Also supports appending the token as a
 * query parameter (`?access_token=<jwt>`) for tile URLs where headers
 * can't be set.
 */
export function createTransformRequest() {
    // Pre-fetch token on creation
    ensureToken();

    return (url: string, resourceType?: string): RequestParameters => {
        // Only transform requests to TiTiler
        if (!url.startsWith(TITILER_URL)) {
            return { url };
        }

        // Append access_token as query param (MapLibre tile requests can't use headers easily)
        if (cachedToken) {
            const separator = url.includes("?") ? "&" : "?";
            return {
                url: `${url}${separator}access_token=${encodeURIComponent(cachedToken)}`,
            };
        }

        return { url };
    };
}

/** Refresh the token used by transformRequest (call periodically). */
export async function refreshMapToken(): Promise<void> {
    await ensureToken();
}
