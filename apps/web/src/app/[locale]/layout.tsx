import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "../globals.css";
import { Providers } from "@/components/providers";
import { ToastProvider } from "@/components/toast-provider";
import { MapAbortSuppressor } from "@/components/map/abort-suppressor";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
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

export const metadata: Metadata = {
    title: "OpenFarm",
    description: "Open Intelligence for Every Farm",
    icons: {
        icon: [
            { url: "/favicon.svg", type: "image/svg+xml" },
        ],
        apple: "/apple-icon",
    },
};

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
