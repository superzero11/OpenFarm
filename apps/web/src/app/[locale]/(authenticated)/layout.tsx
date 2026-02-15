import { redirect } from "@/i18n/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppShell } from "./app-shell";

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
