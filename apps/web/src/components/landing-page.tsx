"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
    Leaf,
    ArrowRight,
    ArrowUp,
    Github,
    ShieldAlert,
    CloudRain,
    Sun,
    Droplets,
    TriangleAlert,
    Check,
    Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignInModal } from "@/components/sign-in-modal";

/* ------------------------------------------------------------------ */
/*  Demo raster data                                                    */
/*                                                                      */
/*  Deterministic pseudo-rasters (no randomness: values must be stable  */
/*  across server and client renders). The colour stops are the rdylgn  */
/*  and rdbu scientific colormaps - the same ramps as the ramp tokens   */
/*  and the TiTiler colormap, discretised for per-cell rendering. They  */
/*  are raster data colours, not UI chrome.                             */
/* ------------------------------------------------------------------ */

const RDYLGN = [
    "#a50026", "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf",
    "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850", "#006837",
];
const RDBU = [
    "#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7",
    "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061",
];

/** Base NDVI-like field: healthy west, stressed patch in the north-east. */
const BASE_FIELD: number[][] = [
    [0.62, 0.66, 0.70, 0.64, 0.52, 0.34, 0.22, 0.18],
    [0.68, 0.72, 0.74, 0.68, 0.55, 0.38, 0.26, 0.24],
    [0.70, 0.75, 0.78, 0.72, 0.62, 0.48, 0.40, 0.36],
    [0.66, 0.72, 0.76, 0.74, 0.68, 0.60, 0.55, 0.50],
    [0.60, 0.68, 0.72, 0.70, 0.66, 0.62, 0.58, 0.54],
];

function rampColor(value01: number, stops: string[]): string {
    const i = Math.min(stops.length - 1, Math.max(0, Math.round(value01 * (stops.length - 1))));
    return stops[i];
}

