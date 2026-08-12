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
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                surface: {
                    1: "hsl(var(--surface-1))",
                    2: "hsl(var(--surface-2))",
                    3: "hsl(var(--surface-3))",
                },
                success: { DEFAULT: "hsl(var(--success))", subtle: "hsl(var(--success-subtle))" },
                warning: { DEFAULT: "hsl(var(--warning))", subtle: "hsl(var(--warning-subtle))" },
                caution: { DEFAULT: "hsl(var(--caution))", subtle: "hsl(var(--caution-subtle))" },
                danger: { DEFAULT: "hsl(var(--danger))", subtle: "hsl(var(--danger-subtle))" },
                info: { DEFAULT: "hsl(var(--info))", subtle: "hsl(var(--info-subtle))" },
                sev: {
                    high: "hsl(var(--sev-high))",
                    medium: "hsl(var(--sev-medium))",
                    low: "hsl(var(--sev-low))",
                },
                sig: {
                    vegetation: "hsl(var(--sig-vegetation))",
                    water: "hsl(var(--sig-water))",
                    precip: "hsl(var(--sig-precip))",
                    temp: "hsl(var(--sig-temp))",
                    et0: "hsl(var(--sig-et0))",
                    vpd: "hsl(var(--sig-vpd))",
                    carbon: "hsl(var(--sig-carbon))",
                    yield: "hsl(var(--sig-yield))",
                },
                soil: {
                    sand: "hsl(var(--soil-sand))",
                    silt: "hsl(var(--soil-silt))",
                    clay: "hsl(var(--soil-clay))",
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
