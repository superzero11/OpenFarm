import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/landing-page";
import { setRequestLocale } from "next-intl/server";

export default async function Home({ params }: { params: { locale: string } }) {
    setRequestLocale(params.locale);
    const session = await getServerSession(authOptions);

    return <LandingPage isAuthenticated={!!session} />;
}
