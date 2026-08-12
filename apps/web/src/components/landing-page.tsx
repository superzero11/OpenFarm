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
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignInModal } from "@/components/sign-in-modal";
import { FieldOutline, FieldRaster, IMAGERY, IMAGERY_FLAT } from "@/components/marketing/scene";
import { BUILT_WITH } from "@/components/marketing/brand-marks";
import { FAQ_IDS } from "@/lib/faq";

const REPO = "https://github.com/superzero11/OpenFarm";
const DISCORD = "https://discord.gg/KM9qxpEmsU";

/* Where the numbers come from. Attribution by name is what these
   providers ask for, and is why they carry no logo here. */
const DATA_SOURCES = [
    { name: "Copernicus Sentinel-2 (ESA)", url: "https://dataspace.copernicus.eu" },
    { name: "Element 84 Earth Search", url: "https://element84.com/earth-search/" },
    { name: "Open-Meteo", url: "https://open-meteo.com" },
    { name: "ISRIC SoilGrids", url: "https://soilgrids.org" },
    { name: "POLARIS", url: "https://registry.opendata.aws/polaris/" },
    { name: "Fields of The World", url: "https://fieldsofthe.world" },
];

/* Load-bearing projects whose marks we cannot ship. */
const ALSO_BUILT_WITH = [
    { name: "PostGIS", url: "https://postgis.net" },
    { name: "TiTiler", url: "https://developmentseed.org/titiler/" },
    { name: "rasterio", url: "https://rasterio.readthedocs.io" },
    { name: "TorchGeo", url: "https://torchgeo.readthedocs.io" },
    { name: "Protomaps", url: "https://protomaps.com" },
    { name: "Auth.js", url: "https://authjs.dev" },
    { name: "next-intl", url: "https://next-intl.dev" },
    { name: "Alembic", url: "https://alembic.sqlalchemy.org" },
];

/* Map chrome: scrims and graticules over imagery, all from --map-scrim. */
const SCRIM_WIDE =
    "linear-gradient(100deg, hsl(var(--map-scrim)) 26%, hsl(var(--map-scrim) / 0.86) 44%, hsl(var(--map-scrim) / 0.35) 66%, hsl(var(--map-scrim) / 0.55) 100%)";
const SCRIM_NARROW =
    "linear-gradient(180deg, hsl(var(--map-scrim) / 0.94) 0%, hsl(var(--map-scrim) / 0.82) 50%, hsl(var(--map-scrim) / 0.94) 100%)";
const GRATICULE =
    "linear-gradient(90deg, hsl(var(--map-scrim) / 0.14) 1px, transparent 1px), linear-gradient(0deg, hsl(var(--map-scrim) / 0.1) 1px, transparent 1px)";

/* ------------------------------------------------------------------ */
/*  Section scaffolding                                                 */
/* ------------------------------------------------------------------ */

function SectionHeader({ tag, title, desc }: { tag: string; title: string; desc: string }) {
    return (
        <div className="max-w-[62ch]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">{tag}</p>
            <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{title}</h2>
            <p className="mt-3.5 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>
        </div>
    );
}

/** The 14-day drop the hero alert is about, with the last clear scene marked. */
function AlertSparkline({ label }: { label: string }) {
    return (
        <svg viewBox="0 0 400 110" className="mt-3.5 block w-full" aria-hidden="true">
            <line x1="4" y1="14" x2="396" y2="14" stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <line x1="4" y1="51" x2="396" y2="51" stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <line x1="4" y1="88" x2="396" y2="88" stroke="hsl(var(--border-strong))" />
            <path
                d="M12 46 L89 35 L167 28 L245 35 L323 56 L389 72 L389 90 L323 76 L245 53 L167 46 L89 53 L12 65 Z"
                fill="hsl(var(--sig-vegetation) / 0.14)"
            />
            <polyline
                points="12,56 89,44 167,37 245,44 323,66 389,81"
                fill="none"
                stroke="hsl(var(--sig-vegetation))"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <line
                x1="245"
                y1="23"
                x2="245"
                y2="98"
                stroke="hsl(var(--border-strong))"
                strokeDasharray="3 3"
            />
            <circle cx="245" cy="44" r="3" fill="hsl(var(--sig-vegetation))" />
            <circle cx="389" cy="81" r="3.5" fill="hsl(var(--danger))" />
            <text
                x="252"
                y="30"
                fill="hsl(var(--muted-foreground))"
                fontFamily="var(--font-mono)"
                fontSize="10"
            >
                {label}
            </text>
        </svg>
    );
}

