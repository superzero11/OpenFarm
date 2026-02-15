"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
    Leaf,
    Satellite,
    Map,
    Bell,
    Share2,
    Plus,
    BarChart3,
    Zap,
    ArrowRight,
    Github,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignInModal } from "@/components/sign-in-modal";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
    const t = useTranslations("landing");
    const tc = useTranslations("common");
    const searchParams = useSearchParams();
    const [signInOpen, setSignInOpen] = useState(false);

    // Auto-open modal when redirected with ?signin=true (e.g. from auth guard)
    useEffect(() => {
        if (searchParams.get("signin") === "true" && !isAuthenticated) {
            setSignInOpen(true);
        }
    }, [searchParams, isAuthenticated]);

    const FEATURES_T = [
        { icon: Satellite, title: t("feature1Title"), description: t("feature1Desc") },
        { icon: Map, title: t("feature2Title"), description: t("feature2Desc") },
        { icon: Bell, title: t("feature3Title"), description: t("feature3Desc") },
        { icon: Share2, title: t("feature4Title"), description: t("feature4Desc") },
    ];

    const STEPS_T = [
        { step: "1", icon: Plus, title: t("step1Title"), description: t("step1Desc") },
        { step: "2", icon: BarChart3, title: t("step2Title"), description: t("step2Desc") },
        { step: "3", icon: Zap, title: t("step3Title"), description: t("step3Desc") },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            {/* ── Navbar ─────────────────────────────────────────── */}
            <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
                <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-lg font-bold"
                    >
                        <Leaf className="h-7 w-7 text-primary" />
                        OpenFarm
                    </Link>

                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" asChild>
                            <a
                                href="https://github.com/superzero11/OpenFarm"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Github className="h-4 w-4" />
                                <span className="ml-2 hidden sm:inline">
                                    {tc("github")}
                                </span>
                            </a>
                        </Button>
                        <Button size="sm" asChild>
                            {isAuthenticated ? (
                                <Link href="/dashboard">{tc("dashboard")}</Link>
                            ) : (
                                <button onClick={() => setSignInOpen(true)}>{tc("signIn")}</button>
                            )}
                        </Button>
                    </div>
                </nav>
            </header>

            {/* ── Hero ───────────────────────────────────────────── */}
            <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-24 text-center lg:pb-28 lg:pt-32">
                <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
                    <Satellite className="h-4 w-4" />
                    {t("badge")}
                </div>

                <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                    {t("heroTitle1")}
                    <br />
                    <span className="text-primary">{t("heroTitle2")}</span>
                </h1>

                <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
                    {t("heroDesc")}
                </p>

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                    <Button size="lg" asChild>
                        {isAuthenticated ? (
                            <Link href="/dashboard">
                                {tc("dashboard")}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        ) : (
                            <button onClick={() => setSignInOpen(true)}>
                                {tc("getStarted")}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </button>
                        )}
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                        <a
                            href="https://github.com/superzero11/OpenFarm"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Github className="mr-2 h-4 w-4" />
                            {t("viewOnGithub")}
                        </a>
                    </Button>
                </div>
            </section>

            {/* ── Features ───────────────────────────────────────── */}
            <section className="border-t bg-muted/30">
                <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            {t("featuresTitle")}
                        </h2>
                        <p className="mt-3 text-muted-foreground">
                            {t("featuresSub")}
                        </p>
                    </div>

                    <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {FEATURES_T.map((feature) => (
                            <Card
                                key={feature.title}
                                className="border bg-background transition-shadow hover:shadow-md"
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <feature.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <CardTitle className="mt-3 text-base font-semibold">
                                        {feature.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-sm leading-relaxed">
                                        {feature.description}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How It Works ───────────────────────────────────── */}
            <section>
                <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            {t("stepsTitle")}
                        </h2>
                        <p className="mt-3 text-muted-foreground">
                            {t("stepsSub")}
                        </p>
                    </div>

                    <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
                        {STEPS_T.map((step, i) => (
                            <div
                                key={step.title}
                                className="relative flex flex-col items-center text-center"
                            >
                                {i < STEPS_T.length - 1 && (
                                    <ChevronRight className="absolute -right-5 top-6 hidden h-5 w-5 text-muted-foreground/40 md:block" />
                                )}

                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                                    {step.step}
                                </div>

                                <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                    <step.icon className="h-5 w-5 text-muted-foreground" />
                                </div>

                                <h3 className="mt-4 text-base font-semibold">
                                    {step.title}
                                </h3>
                                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ────────────────────────────────────────────── */}
            <section className="border-t bg-muted/30">
                <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-20 text-center lg:py-28">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        {t("ctaTitle")}
                    </h2>
                    <p className="mt-3 max-w-lg text-muted-foreground">
                        {t("ctaDesc")}
                    </p>
                    <Button size="lg" className="mt-8" asChild>
                        {isAuthenticated ? (
                            <Link href="/dashboard">
                                {tc("dashboard")}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        ) : (
                            <button onClick={() => setSignInOpen(true)}>
                                {t("ctaButton")}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </button>
                        )}
                    </Button>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────────────── */}
            <footer className="border-t">

                {/* Sign-in modal */}
                {!isAuthenticated && (
                    <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
                )}
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Leaf className="h-4 w-4 text-primary" />
                        {tc("builtWith")}
                    </div>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher side="top" align="end" />
                        <ThemeToggle />
                        <a
                            href="https://github.com/superzero11/OpenFarm"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {tc("github")}
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
