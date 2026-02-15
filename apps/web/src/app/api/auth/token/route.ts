import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { SignJWT } from "jose";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";

const JWT_SECRET = new TextEncoder().encode(
    process.env.OPENFARM_JWT_SECRET || "change-me"
);
const JWT_TTL_SECONDS = 3600; // 1 hour

/**
 * POST /api/auth/token
 *
 * Mints an OpenFarm API JWT for the authenticated user.
 * Authenticated by the NextAuth session cookie.
 *
 * Returns: { token: string, expires_at: string }
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return NextResponse.json(
            { error: "Not authenticated" },
            { status: 401 }
        );
    }

    const user = session.user as any;
    const now = Math.floor(Date.now() / 1000);
    const exp = now + JWT_TTL_SECONDS;

    try {
        const token = await new SignJWT({
            sub: user.id,
            email: user.email,
            name: user.name,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt(now)
            .setExpirationTime(exp)
            .sign(JWT_SECRET);

        logger.info({ userId: user.id }, "jwt_minted");

        return NextResponse.json({
            token,
            expires_at: new Date(exp * 1000).toISOString(),
        });
    } catch (error) {
        logger.error({ error }, "jwt_mint_failed");
        return NextResponse.json(
            { error: "Failed to mint token" },
            { status: 500 }
        );
    }
}
