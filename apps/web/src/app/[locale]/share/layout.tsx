import type { Metadata } from "next";

/**
 * A share token is the only thing standing between a public URL and a
 * grower's field boundaries, yields and scouting photos. Indexing one
 * would publish it to everyone who searches, so every share route is
 * noindex regardless of how a crawler reached it. robots.txt disallows
 * /share/ as well; this covers crawlers that ignore it.
 */
export const metadata: Metadata = {
    robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
