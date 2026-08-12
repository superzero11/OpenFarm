import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppShell } from "./app-shell";

/* Nothing behind the session is public. robots.txt already disallows
   these paths; the header covers anything that reaches a crawler by
   another route, such as a pasted link. */
export const metadata: Metadata = {
    robots: { index: false, follow: false, nocache: true },
};

export default async function AuthenticatedLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { locale: string };
}) {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect({ href: "/?signin=true", locale: params.locale });
    }

    return <AppShell>{children}</AppShell>;
}
