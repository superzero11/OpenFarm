import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/landing-page";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FAQ_IDS } from "@/lib/faq";
import { DISCORD_URL, REPO_URL, SAME_AS, SITE_NAME, SITE_URL, localeUrl } from "@/lib/site";

/**
 * Structured data for the landing page, rendered into the initial HTML so
 * crawlers that do not execute JavaScript still get it.
 *
 * The graph answers three questions an engine has to resolve before it
 * will cite us: what this thing is (SoftwareApplication), who publishes
 * it (Organization, with sameAs so the entity resolves to our GitHub and
 * Discord rather than to unrelated projects sharing the name OpenFarm),
 * and what it already answers (FAQPage, built from the same strings the
 * visible section renders).
 */
async function buildJsonLd(locale: string) {
    const t = await getTranslations({ locale, namespace: "seo" });
    const faq = await getTranslations({ locale, namespace: "faq" });
    const url = localeUrl(locale);

    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: SITE_NAME,
                url: SITE_URL,
                logo: `${SITE_URL}/icon`,
                description: t("description"),
                sameAs: SAME_AS,
            },
            {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                name: SITE_NAME,
                url: SITE_URL,
                inLanguage: locale,
                publisher: { "@id": `${SITE_URL}/#organization` },
            },
            {
                "@type": "SoftwareApplication",
                "@id": `${SITE_URL}/#software`,
                name: SITE_NAME,
                url,
                applicationCategory: "BusinessApplication",
                applicationSubCategory: t("category"),
                operatingSystem: "Docker, Linux",
                description: t("longDescription"),
                inLanguage: locale,
                isAccessibleForFree: true,
                license: "https://opensource.org/license/bsd-3-clause",
                codeRepository: REPO_URL,
                offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "USD",
                },
                featureList: t("featureList")
                    .split("|")
                    .map((f) => f.trim()),
                publisher: { "@id": `${SITE_URL}/#organization` },
                /* What the numbers are computed from. Naming the sources is
                   what lets an engine treat our claims as grounded. */
                isBasedOn: [
                    { "@type": "Dataset", name: "Copernicus Sentinel-2", url: "https://dataspace.copernicus.eu" },
                    { "@type": "Dataset", name: "Open-Meteo", url: "https://open-meteo.com" },
                    { "@type": "Dataset", name: "ISRIC SoilGrids", url: "https://soilgrids.org" },
                ],
                discussionUrl: DISCORD_URL,
            },
            {
                "@type": "FAQPage",
                "@id": `${url}#faq`,
                inLanguage: locale,
                mainEntity: FAQ_IDS.map((id) => ({
                    "@type": "Question",
                    name: faq(`${id}.q`),
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: faq(`${id}.a`),
                    },
                })),
            },
        ],
    };
}

export default async function Home({ params }: { params: { locale: string } }) {
    setRequestLocale(params.locale);
    const session = await getServerSession(authOptions);
    const jsonLd = await buildJsonLd(params.locale);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <LandingPage isAuthenticated={!!session} />
        </>
    );
}