function PseudoRaster({
    scale = 1,
    offset = 0,
    water = false,
    className = "",
}: {
    scale?: number;
    offset?: number;
    water?: boolean;
    className?: string;
}) {
    return (
        <div className={`grid grid-cols-8 overflow-hidden rounded-md ${className}`} aria-hidden="true">
            {BASE_FIELD.flatMap((row, y) =>
                row.map((v, x) => {
                    const value = Math.min(1, Math.max(0, v * scale + offset));
                    return (
                        <div
                            key={`${y}-${x}`}
                            className="aspect-square"
                            style={{ background: rampColor(water ? 1 - value : value, water ? RDBU : RDYLGN) }}
                        />
                    );
                }),
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Section scaffolding                                                 */
/* ------------------------------------------------------------------ */

function SectionHeader({ tag, title, desc }: { tag: string; title: string; desc: string }) {
    return (
        <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{tag}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
    const t = useTranslations("landing");
    const tc = useTranslations("common");
    const searchParams = useSearchParams();
    const [signInOpen, setSignInOpen] = useState(false);

    useEffect(() => {
        if (searchParams.get("signin") === "true" && !isAuthenticated) {
            setSignInOpen(true);
        }
    }, [searchParams, isAuthenticated]);

    const openApp = () => setSignInOpen(true);

    const INDEX_CARDS = [
        { name: "NDVI", value: "0.703", label: t("ndviLabel"), range: "-0.2 - 0.9", scale: 1, water: false },
        { name: "EVI", value: "0.541", label: t("eviLabel"), range: "-0.2 - 0.8", scale: 0.82, water: false },
        { name: "SAVI", value: "0.488", label: t("saviLabel"), range: "-0.2 - 0.8", scale: 0.72, water: false },
        { name: "NDWI", value: "0.118", label: t("ndwiLabel"), range: "-0.5 - 0.5", scale: 0.9, water: true },
    ];

    const SEASON = [
        { date: "14 Oct", value: "0.24", scale: 0.35 },
        { date: "21 Nov", value: "0.38", scale: 0.55 },
        { date: "28 Dec", value: "0.61", scale: 0.85 },
        { date: "14 Jan", value: "0.71", scale: 1.0 },
        { date: "08 Feb", value: "0.70", scale: 0.97 },
        { date: "02 Mar", value: "0.52", scale: 0.72 },
    ];

    const PLANES = [
        { name: t("layerBoundaries"), desc: t("layerBoundariesDesc"), color: "bg-primary" },
        { name: t("layerSatellite"), desc: t("layerSatelliteDesc"), color: "bg-sig-vegetation" },
        { name: t("layerWeather"), desc: t("layerWeatherDesc"), color: "bg-sig-precip" },
        { name: t("layerSoil"), desc: t("layerSoilDesc"), color: "bg-soil-clay" },
    ];

    const REPRO_STEPS = [
        { n: "01", title: t("repro1Title"), desc: t("repro1Desc") },
        { n: "02", title: t("repro2Title"), desc: t("repro2Desc") },
        { n: "03", title: t("repro3Title"), desc: t("repro3Desc") },
        { n: "04", title: t("repro4Title"), desc: t("repro4Desc") },
    ];

    const SOIL_DEPTHS = [
        { depth: "0-5 cm", ph: "pH 5.3", sand: 45, silt: 35, clay: 20 },
        { depth: "5-15", ph: "pH 5.6", sand: 40, silt: 35, clay: 25 },
        { depth: "15-30", ph: "pH 6.1", sand: 35, silt: 35, clay: 30 },
        { depth: "30-60", ph: "pH 6.4", sand: 28, silt: 34, clay: 38 },
        { depth: "60-100", ph: "pH 6.6", sand: 25, silt: 33, clay: 42 },
    ];

    const HOST_POINTS = [t("host1"), t("host2"), t("host3"), t("host4")];

    const STATS = [
        { value: "4", label: t("stat1Label") },
        { value: "68", label: t("stat2Label") },
        { value: "24 mo", label: t("stat3Label") },
        { value: "10 m", label: t("stat4Label") },
        { value: "0", label: t("stat5Label") },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            {/* ── Navbar ─────────────────────────────────────────── */}
            <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
                <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                        <Leaf className="h-6 w-6 text-primary" strokeWidth={1.5} />
                        OpenFarm
                    </Link>

                    <div className="hidden items-center gap-1 md:flex">
                        <Button variant="ghost" size="sm" asChild>
                            <a href="#how-it-works">{t("navHow")}</a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                            <a href="#architecture">{t("navArchitecture")}</a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                            <a href="#self-host">{t("navSelfHost")}</a>
                        </Button>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" asChild>
                            <a href="https://github.com/superzero11/OpenFarm" target="_blank" rel="noopener noreferrer">
                                <Github className="h-4 w-4" />
                                <span className="ml-2 hidden sm:inline">{tc("github")}</span>
                            </a>
                        </Button>
                        <Button size="sm" asChild>
                            {isAuthenticated ? (
                                <Link href="/dashboard">{tc("dashboard")}</Link>
                            ) : (
                                <button onClick={openApp}>{tc("signIn")}</button>
                            )}
                        </Button>
                    </div>
                </nav>
            </header>

            {/* ── Hero ───────────────────────────────────────────── */}
            <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-2 lg:pb-24 lg:pt-24">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border bg-surface-2 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                        {t("badge")}
                    </div>

                    <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                        {t("heroTitle1")} <span className="text-primary">{t("heroTitle2")}</span>
                    </h1>

                    <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
                        {t("heroDesc")}
                    </p>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Button size="lg" asChild>
                            <a href="https://github.com/superzero11/OpenFarm" target="_blank" rel="noopener noreferrer">
                                {t("deployCta")}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                        <Button variant="outline" size="lg" asChild>
                            {isAuthenticated ? (
                                <Link href="/dashboard">{t("demoCta")}</Link>
                            ) : (
                                <button onClick={openApp}>{t("demoCta")}</button>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Explainability card - the product promise in one panel */}
                <div className="rounded-xl border bg-surface-3 shadow-panel">
                    <div className="flex items-center justify-between border-b p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("cardField")}
                        </p>
                        <p className="font-mono text-[11px] text-muted-foreground">{t("cardDate")}</p>
                    </div>

                    <div className="p-4">
                        <div className="flex items-start gap-2">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sev-high" />
                            <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sev-high">
                                {t("cardSeverity")}
                            </span>
                            <p className="text-sm font-medium leading-snug">{t("cardAlert")}</p>
                        </div>

                        {/* Season sparkline with the drop */}
                        <div className="mt-4">
                            <svg viewBox="0 0 300 60" className="h-16 w-full" aria-hidden="true">
                                <polyline
                                    points="0,34 50,26 100,18 150,14 200,15 250,16 300,40"
                                    fill="none"
                                    stroke="hsl(var(--sig-vegetation))"
                                    strokeWidth="2"
                                />
                                <circle cx="200" cy="15" r="3" fill="hsl(var(--sig-vegetation))" />
                                <circle cx="300" cy="40" r="4" fill="hsl(var(--danger))" />
                            </svg>
                            <p className="text-right font-mono text-[11px] text-muted-foreground">{t("cardAnnotation")}</p>
                        </div>
                    </div>

                    <div className="border-t p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("whyTitle")}
                        </p>
                        <div className="mt-3 space-y-2 text-[13px]">
                            <div className="flex items-center gap-2">
                                <CloudRain className="h-4 w-4 text-sig-precip" />
                                <span className="text-muted-foreground">{t("whyRain")}</span>
                                <span className="ml-auto font-mono tabular-nums">2 mm</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Sun className="h-4 w-4 text-sig-et0" />
                                <span className="text-muted-foreground">{t("whyEt")}</span>
                                <span className="ml-auto font-mono tabular-nums">31 mm</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-sig-water" />
                                <span className="text-muted-foreground">{t("whyBalance")}</span>
                                <span className="ml-auto font-mono tabular-nums text-danger">-29 mm</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 pt-0">
                        <div className="flex items-start gap-2 rounded-lg border bg-warning-subtle p-3 text-[13px] text-warning">
                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            {t("cardVerdict")}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Stats strip ────────────────────────────────────── */}
            <section className="border-y bg-surface-2">
                <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-5">
                    {STATS.map((s) => (
                        <div key={s.label}>
                            <p className="font-mono text-2xl font-bold tabular-nums">{s.value}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Multi-index ────────────────────────────────────── */}
            <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
                <SectionHeader tag={t("multiTag")} title={t("multiTitle")} desc={t("multiDesc")} />

                <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {INDEX_CARDS.map((c) => (
                        <div key={c.name} className="overflow-hidden rounded-lg border bg-card shadow-sm">
                            <PseudoRaster scale={c.scale} water={c.water} />
                            <div className="p-4">
                                <div className="flex items-baseline justify-between">
                                    <p className="text-xs font-semibold">{c.name}</p>
                                    <p className="font-mono text-sm font-bold tabular-nums">{c.value}</p>
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.label}</p>
                                <div
                                    className="mt-3 h-1.5 rounded-full"
                                    style={{ background: c.water ? "var(--ramp-water)" : "var(--ramp-vegetation)" }}
                                    aria-hidden="true"
                                />
                                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{c.range}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="mt-6 flex items-start gap-2 text-[13px] text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    {t("multiCaption")}
                </p>
            </section>

            {/* ── Season timeline ────────────────────────────────── */}
            <section className="border-t bg-surface-2">
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <SectionHeader tag={t("seasonTag")} title={t("seasonTitle")} desc={t("seasonDesc")} />

                    <div className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-6">
                        {SEASON.map((s) => (
                            <div key={s.date} className="overflow-hidden rounded-lg border bg-card shadow-sm">
                                <PseudoRaster scale={s.scale} />
                                <div className="flex items-baseline justify-between p-2">
                                    <p className="font-mono text-[11px] text-muted-foreground">{s.date}</p>
                                    <p className="font-mono text-[11px] font-semibold tabular-nums">{s.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Three layers ───────────────────────────────────── */}
            <section id="architecture" className="mx-auto grid w-full max-w-6xl scroll-mt-20 gap-12 px-6 py-20 lg:grid-cols-2">
                <div>
                    <SectionHeader tag={t("layersTag")} title={t("layersTitle")} desc={t("layersDesc")} />

                    <div className="mt-8 space-y-4">
                        {PLANES.map((p) => (
                            <div key={p.name} className="flex items-start gap-3">
                                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${p.color}`} aria-hidden="true" />
                                <div>
                                    <p className="text-sm font-semibold">{p.name}</p>
                                    <p className="text-[13px] text-muted-foreground">{p.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col justify-center gap-2">
                    <div className="rounded-lg border bg-card p-3 shadow-sm">
                        <p className="text-[13px]">
                            <span className="mr-2 rounded bg-primary-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">C</span>
                            {t("layerC")}
                        </p>
                    </div>
                    <ArrowUp className="mx-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div className="rounded-lg border bg-card p-3 shadow-sm">
                        <p className="text-[13px]">
                            <span className="mr-2 rounded bg-primary-subtle px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">B</span>
                            {t("layerB")}
                        </p>
                    </div>
                    <ArrowUp className="mx-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div className="rounded-lg border bg-surface-2 p-3">
                        <div className="grid grid-cols-4 gap-2">
                            {PLANES.map((p) => (
                                <div key={p.name} className="rounded-md border bg-card p-2 text-center">
                                    <span className={`mx-auto block h-2 w-2 rounded-sm ${p.color}`} aria-hidden="true" />
                                    <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{p.name.toLowerCase()}</p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground">{t("layerA")}</p>
                    </div>
                </div>
            </section>

            {/* ── Reproducible ───────────────────────────────────── */}
            <section className="border-t bg-surface-2">
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <SectionHeader tag={t("reproTag")} title={t("reproTitle")} desc={t("reproDesc")} />

                    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {REPRO_STEPS.map((s) => (
                            <div key={s.n} className="rounded-lg border bg-card p-4 shadow-sm">
                                <p className="font-mono text-[11px] font-semibold text-primary">{s.n}</p>
                                <p className="mt-2 text-sm font-semibold">{s.title}</p>
                                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>
                            </div>
                        ))}
                    </div>

                    <p className="mt-6 flex items-start gap-2 text-[13px] text-muted-foreground">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        {t("reproNote")}
                    </p>
                </div>
            </section>

            {/* ── Soil by depth ──────────────────────────────────── */}
            <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
                <div>
                    <SectionHeader tag={t("soilTag")} title={t("soilTitle")} desc={t("soilDesc")} />

                    <div className="mt-6 flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-sm bg-soil-sand" aria-hidden="true" /> {t("soilSand")}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-sm bg-soil-silt" aria-hidden="true" /> {t("soilSilt")}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-sm bg-soil-clay" aria-hidden="true" /> {t("soilClay")}
                        </span>
                        <span className="ml-auto font-mono">{t("soilSource")}</span>
                    </div>
                </div>

                <div className="rounded-lg border bg-card p-5 shadow-sm">
                    <div className="space-y-2.5">
                        {SOIL_DEPTHS.map((d) => (
                            <div key={d.depth} className="flex items-center gap-3">
                                <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                                    {d.depth}
                                </span>
                                <div className="flex h-4 flex-1 overflow-hidden rounded-sm">
                                    <div className="bg-soil-sand" style={{ width: `${d.sand}%` }} />
                                    <div className="bg-soil-silt" style={{ width: `${d.silt}%` }} />
                                    <div className="bg-soil-clay" style={{ width: `${d.clay}%` }} />
                                </div>
                                <span className="w-14 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                                    {d.ph}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-[13px] text-muted-foreground">{t("soilCaption")}</p>
                </div>
            </section>

            {/* ── Self-host ──────────────────────────────────────── */}
            <section id="self-host" className="border-t bg-surface-2">
                <div className="mx-auto grid w-full max-w-6xl scroll-mt-20 items-center gap-12 px-6 py-20 lg:grid-cols-2">
                    <div>
                        <SectionHeader tag={t("hostTag")} title={t("hostTitle")} desc={t("hostDesc")} />

                        <ul className="mt-6 space-y-2.5">
                            {HOST_POINTS.map((p) => (
                                <li key={p} className="flex items-start gap-2 text-sm">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                                    {p}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-xl border bg-surface-3 shadow-panel">
                        <div className="flex items-center gap-1.5 border-b px-4 py-3">
                            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground">bash</span>
                        </div>
                        <div className="space-y-1.5 p-4 font-mono text-[13px] leading-relaxed">
                            <p className="text-muted-foreground"># clone, configure, run</p>
                            <p>
                                <span className="text-primary">git</span> clone github.com/superzero11/OpenFarm
                            </p>
                            <p>
                                <span className="text-primary">cp</span> .env.example .env
                            </p>
                            <p>
                                <span className="text-primary">docker</span> compose up --build
                            </p>
                            <p className="text-muted-foreground"># web :3000 · API :8000 · tiles :8080</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────────────── */}
            <footer className="border-t">
                {!isAuthenticated && <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />}

                <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10">
                    <p className="text-lg font-semibold tracking-tight">{t("footerLine")}</p>
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
