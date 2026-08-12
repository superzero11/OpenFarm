/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border) / <alpha-value>)",
                input: "hsl(var(--input) / <alpha-value>)",
                ring: "hsl(var(--ring) / <alpha-value>)",
                background: "hsl(var(--background) / <alpha-value>)",
                foreground: "hsl(var(--foreground) / <alpha-value>)",
                primary: {
                    DEFAULT: "hsl(var(--primary) / <alpha-value>)",
                    foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
                    // Tint background for active nav, icon wells and selected rows.
                    // DESIGN.md names bg-primary-subtle - without this key the class
                    // silently does not exist and callers fall back to bg-primary/10,
                    // which is a different colour in dark mode.
                    subtle: "hsl(var(--primary-subtle) / <alpha-value>)",
                    border: "hsl(var(--primary-border) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
                    foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
                    foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted) / <alpha-value>)",
                    foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent) / <alpha-value>)",
                    foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover) / <alpha-value>)",
                    foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
                },
                card: {
                    DEFAULT: "hsl(var(--card) / <alpha-value>)",
                    foreground: "hsl(var(--card-foreground) / <alpha-value>)",
                },
                surface: {
                    1: "hsl(var(--surface-1) / <alpha-value>)",
                    2: "hsl(var(--surface-2) / <alpha-value>)",
                    3: "hsl(var(--surface-3) / <alpha-value>)",
                },
                success: { DEFAULT: "hsl(var(--success) / <alpha-value>)", subtle: "hsl(var(--success-subtle) / <alpha-value>)" },
                warning: { DEFAULT: "hsl(var(--warning) / <alpha-value>)", subtle: "hsl(var(--warning-subtle) / <alpha-value>)" },
                caution: { DEFAULT: "hsl(var(--caution) / <alpha-value>)", subtle: "hsl(var(--caution-subtle) / <alpha-value>)" },
                danger: { DEFAULT: "hsl(var(--danger) / <alpha-value>)", subtle: "hsl(var(--danger-subtle) / <alpha-value>)" },
                info: { DEFAULT: "hsl(var(--info) / <alpha-value>)", subtle: "hsl(var(--info-subtle) / <alpha-value>)" },
                sev: {
                    high: "hsl(var(--sev-high) / <alpha-value>)",
                    medium: "hsl(var(--sev-medium) / <alpha-value>)",
                    low: "hsl(var(--sev-low) / <alpha-value>)",
                },
                sig: {
                    vegetation: "hsl(var(--sig-vegetation) / <alpha-value>)",
                    water: "hsl(var(--sig-water) / <alpha-value>)",
                    precip: "hsl(var(--sig-precip) / <alpha-value>)",
                    temp: "hsl(var(--sig-temp) / <alpha-value>)",
                    et0: "hsl(var(--sig-et0) / <alpha-value>)",
                    vpd: "hsl(var(--sig-vpd) / <alpha-value>)",
                    carbon: "hsl(var(--sig-carbon) / <alpha-value>)",
                    yield: "hsl(var(--sig-yield) / <alpha-value>)",
                },
                soil: {
                    sand: "hsl(var(--soil-sand) / <alpha-value>)",
                    silt: "hsl(var(--soil-silt) / <alpha-value>)",
                    clay: "hsl(var(--soil-clay) / <alpha-value>)",
                },
            },
            fontFamily: {
                sans: ["var(--font-sans)"],
                mono: ["var(--font-mono)"],
            },
            borderColor: {
                strong: "hsl(var(--border-strong))",
            },
            boxShadow: {
                panel: "var(--shadow-panel)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "var(--radius-xl)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
