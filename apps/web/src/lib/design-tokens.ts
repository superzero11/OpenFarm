/**
 * Resolve design-system tokens for consumers that need concrete color
 * strings instead of CSS classes (MapLibre paint properties, ECharts).
 *
 * Token values live in the token layer of globals.css as HSL triplets.
 * Reading them here keeps the "one quantity, one colour" binding intact
 * outside the DOM - never hardcode a hex where a token exists.
 */
export function tokenColor(varName: string, alpha?: number): string {
    if (typeof window === "undefined") return "hsl(0 0% 50%)";
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();
    if (!value) return "hsl(0 0% 50%)";
    return alpha != null ? `hsl(${value} / ${alpha})` : `hsl(${value})`;
}
