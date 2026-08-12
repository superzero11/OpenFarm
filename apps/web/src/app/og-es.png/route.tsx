import { renderOgCard } from "@/components/marketing/og-card";

/* Dotted path on purpose: the i18n middleware matcher skips anything
   containing a dot, so this serves directly with no locale redirect,
   and it sits outside /api/ which robots.txt disallows. */
export const dynamic = "force-static";

export function GET() {
    return renderOgCard("es");
}
