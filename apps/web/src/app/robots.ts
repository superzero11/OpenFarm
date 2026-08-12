import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Crawl policy.
 *
 * The marketing page is open to everyone, including the AI crawlers, on
 * purpose: being quoted by an answer engine is how a self-hostable
 * project gets found. What is closed is anything behind a session and
 * anything token-scoped. Share reports in particular must never be
 * indexed - the token is the only thing protecting a grower's field
 * boundaries, and a search result would hand it to everyone.
 */
export default function robots(): MetadataRoute.Robots {
    const disallow = ["/api/", "/dashboard", "/farms", "/alerts", "/settings", "/changelog", "/share/"];

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow,
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
