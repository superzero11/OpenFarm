import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

/**
 * Serve CHANGELOG.md content as JSON.
 * The file lives at the monorepo root — two levels above apps/web.
 */
export async function GET() {
    // In Docker (standalone output), the file is copied to public/ at build time.
    // In dev, resolve relative to the monorepo root.
    const candidates = [
        path.join(process.cwd(), "public", "CHANGELOG.md"),
        path.join(process.cwd(), "..", "..", "CHANGELOG.md"),
    ];

    let content = "";
    for (const p of candidates) {
        try {
            content = fs.readFileSync(p, "utf-8");
            break;
        } catch {
            // try next candidate
        }
    }

    if (!content) {
        return NextResponse.json(
            { error: "Changelog not found" },
            { status: 404 },
        );
    }

    return NextResponse.json(
        { content },
        {
            headers: {
                "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
        },
    );
}
