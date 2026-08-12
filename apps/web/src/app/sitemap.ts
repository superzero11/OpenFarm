import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { localeUrl } from "@/lib/site";

/**
 * Only the public surface belongs here. Every other route is either
 * behind a session or scoped to a share token, and robots.ts blocks
 * both. Each entry carries its hreflang alternates so the two locales
 * are read as one page in two languages, not as duplicates.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const languages = Object.fromEntries(
        routing.locales.map((l) => [l, localeUrl(l)]),
    ) as Record<string, string>;

    return routing.locales.map((locale) => ({
        url: localeUrl(locale),
        changeFrequency: "weekly" as const,
        priority: locale === routing.defaultLocale ? 1 : 0.8,
        alternates: { languages },
    }));
}
