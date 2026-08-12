/**
 * Canonical identity of this deployment.
 *
 * Metadata, canonicals, hreflang, sitemap, robots, structured data and
 * llms.txt all read from here, so a self-hosted instance describes
 * itself correctly by setting NEXT_PUBLIC_SITE_URL and nothing else.
 *
 * The fallback is localhost on purpose. Defaulting to openfarm.earth
 * would make every unconfigured deployment publish canonicals pointing
 * at our domain, telling search engines their pages are duplicates of
 * ours. Wrong-but-local is a safer failure than wrong-and-someone-else.
 */

/** No trailing slash: everything below concatenates paths onto this. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/+$/,
    "",
);

export const SITE_NAME = "OpenFarm";
export const REPO_URL = "https://github.com/superzero11/OpenFarm";
export const DISCORD_URL = "https://discord.gg/KM9qxpEmsU";

/**
 * The entity graph an answer engine needs to tell this OpenFarm apart
 * from the unrelated projects that share the name. Keep the category
 * phrase ("crop intelligence platform") identical everywhere it appears.
 */
export const SAME_AS = [REPO_URL, DISCORD_URL];

/** Locale to Open Graph locale. Keys must match i18n/routing.ts. */
export const OG_LOCALE: Record<string, string> = {
    en: "en_US",
    es: "es_ES",
};

/**
 * Absolute URL for a locale-prefixed path, honouring localePrefix
 * "as-needed". No trailing slash on the root, so the canonical tag and
 * the sitemap entry are byte-identical rather than two spellings of the
 * same page.
 */
export function localeUrl(locale: string, path = "/"): string {
    const clean = path === "/" ? "" : path.replace(/\/+$/, "");
    return locale === "en" ? `${SITE_URL}${clean}` : `${SITE_URL}/${locale}${clean}`;
}