/** Zonal statistics as the pipeline's last artefact. */
function StatsSparkline() {
    return (
        <svg viewBox="0 0 240 68" className="h-full w-full" aria-hidden="true">
            <line x1="4" y1="10" x2="236" y2="10" stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <line x1="4" y1="36" x2="236" y2="36" stroke="hsl(var(--border))" strokeDasharray="3 4" />
            <line x1="4" y1="60" x2="236" y2="60" stroke="hsl(var(--border-strong))" />
            <polyline
                points="10,48 56,36 102,20 148,26 194,40 232,52"
                fill="none"
                stroke="hsl(var(--sig-vegetation))"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <circle cx="232" cy="52" r="3.5" fill="hsl(var(--sig-vegetation))" />
        </svg>
    );
}

/** One observation plane of layer A, skewed into the stack. */
function Plane({
    label,
    border,
    children,
}: {
    label: string;
    border: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3.5">
            <div
                className={`relative h-[62px] min-w-0 flex-1 overflow-hidden rounded-lg border ${border}`}
                style={{ transform: "skewY(-5deg)" }}
            >
                {children}
            </div>
            <span className="w-[78px] shrink-0 text-right font-mono text-[10.5px] text-muted-foreground">
                {label}
            </span>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export function LandingPage({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
    const t = useTranslations("landing");
    const tf = useTranslations("faq");
    const tc = useTranslations("common");
    const searchParams = useSearchParams();
    const [signInOpen, setSignInOpen] = useState(false);

    useEffect(() => {
        if (searchParams.get("signin") === "true" && !isAuthenticated) {
            setSignInOpen(true);
        }
    }, [searchParams, isAuthenticated]);

    const openApp = () => setSignInOpen(true);

    const NAV = [
        { href: "#how-it-works", label: t("navHow") },
        { href: "#architecture", label: t("navArchitecture") },
        { href: "#self-host", label: t("navSelfHost") },
        { href: "#faq", label: t("navFaq") },
    ];

    /* Facts that stay true as the roadmap adds indices, crops and sensors.
       Nothing here counts something we are actively growing. */
    const STATS = [
        { value: "10 m", label: t("statResolution") },
        { value: "24 mo", label: t("statHistory") },
        { value: "0", label: t("statKeys") },
        { value: "BSD-3", label: t("statLicense") },
    ];

    /* Ranges are the rescale bounds from INDEX_CONFIG, so the ramp on the
       page is the ramp the tiler serves. */
    const INDEX_CARDS = [
        { name: "NDVI", value: 0.703, label: t("ndviLabel"), min: -0.2, max: 0.9, scale: 1, ramp: "vegetation" },
        { name: "EVI", value: 0.541, label: t("eviLabel"), min: -0.2, max: 0.8, scale: 0.82, ramp: "vegetation" },
        { name: "SAVI", value: 0.488, label: t("saviLabel"), min: -0.2, max: 0.8, scale: 0.72, ramp: "vegetation" },
        { name: "NDWI", value: 0.118, label: t("ndwiLabel"), min: -0.5, max: 0.5, scale: 1, ramp: "water" },
    ] as const;

    const SEASON = [
        { date: "14 Oct", value: "0.24", scale: 0.35 },
        { date: "21 Nov", value: "0.38", scale: 0.55 },
        { date: "28 Dec", value: "0.61", scale: 0.85 },
        { date: "14 Jan", value: "0.71", scale: 1.0 },
        { date: "08 Feb", value: "0.70", scale: 0.97 },
        { date: "02 Mar", value: "0.52", scale: 0.72 },
    ];

    const PLANES = [
        { name: t("layerBoundaries"), desc: t("layerBoundariesDesc"), swatch: "bg-primary" },
        { name: t("layerSatellite"), desc: t("layerSatelliteDesc"), swatch: "bg-sig-vegetation" },
        { name: t("layerWeather"), desc: t("layerWeatherDesc"), swatch: "bg-sig-precip" },
        { name: t("layerSoil"), desc: t("layerSoilDesc"), swatch: "bg-soil-sand" },
    ];

    const REPRO_STEPS = [
        { n: "01", title: t("repro1Title"), desc: t("repro1Desc") },
        { n: "02", title: t("repro2Title"), desc: t("repro2Desc") },
        { n: "03", title: t("repro3Title"), desc: t("repro3Desc") },
        { n: "04", title: t("repro4Title"), desc: t("repro4Desc") },
    ];

    /* Bars deepen and thicken with depth: a soil profile, not a bar chart. */
    const SOIL_DEPTHS = [
        { depth: "0-5 cm", ph: "pH 5.3", acidic: true, sand: 42, silt: 34, clay: 24, h: 34, shade: 1 },
        { depth: "5-15", ph: "pH 5.6", acidic: false, sand: 39, silt: 35, clay: 26, h: 34, shade: 0.94 },
        { depth: "15-30", ph: "pH 6.1", acidic: false, sand: 34, silt: 36, clay: 30, h: 44, shade: 0.88 },
        { depth: "30-60", ph: "pH 6.4", acidic: false, sand: 30, silt: 34, clay: 36, h: 52, shade: 0.82 },
        { depth: "60-100", ph: "pH 6.6", acidic: false, sand: 27, silt: 33, clay: 40, h: 60, shade: 0.76 },
    ];

    const HOST_POINTS = [t("host1"), t("host2"), t("host3"), t("host4")];

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            {!isAuthenticated && <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />}

            {/* ── Navbar ─────────────────────────────────────────── */}
            <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
                <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
                    <Link href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
                        <Leaf className="h-5 w-5 text-primary" strokeWidth={2} />
                        OpenFarm
                    </Link>

                    <div className="flex items-center gap-5">
                        {NAV.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                className="hidden whitespace-nowrap text-[13px] text-muted-foreground transition-colors hover:text-foreground md:inline"
                            >
                                {item.label}
                            </a>
                        ))}
                        <a
                            href={REPO}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden items-center gap-2 whitespace-nowrap text-[13px] transition-colors hover:text-primary sm:inline-flex"
                        >
                            <Github className="h-4 w-4" />
                            {tc("github")}
                        </a>
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

            {/* ── Hero: the fold is the product, not a background ──── */}
            <section className="dark relative isolate overflow-hidden text-foreground">
                <div className="absolute inset-0" style={{ backgroundImage: IMAGERY }} aria-hidden="true" />
                <div
                    className="absolute inset-0 opacity-50"
                    style={{ backgroundImage: GRATICULE, backgroundSize: "88px 88px, 104px 104px" }}
                    aria-hidden="true"
                />
                <FieldRaster
                    cols={8}
                    rows={18}
                    className="absolute right-[2%] top-[6%] hidden h-[76%] w-[46%] lg:block"
                />
                <FieldRaster
                    cols={5}
                    rows={15}
                    scale={0.86}
                    className="absolute right-[34%] top-[52%] hidden h-[34%] w-[15%] opacity-85 lg:block"
                />
                <div className="absolute inset-0 lg:hidden" style={{ background: SCRIM_NARROW }} aria-hidden="true" />
                <div
                    className="absolute inset-0 hidden lg:block"
                    style={{ background: SCRIM_WIDE }}
                    aria-hidden="true"
                />

                <div className="relative mx-auto grid max-w-6xl items-center gap-11 px-6 py-16 lg:grid-cols-2 lg:py-20">
                    <div>
                        <div className="inline-flex items-center gap-2.5 rounded-full border border-strong bg-surface-1/90 px-3.5 py-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                            <span className="text-[12.5px]">{t("badge")}</span>
                        </div>

                        <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl">
                            {t("heroTitle1")} <span className="text-primary">{t("heroTitle2")}</span>
                        </h1>

                        <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-muted-foreground">
                            {t("heroDesc")}
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button size="lg" asChild>
                                <a href={REPO} target="_blank" rel="noopener noreferrer">
                                    {t("deployCta")}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </a>
                            </Button>
                            <Button variant="outline" size="lg" className="border-strong bg-background/60" asChild>
                                {isAuthenticated ? (
                                    <Link href="/dashboard">{t("demoCta")}</Link>
                                ) : (
                                    <button onClick={openApp}>{t("demoCta")}</button>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Explainability card: observation, window, and the why */}
                    <div className="overflow-hidden rounded-xl border border-strong bg-surface-3/95 shadow-panel backdrop-blur-md">
                        <div className="flex items-center gap-2 border-b px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                                {t("cardField")}
                            </p>
                            <p className="ml-auto font-mono text-[11px] text-muted-foreground">{t("cardDate")}</p>
                        </div>

                        <div className="p-4">
                            <div className="flex items-start gap-3">
                                <ShieldAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-sev-high" />
                                <div className="min-w-0 flex-1">
                                    <span className="rounded-full bg-sev-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-destructive-foreground">
                                        {t("cardSeverity")}
                                    </span>
                                    <p className="mt-2.5 text-[15px] font-medium leading-snug">{t("cardAlert")}</p>
                                </div>
                            </div>

                            <AlertSparkline label={t("cardAnnotation")} />

                            <div className="my-3 h-px bg-border" />

                            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                                {t("whyTitle")}
                            </p>
                            <div className="mt-2.5 space-y-2">
                                <div className="flex items-center gap-2.5 text-[12.5px]">
                                    <CloudRain className="h-4 w-4 shrink-0 text-sig-precip" />
                                    <span className="flex-1 text-muted-foreground">{t("whyRain")}</span>
                                    <span className="font-mono tabular-nums">2 mm</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-[12.5px]">
                                    <Sun className="h-4 w-4 shrink-0 text-sig-et0" />
                                    <span className="flex-1 text-muted-foreground">{t("whyEt")}</span>
                                    <span className="font-mono tabular-nums">31 mm</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-[12.5px]">
                                    <Droplets className="h-4 w-4 shrink-0 text-sig-water" />
                                    <span className="flex-1 text-muted-foreground">{t("whyBalance")}</span>
                                    <span className="font-mono tabular-nums text-danger">-29 mm</span>
                                </div>
                            </div>

                            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-subtle p-3">
                                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                                <p className="text-[12.5px] leading-relaxed">{t("cardVerdict")}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats sit on the imagery, still inside the fold */}
                <div className="relative border-t border-strong/80 bg-background/85 backdrop-blur">
                    <div className="mx-auto flex max-w-6xl flex-wrap gap-x-10 gap-y-5 px-6 py-5">
                        {STATS.map((s) => (
                            <div key={s.label}>
                                <p className="font-mono text-[22px] font-semibold tabular-nums">{s.value}</p>
                                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Multi-index ────────────────────────────────────── */}
            <section id="how-it-works" className="scroll-mt-16 border-t bg-surface-2">
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <SectionHeader tag={t("multiTag")} title={t("multiTitle")} desc={t("multiDesc")} />

                    <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                        {INDEX_CARDS.map((c) => (
                            <div key={c.name} className="overflow-hidden rounded-lg border bg-card">
                                <div className="relative h-[150px]" style={{ backgroundImage: IMAGERY }}>
                                    <FieldRaster cols={16} rows={10} scale={c.scale} ramp={c.ramp} className="absolute inset-2" />
                                </div>
                                <div className="p-3.5">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-sm font-semibold">{c.name}</span>
                                        <span className="font-mono text-[13px] tabular-nums">
                                            {c.value.toFixed(3)}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">{c.label}</p>
                                    {/* Fixed scale, with this scene's mean marked on it */}
                                    <div
                                        className="relative mt-3.5 h-2 rounded-sm border"
                                        style={{
                                            background:
                                                c.ramp === "water" ? "var(--ramp-water)" : "var(--ramp-vegetation)",
                                        }}
                                        aria-hidden="true"
                                    >
                                        <span
                                            className="absolute -top-[3px] h-[14px] w-0.5 -translate-x-1/2 rounded-full bg-foreground ring-1 ring-background"
                                            style={{
                                                left: `${((c.value - c.min) / (c.max - c.min)) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                                        <span>{c.min.toFixed(1)}</span>
                                        <span>{c.max.toFixed(1)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("multiCaption")}</p>
                </div>
            </section>

            {/* ── Season timeline ────────────────────────────────── */}
            <section className="border-t">
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <SectionHeader tag={t("seasonTag")} title={t("seasonTitle")} desc={t("seasonDesc")} />

                    <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
                        {SEASON.map((s) => (
                            <div key={s.date} className="flex flex-col gap-2">
                                <div
                                    className="relative h-[104px] overflow-hidden rounded-lg border"
                                    style={{ backgroundImage: IMAGERY }}
                                >
                                    <FieldRaster cols={9} rows={8} scale={s.scale} className="absolute inset-[5px]" />
                                </div>
                                <div className="flex items-baseline justify-between gap-1.5">
                                    <span className="text-[11px] text-muted-foreground">{s.date}</span>
                                    <span className="font-mono text-[11.5px] tabular-nums">{s.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Three layers ───────────────────────────────────── */}
            <section id="architecture" className="scroll-mt-16 border-t bg-surface-2">
                <div className="mx-auto grid w-full max-w-6xl items-center gap-11 px-6 py-20 lg:grid-cols-2">
                    <div>
                        <SectionHeader tag={t("layersTag")} title={t("layersTitle")} desc={t("layersDesc")} />

                        <div className="mt-6 flex flex-col gap-3">
                            {PLANES.map((p) => (
                                <div key={p.name} className="flex items-start gap-3">
                                    <span className={`mt-[5px] h-2.5 w-2.5 shrink-0 rounded-sm ${p.swatch}`} aria-hidden="true" />
                                    <div>
                                        <p className="text-[13.5px] font-medium">{p.name}</p>
                                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                                            {p.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Delivery and intelligence read down onto the observation stack */}
                    <div className="flex flex-col items-center">
                        <div className="mb-4 flex w-full max-w-[400px] flex-col items-center gap-3.5">
                            <div className="flex w-full items-center gap-3 rounded-lg border border-sig-yield/40 bg-sig-yield/10 px-3.5 py-2.5">
                                <span className="font-mono text-[11px] text-sig-yield">C</span>
                                <span className="text-[13px]">{t("layerC")}</span>
                            </div>
                            <ArrowUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <div className="flex w-full items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2.5">
                                <span className="font-mono text-[11px] text-primary">B</span>
                                <span className="text-[13px]">{t("layerB")}</span>
                            </div>
                            <ArrowUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>

                        <div className="flex w-full max-w-[420px] flex-col gap-3.5 py-4">
                            <Plane label={t("layerBoundaries").toLowerCase()} border="border-strong">
                                <div className="absolute inset-0" style={{ background: "hsl(var(--map-scrim))" }} />
                                <FieldOutline className="absolute left-[24%] top-[12%] h-[74%] w-[46%]" />
                                <div className="absolute left-[76%] top-[26%] h-[44%] w-[18%] rounded-sm border-2 border-primary bg-primary/10" />
                            </Plane>

                            <Plane label={t("layerSatellite").toLowerCase()} border="border-strong">
                                <div className="absolute inset-0" style={{ backgroundImage: IMAGERY_FLAT }} />
                                <FieldRaster cols={8} rows={4} className="absolute left-[24%] top-[8%] h-[82%] w-[46%]" />
                            </Plane>

                            <Plane label={t("layerWeather").toLowerCase()} border="border-sig-precip/40">
                                <div className="absolute inset-0" style={{ background: "hsl(var(--map-scrim))" }} />
                                <div className="absolute inset-0 bg-sig-precip/10" />
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        backgroundImage:
                                            "linear-gradient(90deg, hsl(var(--sig-precip) / 0.28) 1px, transparent 1px), linear-gradient(0deg, hsl(var(--sig-precip) / 0.28) 1px, transparent 1px)",
                                        backgroundSize: "24px 24px",
                                    }}
                                />
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        background:
                                            "radial-gradient(circle at 34% 50%, hsl(var(--sig-precip) / 0.45), transparent 46%), radial-gradient(circle at 74% 56%, hsl(var(--sig-precip) / 0.22), transparent 42%)",
                                    }}
                                />
                            </Plane>

                            <Plane label={t("layerSoil").toLowerCase()} border="border-soil-sand/40">
                                <div className="absolute inset-0" style={{ background: "hsl(var(--map-scrim))" }} />
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        background:
                                            "repeating-linear-gradient(0deg, hsl(var(--soil-sand) / 0.34) 0 14px, hsl(var(--soil-silt) / 0.24) 14px 30px, hsl(var(--soil-clay) / 0.26) 30px 48px)",
                                    }}
                                />
                            </Plane>

                            <div className="mt-1 flex items-center gap-3.5">
                                <div className="min-w-0 flex-1">
                                    <span className="inline-block rounded-md border border-info/40 bg-info/10 px-2.5 py-1 font-mono text-[11px] text-info">
                                        {t("layerA")}
                                    </span>
                                </div>
                                <span className="w-[78px] shrink-0" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Reproducible: each step carries its own artefact ─── */}
            <section className="border-t">
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <SectionHeader tag={t("reproTag")} title={t("reproTitle")} desc={t("reproDesc")} />

                    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {REPRO_STEPS.map((s, i) => (
                            <div key={s.n} className="overflow-hidden rounded-lg border bg-card">
                                <div
                                    className="relative h-[92px] overflow-hidden"
                                    style={
                                        i === 0
                                            ? { backgroundImage: IMAGERY }
                                            : { background: "hsl(var(--map-scrim))" }
                                    }
                                    aria-hidden="true"
                                >
                                    {/* 01 scene footprint over the STAC search grid */}
                                    {i === 0 && (
                                        <>
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    backgroundImage:
                                                        "linear-gradient(90deg, hsl(var(--info) / 0.5) 1px, transparent 1px), linear-gradient(0deg, hsl(var(--info) / 0.5) 1px, transparent 1px)",
                                                    backgroundSize: "30px 30px",
                                                }}
                                            />
                                            <div className="absolute left-[30%] top-[24%] h-[52%] w-[38%] border-[1.5px] border-dashed border-primary bg-primary/10" />
                                        </>
                                    )}
                                    {/* 02 the index written out as a COG */}
                                    {i === 1 && <FieldRaster cols={15} rows={5} className="absolute inset-2.5" />}
                                    {/* 03 the same COG cut into tiles */}
                                    {i === 2 && (
                                        <>
                                            <FieldRaster cols={15} rows={5} className="absolute inset-2.5" />
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    backgroundImage:
                                                        "linear-gradient(90deg, hsl(var(--map-scrim) / 0.9) 1px, transparent 1px), linear-gradient(0deg, hsl(var(--map-scrim) / 0.9) 1px, transparent 1px)",
                                                    backgroundSize: "31px 31px",
                                                }}
                                            />
                                        </>
                                    )}
                                    {/* 04 zonal stats, kept next to the scene */}
                                    {i === 3 && (
                                        <div className="absolute inset-0 px-2.5 py-3">
                                            <StatsSparkline />
                                        </div>
                                    )}
                                </div>
                                <div className="p-3.5">
                                    <p className="font-mono text-[11px] text-primary">{s.n}</p>
                                    <p className="mt-1.5 text-sm font-semibold">{s.title}</p>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3.5 flex items-center gap-2.5 rounded-lg border bg-surface-2 px-4 py-3">
                        <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
                        <span className="text-[13px]">{t("reproNote")}</span>
                    </div>
                </div>
            </section>

            {/* ── Soil by depth ──────────────────────────────────── */}
            <section className="border-t bg-surface-2">
                <div className="mx-auto grid w-full max-w-6xl items-center gap-11 px-6 py-20 lg:grid-cols-2">
                    <SectionHeader tag={t("soilTag")} title={t("soilTitle")} desc={t("soilDesc")} />

                    <div className="rounded-xl border bg-card p-5">
                        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3">
                            <span className="flex items-center gap-2 text-[12.5px]">
                                <span className="h-2.5 w-2.5 rounded-sm bg-soil-sand" aria-hidden="true" />
                                {t("soilSand")}
                            </span>
                            <span className="flex items-center gap-2 text-[12.5px]">
                                <span className="h-2.5 w-2.5 rounded-sm bg-soil-silt" aria-hidden="true" />
                                {t("soilSilt")}
                            </span>
                            <span className="flex items-center gap-2 text-[12.5px]">
                                <span className="h-2.5 w-2.5 rounded-sm bg-soil-clay" aria-hidden="true" />
                                {t("soilClay")}
                            </span>
                            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                                {t("soilSource")}
                            </span>
                        </div>

                        <div className="flex flex-col gap-[3px]">
                            {SOIL_DEPTHS.map((d, i) => (
                                <div key={d.depth} className="flex items-stretch gap-3">
                                    <span className="w-14 shrink-0 self-center font-mono text-[11px] text-muted-foreground">
                                        {d.depth}
                                    </span>
                                    <div
                                        className={`flex min-w-0 flex-1 overflow-hidden ${i === 0 ? "rounded-t-sm" : ""} ${
                                            i === SOIL_DEPTHS.length - 1 ? "rounded-b-sm" : ""
                                        }`}
                                        style={{ height: d.h, filter: `brightness(${d.shade})` }}
                                    >
                                        <div className="bg-soil-sand" style={{ flex: d.sand }} />
                                        <div className="bg-soil-silt" style={{ flex: d.silt }} />
                                        <div className="bg-soil-clay" style={{ flex: d.clay }} />
                                    </div>
                                    <span
                                        className={`w-14 shrink-0 self-center text-right font-mono text-[11px] tabular-nums ${
                                            d.acidic ? "text-caution" : "text-muted-foreground"
                                        }`}
                                    >
                                        {d.ph}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <p className="mt-3.5 text-[11.5px] leading-relaxed text-muted-foreground">{t("soilCaption")}</p>
                    </div>
                </div>
            </section>

            {/* ── Self-host ──────────────────────────────────────── */}
            <section id="self-host" className="scroll-mt-16 border-t">
                <div className="mx-auto grid w-full max-w-6xl items-start gap-10 px-6 py-20 lg:grid-cols-2">
                    <div>
                        <SectionHeader tag={t("hostTag")} title={t("hostTitle")} desc={t("hostDesc")} />

                        <ul className="mt-6 flex flex-col gap-2.5">
                            {HOST_POINTS.map((p) => (
                                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    {p}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-strong bg-background">
                        <div className="flex items-center gap-2 border-b px-3.5 py-3">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--border-strong))" }} aria-hidden="true" />
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--border-strong))" }} aria-hidden="true" />
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--border-strong))" }} aria-hidden="true" />
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground">bash</span>
                        </div>
                        <div className="p-4 font-mono text-[12.5px] leading-[1.85] [overflow-wrap:anywhere]">
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
                            <p className="mt-3 text-muted-foreground"># web :3000 · API :8000 · tiles :8080</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FAQ: the questions, answered where they are asked ── */}
            <section id="faq" className="scroll-mt-16 border-t bg-surface-2">
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <SectionHeader tag={tf("tag")} title={tf("title")} desc={tf("desc")} />

                    <div className="mt-8 grid gap-x-10 gap-y-7 lg:grid-cols-2">
                        {FAQ_IDS.map((id) => (
                            <div key={id}>
                                <h3 className="text-[15px] font-semibold leading-snug">{tf(`${id}.q`)}</h3>
                                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                                    {tf(`${id}.a`)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Closing call to action ─────────────────────────── */}
            <section className="border-t">
                <div className="mx-auto max-w-6xl px-6 py-20 text-center">
                    <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{t("footerLine")}</h2>
                    <p className="mx-auto mt-3.5 max-w-[56ch] text-[15px] leading-relaxed text-muted-foreground">
                        {t("ctaDesc")}
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Button size="lg" asChild>
                            <a href={REPO} target="_blank" rel="noopener noreferrer">
                                {t("deployCta")}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                        <Button variant="outline" size="lg" asChild>
                            <a href={`${REPO}/blob/main/ROADMAP.md`} target="_blank" rel="noopener noreferrer">
                                {t("roadmapCta")}
                            </a>
                        </Button>
                    </div>
                </div>
            </section>

            {/* ── Acknowledgements ───────────────────────────────── */}
            <section className="border-t bg-surface-2">
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <SectionHeader tag={t("thanksTag")} title={t("thanksTitle")} desc={t("thanksDesc")} />

                    <div className="mt-8 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                        {BUILT_WITH.map((b) => (
                            <a
                                key={b.name}
                                href={b.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-2.5 rounded-lg border bg-card px-2 py-4 text-muted-foreground transition-colors hover:border-strong hover:text-foreground"
                            >
                                <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor" aria-hidden="true">
                                    <path d={b.path} />
                                </svg>
                                <span className="text-center text-[11px] leading-tight">{b.name}</span>
                            </a>
                        ))}
                    </div>

                    <div className="mt-2.5 grid gap-2.5 lg:grid-cols-3">
                        <div className="rounded-lg border bg-card p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                                {t("thanksDataLabel")}
                            </p>
                            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                                {DATA_SOURCES.map((d, i) => (
                                    <span key={d.name}>
                                        {i > 0 && " · "}
                                        <a
                                            href={d.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors hover:text-foreground"
                                        >
                                            {d.name}
                                        </a>
                                    </span>
                                ))}
                            </p>
                        </div>

                        <div className="rounded-lg border bg-card p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                                {t("thanksAlsoLabel")}
                            </p>
                            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                                {ALSO_BUILT_WITH.map((d, i) => (
                                    <span key={d.name}>
                                        {i > 0 && " · "}
                                        <a
                                            href={d.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors hover:text-foreground"
                                        >
                                            {d.name}
                                        </a>
                                    </span>
                                ))}
                            </p>
                        </div>

                        <div className="rounded-lg border bg-card p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                                {t("thanksHostingLabel")}
                            </p>
                            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                                <a
                                    href="https://www.oracle.com/cloud/free/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="transition-colors hover:text-foreground"
                                >
                                    Oracle Cloud Infrastructure
                                </a>{" "}
                                {t("thanksHostingDesc")}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer bar ─────────────────────────────────────── */}
            <footer className="border-t">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-7">
                    <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-primary" strokeWidth={2} />
                        <span className="text-[13px] text-muted-foreground">{t("footerTagline")}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <a
                            href={`${REPO}#readme`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {t("footerDocs")}
                        </a>
                        <a
                            href={`${REPO}/blob/main/ARCHITECTURE.md`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {t("navArchitecture")}
                        </a>
                        <a
                            href={`${REPO}/blob/main/CONTRIBUTING.md`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {t("footerContributing")}
                        </a>
                        <a
                            href={DISCORD}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {t("footerDiscord")}
                        </a>
                        <LanguageSwitcher side="top" align="end" />
                        <ThemeToggle />
                    </div>
                </div>
            </footer>
        </div>
    );
}
