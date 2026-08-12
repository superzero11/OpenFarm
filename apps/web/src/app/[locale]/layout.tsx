import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "../globals.css";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/toast-provider";
import { MapAbortSuppressor } from "@/components/map/abort-suppressor";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { OG_LOCALE, SITE_NAME, SITE_URL, localeUrl } from "@/lib/site";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import NextTopLoader from "nextjs-toploader";

const sans = IBM_Plex_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    variable: "--font-mono",
});

export async function generateMetadata({
    params,
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const { locale } = params;
    const t = await getTranslations({ locale, namespace: "seo" });

    /* One canonical per locale, every locale cross-linked. localePrefix is
       "as-needed", so en lives at the root and x-default points there. */
    const languages = Object.fromEntries(
        routing.locales.map((l) => [l, localeUrl(l)]),
    ) as Record<string, string>;

    /* Served from app/og-<locale>.png, not the opengraph-image file
       convention: that convention would advertise /en/opengraph-image for
       the default locale, which redirects, and would pin one alt text
       across every language. */
    const ogImage = {
        url: `${SITE_URL}/og-${locale}.png`,
        width: 1200,
        height: 630,
        alt: t("ogAlt"),
        type: "image/png",
    };

    return {
        metadataBase: new URL(SITE_URL),
        title: {
            default: t("title"),
            template: `%s | ${SITE_NAME}`,
        },
        description: t("description"),
        applicationName: SITE_NAME,
        category: "agriculture",
        alternates: {
            canonical: localeUrl(locale),
            languages: { ...languages, "x-default": localeUrl(routing.defaultLocale) },
        },
        openGraph: {
            type: "website",
            siteName: SITE_NAME,
            title: t("title"),
            description: t("description"),
            url: localeUrl(locale),
            locale: OG_LOCALE[locale] ?? OG_LOCALE.en,
            images: [ogImage],
            alternateLocale: routing.locales
                .filter((l) => l !== locale)
                .map((l) => OG_LOCALE[l] ?? OG_LOCALE.en),
        },
        twitter: {
            card: "summary_large_image",
            title: t("title"),
            description: t("description"),
            images: [ogImage],
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                "max-snippet": -1,
                "max-image-preview": "large",
                "max-video-preview": -1,
            },
        },
        icons: {
            icon: [
                { url: "/favicon.svg", type: "image/svg+xml" },
            ],
            apple: "/apple-icon",
        },
    };
}

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { locale: string };
}) {
    const { locale } = params;

    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    setRequestLocale(locale);
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
            <body className="min-h-screen antialiased">
                <NextTopLoader color="hsl(142, 71%, 45%)" showSpinner={false} />
                <NextIntlClientProvider messages={messages}>
                    <Providers>
                        <MapAbortSuppressor />
                        {children}
                        <ToastProvider />
                    </Providers>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
