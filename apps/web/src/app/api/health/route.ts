import { NextResponse } from "next/server";
import { logger as rootLogger } from "@/lib/logger";

const logger = rootLogger.child({ component: "health" });

/**
 * GET /api/health
 *
 * Health check - verifies API service reachability.
 */
export async function GET() {
    // Use INTERNAL_API_URL for server-side (container-to-container) requests,
    // fall back to NEXT_PUBLIC_API_URL for local dev outside Docker.
    const apiUrl =
        process.env.INTERNAL_API_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://api:8000";
    const errors: string[] = [];

    try {
        const res = await fetch(`${apiUrl.replace("/v1", "")}/healthz`, {
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) {
            errors.push(`api: status ${res.status}`);
        }
    } catch (e: any) {
        errors.push(`api: ${e.message}`);
    }

    if (errors.length > 0) {
        logger.warn({ errors }, "health_check_failed");
        return NextResponse.json({ status: "unhealthy", errors }, { status: 503 });
    }

    return NextResponse.json({ status: "ok" });
}
